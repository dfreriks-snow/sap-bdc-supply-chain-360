import { useMemo, useState } from 'react';
import * as Tabs from '@radix-ui/react-tabs';
import DeckGL from '@deck.gl/react';
import { ArcLayer, ScatterplotLayer } from '@deck.gl/layers';
import MapGL from 'react-map-gl/maplibre';
import 'maplibre-gl/dist/maplibre-gl.css';
import { useFilters } from '@/hooks/useFilters';
import { useQuery } from '@/hooks/useQuery';
import { fetchSupplyChainMap } from '@/lib/api';
import { formatNumber, formatDollar } from '@/lib/utils';
import MetricCard, { Factory, CheckCircle2, Timer, TrendingUp } from '@/components/MetricCard';
import ChartCard from '@/components/ChartCard';
import DataTable from '@/components/DataTable';
import ReactECharts from '@/components/Chart';

const PALETTE = ['#06b6d4', '#8b5cf6', '#f59e0b', '#10b981', '#ef4444', '#3b82f6', '#ec4899'];

const tabClass =
  'px-4 py-2 text-sm font-medium text-sf-dark/60 data-[state=active]:text-sf-primary data-[state=active]:border-b-2 data-[state=active]:border-sf-primary';

const BASEMAP = 'https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json';

const INITIAL_VIEW = {
  latitude: 25,
  longitude: 30,
  zoom: 1.3,
  pitch: 30,
  bearing: 0,
};

const FLOW_COLORS: Record<string, [number, number, number]> = {
  Inbound: [16, 185, 129],       // Emerald green
  Outbound: [239, 68, 68],       // Bright red
  'Inter-plant': [59, 130, 246],   // Blue
};

const NODE_CONFIG: Record<string, { color: [number, number, number]; radius: number }> = {
  Plant: { color: [255, 255, 255], radius: 90000 },
  Supplier: { color: [16, 185, 129], radius: 55000 },
  Customer: { color: [239, 68, 68], radius: 55000 },
};

interface Flow {
  flow_id: string;
  flow_type: string;
  material_category: string;
  monthly_volume: number;
  monthly_value: number;
  source_name: string;
  source_type: string;
  source_city: string;
  source_country: string;
  source_lat: number;
  source_lon: number;
  source_plant: string;
  target_name: string;
  target_type: string;
  target_city: string;
  target_country: string;
  target_lat: number;
  target_lon: number;
  target_plant: string;
}

interface Node {
  node_id: string;
  node_name: string;
  node_type: string;
  city: string;
  country: string;
  latitude: number;
  longitude: number;
  plant: string;
}

interface GeoData {
  flows: Flow[];
  nodes: Node[];
  plantCodes: string[];
}

export default function Geography() {
  const { selectedPlants } = useFilters();
  const { data, loading, error } = useQuery<GeoData>(
    () => fetchSupplyChainMap(selectedPlants),
    [selectedPlants.join(',')]
  );
  const [flowTypeFilter, setFlowTypeFilter] = useState<Set<string>>(
    new Set(['Inbound', 'Outbound', 'Inter-plant'])
  );

  const computed = useMemo(() => {
    if (!data) return null;

    const plantCodes = data.plantCodes ?? [];
    const allFlows = data.flows ?? [];
    const allNodes = data.nodes ?? [];

    // Filter flows by plant
    const plantFiltered = plantCodes.length > 0
      ? allFlows.filter(
          (f) => plantCodes.includes(f.source_plant) || plantCodes.includes(f.target_plant)
        )
      : allFlows;

    // Apply flow type filter
    const flows = plantFiltered.filter((f) => flowTypeFilter.has(f.flow_type));

    const uniqueCountries = new Set<string>();
    for (const n of allNodes) {
      if (n.country) uniqueCountries.add(n.country);
    }

    const totalFlowValue = plantFiltered.reduce((s, f) => s + f.monthly_value, 0);

    // Flow value by type
    const valueByType = new Map<string, number>();
    for (const f of plantFiltered) {
      valueByType.set(f.flow_type, (valueByType.get(f.flow_type) ?? 0) + f.monthly_value);
    }
    const flowByType: { flow_type: string; value: number }[] = [];
    valueByType.forEach((value, flow_type) => {
      flowByType.push({ flow_type, value });
    });

    // Top 10 routes by value
    const topRoutes = [...plantFiltered]
      .sort((a, b) => b.monthly_value - a.monthly_value)
      .slice(0, 10)
      .map((f) => ({
        route: `${f.source_name} → ${f.target_name}`,
        monthly_value: f.monthly_value,
      }));

    // Volume by material category
    const catAgg = new Map<string, number>();
    for (const f of plantFiltered) {
      catAgg.set(f.material_category, (catAgg.get(f.material_category) ?? 0) + f.monthly_volume);
    }
    const volumeByCategory: { material_category: string; volume: number }[] = [];
    catAgg.forEach((volume, material_category) => {
      volumeByCategory.push({ material_category, volume });
    });
    volumeByCategory.sort((a, b) => b.volume - a.volume);

    // Flows by country corridor
    const corridorAgg = new Map<string, number>();
    for (const f of plantFiltered) {
      const key = `${f.source_country} → ${f.target_country}`;
      corridorAgg.set(key, (corridorAgg.get(key) ?? 0) + f.monthly_value);
    }
    const corridors: { corridor: string; value: number }[] = [];
    corridorAgg.forEach((value, corridor) => {
      corridors.push({ corridor, value });
    });
    corridors.sort((a, b) => b.value - a.value);
    const corridorsTop = corridors.slice(0, 15);

    // Side panel: route list sorted by value
    const routeList = [...plantFiltered]
      .sort((a, b) => b.monthly_value - a.monthly_value)
      .slice(0, 50);

    return {
      nodeCount: allNodes.length,
      routeCount: plantFiltered.length,
      countryCount: uniqueCountries.size,
      totalFlowValue,
      flows,
      allFlows: plantFiltered,
      nodes: allNodes,
      flowByType,
      topRoutes,
      volumeByCategory,
      corridors: corridorsTop,
      routeList,
    };
  }, [data, flowTypeFilter]);

  function toggleFlowType(type: string) {
    setFlowTypeFilter((prev) => {
      const next = new Set(prev);
      if (next.has(type)) {
        next.delete(type);
      } else {
        next.add(type);
      }
      return next;
    });
  }

  if (selectedPlants.length === 0) {
    return (
      <div className="rounded-xl border border-amber-200 bg-amber-50 p-6 text-center text-amber-800">
        Select at least one plant from the sidebar to view data.
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

  if (!computed) {
    return <p className="py-4 text-center text-sm text-gray-400">No data available</p>;
  }

  const maxValue = Math.max(...computed.flows.map((f) => f.monthly_value), 1);

  const arcLayer = new ArcLayer({
    id: 'arcs',
    data: computed.flows,
    getSourcePosition: (d: Flow) => [d.source_lon, d.source_lat],
    getTargetPosition: (d: Flow) => [d.target_lon, d.target_lat],
    getSourceColor: (d: Flow) => FLOW_COLORS[d.flow_type] ?? [41, 181, 232],
    getTargetColor: (d: Flow) => FLOW_COLORS[d.flow_type] ?? [41, 181, 232],
    getWidth: (d: Flow) => 1 + (d.monthly_value / maxValue) * 8,
    pickable: true,
  });

  const scatterLayer = new ScatterplotLayer({
    id: 'nodes',
    data: computed.nodes,
    getPosition: (d: Node) => [d.longitude, d.latitude],
    getFillColor: (d: Node) => NODE_CONFIG[d.node_type]?.color ?? [41, 181, 232],
    getRadius: (d: Node) => NODE_CONFIG[d.node_type]?.radius ?? 50000,
    pickable: true,
    opacity: 0.9,
  });

  return (
    <Tabs.Root defaultValue="map">
      <Tabs.List className="mb-6 flex gap-1 border-b border-gray-200">
        <Tabs.Trigger value="map" className={tabClass}>
          Global Network Map
        </Tabs.Trigger>
        <Tabs.Trigger value="analysis" className={tabClass}>
          Flow Analysis
        </Tabs.Trigger>
        <Tabs.Trigger value="detail" className={tabClass}>
          Node Detail
        </Tabs.Trigger>
      </Tabs.List>

      <Tabs.Content value="map" className="space-y-6">
        <div className="grid grid-cols-4 gap-5">
          <MetricCard title="Connected Nodes" value={formatNumber(computed.nodeCount)} icon={Factory} accent="border-cyan-400/50 bg-gradient-to-br from-cyan-50 via-white to-cyan-100" />
          <MetricCard title="Active Routes" value={formatNumber(computed.routeCount)} icon={CheckCircle2} accent="border-emerald-400/50 bg-gradient-to-br from-emerald-50 via-white to-emerald-100" />
          <MetricCard title="Countries" value={formatNumber(computed.countryCount)} icon={Timer} accent="border-violet-400/50 bg-gradient-to-br from-violet-50 via-white to-violet-100" />
          <MetricCard title="Monthly Flow Value" value={formatDollar(computed.totalFlowValue)} icon={TrendingUp} accent="border-amber-400/50 bg-gradient-to-br from-amber-50 via-white to-amber-100" />
        </div>

        <div className="grid grid-cols-[1fr_320px] gap-4">
          <div className="rounded-xl border border-sf-primary/30 bg-gray-900 shadow-sm overflow-hidden">
            {/* Flow type filters */}
            <div className="flex gap-3 px-4 py-3 bg-gray-800/80">
              {Object.entries(FLOW_COLORS).map(([type, color]) => (
                <button
                  key={type}
                  onClick={() => toggleFlowType(type)}
                  className={`flex items-center gap-2 rounded-full px-3 py-1 text-xs font-medium transition-opacity ${
                    flowTypeFilter.has(type) ? 'opacity-100' : 'opacity-40'
                  }`}
                >
                  <span
                    className="h-2.5 w-2.5 rounded-full"
                    style={{ backgroundColor: `rgb(${color.join(',')})` }}
                  />
                  <span className="text-white">{type}</span>
                </button>
              ))}
            </div>

            <div style={{ height: 520, position: 'relative' }}>
              <DeckGL
                initialViewState={INITIAL_VIEW}
                controller
                layers={[arcLayer, scatterLayer]}
                style={{ position: 'absolute', top: '0', left: '0', width: '100%', height: '100%' }}
              >
                <MapGL mapStyle={BASEMAP} />
              </DeckGL>
            </div>
          </div>

          {/* Side panel: route list */}
          <div className="rounded-xl border border-sf-primary/30 bg-white shadow-sm">
            <div className="border-b border-gray-200 px-4 py-3">
              <h3 className="text-sm font-semibold text-sf-dark">Top Routes by Value</h3>
            </div>
            <div className="max-h-[540px] overflow-y-auto">
              {computed.routeList.map((f, i) => (
                <div
                  key={f.flow_id + i}
                  className={`flex items-center justify-between px-4 py-2 text-xs ${
                    i % 2 === 0 ? 'bg-white' : 'bg-sky-50/50'
                  }`}
                >
                  <div className="min-w-0 flex-1">
                    <span
                      className="mr-1.5 inline-block h-2 w-2 rounded-full"
                      style={{
                        backgroundColor: `rgb(${(FLOW_COLORS[f.flow_type] ?? [41, 181, 232]).join(',')})`,
                      }}
                    />
                    <span className="text-gray-700">
                      {f.source_name} → {f.target_name}
                    </span>
                  </div>
                  <span className="ml-2 shrink-0 font-medium text-sf-dark">
                    {formatDollar(f.monthly_value)}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </Tabs.Content>

      <Tabs.Content value="analysis" className="space-y-6">
        <div className="grid grid-cols-2 gap-5">
          <ChartCard title="Flow Value by Type" subtitle="Inbound, Outbound, and Inter-plant value distribution">
            <ReactECharts option={{
              tooltip: { trigger: 'item', backgroundColor: 'rgba(255,255,255,0.95)', borderColor: '#e5e7eb', borderWidth: 1, formatter: (p: any) => `${p.name}: $${Number(p.value).toLocaleString()} (${p.percent}%)` },
              legend: { bottom: 5, textStyle: { color: '#6b7280', fontSize: 11 } },
              series: [{ type: 'pie', radius: ['42%', '72%'], center: ['50%', '45%'], itemStyle: { borderRadius: 6, borderColor: '#fff', borderWidth: 2 }, label: { show: false }, emphasis: { label: { show: true, fontSize: 13, fontWeight: 'bold' }, itemStyle: { shadowBlur: 10, shadowColor: 'rgba(0,0,0,0.15)' } }, data: computed.flowByType.map((f, i) => ({ name: f.flow_type, value: f.value, itemStyle: { color: PALETTE[i % PALETTE.length] } })) }],
              animationDuration: 1000, animationEasing: 'cubicOut',
            }} style={{ height: 300 }} />
          </ChartCard>

          <ChartCard title="Top 10 Routes by Value" subtitle="Highest monthly trade value corridors">
            <ReactECharts option={{
              tooltip: { trigger: 'axis', backgroundColor: 'rgba(255,255,255,0.95)', borderColor: '#e5e7eb', borderWidth: 1, axisPointer: { type: 'shadow' }, formatter: (params: any) => `<strong>${params[0].name}</strong><br/>$${Number(params[0].value).toLocaleString()}` },
              grid: { top: 10, right: 30, bottom: 30, left: 160 },
              xAxis: { type: 'value', axisLabel: { color: '#6b7280', fontSize: 11, formatter: (v: number) => `$${(v/1000).toFixed(0)}k` }, splitLine: { lineStyle: { color: '#f3f4f6', type: 'dashed' } } },
              yAxis: { type: 'category', data: computed.topRoutes.map(r => r.route).reverse(), axisLabel: { color: '#374151', fontSize: 10, width: 140, overflow: 'truncate' }, axisLine: { show: false }, axisTick: { show: false } },
              series: [{ type: 'bar', data: computed.topRoutes.map((r, i) => ({ value: r.monthly_value, itemStyle: { color: { type: 'linear', x: 0, y: 0, x2: 1, y2: 0, colorStops: [{ offset: 0, color: PALETTE[i % PALETTE.length] }, { offset: 1, color: PALETTE[i % PALETTE.length] + '60' }] }, borderRadius: [0, 5, 5, 0] } })).reverse(), barWidth: '55%' }],
              animationDuration: 900, animationEasing: 'elasticOut',
            }} style={{ height: 300 }} />
          </ChartCard>

          <ChartCard title="Volume by Material Category" subtitle="Monthly shipment volume by product type">
            <ReactECharts option={{
              tooltip: { trigger: 'axis', backgroundColor: 'rgba(255,255,255,0.95)', borderColor: '#e5e7eb', borderWidth: 1, axisPointer: { type: 'shadow' } },
              grid: { top: 10, right: 20, bottom: 30, left: 130 },
              xAxis: { type: 'value', axisLabel: { color: '#6b7280', fontSize: 11 }, splitLine: { lineStyle: { color: '#f3f4f6', type: 'dashed' } } },
              yAxis: { type: 'category', data: computed.volumeByCategory.map(r => r.material_category), axisLabel: { color: '#374151', fontSize: 11, fontWeight: 500 }, axisLine: { show: false }, axisTick: { show: false } },
              series: [{ type: 'bar', data: computed.volumeByCategory.map((r, i) => ({ value: r.volume, itemStyle: { color: { type: 'linear', x: 0, y: 0, x2: 1, y2: 0, colorStops: [{ offset: 0, color: PALETTE[(i+2) % PALETTE.length] }, { offset: 1, color: PALETTE[(i+2) % PALETTE.length] + '60' }] }, borderRadius: [0, 5, 5, 0] } })), barWidth: '55%' }],
              animationDuration: 900, animationEasing: 'elasticOut',
            }} style={{ height: 300 }} />
          </ChartCard>

          <ChartCard title="Flows by Country Corridor" subtitle="Trade routes ranked by monthly value">
            <ReactECharts option={{
              tooltip: { trigger: 'axis', backgroundColor: 'rgba(255,255,255,0.95)', borderColor: '#e5e7eb', borderWidth: 1, axisPointer: { type: 'shadow' }, formatter: (params: any) => `<strong>${params[0].name}</strong><br/>$${Number(params[0].value).toLocaleString()}` },
              grid: { top: 10, right: 30, bottom: 30, left: 140 },
              xAxis: { type: 'value', axisLabel: { color: '#6b7280', fontSize: 11, formatter: (v: number) => `$${(v/1000).toFixed(0)}k` }, splitLine: { lineStyle: { color: '#f3f4f6', type: 'dashed' } } },
              yAxis: { type: 'category', data: computed.corridors.map(r => r.corridor), axisLabel: { color: '#374151', fontSize: 10, width: 120, overflow: 'truncate' }, axisLine: { show: false }, axisTick: { show: false } },
              series: [{ type: 'bar', data: computed.corridors.map((r, i) => ({ value: r.value, itemStyle: { color: { type: 'linear', x: 0, y: 0, x2: 1, y2: 0, colorStops: [{ offset: 0, color: PALETTE[(i+4) % PALETTE.length] }, { offset: 1, color: PALETTE[(i+4) % PALETTE.length] + '60' }] }, borderRadius: [0, 5, 5, 0] } })), barWidth: '55%' }],
              animationDuration: 900, animationEasing: 'elasticOut',
            }} style={{ height: 300 }} />
          </ChartCard>
        </div>
      </Tabs.Content>

      <Tabs.Content value="detail" className="space-y-6">
        <ChartCard title="Supply Chain Nodes" subtitle="All network participants">
          <DataTable
            columns={[
              { key: 'node_name', label: 'Name' },
              { key: 'node_type', label: 'Type' },
              { key: 'city', label: 'City' },
              { key: 'country', label: 'Country' },
              { key: 'latitude', label: 'Lat' },
              { key: 'longitude', label: 'Lon' },
            ]}
            data={computed.nodes}
          />
        </ChartCard>

        <ChartCard title="Supply Chain Flows" subtitle="All active trade routes">
          <DataTable
            columns={[
              { key: 'flow_type', label: 'Type' },
              { key: 'source_name', label: 'Source' },
              { key: 'source_country', label: 'From' },
              { key: 'target_name', label: 'Target' },
              { key: 'target_country', label: 'To' },
              { key: 'material_category', label: 'Material' },
              { key: 'monthly_volume', label: 'Volume' },
              { key: 'monthly_value', label: 'Value ($)' },
            ]}
            data={computed.allFlows}
          />
        </ChartCard>
      </Tabs.Content>
    </Tabs.Root>
  );
}
