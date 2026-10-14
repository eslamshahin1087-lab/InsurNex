import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  orderBy,
  query,
  serverTimestamp,
  updateDoc,
} from 'firebase/firestore';
import { db } from '../../firebase/config';
import type { Ad } from './ads.types';

const COLLECTION = 'ads';

// ============================================================
// ADMIN — LIST ALL
// ============================================================

export async function listAllAds(): Promise<Ad[]> {
  const q = query(collection(db, COLLECTION), orderBy('order', 'asc'));
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...d.data() } as Ad));
}

// ============================================================
// USER — LIST ACTIVE (within date range)
// ============================================================

export async function listActiveAds(): Promise<Ad[]> {
  const rows = await listAllAds();
  const today = new Date().toISOString().slice(0, 10);

  return rows
    .filter((a) => {
      if (!a.isActive) return false;
      if (a.startDate && a.startDate > today) return false;
      if (a.endDate && a.endDate < today) return false;
      return true;
    })
    .sort((a, b) => a.order - b.order);
}

// ============================================================
// GET ONE
// ============================================================

export async function getAd(id: string): Promise<Ad | null> {
  const snap = await getDoc(doc(db, COLLECTION, id));
  if (!snap.exists()) return null;
  return { id: snap.id, ...snap.data() } as Ad;
}

// ============================================================
// CREATE
// ============================================================

export interface AdInput {
  title: string;
  description?: string;
  imageUrl: string;
  linkUrl?: string;
  ctaText?: string;
  isActive: boolean;
  startDate?: string;
  endDate?: string;
  order: number;
  createdBy?: string;
}

export async function createAd(input: AdInput): Promise<string> {
  const ref = await addDoc(collection(db, COLLECTION), {
    title: input.title.trim(),
    description: input.description?.trim() || '',
    imageUrl: input.imageUrl.trim(),
    linkUrl: input.linkUrl?.trim() || '',
    ctaText: input.ctaText?.trim() || '',
    isActive: input.isActive,
    startDate: input.startDate || '',
    endDate: input.endDate || '',
    order: input.order,
    createdBy: input.createdBy || '',
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  return ref.id;
}

// ============================================================
// UPDATE
// ============================================================

export async function updateAd(id: string, input: AdInput): Promise<void> {
  await updateDoc(doc(db, COLLECTION, id), {
    title: input.title.trim(),
    description: input.description?.trim() || '',
    imageUrl: input.imageUrl.trim(),
    linkUrl: input.linkUrl?.trim() || '',
    ctaText: input.ctaText?.trim() || '',
    isActive: input.isActive,
    startDate: input.startDate || '',
    endDate: input.endDate || '',
    order: input.order,
    updatedAt: serverTimestamp(),
  });
}

// ============================================================
// DELETE
// ============================================================

export async function deleteAd(id: string): Promise<void> {
  await deleteDoc(doc(db, COLLECTION, id));
}

// ============================================================
// TOGGLE ACTIVE
// ============================================================

export async function toggleAdActive(id: string, isActive: boolean): Promise<void> {
  await updateDoc(doc(db, COLLECTION, id), {
    isActive,
    updatedAt: serverTimestamp(),
  });
}