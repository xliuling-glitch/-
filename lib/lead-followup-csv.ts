import { parseCsvToMatrix } from '@/lib/csv-utf8';

export type LeadFollowupCsvRow = {
  date: string;
  staff: string;
  shop: string;
  inquiryType: string;
  model: string;
  customerType: string;
  buyerId: string;
  phone: string;
  wechat: string;
  wechatAdded: boolean;
  holdSent: boolean;
  /** 当日状态 → FollowupLog.status */
  status: string;
  statusNote: string;
  isDeal: boolean;
  dealAmount: number | null;
  lostReason: string;
  purchaseIntent: string;
  customerCategory: string;
  intentLevel: number | null;
};

function norm(s: string) {
  return s.replace(/^\uFEFF/, '').trim();
}

function nkey(s: string) {
  return norm(s).replace(/\s+/g, '');
}

function parseBool(v: string): boolean {
  const t = norm(v).toLowerCase();
  if (t === '0' || t === '0.0' || t === '否' || t === 'false' || t === 'no' || t === 'n' || !t) return false;
  return t === '是' || t === 'true' || t === '1' || t === '1.0' || t === 'yes' || t === 'y';
}

function parseIntentLevel(s: string): number | null {
  const t = norm(s);
  if (!t) return null;
  const n = parseInt(t, 10);
  if (!Number.isNaN(n) && String(n) === t) return n;
  return null;
}

/** 根据表头单元格列表，返回列索引映射（支持标准模板 + 历史导出列名） */
function buildColumnMap(headerRow: string[]): Record<string, number> {
  const map: Record<string, number> = {};
  for (let i = 0; i < headerRow.length; i++) {
    const raw = norm(headerRow[i] ?? '');
    const key = nkey(raw);
    map[key] = i;
    map[raw] = i;
  }
  return map;
}

function col(m: Record<string, number>, ...keys: string[]): number | undefined {
  for (const k of keys) {
    const idx = m[k] ?? m[nkey(k)];
    if (idx !== undefined) return idx;
  }
  return undefined;
}

function cell(line: string[], m: Record<string, number>, ...keys: string[]): string {
  const idx = col(m, ...keys);
  if (idx === undefined) return '';
  return norm(line[idx] ?? '');
}

/** 全量导出行末 `raw_json` 内嵌原始表单字段，用于补全导出列里省略的中文列（如客户类型） */
function mergeFromRawJson(line: string[], m: Record<string, number>): Partial<{
  customerType: string;
  model: string;
  inquiryType: string;
  status: string;
  statusNote: string;
  phone: string;
  wechat: string;
}> {
  const raw = cell(line, m, 'raw_json');
  if (!raw || /^nan$/i.test(raw)) return {};
  try {
    const j = JSON.parse(raw) as Record<string, unknown>;
    const pick = (k: string) => {
      const v = j[k];
      if (typeof v !== 'string') return '';
      const t = norm(v);
      if (!t || /^nan$/i.test(t)) return '';
      return t;
    };
    return {
      customerType: pick('客户类型'),
      model: pick('产品型号'),
      inquiryType: pick('咨询类型'),
      status: pick('当日状态'),
      statusNote: pick('状态备注'),
      phone: pick('电话'),
      wechat: pick('客户微信'),
    };
  } catch {
    return {};
  }
}

export function parseLeadFollowupCsv(text: string): { rows: LeadFollowupCsvRow[]; errors: string[] } {
  const matrix = parseCsvToMatrix(text);
  const errors: string[] = [];
  if (matrix.length < 2) {
    errors.push('CSV 至少需要表头与一行数据');
    return { rows: [], errors };
  }
  const m = buildColumnMap(matrix[0]);
  const hasDate = col(m, '日期', 'date') !== undefined;
  const hasBuyer =
    col(m, '旺旺名字/ID', 'customer_id', 'buyerId', 'buyer_id', '旺旺') !== undefined;
  const hasStaff =
    col(m, '客服名称', 'staff', '跟进客服', '客服') !== undefined;
  /** 标准模板或「跟进表」系统导出（含 customer_id / batch_id 等） */
  const hasRecognizedLeadRow = hasDate && hasBuyer && hasStaff;
  if (!hasRecognizedLeadRow && !hasDate) {
    errors.push(
      '无法识别表头：请使用「留资跟进表_标准模板」或「跟进表」全量导出 CSV（需包含日期、客户 ID、客服列）。',
    );
    return { rows: [], errors };
  }
  if (!hasRecognizedLeadRow && hasDate) {
    errors.push(
      '表头缺少必需列：请确认包含「日期/date」「旺旺/客户 ID（customer_id）」「客服名称/staff」或与导出一致的列名。',
    );
    return { rows: [], errors };
  }

  const rows: LeadFollowupCsvRow[] = [];
  for (let r = 1; r < matrix.length; r++) {
    const line = matrix[r];
    const date = cell(line, m, '日期', 'date');
    const shop = cell(line, m, '店铺', 'shop');
    const staff = cell(line, m, '客服名称', '客服', 'staff', '跟进客服');
    const buyerId = cell(line, m, '旺旺名字/ID', 'customer_id', 'buyerId', 'buyer_id', '旺旺');
    if (!date && !buyerId && line.every((c) => !norm(String(c)))) continue;
    if (!buyerId) {
      errors.push(`第 ${r + 1} 行：缺少旺旺/客户 ID`);
      continue;
    }
    if (!date || !staff || !shop) {
      errors.push(`第 ${r + 1} 行：日期、店铺、客服名称不能为空`);
      continue;
    }

    const jsonEx = mergeFromRawJson(line, m);
    const inquiryType =
      cell(line, m, '咨询类型', 'product_type', 'inquiryType') || jsonEx.inquiryType || '其他';
    const model =
      cell(line, m, '产品型号', 'model') || jsonEx.model?.trim() || inquiryType;
    const customerType =
      cell(line, m, '客户类型', 'customerType') || jsonEx.customerType || '其他';
    let phone = cell(line, m, '电话', 'phone') || jsonEx.phone || '';
    let wechat = cell(line, m, '客户微信', 'wechat') || jsonEx.wechat || '';
    const wechatAdded = parseBool(cell(line, m, '是否已加微信', 'wechat_added') || '否');
    const holdSent = parseBool(cell(line, m, '是否发送截留款', 'sent_hold') || '否');

    const dealStr = cell(line, m, '是否成交', 'is_deal');
    const isDeal = parseBool(dealStr);
    const amtRaw = norm(cell(line, m, '成交金额', 'sales_amount', 'dealAmount')).toLowerCase();
    let dealAmount: number | null = null;
    if (amtRaw && amtRaw !== 'nan' && amtRaw !== 'none') {
      const n = Number(amtRaw);
      dealAmount = Number.isFinite(n) ? n : null;
    }

    const status =
      cell(line, m, '当日状态', 'stage', 'status') || jsonEx.status || '待跟进';
    const statusNote =
      cell(line, m, '状态备注', 'note', 'statusNote') || jsonEx.statusNote || '';
    const lostFromCol = cell(line, m, '状态/未购买原因(一)', 'lost_reason', '状态/未购买的原因');
    const lostReason =
      lostFromCol ||
      cell(line, m, '状态/未购买原因(二)', '状态/未购买的原因2') ||
      statusNote ||
      (isDeal ? '' : '导入：未填未购原因');

    const purchaseRaw = cell(line, m, '客户购买欲望', 'intent_level', 'purchaseIntent');
    const intentNum = parseIntentLevel(purchaseRaw);
    const purchaseIntent = intentNum != null ? String(intentNum) : purchaseRaw;

    const customerCategory = cell(line, m, '客户分类', 'tier', 'customerCategory');

    if (!phone && !wechat) {
      phone = buyerId;
      wechat = buyerId;
    }

    rows.push({
      date,
      staff,
      shop,
      inquiryType,
      model,
      customerType,
      buyerId,
      phone,
      wechat,
      wechatAdded,
      holdSent,
      status,
      statusNote,
      isDeal,
      dealAmount: isDeal ? dealAmount ?? 0 : null,
      lostReason: isDeal ? '' : lostReason || '未成交',
      purchaseIntent,
      customerCategory,
      intentLevel: intentNum,
    });
  }

  if (!rows.length && !errors.length) errors.push('没有有效数据行');
  return { rows, errors };
}
