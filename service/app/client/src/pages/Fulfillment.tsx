import { useQuery } from '@/hooks/useQuery';
import { useFilters } from '@/hooks/useFilters';
import { fetchFulfillment } from '@/lib/api';
import MetricCard, { CheckCircle2, Timer, Truck, TrendingUp } from '@/components/MetricCard';
import ChartCard from '@/components/ChartCard';
import AskCortex from '@/components/AskCortex';
import ReactECharts from '@/components/Chart';

const CAUSE_COLORS: Record<string, string> = {
  MATERIAL_SHORTAGE: '#f59e0b', EQUIPMENT: '#ef4444', QUALITY_HOLD: '#8b5cf6', PERFORMANCE: '#06b6d4', LOGISTICS: '#3b82f6',
};
const usd = (v: number) => (Math.abs(v) >= 1e6 ? `$${(v / 1e6).toFixed(2)}M` : `$${Math.round(v / 1e3).toLocaleString()}K`);
const fmtDate = (d: string | null) => (d ? new Date(d).toLocaleDateString('en-US', { timeZone: 'UTC', month: 'short', day: 'numeric' }) : '—');

export default function Fulfillment() {
  const { selectedPlants } = useFilters();
  const { data, loading, error } = useQuery(() => fetchFulfillment(selectedPlants), [selectedPlants.join(',')]);

  if (loading) return <div className="h-64 animate-pulse rounded-xl bg-gradient-to-br from-sky-100 to-cyan-50" />;
  if (error) return <div className="rounded-xl border border-red-300 bg-red-50 p-6 text-red-700"><strong>Error:</strong> {error}</div>;
  if (!data?.kpi) return null;

  const { kpi, byCause, oprate, trend, orders } = data;

  const causeOption = {
    tooltip: { trigger: 'item', formatter: (p: any) => `${p.name}<br/>${usd(p.value)} · ${p.data.orders} orders` },
    legend: { bottom: 0, textStyle: { fontSize: 11 } },
    series: [{
      type: 'pie', radius: ['45%', '72%'], center: ['50%', '45%'], itemStyle: { borderColor: '#fff', borderWidth: 2 },
      label: { formatter: (p: any) => `${usd(p.value)}`, fontSize: 11 },
      data: byCause.map((c: any) => ({ name: c.late_cause_label, value: c.late_cost_usd, orders: c.orders,
        itemStyle: { color: CAUSE_COLORS[c.late_cause] ?? '#9ca3af' } })),
    }],
  };

  // Loss tree: nameplate split into produced + each loss bucket, one bar per plant.
  const buckets = [
    { key: 'produced', name: 'Produced', color: '#10b981' },
    { key: 'performance', name: 'Rate below plan', color: '#06b6d4' },
    { key: 'material', name: 'Component shortage', color: '#f59e0b' },
    { key: 'equipment', name: 'Equipment outage', color: '#ef4444' },
    { key: 'planned', name: 'Planned downtime', color: '#cbd5e1' },
  ];
  const lossOption = {
    tooltip: { trigger: 'axis', axisPointer: { type: 'shadow' } },
    legend: { bottom: 0, textStyle: { fontSize: 11 } },
    grid: { top: 10, right: 20, bottom: 60, left: 110 },
    xAxis: { type: 'value', name: 'units', axisLabel: { fontSize: 11 } },
    yAxis: { type: 'category', data: oprate.map((p: any) => `${p.plant_name} (${p.operating_rate_pct}%)`), axisLabel: { fontSize: 11 } },
    series: buckets.map((b) => ({ name: b.name, type: 'bar', stack: 'np', itemStyle: { color: b.color },
      data: oprate.map((p: any) => +Number(p[b.key]).toFixed(1)) })),
  };

  const trendOption = {
    tooltip: { trigger: 'axis' },
    legend: { bottom: 0, textStyle: { fontSize: 11 } },
    grid: { top: 20, right: 60, bottom: 50, left: 50 },
    xAxis: { type: 'category', data: trend.map((t: any) => new Date(t.ship_month).toLocaleDateString('en-US', { timeZone: 'UTC', month: 'short' })) },
    yAxis: [
      { type: 'value', name: 'OTIF %', min: 40, max: 100 },
      { type: 'value', name: 'Late cost', axisLabel: { formatter: (v: number) => usd(v) } },
    ],
    series: [
      { name: 'OTIF %', type: 'line', smooth: true, data: trend.map((t: any) => t.otif_pct), itemStyle: { color: '#10b981' }, lineStyle: { width: 3 } },
      { name: 'Late cost', type: 'bar', yAxisIndex: 1, data: trend.map((t: any) => t.late_cost_usd), itemStyle: { color: '#fca5a5' } },
    ],
  };

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4 rounded-xl border border-sky-200 bg-white p-4 shadow-sm">
        <p className="text-sm text-gray-600">
          Orders ship first-in-first-out from each plant. Equipment outages and component shortages cut the operating
          rate, which pushes specific customer orders late. Each late order carries its root cause and cost
          (penalty 0.5%/day of order value, capped at 5%, plus expedite freight).
          <span className="ml-1 text-xs text-gray-400">Order, equipment and lot data is representative demo enrichment keyed to SAP master data.</span>
        </p>
        <AskCortex topic="fulfillment" label="Ask Cortex: summarise fulfillment" className="w-auto shrink-0"
          suggestions={['Is equipment or components the bigger constraint overall?', 'Which customers are most exposed?', 'What would recover the most late cost next month?']} />
      </div>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <MetricCard title="OTIF" value={`${kpi.otif_pct}%`} icon={CheckCircle2} accent="border-emerald-400/50 bg-gradient-to-br from-emerald-50 via-white to-emerald-100" />
        <MetricCard title="Late orders" value={`${kpi.late_orders} / ${kpi.orders}`} icon={Timer} accent="border-amber-400/50 bg-gradient-to-br from-amber-50 via-white to-amber-100" />
        <MetricCard title="Late-delivery cost" value={usd(kpi.late_cost_usd)} icon={TrendingUp} accent="border-red-400/50 bg-gradient-to-br from-red-50 via-white to-red-100" />
        <MetricCard title="Open orders at risk" value={String(kpi.open_at_risk)} icon={Truck} accent="border-violet-400/50 bg-gradient-to-br from-violet-50 via-white to-violet-100" />
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <ChartCard title="Late cost by root cause" subtitle="Why orders shipped late, valued in penalty + expedite">
          <ReactECharts option={causeOption} style={{ height: 300 }} />
        </ChartCard>
        <ChartCard title="OTIF and late cost by month">
          <ReactECharts option={trendOption} style={{ height: 300 }} />
        </ChartCard>
      </div>

      <ChartCard title="Operating-rate loss tree" subtitle="Nameplate capacity split into what was produced and where the rest was lost (Jan–Sep 2025)">
        <ReactECharts option={lossOption} style={{ height: 300 }} />
        <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
          {oprate.map((p: any) => (
            <div key={p.plant_name} className="flex items-center justify-between rounded-lg border border-gray-200 bg-gray-50/60 px-3 py-2">
              <div>
                <p className="text-sm font-semibold text-gray-800">{p.plant_name}</p>
                <p className="text-xs text-gray-500">
                  Binding constraint: <span className={p.binding_constraint === 'Equipment' ? 'font-semibold text-red-600' : 'font-semibold text-amber-600'}>{p.binding_constraint}</span>
                </p>
              </div>
              <AskCortex compact topic="constraint" args={{ plant: p.plant_name }} label="Why?" />
            </div>
          ))}
        </div>
      </ChartCard>

      <ChartCard title="Late orders by cost" subtitle="Click Explain to trace cause → units lost → ship slip → cost for one order">
        <div className="max-h-[480px] overflow-y-auto rounded-lg border border-gray-200">
          <table className="min-w-full text-sm">
            <thead className="sticky top-0 bg-sf-dark text-white">
              <tr>{['Order', 'Customer', 'System', 'Plant', 'Requested', 'Delay', 'Cause', 'Late cost', ''].map((h) =>
                <th key={h} className="px-3 py-2 text-left font-medium">{h}</th>)}</tr>
            </thead>
            <tbody>
              {orders.map((o: any, i: number) => (
                <tr key={o.sales_order} className={i % 2 ? 'bg-sky-50/50' : 'bg-white'}>
                  <td className="px-3 py-1.5 font-mono text-xs">{o.sales_order}</td>
                  <td className="px-3 py-1.5">{o.sold_to}</td>
                  <td className="px-3 py-1.5">{o.material_desc}</td>
                  <td className="px-3 py-1.5">{o.plant_name}</td>
                  <td className="px-3 py-1.5">{fmtDate(o.requested_ship_date)}</td>
                  <td className="px-3 py-1.5">{o.delay_days}d</td>
                  <td className="px-3 py-1.5">{o.late_cause_label}</td>
                  <td className="px-3 py-1.5 font-semibold">{usd(o.late_cost_usd)}</td>
                  <td className="px-3 py-1.5"><AskCortex compact topic="order" args={{ order: o.sales_order }} label="Explain" /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </ChartCard>
    </div>
  );
}
