import type { CustomerCategory, OldCustomerProfile, RepurchaseOpportunity } from './types';
import { loadRepurchase } from './storage';

function daysBetween(a: string, b: string): number {
  const t1 = new Date(`${a}T12:00:00`).getTime();
  const t2 = new Date(`${b}T12:00:00`).getTime();
  return Math.floor(Math.abs(t1 - t2) / (86400 * 1000));
}

/** 系统推荐分类（可手动覆盖 customerCategory） */
export function recommendCustomerCategory(
  p: OldCustomerProfile,
  repRows: RepurchaseOpportunity[] = loadRepurchase(),
): CustomerCategory {
  const myRep = repRows.filter((r) => r.customerId === p.id);
  const repurchaseCount = myRep.filter((r) => r.repurchaseStatus === '已复购').length;
  const lowPrice = p.orderAmount > 0 && p.orderAmount < 2000;
  const highOrder = p.orderAmount >= 30000;
  const textBlob =
    `${p.usageScenario} ${p.remark} ${p.purchasedDevice} ${p.deviceModel} ${p.industry}`.toLowerCase();
  const factoryLike =
    /工厂|批量|生产|连锁|加盟|多店|仓储|食品厂/.test(textBlob) || p.isHighFrequencyCommercial;
  const upgradeIntent =
    p.hasExpansionPotential || /升级|大型|多台|扩产|更大型号/.test(textBlob) || p.customerStatus === '重点维护';

  if (factoryLike || highOrder) return '高价值客户';
  if (upgradeIntent) return '成长型客户';
  if (repurchaseCount >= 2 || p.hasConsumablePurchase || p.hasAccessoryPurchase) return '正常复购客户';
  if (lowPrice && daysBetween(p.purchaseDate, new Date().toISOString().slice(0, 10)) >= 90 && repurchaseCount === 0) {
    return '一次性低价客户';
  }
  if (p.hasConsumablePurchase || p.hasAccessoryPurchase || repurchaseCount >= 1) return '正常复购客户';
  return '成长型客户';
}
