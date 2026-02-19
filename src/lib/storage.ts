import type { Invoice } from '@/types/invoice';

export type { Invoice };

const STORAGE_KEY = 'techsolutions_invoices';

export const generateId = (): string => {
  return Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
};

export const generateInvoiceNumber = (type: 'proforma' | 'invoice'): string => {
  const prefix = type === 'proforma' ? 'PI' : 'INV';
  const year = new Date().getFullYear();
  const random = Math.floor(Math.random() * 10000).toString().padStart(4, '0');
  return `${prefix}-${year}-${random}`;
};

export const generateVerificationCode = (): string => {
  return Math.floor(100000 + Math.random() * 900000).toString();
};

export const saveInvoice = (invoice: Invoice): void => {
  const invoices = getAllInvoices();
  invoices.push(invoice);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(invoices));
};

export const getAllInvoices = (): Invoice[] => {
  const data = localStorage.getItem(STORAGE_KEY);
  return data ? JSON.parse(data) : [];
};

export const getInvoiceById = (id: string): Invoice | undefined => {
  const invoices = getAllInvoices();
  return invoices.find(inv => inv.id === id);
};

export const updateInvoice = (updatedInvoice: Invoice): void => {
  const invoices = getAllInvoices();
  const index = invoices.findIndex(inv => inv.id === updatedInvoice.id);
  if (index !== -1) {
    invoices[index] = updatedInvoice;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(invoices));
  }
};

export const deleteInvoice = (id: string): void => {
  const invoices = getAllInvoices();
  const filtered = invoices.filter(inv => inv.id !== id);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(filtered));
};
