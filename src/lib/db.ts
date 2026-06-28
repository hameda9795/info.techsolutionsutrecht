import type {
  Client,
  Project,
  Document,
  Payment,
  PurchaseInvoice,
  BtwPeriodMeta,
} from '@/types';

export const generateId = (): string =>
  Math.random().toString(36).substring(2, 15) +
  Math.random().toString(36).substring(2, 15);

// Points at the small backend (Fastify + Postgres) running on the user's own
// Hetzner server — see server/ in this repo. Override via VITE_API_BASE_URL if
// ever needed (e.g. local backend development).
const API_BASE = import.meta.env.VITE_API_BASE_URL ?? 'https://api.techsolutionsutrecht.nl';

async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    ...init,
    credentials: 'include',
    // Only set Content-Type when there's an actual body — sending it on a bodyless
    // request (e.g. finalize, logout) makes Fastify's JSON parser reject the request
    // outright with "Body cannot be empty when content-type is set to 'application/json'".
    headers: { ...(init?.body ? { 'Content-Type': 'application/json' } : {}), ...(init?.headers ?? {}) },
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}) as { error?: string });
    throw new Error(body.error ?? `Verzoek mislukt (${res.status})`);
  }
  if (res.status === 204) return undefined as T;
  return res.json() as Promise<T>;
}

const get = <T>(path: string) => apiFetch<T>(path);
const put = <T>(path: string, body: unknown) =>
  apiFetch<T>(path, { method: 'PUT', body: JSON.stringify(body) });
const del = (path: string) => apiFetch<{ ok: true }>(path, { method: 'DELETE' });
const post = <T>(path: string, body?: unknown) =>
  apiFetch<T>(path, { method: 'POST', body: body ? JSON.stringify(body) : undefined });

// ===== Clients =====
export const saveClient = (c: Client) => put<{ ok: true }>(`/api/clients/${c.id}`, c);
export const deleteClient = (id: string) => del(`/api/clients/${id}`);
export const getClient = async (id: string): Promise<Client | undefined> => {
  try {
    return await get<Client>(`/api/clients/${id}`);
  } catch {
    return undefined;
  }
};
export const getAllClients = () => get<Client[]>('/api/clients');

// ===== Projects =====
export const saveProject = (p: Project) => put<{ ok: true }>(`/api/projects/${p.id}`, p);
export const deleteProject = (id: string) => del(`/api/projects/${id}`);
export const getProject = async (id: string): Promise<Project | undefined> => {
  try {
    return await get<Project>(`/api/projects/${id}`);
  } catch {
    return undefined;
  }
};
export const getAllProjects = () => get<Project[]>('/api/projects');
export const getProjectsByClient = (clientId: string) =>
  get<Project[]>(`/api/projects?clientId=${encodeURIComponent(clientId)}`);

// ===== Documents =====
// Note: saveDocument now returns the canonical (server-recomputed) Document —
// callers that only awaited it before are unaffected, but lib/documents.ts uses
// the return value as the new source of truth instead of recomputing locally.
export const saveDocument = (d: Document) => put<Document>(`/api/documents/${d.id}`, d);
export const deleteDocument = (id: string) => del(`/api/documents/${id}`);
export const getDocument = async (id: string): Promise<Document | undefined> => {
  try {
    return await get<Document>(`/api/documents/${id}`);
  } catch {
    return undefined;
  }
};
export const getAllDocuments = () => get<Document[]>('/api/documents');
export const getDocumentsByProject = (projectId: string) =>
  get<Document[]>(`/api/documents?projectId=${encodeURIComponent(projectId)}`);

// ===== Payments =====
export const savePayment = (p: Payment) => put<{ ok: true }>(`/api/payments/${p.id}`, p);
export const deletePayment = (id: string) => del(`/api/payments/${id}`);
export const getAllPayments = () => get<Payment[]>('/api/payments');
export const getPaymentsByDocument = (documentId: string) =>
  get<Payment[]>(`/api/payments?documentId=${encodeURIComponent(documentId)}`);
export const getPaymentsByProject = (projectId: string) =>
  get<Payment[]>(`/api/payments?projectId=${encodeURIComponent(projectId)}`);

// ===== Inkoopfacturen / kosten (voorbelasting) =====
export const savePurchaseInvoice = (p: PurchaseInvoice) =>
  put<{ ok: true }>(`/api/purchase-invoices/${p.id}`, p);
export const deletePurchaseInvoice = (id: string) => del(`/api/purchase-invoices/${id}`);
export const getAllPurchaseInvoices = () => get<PurchaseInvoice[]>('/api/purchase-invoices');

// ===== Btw-tijdvak status (open / prepared / submitted / paid / corrected) =====
export const saveBtwPeriod = (m: BtwPeriodMeta) => put<{ ok: true }>(`/api/btw-periods/${m.id}`, m);
export const getAllBtwPeriods = () => get<BtwPeriodMeta[]>('/api/btw-periods');

// ===== Counters (read-only overview) =====
export interface CounterRow {
  id: string;
  prefix: string;
  year: number;
  value: number;
}
export const getAllCounters = () => get<CounterRow[]>('/api/counters');

// ===== Legacy archive (read-only) =====
export const getLegacyInvoices = () => get<Record<string, unknown>[]>('/api/legacy-invoices');

// ===== Attachments (inkoopfactuur bijlagen) =====
export interface UploadedAttachment {
  url: string;
  path: string;
  name: string;
}
export const uploadAttachment = async (
  purchaseInvoiceId: string,
  file: File
): Promise<UploadedAttachment> => {
  const formData = new FormData();
  formData.append('file', file);
  const res = await fetch(`${API_BASE}/api/attachments/purchase-invoices/${purchaseInvoiceId}`, {
    method: 'POST',
    credentials: 'include',
    body: formData,
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}) as { error?: string });
    throw new Error(body.error ?? 'Uploaden mislukt');
  }
  return res.json();
};
export const deleteAttachment = (purchaseInvoiceId: string) =>
  del(`/api/attachments/purchase-invoices/${purchaseInvoiceId}`);

// ===== Auth =====
export const login = (password: string) =>
  apiFetch<{ ok: true }>('/api/auth/login', { method: 'POST', body: JSON.stringify({ password }) });
export const logout = () => apiFetch<{ ok: true }>('/api/auth/logout', { method: 'POST' });
export const checkSession = async (): Promise<boolean> => {
  try {
    await get('/api/auth/me');
    return true;
  } catch {
    return false;
  }
};

// ===== Document business-logic endpoints (server-enforced invariants) =====
export const finalizeDocumentApi = (id: string) => post<Document>(`/api/documents/${id}/finalize`);
export const createCreditNoteApi = (
  id: string,
  body: { items?: Document['items']; reason: string; issueDate: string }
) => post<Document>(`/api/documents/${id}/credit-note`, body);
export const recordPaymentApi = (
  id: string,
  body: { amount: number; paymentDate: string; paymentMethod?: string; note?: string }
) => post<Document>(`/api/documents/${id}/payments`, body);
