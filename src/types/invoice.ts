export interface InvoiceItem {
  id: string;
  description: string;
  quantity: number;
  unitPrice: number;
  total: number;
}

export interface Invoice {
  id: string;
  type: 'proforma' | 'invoice';
  invoiceNumber: string;
  date: string;
  dueDate: string;
  clientName: string;
  clientEmail: string;
  clientCompany?: string;
  clientAddress?: string;
  clientKvk?: string;
  items: InvoiceItem[];
  subtotal: number;
  vatRate: number;
  vatAmount: number;
  total: number;
  notes?: string;
  status: 'pending' | 'approved' | 'rejected';
  approvedAt?: string;
  approvedBy?: string;
  verificationCode?: string;
  codeExpiry?: string;
}

export interface CompanyInfo {
  name: string;
  website: string;
  phone: string;
  kvk: string;
  vatId: string; // Added VAT ID
  email: string;
  address?: string;
  logo?: string;
}

export const COMPANY_INFO: CompanyInfo = {
  name: 'TechSolutionsUtrecht', // Fixed spelling as requested
  website: 'https://www.techsolutionsutrecht.nl/',
  phone: '+31 623434286',
  kvk: '99202301',
  vatId: 'NL005375937B46', // Added VAT ID
  email: 'info@techsolutionsutrecht.nl',
  address: 'H Akhgari / St.-ludgerusstraat 199 / 3553 CW Utrecht' // Updated address
};
