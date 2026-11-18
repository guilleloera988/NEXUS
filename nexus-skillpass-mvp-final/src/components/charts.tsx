'use client';

import { useState, type ReactNode } from 'react';

/*
 * Small, dependency-free charts following the dataviz method:
 *  - magnitude → one hue (brand gold #a57a1f, 3.9:1 on white); emphasis → gold accent + gray rest
 *  - bars ≤ 24px thick, 4px rounded data-end, square at the baseline, recessive 1px baseline
 *  - values in text tokens (never the series color), selective labels at the bar tip
 *  - every mark has a hover/focus tooltip and every chart has a table view
 *  - one axis only (two measures → two charts)
 */

const ACCENT = '#a57a1f';
const REST = '#d9d9df';

interface Datum { label: string; value: number; display: string }

function Tooltip({ children, visible }: { children: ReactNode; visible: boolean }) {
  return (
    <span role="tooltip" className={`pointer-events-none absolute -top-2 left-1/2 z-10 -translate-x-1/2 -translate-y-full whitespace-nowrap rounded-lg bg-ink-950 px-2.5 py-1.5 text-xs text-white shadow-lg transition-opacity ${visible ? 'opacity-100' : 'opacity-0'}`}>
      {children}
    </span>
  );
}

export function TableView({ summary, columns, rows }: { summary: string; columns: string[]; rows: (string | number)[][] }) {
  return (
    <details className="mt-4 text-sm">
      <summary className="cursor-pointer text-xs font-semibold text-ink-500 hover:text-ink-900">{summary}</summary>
      <div className="mt-2 overflow-x-auto">
        <table className="table">
          <thead><tr>{columns.map((c) => <th key={c} scope="col">{c}</th>)}</tr></thead>
          <tbody>{rows.map((r, i) => <tr key={i}>{r.map((cell, j) => <td key={j} className={j > 0 ? 'tabular-nums' : ''}>{cell}</td>)}</tr>)}</tbody>
        </table>
      </div>
    </details>
  );
}

/** Horizontal bars for long category names (careers, competencies). Single series → no legend; the card title names it. */
export function HBarChart({ data, tableSummary, columns }: { data: Datum[]; tableSummary: string; columns: [string, string] }) {
  const [active, setActive] = useState<number | null>(null);
  const max = Math.max(...data.map((d) => d.value), 1);
  return (
    <div>
      <ul className="space-y-2.5">
        {data.map((d, i) => (
          <li key={d.label} className="grid grid-cols-[minmax(0,9rem)_1fr] items-center gap-3 sm:grid-cols-[minmax(0,12rem)_1fr]">
            <span className="truncate text-xs text-ink-600" title={d.label}>{d.label}</span>
            <span className="relative flex items-center gap-2 outline-none" tabIndex={0} aria-label={`${d.label}: ${d.display}`}
              onPointerEnter={() => setActive(i)} onPointerLeave={() => setActive(null)} onFocus={() => setActive(i)} onBlur={() => setActive(null)}>
              <span className="relative h-3.5 min-w-[3px] rounded-r-[4px] transition-[filter]" style={{ width: `${(d.value / max) * 85}%`, background: ACCENT, filter: active === i ? 'brightness(1.15)' : undefined }}>
                <Tooltip visible={active === i}><strong className="font-bold">{d.display}</strong> <span className="text-ink-300">· {d.label}</span></Tooltip>
              </span>
              <span className="text-xs font-semibold tabular-nums text-ink-900">{d.display}</span>
            </span>
          </li>
        ))}
      </ul>
      <TableView summary={tableSummary} columns={columns} rows={data.map((d) => [d.label, d.display])} />
    </div>
  );
}

/** Vertical columns for a short time series (months). Value on the cap of the latest column only. */
export function ColumnChart({ data, tableSummary, columns, height = 140 }: { data: Datum[]; tableSummary: string; columns: [string, string]; height?: number }) {
  const [active, setActive] = useState<number | null>(null);
  const max = Math.max(...data.map((d) => d.value), 1);
  const last = data.length - 1;
  return (
    <div>
      <div className="flex items-end justify-between gap-2 border-b border-ink-200 px-1" style={{ height }}>
        {data.map((d, i) => {
          const h = d.value > 0 ? Math.max(4, (d.value / max) * (height - 28)) : 0;
          return (
            <div key={d.label} className="relative flex flex-1 flex-col items-center justify-end outline-none" style={{ height }} tabIndex={0}
              aria-label={`${d.label}: ${d.display}`} onPointerEnter={() => setActive(i)} onPointerLeave={() => setActive(null)} onFocus={() => setActive(i)} onBlur={() => setActive(null)}>
              {(i === last || active === i) && d.value > 0 && <span className="mb-1 text-[11px] font-semibold tabular-nums text-ink-900">{d.display}</span>}
              <span className="relative w-full max-w-6 rounded-t-[4px]" style={{ height: h, background: i === last ? ACCENT : '#c9a85a', filter: active === i ? 'brightness(1.12)' : undefined }}>
                <Tooltip visible={active === i}><strong className="font-bold">{d.display}</strong> <span className="text-ink-300">· {d.label}</span></Tooltip>
              </span>
            </div>
          );
        })}
      </div>
      <div className="mt-1.5 flex justify-between gap-2 px-1">
        {data.map((d) => <span key={d.label} className="flex-1 text-center text-[11px] text-ink-500">{d.label}</span>)}
      </div>
      <TableView summary={tableSummary} columns={columns} rows={data.map((d) => [d.label, d.display])} />
    </div>
  );
}

/** Emphasis form: participating (gold) vs the rest (gray), per category, with a 2px surface gap. */
export function ParticipationBars({ data, labels, tableSummary }: {
  data: { label: string; total: number; part: number }[];
  labels: { part: string; rest: string; category: string; total: string };
  tableSummary: string;
}) {
  const [active, setActive] = useState<number | null>(null);
  const max = Math.max(...data.map((d) => d.total), 1);
  return (
    <div>
      <div className="mb-3 flex flex-wrap gap-4 text-xs text-ink-600" aria-hidden>
        <span className="inline-flex items-center gap-1.5"><span className="size-2.5 rounded-[2px]" style={{ background: ACCENT }} />{labels.part}</span>
        <span className="inline-flex items-center gap-1.5"><span className="size-2.5 rounded-[2px]" style={{ background: REST }} />{labels.rest}</span>
      </div>
      <ul className="space-y-2.5">
        {data.map((d, i) => {
          const rest = Math.max(d.total - d.part, 0);
          return (
            <li key={d.label} className="grid grid-cols-[minmax(0,9rem)_1fr] items-center gap-3 sm:grid-cols-[minmax(0,12rem)_1fr]">
              <span className="truncate text-xs text-ink-600" title={d.label}>{d.label}</span>
              <span className="relative flex items-center gap-2 outline-none" tabIndex={0} aria-label={`${d.label}: ${d.part} ${labels.part}, ${rest} ${labels.rest}`}
                onPointerEnter={() => setActive(i)} onPointerLeave={() => setActive(null)} onFocus={() => setActive(i)} onBlur={() => setActive(null)}>
                <span className="relative flex h-3.5 gap-[2px]" style={{ width: `${(d.total / max) * 85}%` }}>
                  {d.part > 0 && <span className="h-full" style={{ width: `${(d.part / d.total) * 100}%`, background: ACCENT, borderRadius: rest === 0 ? '0 4px 4px 0' : 0 }} />}
                  {rest > 0 && <span className="h-full rounded-r-[4px]" style={{ width: `${(rest / d.total) * 100}%`, background: REST }} />}
                  <Tooltip visible={active === i}><strong className="font-bold">{d.part}/{d.total}</strong> <span className="text-ink-300">· {labels.part}</span></Tooltip>
                </span>
                <span className="text-xs font-semibold tabular-nums text-ink-900">{d.part}/{d.total}</span>
              </span>
            </li>
          );
        })}
      </ul>
      <TableView summary={tableSummary} columns={[labels.category, labels.part, labels.total]} rows={data.map((d) => [d.label, d.part, d.total])} />
    </div>
  );
}
