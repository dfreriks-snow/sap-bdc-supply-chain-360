import { useState } from 'react';
import { useFilters } from '@/hooks/useFilters';
import { useQuery } from '@/hooks/useQuery';
import { fetchInventory } from '@/lib/api';
import MetricCard, { Factory, CheckCircle2, Timer, TrendingUp } from '@/components/MetricCard';
import ChartCard from '@/components/ChartCard';
import DataTable from '@/components/DataTable';
import * as Tabs from '@radix-ui/react-tabs';
import ReactECharts from '@/components/Chart';

const PALETTE = ['#06b6d4', '#8b5cf6', '#f59e0b', '#10b981', '#ef4444', '#3b82f6', '#ec4899'];
const tabClass = 'px-4 py-2 text-sm font-medium text-gray-500 data-[state=active]:border-b-2 data-[state=active]:border-sf-primary data-[state=active]:text-sf-dark';

const ACCENTS = [
  'border-cyan-400/50 bg-gradient-to-br from-cyan-50 via-white to-cyan-100',
  'border-violet-400/50 bg-gradient-to-br from-violet-50 via-white to-violet-100',
  'border-amber-400/50 bg-gradient-to-br from-amber-50 via-white to-amber-100',
  'border-emerald-400/50 bg-gradient-to-br from-emerald-50 via-white to-emerald-100',
];

export default function Inventory() {
  const { selectedPlants } = useFilters();
  const { data, loading, error } = useQuery(
    () => fetchInventory(selectedPlants),
    [selectedPlants.join(',')]
  );
  const [selectedDoiBucket, setSelectedDoiBucket] = useState<string | null>(null);

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

  const inv: any[] = data ?? [];
  const uniqueMaterials = new Set(inv.map((r) => r.material)).size;
  const totalValue = inv.reduce((s: number, r) => s + (r.stock_value ?? 0), 0);
  const avgDoi = inv.length > 0 ? Math.round(inv.reduce((s: number, r) => s + (r.days_of_inventory ?? 0), 0) / inv.length) : 0;
  const obsoleteCount = inv.filter((r) => r.obsolete_flag === 'Y').length;
  const obsoletePct = inv.length > 0 ? (100 * obsoleteCount / inv.length).toFixed(1) : '0';

  // ── Stock value by plant ──
  const plantAgg: Record<string, number> = {};
  inv.forEach((r) => { plantAgg[r.plant_name] = (plantAgg[r.plant_name] ?? 0) + (r.stock_value ?? 0); });
  const byPlant = Object.entries(plantAgg)
    .map(([name, value]) => ({ name, value }))
    .sort((a, b) => b.value - a.value);

  // ── Obsolete vs Active ──
  const activeCount = inv.length - obsoleteCount;

  // ── Turnover by plant ──
  const trAgg: Record<string, { total: number; count: number }> = {};
  inv.forEach((r) => {
    if (!trAgg[r.plant_name]) trAgg[r.plant_name] = { total: 0, count: 0 };
    trAgg[r.plant_name].total += r.turnover_rate ?? 0;
    trAgg[r.plant_name].count += 1;
  });
  const turnoverByPlant = Object.entries(trAgg)
    .map(([name, v]) => ({ name, rate: +(v.total / v.count).toFixed(1) }))
    .sort((a, b) => b.rate - a.rate);

  // ── Days of inventory distribution (histogram buckets) ──
  const doiBuckets = [
    { label: '0-30', min: 0, max: 30 },
    { label: '31-60', min: 31, max: 60 },
    { label: '61-90', min: 61, max: 90 },
    { label: '91-120', min: 91, max: 120 },
    { label: '120+', min: 121, max: 9999 },
  ];
  const doiData = doiBuckets.map((b) => ({
    label: b.label,
    count: inv.filter((r) => (r.days_of_inventory ?? 0) >= b.min && (r.days_of_inventory ?? 0) <= b.max).length,
  }));

  // ── ECharts: Stock Value by Plant ──
  const stockOption = {
    tooltip: {
      trigger: 'axis',
      backgroundColor: 'rgba(255,255,255,0.95)',
      borderColor: '#e5e7eb',
      borderWidth: 1,
      axisPointer: { type: 'shadow' },
      formatter: (params: any) => {
        const p = params[0];
        return `<strong>${p.name}</strong><br/>Stock Value: $${Number(p.value).toLocaleString()}`;
      },
    },
    grid: { top: 10, right: 30, bottom: 30, left: 120 },
    xAxis: {
      type: 'value',
      axisLabel: { color: '#6b7280', fontSize: 11, formatter: (v: number) => `$${(v / 1000).toFixed(0)}k` },
      splitLine: { lineStyle: { color: '#f3f4f6', type: 'dashed' } },
    },
    yAxis: {
      type: 'category',
      data: byPlant.map((r) => r.name),
      axisLabel: { color: '#374151', fontSize: 12, fontWeight: 500 },
      axisLine: { show: false },
      axisTick: { show: false },
    },
    series: [{
      type: 'bar',
      data: byPlant.map((r, i) => ({
        value: r.value,
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

  // ── ECharts: Obsolete vs Active (ranked bar via Chart policy) ──
  const obsOption = {
    tooltip: {
      trigger: 'item',
      backgroundColor: 'rgba(255,255,255,0.95)',
      borderColor: '#e5e7eb',
      borderWidth: 1,
      formatter: '{b}: {c} items ({d}%)',
    },
    legend: {
      bottom: 10,
      textStyle: { color: '#6b7280', fontSize: 12 },
    },
    series: [{
      type: 'pie',
      radius: ['45%', '75%'],
      center: ['50%', '45%'],
      startAngle: 180,
      itemStyle: { borderRadius: 8, borderColor: '#fff', borderWidth: 3 },
      label: {
        show: true,
        position: 'center',
        fontSize: 22,
        fontWeight: 'bold',
        color: '#374151',
        formatter: () => `${obsoletePct}%\nObsolete`,
      },
      emphasis: {
        itemStyle: { shadowBlur: 12, shadowColor: 'rgba(0,0,0,0.2)' },
      },
      data: [
        { name: 'Active', value: activeCount, itemStyle: { color: '#10b981' } },
        { name: 'Obsolete', value: obsoleteCount, itemStyle: { color: '#ef4444' } },
      ],
    }],
    animationDuration: 1200,
    animationEasing: 'cubicOut',
  };

  // ── ECharts: Turnover by Plant ──
  const turnoverOption = {
    tooltip: {
      trigger: 'axis',
      backgroundColor: 'rgba(255,255,255,0.95)',
      borderColor: '#e5e7eb',
      borderWidth: 1,
      axisPointer: { type: 'shadow' },
    },
    grid: { top: 10, right: 20, bottom: 30, left: 120 },
    xAxis: {
      type: 'value',
      axisLabel: { color: '#6b7280', fontSize: 11, formatter: '{value}x' },
      splitLine: { lineStyle: { color: '#f3f4f6', type: 'dashed' } },
    },
    yAxis: {
      type: 'category',
      data: turnoverByPlant.map((r) => r.name),
      axisLabel: { color: '#374151', fontSize: 12, fontWeight: 500 },
      axisLine: { show: false },
      axisTick: { show: false },
    },
    series: [{
      type: 'bar',
      data: turnoverByPlant.map((r, i) => ({
        value: r.rate,
        itemStyle: {
          color: {
            type: 'linear',
            x: 0, y: 0, x2: 1, y2: 0,
            colorStops: [
              { offset: 0, color: PALETTE[(i + 3) % PALETTE.length] },
              { offset: 1, color: PALETTE[(i + 3) % PALETTE.length] + '60' },
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

  // ── ECharts: Days of Inventory Distribution ──
  const doiOption = {
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
      data: doiData.map((d) => d.label),
      axisLine: { lineStyle: { color: '#e5e7eb' } },
      axisLabel: { color: '#374151', fontSize: 12, fontWeight: 500 },
      name: 'Days',
      nameLocation: 'middle',
      nameGap: 25,
      nameTextStyle: { color: '#6b7280', fontSize: 11 },
    },
    yAxis: {
      type: 'value',
      axisLabel: { color: '#6b7280', fontSize: 11 },
      splitLine: { lineStyle: { color: '#f3f4f6', type: 'dashed' } },
    },
    series: [{
      type: 'bar',
      data: doiData.map((d, i) => ({
        value: d.count,
        itemStyle: {
          color: {
            type: 'linear',
            x: 0, y: 0, x2: 0, y2: 1,
            colorStops: [
              { offset: 0, color: PALETTE[(i + 1) % PALETTE.length] },
              { offset: 1, color: PALETTE[(i + 1) % PALETTE.length] + '50' },
            ],
          },
          borderRadius: [6, 6, 0, 0],
        },
      })),
      barWidth: '60%',
    }],
    animationDuration: 800,
    animationEasing: 'cubicOut',
  };

  return (
    <Tabs.Root defaultValue="stock">
      <Tabs.List className="mb-6 flex gap-1 border-b border-gray-200">
        <Tabs.Trigger value="stock" className={tabClass}>Stock Levels</Tabs.Trigger>
        <Tabs.Trigger value="turnover" className={tabClass}>Turnover Analysis</Tabs.Trigger>
      </Tabs.List>

      <Tabs.Content value="stock" className="space-y-6">
        <div className="grid grid-cols-4 gap-5">
          <MetricCard title="Materials" value={uniqueMaterials.toLocaleString()} icon={Factory} accent={ACCENTS[0]} />
          <MetricCard title="Total Stock Value" value={`$${totalValue.toLocaleString()}`} icon={TrendingUp} accent={ACCENTS[1]} />
          <MetricCard title="Avg Days of Inventory" value={`${avgDoi}`} icon={Timer} accent={ACCENTS[2]} />
          <MetricCard title="Obsolete %" value={`${obsoletePct}%`} icon={CheckCircle2} accent={ACCENTS[3]} />
        </div>

        <div className="grid grid-cols-2 gap-5">
          <ChartCard title="Stock Value by Plant" subtitle="Total inventory value per manufacturing site">
            <ReactECharts option={stockOption} style={{ height: 300 }} />
          </ChartCard>
          <ChartCard title="Obsolete vs Active Stock" subtitle="Percentage of inventory flagged as obsolete">
            <ReactECharts option={obsOption} style={{ height: 300 }} />
          </ChartCard>
        </div>

        <DataTable
          columns={[
            { key: 'material_desc', label: 'Material' },
            { key: 'plant_name', label: 'Plant' },
            { key: 'storage_location', label: 'Location' },
            { key: 'stock_qty', label: 'Qty' },
            { key: 'stock_value', label: 'Value ($)' },
            { key: 'days_of_inventory', label: 'Days' },
            { key: 'obsolete_flag', label: 'Obsolete' },
          ]}
          data={inv}
        />
      </Tabs.Content>

      <Tabs.Content value="turnover" className="space-y-6">
        <div className="grid grid-cols-2 gap-5">
          <ChartCard title="Turnover Rate by Plant" subtitle="Average inventory turns per plant">
            <ReactECharts option={turnoverOption} style={{ height: 300 }} />
          </ChartCard>
          <ChartCard title="Days of Inventory Distribution" subtitle="Click a bar to see materials in that bucket">
            <ReactECharts
              option={doiOption}
              style={{ height: 300 }}
              onEvents={{
                click: (params: any) => {
                  if (params.componentType === 'series') {
                    const label = doiData[params.dataIndex]?.label;
                    setSelectedDoiBucket(selectedDoiBucket === label ? null : label);
                  }
                },
              }}
            />
          </ChartCard>
        </div>

        {/* Materials list for selected DOI bucket */}
        {selectedDoiBucket && (() => {
          const bucket = doiBuckets.find((b) => b.label === selectedDoiBucket);
          if (!bucket) return null;
          const materials = inv.filter((r: any) => (r.days_of_inventory ?? 0) >= bucket.min && (r.days_of_inventory ?? 0) <= bucket.max);
          return (
            <ChartCard title={`Materials with ${selectedDoiBucket} Days of Inventory`} subtitle={`${materials.length} material(s) in this bucket — click another bar to change selection`}>
              <DataTable
                columns={[
                  { key: 'material_desc', label: 'Material' },
                  { key: 'plant_name', label: 'Plant' },
                  { key: 'storage_location', label: 'Location' },
                  { key: 'stock_qty', label: 'Qty' },
                  { key: 'stock_value', label: 'Value ($)' },
                  { key: 'days_of_inventory', label: 'Days' },
                  { key: 'obsolete_flag', label: 'Obsolete' },
                ]}
                data={materials}
              />
            </ChartCard>
          );
        })()}
      </Tabs.Content>
    </Tabs.Root>
  );
}
