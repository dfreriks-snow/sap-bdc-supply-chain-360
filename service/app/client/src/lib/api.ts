const BASE = '/api';

async function get<T>(path: string): Promise<T> {
  const res = await fetch(`${BASE}${path}`);
  if (!res.ok) throw new Error(`API ${path}: ${res.status}`);
  return res.json();
}

export function fetchPlants(): Promise<string[]> {
  return get('/plants');
}

export function fetchOverview(plants: string[]): Promise<any> {
  return get(`/overview?plants=${plants.join(',')}`);
}

export function fetchProduction(plants: string[]): Promise<any> {
  return get(`/production?plants=${plants.join(',')}`);
}

export function fetchBom(plants: string[]): Promise<any> {
  return get(`/bom?plants=${plants.join(',')}`);
}

export function fetchInventory(plants: string[]): Promise<any> {
  return get(`/inventory?plants=${plants.join(',')}`);
}

export function fetchLogistics(plants: string[]): Promise<any> {
  return get(`/logistics?plants=${plants.join(',')}`);
}

export function fetchWorkCenter(plants: string[]): Promise<any> {
  return get(`/workcenter?plants=${plants.join(',')}`);
}

export function fetchProjects(plants: string[]): Promise<any> {
  return get(`/projects?plants=${plants.join(',')}`);
}

export function fetchSupplyChainMap(plants: string[]): Promise<any> {
  return get(`/geography?plants=${plants.join(',')}`);
}

export function fetchLineage(): Promise<any> {
  return get('/lineage');
}

export async function fetchAnalyst(messages: { role: string; content: string }[]): Promise<any> {
  const res = await fetch(`${BASE}/analyst`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ messages }),
  });
  if (!res.ok) throw new Error(`API /analyst: ${res.status}`);
  return res.json();
}

export async function fetchOntology() {
  const res = await fetch(`${BASE}/ontology`);
  if (!res.ok) throw new Error(`API /ontology: ${res.status}`);
  return res.json();
}

export async function fetchOptimization(plants: string[]) {
  const res = await fetch(`${BASE}/optimization?plants=${encodeURIComponent(plants.join(','))}`);
  if (!res.ok) throw new Error(`API /optimization: ${res.status}`);
  return res.json();
}

export async function fetchForecasting(plants: string[]) {
  const res = await fetch(`${BASE}/forecasting?plants=${encodeURIComponent(plants.join(','))}`);
  if (!res.ok) throw new Error(`API /forecasting: ${res.status}`);
  return res.json();
}
