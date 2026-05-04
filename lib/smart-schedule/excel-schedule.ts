import type { MonthPlan, ShiftType, Staff } from './types';
import { dateList, daysInMonth, emptyMonthPlan, ymd } from './engine';
import { matrixToCsvBom, parseCsvToMatrix } from '@/lib/csv-utf8';

export type ExcelImportResult = {
  plan: MonthPlan | null;
  errors: string[];
  warnings: string[];
};

/** 解析单元格为班次；无法识别时返回 rest + ok:false */
export function parseShiftCell(v: unknown): { shift: ShiftType; ok: boolean } {
  if (v == null || v === '') return { shift: 'rest', ok: true };
  const raw = String(v).trim();
  if (!raw) return { shift: 'rest', ok: true };
  const s = raw.replace(/\s/g, '');
  if (/^(白|日)(班)?$/i.test(s) || s === 'D' || s === 'd') return { shift: 'day', ok: true };
  if (/^(晚)(班)?$/i.test(s) || s === 'N' || s === 'n') return { shift: 'night', ok: true };
  if (/^休/.test(s) || /^R(EST)?$/i.test(s) || s === 'x' || s === 'X') return { shift: 'rest', ok: true };
  return { shift: 'rest', ok: false };
}

function normalizeDateHeader(cell: string, fallbackYear: number, fallbackMonth: number): string | null {
  const t = cell.trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(t)) {
    const [y, m, d] = t.split('-').map(Number);
    if (m < 1 || m > 12 || d < 1 || d > 31) return null;
    const dim = daysInMonth(y, m);
    if (d > dim) return null;
    return ymd(y, m, d);
  }
  const n = parseInt(t.replace(/[^\d]/g, ''), 10);
  if (!Number.isFinite(n) || n < 1 || n > 31) return null;
  const dim = daysInMonth(fallbackYear, fallbackMonth);
  if (n > dim) return null;
  return ymd(fallbackYear, fallbackMonth, n);
}

/** 下载排班模板：UTF-8 BOM 的 CSV，Excel / WPS 可直接打开编辑后保存再导入 */
export function downloadScheduleExcelTemplate(year: number, month: number, staff: Staff[]) {
  const join = staff.filter((s) => s.joinSchedule);
  const dates = dateList(year, month);
  const header = ['姓名', ...dates];
  const rows = join.map((s) => [s.name, ...dates.map(() => '')]);
  const notes: string[][] = [
    [],
    ['说明', '姓名须与「客服管理」中参与排班的名字一致'],
    ['', '班次填：白 / 晚 / 休（或 白班、晚班、休1）'],
    ['', '日期表头为 YYYY-MM-DD；也可只填 1–31（按下方所选年月）'],
    ['', '晚班不可人员导入时将自动改为白班'],
    ['', `模板对应 ${year}年${month}月`],
  ];
  const csv = matrixToCsvBom([header, ...rows, ...notes]);
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `排班表模板_${year}-${String(month).padStart(2, '0')}.csv`;
  a.click();
  URL.revokeObjectURL(a.href);
}

function matrixToAoa(matrix: string[][]): unknown[][] {
  return matrix.map((row) => [...row]);
}

/**
 * 从排班表文件解析。支持 **UTF-8 CSV**（推荐，无需额外依赖，Excel 可打开）。
 * 若为 .xlsx，请先在 Excel 中「另存为 CSV UTF-8」再导入，或在项目根目录执行 `npm install xlsx` 后我们再接二进制解析。
 */
export async function importScheduleFromExcel(
  file: File,
  staff: Staff[],
  fallbackYear: number,
  fallbackMonth: number,
): Promise<ExcelImportResult> {
  const errors: string[] = [];
  const warnings: string[] = [];

  const lower = file.name.toLowerCase();
  if (lower.endsWith('.xlsx') || lower.endsWith('.xls')) {
    return {
      plan: null,
      errors: [
        '当前版本仅直接导入 CSV（Excel 中打开模板后，使用「另存为 → CSV UTF-8」保存再导入）。',
        '若需直接导入 .xlsx，请在项目根目录执行：npm install xlsx，并联系开发启用 xlsx 解析。',
      ],
      warnings: [],
    };
  }

  let text: string;
  try {
    text = await file.text();
  } catch {
    return { plan: null, errors: ['无法读取文件'], warnings: [] };
  }

  let matrix: string[][];
  try {
    matrix = parseCsvToMatrix(text);
  } catch {
    return { plan: null, errors: ['CSV 解析失败'], warnings: [] };
  }

  const aoa = matrixToAoa(matrix);

  let headerRow = -1;
  let dateStrings: string[] = [];
  for (let r = 0; r < Math.min(aoa.length, 40); r++) {
    const row = aoa[r] ?? [];
    const c0 = String(row[0] ?? '').trim();
    if (c0 === '说明' || c0.startsWith('#')) break;
    if (c0 !== '姓名' && c0 !== '名字') continue;
    const ds: string[] = [];
    let rowBad = false;
    for (let c = 1; c < row.length; c++) {
      const raw = row[c];
      if (raw === '' || raw == null) break;
      const norm = normalizeDateHeader(String(raw).trim(), fallbackYear, fallbackMonth);
      if (!norm) {
        errors.push(`第 ${r + 1} 行列 ${c + 1} 无法识别为日期：${String(raw)}`);
        rowBad = true;
        break;
      }
      ds.push(norm);
    }
    if (rowBad) continue;
    if (ds.length === 0) continue;
    headerRow = r;
    dateStrings = ds;
    break;
  }

  if (headerRow < 0) {
    return { plan: null, errors: errors.length ? errors : ['未找到表头行：第一列须为「姓名」'], warnings };
  }

  let dataStart = headerRow + 1;
  while (dataStart < aoa.length) {
    const c0 = String(aoa[dataStart]?.[0] ?? '').trim();
    if (c0 === '说明' || c0.startsWith('#')) break;
    if (!c0 || c0 === '星期' || /^星期[/／]日期?$/.test(c0)) {
      dataStart++;
      continue;
    }
    const rowCheck = aoa[dataStart] ?? [];
    const looksLikeWeekRow =
      rowCheck.length > 3 &&
      rowCheck.slice(1, Math.min(4, rowCheck.length)).every((x) => /^(日|一|二|三|四|五|六)$/.test(String(x ?? '').trim()));
    if (looksLikeWeekRow && c0 !== '姓名') {
      dataStart++;
      continue;
    }
    break;
  }

  const seenDates = new Set<string>();
  for (const d of dateStrings) {
    if (seenDates.has(d)) {
      return { plan: null, errors: [`表头日期重复：${d}`], warnings };
    }
    seenDates.add(d);
  }

  const first = dateStrings[0];
  const last = dateStrings[dateStrings.length - 1];
  const y1 = Number(first.slice(0, 4));
  const m1 = Number(first.slice(5, 7));
  const y2 = Number(last.slice(0, 4));
  const m2 = Number(last.slice(5, 7));
  if (y1 !== y2 || m1 !== m2) {
    errors.push('导入失败：表头日期须属于同一年月');
    return { plan: null, errors, warnings };
  }
  const year = y1;
  const month = m1;
  const expectedDates = new Set(dateList(year, month));
  for (const d of dateStrings) {
    if (!expectedDates.has(d)) {
      errors.push(`日期 ${d} 不在 ${year}年${month}月 有效范围内`);
      return { plan: null, errors, warnings };
    }
  }

  const join = staff.filter((s) => s.joinSchedule);
  const nameToId = new Map<string, string>();
  const dupWarned = new Set<string>();
  for (const s of join) {
    const key = s.name.trim();
    if (nameToId.has(key)) {
      if (!dupWarned.has(key)) {
        dupWarned.add(key);
        warnings.push(`重名「${key}」导入时仅匹配首条客服`);
      }
    } else nameToId.set(key, s.id);
  }

  let plan = emptyMonthPlan(year, month, staff);

  for (let r = dataStart; r < aoa.length; r++) {
    const row = aoa[r] ?? [];
    const c0 = String(row[0] ?? '').trim();
    if (!c0 || c0 === '说明' || c0.startsWith('#')) break;
    const name = c0;
    const id = nameToId.get(name);
    if (!id) {
      warnings.push(`跳过未匹配姓名：${name}`);
      continue;
    }
    const st = join.find((x) => x.id === id);
    dateStrings.forEach((dateStr, i) => {
      const cell = row[i + 1];
      const { shift, ok } = parseShiftCell(cell);
      if (!ok && cell !== '' && cell != null) {
        warnings.push(`${dateStr} ${name}：无法识别「${String(cell)}」，已按休息处理`);
      }
      let finalShift = shift;
      if (shift === 'night' && st && !st.canNight) {
        finalShift = 'day';
        warnings.push(`${dateStr} ${name}：不可晚班，已改为白班`);
      }
      if (plan.byDate[dateStr]) plan.byDate[dateStr][id] = finalShift;
    });
  }

  plan = { ...plan, lastGeneratedAt: new Date().toISOString() };
  return { plan, errors: errors.length ? errors : [], warnings };
}
