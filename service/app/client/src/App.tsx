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
