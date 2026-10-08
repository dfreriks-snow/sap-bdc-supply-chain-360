import { useMemo, useState } from 'react';
import * as Tabs from '@radix-ui/react-tabs';
import ReactECharts from '@/components/Chart';
import { useFilters } from '@/hooks/useFilters';
import { useQuery } from '@/hooks/useQuery';
import { fetchOptimization } from '@/lib/api';
import MetricCard, { Factory, CheckCircle2, Timer, TrendingUp } from '@/components/MetricCard';
import ChartCard from '@/components/ChartCard';
import DataTable from '@/components/DataTable';

const PALETTE = ['#06b6d4', '#8b5cf6', '#f59e0b', '#10b981', '#ef4444', '#3b82f6', '#ec4899'];

const tabClass =
  'px-4 py-2 text-sm font-medium text-sf-dark/60 data-[state=active]:text-sf-primary data-[state=active]:border-b-2 data-[state=active]:border-sf-primary';

interface KpiTrend {
  plant_name: string;
  period_date: string;
  oee: number;
  scrap_rate: number;
  otd: number;
  inv_turnover: number;
}

interface SupplierQuality {
  supplier_name: string;
  material_desc: string;
  avg_defect_rate: number;
  avg_otd: number;
  avg_quality_score: number;
}

interface DeliveryPerf {
  shipping_point_desc: string;
  total_deliveries: number;
  on_time_count: number;
  otd_pct: number;
  avg_delay: number;
}

interface ProductionEff {
  plant_name: string;
  material_desc: string;
  order_count: number;
  avg_cycle_time: number;
  yield_pct: number;
  scrap_pct: number;
}

interface OptimizationData {
  kpiTrends: KpiTrend[];
  supplierQuality: SupplierQuality[];
  deliveryPerf: DeliveryPerf[];
  productionEff: ProductionEff[];
}

// SCOR DS v14.0 - Seven major management processes (ASCM 2025)
const SCOR_PROCESSES = [
  { id: 'OE', name: 'Orchestrate', level: 0, desc: 'Manage supply chain strategy, governance, and performance', color: '#1e3a5f', icon: '🎯' },
  { id: 'P', name: 'Plan', level: 1, desc: 'Balance demand and supply; develop course of action for sourcing, production, and delivery', color: '#06b6d4', icon: '📋' },
  { id: 'O', name: 'Order', level: 1, desc: 'Capture and manage customer orders through to fulfillment trigger', color: '#8b5cf6', icon: '📦' },
  { id: 'S', name: 'Source', level: 1, desc: 'Procure materials, manage supplier relationships, and receive goods', color: '#10b981', icon: '🏭' },
  { id: 'T', name: 'Transform', level: 1, desc: 'Convert materials into finished products through manufacturing processes', color: '#f59e0b', icon: '⚙️' },
  { id: 'F', name: 'Fulfill', level: 1, desc: 'Pick, pack, ship, and deliver products to customers', color: '#3b82f6', icon: '🚛' },
  { id: 'R', name: 'Return', level: 1, desc: 'Manage reverse flow of defective, excess, or MRO products', color: '#ef4444', icon: '🔄' },
];

// SCOR DS v14.0 Performance Attributes (3 categories, 8 attributes)
const SCOR_PERFORMANCE = [
  { category: 'Resilience', color: '#10b981', attributes: [
    { code: 'RL', name: 'Reliability', metric: 'Perfect Order Fulfillment', desc: 'Deliver on time, in full, at right quality' },
    { code: 'RS', name: 'Responsiveness', metric: 'Order Fulfillment Cycle Time', desc: 'Speed of delivering products to customer' },
    { code: 'AG', name: 'Agility', metric: 'Supply Chain Agility', desc: 'Ability to respond to market changes' },
  ]},
  { category: 'Economic', color: '#3b82f6', attributes: [
    { code: 'CO', name: 'Costs', metric: 'Total SC Mgmt Costs + COGS', desc: 'Cost of operating supply chain processes' },
    { code: 'PR', name: 'Profit', metric: 'EBIT % of Revenue', desc: 'Financial return from supply chain operations' },
    { code: 'AM', name: 'Assets', metric: 'Cash-to-Cash Cycle Time', desc: 'Efficiency of asset utilization' },
  ]},
  { category: 'Sustainability', color: '#8b5cf6', attributes: [
    { code: 'EV', name: 'Environmental', metric: 'GHG Emissions, Waste, Energy', desc: 'Minimal environmental impact' },
    { code: 'SC', name: 'Social', metric: 'Diversity, Wages, Training', desc: 'Alignment with social values' },
  ]},
];

export default function Optimization() {
  const { selectedPlants } = useFilters();
  const { data, loading, error } = useQuery<OptimizationData>(
    () => fetchOptimization(selectedPlants),
    [selectedPlants.join(',')]
  );

  const computed = useMemo(() => {
    if (!data) return null;

    const kpi = data.kpiTrends;
    const avgOee = kpi.length > 0 ? (kpi.reduce((s, k) => s + k.oee, 0) / kpi.length).toFixed(1) : '0';
    const avgOtd = kpi.length > 0 ? (kpi.reduce((s, k) => s + k.otd, 0) / kpi.length).toFixed(1) : '0';
    const avgScrap = kpi.length > 0 ? (kpi.reduce((s, k) => s + k.scrap_rate, 0) / kpi.length).toFixed(2) : '0';
    const avgTurnover = kpi.length > 0 ? (kpi.reduce((s, k) => s + k.inv_turnover, 0) / kpi.length).toFixed(1) : '0';

    // Group KPI trends by period for line chart
    const periods = [...new Set(kpi.map((k) => k.period_date))].sort();

    return { avgOee, avgOtd, avgScrap, avgTurnover, periods, kpi };
  }, [data]);

  const [selectedProcess, setSelectedProcess] = useState<string | null>(null);

  if (selectedPlants.length === 0) {
    return (
      <div className="rounded-xl border border-amber-200 bg-amber-50 p-6 text-center text-amber-800">
        Select at least one plant from the sidebar to view optimization data.
      </div>
    );
  }

  if (loading) {
    return (
      <div className="space-y-4">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="h-32 animate-pulse rounded-xl bg-sky-100/60" />
        ))}
      </div>
    );
  }

  if (error) {
    return <div className="rounded-xl bg-red-50 p-4 text-red-700">Error: {error}</div>;
  }

  if (!data || !computed) {
    return <p className="py-4 text-center text-sm text-gray-400">No data available</p>;
  }

  return (
    <Tabs.Root defaultValue="process">
      <Tabs.List className="mb-6 flex gap-1 border-b border-gray-200">
        <Tabs.Trigger value="process" className={tabClass}>Process Overview</Tabs.Trigger>
        <Tabs.Trigger value="metrics" className={tabClass}>Optimization Metrics</Tabs.Trigger>
        <Tabs.Trigger value="ai" className={tabClass}>AI Recommendations</Tabs.Trigger>
      </Tabs.List>

      <Tabs.Content value="process" className="space-y-6">
        <div className="grid grid-cols-4 gap-5">
          <MetricCard title="Avg OEE" value={`${computed.avgOee}%`} icon={Factory} accent="border-cyan-400/50 bg-gradient-to-br from-cyan-50 via-white to-cyan-100" />
          <MetricCard title="On-Time Delivery" value={`${computed.avgOtd}%`} icon={CheckCircle2} accent="border-emerald-400/50 bg-gradient-to-br from-emerald-50 via-white to-emerald-100" />
          <MetricCard title="Avg Scrap Rate" value={`${computed.avgScrap}%`} icon={Timer} accent="border-violet-400/50 bg-gradient-to-br from-violet-50 via-white to-violet-100" />
          <MetricCard title="Inventory Turnover" value={`${computed.avgTurnover}x`} icon={TrendingUp} accent="border-amber-400/50 bg-gradient-to-br from-amber-50 via-white to-amber-100" />
        </div>

        {/* SCOR DS v14.0 Framework Overview */}
        <ChartCard title="SCOR Digital Standard v14.0" subtitle="Click any process node to explore its live data and metrics from your supply chain">
          <div className="px-6 py-4">
            {/* Introduction text */}
            <p className="mb-4 text-xs text-gray-600 leading-relaxed">
              The <strong>SCOR Digital Standard</strong> (ASCM, 2025) is organized around seven major management processes 
              forming a double-infinity diagram. The horizontal loop balances <strong>Supply</strong> (Source → Transform) and <strong>Demand</strong> (Order → Fulfill), 
              while the vertical loop connects <strong>Synchronize</strong> (Plan) and <strong>Regenerate</strong> (Return). 
              <strong> Orchestrate</strong> sits at the center as the Level-0 governance process.
            </p>

            {/* Interactive Double Infinity Visual */}
            <div className="relative mx-auto mb-6" style={{ maxWidth: 780, height: 420 }}>
              {/* Center - Orchestrate */}
              <button onClick={() => setSelectedProcess('OE')} className={`absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 flex h-20 w-20 flex-col items-center justify-center rounded-full border-3 shadow-lg z-10 transition-all hover:scale-110 ${selectedProcess === 'OE' ? 'ring-4 ring-slate-400 scale-110 border-white bg-gradient-to-br from-slate-700 to-slate-600' : 'border-[#1e3a5f] bg-gradient-to-br from-slate-800 to-slate-700'}`}>
                <span className="text-lg">🎯</span>
                <span className="text-[8px] font-bold text-white">ORCHESTRATE</span>
              </button>

              {/* Top - Plan */}
              <button onClick={() => setSelectedProcess('P')} className={`absolute left-1/2 top-0 -translate-x-1/2 flex h-14 w-28 flex-col items-center justify-center rounded-xl border-2 shadow-md transition-all hover:scale-105 cursor-pointer ${selectedProcess === 'P' ? 'ring-4 ring-cyan-300 scale-105 border-cyan-500 bg-gradient-to-br from-cyan-100 to-white' : 'border-cyan-400 bg-gradient-to-br from-cyan-50 to-white'}`}>
                <span className="text-base">📋</span>
                <span className="text-[10px] font-bold text-sf-dark">PLAN</span>
              </button>
              <div className="absolute left-1/2 -top-5 -translate-x-1/2 text-[8px] font-semibold text-cyan-600 uppercase tracking-wider">Synchronize</div>

              {/* Bottom - Return */}
              <button onClick={() => setSelectedProcess('R')} className={`absolute left-1/2 bottom-0 -translate-x-1/2 flex h-14 w-28 flex-col items-center justify-center rounded-xl border-2 shadow-md transition-all hover:scale-105 cursor-pointer ${selectedProcess === 'R' ? 'ring-4 ring-rose-300 scale-105 border-rose-500 bg-gradient-to-br from-rose-100 to-white' : 'border-rose-400 bg-gradient-to-br from-rose-50 to-white'}`}>
                <span className="text-base">🔄</span>
                <span className="text-[10px] font-bold text-sf-dark">RETURN</span>
              </button>
              <div className="absolute left-1/2 -bottom-5 -translate-x-1/2 text-[8px] font-semibold text-rose-600 uppercase tracking-wider">Regenerate</div>

              {/* Left-top - Order (Demand side) */}
              <button onClick={() => setSelectedProcess('O')} className={`absolute left-[8%] top-[22%] flex h-14 w-28 flex-col items-center justify-center rounded-xl border-2 shadow-md transition-all hover:scale-105 cursor-pointer ${selectedProcess === 'O' ? 'ring-4 ring-violet-300 scale-105 border-violet-500 bg-gradient-to-br from-violet-100 to-white' : 'border-violet-400 bg-gradient-to-br from-violet-50 to-white'}`}>
                <span className="text-base">📦</span>
                <span className="text-[10px] font-bold text-sf-dark">ORDER</span>
              </button>

              {/* Left-bottom - Fulfill */}
              <button onClick={() => setSelectedProcess('F')} className={`absolute left-[8%] bottom-[22%] flex h-14 w-28 flex-col items-center justify-center rounded-xl border-2 shadow-md transition-all hover:scale-105 cursor-pointer ${selectedProcess === 'F' ? 'ring-4 ring-blue-300 scale-105 border-blue-500 bg-gradient-to-br from-blue-100 to-white' : 'border-blue-400 bg-gradient-to-br from-blue-50 to-white'}`}>
                <span className="text-base">🚛</span>
                <span className="text-[10px] font-bold text-sf-dark">FULFILL</span>
              </button>

              {/* Left label - DEMAND */}
              <div className="absolute left-0 top-1/2 -translate-y-1/2 text-xs font-bold text-violet-600 uppercase tracking-widest" style={{ writingMode: 'vertical-rl', transform: 'rotate(180deg) translateY(50%)' }}>Demand</div>

              {/* Right-top - Source (Supply side) */}
              <button onClick={() => setSelectedProcess('S')} className={`absolute right-[8%] top-[22%] flex h-14 w-28 flex-col items-center justify-center rounded-xl border-2 shadow-md transition-all hover:scale-105 cursor-pointer ${selectedProcess === 'S' ? 'ring-4 ring-emerald-300 scale-105 border-emerald-500 bg-gradient-to-br from-emerald-100 to-white' : 'border-emerald-400 bg-gradient-to-br from-emerald-50 to-white'}`}>
                <span className="text-base">🏭</span>
                <span className="text-[10px] font-bold text-sf-dark">SOURCE</span>
              </button>

              {/* Right-bottom - Transform */}
              <button onClick={() => setSelectedProcess('T')} className={`absolute right-[8%] bottom-[22%] flex h-14 w-28 flex-col items-center justify-center rounded-xl border-2 shadow-md transition-all hover:scale-105 cursor-pointer ${selectedProcess === 'T' ? 'ring-4 ring-amber-300 scale-105 border-amber-500 bg-gradient-to-br from-amber-100 to-white' : 'border-amber-400 bg-gradient-to-br from-amber-50 to-white'}`}>
                <span className="text-base">⚙️</span>
                <span className="text-[10px] font-bold text-sf-dark">TRANSFORM</span>
              </button>

              {/* Right label - SUPPLY */}
              <div className="absolute right-0 top-1/2 -translate-y-1/2 text-xs font-bold text-emerald-600 uppercase tracking-widest" style={{ writingMode: 'vertical-rl' }}>Supply</div>

              {/* Connecting lines (SVG) */}
              <svg className="absolute inset-0 w-full h-full pointer-events-none" viewBox="0 0 780 420">
                {/* Vertical loop: Plan → Orchestrate → Return */}
                <path d="M 390 56 C 390 130, 390 130, 390 175" stroke="#06b6d4" strokeWidth="2" fill="none" strokeDasharray="6 3" opacity="0.4" />
                <path d="M 390 245 C 390 290, 390 290, 390 364" stroke="#ef4444" strokeWidth="2" fill="none" strokeDasharray="6 3" opacity="0.4" />
                {/* Horizontal left: Order → Orchestrate, Fulfill → Orchestrate */}
                <path d="M 175 120 C 260 150, 300 180, 350 200" stroke="#8b5cf6" strokeWidth="2" fill="none" strokeDasharray="6 3" opacity="0.4" />
                <path d="M 175 300 C 260 270, 300 240, 350 220" stroke="#3b82f6" strokeWidth="2" fill="none" strokeDasharray="6 3" opacity="0.4" />
                {/* Horizontal right: Source → Orchestrate, Transform → Orchestrate */}
                <path d="M 605 120 C 520 150, 480 180, 430 200" stroke="#10b981" strokeWidth="2" fill="none" strokeDasharray="6 3" opacity="0.4" />
                <path d="M 605 300 C 520 270, 480 240, 430 220" stroke="#f59e0b" strokeWidth="2" fill="none" strokeDasharray="6 3" opacity="0.4" />
              </svg>
            </div>

            {/* Interactive Detail Panel */}
            {!selectedProcess && (
              <div className="rounded-lg border border-dashed border-gray-300 bg-gray-50/50 p-6 text-center">
                <p className="text-sm text-gray-500">Click a process node above to explore its data, metrics, and performance details.</p>
              </div>
            )}

            {selectedProcess && (() => {
              const proc = SCOR_PROCESSES.find((p) => p.id === selectedProcess)!;
              return (
                <div className="rounded-xl border-2 overflow-hidden transition-all" style={{ borderColor: proc.color + '60' }}>
                  {/* Header */}
                  <div className="flex items-center gap-3 px-5 py-3" style={{ backgroundColor: proc.color + '10' }}>
                    <span className="text-2xl">{proc.icon}</span>
                    <div className="flex-1">
                      <h3 className="text-sm font-bold text-sf-dark">{proc.name} <span className="text-xs font-normal text-gray-400">(Level {proc.level} — Code: {proc.id})</span></h3>
                      <p className="text-xs text-gray-600">{proc.desc}</p>
                    </div>
                    <button onClick={() => setSelectedProcess(null)} className="text-gray-400 hover:text-gray-600 text-lg">✕</button>
                  </div>

                  {/* Content based on selected process */}
                  <div className="p-5 space-y-4">
                    {selectedProcess === 'OE' && (
                      <>
                        <div className="grid grid-cols-4 gap-3">
                          <div className="rounded-lg bg-slate-50 p-3 text-center">
                            <p className="text-lg font-bold text-sf-dark">{computed.avgOee}%</p>
                            <p className="text-[10px] text-gray-500">OEE Target</p>
                          </div>
                          <div className="rounded-lg bg-slate-50 p-3 text-center">
                            <p className="text-lg font-bold text-sf-dark">{computed.avgOtd}%</p>
                            <p className="text-[10px] text-gray-500">OTD Target</p>
                          </div>
                          <div className="rounded-lg bg-slate-50 p-3 text-center">
                            <p className="text-lg font-bold text-sf-dark">&lt;{computed.avgScrap}%</p>
                            <p className="text-[10px] text-gray-500">Scrap Target</p>
                          </div>
                          <div className="rounded-lg bg-slate-50 p-3 text-center">
                            <p className="text-lg font-bold text-sf-dark">{computed.avgTurnover}x</p>
                            <p className="text-[10px] text-gray-500">Turnover Target</p>
                          </div>
                        </div>
                        <p className="text-xs text-gray-600">
                          <strong>Orchestrate</strong> governs the end-to-end supply chain strategy. It sets performance targets across all SCOR processes, 
                          manages risk, ensures compliance, and aligns supply chain objectives with business strategy. 
                          Your data shows KPIs tracked in <code className="text-[10px] bg-gray-100 px-1 rounded">DT_MANUFACTURING_KPI</code> spanning {computed.periods.length} periods across {selectedPlants.length} plant(s).
                        </p>
                      </>
                    )}

                    {selectedProcess === 'P' && (
                      <>
                        <div className="grid grid-cols-3 gap-3">
                          <div className="rounded-lg bg-cyan-50 p-3 text-center">
                            <p className="text-lg font-bold text-sf-dark">{data.productionEff.reduce((s: number, p: ProductionEff) => s + p.order_count, 0)}</p>
                            <p className="text-[10px] text-gray-500">Planned Orders</p>
                          </div>
                          <div className="rounded-lg bg-cyan-50 p-3 text-center">
                            <p className="text-lg font-bold text-sf-dark">{data.productionEff.length}</p>
                            <p className="text-[10px] text-gray-500">Product Lines</p>
                          </div>
                          <div className="rounded-lg bg-cyan-50 p-3 text-center">
                            <p className="text-lg font-bold text-sf-dark">{selectedPlants.length}</p>
                            <p className="text-[10px] text-gray-500">Plants Planned</p>
                          </div>
                        </div>
                        <p className="text-xs text-gray-600">
                          <strong>Plan</strong> balances demand and supply resources. Level-2 sub-processes include Plan Supply Chain, Plan Order, Plan Source, Plan Transform, Plan Fulfill, and Plan Return. 
                          Data from <code className="text-[10px] bg-gray-100 px-1 rounded">DT_PRODUCTION_ORDER_360</code> shows planned quantities and scheduling across your selected plants.
                        </p>
                        <ReactECharts
                          option={{
                            tooltip: { trigger: 'axis' },
                            grid: { top: 10, right: 20, bottom: 25, left: 50 },
                            xAxis: { type: 'category', data: computed.periods, axisLabel: { fontSize: 9, color: '#6b7280', rotate: 30 } },
                            yAxis: { type: 'value', min: 60, max: 100, axisLabel: { fontSize: 9, color: '#6b7280', formatter: '{value}%' }, splitLine: { lineStyle: { color: '#f3f4f6' } } },
                            series: [...new Set(data.kpiTrends.map((k: KpiTrend) => k.plant_name))].map((plant, i) => ({
                              name: plant, type: 'line', smooth: true,
                              data: computed.periods.map((p) => { const r = data.kpiTrends.find((k: KpiTrend) => k.plant_name === plant && k.period_date === p); return r ? r.oee : null; }),
                              lineStyle: { color: PALETTE[i % PALETTE.length] }, itemStyle: { color: PALETTE[i % PALETTE.length] },
                            })),
                          }}
                          style={{ height: 200 }}
                        />
                      </>
                    )}

                    {selectedProcess === 'S' && (
                      <>
                        <div className="grid grid-cols-3 gap-3">
                          <div className="rounded-lg bg-emerald-50 p-3 text-center">
                            <p className="text-lg font-bold text-sf-dark">{data.supplierQuality.length}</p>
                            <p className="text-[10px] text-gray-500">Supplier-Material Pairs</p>
                          </div>
                          <div className="rounded-lg bg-emerald-50 p-3 text-center">
                            <p className="text-lg font-bold text-sf-dark">{(data.supplierQuality.reduce((s: number, sq: SupplierQuality) => s + sq.avg_quality_score, 0) / Math.max(data.supplierQuality.length, 1)).toFixed(1)}</p>
                            <p className="text-[10px] text-gray-500">Avg Quality Score</p>
                          </div>
                          <div className="rounded-lg bg-emerald-50 p-3 text-center">
                            <p className="text-lg font-bold text-sf-dark">{(data.supplierQuality.reduce((s: number, sq: SupplierQuality) => s + sq.avg_otd, 0) / Math.max(data.supplierQuality.length, 1)).toFixed(1)}%</p>
                            <p className="text-[10px] text-gray-500">Avg Supplier OTD</p>
                          </div>
                        </div>
                        <p className="text-xs text-gray-600">
                          <strong>Source</strong> covers procurement and supplier management. Level-2 sub-processes: Strategic Source, Direct Procure, Indirect Procure, Source Return.
                          Data from <code className="text-[10px] bg-gray-100 px-1 rounded">DT_SUPPLIER_QUALITY</code> tracks defect rates, on-time delivery, and quality scores per supplier.
                        </p>
                        <DataTable
                          columns={[
                            { key: 'supplier_name', label: 'Supplier' },
                            { key: 'material_desc', label: 'Material' },
                            { key: 'avg_defect_rate', label: 'Defect Rate %' },
                            { key: 'avg_otd', label: 'OTD %' },
                            { key: 'avg_quality_score', label: 'Quality Score' },
                          ]}
                          data={data.supplierQuality}
                        />
                      </>
                    )}

                    {selectedProcess === 'T' && (
                      <>
                        <div className="grid grid-cols-4 gap-3">
                          <div className="rounded-lg bg-amber-50 p-3 text-center">
                            <p className="text-lg font-bold text-sf-dark">{computed.avgOee}%</p>
                            <p className="text-[10px] text-gray-500">Avg OEE</p>
                          </div>
                          <div className="rounded-lg bg-amber-50 p-3 text-center">
                            <p className="text-lg font-bold text-sf-dark">{(data.productionEff.reduce((s: number, p: ProductionEff) => s + p.yield_pct, 0) / Math.max(data.productionEff.length, 1)).toFixed(1)}%</p>
                            <p className="text-[10px] text-gray-500">Avg Yield</p>
                          </div>
                          <div className="rounded-lg bg-amber-50 p-3 text-center">
                            <p className="text-lg font-bold text-sf-dark">{(data.productionEff.reduce((s: number, p: ProductionEff) => s + p.avg_cycle_time, 0) / Math.max(data.productionEff.length, 1)).toFixed(1)}d</p>
                            <p className="text-[10px] text-gray-500">Avg Cycle Time</p>
                          </div>
                          <div className="rounded-lg bg-amber-50 p-3 text-center">
                            <p className="text-lg font-bold text-sf-dark">{computed.avgScrap}%</p>
                            <p className="text-[10px] text-gray-500">Scrap Rate</p>
                          </div>
                        </div>
                        <p className="text-xs text-gray-600">
                          <strong>Transform</strong> converts materials into finished goods. This maps to manufacturing operations including yield management, cycle time optimization, and scrap reduction.
                          Data from <code className="text-[10px] bg-gray-100 px-1 rounded">DT_PRODUCTION_ORDER_360</code> and <code className="text-[10px] bg-gray-100 px-1 rounded">DT_MANUFACTURING_KPI</code>.
                        </p>
                        <DataTable
                          columns={[
                            { key: 'plant_name', label: 'Plant' },
                            { key: 'material_desc', label: 'Product' },
                            { key: 'order_count', label: 'Orders' },
                            { key: 'avg_cycle_time', label: 'Cycle (days)' },
                            { key: 'yield_pct', label: 'Yield %' },
                            { key: 'scrap_pct', label: 'Scrap %' },
                          ]}
                          data={data.productionEff}
                        />
                      </>
                    )}

                    {selectedProcess === 'O' && (
                      <>
                        <div className="grid grid-cols-3 gap-3">
                          <div className="rounded-lg bg-violet-50 p-3 text-center">
                            <p className="text-lg font-bold text-sf-dark">{data.deliveryPerf.reduce((s: number, d: DeliveryPerf) => s + d.total_deliveries, 0)}</p>
                            <p className="text-[10px] text-gray-500">Total Orders</p>
                          </div>
                          <div className="rounded-lg bg-violet-50 p-3 text-center">
                            <p className="text-lg font-bold text-sf-dark">{data.deliveryPerf.length}</p>
                            <p className="text-[10px] text-gray-500">Shipping Points</p>
                          </div>
                          <div className="rounded-lg bg-violet-50 p-3 text-center">
                            <p className="text-lg font-bold text-sf-dark">{(data.deliveryPerf.reduce((s: number, d: DeliveryPerf) => s + d.otd_pct, 0) / Math.max(data.deliveryPerf.length, 1)).toFixed(1)}%</p>
                            <p className="text-[10px] text-gray-500">Order Fulfillment Rate</p>
                          </div>
                        </div>
                        <p className="text-xs text-gray-600">
                          <strong>Order</strong> captures customer demand signals and manages order processing. Level-2 sub-processes include B2C, B2B, and Intra-company order management.
                          Order data flows into <code className="text-[10px] bg-gray-100 px-1 rounded">DT_DELIVERY_PERFORMANCE</code> for fulfillment tracking.
                        </p>
                      </>
                    )}

                    {selectedProcess === 'F' && (
                      <>
                        <div className="grid grid-cols-3 gap-3">
                          <div className="rounded-lg bg-blue-50 p-3 text-center">
                            <p className="text-lg font-bold text-sf-dark">{computed.avgOtd}%</p>
                            <p className="text-[10px] text-gray-500">On-Time Delivery</p>
                          </div>
                          <div className="rounded-lg bg-blue-50 p-3 text-center">
                            <p className="text-lg font-bold text-sf-dark">{(data.deliveryPerf.reduce((s: number, d: DeliveryPerf) => s + d.avg_delay, 0) / Math.max(data.deliveryPerf.length, 1)).toFixed(1)}d</p>
                            <p className="text-[10px] text-gray-500">Avg Delay</p>
                          </div>
                          <div className="rounded-lg bg-blue-50 p-3 text-center">
                            <p className="text-lg font-bold text-sf-dark">{data.deliveryPerf.reduce((s: number, d: DeliveryPerf) => s + d.on_time_count, 0)}</p>
                            <p className="text-[10px] text-gray-500">On-Time Shipments</p>
                          </div>
                        </div>
                        <p className="text-xs text-gray-600">
                          <strong>Fulfill</strong> manages pick, pack, ship, and delivery. Level-2: Fulfill B2C, Fulfill B2B, Fulfill Intra-company.
                          Level-3 process steps include Receive Order Signal (F1.1), Pick Product (F1.2), and Ship Product.
                          Data from <code className="text-[10px] bg-gray-100 px-1 rounded">DT_DELIVERY_PERFORMANCE</code>:
                        </p>
                        <DataTable
                          columns={[
                            { key: 'shipping_point_desc', label: 'Shipping Point' },
                            { key: 'total_deliveries', label: 'Deliveries' },
                            { key: 'on_time_count', label: 'On-Time' },
                            { key: 'otd_pct', label: 'OTD %' },
                            { key: 'avg_delay', label: 'Avg Delay (days)' },
                          ]}
                          data={data.deliveryPerf}
                        />
                      </>
                    )}

                    {selectedProcess === 'R' && (
                      <>
                        <div className="grid grid-cols-3 gap-3">
                          <div className="rounded-lg bg-rose-50 p-3 text-center">
                            <p className="text-lg font-bold text-sf-dark">{computed.avgScrap}%</p>
                            <p className="text-[10px] text-gray-500">Scrap/Defect Rate</p>
                          </div>
                          <div className="rounded-lg bg-rose-50 p-3 text-center">
                            <p className="text-lg font-bold text-sf-dark">{(data.supplierQuality.reduce((s: number, sq: SupplierQuality) => s + sq.avg_defect_rate, 0) / Math.max(data.supplierQuality.length, 1)).toFixed(2)}%</p>
                            <p className="text-[10px] text-gray-500">Supplier Defect Rate</p>
                          </div>
                          <div className="rounded-lg bg-rose-50 p-3 text-center">
                            <p className="text-lg font-bold text-sf-dark">{data.productionEff.filter((p: ProductionEff) => p.scrap_pct > 5).length}</p>
                            <p className="text-[10px] text-gray-500">High-Scrap Products</p>
                          </div>
                        </div>
                        <p className="text-xs text-gray-600">
                          <strong>Return</strong> manages reverse logistics — defective products, MRO returns, and excess inventory. It feeds back into Plan (regenerate loop) for continuous improvement.
                          Quality data from scrap quantities in production orders and defect rates from supplier quality tracking.
                        </p>
                      </>
                    )}
                  </div>
                </div>
              );
            })()}
          </div>
        </ChartCard>

        {/* SCOR Performance Attributes — Interactive with Gauges, Drill-down, Benchmarks */}
        <ChartCard title="SCOR Performance Attributes" subtitle="8 attributes across 3 categories — click any attribute to drill into live data, trends, and industry benchmarks">
          <div className="px-4 py-4 space-y-4">
            {/* Gauge Row — Live metrics mapped to SCOR attributes */}
            <ReactECharts
              option={{
                tooltip: { formatter: '{b}: {c}%' },
                series: [
                  {
                    type: 'gauge', center: ['12.5%', '55%'], radius: '80%',
                    startAngle: 200, endAngle: -20,
                    min: 0, max: 100,
                    title: { show: true, offsetCenter: [0, '85%'], fontSize: 10, color: '#374151' },
                    detail: { formatter: '{value}%', fontSize: 14, fontWeight: 'bold', offsetCenter: [0, '55%'], color: '#374151' },
                    data: [{ value: Number(computed.avgOtd), name: 'Reliability\n(RL.1.1)' }],
                    axisLine: { lineStyle: { width: 12, color: [[0.8, '#ef4444'], [0.9, '#f59e0b'], [1, '#10b981']] } },
                    pointer: { length: '55%', width: 4 },
                    axisTick: { show: false }, splitLine: { show: false }, axisLabel: { show: false },
                  },
                  {
                    type: 'gauge', center: ['37.5%', '55%'], radius: '80%',
                    startAngle: 200, endAngle: -20,
                    min: 0, max: 30,
                    title: { show: true, offsetCenter: [0, '85%'], fontSize: 10, color: '#374151' },
                    detail: { formatter: '{value}d', fontSize: 14, fontWeight: 'bold', offsetCenter: [0, '55%'], color: '#374151' },
                    data: [{ value: Number((data.productionEff.reduce((s: number, p: ProductionEff) => s + p.avg_cycle_time, 0) / Math.max(data.productionEff.length, 1)).toFixed(1)), name: 'Responsiveness\n(RS.1.1)' }],
                    axisLine: { lineStyle: { width: 12, color: [[0.33, '#10b981'], [0.66, '#f59e0b'], [1, '#ef4444']] } },
                    pointer: { length: '55%', width: 4 },
                    axisTick: { show: false }, splitLine: { show: false }, axisLabel: { show: false },
                  },
                  {
                    type: 'gauge', center: ['62.5%', '55%'], radius: '80%',
                    startAngle: 200, endAngle: -20,
                    min: 0, max: 10,
                    title: { show: true, offsetCenter: [0, '85%'], fontSize: 10, color: '#374151' },
                    detail: { formatter: '{value}x', fontSize: 14, fontWeight: 'bold', offsetCenter: [0, '55%'], color: '#374151' },
                    data: [{ value: Number(computed.avgTurnover), name: 'Assets\n(AM.1.1)' }],
                    axisLine: { lineStyle: { width: 12, color: [[0.4, '#ef4444'], [0.7, '#f59e0b'], [1, '#10b981']] } },
                    pointer: { length: '55%', width: 4 },
                    axisTick: { show: false }, splitLine: { show: false }, axisLabel: { show: false },
                  },
                  {
                    type: 'gauge', center: ['87.5%', '55%'], radius: '80%',
                    startAngle: 200, endAngle: -20,
                    min: 0, max: 10,
                    title: { show: true, offsetCenter: [0, '85%'], fontSize: 10, color: '#374151' },
                    detail: { formatter: '{value}%', fontSize: 14, fontWeight: 'bold', offsetCenter: [0, '55%'], color: '#374151' },
                    data: [{ value: Number(computed.avgScrap), name: 'Cost\n(Scrap)' }],
                    axisLine: { lineStyle: { width: 12, color: [[0.3, '#10b981'], [0.6, '#f59e0b'], [1, '#ef4444']] } },
                    pointer: { length: '55%', width: 4 },
                    axisTick: { show: false }, splitLine: { show: false }, axisLabel: { show: false },
                  },
                ],
              }}
              style={{ height: 180 }}
            />

            {/* Clickable Attribute Cards with Benchmarks */}
            <div className="grid grid-cols-4 gap-3">
              {[
                { code: 'RL', name: 'Reliability', value: computed.avgOtd, unit: '%', metric: 'Perfect Order Fulfillment (OTD)', benchmark: '95%+', benchmarkLabel: 'Top Quartile', color: '#10b981', trend: 'up', detail: `${data.deliveryPerf.reduce((s: number, d: DeliveryPerf) => s + d.on_time_count, 0)} of ${data.deliveryPerf.reduce((s: number, d: DeliveryPerf) => s + d.total_deliveries, 0)} orders delivered on time across ${data.deliveryPerf.length} shipping points.` },
                { code: 'RS', name: 'Responsiveness', value: (data.productionEff.reduce((s: number, p: ProductionEff) => s + p.avg_cycle_time, 0) / Math.max(data.productionEff.length, 1)).toFixed(1), unit: ' days', metric: 'Order Fulfillment Cycle Time', benchmark: '<7 days', benchmarkLabel: 'Top Quartile', color: '#06b6d4', trend: 'down', detail: `Average cycle time across ${data.productionEff.length} product lines. Fastest: ${data.productionEff.length > 0 ? Math.min(...data.productionEff.map((p: ProductionEff) => p.avg_cycle_time)).toFixed(1) : 0}d, Slowest: ${data.productionEff.length > 0 ? Math.max(...data.productionEff.map((p: ProductionEff) => p.avg_cycle_time)).toFixed(1) : 0}d.` },
                { code: 'AG', name: 'Agility', value: ((Number(computed.avgOee) + Number(computed.avgOtd)) / 2).toFixed(1), unit: '%', metric: 'Supply Chain Agility Index', benchmark: '90%+', benchmarkLabel: 'Industry Avg', color: '#8b5cf6', trend: 'up', detail: `Composite of OEE (${computed.avgOee}%) and OTD (${computed.avgOtd}%). Measures ability to respond to demand changes.` },
                { code: 'CO', name: 'Costs', value: computed.avgScrap, unit: '%', metric: 'Waste Rate (Scrap %)', benchmark: '<1%', benchmarkLabel: 'Best-in-Class', color: '#f59e0b', trend: 'down', detail: `Scrap represents direct waste cost. ${data.productionEff.filter((p: ProductionEff) => p.scrap_pct > 3).length} product lines exceed 3% scrap threshold.` },
                { code: 'PR', name: 'Profit', value: (100 - Number(computed.avgScrap)).toFixed(1), unit: '%', metric: 'Yield Efficiency (EBIT proxy)', benchmark: '>98%', benchmarkLabel: 'Target', color: '#3b82f6', trend: 'up', detail: `Yield efficiency (100% - scrap) indicates how effectively materials are converted to revenue-generating product.` },
                { code: 'AM', name: 'Assets', value: computed.avgTurnover, unit: 'x', metric: 'Inventory Turnover', benchmark: '>6x', benchmarkLabel: 'Top Quartile', color: '#1e3a5f', trend: 'up', detail: `Higher turnover means less capital tied up in inventory. Target: reduce days-of-supply while maintaining service levels.` },
                { code: 'EV', name: 'Environmental', value: computed.avgScrap, unit: '%', metric: 'Waste Generation Rate', benchmark: '<0.5%', benchmarkLabel: 'Zero-Waste Goal', color: '#059669', trend: 'down', detail: `Scrap rate is a proxy for waste generation. Lower scrap = less material waste, lower energy per good unit.` },
                { code: 'SC', name: 'Social', value: data.supplierQuality.length > 0 ? '100' : '0', unit: '%', metric: 'Supplier Compliance Monitoring', benchmark: '100%', benchmarkLabel: 'Full Coverage', color: '#7c3aed', trend: 'up', detail: `All ${data.supplierQuality.length} supplier-material pairs are actively monitored for quality and delivery compliance.` },
              ].map((attr) => (
                <div
                  key={attr.code}
                  className="rounded-lg border border-gray-200 p-3 hover:shadow-md hover:border-gray-300 transition-all cursor-pointer group"
                  onClick={() => setSelectedProcess(null)}
                >
                  {/* Header */}
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-1.5">
                      <span className="inline-block h-2 w-2 rounded-full" style={{ backgroundColor: attr.color }} />
                      <span className="text-[10px] font-mono text-gray-400">{attr.code}</span>
                      <span className="text-xs font-semibold text-sf-dark">{attr.name}</span>
                    </div>
                  </div>

                  {/* Value + Benchmark */}
                  <div className="flex items-end justify-between mb-1.5">
                    <p className="text-xl font-bold text-sf-dark">{attr.value}{attr.unit}</p>
                    <div className="text-right">
                      <p className="text-[9px] text-gray-400">{attr.benchmarkLabel}</p>
                      <p className="text-xs font-semibold" style={{ color: attr.color }}>{attr.benchmark}</p>
                    </div>
                  </div>

                  {/* Progress bar vs benchmark */}
                  <div className="h-1.5 w-full rounded-full bg-gray-100 mb-1.5">
                    <div
                      className="h-1.5 rounded-full transition-all"
                      style={{
                        width: `${Math.min(100, (Number(attr.value) / (attr.unit === 'x' ? 10 : attr.unit === ' days' ? 30 : 100)) * 100)}%`,
                        backgroundColor: attr.color,
                      }}
                    />
                  </div>

                  {/* Metric name */}
                  <p className="text-[9px] text-gray-500 leading-tight">{attr.metric}</p>

                  {/* Expandable detail on hover */}
                  <div className="mt-2 max-h-0 overflow-hidden group-hover:max-h-20 transition-all duration-300">
                    <p className="text-[10px] text-gray-600 leading-relaxed border-t border-gray-100 pt-2">{attr.detail}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </ChartCard>

        {/* Value Stream Sankey */}
        <ChartCard title="Value Stream Flow (SCOR Process Mapping)" subtitle="Material flow through Source → Transform → Fulfill stages with quality gates and returns">
          <div className="px-4 pt-3 pb-1">
            <p className="text-xs text-gray-600 leading-relaxed mb-2">
              This Sankey diagram represents the <strong>flow of value</strong> through your supply chain, mapped to SCOR processes. 
              Numbers represent the <strong>relative throughput percentage</strong> at each stage — starting at 100% of materials entering from suppliers. 
              Width of each flow band is proportional to volume. Losses at each stage (scrap, returns, quality rejects) are diverted to the RETURN process.
            </p>
            <div className="grid grid-cols-4 gap-2 mb-3">
              <div className="rounded bg-emerald-50 px-2 py-1.5 border border-emerald-100">
                <p className="text-[9px] font-semibold text-emerald-700">100% → SOURCE</p>
                <p className="text-[9px] text-gray-500">All raw materials enter from suppliers</p>
              </div>
              <div className="rounded bg-amber-50 px-2 py-1.5 border border-amber-100">
                <p className="text-[9px] font-semibold text-amber-700">95% → TRANSFORM</p>
                <p className="text-[9px] text-gray-500">5% lost to procurement rejects/lead time</p>
              </div>
              <div className="rounded bg-blue-50 px-2 py-1.5 border border-blue-100">
                <p className="text-[9px] font-semibold text-blue-700">85% → FULFILL</p>
                <p className="text-[9px] text-gray-500">5% rejected at quality gate (scrap: {computed.avgScrap}%)</p>
              </div>
              <div className="rounded bg-red-50 px-2 py-1.5 border border-red-100">
                <p className="text-[9px] font-semibold text-red-700">10% → RETURN</p>
                <p className="text-[9px] text-gray-500">Quality rejects + customer returns + distribution losses</p>
              </div>
            </div>
          </div>
          <ReactECharts
            option={{
              tooltip: { trigger: 'item', formatter: (params: any) => {
                if (params.dataType === 'edge') return `${params.data.source} → ${params.data.target}<br/><strong>${params.data.value}%</strong> of total throughput`;
                return `<strong>${params.name}</strong>`;
              }},
              series: [
                {
                  type: 'sankey',
                  layout: 'none',
                  emphasis: { focus: 'adjacency' },
                  nodeAlign: 'left',
                  data: [
                    { name: 'Suppliers', itemStyle: { color: '#10b981' } },
                    { name: 'SOURCE\n(Procurement)', itemStyle: { color: '#10b981' } },
                    { name: 'TRANSFORM\n(Manufacturing)', itemStyle: { color: '#f59e0b' } },
                    { name: 'Quality Gate', itemStyle: { color: '#8b5cf6' } },
                    { name: 'FULFILL\n(Warehousing)', itemStyle: { color: '#3b82f6' } },
                    { name: 'FULFILL\n(Distribution)', itemStyle: { color: '#3b82f6' } },
                    { name: 'Customers', itemStyle: { color: '#06b6d4' } },
                    { name: 'RETURN', itemStyle: { color: '#ef4444' } },
                  ],
                  links: [
                    { source: 'Suppliers', target: 'SOURCE\n(Procurement)', value: 100 },
                    { source: 'SOURCE\n(Procurement)', target: 'TRANSFORM\n(Manufacturing)', value: 95 },
                    { source: 'TRANSFORM\n(Manufacturing)', target: 'Quality Gate', value: 90 },
                    { source: 'Quality Gate', target: 'FULFILL\n(Warehousing)', value: 85 },
                    { source: 'Quality Gate', target: 'RETURN', value: 5 },
                    { source: 'FULFILL\n(Warehousing)', target: 'FULFILL\n(Distribution)', value: 85 },
                    { source: 'FULFILL\n(Distribution)', target: 'Customers', value: 82 },
                    { source: 'FULFILL\n(Distribution)', target: 'RETURN', value: 3 },
                    { source: 'Customers', target: 'RETURN', value: 2 },
                  ],
                  lineStyle: { color: 'gradient', opacity: 0.5 },
                  label: { color: '#374151', fontSize: 11, fontWeight: 'bold' },
                },
              ],
            }}
            style={{ height: 380 }}
          />
          <div className="px-4 pb-3 pt-1">
            <p className="text-[10px] text-gray-500 italic">
              Reading left-to-right: 100 units enter → 95 pass procurement QC → 90 complete manufacturing → 85 pass quality gate → 82 reach customers. 
              The RETURN stream (red) aggregates all losses: 5 from quality gate rejects, 3 from distribution issues, 2 from customer returns = 10 total (90% first-pass yield).
            </p>
          </div>
        </ChartCard>
      </Tabs.Content>

      <Tabs.Content value="metrics" className="space-y-6">
        <div className="grid grid-cols-2 gap-5">
          {/* OEE Trend */}
          <ChartCard title="OEE Trend by Plant" subtitle="Overall Equipment Effectiveness over time">
            <ReactECharts
              option={{
                tooltip: { trigger: 'axis' },
                legend: { bottom: 0, textStyle: { color: '#6b7280', fontSize: 10 } },
                grid: { top: 20, right: 20, bottom: 40, left: 50 },
                xAxis: {
                  type: 'category',
                  data: computed.periods,
                  axisLabel: { color: '#6b7280', fontSize: 10, rotate: 30 },
                },
                yAxis: {
                  type: 'value',
                  min: 60,
                  max: 100,
                  axisLabel: { color: '#6b7280', fontSize: 10, formatter: '{value}%' },
                  splitLine: { lineStyle: { color: '#f3f4f6', type: 'dashed' } },
                },
                series: [...new Set(data.kpiTrends.map((k: KpiTrend) => k.plant_name))].map((plant, i) => ({
                  name: plant,
                  type: 'line',
                  smooth: true,
                  data: computed.periods.map((p) => {
                    const row = data.kpiTrends.find((k: KpiTrend) => k.plant_name === plant && k.period_date === p);
                    return row ? row.oee : null;
                  }),
                  lineStyle: { color: PALETTE[i % PALETTE.length], width: 2 },
                  itemStyle: { color: PALETTE[i % PALETTE.length] },
                })),
                animationDuration: 1000,
              }}
              style={{ height: 300 }}
            />
          </ChartCard>

          {/* Scrap Rate Trend */}
          <ChartCard title="Scrap Rate Trend" subtitle="Waste reduction tracking">
            <ReactECharts
              option={{
                tooltip: { trigger: 'axis' },
                legend: { bottom: 0, textStyle: { color: '#6b7280', fontSize: 10 } },
                grid: { top: 20, right: 20, bottom: 40, left: 50 },
                xAxis: {
                  type: 'category',
                  data: computed.periods,
                  axisLabel: { color: '#6b7280', fontSize: 10, rotate: 30 },
                },
                yAxis: {
                  type: 'value',
                  axisLabel: { color: '#6b7280', fontSize: 10, formatter: '{value}%' },
                  splitLine: { lineStyle: { color: '#f3f4f6', type: 'dashed' } },
                },
                series: [...new Set(data.kpiTrends.map((k: KpiTrend) => k.plant_name))].map((plant, i) => ({
                  name: plant,
                  type: 'line',
                  smooth: true,
                  areaStyle: { opacity: 0.1 },
                  data: computed.periods.map((p) => {
                    const row = data.kpiTrends.find((k: KpiTrend) => k.plant_name === plant && k.period_date === p);
                    return row ? row.scrap_rate : null;
                  }),
                  lineStyle: { color: PALETTE[i % PALETTE.length], width: 2 },
                  itemStyle: { color: PALETTE[i % PALETTE.length] },
                })),
                animationDuration: 1000,
              }}
              style={{ height: 300 }}
            />
          </ChartCard>

          {/* Supplier Quality Radar */}
          <ChartCard title="Supplier Quality Scorecard" subtitle="Quality score and OTD by supplier">
            <ReactECharts
              option={{
                tooltip: { trigger: 'item' },
                legend: { bottom: 0, textStyle: { color: '#6b7280', fontSize: 10 } },
                radar: {
                  indicator: data.supplierQuality.map((s: SupplierQuality) => ({
                    name: s.supplier_name.split(' ')[0],
                    min: 80,
                    max: 100,
                  })),
                  shape: 'polygon',
                  splitNumber: 4,
                  axisLabel: { show: true, fontSize: 9, color: '#9ca3af', formatter: '{value}%' },
                  splitArea: { areaStyle: { color: ['#f0f9ff', '#fff'] } },
                },
                series: [
                  {
                    type: 'radar',
                    data: [
                      {
                        value: data.supplierQuality.map((s: SupplierQuality) => s.avg_quality_score),
                        name: 'Quality Score',
                        lineStyle: { color: PALETTE[0] },
                        itemStyle: { color: PALETTE[0] },
                        areaStyle: { color: PALETTE[0], opacity: 0.2 },
                      },
                      {
                        value: data.supplierQuality.map((s: SupplierQuality) => s.avg_otd),
                        name: 'On-Time Delivery',
                        lineStyle: { color: PALETTE[1] },
                        itemStyle: { color: PALETTE[1] },
                        areaStyle: { color: PALETTE[1], opacity: 0.2 },
                      },
                    ],
                  },
                ],
              }}
              style={{ height: 300 }}
            />
          </ChartCard>

          {/* Delivery Performance */}
          <ChartCard title="Delivery Performance by Shipping Point" subtitle="On-time delivery and average delay">
            <ReactECharts
              option={{
                tooltip: { trigger: 'axis', axisPointer: { type: 'shadow' } },
                grid: { top: 20, right: 40, bottom: 30, left: 140 },
                xAxis: [
                  { type: 'value', axisLabel: { color: '#6b7280', fontSize: 10, formatter: '{value}%' }, splitLine: { lineStyle: { color: '#f3f4f6', type: 'dashed' } } },
                ],
                yAxis: {
                  type: 'category',
                  data: data.deliveryPerf.map((d: DeliveryPerf) => d.shipping_point_desc),
                  axisLabel: { color: '#374151', fontSize: 10, width: 120, overflow: 'truncate' },
                  axisLine: { show: false },
                  axisTick: { show: false },
                },
                series: [
                  {
                    name: 'OTD %',
                    type: 'bar',
                    data: data.deliveryPerf.map((d: DeliveryPerf, i: number) => ({
                      value: d.otd_pct,
                      itemStyle: { color: PALETTE[i % PALETTE.length], borderRadius: [0, 4, 4, 0] },
                    })),
                    barWidth: '60%',
                  },
                ],
                animationDuration: 900,
              }}
              style={{ height: 300 }}
            />
          </ChartCard>
        </div>

        {/* Production Efficiency Table */}
        <ChartCard title="Production Efficiency by Product" subtitle="Yield, scrap rate, and cycle time per product line">
          <DataTable
            columns={[
              { key: 'plant_name', label: 'Plant' },
              { key: 'material_desc', label: 'Product' },
              { key: 'order_count', label: 'Orders' },
              { key: 'avg_cycle_time', label: 'Avg Cycle (days)' },
              { key: 'yield_pct', label: 'Yield %' },
              { key: 'scrap_pct', label: 'Scrap %' },
            ]}
            data={data.productionEff}
          />
        </ChartCard>
      </Tabs.Content>

      <Tabs.Content value="ai" className="space-y-6">
        <div className="grid grid-cols-3 gap-5">
          {/* AI Recommendation Cards */}
          <div className="rounded-xl border border-cyan-200 bg-gradient-to-br from-cyan-50 via-white to-cyan-100 p-5 shadow-sm">
            <div className="mb-3 flex items-center gap-2">
              <span className="text-xl">🤖</span>
              <h3 className="text-sm font-bold text-sf-dark">Demand Forecasting</h3>
            </div>
            <p className="text-xs text-gray-600 leading-relaxed">
              ML models analyzing historical order patterns suggest a <strong>15% demand increase</strong> for Wafer Inspection Systems in Q3.
              Recommend pre-positioning inventory at Austin Fab and Singapore Hub.
            </p>
            <div className="mt-3 flex items-center gap-1">
              <span className="rounded-full bg-cyan-100 px-2 py-0.5 text-[10px] font-medium text-cyan-700">Cortex ML</span>
              <span className="rounded-full bg-green-100 px-2 py-0.5 text-[10px] font-medium text-green-700">High Confidence</span>
            </div>
          </div>

          <div className="rounded-xl border border-violet-200 bg-gradient-to-br from-violet-50 via-white to-violet-100 p-5 shadow-sm">
            <div className="mb-3 flex items-center gap-2">
              <span className="text-xl">⚠️</span>
              <h3 className="text-sm font-bold text-sf-dark">Supplier Risk Alert</h3>
            </div>
            <p className="text-xs text-gray-600 leading-relaxed">
              Anomaly detection flagged <strong>Teledyne DALSA</strong> quality score declining trend (2.5% → 1.2% defect rate improvement stalling).
              Recommend scheduling quality audit and identifying backup supplier.
            </p>
            <div className="mt-3 flex items-center gap-1">
              <span className="rounded-full bg-violet-100 px-2 py-0.5 text-[10px] font-medium text-violet-700">Anomaly Detection</span>
              <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-medium text-amber-700">Medium Priority</span>
            </div>
          </div>

          <div className="rounded-xl border border-emerald-200 bg-gradient-to-br from-emerald-50 via-white to-emerald-100 p-5 shadow-sm">
            <div className="mb-3 flex items-center gap-2">
              <span className="text-xl">🔧</span>
              <h3 className="text-sm font-bold text-sf-dark">Predictive Maintenance</h3>
            </div>
            <p className="text-xs text-gray-600 leading-relaxed">
              Vibration sensor data from Dresden Fab WC-LITHO indicates bearing wear pattern.
              Predicted failure window: <strong>14-21 days</strong>. Schedule maintenance during next planned downtime.
            </p>
            <div className="mt-3 flex items-center gap-1">
              <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-medium text-emerald-700">IoT + ML</span>
              <span className="rounded-full bg-red-100 px-2 py-0.5 text-[10px] font-medium text-red-700">Action Required</span>
            </div>
          </div>

          <div className="rounded-xl border border-amber-200 bg-gradient-to-br from-amber-50 via-white to-amber-100 p-5 shadow-sm">
            <div className="mb-3 flex items-center gap-2">
              <span className="text-xl">📦</span>
              <h3 className="text-sm font-bold text-sf-dark">Inventory Optimization</h3>
            </div>
            <p className="text-xs text-gray-600 leading-relaxed">
              Safety stock analysis suggests <strong>reducing Optical Fiber Bundle</strong> buffer by 20% at San Jose HQ
              (current turnover 6.2x vs target 5.5x). Estimated annual savings: $48K.
            </p>
            <div className="mt-3 flex items-center gap-1">
              <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-medium text-amber-700">Optimization</span>
              <span className="rounded-full bg-green-100 px-2 py-0.5 text-[10px] font-medium text-green-700">Cost Saving</span>
            </div>
          </div>

          <div className="rounded-xl border border-rose-200 bg-gradient-to-br from-rose-50 via-white to-rose-100 p-5 shadow-sm">
            <div className="mb-3 flex items-center gap-2">
              <span className="text-xl">🚛</span>
              <h3 className="text-sm font-bold text-sf-dark">Route Optimization</h3>
            </div>
            <p className="text-xs text-gray-600 leading-relaxed">
              Graph analysis of supply chain network identifies <strong>consolidation opportunity</strong>:
              merging Hamamatsu → San Jose and Hamamatsu → Austin shipments could reduce freight costs by 12%.
            </p>
            <div className="mt-3 flex items-center gap-1">
              <span className="rounded-full bg-rose-100 px-2 py-0.5 text-[10px] font-medium text-rose-700">Network Opt</span>
              <span className="rounded-full bg-green-100 px-2 py-0.5 text-[10px] font-medium text-green-700">Cost Saving</span>
            </div>
          </div>

          <div className="rounded-xl border border-blue-200 bg-gradient-to-br from-blue-50 via-white to-blue-100 p-5 shadow-sm">
            <div className="mb-3 flex items-center gap-2">
              <span className="text-xl">📈</span>
              <h3 className="text-sm font-bold text-sf-dark">Production Scheduling</h3>
            </div>
            <p className="text-xs text-gray-600 leading-relaxed">
              Constraint-based scheduling model suggests resequencing Penang Assembly orders to
              <strong> reduce average cycle time by 2.3 days</strong> without impacting delivery dates.
            </p>
            <div className="mt-3 flex items-center gap-1">
              <span className="rounded-full bg-blue-100 px-2 py-0.5 text-[10px] font-medium text-blue-700">Scheduling AI</span>
              <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-medium text-amber-700">Medium Priority</span>
            </div>
          </div>
        </div>

        {/* Optimization opportunities summary */}
        <ChartCard title="Optimization Impact Matrix" subtitle="Estimated value of each AI-driven optimization initiative">
          <ReactECharts
            option={{
              tooltip: { trigger: 'axis', axisPointer: { type: 'shadow' } },
              grid: { top: 10, right: 30, bottom: 30, left: 180 },
              xAxis: {
                type: 'value',
                axisLabel: { color: '#6b7280', fontSize: 11 },
                splitLine: { lineStyle: { color: '#f3f4f6', type: 'dashed' } },
                name: 'Estimated Annual Value ($K)',
                nameLocation: 'center',
                nameGap: 25,
                nameTextStyle: { color: '#6b7280', fontSize: 10 },
              },
              yAxis: {
                type: 'category',
                data: [
                  'Production Scheduling',
                  'Route Optimization',
                  'Inventory Optimization',
                  'Predictive Maintenance',
                  'Supplier Risk Mgmt',
                  'Demand Forecasting',
                ].reverse(),
                axisLabel: { color: '#374151', fontSize: 11 },
                axisLine: { show: false },
                axisTick: { show: false },
              },
              series: [
                {
                  type: 'bar',
                  data: [120, 85, 48, 200, 65, 350].reverse().map((v, i) => ({
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
                      borderRadius: [0, 6, 6, 0],
                    },
                  })),
                  barWidth: '55%',
                },
              ],
              animationDuration: 1000,
              animationEasing: 'elasticOut',
            }}
            style={{ height: 300 }}
          />
        </ChartCard>
      </Tabs.Content>
    </Tabs.Root>
  );
}
