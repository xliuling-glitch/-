import type { BoardFocusItem } from './types';
import { STORAGE_KEY_SUPERVISOR_FOCUS } from '@/lib/workspace-storage-keys';
import { emitWorkspaceStorageUpdated } from '@/lib/workspace-events';

const KEY = STORAGE_KEY_SUPERVISOR_FOCUS;

export function loadFocusItems(): BoardFocusItem[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) {
      const s = seedFocus();
      localStorage.setItem(KEY, JSON.stringify(s));
      return s;
    }
    const v = JSON.parse(raw) as unknown;
    if (!Array.isArray(v)) {
      const s = seedFocus();
      localStorage.setItem(KEY, JSON.stringify(s));
      return s;
    }
    return v as BoardFocusItem[];
  } catch {
    const s = seedFocus();
    localStorage.setItem(KEY, JSON.stringify(s));
    return s;
  }
}

export function saveFocusItems(items: BoardFocusItem[]) {
  localStorage.setItem(KEY, JSON.stringify(items));
  emitWorkspaceStorageUpdated();
}

function seedFocus(): BoardFocusItem[] {
  const t = new Date().toISOString();
  return [
    {
      id: 'bf-1',
      title: '本周重点店铺转化',
      detail: '关注天猫旗舰店 P0 客户跟进节奏',
      status: 'in_progress',
      owner: '主管',
      createdAt: t,
      updatedAt: t,
    },
    {
      id: 'bf-2',
      title: 'KPI 日报催交',
      detail: '未提交名单在「今日提交情况」核对',
      status: 'pending_review',
      owner: '主管',
      createdAt: t,
      updatedAt: t,
    },
  ];
}
