import { useState } from 'react';
import { useQuery } from '@/hooks/useQuery';
import { useFilters } from '@/hooks/useFilters';
import { fetchEquipment } from '@/lib/api';
import MetricCard, { Gauge, Timer, TrendingUp, Trash2 } from '@/components/MetricCard';
import ChartCard from '@/components/ChartCard';
import DataTable from '@/components/DataTable';
import AskCortex from '@/components/AskCortex';
import ReactECharts from '@/components/Chart';
import { cn } from '@/lib/utils';

const usd = (v: number) => (Math.abs(v) >= 1e6 ? `$${(v / 1e6).toFixed(2)}M` : `$${Math.round(v / 1e3).toLocaleString()}K`);
const PALETTE = ['#ef4444', '#f59e0b', '#8b5cf6', '#06b6d4', '#10b981'];

function riskClass(p: number) {
  if (p >= 0.3) return 'bg-red-100 text-red-700';
  if (p >= 0.1) return 'bg-amber-100 text-amber-700';
  return 'bg-emerald-100 text-emerald-700';
}

export default function EquipmentHealth() {
  const { selectedPlants } = useFilters();
  const { data, loading, error } = useQuery(() => fetchEquipment(selectedPlants), [selectedPlants.join(',')]);
  const [metric, setMetric] = useState<'failure_prob_48h' | 'vibration_mm_s' | 'temperature_c'>('vibration_mm_s');

  if (loading) return <div className="h-64 animate-pulse rounded-xl bg-gradient-to-br from-sky-100 to-cyan-50" />;
  if (error) return <div className="rounded-xl border border-red-300 bg-red-50 p-6 text-red-700"><strong>Error:</strong> {error}</div>;
  if (!data?.kpi) return null;
  const { kpi, latest, outages, trend } = data;

  const ids: string[] = Array.from(new Set(trend.map((t: any) => t.equipment_id)));
  const dates: string[] = Array.from(new Set(trend.map((t: any) => t.reading_date))).sort() as string[];
  const trendOption = {
    tooltip: { trigger: 'axis' },
    legend: { bottom: 0, textStyle: { fontSize: 11 } },
    grid: { top: 20, right: 20, bottom: 50, left: 50 },
    xAxis: { type: 'category', data: dates.map((d) => new Date(d).toLocaleDateString('en-US', { timeZone: 'UTC', month: 'short', day: 'numeric' })) },
    yAxis: { type: 'value', scale: true },
    series: ids.map((id, i) => {
      const rows = trend.filter((t: any) => t.equipment_id === id);
      return { name: rows[0]?.equipment_name ?? id, type: 'line', smooth: true, showSymbol: false,
        lineStyle: { width: 2.5 }, itemStyle: { color: PALETTE[i % PALETTE.length] },
        data: dates.map((d) => rows.find((r: any) => r.reading_date === d)?.[metric] ?? null) };
    }),
  };

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4 rounded-xl border border-sky-200 bg-white p-4 shadow-sm">
        <p className="text-sm text-gray-600">
          Tool health for every work center: vibration, temperature and 48-hour failure probability. Value at risk
          = P(failure) × a 38-hour outage × (repair cost/hr + lost contribution margin/hr).
          <span className="ml-1 text-xs text-gray-400">Sensor and outage data is representative demo enrichment.</span>
        </p>
        <AskCortex topic="equipment" label="Ask Cortex: assess equipment risk" className="w-auto shrink-0"
          suggestions={['Is the Austin stepper repeating the San Jose failure pattern?', 'What maintenance should we schedule this week?', 'Which tools threaten the most customer orders?']} />
      </div>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <MetricCard title="Tools at high risk" value={String(kpi.high_risk)} icon={Gauge} accent="border-red-400/50 bg-gradient-to-br from-red-50 via-white to-red-100" />
        <MetricCard title="Value at risk (48h)" value={usd(kpi.value_at_risk_usd)} icon={TrendingUp} accent="border-amber-400/50 bg-gradient-to-br from-amber-50 via-white to-amber-100" />
        <MetricCard title="Unplanned downtime" value={`${Math.round(kpi.downtime_hrs)} h`} icon={Timer} accent="border-violet-400/50 bg-gradient-to-br from-violet-50 via-white to-violet-100" />
        <MetricCard title="Repair cost" value={usd(kpi.repair_cost_usd)} icon={Trash2} accent="border-cyan-400/50 bg-gradient-to-br from-cyan-50 via-white to-cyan-100" />
      </div>

      <ChartCard title="Failure-risk ranking" subtitle="Latest reading per tool, highest risk first">
        <div className="max-h-[420px] overflow-y-auto rounded-lg border border-gray-200">
          <table className="min-w-full text-sm">
            <thead className="sticky top-0 bg-sf-dark text-white">
              <tr>{['Tool', 'Work center', 'Plant', 'Crit.', 'Vibration', 'Temp', 'Failure risk 48h', 'Value at risk'].map((h) =>
                <th key={h} className="px-3 py-2 text-left font-medium">{h}</th>)}</tr>
            </thead>
            <tbody>
              {latest.map((e: any, i: number) => (
                <tr key={e.equipment_id} className={i % 2 ? 'bg-sky-50/50' : 'bg-white'}>
                  <td className="px-3 py-1.5 font-medium">{e.equipment_name}{e.anomaly_flag && <span className="ml-2 rounded bg-red-500 px-1.5 text-[10px] font-bold text-white">ANOMALY</span>}</td>
                  <td className="px-3 py-1.5">{e.work_center_desc}</td>
                  <td className="px-3 py-1.5">{e.plant_name}</td>
                  <td className="px-3 py-1.5">{e.criticality}</td>
                  <td className="px-3 py-1.5">{Number(e.vibration_mm_s).toFixed(2)} mm/s</td>
                  <td className="px-3 py-1.5">{Number(e.temperature_c).toFixed(1)} °C</td>
                  <td className="px-3 py-1.5"><span className={cn('rounded px-2 py-0.5 text-xs font-semibold', riskClass(e.failure_prob_48h))}>{(100 * e.failure_prob_48h).toFixed(1)}%</span></td>
                  <td className="px-3 py-1.5 font-semibold">{usd(e.value_at_risk_usd)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </ChartCard>

      <ChartCard title="Sensor trend — five highest-risk tools (30 days)">
        <div className="mb-2 flex gap-2">
          {([['vibration_mm_s', 'Vibration'], ['temperature_c', 'Temperature'], ['failure_prob_48h', 'Failure risk']] as const).map(([k, l]) => (
            <button key={k} onClick={() => setMetric(k)}
              className={cn('rounded-full px-3 py-1 text-xs font-medium', metric === k ? 'bg-sf-primary text-white' : 'bg-gray-100 text-gray-600')}>{l}</button>
          ))}
        </div>
        <ReactECharts option={trendOption} style={{ height: 300 }} />
      </ChartCard>

      <ChartCard title="Outage history">
        <DataTable data={outages} columns={[
          { key: 'start_date', label: 'Date', format: (v) => new Date(v).toLocaleDateString('en-US', { timeZone: 'UTC' }) },
          { key: 'equipment_name', label: 'Tool' },
          { key: 'plant_name', label: 'Plant' },
          { key: 'event_type', label: 'Type' },
          { key: 'downtime_hrs', label: 'Hours' },
          { key: 'root_cause', label: 'Root cause' },
          { key: 'repair_cost_usd', label: 'Repair cost', format: (v) => usd(Number(v)) },
        ]} />
      </ChartCard>
    </div>
  );
}
