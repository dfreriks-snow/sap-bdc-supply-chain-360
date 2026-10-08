import { useState } from 'react';
import { useFilters } from '@/hooks/useFilters';
import { useQuery } from '@/hooks/useQuery';
import { fetchOverview, fetchProduction } from '@/lib/api';
import MetricCard, { Factory, CheckCircle2, Timer, TrendingUp, Gauge, Trash2, Truck, RotateCw } from '@/components/MetricCard';
import ChartCard from '@/components/ChartCard';
import ReactECharts from '@/components/Chart';

// Vibrant palette
const PALETTE = ['#06b6d4', '#8b5cf6', '#f59e0b', '#10b981', '#ef4444', '#3b82f6', '#ec4899'];

// Metric card accent styles
const ACCENTS = [
  'border-cyan-400/50 bg-gradient-to-br from-cyan-50 via-white to-cyan-100',
  'border-emerald-400/50 bg-gradient-to-br from-emerald-50 via-white to-emerald-100',
  'border-violet-400/50 bg-gradient-to-br from-violet-50 via-white to-violet-100',
  'border-amber-400/50 bg-gradient-to-br from-amber-50 via-white to-amber-100',
  'border-blue-400/50 bg-gradient-to-br from-blue-50 via-white to-blue-100',
  'border-rose-400/50 bg-gradient-to-br from-rose-50 via-white to-rose-100',
  'border-teal-400/50 bg-gradient-to-br from-teal-50 via-white to-teal-100',
  'border-indigo-400/50 bg-gradient-to-br from-indigo-50 via-white to-indigo-100',
];

export default function Overview() {
  const { selectedPlants } = useFilters();
  const { data, loading, error } = useQuery(
    () => fetchOverview(selectedPlants),
    [selectedPlants.join(',')]
  );
  const { data: prodData } = useQuery(
    () => fetchProduction(selectedPlants),
    [selectedPlants.join(',')]
  );
  const [showOrdersFlyout, setShowOrdersFlyout] = useState(false);

  if (selectedPlants.length === 0) {
    return (
      <div className="rounded-xl border border-amber-300 bg-gradient-to-r from-amber-50 to-orange-50 p-8 text-center text-amber-800 shadow-sm">
        <p className="text-lg font-semibold">Select at least one plant from the sidebar to view data.</p>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-4 gap-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="h-28 animate-pulse rounded-xl bg-gradient-to-br from-sky-100 to-cyan-50" />
          ))}
        </div>
        <div className="grid grid-cols-2 gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-80 animate-pulse rounded-xl bg-gradient-to-br from-gray-100 to-gray-50" />
          ))}
        </div>
      </div>
    );
  }

  if (error) {
    return <div className="rounded-xl border border-red-300 bg-red-50 p-6 text-red-700 shadow-sm"><strong>Error:</strong> {error}</div>;
  }

  const kpis = data?.kpis ?? {};
  const oeeTrendRaw: any[] = data?.oeeTrend ?? [];
  const ordersByPlant: any[] = data?.ordersByPlant ?? [];
  const scrapRate: any[] = data?.scrapRate ?? [];
  const otdTrendRaw: any[] = data?.otdTrend ?? [];

  // Extract unique dates and plants for OEE
  const oeeDates = [...new Set(oeeTrendRaw.map((r) => r.period_date))].sort();
  const oeePlants = [...new Set(oeeTrendRaw.map((r) => r.plant_name))];
  const oeeByPlant: Record<string, number[]> = {};
  oeePlants.forEach((plant) => {
    oeeByPlant[plant] = oeeDates.map((d) => {
      const row = oeeTrendRaw.find((r) => r.period_date === d && r.plant_name === plant);
      return row?.oee ?? null;
    });
  });

  // Extract unique dates and plants for OTD
  const otdDates = [...new Set(otdTrendRaw.map((r) => r.period_date))].sort();
  const otdPlants = [...new Set(otdTrendRaw.map((r) => r.plant_name))];
  const otdByPlant: Record<string, number[]> = {};
  otdPlants.forEach((plant) => {
    otdByPlant[plant] = otdDates.map((d) => {
      const row = otdTrendRaw.find((r) => r.period_date === d && r.plant_name === plant);
      return row?.otd ?? null;
    });
  });

  // Format dates for display
  const formatDate = (d: string) => {
    const date = new Date(d);
    return date.toLocaleDateString('en-US', { timeZone: 'UTC', month: 'short', year: '2-digit' });
  };

  // ── OEE Line Chart Options ──
  const oeeOption = {
    tooltip: {
      trigger: 'axis',
      backgroundColor: 'rgba(255,255,255,0.95)',
      borderColor: '#e5e7eb',
      borderWidth: 1,
      textStyle: { color: '#1f2937', fontSize: 12 },
    },
    legend: {
      data: oeePlants,
      bottom: 0,
      textStyle: { color: '#6b7280', fontSize: 11 },
      icon: 'roundRect',
    },
    grid: { top: 20, right: 20, bottom: 50, left: 50 },
    xAxis: {
      type: 'category',
      data: oeeDates.map(formatDate),
      axisLine: { lineStyle: { color: '#e5e7eb' } },
      axisLabel: { color: '#6b7280', fontSize: 11 },
    },
    yAxis: {
      type: 'value',
      min: 70,
      max: 100,
      axisLabel: { color: '#6b7280', fontSize: 11, formatter: '{value}%' },
      splitLine: { lineStyle: { color: '#f3f4f6', type: 'dashed' } },
    },
    series: oeePlants.map((plant, i) => ({
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
            { offset: 0, color: PALETTE[i % PALETTE.length] + '40' },
            { offset: 1, color: PALETTE[i % PALETTE.length] + '05' },
          ],
        },
      },
      data: oeeByPlant[plant],
    })),
    animationDuration: 1200,
    animationEasing: 'cubicOut',
  };

  // ── Orders Bar Chart ──
  const ordersOption = {
    tooltip: {
      trigger: 'axis',
      backgroundColor: 'rgba(255,255,255,0.95)',
      borderColor: '#e5e7eb',
      borderWidth: 1,
      axisPointer: { type: 'shadow' },
    },
    grid: { top: 10, right: 20, bottom: 30, left: 110 },
    xAxis: {
      type: 'value',
      axisLabel: { color: '#6b7280', fontSize: 11 },
      splitLine: { lineStyle: { color: '#f3f4f6', type: 'dashed' } },
    },
    yAxis: {
      type: 'category',
      data: ordersByPlant.map((r) => r.plant_name),
      axisLabel: { color: '#374151', fontSize: 12, fontWeight: 500 },
      axisLine: { show: false },
      axisTick: { show: false },
    },
    series: [{
      type: 'bar',
      data: ordersByPlant.map((r, i) => ({
        value: r.orders,
        itemStyle: {
          color: {
            type: 'linear',
            x: 0, y: 0, x2: 1, y2: 0,
            colorStops: [
              { offset: 0, color: PALETTE[i % PALETTE.length] },
              { offset: 1, color: PALETTE[i % PALETTE.length] + '80' },
            ],
          },
          borderRadius: [0, 4, 4, 0],
        },
      })),
      barWidth: '60%',
    }],
    animationDuration: 800,
    animationEasing: 'elasticOut',
  };

  // ── Scrap rate by plant (ranked bar via Chart policy) ──
  const scrapOption = {
    tooltip: {
      trigger: 'item',
      backgroundColor: 'rgba(255,255,255,0.95)',
      borderColor: '#e5e7eb',
      borderWidth: 1,
      formatter: '{b}: {c}% ({d}%)',
    },
    legend: {
      orient: 'vertical',
      right: 10,
      top: 'center',
      textStyle: { color: '#6b7280', fontSize: 11 },
    },
    series: [{
      type: 'pie',
      radius: ['40%', '70%'],
      center: ['40%', '50%'],
      avoidLabelOverlap: true,
      itemStyle: {
        borderRadius: 6,
        borderColor: '#fff',
        borderWidth: 2,
      },
      label: { show: false },
      emphasis: {
        label: { show: true, fontSize: 14, fontWeight: 'bold' },
        itemStyle: { shadowBlur: 10, shadowOffsetX: 0, shadowColor: 'rgba(0,0,0,0.2)' },
      },
      data: scrapRate.map((r, i) => ({
        name: r.plant_name,
        value: r.scrap_rate,
        itemStyle: { color: PALETTE[i % PALETTE.length] },
      })),
    }],
    animationDuration: 1000,
    animationEasing: 'cubicOut',
  };

  // ── OTD Area Chart ──
  const otdOption = {
    tooltip: {
      trigger: 'axis',
      backgroundColor: 'rgba(255,255,255,0.95)',
      borderColor: '#e5e7eb',
      borderWidth: 1,
      textStyle: { color: '#1f2937', fontSize: 12 },
    },
    legend: {
      data: otdPlants,
      bottom: 0,
      textStyle: { color: '#6b7280', fontSize: 11 },
      icon: 'roundRect',
    },
    grid: { top: 20, right: 20, bottom: 50, left: 50 },
    xAxis: {
      type: 'category',
      data: otdDates.map(formatDate),
      boundaryGap: false,
      axisLine: { lineStyle: { color: '#e5e7eb' } },
      axisLabel: { color: '#6b7280', fontSize: 11 },
    },
    yAxis: {
      type: 'value',
      min: 75,
      max: 100,
      axisLabel: { color: '#6b7280', fontSize: 11, formatter: '{value}%' },
      splitLine: { lineStyle: { color: '#f3f4f6', type: 'dashed' } },
    },
    series: otdPlants.map((plant, i) => ({
      name: plant,
      type: 'line',
      smooth: true,
      symbol: 'circle',
      symbolSize: 6,
      lineStyle: { width: 2.5, color: PALETTE[i % PALETTE.length] },
      itemStyle: { color: PALETTE[i % PALETTE.length] },
      data: otdByPlant[plant],
    })),
    animationDuration: 1200,
    animationEasing: 'cubicOut',
  };

  return (
    <div className="space-y-8">
      {/* Metric Cards */}
      <div className="grid grid-cols-4 gap-5">
        <button onClick={() => setShowOrdersFlyout(true)} className="text-left">
          <MetricCard title="Production Orders" value={`${Number(kpis.total_orders ?? 0).toLocaleString()}`} icon={Factory} accent={ACCENTS[0]} className="cursor-pointer ring-2 ring-transparent hover:ring-cyan-300" />
        </button>
        <MetricCard title="Confirmed Qty" value={`${Number(kpis.total_confirmed ?? 0).toLocaleString()}`} icon={CheckCircle2} accent={ACCENTS[1]} />
        <MetricCard title="Avg Cycle Time" value={`${kpis.avg_cycle_time ?? 0} days`} icon={Timer} accent={ACCENTS[2]} />
        <MetricCard title="Yield %" value={`${kpis.yield_pct ?? 0}%`} icon={TrendingUp} accent={ACCENTS[3]} />
        <MetricCard title="OEE" value={`${kpis.avg_oee ?? 0}%`} icon={Gauge} accent={ACCENTS[4]} />
        <MetricCard title="Scrap Rate" value={`${kpis.avg_scrap_rate ?? 0}%`} icon={Trash2} accent={ACCENTS[5]} />
        <MetricCard title="On-Time Delivery" value={`${kpis.avg_otd ?? 0}%`} icon={Truck} accent={ACCENTS[6]} />
        <MetricCard title="Inventory Turnover" value={`${kpis.avg_inv_turn ?? 0}x`} icon={RotateCw} accent={ACCENTS[7]} />
      </div>

      {/* Charts */}
      <div className="grid grid-cols-2 gap-5">
        <ChartCard title="Monthly OEE Trend" subtitle="Overall Equipment Effectiveness (Availability x Performance x Quality) by plant">
          <ReactECharts option={oeeOption} style={{ height: 320 }} />
        </ChartCard>

        <ChartCard title="Orders by Plant" subtitle="Production order count per manufacturing site">
          <ReactECharts option={ordersOption} style={{ height: 320 }} />
        </ChartCard>

        <ChartCard title="Scrap Rate by Plant" subtitle="Average scrap percentage per facility">
          <ReactECharts option={scrapOption} style={{ height: 320 }} />
        </ChartCard>

        <ChartCard title="On-Time Delivery Trend" subtitle="OTD percentage by plant over time">
          <ReactECharts option={otdOption} style={{ height: 320 }} />
        </ChartCard>
      </div>

      {/* Production Orders Flyout */}
      {showOrdersFlyout && (
        <>
          {/* Backdrop */}
          <div className="fixed inset-0 z-40 bg-black/30 transition-opacity" onClick={() => setShowOrdersFlyout(false)} />
          {/* Panel */}
          <div className="fixed right-0 top-0 z-50 h-full w-[520px] bg-white shadow-2xl overflow-y-auto animate-in slide-in-from-right">
            <div className="sticky top-0 z-10 flex items-center justify-between border-b border-gray-200 bg-white px-6 py-4">
              <div>
                <h2 className="text-lg font-bold text-sf-dark">Production Orders</h2>
                <p className="text-xs text-gray-500">{((prodData as any)?.orders ?? []).length} orders across selected plants</p>
              </div>
              <button onClick={() => setShowOrdersFlyout(false)} className="rounded-lg p-2 text-gray-400 hover:bg-gray-100 hover:text-gray-600 text-xl font-bold">✕</button>
            </div>
            <div className="p-4 space-y-3">
              {((prodData as any)?.orders ?? []).map((order: any, i: number) => (
                <div key={order.production_order || i} className="rounded-lg border border-gray-200 p-4 hover:border-cyan-300 transition-colors">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-bold text-sf-dark">{order.production_order}</span>
                    <span className={`rounded-full px-2.5 py-0.5 text-[10px] font-semibold ${
                      order.order_status === 'Delivered' ? 'bg-emerald-100 text-emerald-700' :
                      order.order_status === 'Released' ? 'bg-amber-100 text-amber-700' :
                      order.order_status === 'Created' ? 'bg-blue-100 text-blue-700' :
                      'bg-gray-100 text-gray-600'
                    }`}>{order.order_status}</span>
                  </div>
                  <p className="text-sm font-medium text-gray-800 mb-2">{order.material_desc}</p>
                  <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs text-gray-600">
                    <p><span className="font-semibold text-gray-500">Plant:</span> {order.plant_name}</p>
                    <p><span className="font-semibold text-gray-500">Work Center:</span> {order.work_center}</p>
                    <p><span className="font-semibold text-gray-500">Planned Qty:</span> {order.planned_qty}</p>
                    <p><span className="font-semibold text-gray-500">Confirmed:</span> {order.confirmed_qty}</p>
                    <p><span className="font-semibold text-gray-500">Start:</span> {String(order.basic_start_date).replace(/"/g, '')}</p>
                    <p><span className="font-semibold text-gray-500">Finish:</span> {String(order.basic_finish_date).replace(/"/g, '')}</p>
                    <p><span className="font-semibold text-gray-500">Cycle Time:</span> {order.cycle_time_days} days</p>
                    <p><span className="font-semibold text-gray-500">Yield:</span> {order.yield_qty}/{order.planned_qty} ({order.planned_qty > 0 ? ((order.yield_qty / order.planned_qty) * 100).toFixed(0) : 0}%)</p>
                  </div>
                  {/* Timeline bar */}
                  <div className="mt-3 h-1.5 w-full rounded-full bg-gray-100">
                    <div className="h-1.5 rounded-full" style={{
                      width: order.order_status === 'Delivered' ? '100%' : order.order_status === 'Released' ? '60%' : '20%',
                      backgroundColor: order.order_status === 'Delivered' ? '#10b981' : order.order_status === 'Released' ? '#f59e0b' : '#3b82f6',
                    }} />
                  </div>
                </div>
              ))}
              {((prodData as any)?.orders ?? []).length === 0 && (
                <p className="text-center text-sm text-gray-400 py-8">No production orders found for selected plants.</p>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
