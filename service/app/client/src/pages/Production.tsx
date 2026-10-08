import { useFilters } from '@/hooks/useFilters';
import { useQuery } from '@/hooks/useQuery';
import { fetchProduction } from '@/lib/api';
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

export default function Production() {
  const { selectedPlants } = useFilters();
  const { data, loading, error } = useQuery(
    () => fetchProduction(selectedPlants),
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

  const orders = data?.orders ?? [];
  const kpis: any[] = data?.kpis ?? [];

  // ── Metrics ──
  const totalOrders = orders.length;
  const activeOrders = orders.filter((o: any) => o.order_status === 'Released').length;
  const avgCycle = orders.length > 0
    ? (orders.reduce((s: number, o: any) => s + (o.cycle_time_days ?? 0), 0) / orders.length).toFixed(1)
    : 'N/A';
  const plannedTotal = orders.reduce((s: number, o: any) => s + (o.planned_qty ?? 0), 0);
  const yieldPct = plannedTotal > 0
    ? (100 * orders.reduce((s: number, o: any) => s + (o.yield_qty ?? 0), 0) / plannedTotal).toFixed(1)
    : '0';

  // ── Status distribution ──
  const statusCounts: Record<string, number> = {};
  orders.forEach((o: any) => { statusCounts[o.order_status] = (statusCounts[o.order_status] ?? 0) + 1; });
  const statusData = Object.entries(statusCounts).map(([status, count], i) => ({
    name: status,
    value: count,
    itemStyle: { color: PALETTE[i % PALETTE.length] },
  }));

  // ── Cycle time by work center ──
  const wcAgg: Record<string, { total: number; count: number }> = {};
  orders.forEach((o: any) => {
    if (!wcAgg[o.work_center]) wcAgg[o.work_center] = { total: 0, count: 0 };
    wcAgg[o.work_center].total += o.cycle_time_days ?? 0;
    wcAgg[o.work_center].count += 1;
  });
  const cycleByWc = Object.entries(wcAgg)
    .map(([wc, v]) => ({ wc, avg: +(v.total / v.count).toFixed(1) }))
    .sort((a, b) => b.avg - a.avg);

  // ── KPI trends ──
  const kpiDates = [...new Set(kpis.map((r) => r.period_date))].sort();
  const kpiPlants = [...new Set(kpis.map((r) => r.plant_name))];
  const formatDate = (d: string) => new Date(d).toLocaleDateString('en-US', { timeZone: 'UTC', month: 'short', year: '2-digit' });

  const oeeByPlant: Record<string, number[]> = {};
  const throughputByPlant: Record<string, number[]> = {};
  kpiPlants.forEach((plant) => {
    oeeByPlant[plant] = kpiDates.map((d) => {
      const row = kpis.find((r) => r.period_date === d && r.plant_name === plant);
      return row?.oee_pct ?? null;
    });
    throughputByPlant[plant] = kpiDates.map((d) => {
      const row = kpis.find((r) => r.period_date === d && r.plant_name === plant);
      return row?.throughput ?? null;
    });
  });

  // ── ECharts: Status (ranked bar via Chart policy) ──
  const statusOption = {
    tooltip: {
      trigger: 'item',
      backgroundColor: 'rgba(255,255,255,0.95)',
      borderColor: '#e5e7eb',
      borderWidth: 1,
      formatter: '{b}: {c} ({d}%)',
    },
    legend: {
      orient: 'vertical',
      right: 10,
      top: 'center',
      textStyle: { color: '#6b7280', fontSize: 11 },
    },
    series: [{
      type: 'pie',
      radius: ['42%', '72%'],
      center: ['40%', '50%'],
      avoidLabelOverlap: true,
      itemStyle: { borderRadius: 6, borderColor: '#fff', borderWidth: 2 },
      label: { show: false },
      emphasis: {
        label: { show: true, fontSize: 13, fontWeight: 'bold' },
        itemStyle: { shadowBlur: 10, shadowColor: 'rgba(0,0,0,0.15)' },
      },
      data: statusData,
    }],
    animationDuration: 1000,
    animationEasing: 'cubicOut',
  };

  // ── ECharts: Cycle Time Bar ──
  const cycleOption = {
    tooltip: {
      trigger: 'axis',
      backgroundColor: 'rgba(255,255,255,0.95)',
      borderColor: '#e5e7eb',
      borderWidth: 1,
      axisPointer: { type: 'shadow' },
      formatter: (params: any) => {
        const p = params[0];
        return `<strong>${p.name}</strong><br/>Avg Cycle: ${p.value} days`;
      },
    },
    grid: { top: 10, right: 20, bottom: 30, left: 100 },
    xAxis: {
      type: 'value',
      axisLabel: { color: '#6b7280', fontSize: 11, formatter: '{value} d' },
      splitLine: { lineStyle: { color: '#f3f4f6', type: 'dashed' } },
    },
    yAxis: {
      type: 'category',
      data: cycleByWc.map((r) => r.wc),
      axisLabel: { color: '#374151', fontSize: 12, fontWeight: 500 },
      axisLine: { show: false },
      axisTick: { show: false },
    },
    series: [{
      type: 'bar',
      data: cycleByWc.map((r, i) => ({
        value: r.avg,
        itemStyle: {
          color: {
            type: 'linear',
            x: 0, y: 0, x2: 1, y2: 0,
            colorStops: [
              { offset: 0, color: PALETTE[i % PALETTE.length] },
              { offset: 1, color: PALETTE[i % PALETTE.length] + '60' },
            ],
          },
          borderRadius: [0, 5, 5, 0],
        },
      })),
      barWidth: '55%',
    }],
    animationDuration: 900,
    animationEasing: 'elasticOut',
  };

  // ── ECharts: OEE Trend ──
  const oeeOption = {
    tooltip: {
      trigger: 'axis',
      backgroundColor: 'rgba(255,255,255,0.95)',
      borderColor: '#e5e7eb',
      borderWidth: 1,
    },
    legend: {
      data: kpiPlants,
      bottom: 0,
      textStyle: { color: '#6b7280', fontSize: 11 },
      icon: 'roundRect',
    },
    grid: { top: 20, right: 20, bottom: 50, left: 50 },
    xAxis: {
      type: 'category',
      data: kpiDates.map(formatDate),
      axisLine: { lineStyle: { color: '#e5e7eb' } },
      axisLabel: { color: '#6b7280', fontSize: 11 },
    },
    yAxis: {
      type: 'value',
      min: 70,
      axisLabel: { color: '#6b7280', fontSize: 11, formatter: '{value}%' },
      splitLine: { lineStyle: { color: '#f3f4f6', type: 'dashed' } },
    },
    series: kpiPlants.map((plant, i) => ({
      name: plant,
      type: 'line',
      smooth: true,
      symbol: 'circle',
      symbolSize: 6,
      lineStyle: { width: 3, color: PALETTE[i % PALETTE.length] },
      itemStyle: { color: PALETTE[i % PALETTE.length] },
      areaStyle: {
        color: {
          type: 'linear',
          x: 0, y: 0, x2: 0, y2: 1,
          colorStops: [
            { offset: 0, color: PALETTE[i % PALETTE.length] + '35' },
            { offset: 1, color: PALETTE[i % PALETTE.length] + '05' },
          ],
        },
      },
      data: oeeByPlant[plant],
    })),
    animationDuration: 1200,
    animationEasing: 'cubicOut',
  };

  // ── ECharts: Throughput Bar ──
  const throughputOption = {
    tooltip: {
      trigger: 'axis',
      backgroundColor: 'rgba(255,255,255,0.95)',
      borderColor: '#e5e7eb',
      borderWidth: 1,
      axisPointer: { type: 'shadow' },
    },
    legend: {
      data: kpiPlants,
      bottom: 0,
      textStyle: { color: '#6b7280', fontSize: 11 },
      icon: 'roundRect',
    },
    grid: { top: 20, right: 20, bottom: 50, left: 60 },
    xAxis: {
      type: 'category',
      data: kpiDates.map(formatDate),
      axisLine: { lineStyle: { color: '#e5e7eb' } },
      axisLabel: { color: '#6b7280', fontSize: 11 },
    },
    yAxis: {
      type: 'value',
      axisLabel: { color: '#6b7280', fontSize: 11 },
      splitLine: { lineStyle: { color: '#f3f4f6', type: 'dashed' } },
    },
    series: kpiPlants.map((plant, i) => ({
      name: plant,
      type: 'bar',
      stack: 'throughput',
      barWidth: '50%',
      itemStyle: {
        color: PALETTE[i % PALETTE.length],
        borderRadius: i === kpiPlants.length - 1 ? [4, 4, 0, 0] : [0, 0, 0, 0],
      },
      emphasis: {
        itemStyle: { shadowBlur: 8, shadowColor: 'rgba(0,0,0,0.15)' },
      },
      data: throughputByPlant[plant],
    })),
    animationDuration: 1000,
    animationEasing: 'cubicOut',
  };

  return (
    <Tabs.Root defaultValue="orders">
      <Tabs.List className="mb-6 flex gap-1 border-b border-gray-200">
        <Tabs.Trigger value="orders" className={tabClass}>Production Orders</Tabs.Trigger>
        <Tabs.Trigger value="kpis" className={tabClass}>Manufacturing KPIs</Tabs.Trigger>
      </Tabs.List>

      <Tabs.Content value="orders" className="space-y-6">
        <div className="grid grid-cols-4 gap-5">
          <MetricCard title="Total Orders" value={totalOrders.toLocaleString()} icon={Factory} accent={ACCENTS[0]} />
          <MetricCard title="Active (Released)" value={activeOrders.toLocaleString()} icon={CheckCircle2} accent={ACCENTS[1]} />
          <MetricCard title="Avg Cycle Time" value={`${avgCycle} days`} icon={Timer} accent={ACCENTS[2]} />
          <MetricCard title="Yield %" value={`${yieldPct}%`} icon={TrendingUp} accent={ACCENTS[3]} />
        </div>

        <div className="grid grid-cols-2 gap-5">
          <ChartCard title="Orders by Status" subtitle="Distribution of production order statuses">
            <ReactECharts option={statusOption} style={{ height: 300 }} />
          </ChartCard>
          <ChartCard title="Cycle Time by Work Center" subtitle="Average days per production cycle">
            <ReactECharts option={cycleOption} style={{ height: 300 }} />
          </ChartCard>
        </div>

        <DataTable
          columns={[
            { key: 'production_order', label: 'Order' },
            { key: 'order_status', label: 'Status' },
            { key: 'plant_name', label: 'Plant' },
            { key: 'material_desc', label: 'Material' },
            { key: 'planned_qty', label: 'Planned' },
            { key: 'confirmed_qty', label: 'Confirmed' },
            { key: 'cycle_time_days', label: 'Cycle Days' },
          ]}
          data={orders}
        />
      </Tabs.Content>

      <Tabs.Content value="kpis" className="space-y-6">
        <div className="grid grid-cols-2 gap-5">
          <ChartCard title="OEE by Plant Over Time" subtitle="Overall Equipment Effectiveness trend">
            <ReactECharts option={oeeOption} style={{ height: 320 }} />
          </ChartCard>
          <ChartCard title="Throughput by Plant" subtitle="Monthly production throughput (stacked)">
            <ReactECharts option={throughputOption} style={{ height: 320 }} />
          </ChartCard>
        </div>
      </Tabs.Content>
    </Tabs.Root>
  );
}
