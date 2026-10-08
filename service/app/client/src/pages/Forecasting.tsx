import { useMemo } from 'react';
import * as Tabs from '@radix-ui/react-tabs';
import ReactECharts from '@/components/Chart';
import { useFilters } from '@/hooks/useFilters';
import { useQuery } from '@/hooks/useQuery';
import { fetchForecasting } from '@/lib/api';
import MetricCard, { Factory, CheckCircle2, Timer, TrendingUp } from '@/components/MetricCard';
import ChartCard from '@/components/ChartCard';
import DataTable from '@/components/DataTable';

const PALETTE = ['#06b6d4', '#8b5cf6', '#f59e0b', '#10b981', '#ef4444', '#3b82f6', '#ec4899'];

const tabClass =
  'px-4 py-2 text-sm font-medium text-sf-dark/60 data-[state=active]:text-sf-primary data-[state=active]:border-b-2 data-[state=active]:border-sf-primary';

interface DemandRow {
  plant_name: string;
  material_desc: string;
  basic_start_date: string;
  planned_qty: number;
  confirmed_qty: number;
  order_status: string;
}

interface KpiRow {
  plant_name: string;
  period_date: string;
  oee_pct: number;
  on_time_delivery_pct: number;
  scrap_rate_pct: number;
  inventory_turnover: number;
}

interface SupplierTrend {
  supplier_name: string;
  material_desc: string;
  period_date: string;
  quality_score: number;
  on_time_delivery_pct: number;
  defect_rate_pct: number;
}

interface ForecastData {
  demandHistory: DemandRow[];
  kpiTrends: KpiRow[];
  supplierTrends: SupplierTrend[];
}

// Forecasting methods reference
const FORECAST_METHODS = [
  { name: 'Moving Average', type: 'Quantitative', desc: 'Averages recent periods to smooth fluctuations. Best for stable demand.', complexity: 'Low', accuracy: 'Medium', icon: '📊' },
  { name: 'Exponential Smoothing', type: 'Quantitative', desc: 'Weights recent data more heavily. Adapts to trend changes faster.', complexity: 'Medium', accuracy: 'Medium-High', icon: '📈' },
  { name: 'ARIMA', type: 'Time-Series', desc: 'Auto-Regressive Integrated Moving Average. Captures seasonality and trends.', complexity: 'High', accuracy: 'High', icon: '🔬' },
  { name: 'Causal/Regression', type: 'Causal', desc: 'Uses external variables (market demand, economic indicators) as predictors.', complexity: 'High', accuracy: 'High', icon: '🔗' },
  { name: 'ML/Neural Networks', type: 'AI/ML', desc: 'Deep learning models that detect non-linear patterns in large datasets.', complexity: 'Very High', accuracy: 'Very High', icon: '🤖' },
  { name: 'Delphi Method', type: 'Qualitative', desc: 'Expert panel consensus. Used when historical data is limited.', complexity: 'Low', accuracy: 'Variable', icon: '👥' },
];

/** Simple 3-period moving average forecast for n future periods */
function movingAverageForecast(values: number[], periods: number): number[] {
  const windowSize = Math.min(3, values.length);
  const lastWindow = values.slice(-windowSize);
  const avg = lastWindow.reduce((s, v) => s + v, 0) / windowSize;
  // Linear trend from last window
  const trend = windowSize >= 2 ? (lastWindow[lastWindow.length - 1] - lastWindow[0]) / (windowSize - 1) : 0;
  return Array.from({ length: periods }, (_, i) => Number((avg + trend * (i + 1)).toFixed(1)));
}

export default function Forecasting() {
  const { selectedPlants } = useFilters();
  const { data, loading, error } = useQuery<ForecastData>(
    () => fetchForecasting(selectedPlants),
    [selectedPlants.join(',')]
  );

  const computed = useMemo(() => {
    if (!data) return null;

    // Demand aggregation by month
    const monthlyDemand = new Map<string, { planned: number; confirmed: number }>();
    for (const d of data.demandHistory) {
      const month = d.basic_start_date.replace(/"/g, '').slice(0, 7); // "2025-01"
      const curr = monthlyDemand.get(month) ?? { planned: 0, confirmed: 0 };
      curr.planned += d.planned_qty;
      curr.confirmed += d.confirmed_qty;
      monthlyDemand.set(month, curr);
    }
    const demandMonths = [...monthlyDemand.keys()].sort();
    const plannedSeries = demandMonths.map((m) => monthlyDemand.get(m)!.planned);
    const confirmedSeries = demandMonths.map((m) => monthlyDemand.get(m)!.confirmed);

    // Forecast next 3 months
    const lastMonth = demandMonths[demandMonths.length - 1];
    const forecastMonths = Array.from({ length: 3 }, (_, i) => {
      const [y, m] = lastMonth.split('-').map(Number);
      const newM = m + i + 1;
      const newY = y + Math.floor((newM - 1) / 12);
      return `${newY}-${String(((newM - 1) % 12) + 1).padStart(2, '0')}`;
    });
    const forecastValues = movingAverageForecast(plannedSeries, 3);

    // Forecast accuracy
    const totalPlanned = data.demandHistory.reduce((s, d) => s + d.planned_qty, 0);
    const totalConfirmed = data.demandHistory.reduce((s, d) => s + d.confirmed_qty, 0);
    const forecastAccuracy = totalPlanned > 0 ? ((totalConfirmed / totalPlanned) * 100).toFixed(1) : '0';
    const forecastBias = totalPlanned > 0 ? (((totalPlanned - totalConfirmed) / totalPlanned) * 100).toFixed(1) : '0';

    // KPI forecasting by plant
    const plants = [...new Set(data.kpiTrends.map((k) => k.plant_name))];
    const periods = [...new Set(data.kpiTrends.map((k) => k.period_date.replace(/"/g, '')))].sort();

    // OEE forecast per plant
    const oeeForecast = new Map<string, number[]>();
    for (const plant of plants) {
      const values = periods.map((p) => {
        const row = data.kpiTrends.find((k) => k.plant_name === plant && k.period_date.replace(/"/g, '') === p);
        return row ? row.oee_pct : 0;
      }).filter((v) => v > 0);
      oeeForecast.set(plant, movingAverageForecast(values, 3));
    }

    // Future period labels
    const lastPeriod = periods[periods.length - 1];
    const futurePeriods = Array.from({ length: 3 }, (_, i) => {
      const [y, m] = lastPeriod.split('-').map(Number);
      const newM = m + i + 1;
      const newY = y + Math.floor((newM - 1) / 12);
      return `${newY}-${String(((newM - 1) % 12) + 1).padStart(2, '0')}-01`;
    });

    return {
      demandMonths, plannedSeries, confirmedSeries,
      forecastMonths, forecastValues,
      forecastAccuracy, forecastBias,
      plants, periods, futurePeriods, oeeForecast,
      totalPlanned, totalConfirmed,
    };
  }, [data]);

  if (selectedPlants.length === 0) {
    return (
      <div className="rounded-xl border border-amber-200 bg-amber-50 p-6 text-center text-amber-800">
        Select at least one plant from the sidebar to view forecasting data.
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
    <Tabs.Root defaultValue="demand">
      <Tabs.List className="mb-6 flex gap-1 border-b border-gray-200">
        <Tabs.Trigger value="demand" className={tabClass}>Demand Forecast</Tabs.Trigger>
        <Tabs.Trigger value="kpi" className={tabClass}>KPI Forecasting</Tabs.Trigger>
        <Tabs.Trigger value="framework" className={tabClass}>Forecasting Framework</Tabs.Trigger>
      </Tabs.List>

      {/* Tab 1: Demand Forecast */}
      <Tabs.Content value="demand" className="space-y-6">
        <div className="grid grid-cols-4 gap-5">
          <MetricCard title="Forecast Accuracy" value={`${computed.forecastAccuracy}%`} icon={CheckCircle2} accent="border-emerald-400/50 bg-gradient-to-br from-emerald-50 via-white to-emerald-100" />
          <MetricCard title="Forecast Bias" value={`${computed.forecastBias}%`} icon={Timer} accent="border-amber-400/50 bg-gradient-to-br from-amber-50 via-white to-amber-100" />
          <MetricCard title="Total Planned" value={String(computed.totalPlanned)} icon={Factory} accent="border-cyan-400/50 bg-gradient-to-br from-cyan-50 via-white to-cyan-100" />
          <MetricCard title="Total Confirmed" value={String(computed.totalConfirmed)} icon={TrendingUp} accent="border-violet-400/50 bg-gradient-to-br from-violet-50 via-white to-violet-100" />
        </div>

        <ChartCard title="Demand Forecast — Historical + Projected" subtitle="Monthly production demand with 3-month moving average forecast (dashed line shows projected demand)">
          <ReactECharts
            option={{
              tooltip: { trigger: 'axis' },
              legend: { bottom: 0, textStyle: { color: '#6b7280', fontSize: 10 } },
              grid: { top: 20, right: 30, bottom: 40, left: 50 },
              xAxis: {
                type: 'category',
                data: [...computed.demandMonths, ...computed.forecastMonths],
                axisLabel: { color: '#6b7280', fontSize: 10, rotate: 30 },
              },
              yAxis: {
                type: 'value',
                name: 'Units',
                nameTextStyle: { color: '#6b7280', fontSize: 10 },
                axisLabel: { color: '#6b7280', fontSize: 10 },
                splitLine: { lineStyle: { color: '#f3f4f6', type: 'dashed' } },
              },
              series: [
                {
                  name: 'Planned Qty',
                  type: 'bar',
                  data: [...computed.plannedSeries, ...Array(3).fill(null)],
                  itemStyle: { color: PALETTE[5], borderRadius: [4, 4, 0, 0] },
                  barWidth: '35%',
                },
                {
                  name: 'Confirmed Qty',
                  type: 'bar',
                  data: [...computed.confirmedSeries, ...Array(3).fill(null)],
                  itemStyle: { color: PALETTE[3], borderRadius: [4, 4, 0, 0] },
                  barWidth: '35%',
                },
                {
                  name: 'Forecast (3-period MA)',
                  type: 'line',
                  data: [...Array(computed.demandMonths.length - 1).fill(null), computed.plannedSeries[computed.plannedSeries.length - 1], ...computed.forecastValues],
                  lineStyle: { color: PALETTE[4], width: 2, type: 'dashed' },
                  itemStyle: { color: PALETTE[4] },
                  symbol: 'diamond',
                  symbolSize: 8,
                },
              ],
              animationDuration: 1000,
            }}
            style={{ height: 350 }}
          />
        </ChartCard>

        <div className="grid grid-cols-2 gap-5">
          <ChartCard title="Forecast Accuracy by Product" subtitle="Confirmed ÷ Planned × 100 (higher = more accurate forecast)">
            <ReactECharts
              option={{
                tooltip: { trigger: 'axis', axisPointer: { type: 'shadow' } },
                grid: { top: 10, right: 30, bottom: 20, left: 160 },
                xAxis: {
                  type: 'value', min: 70, max: 100,
                  axisLabel: { color: '#6b7280', fontSize: 10, formatter: '{value}%' },
                  splitLine: { lineStyle: { color: '#f3f4f6', type: 'dashed' } },
                },
                yAxis: {
                  type: 'category',
                  data: [...new Set(data.demandHistory.map((d: DemandRow) => d.material_desc))].slice(0, 8),
                  axisLabel: { color: '#374151', fontSize: 10, width: 140, overflow: 'truncate' },
                  axisLine: { show: false }, axisTick: { show: false },
                },
                series: [{
                  type: 'bar',
                  data: [...new Set(data.demandHistory.map((d: DemandRow) => d.material_desc))].slice(0, 8).map((mat, i) => {
                    const rows = data.demandHistory.filter((d: DemandRow) => d.material_desc === mat);
                    const p = rows.reduce((s: number, r: DemandRow) => s + r.planned_qty, 0);
                    const c = rows.reduce((s: number, r: DemandRow) => s + r.confirmed_qty, 0);
                    const acc = p > 0 ? (c / p) * 100 : 0;
                    return { value: Number(acc.toFixed(1)), itemStyle: { color: PALETTE[i % PALETTE.length], borderRadius: [0, 4, 4, 0] } };
                  }),
                  barWidth: '55%',
                }],
              }}
              style={{ height: 280 }}
            />
          </ChartCard>

          <ChartCard title="Demand by Plant (Planned vs Confirmed)" subtitle="Aggregate production volume comparison">
            <ReactECharts
              option={{
                tooltip: { trigger: 'axis' },
                legend: { bottom: 0, textStyle: { color: '#6b7280', fontSize: 10 } },
                grid: { top: 10, right: 20, bottom: 35, left: 40 },
                xAxis: {
                  type: 'category',
                  data: computed.plants,
                  axisLabel: { color: '#6b7280', fontSize: 10, rotate: 15 },
                },
                yAxis: {
                  type: 'value',
                  axisLabel: { color: '#6b7280', fontSize: 10 },
                  splitLine: { lineStyle: { color: '#f3f4f6', type: 'dashed' } },
                },
                series: [
                  {
                    name: 'Planned', type: 'bar',
                    data: computed.plants.map((plant) => data.demandHistory.filter((d: DemandRow) => d.plant_name === plant).reduce((s: number, d: DemandRow) => s + d.planned_qty, 0)),
                    itemStyle: { color: PALETTE[5], borderRadius: [4, 4, 0, 0] },
                  },
                  {
                    name: 'Confirmed', type: 'bar',
                    data: computed.plants.map((plant) => data.demandHistory.filter((d: DemandRow) => d.plant_name === plant).reduce((s: number, d: DemandRow) => s + d.confirmed_qty, 0)),
                    itemStyle: { color: PALETTE[3], borderRadius: [4, 4, 0, 0] },
                  },
                ],
              }}
              style={{ height: 280 }}
            />
          </ChartCard>
        </div>
      </Tabs.Content>

      {/* Tab 2: KPI Forecasting */}
      <Tabs.Content value="kpi" className="space-y-6">
        <div className="grid grid-cols-2 gap-5">
          <ChartCard title="OEE Forecast by Plant" subtitle="Historical OEE with 3-month projected trend (dashed)">
            <ReactECharts
              option={{
                tooltip: { trigger: 'axis' },
                legend: { bottom: 0, textStyle: { color: '#6b7280', fontSize: 10 } },
                grid: { top: 20, right: 20, bottom: 40, left: 50 },
                xAxis: {
                  type: 'category',
                  data: [...computed.periods, ...computed.futurePeriods].map((p) => p.slice(0, 7)),
                  axisLabel: { color: '#6b7280', fontSize: 9, rotate: 30 },
                },
                yAxis: {
                  type: 'value', min: 70, max: 100,
                  axisLabel: { color: '#6b7280', fontSize: 10, formatter: '{value}%' },
                  splitLine: { lineStyle: { color: '#f3f4f6', type: 'dashed' } },
                },
                series: computed.plants.flatMap((plant, i) => {
                  const historical = computed.periods.map((p) => {
                    const row = data.kpiTrends.find((k: KpiRow) => k.plant_name === plant && k.period_date.replace(/"/g, '') === p);
                    return row ? row.oee_pct : null;
                  });
                  const forecast = computed.oeeForecast.get(plant) ?? [];
                  return [
                    {
                      name: plant,
                      type: 'line', smooth: true,
                      data: [...historical, ...Array(3).fill(null)],
                      lineStyle: { color: PALETTE[i % PALETTE.length], width: 2 },
                      itemStyle: { color: PALETTE[i % PALETTE.length] },
                    },
                    {
                      name: `${plant} (forecast)`,
                      type: 'line', smooth: true,
                      data: [...Array(computed.periods.length - 1).fill(null), historical[historical.length - 1], ...forecast],
                      lineStyle: { color: PALETTE[i % PALETTE.length], width: 2, type: 'dashed' },
                      itemStyle: { color: PALETTE[i % PALETTE.length] },
                      symbol: 'diamond', symbolSize: 6,
                      showInLegend: false,
                    },
                  ];
                }),
              }}
              style={{ height: 350 }}
            />
          </ChartCard>

          <ChartCard title="Scrap Rate Forecast" subtitle="Waste trend extrapolation — lower is better">
            <ReactECharts
              option={{
                tooltip: { trigger: 'axis' },
                legend: { bottom: 0, textStyle: { color: '#6b7280', fontSize: 10 } },
                grid: { top: 20, right: 20, bottom: 40, left: 50 },
                xAxis: {
                  type: 'category',
                  data: [...computed.periods, ...computed.futurePeriods].map((p) => p.slice(0, 7)),
                  axisLabel: { color: '#6b7280', fontSize: 9, rotate: 30 },
                },
                yAxis: {
                  type: 'value',
                  axisLabel: { color: '#6b7280', fontSize: 10, formatter: '{value}%' },
                  splitLine: { lineStyle: { color: '#f3f4f6', type: 'dashed' } },
                },
                series: computed.plants.flatMap((plant, i) => {
                  const values = computed.periods.map((p) => {
                    const row = data.kpiTrends.find((k: KpiRow) => k.plant_name === plant && k.period_date.replace(/"/g, '') === p);
                    return row ? row.scrap_rate_pct : null;
                  });
                  const validValues = values.filter((v): v is number => v !== null);
                  const forecast = movingAverageForecast(validValues, 3);
                  return [
                    { name: plant, type: 'line', smooth: true, areaStyle: { opacity: 0.05 }, data: [...values, ...Array(3).fill(null)], lineStyle: { color: PALETTE[i % PALETTE.length] }, itemStyle: { color: PALETTE[i % PALETTE.length] } },
                    { name: `${plant} (proj)`, type: 'line', smooth: true, data: [...Array(computed.periods.length - 1).fill(null), validValues[validValues.length - 1], ...forecast], lineStyle: { color: PALETTE[i % PALETTE.length], type: 'dashed' }, itemStyle: { color: PALETTE[i % PALETTE.length] }, symbol: 'diamond', symbolSize: 6, showInLegend: false },
                  ];
                }),
              }}
              style={{ height: 350 }}
            />
          </ChartCard>
        </div>

        <ChartCard title="Supplier Quality Trend & Forecast" subtitle="Quality scores over time with projected trajectory">
          <DataTable
            columns={[
              { key: 'supplier_name', label: 'Supplier' },
              { key: 'material_desc', label: 'Material' },
              { key: 'period_date', label: 'Period' },
              { key: 'quality_score', label: 'Quality Score' },
              { key: 'on_time_delivery_pct', label: 'OTD %' },
              { key: 'defect_rate_pct', label: 'Defect Rate %' },
            ]}
            data={data.supplierTrends}
          />
        </ChartCard>
      </Tabs.Content>

      {/* Tab 3: Forecasting Framework */}
      <Tabs.Content value="framework" className="space-y-6">
        <ChartCard title="Supply Chain Forecasting Framework" subtitle="Based on industry best practices (Coupa, Gartner, ASCM SCOR DS)">
          <div className="px-5 py-4 space-y-5">
            {/* Definition */}
            <div>
              <h3 className="text-sm font-bold text-sf-dark mb-1">What is Supply Chain Forecasting?</h3>
              <p className="text-xs text-gray-600 leading-relaxed">
                Supply chain forecasting uses <strong>historical data, statistical models, and AI/ML algorithms</strong> to predict future demand, 
                supply needs, and capacity requirements. Accurate forecasting enables organizations to optimize inventory levels, 
                reduce stockouts, minimize waste, and align production schedules with expected customer demand.
                It spans demand forecasting, supply forecasting, capacity planning, and financial projections.
              </p>
            </div>

            {/* Workflow Process Diagram */}
            <div>
              <h3 className="text-sm font-bold text-sf-dark mb-3">Forecasting Workflow</h3>
              <div className="flex items-center justify-between">
                {[
                  { step: '1', label: 'Data Collection', desc: 'Gather historical orders, KPIs, market data', color: '#06b6d4' },
                  { step: '2', label: 'Cleansing', desc: 'Remove outliers, fill gaps, normalize', color: '#8b5cf6' },
                  { step: '3', label: 'Method Selection', desc: 'Choose model (MA, ARIMA, ML)', color: '#f59e0b' },
                  { step: '4', label: 'Model Training', desc: 'Fit model on historical data', color: '#10b981' },
                  { step: '5', label: 'Forecast', desc: 'Generate predictions for future periods', color: '#3b82f6' },
                  { step: '6', label: 'Measure & Adjust', desc: 'Calculate MAPE, bias; refine model', color: '#ef4444' },
                ].map((s, i, arr) => (
                  <div key={s.step} className="flex items-center">
                    <div className="flex flex-col items-center">
                      <div className="flex h-10 w-10 items-center justify-center rounded-full text-white text-xs font-bold shadow" style={{ backgroundColor: s.color }}>
                        {s.step}
                      </div>
                      <p className="mt-1 text-[10px] font-semibold text-sf-dark text-center max-w-[80px]">{s.label}</p>
                      <p className="text-[8px] text-gray-500 text-center max-w-[90px] leading-tight">{s.desc}</p>
                    </div>
                    {i < arr.length - 1 && <div className="mx-1.5 h-0.5 w-6 bg-gray-300" />}
                  </div>
                ))}
              </div>
            </div>

            {/* Method Comparison */}
            <div>
              <h3 className="text-sm font-bold text-sf-dark mb-2">Forecasting Methods Comparison</h3>
              <div className="overflow-hidden rounded-lg border border-gray-200">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="bg-gray-50">
                      <th className="px-3 py-2 text-left font-semibold text-gray-700">Method</th>
                      <th className="px-3 py-2 text-left font-semibold text-gray-700">Type</th>
                      <th className="px-3 py-2 text-left font-semibold text-gray-700">Description</th>
                      <th className="px-3 py-2 text-left font-semibold text-gray-700">Complexity</th>
                      <th className="px-3 py-2 text-left font-semibold text-gray-700">Accuracy</th>
                    </tr>
                  </thead>
                  <tbody>
                    {FORECAST_METHODS.map((m, i) => (
                      <tr key={m.name} className={i % 2 === 0 ? 'bg-white' : 'bg-gray-50/50'}>
                        <td className="px-3 py-2 font-medium text-sf-dark">{m.icon} {m.name}</td>
                        <td className="px-3 py-2"><span className="rounded-full bg-sky-100 px-2 py-0.5 text-[10px] font-medium text-sky-700">{m.type}</span></td>
                        <td className="px-3 py-2 text-gray-600">{m.desc}</td>
                        <td className="px-3 py-2 text-gray-500">{m.complexity}</td>
                        <td className="px-3 py-2 text-gray-500">{m.accuracy}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* KPI Definitions */}
            <div>
              <h3 className="text-sm font-bold text-sf-dark mb-2">Forecasting Accuracy KPIs</h3>
              <div className="grid grid-cols-4 gap-3">
                <div className="rounded-lg border border-emerald-200 bg-emerald-50/50 p-3">
                  <p className="text-xs font-bold text-sf-dark">MAPE</p>
                  <p className="text-[10px] text-gray-600 mt-1">Mean Absolute Percentage Error. Average of |Actual - Forecast| / Actual × 100. Target: &lt;10%.</p>
                  <p className="mt-2 text-sm font-bold text-emerald-700">{computed.forecastBias}%</p>
                  <p className="text-[9px] text-gray-500">Your current bias</p>
                </div>
                <div className="rounded-lg border border-cyan-200 bg-cyan-50/50 p-3">
                  <p className="text-xs font-bold text-sf-dark">DFA</p>
                  <p className="text-[10px] text-gray-600 mt-1">Demand Forecast Accuracy. 1 - MAPE. Measures how close forecasts are to actuals. Target: &gt;90%.</p>
                  <p className="mt-2 text-sm font-bold text-cyan-700">{computed.forecastAccuracy}%</p>
                  <p className="text-[9px] text-gray-500">Your accuracy</p>
                </div>
                <div className="rounded-lg border border-amber-200 bg-amber-50/50 p-3">
                  <p className="text-xs font-bold text-sf-dark">Bias</p>
                  <p className="text-[10px] text-gray-600 mt-1">Directional error — positive = over-forecasting, negative = under-forecasting. Target: near 0%.</p>
                  <p className="mt-2 text-sm font-bold text-amber-700">+{computed.forecastBias}%</p>
                  <p className="text-[9px] text-gray-500">Slight over-forecast</p>
                </div>
                <div className="rounded-lg border border-violet-200 bg-violet-50/50 p-3">
                  <p className="text-xs font-bold text-sf-dark">Fill Rate</p>
                  <p className="text-[10px] text-gray-600 mt-1">% of demand fulfilled from available stock. Measures forecast quality downstream. Target: &gt;95%.</p>
                  <p className="mt-2 text-sm font-bold text-violet-700">{computed.forecastAccuracy}%</p>
                  <p className="text-[9px] text-gray-500">Confirmed / Planned</p>
                </div>
              </div>
            </div>

            {/* How this connects to SCOR */}
            <div className="rounded-lg border border-gray-200 bg-gray-50 p-4">
              <h4 className="text-xs font-bold text-sf-dark mb-1">SCOR Alignment</h4>
              <p className="text-[10px] text-gray-600 leading-relaxed">
                In the SCOR DS v14.0 framework, forecasting is a core activity within the <strong>Plan</strong> process (Level 1). 
                Specifically, it maps to <strong>P.1 Plan Supply Chain</strong> and <strong>P.2 Plan Order</strong> at Level 2. 
                Forecast accuracy directly impacts the <strong>Reliability (RL)</strong> and <strong>Agility (AG)</strong> performance attributes. 
                The metrics on this page feed into SCOR metric <strong>RL.1.1 Perfect Order Fulfillment</strong> — because poor forecasting leads to stockouts 
                or overstock, both of which degrade perfect order performance.
              </p>
            </div>
          </div>
        </ChartCard>
      </Tabs.Content>
    </Tabs.Root>
  );
}
