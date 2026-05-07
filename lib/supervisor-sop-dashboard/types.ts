import type { ShiftType } from '@/lib/shift-sop/types';

export type InspectionStatus = 'normal' | 'in_progress' | 'warning' | 'abnormal' | 'not_started';

export type SopInspectionRow = {
  staffName: string;
  shiftType: ShiftType;
  shiftLabel: string;
  currentModule: string;
  currentSlotRange: string;
  sopRatePct: number;
  expectedRatePct: number;
  tempTaskSummary: string;
  dailyReqSummary: string;
  exceptionCount: number;
  status: InspectionStatus;
  hasAssignedOverdue: boolean;
  hasOverdueSopSlot: boolean;
  dyUncalled: number;
  dailyIncompleteCount: number;
  pendingReviewCount: number;
  requiredDone: number;
  requiredTotal: number;
  overdueActionCount: number;
};

export type SopActionInspection = {
  slotRange: string;
  moduleName: string;
  actionText: string;
  actionTypeLabel: string;
  status: 'not_started' | 'in_progress' | 'done' | 'overdue';
  completedAt: string;
  remark: string;
  actionId: string;
};

export type ClosingBoardLine = {
  key: string;
  label: string;
  state: 'done' | 'pending' | 'abnormal' | 'not_due';
};

export type SopExecException = {
  id: string;
  occurredAt: string;
  staffName: string;
  category: string;
  title: string;
  detail: string;
  severity: 'high' | 'medium' | 'low';
};
