import type { FollowMethod, FollowType, OldCustomerFollowTask } from './types';
import { rid, isoNow } from './storage';

function addDays(ymd: string, days: number): string {
  const d = new Date(`${ymd}T12:00:00`);
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

/** 根据成交/发货基准日生成标准回访节点（可再手动增删） */
export function buildStandardFollowMilestones(
  purchaseYmd: string,
  customerId: string,
  customerName: string,
  ownerEmployee: string,
): Omit<OldCustomerFollowTask, 'id' | 'createdAt' | 'updatedAt'>[] {
  const nodes: { offset: number; followType: FollowType; followMethod: FollowMethod }[] = [
    { offset: 1, followType: '售后确认', followMethod: '微信' },
    { offset: 3, followType: '教程指导', followMethod: '微信' },
    { offset: 7, followType: '满意度', followMethod: '电话' },
    { offset: 15, followType: '耗材提醒', followMethod: '微信' },
    { offset: 30, followType: '耗材提醒', followMethod: '微信' },
    { offset: 60, followType: '升级推荐', followMethod: '电话' },
    { offset: 90, followType: '满意度', followMethod: '电话' },
    { offset: 120, followType: '升级推荐', followMethod: '微信' },
    { offset: 180, followType: '满意度', followMethod: '电话' },
    { offset: 270, followType: '升级推荐', followMethod: '电话' },
  ];
  const now = isoNow();
  return nodes.map((n) => ({
    customerId,
    customerName,
    ownerEmployee,
    followDate: addDays(purchaseYmd, n.offset),
    followType: n.followType,
    followMethod: n.followMethod,
    isCompleted: false,
    followResult: '',
    nextFollowTime: '',
    remark: `标准节点：成交/发货基准 ${purchaseYmd} +${n.offset} 天`,
  }));
}

export function withFollowIds(rows: Omit<OldCustomerFollowTask, 'id' | 'createdAt' | 'updatedAt'>[]): OldCustomerFollowTask[] {
  const t = isoNow();
  return rows.map((r) => ({ ...r, id: rid(), createdAt: t, updatedAt: t }));
}
