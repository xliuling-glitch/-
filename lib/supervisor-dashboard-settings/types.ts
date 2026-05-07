export type SupervisorDashboardSettings = {
  /** SOP 必做完成率低于该比例（0~1）在看板标黄 */
  sopRateWarnBelow: number;
  /** 临时任务截止后超过多少小时算严重逾期（展示用） */
  assignedSevereHours: number;
};

export const DEFAULT_SUPERVISOR_DASHBOARD_SETTINGS: SupervisorDashboardSettings = {
  sopRateWarnBelow: 0.7,
  assignedSevereHours: 4,
};
