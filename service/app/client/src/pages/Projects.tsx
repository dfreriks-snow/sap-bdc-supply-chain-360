import { useQuery } from '@/hooks/useQuery';
import { fetchProjects } from '@/lib/api';
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

export default function Projects() {
  const { data, loading, error } = useQuery(() => fetchProjects([]), []);

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

  const raw: any[] = data ?? [];
  // Deduplicate by project_id
  const seen = new Set<string>();
  const projects: any[] = [];
  raw.forEach((r) => { if (!seen.has(r.project_id)) { seen.add(r.project_id); projects.push(r); } });

  const avgComp = projects.length > 0 ? Math.round(projects.reduce((s: number, p) => s + (p.completion_pct ?? 0), 0) / projects.length) : 0;
  const totalBudget = projects.reduce((s: number, p) => s + (p.planned_cost ?? 0), 0);
  const avgVariance = projects.length > 0 ? +(projects.reduce((s: number, p) => s + (p.budget_variance_pct ?? 0), 0) / projects.length).toFixed(1) : 0;

  // Status distribution
  const statusCounts: Record<string, number> = {};
  projects.forEach((p) => { statusCounts[p.project_status] = (statusCounts[p.project_status] ?? 0) + 1; });
  const statusData = Object.entries(statusCounts).map(([name, value], i) => ({
    name, value, itemStyle: { color: PALETTE[i % PALETTE.length] },
  }));

  // Over budget alerts
  const overBudget = projects.filter((p) => p.budget_variance_pct > 5);

  // ── ECharts: Status (ranked bar via Chart policy) ──
  const statusOption = {
    tooltip: {
      trigger: 'item',
      backgroundColor: 'rgba(255,255,255,0.95)',
      borderColor: '#e5e7eb',
      borderWidth: 1,
      formatter: '{b}: {c} projects ({d}%)',
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
      center: ['38%', '50%'],
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

  // ── ECharts: Completion by Project (horizontal bar with gradient) ──
  const sortedProjects = [...projects].sort((a, b) => (a.completion_pct ?? 0) - (b.completion_pct ?? 0));
  const completionOption = {
    tooltip: {
      trigger: 'axis',
      backgroundColor: 'rgba(255,255,255,0.95)',
      borderColor: '#e5e7eb',
      borderWidth: 1,
      axisPointer: { type: 'shadow' },
      formatter: (params: any) => `<strong>${params[0].name}</strong><br/>Completion: ${params[0].value}%`,
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
      data: sortedProjects.map((p) => p.project_name),
      axisLabel: { color: '#374151', fontSize: 11, fontWeight: 500 },
      axisLine: { show: false },
      axisTick: { show: false },
    },
    series: [{
      type: 'bar',
      data: sortedProjects.map((p) => ({
        value: p.completion_pct ?? 0,
        itemStyle: {
          color: (p.completion_pct ?? 0) >= 80
            ? { type: 'linear', x: 0, y: 0, x2: 1, y2: 0, colorStops: [{ offset: 0, color: '#10b981' }, { offset: 1, color: '#10b98160' }] }
            : (p.completion_pct ?? 0) >= 50
            ? { type: 'linear', x: 0, y: 0, x2: 1, y2: 0, colorStops: [{ offset: 0, color: '#f59e0b' }, { offset: 1, color: '#f59e0b60' }] }
            : { type: 'linear', x: 0, y: 0, x2: 1, y2: 0, colorStops: [{ offset: 0, color: '#ef4444' }, { offset: 1, color: '#ef444460' }] },
          borderRadius: [0, 5, 5, 0],
        },
      })),
      barWidth: '55%',
    }],
    animationDuration: 900,
    animationEasing: 'elasticOut',
  };

  // ── ECharts: Project Timeline (Gantt-style) ──
  const timelineProjects = [...projects].sort((a, b) => (a.start_date ?? '').localeCompare(b.start_date ?? ''));
  const minDate = timelineProjects[0]?.start_date ?? '2025-01-01';
  const maxDate = timelineProjects[timelineProjects.length - 1]?.end_date ?? '2026-01-01';
  const ganttOption = {
    tooltip: {
      trigger: 'item',
      backgroundColor: 'rgba(255,255,255,0.95)',
      borderColor: '#e5e7eb',
      borderWidth: 1,
      formatter: (params: any) => {
        const d = params.data;
        return `<strong>${params.name}</strong><br/>Status: ${d.status}<br/>${d.start} → ${d.end}<br/>Completion: ${d.completion}%`;
      },
    },
    grid: { top: 10, right: 30, bottom: 30, left: 130 },
    xAxis: {
      type: 'time',
      min: minDate,
      max: maxDate,
      axisLabel: { color: '#6b7280', fontSize: 11 },
      axisLine: { lineStyle: { color: '#e5e7eb' } },
      splitLine: { lineStyle: { color: '#f3f4f6', type: 'dashed' } },
    },
    yAxis: {
      type: 'category',
      data: timelineProjects.map((p) => p.project_name),
      axisLabel: { color: '#374151', fontSize: 11, fontWeight: 500 },
      axisLine: { show: false },
      axisTick: { show: false },
    },
    series: [{
      type: 'custom',
      renderItem: (params: any, api: any) => {
        const categoryIndex = api.value(0);
        const start = api.coord([api.value(1), categoryIndex]);
        const end = api.coord([api.value(2), categoryIndex]);
        const height = api.size([0, 1])[1] * 0.5;
        return {
          type: 'rect',
          shape: { x: start[0], y: start[1] - height / 2, width: end[0] - start[0], height },
          style: { ...api.style(), fill: api.value(3), rx: 4, ry: 4 },
        };
      },
      encode: { x: [1, 2], y: 0 },
      data: timelineProjects.map((p, i) => ({
        name: p.project_name,
        value: [i, new Date(p.start_date).getTime(), new Date(p.end_date).getTime(), PALETTE[i % PALETTE.length]],
        status: p.project_status,
        start: p.start_date,
        end: p.end_date,
        completion: p.completion_pct,
        itemStyle: { color: PALETTE[i % PALETTE.length] },
      })),
    }],
    animationDuration: 1000,
    animationEasing: 'cubicOut',
  };

  // ── ECharts: Budget Planned vs Actual (grouped bar) ──
  const budgetOption = {
    tooltip: {
      trigger: 'axis',
      backgroundColor: 'rgba(255,255,255,0.95)',
      borderColor: '#e5e7eb',
      borderWidth: 1,
      axisPointer: { type: 'shadow' },
      formatter: (params: any) => {
        const lines = params.map((p: any) => `${p.seriesName}: $${Number(p.value).toLocaleString()}`);
        return `<strong>${params[0].name}</strong><br/>${lines.join('<br/>')}`;
      },
    },
    legend: {
      data: ['Planned', 'Actual'],
      bottom: 0,
      textStyle: { color: '#6b7280', fontSize: 11 },
      icon: 'roundRect',
    },
    grid: { top: 15, right: 30, bottom: 45, left: 130 },
    xAxis: {
      type: 'value',
      axisLabel: { color: '#6b7280', fontSize: 11, formatter: (v: number) => `$${(v / 1000).toFixed(0)}k` },
      splitLine: { lineStyle: { color: '#f3f4f6', type: 'dashed' } },
    },
    yAxis: {
      type: 'category',
      data: projects.map((p) => p.project_name),
      axisLabel: { color: '#374151', fontSize: 11, fontWeight: 500 },
      axisLine: { show: false },
      axisTick: { show: false },
    },
    series: [
      {
        name: 'Planned',
        type: 'bar',
        data: projects.map((p) => p.planned_cost ?? 0),
        itemStyle: { color: '#06b6d4', borderRadius: [0, 4, 4, 0] },
        barWidth: '35%',
      },
      {
        name: 'Actual',
        type: 'bar',
        data: projects.map((p) => p.actual_cost ?? 0),
        itemStyle: { color: '#8b5cf6', borderRadius: [0, 4, 4, 0] },
        barWidth: '35%',
      },
    ],
    animationDuration: 900,
    animationEasing: 'cubicOut',
  };

  return (
    <Tabs.Root defaultValue="status">
      <Tabs.List className="mb-6 flex gap-1 border-b border-gray-200">
        <Tabs.Trigger value="status" className={tabClass}>Status Overview</Tabs.Trigger>
        <Tabs.Trigger value="budget" className={tabClass}>Budget Analysis</Tabs.Trigger>
      </Tabs.List>

      <Tabs.Content value="status" className="space-y-6">
        <div className="grid grid-cols-4 gap-5">
          <MetricCard title="Active Projects" value={projects.length.toLocaleString()} icon={Factory} accent={ACCENTS[0]} />
          <MetricCard title="Avg Completion" value={`${avgComp}%`} icon={CheckCircle2} accent={ACCENTS[1]} />
          <MetricCard title="Total Budget" value={`$${totalBudget.toLocaleString()}`} icon={Timer} accent={ACCENTS[2]} />
          <MetricCard title="Avg Budget Variance" value={`${avgVariance >= 0 ? '+' : ''}${avgVariance}%`} icon={TrendingUp} accent={ACCENTS[3]} />
        </div>

        <div className="grid grid-cols-2 gap-5">
          <ChartCard title="Projects by Status" subtitle="Distribution of project statuses">
            <ReactECharts option={statusOption} style={{ height: 280 }} />
          </ChartCard>
          <ChartCard title="Completion by Project" subtitle="Green ≥80%, Amber ≥50%, Red <50%">
            <ReactECharts option={completionOption} style={{ height: 280 }} />
          </ChartCard>
        </div>

        <ChartCard title="Project Timeline" subtitle="Gantt chart showing start/end dates per project">
          <ReactECharts option={ganttOption} style={{ height: 280 }} />
        </ChartCard>
      </Tabs.Content>

      <Tabs.Content value="budget" className="space-y-6">
        <div className="grid grid-cols-2 gap-5">
          <ChartCard title="Budget: Planned vs Actual" subtitle="Side-by-side comparison per project">
            <ReactECharts option={budgetOption} style={{ height: 320 }} />
          </ChartCard>
          <div className="space-y-5">
            {overBudget.length > 0 ? (
              <div className="rounded-xl border border-red-300 bg-gradient-to-r from-red-50 to-rose-50 p-5 shadow-sm">
                <h3 className="mb-3 text-sm font-bold text-red-900">Budget Variance Alerts (&gt;5% over)</h3>
                {overBudget.map((p) => (
                  <div key={p.project_id} className="mb-2 flex items-center justify-between rounded-lg bg-white/70 px-3 py-2.5">
                    <div>
                      <span className="text-sm font-semibold text-gray-800">{p.project_name}</span>
                      <span className="ml-2 text-xs text-gray-500">
                        ${(p.actual_cost ?? 0).toLocaleString()} vs ${(p.planned_cost ?? 0).toLocaleString()}
                      </span>
                    </div>
                    <span className="rounded-full bg-red-100 px-2.5 py-0.5 text-xs font-bold text-red-700">
                      +{(p.budget_variance_pct ?? 0).toFixed(1)}%
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <div className="rounded-xl border border-green-300 bg-gradient-to-r from-green-50 to-emerald-50 p-6 text-center shadow-sm">
                <p className="text-lg font-semibold text-green-800">All projects within 5% budget tolerance</p>
              </div>
            )}
          </div>
        </div>

        <DataTable
          columns={[
            { key: 'project_name', label: 'Project' },
            { key: 'project_status', label: 'Status' },
            { key: 'planned_cost', label: 'Planned ($)' },
            { key: 'actual_cost', label: 'Actual ($)' },
            { key: 'budget_variance_pct', label: 'Variance %' },
            { key: 'completion_pct', label: 'Completion %' },
            { key: 'wbs_description', label: 'WBS' },
          ]}
          data={raw}
        />
      </Tabs.Content>
    </Tabs.Root>
  );
}
