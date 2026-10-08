// Data access layer. Two modes:
//   - Live (default): fetch from the Express server at /api/*
//   - Static (VITE_STATIC=1): read pre-baked JSON snapshots from <base>/data/*
//     and route the Cortex agent to VITE_AGENT_URL (a serverless function).
const STATIC = import.meta.env.VITE_STATIC === '1';
const AGENT_BASE = (import.meta.env.VITE_AGENT_URL ?? '').replace(/\/$/, '');
const DATA_BASE = `${import.meta.env.BASE_URL}data`;
const BASE = '/api';

/** Canonical filter key — MUST match filterKey() in scripts/export-static.mjs. */
function plantKey(plants: string[]): string {
  return [...plants].sort().join(',');
}

async function liveGet<T>(path: string): Promise<T> {
  const res = await fetch(`${BASE}${path}`);
  if (!res.ok) throw new Error(`API error: ${res.status}`);
  return res.json();
}

const fileCache = new Map<string, Promise<any>>();
function loadStaticFile(file: string): Promise<any> {
  let p = fileCache.get(file);
  if (!p) {
    p = fetch(`${DATA_BASE}/${file}.json`).then((res) => {
      if (!res.ok) throw new Error(`Static data error: ${res.status} ${file}`);
      return res.json();
    });
    fileCache.set(file, p);
  }
  return p;
}

/** Plant-filtered endpoint: live /api call or a keyed static snapshot. */
async function getKeyed<T>(livePath: string, staticFile: string, plants: string[]): Promise<T> {
  if (STATIC) {
    const map = await loadStaticFile(staticFile);
    return (map[plantKey(plants)] ?? {}) as T;
  }
  return liveGet<T>(`${livePath}?plants=${encodeURIComponent(plants.join(','))}`);
}

/** Unfiltered endpoint: live /api call or a single static snapshot file. */
async function getSingle<T>(livePath: string, staticFile: string): Promise<T> {
  if (STATIC) return loadStaticFile(staticFile) as Promise<T>;
  return liveGet<T>(livePath);
}

export function fetchPlants(): Promise<string[]> {
  return getSingle<string[]>('/plants', 'plants');
}

export function fetchOverview(plants: string[]): Promise<any> {
  return getKeyed<any>('/overview', 'overview', plants);
}

export function fetchProduction(plants: string[]): Promise<any> {
  return getKeyed<any>('/production', 'production', plants);
}

export function fetchBom(plants: string[]): Promise<any> {
  return getKeyed<any>('/bom', 'bom', plants);
}

export function fetchInventory(plants: string[]): Promise<any> {
  return getKeyed<any>('/inventory', 'inventory', plants);
}

export function fetchLogistics(plants: string[]): Promise<any> {
  return getKeyed<any>('/logistics', 'logistics', plants);
}

export function fetchWorkCenter(plants: string[]): Promise<any> {
  return getKeyed<any>('/workcenter', 'workcenter', plants);
}

export function fetchProjects(plants: string[]): Promise<any> {
  return getKeyed<any>('/projects', 'projects', plants);
}

export function fetchSupplyChainMap(plants: string[]): Promise<any> {
  return getKeyed<any>('/geography', 'geography', plants);
}

export function fetchLineage(): Promise<any> {
  return getSingle<any>('/lineage', 'lineage');
}

export function fetchOntology(): Promise<any> {
  return getSingle<any>('/ontology', 'ontology');
}

export function fetchOptimization(plants: string[]): Promise<any> {
  return getKeyed<any>('/optimization', 'optimization', plants);
}

export function fetchForecasting(plants: string[]): Promise<any> {
  return getKeyed<any>('/forecasting', 'forecasting', plants);
}

export async function fetchAnalyst(messages: { role: string; content: string }[]): Promise<any> {
  const base = STATIC ? AGENT_BASE : BASE;
  const res = await fetch(`${base}/analyst`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ messages }),
  });
  if (!res.ok) throw new Error(`API /analyst: ${res.status}`);
  return res.json();
}

// ── Operations extension ────────────────────────────────────────────────────
export function fetchFulfillment(plants: string[]): Promise<any> {
  return getKeyed<any>('/fulfillment', 'fulfillment', plants);
}

export function fetchEquipment(plants: string[]): Promise<any> {
  return getKeyed<any>('/equipment', 'equipment', plants);
}

export function fetchComponents(plants: string[]): Promise<any> {
  return getKeyed<any>('/components', 'components', plants);
}

export function fetchSerials(plants: string[]): Promise<any[]> {
  return getKeyed<any[]>('/thread/serials', 'thread_serials', plants);
}

export async function fetchThread(serial: string): Promise<any> {
  if (STATIC) return ((await loadStaticFile('thread')) as Record<string, any>)[serial] ?? null;
  return liveGet<any>(`/thread/${encodeURIComponent(serial)}`);
}

// ── Ask Cortex ──────────────────────────────────────────────────────────────
// Live: POST starts a background job, then poll until done.
// Static: answers for each topic's default question are baked at export time;
// free-text questions are routed to the agent endpoint when one is configured.
export interface AskCortexRequest {
  topic: string;
  args?: Record<string, string>;
  question?: string;
}

export function askKey(r: AskCortexRequest): string {
  const a = Object.entries(r.args ?? {}).sort().map(([k, v]) => `${k}=${v}`).join('&');
  return a ? `${r.topic}?${a}` : r.topic;
}

export async function askCortex(r: AskCortexRequest, signal?: AbortSignal): Promise<string> {
  if (STATIC) {
    const baked = (await loadStaticFile('ask_cortex')) as Record<string, string>;
    if (!r.question && baked[askKey(r)]) return baked[askKey(r)];
    if (AGENT_BASE && r.question) {
      const res = await fetch(`${AGENT_BASE}/ask-cortex`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(r), signal,
      });
      if (res.ok) return (await res.json()).answer;
    }
    return baked[askKey(r)] ??
      '_Live Cortex analysis is not available in this static build. Run the app against Snowflake to ask your own question._';
  }
  const start = await fetch(`${BASE}/ask-cortex`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(r), signal,
  });
  if (!start.ok) throw new Error(`Ask Cortex: ${start.status}`);
  const { id } = await start.json();
  for (let i = 0; i < 90; i++) {
    await new Promise((res) => setTimeout(res, 2000));
    if (signal?.aborted) throw new Error('cancelled');
    const j = await liveGet<any>(`/ask-cortex/${id}`);
    if (j.status === 'done') return j.answer;
    if (j.status === 'error') throw new Error(j.error);
  }
  throw new Error('Ask Cortex timed out');
}
