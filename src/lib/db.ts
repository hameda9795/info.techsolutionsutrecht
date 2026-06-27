import { db } from './firebase';
import {
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  deleteDoc,
  query,
  where,
} from 'firebase/firestore';
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

const CLIENTS = 'clients';
const PROJECTS = 'projects';
const DOCUMENTS = 'documents';
const PAYMENTS = 'payments';
const PURCHASE_INVOICES = 'purchaseInvoices';
const BTW_PERIODS = 'btwPeriods';
const LEGACY_INVOICES = 'invoices';

// Strip undefined fields — Firestore rejects `undefined` values.
const clean = <T extends object>(obj: T): T =>
  JSON.parse(JSON.stringify(obj));

// ===== Clients =====
export const saveClient = (c: Client) => setDoc(doc(db, CLIENTS, c.id), clean(c));
export const deleteClient = (id: string) => deleteDoc(doc(db, CLIENTS, id));
export const getClient = async (id: string): Promise<Client | undefined> => {
  const s = await getDoc(doc(db, CLIENTS, id));
  return s.exists() ? (s.data() as Client) : undefined;
};
export const getAllClients = async (): Promise<Client[]> => {
  const s = await getDocs(collection(db, CLIENTS));
  return s.docs.map((d) => d.data() as Client);
};

// ===== Projects =====
export const saveProject = (p: Project) => setDoc(doc(db, PROJECTS, p.id), clean(p));
export const deleteProject = (id: string) => deleteDoc(doc(db, PROJECTS, id));
export const getProject = async (id: string): Promise<Project | undefined> => {
  const s = await getDoc(doc(db, PROJECTS, id));
  return s.exists() ? (s.data() as Project) : undefined;
};
export const getAllProjects = async (): Promise<Project[]> => {
  const s = await getDocs(collection(db, PROJECTS));
  return s.docs.map((d) => d.data() as Project);
};
export const getProjectsByClient = async (clientId: string): Promise<Project[]> => {
  const s = await getDocs(query(collection(db, PROJECTS), where('clientId', '==', clientId)));
  return s.docs.map((d) => d.data() as Project);
};

// ===== Documents =====
export const saveDocument = (d: Document) => setDoc(doc(db, DOCUMENTS, d.id), clean(d));
export const deleteDocument = (id: string) => deleteDoc(doc(db, DOCUMENTS, id));
export const getDocument = async (id: string): Promise<Document | undefined> => {
  const s = await getDoc(doc(db, DOCUMENTS, id));
  return s.exists() ? (s.data() as Document) : undefined;
};
export const getAllDocuments = async (): Promise<Document[]> => {
  const s = await getDocs(collection(db, DOCUMENTS));
  return s.docs.map((d) => d.data() as Document);
};
export const getDocumentsByProject = async (projectId: string): Promise<Document[]> => {
  const s = await getDocs(query(collection(db, DOCUMENTS), where('projectId', '==', projectId)));
  return s.docs.map((d) => d.data() as Document);
};

// ===== Payments =====
export const savePayment = (p: Payment) => setDoc(doc(db, PAYMENTS, p.id), clean(p));
export const deletePayment = (id: string) => deleteDoc(doc(db, PAYMENTS, id));
export const getAllPayments = async (): Promise<Payment[]> => {
  const s = await getDocs(collection(db, PAYMENTS));
  return s.docs.map((d) => d.data() as Payment);
};
export const getPaymentsByDocument = async (documentId: string): Promise<Payment[]> => {
  const s = await getDocs(query(collection(db, PAYMENTS), where('documentId', '==', documentId)));
  return s.docs.map((d) => d.data() as Payment);
};
export const getPaymentsByProject = async (projectId: string): Promise<Payment[]> => {
  const s = await getDocs(query(collection(db, PAYMENTS), where('projectId', '==', projectId)));
  return s.docs.map((d) => d.data() as Payment);
};

// ===== Inkoopfacturen / kosten (voorbelasting) =====
export const savePurchaseInvoice = (p: PurchaseInvoice) =>
  setDoc(doc(db, PURCHASE_INVOICES, p.id), clean(p));
export const deletePurchaseInvoice = (id: string) =>
  deleteDoc(doc(db, PURCHASE_INVOICES, id));
export const getAllPurchaseInvoices = async (): Promise<PurchaseInvoice[]> => {
  const s = await getDocs(collection(db, PURCHASE_INVOICES));
  return s.docs.map((d) => d.data() as PurchaseInvoice);
};

// ===== Btw-tijdvak status (open / prepared / submitted / paid / corrected) =====
export const saveBtwPeriod = (m: BtwPeriodMeta) =>
  setDoc(doc(db, BTW_PERIODS, m.id), clean(m));
export const getAllBtwPeriods = async (): Promise<BtwPeriodMeta[]> => {
  const s = await getDocs(collection(db, BTW_PERIODS));
  return s.docs.map((d) => d.data() as BtwPeriodMeta);
};

// ===== Counters (read-only overview) =====
export interface CounterRow {
  id: string;
  prefix: string;
  year: number;
  value: number;
}
export const getAllCounters = async (): Promise<CounterRow[]> => {
  const s = await getDocs(collection(db, 'counters'));
  return s.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<CounterRow, 'id'>) }));
};

// ===== Legacy archive (read-only) =====
export const getLegacyInvoices = async (): Promise<Record<string, unknown>[]> => {
  const s = await getDocs(collection(db, LEGACY_INVOICES));
  return s.docs.map((d) => d.data() as Record<string, unknown>);
};
