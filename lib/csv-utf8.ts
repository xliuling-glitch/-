/** Strip UTF-8 BOM (Excel often adds it). */
export function stripBom(text: string) {
  return text.charCodeAt(0) === 0xfeff ? text.slice(1) : text;
}

/** RFC4180-style: commas, quotes, newlines inside quoted fields. */
export function parseCsvToMatrix(text: string): string[][] {
  const t = stripBom(text);
  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let i = 0;
  let inQ = false;
  while (i < t.length) {
    const c = t[i];
    if (inQ) {
      if (c === '"') {
        if (t[i + 1] === '"') {
          field += '"';
          i += 2;
          continue;
        }
        inQ = false;
        i++;
        continue;
      }
      field += c;
      i++;
      continue;
    }
    if (c === '"') {
      inQ = true;
      i++;
      continue;
    }
    if (c === ',') {
      row.push(field);
      field = '';
      i++;
      continue;
    }
    if (c === '\n') {
      row.push(field);
      field = '';
      rows.push(row);
      row = [];
      i++;
      continue;
    }
    if (c === '\r') {
      i++;
      if (t[i] === '\n') i++;
      row.push(field);
      field = '';
      rows.push(row);
      row = [];
      continue;
    }
    field += c;
    i++;
  }
  row.push(field);
  if (row.some((cell) => cell.length > 0)) rows.push(row);
  return rows.filter((r) => r.length > 0);
}

function escapeCell(s: string) {
  if (/[",\r\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

/** Excel 友好：UTF-8 BOM + CRLF。 */
export function matrixToCsvBom(rows: string[][]) {
  const body = rows.map((r) => r.map(escapeCell).join(',')).join('\r\n');
  return '\uFEFF' + body;
}
