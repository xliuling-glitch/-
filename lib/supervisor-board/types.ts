import type { WorkflowStatusKey } from '@/lib/workflow-status';

/** 主管看板「关注事项」——后续可映射为 DB 表 board_focus_items */
export type BoardFocusItem = {
  id: string;
  title: string;
  detail: string;
  status: WorkflowStatusKey;
  owner: string;
  createdAt: string;
  updatedAt: string;
};
