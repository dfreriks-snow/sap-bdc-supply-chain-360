import { useQuery } from '@/hooks/useQuery';
import { fetchLogistics } from '@/lib/api';
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

export default function Logistics() {
  const { data, loading, error } = useQuery(() => fetchLogistics([]), []);

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

  const dlv: any[] = data ?? [];
  const totalDlv = dlv.length;
  const onTimeCount = dlv.filter((d) => d.on_time_flag === 'Y').length;
  const otdPct = totalDlv > 0 ? (100 * onTimeCount / totalDlv).toFixed(1) : '0';
  const lateOnly = dlv.filter((d) => d.delay_days > 0);
  const avgDelay = lateOnly.length > 0 ? (lateOnly.reduce((s: number, d) => s + d.delay_days, 0) / lateOnly.length).toFixed(1) : 'N/A';
  const totalQty = dlv.reduce((s: number, d) => s + (d.delivery_qty ?? 0), 0);

  // ── Monthly OTD ──
  const monthAgg: Record<string, { total: number; onTime: number }> = {};
  dlv.forEach((d) => {
    const m = d.delivery_month;
    if (!monthAgg[m]) monthAgg[m] = { total: 0, onTime: 0 };
    monthAgg[m].total += 1;
    if (d.on_time_flag === 'Y') monthAgg[m].onTime += 1;
  });
  const months = Object.keys(monthAgg).sort();
  const monthlyOtd = months.map((m) => +(100 * monthAgg[m].onTime / monthAgg[m].total).toFixed(1));
  const formatMonth = (d: string) => {
    const date = new Date(d);
    return date.toLocaleDateString('en-US', { timeZone: 'UTC', month: 'short', year: '2-digit' });
  };

  // ── Delay distribution buckets ──
  const delayBuckets = [
    { label: '1-3 days', min: 1, max: 3 },
    { label: '4-7 days', min: 4, max: 7 },
    { label: '8-14 days', min: 8, max: 14 },
    { label: '15-30 days', min: 15, max: 30 },
    { label: '30+ days', min: 31, max: 9999 },
  ];
  const delayData = delayBuckets.map((b) => ({
    label: b.label,
    count: lateOnly.filter((d) => d.delay_days >= b.min && d.delay_days <= b.max).length,
  }));

  // ── Shipping point aggregation ──
  const spAgg: Record<string, { total: number; onTime: number }> = {};
  dlv.forEach((d) => {
    const sp = d.shipping_point_desc;
    if (!spAgg[sp]) spAgg[sp] = { total: 0, onTime: 0 };
    spAgg[sp].total += 1;
    if (d.on_time_flag === 'Y') spAgg[sp].onTime += 1;
  });
  const spNames = Object.keys(spAgg).sort((a, b) => spAgg[b].total - spAgg[a].total);
  const spTotals = spNames.map((sp) => spAgg[sp].total);
  const spOtd = spNames.map((sp) => +(100 * spAgg[sp].onTime / spAgg[sp].total).toFixed(1));

  // ── ECharts: Monthly OTD Rate ──
  const otdOption = {
    tooltip: {
      trigger: 'axis',
      backgroundColor: 'rgba(255,255,255,0.95)',
      borderColor: '#e5e7eb',
      borderWidth: 1,
      formatter: (params: any) => {
        const p = params[0];
        return `<strong>${p.name}</strong><br/>On-Time Rate: ${p.value}%`;
      },
    },
    grid: { top: 20, right: 20, bottom: 30, left: 50 },
    xAxis: {
      type: 'category',
      data: months.map(formatMonth),
      boundaryGap: false,
      axisLine: { lineStyle: { color: '#e5e7eb' } },
      axisLabel: { color: '#6b7280', fontSize: 11 },
    },
    yAxis: {
      type: 'value',
      min: 60,
      max: 100,
      axisLabel: { color: '#6b7280', fontSize: 11, formatter: '{value}%' },
      splitLine: { lineStyle: { color: '#f3f4f6', type: 'dashed' } },
    },
    series: [{
      type: 'line',
      smooth: true,
      symbol: 'circle',
      symbolSize: 8,
      lineStyle: { width: 3, color: '#10b981' },
      itemStyle: { color: '#10b981', borderWidth: 2, borderColor: '#fff' },
      areaStyle: {
        color: {
          type: 'linear',
          x: 0, y: 0, x2: 0, y2: 1,
          colorStops: [
            { offset: 0, color: '#10b98150' },
            { offset: 1, color: '#10b98105' },
          ],
        },
      },
      markLine: {
        silent: true,
        data: [{ yAxis: 90, label: { formatter: '90% Target', color: '#ef4444', fontSize: 10 }, lineStyle: { color: '#ef4444', type: 'dashed', width: 1.5 } }],
      },
      data: monthlyOtd,
    }],
    animationDuration: 1200,
    animationEasing: 'cubicOut',
  };

  // ── ECharts: Delay Distribution ──
  const delayOption = {
    tooltip: {
      trigger: 'axis',
      backgroundColor: 'rgba(255,255,255,0.95)',
      borderColor: '#e5e7eb',
      borderWidth: 1,
      axisPointer: { type: 'shadow' },
    },
    grid: { top: 15, right: 20, bottom: 30, left: 50 },
    xAxis: {
      type: 'category',
      data: delayData.map((d) => d.label),
      axisLine: { lineStyle: { color: '#e5e7eb' } },
      axisLabel: { color: '#374151', fontSize: 11, fontWeight: 500 },
    },
    yAxis: {
      type: 'value',
      axisLabel: { color: '#6b7280', fontSize: 11 },
      splitLine: { lineStyle: { color: '#f3f4f6', type: 'dashed' } },
    },
    series: [{
      type: 'bar',
      data: delayData.map((d, i) => ({
        value: d.count,
        itemStyle: {
          color: {
            type: 'linear',
            x: 0, y: 0, x2: 0, y2: 1,
            colorStops: [
              { offset: 0, color: ['#f59e0b', '#ef4444', '#dc2626', '#991b1b', '#7f1d1d'][i] ?? '#ef4444' },
              { offset: 1, color: (['#f59e0b', '#ef4444', '#dc2626', '#991b1b', '#7f1d1d'][i] ?? '#ef4444') + '50' },
            ],
          },
          borderRadius: [6, 6, 0, 0],
        },
      })),
      barWidth: '55%',
    }],
    animationDuration: 800,
    animationEasing: 'elasticOut',
  };

  // ── ECharts: Deliveries by Shipping Point ──
  const spDeliveriesOption = {
    tooltip: {
      trigger: 'axis',
      backgroundColor: 'rgba(255,255,255,0.95)',
      borderColor: '#e5e7eb',
      borderWidth: 1,
      axisPointer: { type: 'shadow' },
    },
    grid: { top: 10, right: 20, bottom: 30, left: 140 },
    xAxis: {
      type: 'value',
      axisLabel: { color: '#6b7280', fontSize: 11 },
      splitLine: { lineStyle: { color: '#f3f4f6', type: 'dashed' } },
    },
    yAxis: {
      type: 'category',
      data: spNames,
      axisLabel: { color: '#374151', fontSize: 11, fontWeight: 500 },
      axisLine: { show: false },
      axisTick: { show: false },
    },
    series: [{
      type: 'bar',
      data: spTotals.map((v, i) => ({
        value: v,
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

  // ── ECharts: OTD by Shipping Point (gauge-like horizontal bars) ──
  const spOtdOption = {
    tooltip: {
      trigger: 'axis',
      backgroundColor: 'rgba(255,255,255,0.95)',
      borderColor: '#e5e7eb',
      borderWidth: 1,
      axisPointer: { type: 'shadow' },
      formatter: (params: any) => `<strong>${params[0].name}</strong><br/>On-Time: ${params[0].value}%`,
    },
    grid: { top: 10, right: 30, bottom: 30, left: 140 },
    xAxis: {
      type: 'value',
      min: 0,
      max: 100,
      axisLabel: { color: '#6b7280', fontSize: 11, formatter: '{value}%' },
      splitLine: { lineStyle: { color: '#f3f4f6', type: 'dashed' } },
    },
    yAxis: {
      type: 'category',
      data: spNames,
      axisLabel: { color: '#374151', fontSize: 11, fontWeight: 500 },
      axisLine: { show: false },
      axisTick: { show: false },
    },
    series: [{
      type: 'bar',
      data: spOtd.map((v) => ({
        value: v,
        itemStyle: {
          color: v >= 90 ? '#10b981' : v >= 80 ? '#f59e0b' : '#ef4444',
          borderRadius: [0, 5, 5, 0],
        },
      })),
      barWidth: '55%',
      markLine: {
        silent: true,
        data: [{ xAxis: 90, label: { formatter: '90%', color: '#6b7280', fontSize: 10 }, lineStyle: { color: '#6b7280', type: 'dashed', width: 1 } }],
      },
    }],
    animationDuration: 900,
    animationEasing: 'cubicOut',
  };

  return (
    <Tabs.Root defaultValue="ontime">
      <Tabs.List className="mb-6 flex gap-1 border-b border-gray-200">
        <Tabs.Trigger value="ontime" className={tabClass}>On-Time Analysis</Tabs.Trigger>
        <Tabs.Trigger value="shipping" className={tabClass}>Shipping Points</Tabs.Trigger>
      </Tabs.List>

      <Tabs.Content value="ontime" className="space-y-6">
        <div className="grid grid-cols-4 gap-5">
          <MetricCard title="Total Deliveries" value={totalDlv.toLocaleString()} icon={Factory} accent={ACCENTS[0]} />
          <MetricCard title="On-Time %" value={`${otdPct}%`} icon={CheckCircle2} accent={ACCENTS[1]} />
          <MetricCard title="Avg Delay (late)" value={`${avgDelay} days`} icon={Timer} accent={ACCENTS[2]} />
          <MetricCard title="Total Qty Shipped" value={totalQty.toLocaleString()} icon={TrendingUp} accent={ACCENTS[3]} />
        </div>

        <div className="grid grid-cols-2 gap-5">
          <ChartCard title="Monthly On-Time Rate" subtitle="Delivery performance trend with 90% target line">
            <ReactECharts option={otdOption} style={{ height: 300 }} />
          </ChartCard>
          <ChartCard title="Delay Distribution" subtitle="Late deliveries by severity (days overdue)">
            <ReactECharts option={delayOption} style={{ height: 300 }} />
          </ChartCard>
        </div>
      </Tabs.Content>

      <Tabs.Content value="shipping" className="space-y-6">
        <div className="grid grid-cols-2 gap-5">
          <ChartCard title="Deliveries by Shipping Point" subtitle="Volume per shipping location">
            <ReactECharts option={spDeliveriesOption} style={{ height: 300 }} />
          </ChartCard>
          <ChartCard title="On-Time by Shipping Point" subtitle="Green = 90%+, Amber = 80-90%, Red = below 80%">
            <ReactECharts option={spOtdOption} style={{ height: 300 }} />
          </ChartCard>
        </div>

        <DataTable
          columns={[
            { key: 'delivery_id', label: 'Delivery' },
            { key: 'shipping_point_desc', label: 'Shipping Point' },
            { key: 'material_desc', label: 'Material' },
            { key: 'delivery_qty', label: 'Qty' },
            { key: 'on_time_flag', label: 'On Time' },
            { key: 'delay_days', label: 'Delay (days)' },
          ]}
          data={dlv}
        />
      </Tabs.Content>
    </Tabs.Root>
  );
}
