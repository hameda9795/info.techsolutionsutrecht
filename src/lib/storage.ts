import type { Invoice } from '@/types/invoice';
import { db } from './firebase';
import { collection, doc, getDoc, getDocs, setDoc, deleteDoc } from 'firebase/firestore';

export type { Invoice };

const COLLECTION_NAME = 'invoices';

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

export const saveInvoice = async (invoice: Invoice): Promise<void> => {
  try {
    const docRef = doc(db, COLLECTION_NAME, invoice.id);
    await setDoc(docRef, invoice);
  } catch (error) {
    console.error("Error saving document: ", error);
    throw error;
  }
};

export const getAllInvoices = async (): Promise<Invoice[]> => {
  try {
    const querySnapshot = await getDocs(collection(db, COLLECTION_NAME));
    const invoices: Invoice[] = [];
    querySnapshot.forEach((doc) => {
      invoices.push(doc.data() as Invoice);
    });
    return invoices;
  } catch (error) {
    console.error("Error getting documents: ", error);
    return [];
  }
};

export const getInvoiceById = async (id: string): Promise<Invoice | undefined> => {
  try {
    const docRef = doc(db, COLLECTION_NAME, id);
    const docSnap = await getDoc(docRef);
    if (docSnap.exists()) {
      return docSnap.data() as Invoice;
    } else {
      console.log("No such document!");
      return undefined;
    }
  } catch (error) {
    console.error("Error getting document:", error);
    return undefined;
  }
};

export const updateInvoice = async (updatedInvoice: Invoice): Promise<void> => {
  try {
    const docRef = doc(db, COLLECTION_NAME, updatedInvoice.id);
    // Be careful with updateDoc vs setDoc. updateDoc fails if doc doesn't exist.
    // For safety, let's use setDoc with merge: true which is safer or just setDoc overwrites whole object.
    // Since we pass the whole object, setDoc is fine.
    await setDoc(docRef, updatedInvoice, { merge: true });
  } catch (error) {
    console.error("Error updating document: ", error);
    throw error;
  }
};

export const deleteInvoice = async (id: string): Promise<void> => {
  try {
    await deleteDoc(doc(db, COLLECTION_NAME, id));
  } catch (error) {
    console.error("Error removing document: ", error);
    throw error;
  }
};
