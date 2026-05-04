import { parseCsvToMatrix } from '@/lib/csv-utf8';

export type DailySalesCsvRow = {
  date: string;
  staff: string;
  shop: string;
  reception: number;
  aftersale: number;
  invalidInquiry: number;
  presale: number;
  deals: number;
  sales: number;
};

function norm(s: string) {
  return s.replace(/^\uFEFF/, '').trim();
}

function compact(s: string) {
  return norm(s).replace(/\s+/g, '').toLowerCase();
}

/** 表头 → 标准字段名（含历史导出英文列名） */
const HEADER_ALIASES: Record<string, keyof DailySalesCsvRow | '_skip'> = {
  日期: 'date',
  date: 'date',
  客服: 'staff',
  姓名: 'staff',
  staff: 'staff',
  客服名称: 'staff',
  店铺: 'shop',
  shop: 'shop',
  接待人数: 'reception',
  接待: 'reception',
  received_count: 'reception',
  receivedcount: 'reception',
  售后: 'aftersale',
  售后人数: 'aftersale',
  after_sales: 'aftersale',
  aftersales: 'aftersale',
  无效: 'invalidInquiry',
  无效询单: 'invalidInquiry',
  invalid_count: 'invalidInquiry',
  invalidcount: 'invalidInquiry',
  售前: 'presale',
  售前人数: 'presale',
  pre_sales: 'presale',
  presales: 'presale',
  成交人数: 'deals',
  成交: 'deals',
  deal_count: 'deals',
  dealcount: 'deals',
  日销售额: 'sales',
  销售额: 'sales',
  daily_sales: 'sales',
  dailysales: 'sales',
  id: '_skip',
  created_at: '_skip',
  createdat: '_skip',
};

function mapHeader(cell: string): keyof DailySalesCsvRow | '_skip' | null {
  const variants = [norm(cell), compact(cell), norm(cell).replace(/\s+/g, '')];
  for (const v of variants) {
    const hit = HEADER_ALIASES[v] ?? HEADER_ALIASES[v.toLowerCase()];
    if (hit === '_skip') return '_skip';
    if (hit) return hit;
  }
  const c = compact(cell);
  if (c === 'invalid_count' || c === 'invalidcount') return 'invalidInquiry';
  return null;
}

export function parseDailySalesCsv(text: string): { rows: DailySalesCsvRow[]; errors: string[] } {
  const matrix = parseCsvToMatrix(text);
  const errors: string[] = [];
  if (matrix.length < 2) {
    errors.push('CSV 至少需要表头与一行数据');
    return { rows: [], errors };
  }
  const headerCells = matrix[0];
  const colIndex: Partial<Record<keyof DailySalesCsvRow, number>> = {};
  for (let i = 0; i < headerCells.length; i++) {
    const m = mapHeader(headerCells[i] ?? '');
    if (m && m !== '_skip') colIndex[m] = i;
  }
  const required: (keyof DailySalesCsvRow)[] = ['date', 'staff', 'shop', 'reception', 'aftersale', 'invalidInquiry', 'presale', 'deals', 'sales'];
  for (const k of required) {
    if (colIndex[k] === undefined) {
      errors.push(`缺少列：${k}（请对照模板表头）`);
    }
  }
  if (errors.length) return { rows: [], errors };

  const rows: DailySalesCsvRow[] = [];
  for (let r = 1; r < matrix.length; r++) {
    const line = matrix[r];
    const get = (k: keyof DailySalesCsvRow) => {
      const idx = colIndex[k]!;
      return (line[idx] ?? '').trim();
    };
    const date = get('date');
    const staff = get('staff');
    const shop = get('shop');
    if (!date && !staff && !shop && line.every((c) => !String(c).trim())) continue;
    if (!date || !staff || !shop) {
      errors.push(`第 ${r + 1} 行：日期、客服、店铺不能为空`);
      continue;
    }
    rows.push({
      date,
      staff,
      shop,
      reception: Number(get('reception')) || 0,
      aftersale: Number(get('aftersale')) || 0,
      invalidInquiry: Number(get('invalidInquiry')) || 0,
      presale: Number(get('presale')) || 0,
      deals: Number(get('deals')) || 0,
      sales: Number(get('sales')) || 0,
    });
  }
  if (!rows.length && !errors.length) errors.push('没有有效数据行');
  return { rows, errors };
}
