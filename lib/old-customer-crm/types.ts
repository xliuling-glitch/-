export type CustomerStatus = '正常' | '待回访' | '有售后' | '沉默' | '重点维护';

export type CustomerCategory = '一次性低价客户' | '正常复购客户' | '成长型客户' | '高价值客户';

export type GrowthStage = '阶段1：新手开店客户' | '阶段2：稳定经营客户' | '阶段3：多店/加盟客户' | '阶段4：小工厂/批量生产客户';

export type OldCustomerProfile = {
  id: string;
  customerName: string;
  phone: string;
  wechatOrPlatformId: string;
  storeName: string;
  ownerEmployee: string;
  industry: string;
  region: string;
  customerStatus: CustomerStatus;
  purchasedDevice: string;
  deviceModel: string;
  purchaseDate: string;
  orderNo: string;
  orderAmount: number;
  hasConsumablePurchase: boolean;
  hasAccessoryPurchase: boolean;
  hasAfterSalesRecord: boolean;
  dailyUsage: string;
  isBeginner: boolean;
  isHighFrequencyCommercial: boolean;
  usageScenario: string;
  hasExpansionPotential: boolean;
  customerCategory: CustomerCategory;
  growthStage: GrowthStage;
  recommendedCategory: CustomerCategory | '';
  remark: string;
  createdAt: string;
  updatedAt: string;
};

export type FollowType =
  | '售后确认'
  | '教程指导'
  | '耗材提醒'
  | '配件复购'
  | '升级推荐'
  | '评价引导'
  | '满意度';

export type FollowMethod = '电话' | '微信' | '旺旺' | '抖音';

export type FollowResult = '正常使用' | '有问题' | '需售后' | '有复购' | '有升级意向' | '暂不需要';

export type OldCustomerFollowTask = {
  id: string;
  customerId: string;
  customerName: string;
  ownerEmployee: string;
  followDate: string;
  followType: FollowType;
  followMethod: FollowMethod;
  isCompleted: boolean;
  followResult: FollowResult | '';
  nextFollowTime: string;
  remark: string;
  createdAt: string;
  updatedAt: string;
};

export type RepurchaseStatus = '待提醒' | '已提醒' | '已复购' | '暂不需要' | '流失';

export type RepurchaseOpportunity = {
  id: string;
  customerId: string;
  customerName: string;
  purchasedDevice: string;
  deviceModel: string;
  recommendedProduct: string;
  recommendedReason: string;
  repurchaseStatus: RepurchaseStatus;
  estimatedAmount: number;
  actualAmount: number;
  ownerEmployee: string;
  nextReminderTime: string;
  remark: string;
  createdAt: string;
  updatedAt: string;
};

export type AfterSalesIssueType =
  | '不会使用'
  | '配件损耗'
  | '机器故障'
  | '物流问题'
  | '质量疑问'
  | '其他';

export type CustomerSatisfaction = '满意' | '一般' | '不满意';

export type CustomerAfterSalesRecord = {
  id: string;
  customerId: string;
  deviceModel: string;
  afterSalesTime: string;
  issue: string;
  issueType: AfterSalesIssueType;
  handling: string;
  resolved: boolean;
  satisfaction: CustomerSatisfaction | '';
  affectsRepurchase: boolean;
  proofNote: string;
  createdAt: string;
  updatedAt: string;
};

export type CustomerGrowthPlanRecord = {
  id: string;
  customerId: string;
  growthStage: GrowthStage;
  note: string;
  createdAt: string;
};
