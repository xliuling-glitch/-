import type { LeadFollowRecord } from './types';
import { rid, isoNow } from './storage';

/** 与手工表单、`public/templates/留资跟进表_标准模板.csv` 对齐的导出列顺序 */
export const LEAD_FOLLOW_CSV_COLUMNS: { key: keyof LeadFollowRecord; header: string }[] = [
  { key: 'date', header: '日期' },
  { key: 'storeName', header: '店铺' },
  { key: 'employeeName', header: '客服名称' },
  { key: 'inquiryType', header: '咨询类型' },
  { key: 'productModel', header: '产品型号' },
  { key: 'customerType', header: '客户类型' },
  { key: 'customerPlatformId', header: '旺旺名字/ID' },
  { key: 'phone', header: '电话' },
  { key: 'customerWechat', header: '客户微信' },
  { key: 'hasAddedWechat', header: '是否已加微信' },
  { key: 'hasSentInterceptPayment', header: '是否发送截留款' },
  { key: 'isDeal', header: '是否成交' },
  { key: 'currentStatus', header: '当日状态' },
  { key: 'statusRemark', header: '状态备注' },
  { key: 'dealAmount', header: '成交金额' },
  { key: 'purchaseIntent', header: '客户购买欲望' },
  { key: 'customerLevel', header: '客户分类' },
  { key: 'firstCallDate', header: '第一次电联' },
  { key: 'firstCallResult', header: '状态/未购买原因(一)' },
  { key: 'secondCallDate', header: '第二次电联' },
  { key: 'secondCallResult', header: '状态/未购买原因(二)' },
  { key: 'thirdCallDate', header: '第三次电联' },
  { key: 'thirdCallResult', header: '状态/未购买原因(三)' },
  { key: 'fourthCallDate', header: '第四次电联' },
  { key: 'fourthCallResult', header: '状态/未购买原因(四)' },
  { key: 'sourcePlatform', header: '来源平台' },
  { key: 'isDouyinLead', header: '抖音留资' },
  { key: 'douyinCallStatus', header: '抖音电联状态' },
  { key: 'nextFollowTime', header: '下次跟进时间' },
  { key: 'remark', header: '备注' },
];

const HEADER_ALIASES: Record<string, keyof LeadFollowRecord> = {};
for (const { key, header } of LEAD_FOLLOW_CSV_COLUMNS) {
  HEADER_ALIASES[header.trim()] = key;
}
function escapeCsvCell(v: string): string {
  if (/[",\r\n]/.test(v)) return `"${v.replace(/"/g, '""')}"`;
  return v;
}

function boolToCell(b: boolean): string {
  return b ? '是' : '否';
}

function parseBoolCell(raw: string): boolean {
  const t = String(raw ?? '').trim().toLowerCase();
  return t === '是' || t === 'true' || t === '1' || t === 'yes' || t === 'y';
}

export function leadFollowRecordToCsvRow(r: LeadFollowRecord): string[] {
  return LEAD_FOLLOW_CSV_COLUMNS.map(({ key }) => {
    const v = r[key];
    if (typeof v === 'boolean') return boolToCell(v);
    if (typeof v === 'number') return String(v);
    return String(v ?? '');
  });
}

export function exportLeadFollowRecordsCsv(rows: LeadFollowRecord[]): string {
  const headers = LEAD_FOLLOW_CSV_COLUMNS.map((c) => escapeCsvCell(c.header));
  const lines = [headers.join(',')];
  for (const r of rows) {
    lines.push(leadFollowRecordToCsvRow(r).map(escapeCsvCell).join(','));
  }
  return `\ufeff${lines.join('\r\n')}`;
}

/** 简易 CSV 解析：支持引号字段与换行 */
export function parseCsvRaw(text: string): string[][] {
  const t = text.replace(/^\ufeff/, '');
  const rows: string[][] = [];
  let row: string[] = [];
  let cur = '';
  let i = 0;
  let inQ = false;
  while (i < t.length) {
    const c = t[i];
    if (inQ) {
      if (c === '"') {
        if (t[i + 1] === '"') {
          cur += '"';
          i += 2;
          continue;
        }
        inQ = false;
        i++;
        continue;
      }
      cur += c;
      i++;
      continue;
    }
    if (c === '"') {
      inQ = true;
      i++;
      continue;
    }
    if (c === ',') {
      row.push(cur);
      cur = '';
      i++;
      continue;
    }
    if (c === '\r' || c === '\n') {
      if (c === '\r' && t[i + 1] === '\n') i++;
      row.push(cur);
      cur = '';
      if (row.some((cell) => String(cell).trim())) rows.push(row);
      row = [];
      i++;
      continue;
    }
    cur += c;
    i++;
  }
  row.push(cur);
  if (row.some((cell) => String(cell).trim())) rows.push(row);
  return rows;
}

function mapHeaderCell(h: string): keyof LeadFollowRecord | undefined {
  const k = h.trim();
  return HEADER_ALIASES[k];
}

export type LeadFollowCsvImportResult =
  | { ok: true; records: LeadFollowRecord[]; skipped: number; warnings: string[] }
  | { ok: false; error: string };

/** 将表格行转为记录（缺列用默认值）；不校验业务规则 */
export function rowsToLeadFollowRecords(
  grid: string[][],
  opts: { defaultDate?: string; viewerName?: string; canImportAll?: boolean },
): LeadFollowCsvImportResult {
  if (!grid.length) return { ok: false, error: '文件为空' };
  const headerRow = grid[0].map((x) => String(x).trim());
  const colIndex: Partial<Record<keyof LeadFollowRecord, number>> = {};
  let mapped = 0;
  headerRow.forEach((h, idx) => {
    const key = mapHeaderCell(h);
    if (key !== undefined) {
      colIndex[key] = idx;
      mapped++;
    }
  });
  if (!colIndex.date || !colIndex.employeeName) {
    return {
      ok: false,
      error: '无法识别表头：至少需要「日期」「客服名称」列；请下载标准模板。',
    };
  }
  if (mapped < 8) {
    return { ok: false, error: '表头匹配列过少，请使用「留资跟进表_标准模板」导出文件或下载模板。' };
  }

  const warnings: string[] = [];
  let skipped = 0;
  const out: LeadFollowRecord[] = [];
  const now = isoNow();

  for (let r = 1; r < grid.length; r++) {
    const cells = grid[r];
    if (!cells || !cells.some((c) => String(c).trim())) continue;

    const get = (key: keyof LeadFollowRecord) => {
      const ix = colIndex[key];
      if (ix === undefined) return '';
      return String(cells[ix] ?? '').trim();
    };

    const employeeName = get('employeeName');
    if (!employeeName) {
      skipped++;
      continue;
    }
    if (!opts.canImportAll && opts.viewerName && employeeName !== opts.viewerName) {
      skipped++;
      continue;
    }

    const dateRaw = get('date') || opts.defaultDate || '';
    if (!/^\d{4}-\d{2}-\d{2}$/.test(dateRaw)) {
      warnings.push(`第 ${r + 1} 行日期格式无效（须 YYYY-MM-DD），已跳过`);
      skipped++;
      continue;
    }

    const record: LeadFollowRecord = {
      id: rid(),
      date: dateRaw,
      storeName: get('storeName') || '店铺',
      employeeName,
      inquiryType: get('inquiryType'),
      productModel: get('productModel'),
      customerType: get('customerType'),
      customerPlatformId: get('customerPlatformId'),
      phone: get('phone'),
      customerWechat: get('customerWechat'),
      hasAddedWechat: parseBoolCell(get('hasAddedWechat')),
      hasSentInterceptPayment: parseBoolCell(get('hasSentInterceptPayment')),
      isDeal: parseBoolCell(get('isDeal')),
      currentStatus: get('currentStatus'),
      statusRemark: get('statusRemark'),
      dealAmount: Number(get('dealAmount')) || 0,
      purchaseIntent: get('purchaseIntent'),
      customerLevel: get('customerLevel'),
      firstCallDate: get('firstCallDate'),
      firstCallResult: get('firstCallResult'),
      secondCallDate: get('secondCallDate'),
      secondCallResult: get('secondCallResult'),
      thirdCallDate: get('thirdCallDate'),
      thirdCallResult: get('thirdCallResult'),
      fourthCallDate: get('fourthCallDate'),
      fourthCallResult: get('fourthCallResult'),
      sourcePlatform: get('sourcePlatform'),
      isDouyinLead: parseBoolCell(get('isDouyinLead')),
      douyinCallStatus: get('douyinCallStatus'),
      nextFollowTime: get('nextFollowTime'),
      remark: get('remark'),
      createdAt: now,
      updatedAt: now,
    };
    out.push(record);
  }

  return { ok: true, records: out, skipped, warnings };
}
