export type ShiftType = 'day' | 'night';

/** 必做项 | 指导项 | 学习项 | 跳转填写项 */
export type SopActionType = 'required' | 'guide' | 'learning' | 'jump';

export type RelatedModule =
  | 'none'
  | 'lead_follow_douyin'
  | 'lead_follow_detail'
  | 'lead_follow_no_deal'
  | 'tasks_package'
  | 'kpi_daily'
  | 'reviews'
  | 'old_crm'
  | 'competitor_weekly'
  | 'calls_manage';

export type SopActionTemplate = {
  id: string;
  actionText: string;
  actionType: SopActionType;
  isRequired: boolean;
  needProof: boolean;
  relatedModule: RelatedModule;
  sort: number;
};

export type SopSlotTemplate = {
  id: string;
  shiftType: ShiftType;
  /** HH:mm */
  startTime: string;
  /** HH:mm，晚班结束可用 24:00 */
  endTime: string;
  moduleName: string;
  actions: SopActionTemplate[];
  sort: number;
  enabled: boolean;
};

export type SopProgressStatus = 'pending' | 'done' | 'skipped' | 'deferred';

/** 主管对某客服某日 SOP 的临时说明 / 班次覆盖（不写入全局模板） */
export type SopDailyOverride = {
  id: string;
  date: string;
  employeeName: string;
  /** 覆盖当日生效班次；空表示沿用工作包班次 */
  effectiveShift?: ShiftType | null;
  remark: string;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
};

export type SopProgressRecord = {
  id: string;
  date: string;
  employeeName: string;
  shiftType: ShiftType;
  sopTemplateId: string;
  actionId: string;
  status: SopProgressStatus;
  /** data URL 截图 */
  proofImages: string[];
  remark: string;
  completedAt: string;
  updatedAt: string;
};
