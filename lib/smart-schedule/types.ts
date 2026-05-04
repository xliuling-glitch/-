export type ShiftType = 'day' | 'night' | 'rest';

export type Staff = {
  id: string;
  name: string;
  joinSchedule: boolean;
  monthlyRestQuota: number;
  canNight: boolean;
  note: string;
};

export type ScheduleRules = {
  dayStart: string;
  dayEnd: string;
  nightStart: string;
  nightEnd: string;
  minDay: number;
  minNight: number;
  maxConsecutiveWork: number;
  maxConsecutiveNight: number;
};

/** 某日每个客服的班次 */
export type DayShifts = Record<string, ShiftType>;

export type MonthPlan = {
  year: number;
  month: number;
  /** date -> staffId -> shift */
  byDate: Record<string, DayShifts>;
  lastGeneratedAt?: string;
};

export type StaffStat = {
  staffId: string;
  name: string;
  dayCount: number;
  nightCount: number;
  restCount: number;
  quota: number;
  restOk: boolean;
  maxConsecutiveWork: number;
  maxConsecutiveNight: number;
};

export type Anomaly = {
  id: string;
  date?: string;
  staffId?: string;
  type: string;
  message: string;
  suggestion: string;
  severity: 'error' | 'warn';
};

export const DEFAULT_RULES: ScheduleRules = {
  dayStart: '09:00',
  dayEnd: '18:00',
  nightStart: '18:00',
  nightEnd: '02:00',
  minDay: 2,
  minNight: 1,
  maxConsecutiveWork: 6,
  maxConsecutiveNight: 2,
};

export const STORAGE_KEYS = {
  staff: 'smart-schedule-staff-v1',
  rules: 'smart-schedule-rules-v1',
  plan: 'smart-schedule-plan-v1',
} as const;
