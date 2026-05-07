import type { RelatedModule } from '@/lib/shift-sop/types';

export type AssignedTaskPriority = 'P0' | 'P1' | 'P2' | 'P3';

export type AssignedTaskStatus =
  | 'not_started'
  | 'in_progress'
  | 'done'
  | 'pending_review'
  | 'rejected'
  | 'overdue';

export type AssignedTask = {
  id: string;
  date: string;
  taskName: string;
  taskType: string;
  assignedTo: string;
  assignedBy: string;
  priority: AssignedTaskPriority;
  /** 与业务日一致 YYYY-MM-DD；逾期判定以业务日日末为准，不再用更早的截止时刻 */
  deadline: string;
  completionMethod: string;
  targetCount: number;
  completedCount: number;
  needProof: boolean;
  needReview: boolean;
  relatedModule: RelatedModule;
  description: string;
  status: AssignedTaskStatus;
  proofImages: string[];
  rejectReason: string;
  createdAt: string;
  updatedAt: string;
};
