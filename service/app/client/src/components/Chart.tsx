// Chart policy wrapper around echarts-for-react, applied to every chart in the app.
//
// Follows the Tableau "Visual Analysis Best Practices" guidebook and the UX Magazine
// data-visualization handbook:
//   1. No pie or donut charts. Area and angle are hard to compare and only adjacent
//      slices can be compared, so part-to-whole is drawn as a ranked bar labelled
//      with value and share of total.
//   2. Category comparisons are ranked largest to smallest ("a bar chart sorted from
//      greatest to least"). Time axes and naturally ordered buckets keep their order.
//
// Pass `keepOrder` for a chart whose category order is meaningful (e.g. a process
// sequence). Pass `noPieConversion` only with a good reason.
import ReactECharts from 'echarts-for-react';
import type { CSSProperties } from 'react';

const MONTHS = /^(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)/i;
const ORDINAL = /^(q[1-4]|h[12]|fy|w\d|wk|hop|step|stage|level|tier|\d+\s*[-–+]|\d+\s*(d|day|days|h|hrs|%)\b|<|>|≤|≥)/i;

function isOrderedAxis(labels: unknown[]): boolean {
  const s = labels.map((l) => String(l ?? '').trim());
  if (!s.length) return true;
  const dated = s.filter((l) => MONTHS.test(l) || /^\d{4}([-/]\d{1,2})?/.test(l) || !Number.isNaN(Date.parse(l)) && /\d/.test(l));
  if (dated.length >= s.length * 0.6) return true;
  return s.filter((l) => ORDINAL.test(l)).length >= s.length * 0.6;
}

const num = (v: any): number => (typeof v === 'object' && v !== null ? Number(v.value ?? 0) : Number(v ?? 0)) || 0;
const fmt = (v: number) => (Math.abs(v) >= 1e6 ? `${(v / 1e6).toFixed(2)}M` : Math.abs(v) >= 1e3 ? `${(v / 1e3).toFixed(1)}K` : `${+v.toFixed(1)}`);

/** Pie/donut -> ranked horizontal bar, largest on top, labelled value · share. */
function pieToBar(option: any, pie: any): any {
  const data = [...(pie.data ?? [])].map((d: any) => ({ ...d, value: num(d) })).sort((a, b) => b.value - a.value);
  const total = data.reduce((s, d) => s + d.value, 0) || 1;
  // Shares only make sense for additive quantities. Averages and rates (e.g. scrap %)
  // get the ranked bar without a "% of total".
  const rateLike = /rate|pct|percent|%|avg|average|score|util/i.test(`${pie.name ?? ''} ${JSON.stringify(option.title ?? '')}`)
    || data.every((d) => d.value <= 100 && !Number.isInteger(d.value));
  const share = (v: number) => (rateLike ? '' : ` · ${(100 * v / total).toFixed(1)}% of total`);
  const money = /\$/.test(JSON.stringify(option.tooltip?.formatter ?? '')) || /cost|value|spend|\$/i.test(String(pie.name ?? ''));
  return {
    ...option,
    legend: undefined,
    tooltip: { trigger: 'item', formatter: (p: any) => `${p.name}<br/>${money ? '$' : ''}${fmt(p.value)}${share(p.value)}` },
    grid: { top: 10, right: 110, bottom: 20, left: 10, containLabel: true },
    xAxis: { type: 'value', show: false },
    yAxis: { type: 'category', inverse: true, data: data.map((d) => d.name), axisTick: { show: false },
      axisLine: { show: false }, axisLabel: { fontSize: 11, color: '#374151' } },
    series: [{
      type: 'bar', barMaxWidth: 26,
      data: data.map((d) => ({ value: d.value, itemStyle: { color: d.itemStyle?.color ?? '#0ea5e9', borderRadius: [0, 4, 4, 0] } })),
      label: { show: true, position: 'right', fontSize: 11, color: '#374151',
        formatter: (p: any) => `${money ? '$' : ''}${fmt(p.value)}${rateLike ? (/%|pct|percent|rate/i.test(String(pie.name ?? '')) ? '%' : '') : `  ${(100 * p.value / total).toFixed(0)}%`}` },
    }],
  };
}

/** Sort a category axis by the total across bar series, descending. */
function rankCategories(option: any): any {
  const bars = (option.series ?? []).filter((s: any) => s.type === 'bar');
  if (!bars.length) return option;
  const axes = ['xAxis', 'yAxis'] as const;
  for (const ax of axes) {
    const axis = Array.isArray(option[ax]) ? option[ax][0] : option[ax];
    if (!axis || axis.type !== 'category' || !Array.isArray(axis.data) || axis.data.length < 3) continue;
    if (isOrderedAxis(axis.data)) return option;
    // Only rank if every series is indexed by this axis (no mixed line-over-time).
    if ((option.series ?? []).some((s: any) => !Array.isArray(s.data) || s.data.length !== axis.data.length)) return option;
    const n = axis.data.length;
    const totals = Array.from({ length: n }, (_, i) => bars.reduce((sum: number, s: any) => sum + num(s.data[i]), 0));
    const order = Array.from({ length: n }, (_, i) => i).sort((a, b) => totals[b] - totals[a]);
    const reorder = (arr: any[]) => order.map((i) => arr[i]);
    const newAxis = { ...axis, data: reorder(axis.data), ...(ax === 'yAxis' ? { inverse: true } : {}) };
    return {
      ...option,
      [ax]: Array.isArray(option[ax]) ? [newAxis, ...option[ax].slice(1)] : newAxis,
      series: option.series.map((s: any) => ({ ...s, data: reorder(s.data) })),
    };
  }
  return option;
}

export function applyChartPolicy(option: any, opts: { keepOrder?: boolean; noPieConversion?: boolean } = {}): any {
  if (!option || typeof option !== 'object') return option;
  const series = Array.isArray(option.series) ? option.series : option.series ? [option.series] : [];
  const pie = series.find((s: any) => s.type === 'pie');
  if (pie && !opts.noPieConversion && series.length === 1) return pieToBar(option, pie);
  return opts.keepOrder ? option : rankCategories({ ...option, series });
}

interface Props {
  option: any;
  style?: CSSProperties;
  className?: string;
  keepOrder?: boolean;
  noPieConversion?: boolean;
  notMerge?: boolean;
  onEvents?: Record<string, (p: any) => void>;
  [k: string]: any;
}

export default function Chart({ option, keepOrder, noPieConversion, ...rest }: Props) {
  return <ReactECharts option={applyChartPolicy(option, { keepOrder, noPieConversion })} notMerge {...rest} />;
}
