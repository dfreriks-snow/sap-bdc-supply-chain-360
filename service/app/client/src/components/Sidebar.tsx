import {
  LayoutDashboard,
  Factory,
  GitBranch,
  Warehouse,
  Truck,
  Settings,
  FolderKanban,
  Globe,
  Database,
  Bot,
  Check,
  Network,
  Sparkles,
  TrendingUp,
  ClipboardCheck,
  Activity,
  Boxes,
} from 'lucide-react';
import { useFilters } from '@/hooks/useFilters';
import { cn } from '@/lib/utils';

export type PageId =
  | 'overview'
  | 'production'
  | 'bom'
  | 'inventory'
  | 'logistics'
  | 'fulfillment'
  | 'equipment'
  | 'components'
  | 'workcenter'
  | 'projects'
  | 'supplychain'
  | 'ontology'
  | 'optimization'
  | 'forecasting'
  | 'lineage'
  | 'analyst';

export interface NavItem {
  id: PageId;
  label: string;
  icon: React.ElementType;
}

export const NAV_ITEMS: NavItem[] = [
  { id: 'overview', label: 'Executive Overview', icon: LayoutDashboard },
  { id: 'production', label: 'Production Planning', icon: Factory },
  { id: 'bom', label: 'Bill of Materials', icon: GitBranch },
  { id: 'inventory', label: 'Inventory & Warehouse', icon: Warehouse },
  { id: 'logistics', label: 'Logistics & Delivery', icon: Truck },
  { id: 'fulfillment', label: 'Fulfillment & Constraints', icon: ClipboardCheck },
  { id: 'equipment', label: 'Equipment Health', icon: Activity },
  { id: 'components', label: 'Components & Digital Thread', icon: Boxes },
  { id: 'workcenter', label: 'Work Center & Capacity', icon: Settings },
  { id: 'projects', label: 'Project Management', icon: FolderKanban },
  { id: 'supplychain', label: 'Supply Chain Map', icon: Globe },
  { id: 'ontology', label: 'Supply Chain Ontology', icon: Network },
  { id: 'optimization', label: 'SC Optimization', icon: Sparkles },
  { id: 'forecasting', label: 'SC Forecasting', icon: TrendingUp },
  { id: 'lineage', label: 'BDC Sources & Lineage', icon: GitBranch },
  { id: 'analyst', label: 'Cortex Analyst', icon: Bot },
];

interface SidebarProps {
  activePage: PageId;
  onNavigate: (page: PageId) => void;
}

export default function Sidebar({ activePage, onNavigate }: SidebarProps) {
  const { plants, selectedPlants, setSelectedPlants } = useFilters();

  function togglePlant(plant: string) {
    if (selectedPlants.includes(plant)) {
      setSelectedPlants(selectedPlants.filter((p) => p !== plant));
    } else {
      setSelectedPlants([...selectedPlants, plant]);
    }
  }

  function selectAll() {
    setSelectedPlants([...plants]);
  }

  function selectNone() {
    setSelectedPlants([]);
  }

  return (
    <aside className="fixed left-0 top-0 z-40 flex h-screen w-64 flex-col bg-gradient-to-b from-sf-dark to-sf-deeper text-white">
      {/* Logo */}
      <div className="flex flex-col gap-1.5 border-b border-white/10 px-5 py-4">
        <img
          src={`${import.meta.env.BASE_URL}snowflake_logo.svg`}
          alt="Snowflake"
          className="h-7 w-auto self-start"
        />
        <span className="text-lg font-bold tracking-tight text-white">
          Supply Chain 360
        </span>
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto px-3 py-3">
        <ul className="space-y-0.5">
          {NAV_ITEMS.map((item) => {
            const Icon = item.icon;
            const active = activePage === item.id;
            return (
              <li key={item.id}>
                <button
                  onClick={() => onNavigate(item.id)}
                  className={cn(
                    'flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-left text-sm transition-colors',
                    active
                      ? 'bg-sf-primary/20 text-sf-light font-medium'
                      : 'text-sf-pale/80 hover:bg-white/5 hover:text-white'
                  )}
                >
                  <Icon className="h-4 w-4 shrink-0" />
                  {item.label}
                </button>
              </li>
            );
          })}
        </ul>
      </nav>

      {/* Plant Filter */}
      <div className="border-t border-white/10 px-4 py-3">
        <div className="mb-2 flex items-center justify-between">
          <span className="text-xs font-semibold uppercase tracking-wider text-sf-pale/70">
            Plants
          </span>
          <div className="flex gap-2 text-[10px]">
            <button onClick={selectAll} className="text-sf-light hover:underline">
              All
            </button>
            <button onClick={selectNone} className="text-sf-light hover:underline">
              None
            </button>
          </div>
        </div>
        <div className="max-h-32 space-y-0.5 overflow-y-auto">
          {plants.map((p) => {
            const checked = selectedPlants.includes(p);
            return (
              <button
                key={p}
                onClick={() => togglePlant(p)}
                className="flex w-full items-center gap-2 rounded px-2 py-1 text-left text-xs text-sf-pale/80 hover:bg-white/5"
              >
                <span
                  className={cn(
                    'flex h-3.5 w-3.5 shrink-0 items-center justify-center rounded-sm border',
                    checked
                      ? 'border-sf-primary bg-sf-primary'
                      : 'border-sf-pale/40'
                  )}
                >
                  {checked && <Check className="h-2.5 w-2.5 text-white" />}
                </span>
                <span className="truncate">
                  {p}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Footer */}
      <div className="border-t border-white/10 px-5 py-3">
        <p className="text-[10px] leading-relaxed text-sf-pale/50">
          SAP BDC &nbsp;|&nbsp; 16 products &nbsp;|&nbsp; 177 entities
        </p>
      </div>
    </aside>
  );
}
