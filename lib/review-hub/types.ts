export type ReviewAssignment = {
  id: string;
  shop: string;
  title: string;
  targetCount: number;
  dueDate: string;
  assignees: string[];
  createdAt: string;
};

export type ReviewSubmission = {
  id: string;
  taskId: string;
  shop: string;
  title: string;
  staff: string;
  orderNo: string;
  buyerId: string;
  note: string;
  createdAt: string;
};

export type ShopTarget = {
  monthlyTarget: number;
  note: string;
};

export type ReviewHubData = {
  /** key = 店铺名，与 options.shops 一致 */
  shopTargets: Record<string, ShopTarget>;
  assignments: ReviewAssignment[];
  submissions: ReviewSubmission[];
};
