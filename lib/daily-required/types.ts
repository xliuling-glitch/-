export type DailyRequiredKey =
  | 'daily_inquiry'
  | 'lead_register'
  | 'review_register'
  | 'douyin_call'
  | 'competitor_weekly'
  | 'data_summary';

export type DailyRequiredAck = {
  id: string;
  date: string;
  employeeName: string;
  key: DailyRequiredKey;
  /** 客服或主管手填「已确认」 */
  manualDone: boolean;
  remark: string;
  updatedAt: string;
};
