import { useFilters } from '@/hooks/useFilters';
import { useQuery } from '@/hooks/useQuery';
import { fetchBom } from '@/lib/api';
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

export default function Bom() {
  const { selectedPlants } = useFilters();
  const { data, loading, error } = useQuery(
    () => fetchBom(selectedPlants),
    [selectedPlants.join(',')]
  );

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

  const bom: any[] = data ?? [];
  const uniqueBoms = new Set(bom.map((r) => r.bom_number)).size;
  const uniqueParents = new Set(bom.map((r) => r.parent_material)).size;
  const uniqueComponents = new Set(bom.map((r) => r.component_material)).size;
  const totalCost = bom.reduce((s: number, r) => s + (r.component_cost ?? 0), 0);

  // ── Components per BOM level ──
  const levelCounts: Record<number, number> = {};
  bom.forEach((r) => { levelCounts[r.bom_level] = (levelCounts[r.bom_level] ?? 0) + 1; });
  const levels = Object.keys(levelCounts).sort((a, b) => Number(a) - Number(b));
  const levelValues = levels.map((l) => levelCounts[Number(l)]);

  // ── Item category distribution ──
  const catCounts: Record<string, number> = {};
  bom.forEach((r) => { catCounts[r.item_category] = (catCounts[r.item_category] ?? 0) + 1; });
  const catData = Object.entries(catCounts).map(([cat, count], i) => ({
    name: cat || 'Unknown',
    value: count,
    itemStyle: { color: PALETTE[i % PALETTE.length] },
  }));

  // ── Top 10 costliest components ──
  const costByComp: Record<string, number> = {};
  bom.forEach((r) => { costByComp[r.component_desc] = (costByComp[r.component_desc] ?? 0) + (r.component_cost ?? 0); });
  const topCost = Object.entries(costByComp)
    .map(([name, cost]) => ({ name, cost }))
    .sort((a, b) => b.cost - a.cost)
    .slice(0, 10);

  // ── Cost by level ──
  const costByLevel: Record<number, number> = {};
  bom.forEach((r) => { costByLevel[r.bom_level] = (costByLevel[r.bom_level] ?? 0) + (r.component_cost ?? 0); });
  const costLevels = Object.keys(costByLevel).sort((a, b) => Number(a) - Number(b));
  const costLevelValues = costLevels.map((l) => costByLevel[Number(l)]);

  // ── ECharts: Components per Level ──
  const levelOption = {
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
      data: levels.map((l) => `Level ${l}`),
      axisLine: { lineStyle: { color: '#e5e7eb' } },
      axisLabel: { color: '#374151', fontSize: 12, fontWeight: 500 },
    },
    yAxis: {
      type: 'value',
      axisLabel: { color: '#6b7280', fontSize: 11 },
      splitLine: { lineStyle: { color: '#f3f4f6', type: 'dashed' } },
    },
    series: [{
      type: 'bar',
      data: levelValues.map((v, i) => ({
        value: v,
        itemStyle: {
          color: {
            type: 'linear',
            x: 0, y: 0, x2: 0, y2: 1,
            colorStops: [
              { offset: 0, color: PALETTE[i % PALETTE.length] },
              { offset: 1, color: PALETTE[i % PALETTE.length] + '60' },
            ],
          },
          borderRadius: [6, 6, 0, 0],
        },
      })),
      barWidth: '55%',
    }],
    animationDuration: 900,
    animationEasing: 'elasticOut',
  };

  // ── ECharts: Item Category (ranked bar via Chart policy) ──
  const catOption = {
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
      roseType: 'radius',
      itemStyle: { borderRadius: 6, borderColor: '#fff', borderWidth: 2 },
      label: { show: false },
      emphasis: {
        label: { show: true, fontSize: 13, fontWeight: 'bold' },
        itemStyle: { shadowBlur: 10, shadowColor: 'rgba(0,0,0,0.15)' },
      },
      data: catData,
    }],
    animationDuration: 1000,
    animationEasing: 'cubicOut',
  };

  // ── ECharts: Top 10 Costliest ──
  const topCostOption = {
    tooltip: {
      trigger: 'axis',
      backgroundColor: 'rgba(255,255,255,0.95)',
      borderColor: '#e5e7eb',
      borderWidth: 1,
      axisPointer: { type: 'shadow' },
      formatter: (params: any) => {
        const p = params[0];
        return `<strong>${p.name}</strong><br/>Cost: $${Number(p.value).toLocaleString()}`;
      },
    },
    grid: { top: 10, right: 30, bottom: 30, left: 140 },
    xAxis: {
      type: 'value',
      axisLabel: { color: '#6b7280', fontSize: 11, formatter: (v: number) => `$${(v / 1000).toFixed(0)}k` },
      splitLine: { lineStyle: { color: '#f3f4f6', type: 'dashed' } },
    },
    yAxis: {
      type: 'category',
      data: topCost.map((r) => r.name).reverse(),
      axisLabel: { color: '#374151', fontSize: 11, fontWeight: 500, width: 120, overflow: 'truncate' },
      axisLine: { show: false },
      axisTick: { show: false },
    },
    series: [{
      type: 'bar',
      data: topCost.map((r, i) => ({
        value: r.cost,
        itemStyle: {
          color: {
            type: 'linear',
            x: 0, y: 0, x2: 1, y2: 0,
            colorStops: [
              { offset: 0, color: PALETTE[i % PALETTE.length] },
              { offset: 1, color: PALETTE[i % PALETTE.length] + '70' },
            ],
          },
          borderRadius: [0, 5, 5, 0],
        },
      })).reverse(),
      barWidth: '60%',
    }],
    animationDuration: 1000,
    animationEasing: 'elasticOut',
  };

  // ── ECharts: Cost by Level ──
  const costLevelOption = {
    tooltip: {
      trigger: 'axis',
      backgroundColor: 'rgba(255,255,255,0.95)',
      borderColor: '#e5e7eb',
      borderWidth: 1,
      axisPointer: { type: 'shadow' },
      formatter: (params: any) => {
        const p = params[0];
        return `<strong>${p.name}</strong><br/>Total Cost: $${Number(p.value).toLocaleString()}`;
      },
    },
    grid: { top: 15, right: 20, bottom: 30, left: 70 },
    xAxis: {
      type: 'category',
      data: costLevels.map((l) => `Level ${l}`),
      axisLine: { lineStyle: { color: '#e5e7eb' } },
      axisLabel: { color: '#374151', fontSize: 12, fontWeight: 500 },
    },
    yAxis: {
      type: 'value',
      axisLabel: { color: '#6b7280', fontSize: 11, formatter: (v: number) => `$${(v / 1000).toFixed(0)}k` },
      splitLine: { lineStyle: { color: '#f3f4f6', type: 'dashed' } },
    },
    series: [{
      type: 'bar',
      data: costLevelValues.map((v, i) => ({
        value: v,
        itemStyle: {
          color: {
            type: 'linear',
            x: 0, y: 0, x2: 0, y2: 1,
            colorStops: [
              { offset: 0, color: PALETTE[(i + 2) % PALETTE.length] },
              { offset: 1, color: PALETTE[(i + 2) % PALETTE.length] + '50' },
            ],
          },
          borderRadius: [6, 6, 0, 0],
        },
      })),
      barWidth: '50%',
    }],
    animationDuration: 900,
    animationEasing: 'cubicOut',
  };

  return (
    <Tabs.Root defaultValue="structure">
      <Tabs.List className="mb-6 flex gap-1 border-b border-gray-200">
        <Tabs.Trigger value="structure" className={tabClass}>BOM Structure</Tabs.Trigger>
        <Tabs.Trigger value="cost" className={tabClass}>Cost Analysis</Tabs.Trigger>
      </Tabs.List>

      <Tabs.Content value="structure" className="space-y-6">
        <div className="grid grid-cols-4 gap-5">
          <MetricCard title="Unique BOMs" value={uniqueBoms.toLocaleString()} icon={Factory} accent={ACCENTS[0]} />
          <MetricCard title="Parent Materials" value={uniqueParents.toLocaleString()} icon={CheckCircle2} accent={ACCENTS[1]} />
          <MetricCard title="Components" value={uniqueComponents.toLocaleString()} icon={Timer} accent={ACCENTS[2]} />
          <MetricCard title="Total Component Cost" value={`$${totalCost.toLocaleString()}`} icon={TrendingUp} accent={ACCENTS[3]} />
        </div>

        <div className="grid grid-cols-2 gap-5">
          <ChartCard title="Components per BOM Level" subtitle="Number of component entries at each hierarchy depth">
            <ReactECharts option={levelOption} style={{ height: 300 }} />
          </ChartCard>
          <ChartCard title="Item Category Distribution" subtitle="Component count by item type, largest first">
            <ReactECharts option={catOption} style={{ height: 300 }} />
          </ChartCard>
        </div>

        <DataTable
          columns={[
            { key: 'parent_desc', label: 'Parent Material' },
            { key: 'component_desc', label: 'Component' },
            { key: 'bom_level', label: 'Level' },
            { key: 'component_qty', label: 'Qty' },
            { key: 'component_uom', label: 'UOM' },
            { key: 'component_cost', label: 'Cost ($)' },
          ]}
          data={bom}
        />
      </Tabs.Content>

      <Tabs.Content value="cost" className="space-y-6">
        <div className="grid grid-cols-2 gap-5">
          <ChartCard title="Top 10 Costliest Components" subtitle="Highest cumulative cost across all BOMs">
            <ReactECharts option={topCostOption} style={{ height: 340 }} />
          </ChartCard>
          <ChartCard title="Cost by BOM Level" subtitle="Total component cost at each hierarchy depth">
            <ReactECharts option={costLevelOption} style={{ height: 340 }} />
          </ChartCard>
        </div>
      </Tabs.Content>
    </Tabs.Root>
  );
}
