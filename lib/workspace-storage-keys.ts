/**
 * 三模块共用 LocalStorage 键名（与 PRD 别名对齐，便于后续接库映射）
 * - STORAGE_ALIAS_DAILY_TASKS ≈ 今日任务中心
 * - STORAGE_ALIAS_DAILY_KPI_UPLOADS ≈ KPI 每日上传中心
 */
export const STORAGE_KEY_TODAY_TASKS = 'today-tasks-v1';
export const STORAGE_KEY_KPI_DAILY_CENTER = 'kpi-daily-center-v1';
export const STORAGE_KEY_SUPERVISOR_EXCEPTION_HANDLES = 'supervisor-board-exception-handles-v1';
export const STORAGE_KEY_SUPERVISOR_FOCUS = 'supervisor-board-focus-v1';

/** 文档/对接用别名 */
export const STORAGE_ALIAS_DAILY_TASKS = STORAGE_KEY_TODAY_TASKS;
export const STORAGE_ALIAS_DAILY_KPI_UPLOADS = STORAGE_KEY_KPI_DAILY_CENTER;
