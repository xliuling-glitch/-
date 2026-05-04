import type { Anomaly, DayShifts, MonthPlan, ScheduleRules, ShiftType, Staff, StaffStat } from './types';

export function daysInMonth(year: number, month: number): number {
  return new Date(year, month, 0).getDate();
}

export function ymd(year: number, month: number, day: number): string {
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

export function dateList(year: number, month: number): string[] {
  const n = daysInMonth(year, month);
  return Array.from({ length: n }, (_, i) => ymd(year, month, i + 1));
}

/** 全员休息的空白月表，供 Excel 导入等覆盖写入 */
export function emptyMonthPlan(year: number, month: number, staff: { id: string; joinSchedule: boolean }[]): MonthPlan {
  const join = staff.filter((s) => s.joinSchedule);
  const dates = dateList(year, month);
  const byDate: Record<string, DayShifts> = {};
  for (const d of dates) {
    const row: DayShifts = {};
    for (const s of join) row[s.id] = 'rest';
    byDate[d] = row;
  }
  return { year, month, byDate, lastGeneratedAt: new Date().toISOString() };
}

/** 在当月内大致均匀铺开应休日 */
function spreadRestDays(year: number, month: number, quota: number): string[] {
  if (quota <= 0) return [];
  const dim = daysInMonth(year, month);
  const out: string[] = [];
  const step = dim / (quota + 1);
  for (let i = 0; i < quota; i++) {
    const day = Math.min(dim, Math.max(1, Math.round((i + 1) * step)));
    out.push(ymd(year, month, day));
  }
  return [...new Set(out)];
}

/** 每日至少要有足够人手排白+晚，避免出现「全员休息」 */
function requiredPoolSize(rules: ScheduleRules, joinLen: number): number {
  if (joinLen <= 0) return 0;
  if (joinLen === 1) return 1;
  return Math.min(joinLen, Math.max(2, rules.minDay + rules.minNight));
}

function rowMeetsMin(row: DayShifts, join: { id: string; canNight: boolean }[], rules: ScheduleRules): boolean {
  const days = join.filter((s) => row[s.id] === 'day').length;
  const nights = join.filter((s) => row[s.id] === 'night').length;
  if (days < rules.minDay || nights < rules.minNight) return false;
  return join.every((s) => row[s.id] !== 'night' || s.canNight);
}

/** 从「计划休息」中按优先级取消休息，保证当日 pool 人数 */
function shrinkRestUntilPoolOk(
  restIds: Set<string>,
  join: Staff[],
  rules: ScheduleRules,
): void {
  const req = requiredPoolSize(rules, join.length);
  while (join.length - restIds.size < req && restIds.size > 0) {
    const candidates = [...restIds]
      .map((id) => join.find((s) => s.id === id))
      .filter((s): s is Staff => !!s);
    candidates.sort((a, b) => {
      if (b.monthlyRestQuota !== a.monthlyRestQuota) return b.monthlyRestQuota - a.monthlyRestQuota;
      return a.name.localeCompare(b.name, 'zh-CN');
    });
    restIds.delete(candidates[0].id);
  }
}

/** 生成后：尽量把被挤掉的休息天数补回（在不违反每日最低人力的前提下改为休息） */
function rebalanceRestTowardQuota(plan: MonthPlan, join: Staff[], rules: ScheduleRules): void {
  const dates = dateList(plan.year, plan.month);
  const restCountFor = (sid: string) => dates.filter((d) => plan.byDate[d][sid] === 'rest').length;

  for (const s of join) {
    let deficit = s.monthlyRestQuota - restCountFor(s.id);
    while (deficit > 0) {
      let moved = false;
      for (const d of dates) {
        if (plan.byDate[d][s.id] === 'rest') continue;
        const trial: DayShifts = { ...plan.byDate[d], [s.id]: 'rest' };
        if (!rowMeetsMin(trial, join, rules)) continue;
        plan.byDate[d] = trial;
        deficit--;
        moved = true;
        break;
      }
      if (!moved) break;
    }
  }
}

function consecutiveEnding(
  byDate: Record<string, DayShifts>,
  orderedDates: string[],
  untilDate: string,
  staffId: string,
  match: (s: ShiftType) => boolean,
): number {
  const idx = orderedDates.indexOf(untilDate);
  if (idx <= 0) return 0;
  let c = 0;
  for (let i = idx - 1; i >= 0; i--) {
    const sh = byDate[orderedDates[i]]?.[staffId];
    if (sh && match(sh)) c++;
    else break;
  }
  return c;
}

export function generateMonth(year: number, month: number, staff: Staff[], rules: ScheduleRules): MonthPlan {
  const dates = dateList(year, month);
  const join = staff.filter((s) => s.joinSchedule);
  const restPlan = new Map<string, Set<string>>();
  for (const s of join) {
    restPlan.set(s.id, new Set(spreadRestDays(year, month, s.monthlyRestQuota)));
  }

  const accDay: Record<string, number> = {};
  const accNight: Record<string, number> = {};
  for (const s of join) {
    accDay[s.id] = 0;
    accNight[s.id] = 0;
  }

  const byDate: Record<string, DayShifts> = {};

  for (const dateStr of dates) {
    const shifts: DayShifts = {};
    const restIds = new Set(join.filter((s) => restPlan.get(s.id)?.has(dateStr)).map((s) => s.id));
    shrinkRestUntilPoolOk(restIds, join, rules);
    const pool = join.filter((s) => !restIds.has(s.id));

    const pickedNightIds = new Set<string>();
    const nightCand = pool.filter((s) => s.canNight).slice();
    nightCand.sort((a, b) => {
      const na = consecutiveEnding(byDate, dates, dateStr, a.id, (x) => x === 'night');
      const nb = consecutiveEnding(byDate, dates, dateStr, b.id, (x) => x === 'night');
      if (na !== nb) return na - nb;
      if (accNight[a.id] !== accNight[b.id]) return accNight[a.id] - accNight[b.id];
      return a.name.localeCompare(b.name, 'zh-CN');
    });
    for (const s of nightCand) {
      if (pickedNightIds.size >= rules.minNight) break;
      pickedNightIds.add(s.id);
    }
    while (pickedNightIds.size < rules.minNight) {
      const next = pool.find((s) => !pickedNightIds.has(s.id));
      if (!next) break;
      pickedNightIds.add(next.id);
    }

    const pickedDayIds = new Set<string>();
    const dayCand = pool.filter((s) => !pickedNightIds.has(s.id));
    dayCand.sort((a, b) => {
      const wa = consecutiveEnding(byDate, dates, dateStr, a.id, (x) => x === 'day' || x === 'night');
      const wb = consecutiveEnding(byDate, dates, dateStr, b.id, (x) => x === 'day' || x === 'night');
      if (wa !== wb) return wb - wa;
      if (accDay[a.id] !== accDay[b.id]) return accDay[a.id] - accDay[b.id];
      return a.name.localeCompare(b.name, 'zh-CN');
    });
    for (const s of dayCand) {
      if (pickedDayIds.size >= rules.minDay) break;
      pickedDayIds.add(s.id);
    }
    while (pickedDayIds.size < rules.minDay) {
      const next = pool.find((s) => !pickedDayIds.has(s.id) && !pickedNightIds.has(s.id));
      if (!next) break;
      pickedDayIds.add(next.id);
    }

    /** 池中其余人一律上白班，避免因「未选上」变成休息导致休息天数膨胀 */
    for (const s of pool) {
      if (!pickedNightIds.has(s.id) && !pickedDayIds.has(s.id)) pickedDayIds.add(s.id);
    }

    for (const s of join) {
      if (restIds.has(s.id)) shifts[s.id] = 'rest';
      else if (pickedNightIds.has(s.id)) shifts[s.id] = 'night';
      else if (pickedDayIds.has(s.id)) shifts[s.id] = 'day';
      else shifts[s.id] = 'rest';
    }

    for (const id of pickedDayIds) accDay[id] = (accDay[id] || 0) + 1;
    for (const id of pickedNightIds) accNight[id] = (accNight[id] || 0) + 1;

    byDate[dateStr] = shifts;
  }

  const plan: MonthPlan = {
    year,
    month,
    byDate,
    lastGeneratedAt: new Date().toISOString(),
  };
  rebalanceRestTowardQuota(plan, join, rules);
  return plan;
}

export function computeStats(plan: MonthPlan | null, staff: Staff[], rules: ScheduleRules): StaffStat[] {
  if (!plan) return [];
  const dates = dateList(plan.year, plan.month);
  const join = staff.filter((s) => s.joinSchedule);
  const byId = new Map(join.map((s) => [s.id, s]));

  const dayCount: Record<string, number> = {};
  const nightCount: Record<string, number> = {};
  const restCount: Record<string, number> = {};
  for (const s of join) {
    dayCount[s.id] = 0;
    nightCount[s.id] = 0;
    restCount[s.id] = 0;
  }

  for (const d of dates) {
    const row = plan.byDate[d];
    if (!row) continue;
    for (const s of join) {
      const sh = row[s.id] || 'rest';
      if (sh === 'day') dayCount[s.id]++;
      else if (sh === 'night') nightCount[s.id]++;
      else restCount[s.id]++;
    }
  }

  const maxWorkStreak: Record<string, number> = {};
  const maxNightStreak: Record<string, number> = {};
  for (const s of join) {
    let mw = 0;
    let cw = 0;
    let mn = 0;
    let cn = 0;
    for (const d of dates) {
      const sh = plan.byDate[d]?.[s.id];
      const work = sh === 'day' || sh === 'night';
      if (work) {
        cw++;
        mw = Math.max(mw, cw);
      } else cw = 0;
      if (sh === 'night') {
        cn++;
        mn = Math.max(mn, cn);
      } else cn = 0;
    }
    maxWorkStreak[s.id] = mw;
    maxNightStreak[s.id] = mn;
  }

  return join.map((s) => ({
    staffId: s.id,
    name: s.name,
    dayCount: dayCount[s.id],
    nightCount: nightCount[s.id],
    restCount: restCount[s.id],
    quota: s.monthlyRestQuota,
    restOk: restCount[s.id] === s.monthlyRestQuota,
    maxConsecutiveWork: maxWorkStreak[s.id],
    maxConsecutiveNight: maxNightStreak[s.id],
  }));
}

export function computeAnomalies(plan: MonthPlan | null, staff: Staff[], rules: ScheduleRules): Anomaly[] {
  const out: Anomaly[] = [];
  if (!plan) return out;
  const dates = dateList(plan.year, plan.month);
  const join = staff.filter((s) => s.joinSchedule);
  let id = 0;
  const add = (a: Omit<Anomaly, 'id'>) => {
    out.push({ ...a, id: String(++id) });
  };

  for (const d of dates) {
    const row = plan.byDate[d];
    if (!row) {
      add({ date: d, type: '缺表', message: '该日无排班数据', suggestion: '重新生成或手动补全', severity: 'error' });
      continue;
    }
    const days = join.filter((s) => row[s.id] === 'day');
    const nights = join.filter((s) => row[s.id] === 'night');
    if (join.length > 0 && days.length === 0 && nights.length === 0) {
      add({
        date: d,
        type: '全员休息',
        message: '该日白班与晚班均无排班人员',
        suggestion: '至少各保留一人上白班与晚班；请调整休息或重新生成',
        severity: 'error',
      });
    }
    if (days.length < rules.minDay) {
      add({
        date: d,
        type: '白班不足',
        message: `白班仅 ${days.length} 人，低于最低 ${rules.minDay} 人`,
        suggestion: '手动从休息中调入白班，或增加可排班人力',
        severity: 'error',
      });
    }
    if (nights.length < rules.minNight) {
      add({
        date: d,
        type: '晚班不足',
        message: `晚班仅 ${nights.length} 人，低于最低 ${rules.minNight} 人`,
        suggestion: '安排可上晚班人员或临时调整规则',
        severity: 'error',
      });
    }
    for (const s of join) {
      if (row[s.id] === 'night' && !s.canNight) {
        add({
          date: d,
          staffId: s.id,
          type: '晚班资格',
          message: `${s.name} 被排到晚班但未标记可上晚班`,
          suggestion: '改为白班/休息，或勾选「可上晚班」',
          severity: 'error',
        });
      }
    }
  }

  const stats = computeStats(plan, staff, rules);
  for (const st of stats) {
    if (st.restCount !== st.quota) {
      add({
        staffId: st.staffId,
        type: '休息天数不符',
        message: `${st.name} 本月休息 ${st.restCount} 天，应休 ${st.quota} 天`,
        suggestion: '手动调整休息分布或修改应休天数后重新生成',
        severity: 'error',
      });
    }
    if (st.maxConsecutiveWork > rules.maxConsecutiveWork) {
      add({
        staffId: st.staffId,
        type: '连续上班过长',
        message: `${st.name} 最长连续上班 ${st.maxConsecutiveWork} 天（上限 ${rules.maxConsecutiveWork}）`,
        suggestion: '插入休息日打断连续上班',
        severity: 'warn',
      });
    }
    if (st.maxConsecutiveNight > rules.maxConsecutiveNight) {
      add({
        staffId: st.staffId,
        type: '连续晚班过长',
        message: `${st.name} 最长连续晚班 ${st.maxConsecutiveNight} 天（上限 ${rules.maxConsecutiveNight}）`,
        suggestion: '穿插白班或休息',
        severity: 'warn',
      });
    }
  }

  return out;
}

export function todayStr(): string {
  const t = new Date();
  return ymd(t.getFullYear(), t.getMonth() + 1, t.getDate());
}

/** 预览某日上班人员（白/晚/休）及是否满足最低人数 */
export function getDaySnapshot(plan: MonthPlan | null, staff: Staff[], rules: ScheduleRules, dateStr: string) {
  const join = staff.filter((s) => s.joinSchedule);
  const dayNames: string[] = [];
  const nightNames: string[] = [];
  const restNames: string[] = [];
  let short = true;
  let hasRow = false;

  let hint = '';
  if (plan) {
    const dim = daysInMonth(plan.year, plan.month);
    const start = ymd(plan.year, plan.month, 1);
    const end = ymd(plan.year, plan.month, dim);
    if (dateStr < start || dateStr > end) {
      hint = `当前本地排班为 ${plan.year} 年 ${plan.month} 月，请选择 ${start}～${end} 之间的日期查看。`;
    }
  } else {
    hint = '暂无排班表，请先到「自动排班」生成某月数据。';
  }

  if (plan?.byDate[dateStr]) {
    hasRow = true;
    const row = plan.byDate[dateStr];
    for (const s of join) {
      const sh = row[s.id];
      if (sh === 'day') dayNames.push(s.name);
      else if (sh === 'night') nightNames.push(s.name);
      else restNames.push(s.name);
    }
    const dc = dayNames.length;
    const nc = nightNames.length;
    short = dc < rules.minDay || nc < rules.minNight;
  }

  return { dateStr, dayNames, nightNames, restNames, short, hasRow, hint };
}

export function dashboardFromPlan(plan: MonthPlan | null, staff: Staff[], rules: ScheduleRules) {
  const t = todayStr();
  const snap = getDaySnapshot(plan, staff, rules, t);
  const anomalies = computeAnomalies(plan, staff, rules);
  const errCount = anomalies.filter((a) => a.severity === 'error').length;
  const warnCount = anomalies.filter((a) => a.severity === 'warn').length;
  return {
    today: t,
    dayNames: snap.dayNames,
    nightNames: snap.nightNames,
    restNames: snap.restNames,
    short: snap.short,
    errCount,
    warnCount,
    anomalyTotal: anomalies.length,
  };
}
