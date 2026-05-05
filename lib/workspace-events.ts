/** 同标签页内通知各模块：LocalStorage 已更新（跨模块联动） */
export const WORKSPACE_STORAGE_UPDATED = 'workspace:storage-updated';

export function emitWorkspaceStorageUpdated() {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent(WORKSPACE_STORAGE_UPDATED));
}
