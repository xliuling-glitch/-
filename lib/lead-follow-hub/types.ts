export type DailyInquiryReport = {
  id: string;
  date: string;
  employeeName: string;
  storeName: string;
  inquiryCount: number;
  afterSalesCount: number;
  invalidCount: number;
  presalesValidCount: number;
  dealCustomerCount: number;
  dailySalesAmount: number;
  remark: string;
  createdAt: string;
  updatedAt: string;
};

export type LeadFollowRecord = {
  id: string;
  date: string;
  storeName: string;
  employeeName: string;
  inquiryType: string;
  productModel: string;
  customerType: string;
  customerPlatformId: string;
  phone: string;
  customerWechat: string;
  hasAddedWechat: boolean;
  hasSentInterceptPayment: boolean;
  isDeal: boolean;
  currentStatus: string;
  statusRemark: string;
  dealAmount: number;
  purchaseIntent: string;
  customerLevel: string;
  firstCallDate: string;
  firstCallResult: string;
  secondCallDate: string;
  secondCallResult: string;
  thirdCallDate: string;
  thirdCallResult: string;
  fourthCallDate: string;
  fourthCallResult: string;
  sourcePlatform: string;
  isDouyinLead: boolean;
  douyinCallStatus: string;
  nextFollowTime: string;
  remark: string;
  createdAt: string;
  updatedAt: string;
};

export type DouyinLeadFollowRecord = {
  id: string;
  date: string;
  employeeName: string;
  customerName: string;
  phone: string;
  douyinSource: string;
  hasCalled: boolean;
  callTime: string;
  callResult: string;
  nextFollowTime: string;
  isDeal: boolean;
  dealAmount: number;
  remark: string;
  createdAt: string;
  updatedAt: string;
};

/** 每日未成交询单反思（独立登记表，与留资明细并行） */
export type NoDealInquiryReflection = {
  id: string;
  date: string;
  storeName: string;
  employeeName: string;
  /** 旺旺 / 昵称等便于对照聊天记录 */
  customerRef: string;
  /** 询单一句话摘要 */
  inquirySummary: string;
  /** 未成交主因（对齐配置「未成交原因」选项） */
  reasonCategory: string;
  /** 原因补充说明 */
  reasonNote: string;
  /** 反思记录 */
  reflection: string;
  /** 明日改进 / 话术动作 */
  improvement: string;
  /** 可选：来源于某条留资跟进 id */
  linkedLeadFollowId?: string;
  createdAt: string;
  updatedAt: string;
};

export type LeadConversionSettings = {
  /** 留资率目标（如 0.25 = 25%），低于则红色提示 */
  targetLeadRate: number;
  /** 严格口径：除 phone/wechat/hasAddedWechat 外是否还需其它条件（预留） */
  strictLeadRules: boolean;
  /** 可选本地覆盖下拉（空则用 /api/options） */
  shops: string[];
  inquiryTypes: string[];
  customerTypes: string[];
  statusOptions: string[];
  lostReasons: string[];
};
