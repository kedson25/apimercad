import { initializeApp, getApps, getApp } from 'firebase/app';
import {
  getFirestore,
  doc,
  setDoc,
  getDocs,
  getDoc,
  collection,
  deleteDoc,
  serverTimestamp,
} from 'firebase/firestore';
import { CsvItem } from '../types/csvMatcher';

export const firebaseConfig = {
  apiKey: "AIzaSyA97_DIGajuZmyiJR0xjH8wRnvqfeDsubY",
  authDomain: "destinacao.firebaseapp.com",
  projectId: "destinacao",
  storageBucket: "destinacao.firebasestorage.app",
  messagingSenderId: "1029651542891",
  appId: "1:1029651542891:web:c76ee7feb685e7b286122e",
  measurementId: "G-S4GG5DYD1X"
};

// Initialize Firebase singleton
export const firebaseApp = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);
export const db = getFirestore(firebaseApp);

export const COLLECTION_NAME = 'desti';

/**
 * Salva um único item do CSV no documento correspondente na coleção 'desti'
 * O ID do documento é exatamente o ID do item (ex: '48045421079')
 */
export async function saveCsvItemToDesti(item: CsvItem): Promise<void> {
  if (!item.id) throw new Error('Item sem ID não pode ser salvo no Firestore');
  const docRef = doc(db, COLLECTION_NAME, item.id.trim());
  await setDoc(
    docRef,
    {
      id: item.id.trim(),
      itens: item.itens || '',
      valorReal: item.valorReal || '',
      valorUsd: item.valorUsd || '',
      qtdItens: item.qtdItens || '1',
      cepBuyer: item.cepBuyer || '',
      updatedAt: serverTimestamp(),
      syncedAt: new Date().toISOString(),
    },
    { merge: true }
  );
}

/**
 * Salva todos os itens do CSV na coleção 'desti', cada um em seu próprio documento ID
 */
export async function saveAllCsvItemsToDesti(
  items: CsvItem[],
  onProgress?: (saved: number, total: number) => void
): Promise<{ success: number; failed: number }> {
  let success = 0;
  let failed = 0;

  for (let i = 0; i < items.length; i++) {
    const item = items[i];
    try {
      await saveCsvItemToDesti(item);
      success++;
    } catch (err) {
      console.error(`Erro ao salvar documento ${item.id} no Firestore:`, err);
      failed++;
    }
    if (onProgress) {
      onProgress(i + 1, items.length);
    }
  }

  return { success, failed };
}

/**
 * Carrega todos os documentos existentes na coleção 'desti'
 */
export async function loadAllItemsFromDesti(): Promise<CsvItem[]> {
  const colRef = collection(db, COLLECTION_NAME);
  const snapshot = await getDocs(colRef);
  const result: CsvItem[] = [];

  snapshot.forEach((d) => {
    const data = d.data();
    result.push({
      id: d.id,
      itens: data.itens || '',
      valorReal: data.valorReal || '',
      valorUsd: data.valorUsd || '',
      qtdItens: data.qtdItens || '1',
      cepBuyer: data.cepBuyer || '',
    });
  });

  return result;
}

/**
 * Carrega apenas os itens da coleção 'desti' que possuem sobreposição de palavras-chave (otimização para não carregar todos)
 */
export async function loadMatchingItemsFromDesti(keywords: string[]): Promise<CsvItem[]> {
  const colRef = collection(db, COLLECTION_NAME);
  const snapshot = await getDocs(colRef);
  const allItems: CsvItem[] = [];

  snapshot.forEach((d) => {
    const data = d.data();
    allItems.push({
      id: d.id,
      itens: data.itens || '',
      valorReal: data.valorReal || '',
      valorUsd: data.valorUsd || '',
      qtdItens: data.qtdItens || '1',
      cepBuyer: data.cepBuyer || '',
    });
  });

  if (!keywords || keywords.length === 0) {
    return allItems.slice(0, 30); // limit default
  }

  const normKws = keywords.map(k => k.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, ''));

  // Score items by keyword overlap
  const scored = allItems.map(item => {
    const normText = (item.itens || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    let matches = 0;
    for (const kw of normKws) {
      if (kw.length >= 2 && normText.includes(kw)) {
        matches++;
      }
    }
    return { item, matches };
  });

  // Sort descending by match count
  scored.sort((a, b) => b.matches - a.matches);

  // Return top matching items plus any with matches > 0 (or top 15 if none match)
  const matchedOnly = scored.filter(s => s.matches > 0).map(s => s.item);
  if (matchedOnly.length > 0) {
    return matchedOnly.slice(0, 25);
  }

  return allItems.slice(0, 20);
}

/**
 * Retorna o número total de documentos salvos na coleção 'desti'
 */
export async function getDestiCount(): Promise<number> {
  try {
    const colRef = collection(db, COLLECTION_NAME);
    const snapshot = await getDocs(colRef);
    return snapshot.size;
  } catch (err) {
    console.error('Erro ao contar documentos em desti:', err);
    return 0;
  }
}

/**
 * Exclui um item da coleção 'desti'
 */
export async function deleteItemFromDesti(id: string): Promise<void> {
  const docRef = doc(db, COLLECTION_NAME, id);
  await deleteDoc(docRef);
}
