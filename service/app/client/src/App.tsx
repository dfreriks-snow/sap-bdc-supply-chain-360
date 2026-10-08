import { useState } from 'react';
import { FilterProvider } from '@/hooks/useFilters';
import Sidebar, { NAV_ITEMS, type PageId } from '@/components/Sidebar';
import Overview from '@/pages/Overview';
import Production from '@/pages/Production';
import Bom from '@/pages/Bom';
import Inventory from '@/pages/Inventory';
import Logistics from '@/pages/Logistics';
import WorkCenter from '@/pages/WorkCenter';
import Projects from '@/pages/Projects';
import Geography from '@/pages/Geography';
import Lineage from '@/pages/Lineage';
import Analyst from '@/pages/Analyst';
import Ontology from '@/pages/Ontology';
import Optimization from '@/pages/Optimization';
import Forecasting from '@/pages/Forecasting';
import Fulfillment from '@/pages/Fulfillment';
import EquipmentHealth from '@/pages/EquipmentHealth';
import Components from '@/pages/Components';
import AskCortex from '@/components/AskCortex';

// Pages whose analysis Cortex can explain in context: topic -> suggested follow-ups.
// (Fulfillment, Equipment and Components embed their own, richer Ask Cortex panels.)
const ASK: Partial<Record<PageId, { topic: string; suggestions: string[] }>> = {
  overview: { topic: 'overview', suggestions: ['What are the top three risks this quarter?', 'Which plant needs attention first and why?'] },
  production: { topic: 'production', suggestions: ['Which products drive most scrap?', 'Where is OEE falling and why?'] },
  bom: { topic: 'bom', suggestions: ['Which components dominate system cost?', 'Which high-cost components are short on cover?'] },
  inventory: { topic: 'inventory', suggestions: ['Where is working capital tied up?', 'What obsolete stock should we act on?'] },
  logistics: { topic: 'logistics', suggestions: ['Which shipping point is least reliable?', 'How much late cost is logistics vs production?'] },
  workcenter: { topic: 'workcenter', suggestions: ['Which work centers are bottlenecks?', 'Does tool risk threaten a bottleneck?'] },
  projects: { topic: 'projects', suggestions: ['Which projects are over budget?', 'What is driving schedule slip?'] },
  supplychain: { topic: 'supplychain', suggestions: ['Where is the network most concentrated?', 'Which supplier is weakest?'] },
  forecasting: { topic: 'forecasting', suggestions: ['Is demand outrunning capacity?', 'What trend should planning watch?'] },
};

const PAGE_COMPONENTS: Record<string, React.FC> = {
  overview: Overview,
  production: Production,
  bom: Bom,
  inventory: Inventory,
  logistics: Logistics,
  workcenter: WorkCenter,
  projects: Projects,
  supplychain: Geography,
  lineage: Lineage,
  analyst: Analyst,
  ontology: Ontology,
  optimization: Optimization,
  forecasting: Forecasting,
  fulfillment: Fulfillment,
  equipment: EquipmentHealth,
  components: Components,
};

function Placeholder({ name }: { name: string }) {
  return (
    <div className="flex h-64 items-center justify-center rounded-xl border border-dashed border-sf-primary/30 bg-sky-50/30">
      <p className="text-lg text-sf-dark/60">{name} — coming soon</p>
    </div>
  );
}

function AppShell() {
  const [activePage, setActivePage] = useState<PageId>('overview');

  const navItem = NAV_ITEMS.find((n) => n.id === activePage)!;
  const Icon = navItem.icon;
  const PageComponent = PAGE_COMPONENTS[activePage];

  return (
    <div className="min-h-screen bg-gray-50">
      <Sidebar activePage={activePage} onNavigate={setActivePage} />
      <main className="ml-64 min-h-screen p-6">
        <div className="mb-6 flex items-center gap-3">
          <Icon className="h-6 w-6 text-sf-primary" />
          <h1 className="text-2xl font-bold text-sf-deeper">{navItem.label}</h1>
        </div>
        {ASK[activePage] && (
          <div className="mb-6">
            <AskCortex key={activePage} topic={ASK[activePage]!.topic} suggestions={ASK[activePage]!.suggestions}
              label={`Ask Cortex about ${navItem.label}`} />
          </div>
        )}
        {PageComponent ? (
          <PageComponent />
        ) : (
          <Placeholder name={navItem.label} />
        )}
      </main>
    </div>
  );
}

export default function App() {
  return (
    <FilterProvider>
      <AppShell />
    </FilterProvider>
  );
}
