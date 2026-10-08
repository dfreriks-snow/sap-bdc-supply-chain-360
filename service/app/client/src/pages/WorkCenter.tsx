import { useFilters } from '@/hooks/useFilters';
import { useQuery } from '@/hooks/useQuery';
import { fetchWorkCenter } from '@/lib/api';
import MetricCard, { Factory, CheckCircle2, Timer, TrendingUp } from '@/components/MetricCard';
import ChartCard from '@/components/ChartCard';
import DataTable from '@/components/DataTable';
import * as Tabs from '@radix-ui/react-tabs';
import ReactECharts from '@/components/Chart';

const PALETTE = ['#06b6d4', '#8b5cf6', '#f59e0b', '#10b981', '#ef4444', '#3b82f6', '#ec4899'];
const tabClass = 'px-4 py-2 text-sm font-medium text-gray-500 data-[state=active]:border-b-2 data-[state=active]:border-sf-primary data-[state=active]:text-sf-dark';

const ACCENTS = [
  'border-cyan-400/50 bg-gradient-to-br from-cyan-50 via-white to-cyan-100',
  'border-emerald-400/50 bg-gradient-to-br from-emerald-50 via-white to-emerald-100',
  'border-violet-400/50 bg-gradient-to-br from-violet-50 via-white to-violet-100',
  'border-amber-400/50 bg-gradient-to-br from-amber-50 via-white to-amber-100',
];

export default function WorkCenter() {
  const { selectedPlants } = useFilters();
  const { data, loading, error } = useQuery(
    () => fetchWorkCenter(selectedPlants),
    [selectedPlants.join(',')]
  );

  if (selectedPlants.length === 0) {
    return (
      <div className="rounded-xl border border-amber-300 bg-gradient-to-r from-amber-50 to-orange-50 p-8 text-center text-amber-800 shadow-sm">
        <p className="text-lg font-semibold">Select at least one plant from the sidebar to view data.</p>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="space-y-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="h-32 animate-pulse rounded-xl bg-gradient-to-br from-sky-100 to-cyan-50" />
        ))}
      </div>
    );
  }

  if (error) {
    return <div className="rounded-xl border border-red-300 bg-red-50 p-6 text-red-700 shadow-sm"><strong>Error:</strong> {error}</div>;
  }

  const wc: any[] = data ?? [];
  const uniqueWc = new Set(wc.map((r) => r.work_center)).size;
  const avgUtil = wc.length > 0 ? +(wc.reduce((s: number, r) => s + (r.utilization_pct ?? 0), 0) / wc.length).toFixed(1) : 0;
  const totalAvail = wc.reduce((s: number, r) => s + (r.available_capacity_hrs ?? 0), 0);
  const totalUsed = wc.reduce((s: number, r) => s + (r.used_capacity_hrs ?? 0), 0);

  // ── Utilization by work center ──
  const wcAgg: Record<string, { total: number; count: number }> = {};
  wc.forEach((r) => {
    const name = r.work_center_desc ?? r.work_center;
    if (!wcAgg[name]) wcAgg[name] = { total: 0, count: 0 };
    wcAgg[name].total += r.utilization_pct ?? 0;
    wcAgg[name].count += 1;
  });
  const utilByWc = Object.entries(wcAgg)
    .map(([name, v]) => ({ name, util: +(v.total / v.count).toFixed(1) }))
    .sort((a, b) => b.util - a.util);

  // ── Utilization by plant ──
  const plantAgg: Record<string, { total: number; count: number }> = {};
  wc.forEach((r) => {
    if (!plantAgg[r.plant_name]) plantAgg[r.plant_name] = { total: 0, count: 0 };
    plantAgg[r.plant_name].total += r.utilization_pct ?? 0;
    plantAgg[r.plant_name].count += 1;
  });
  const utilByPlant = Object.entries(plantAgg).map(([name, v], i) => ({
    name,
    value: +(v.total / v.count).toFixed(1),
    itemStyle: { color: PALETTE[i % PALETTE.length] },
  }));

  // ── Monthly capacity trend ──
  const monthAgg: Record<string, { avail: number; used: number }> = {};
  wc.forEach((r) => {
    const m = r.period_date;
    if (!monthAgg[m]) monthAgg[m] = { avail: 0, used: 0 };
    monthAgg[m].avail += r.available_capacity_hrs ?? 0;
    monthAgg[m].used += r.used_capacity_hrs ?? 0;
  });
  const periods = Object.keys(monthAgg).sort();
  const monthlyUtil = periods.map((p) => +(100 * monthAgg[p].used / monthAgg[p].avail).toFixed(1));
  const monthlyAvail = periods.map((p) => monthAgg[p].avail);
  const monthlyUsed = periods.map((p) => monthAgg[p].used);
  const formatDate = (d: string) => new Date(d).toLocaleDateString('en-US', { timeZone: 'UTC', month: 'short', year: '2-digit' });

  // Bottlenecks
  const bottlenecks = utilByWc.filter((w) => w.util > 85);

  // ── ECharts: Utilization by Work Center (conditional color) ──
  const utilWcOption = {
    tooltip: {
      trigger: 'axis',
      backgroundColor: 'rgba(255,255,255,0.95)',
      borderColor: '#e5e7eb',
      borderWidth: 1,
      axisPointer: { type: 'shadow' },
      formatter: (params: any) => `<strong>${params[0].name}</strong><br/>Utilization: ${params[0].value}%`,
    },
    grid: { top: 10, right: 30, bottom: 30, left: 130 },
    xAxis: {
      type: 'value',
      min: 0,
      max: 100,
      axisLabel: { color: '#6b7280', fontSize: 11, formatter: '{value}%' },
      splitLine: { lineStyle: { color: '#f3f4f6', type: 'dashed' } },
    },
    yAxis: {
      type: 'category',
      data: utilByWc.map((r) => r.name),
      axisLabel: { color: '#374151', fontSize: 11, fontWeight: 500 },
      axisLine: { show: false },
      axisTick: { show: false },
    },
    series: [{
      type: 'bar',
      data: utilByWc.map((r) => ({
        value: r.util,
        itemStyle: {
          color: r.util > 90
            ? { type: 'linear', x: 0, y: 0, x2: 1, y2: 0, colorStops: [{ offset: 0, color: '#ef4444' }, { offset: 1, color: '#ef444480' }] }
            : r.util > 85
            ? { type: 'linear', x: 0, y: 0, x2: 1, y2: 0, colorStops: [{ offset: 0, color: '#f59e0b' }, { offset: 1, color: '#f59e0b80' }] }
            : { type: 'linear', x: 0, y: 0, x2: 1, y2: 0, colorStops: [{ offset: 0, color: '#06b6d4' }, { offset: 1, color: '#06b6d460' }] },
          borderRadius: [0, 5, 5, 0],
        },
      })),
      barWidth: '55%',
      markLine: {
        silent: true,
        data: [{ xAxis: 85, label: { formatter: '85%', color: '#f59e0b', fontSize: 10 }, lineStyle: { color: '#f59e0b', type: 'dashed', width: 1.5 } }],
      },
    }],
    animationDuration: 1000,
    animationEasing: 'elasticOut',
  };

  // ── ECharts: Utilization by Plant (ranked bar via Chart policy) ──
  const utilPlantOption = {
    tooltip: {
      trigger: 'item',
      backgroundColor: 'rgba(255,255,255,0.95)',
      borderColor: '#e5e7eb',
      borderWidth: 1,
      formatter: '{b}: {c}%',
    },
    legend: {
      bottom: 5,
      textStyle: { color: '#6b7280', fontSize: 11 },
    },
    series: [{
      type: 'pie',
      radius: ['40%', '70%'],
      center: ['50%', '42%'],
      itemStyle: { borderRadius: 6, borderColor: '#fff', borderWidth: 2 },
      label: {
        show: true,
        position: 'center',
        fontSize: 20,
        fontWeight: 'bold',
        color: '#374151',
        formatter: () => `${avgUtil}%\nAvg`,
      },
      emphasis: {
        label: { show: true, fontSize: 14, fontWeight: 'bold', position: 'outside' },
        itemStyle: { shadowBlur: 10, shadowColor: 'rgba(0,0,0,0.15)' },
      },
      data: utilByPlant,
    }],
    animationDuration: 1000,
    animationEasing: 'cubicOut',
  };

  // ── ECharts: Monthly Capacity Trend (dual axis: bars for hours, line for %) ──
  const trendOption = {
    tooltip: {
      trigger: 'axis',
      backgroundColor: 'rgba(255,255,255,0.95)',
      borderColor: '#e5e7eb',
      borderWidth: 1,
    },
    legend: {
      data: ['Available Hrs', 'Used Hrs', 'Utilization %'],
      bottom: 0,
      textStyle: { color: '#6b7280', fontSize: 11 },
      icon: 'roundRect',
    },
    grid: { top: 25, right: 60, bottom: 50, left: 60 },
    xAxis: {
      type: 'category',
      data: periods.map(formatDate),
      axisLine: { lineStyle: { color: '#e5e7eb' } },
      axisLabel: { color: '#6b7280', fontSize: 11 },
    },
    yAxis: [
      {
        type: 'value',
        name: 'Hours',
        nameTextStyle: { color: '#6b7280', fontSize: 10 },
        axisLabel: { color: '#6b7280', fontSize: 11 },
        splitLine: { lineStyle: { color: '#f3f4f6', type: 'dashed' } },
      },
      {
        type: 'value',
        name: 'Util %',
        nameTextStyle: { color: '#6b7280', fontSize: 10 },
        min: 60,
        max: 100,
        axisLabel: { color: '#6b7280', fontSize: 11, formatter: '{value}%' },
        splitLine: { show: false },
      },
    ],
    series: [
      {
        name: 'Available Hrs',
        type: 'bar',
        yAxisIndex: 0,
        barWidth: '30%',
        itemStyle: { color: '#e5e7eb', borderRadius: [4, 4, 0, 0] },
        data: monthlyAvail,
      },
      {
        name: 'Used Hrs',
        type: 'bar',
        yAxisIndex: 0,
        barWidth: '30%',
        itemStyle: {
          color: {
            type: 'linear',
            x: 0, y: 0, x2: 0, y2: 1,
            colorStops: [
              { offset: 0, color: '#06b6d4' },
              { offset: 1, color: '#06b6d460' },
            ],
          },
          borderRadius: [4, 4, 0, 0],
        },
        data: monthlyUsed,
      },
      {
        name: 'Utilization %',
        type: 'line',
        yAxisIndex: 1,
        smooth: true,
        symbol: 'circle',
        symbolSize: 7,
        lineStyle: { width: 3, color: '#8b5cf6' },
        itemStyle: { color: '#8b5cf6', borderWidth: 2, borderColor: '#fff' },
        areaStyle: {
          color: {
            type: 'linear',
            x: 0, y: 0, x2: 0, y2: 1,
            colorStops: [
              { offset: 0, color: '#8b5cf630' },
              { offset: 1, color: '#8b5cf605' },
            ],
          },
        },
        data: monthlyUtil,
      },
    ],
    animationDuration: 1200,
    animationEasing: 'cubicOut',
  };

  return (
    <Tabs.Root defaultValue="util">
      <Tabs.List className="mb-6 flex gap-1 border-b border-gray-200">
        <Tabs.Trigger value="util" className={tabClass}>Utilization</Tabs.Trigger>
        <Tabs.Trigger value="trend" className={tabClass}>Capacity Trend</Tabs.Trigger>
      </Tabs.List>

      <Tabs.Content value="util" className="space-y-6">
        <div className="grid grid-cols-4 gap-5">
          <MetricCard title="Work Centers" value={uniqueWc.toLocaleString()} icon={Factory} accent={ACCENTS[0]} />
          <MetricCard title="Avg Utilization" value={`${avgUtil}%`} icon={CheckCircle2} accent={ACCENTS[1]} />
          <MetricCard title="Total Available Hrs" value={totalAvail.toLocaleString()} icon={Timer} accent={ACCENTS[2]} />
          <MetricCard title="Total Used Hrs" value={totalUsed.toLocaleString()} icon={TrendingUp} accent={ACCENTS[3]} />
        </div>

        <div className="grid grid-cols-2 gap-5">
          <ChartCard title="Utilization by Work Center" subtitle="Red >90%, Amber >85%, Cyan normal — dashed line at 85% threshold">
            <ReactECharts option={utilWcOption} style={{ height: 340 }} />
          </ChartCard>
          <div className="space-y-5">
            <ChartCard title="Utilization by Plant" subtitle="Average capacity usage per facility">
              <ReactECharts option={utilPlantOption} style={{ height: 240 }} />
            </ChartCard>
            {bottlenecks.length > 0 && (
              <div className="rounded-xl border border-amber-300 bg-gradient-to-r from-amber-50 to-orange-50 p-5 shadow-sm">
                <h3 className="mb-3 text-sm font-bold text-amber-900">Bottleneck Alerts</h3>
                {bottlenecks.map((b) => (
                  <div key={b.name} className="mb-1.5 flex items-center justify-between rounded-lg bg-white/70 px-3 py-2">
                    <span className="text-sm font-medium text-gray-800">{b.name}</span>
                    <span className={`rounded-full px-2.5 py-0.5 text-xs font-bold ${b.util > 90 ? 'bg-red-100 text-red-700' : 'bg-amber-100 text-amber-700'}`}>
                      {b.util}%
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </Tabs.Content>

      <Tabs.Content value="trend" className="space-y-6">
        <ChartCard title="Monthly Capacity Utilization" subtitle="Available vs used hours (bars) with utilization % overlay (line)">
          <ReactECharts option={trendOption} style={{ height: 360 }} />
        </ChartCard>

        <DataTable
          columns={[
            { key: 'work_center_desc', label: 'Work Center' },
            { key: 'plant_name', label: 'Plant' },
            { key: 'period_date', label: 'Period' },
            { key: 'available_capacity_hrs', label: 'Available Hrs' },
            { key: 'used_capacity_hrs', label: 'Used Hrs' },
            { key: 'utilization_pct', label: 'Utilization %' },
          ]}
          data={wc}
        />
      </Tabs.Content>
    </Tabs.Root>
  );
}
