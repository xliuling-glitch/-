import { Card } from './ui';

export function ListPage({ title, cols, rows }: { title: string; cols: string[]; rows: string[][] }) {
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="font-display text-heading-sm font-bold tracking-tight text-coal-ink">{title}</h2>
        <button type="button" className="btn-primary py-2 text-sm">
          新增
        </button>
      </div>
      <Card elevated>
        <div className="mb-4 flex flex-wrap gap-2">
          <input className="input-field max-w-xs" placeholder="搜索" />
          <select className="input-field max-w-[180px]">
            <option>全部状态</option>
          </select>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[640px] text-sm">
            <thead>
              <tr className="border-b border-ash text-left text-graphite">
                {cols.map((c) => (
                  <th key={c} className="pb-2 pr-3 pt-1 font-medium">
                    {c}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((r, i) => (
                <tr key={i} className="border-b border-ash/80">
                  {r.map((c, j) => (
                    <td key={j} className="py-2.5 pr-3 text-coal-ink/90">
                      {c}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
