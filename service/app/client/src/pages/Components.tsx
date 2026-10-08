import { useEffect, useState } from 'react';
import { useQuery } from '@/hooks/useQuery';
import { useFilters } from '@/hooks/useFilters';
import { fetchComponents, fetchSerials, fetchThread } from '@/lib/api';
import ChartCard from '@/components/ChartCard';
import AskCortex from '@/components/AskCortex';
import ReactECharts from '@/components/Chart';
import { ArrowRight, Factory, Package, ShieldCheck, Truck, User } from 'lucide-react';
import { cn } from '@/lib/utils';

const STATUS = { Critical: 'bg-red-100 text-red-700', Watch: 'bg-amber-100 text-amber-700', OK: 'bg-emerald-100 text-emerald-700' } as Record<string, string>;
const RESULT = { PASS: 'bg-emerald-100 text-emerald-700', PASS_AFTER_REWORK: 'bg-amber-100 text-amber-700', FAIL: 'bg-red-100 text-red-700',
  Accepted: 'bg-emerald-100 text-emerald-700', 'Accepted with deviation': 'bg-amber-100 text-amber-700', Rejected: 'bg-red-100 text-red-700' } as Record<string, string>;
const d = (v: string | null) => (v ? new Date(v).toLocaleDateString('en-US', { timeZone: 'UTC', month: 'short', day: 'numeric', year: '2-digit' }) : '—');

function Pill({ v, map }: { v: string; map: Record<string, string> }) {
  return <span className={cn('rounded px-2 py-0.5 text-xs font-semibold', map[v] ?? 'bg-gray-100 text-gray-600')}>{v.replace(/_/g, ' ')}</span>;
}

export default function Components() {
  const { selectedPlants } = useFilters();
  const key = selectedPlants.join(',');
  const { data, loading, error } = useQuery(() => fetchComponents(selectedPlants), [key]);
  const { data: serials } = useQuery(() => fetchSerials(selectedPlants), [key]);
  const [serial, setSerial] = useState<string>('');
  const [thread, setThread] = useState<any>(null);

  useEffect(() => { if (serials?.length && !serial) setSerial(serials[0].serial_no); }, [serials]);
  useEffect(() => { if (serial) fetchThread(serial).then(setThread).catch(() => setThread(null)); }, [serial]);

  if (loading) return <div className="h-64 animate-pulse rounded-xl bg-gradient-to-br from-sky-100 to-cyan-50" />;
  if (error) return <div className="rounded-xl border border-red-300 bg-red-50 p-6 text-red-700"><strong>Error:</strong> {error}</div>;
  if (!data?.cover) return null;
  const { cover, lots } = data;
  const atRisk = cover.filter((c: any) => c.status !== 'OK');

  // Shortfall = supplier lead time minus days of cover: the days of production a
  // shortage will cost unless an expedite lands. Ranked largest first.
  const short = atRisk
    .map((c: any) => ({ ...c, shortfall: Math.max(0, +(c.supplier_lead_time_days - c.days_of_cover).toFixed(1)) }))
    .filter((c: any) => c.shortfall > 0);
  const coverOption = {
    tooltip: { trigger: 'axis', axisPointer: { type: 'shadow' },
      formatter: (p: any) => { const c = short[p[0].dataIndex]; return `${c.component_desc} · ${c.plant_name}<br/>Cover ${c.days_of_cover} d vs lead time ${c.supplier_lead_time_days} d<br/><b>Shortfall ${c.shortfall} d</b>`; } },
    grid: { top: 10, right: 50, bottom: 30, left: 10, containLabel: true },
    xAxis: { type: 'value', name: 'days short' },
    yAxis: { type: 'category', axisLabel: { fontSize: 10 }, data: short.map((c: any) => `${c.component_desc} · ${c.plant_name.split(' ')[0]}`) },
    series: [{ name: 'Shortfall (lead time − cover)', type: 'bar', barMaxWidth: 18,
      label: { show: true, position: 'right', fontSize: 10, formatter: '{c} d' },
      data: short.map((c: any) => ({ value: c.shortfall, itemStyle: { color: c.status === 'Critical' ? '#ef4444' : '#f59e0b' } })) }],
  };

  const comp = thread?.components ?? [];
  const head = comp[0];

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4 rounded-xl border border-sky-200 bg-white p-4 shadow-sm">
        <p className="text-sm text-gray-600">
          Component availability and the digital thread from every shipped system back to the supplier lots inside it.
          Cover below supplier lead time means a shortage is already locked in unless an expedite lands.
          <span className="ml-1 text-xs text-gray-400">Lot, genealogy and final-test data is representative demo enrichment keyed to the SAP BOM and supplier master.</span>
        </p>
        <AskCortex topic="components" label="Ask Cortex: assess component risk" className="w-auto shrink-0"
          suggestions={['Which supplier lots correlate with final-test rework?', 'What should we expedite first?', 'Where is cover below lead time?']} />
      </div>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-5">
        <ChartCard title="Component shortfall" subtitle="Days a shortage is locked in: supplier lead time minus days of cover, largest first" className="xl:col-span-3">
          <ReactECharts option={coverOption} style={{ height: Math.max(300, short.length * 24) }} />
        </ChartCard>
        <ChartCard title="Supplier lot quality → final test" className="xl:col-span-2">
          <table className="min-w-full text-sm">
            <thead><tr className="border-b text-left text-xs uppercase text-gray-500">
              <th className="py-1.5">Supplier</th><th>Lots</th><th>Deviating</th><th>Serials not first-pass</th></tr></thead>
            <tbody>{lots.map((l: any) => (
              <tr key={l.supplier_name} className="border-b border-gray-100">
                <td className="py-1.5 font-medium">{l.supplier_name}</td><td>{l.lots}</td>
                <td className={l.deviating_lots > 2 ? 'font-semibold text-red-600' : ''}>{l.deviating_lots}</td>
                <td>{l.serials_not_first_pass} / {l.serials}</td>
              </tr>))}
            </tbody>
          </table>
        </ChartCard>
      </div>

      <ChartCard title="Digital thread — system serial genealogy" subtitle="Serial → component lots → supplier inspection → final test → customer order">
        <div className="mb-4 flex flex-wrap items-center gap-3">
          <select value={serial} onChange={(e) => setSerial(e.target.value)}
            className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm">
            {(serials ?? []).map((s: any) => (
              <option key={s.serial_no} value={s.serial_no}>
                {s.serial_no} · {s.sold_to} · {s.final_test_result.replace(/_/g, ' ')}{s.deviating_components ? ` · ${s.deviating_components} deviating` : ''}
              </option>))}
          </select>
          {serial && <AskCortex compact topic="serial" args={{ serial }} label="Analyse this serial" />}
        </div>

        {head && (
          <>
            <div className="mb-5 flex flex-wrap items-center gap-2 text-sm">
              {[
                { icon: Package, label: 'Component lots', value: `${comp.length} lots` },
                { icon: Factory, label: 'Built at', value: thread.order?.plant_name ?? head.plant },
                { icon: ShieldCheck, label: 'Final test', value: head.final_test_result.replace(/_/g, ' ') },
                { icon: Truck, label: 'Shipped', value: d(thread.order?.actual_ship_date) },
                { icon: User, label: 'Customer', value: `${head.sold_to} · ${head.sales_order}` },
              ].map((s, i, a) => (
                <div key={s.label} className="flex items-center gap-2">
                  <div className="rounded-lg border border-sky-200 bg-sky-50 px-3 py-2">
                    <p className="flex items-center gap-1 text-[10px] uppercase text-gray-500"><s.icon className="h-3 w-3" />{s.label}</p>
                    <p className="font-semibold text-gray-800">{s.value}</p>
                  </div>
                  {i < a.length - 1 && <ArrowRight className="h-4 w-4 text-sky-400" />}
                </div>
              ))}
            </div>
            <table className="min-w-full text-sm">
              <thead><tr className="bg-sf-dark text-left text-white">
                {['Component', 'Lot', 'Supplier', 'Received', 'Inspection', 'Deviation'].map((h) => <th key={h} className="px-3 py-2 font-medium">{h}</th>)}</tr></thead>
              <tbody>{comp.map((c: any, i: number) => (
                <tr key={c.lot_id} className={i % 2 ? 'bg-sky-50/50' : 'bg-white'}>
                  <td className="px-3 py-1.5">{c.component_desc}</td>
                  <td className="px-3 py-1.5 font-mono text-xs">{c.lot_id}</td>
                  <td className="px-3 py-1.5">{c.supplier_name}{c.supplier_source === 'DEMO' && <span className="ml-1 text-[10px] text-gray-400">(demo)</span>}</td>
                  <td className="px-3 py-1.5">{d(c.received_date)}</td>
                  <td className="px-3 py-1.5"><Pill v={c.inspection_result} map={RESULT} /></td>
                  <td className="px-3 py-1.5 text-xs text-gray-600">{c.deviation_note ?? '—'}</td>
                </tr>))}
              </tbody>
            </table>
            {head.defect_code && (
              <p className="mt-3 text-sm text-gray-600">Final test defect <span className="font-mono font-semibold">{head.defect_code}</span>,
                {' '}{head.rework_hrs} h rework, sensitivity {head.sensitivity_nm} nm.</p>
            )}
          </>
        )}
      </ChartCard>

      <ChartCard title="Component cover by plant">
        <div className="max-h-[360px] overflow-y-auto">
          <table className="min-w-full text-sm">
            <thead className="sticky top-0 bg-sf-dark text-left text-white"><tr>
              {['Plant', 'Component', 'Supplier', 'On hand', 'Usage/day', 'Cover', 'Lead time', 'Open PO', 'Status'].map((h) => <th key={h} className="px-3 py-2 font-medium">{h}</th>)}</tr></thead>
            <tbody>{cover.map((c: any, i: number) => (
              <tr key={c.plant_name + c.component_material} className={i % 2 ? 'bg-sky-50/50' : 'bg-white'}>
                <td className="px-3 py-1.5">{c.plant_name}</td><td className="px-3 py-1.5">{c.component_desc}</td>
                <td className="px-3 py-1.5">{c.supplier_name}</td><td className="px-3 py-1.5">{c.on_hand_qty}</td>
                <td className="px-3 py-1.5">{c.daily_usage}</td><td className="px-3 py-1.5 font-semibold">{c.days_of_cover} d</td>
                <td className="px-3 py-1.5">{c.supplier_lead_time_days} d</td><td className="px-3 py-1.5">{c.open_po_qty}</td>
                <td className="px-3 py-1.5"><Pill v={c.status} map={STATUS} /></td>
              </tr>))}
            </tbody>
          </table>
        </div>
      </ChartCard>
    </div>
  );
}
