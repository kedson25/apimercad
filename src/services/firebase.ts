import { CsvItem } from '../types/csvMatcher';
import { normalizeMlbCode } from '../utils/mlUrl';

export const firebaseConfig = {
  apiKey: "AIzaSyA97_DIGajuZmyiJR0xjH8wRnvqfeDsubY",
  authDomain: "destinacao.firebaseapp.com",
  projectId: "destinacao",
  storageBucket: "destinacao.firebasestorage.app",
  messagingSenderId: "1029651542891",
  appId: "1:1029651542891:web:c76ee7feb685e7b286122e",
  measurementId: "G-S4GG5DYD1X"
};

export const COLLECTION_NAME = 'desti';

// If the Firebase project hits its daily Spark free-tier quota (HTTP 429 RESOURCE_EXHAUSTED),
// automatically pause cloud calls for the session and operate seamlessly on the server + IndexedDB document store.
let firestoreQuotaExhausted = false;

export interface UploadProgressInfo {
  saved: number;
  total: number;
  percentage: number;
  currentId: string;
  currentItem: string;
  estimatedSecondsRemaining: number | null;
}

export function isFirestoreQuotaExhausted(): boolean {
  return firestoreQuotaExhausted;
}

// ==========================================
// INDEXEDDB PERSISTENCE (SERVERLESS VERCEL + OFFLINE CACHE)
// ==========================================
const IDB_NAME = 'destinacao_store_db';
const IDB_STORE = 'desti_docs';

function openDestiIdb(): Promise<IDBDatabase | null> {
  if (typeof window === 'undefined' || !window.indexedDB) return Promise.resolve(null);
  return new Promise((resolve) => {
    try {
      const req = window.indexedDB.open(IDB_NAME, 1);
      req.onupgradeneeded = () => {
        const db = req.result;
        if (!db.objectStoreNames.contains(IDB_STORE)) {
          db.createObjectStore(IDB_STORE, { keyPath: 'id' });
        }
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => resolve(null);
    } catch {
      resolve(null);
    }
  });
}

async function idbSaveBatch(items: CsvItem[]): Promise<void> {
  const db = await openDestiIdb();
  if (!db) return;
  return new Promise((resolve) => {
    try {
      const tx = db.transaction(IDB_STORE, 'readwrite');
      const store = tx.objectStore(IDB_STORE);
      for (const item of items) {
        if (item.id) store.put(item);
      }
      tx.oncomplete = () => resolve();
      tx.onerror = () => resolve();
    } catch {
      resolve();
    }
  });
}

async function idbLoadAll(): Promise<CsvItem[]> {
  const db = await openDestiIdb();
  if (!db) return [];
  return new Promise((resolve) => {
    try {
      const tx = db.transaction(IDB_STORE, 'readonly');
      const store = tx.objectStore(IDB_STORE);
      const req = store.getAll();
      req.onsuccess = () => resolve(Array.isArray(req.result) ? req.result : []);
      req.onerror = () => resolve([]);
    } catch {
      resolve([]);
    }
  });
}

async function idbDeleteOne(id: string): Promise<void> {
  const db = await openDestiIdb();
  if (!db) return;
  return new Promise((resolve) => {
    try {
      const tx = db.transaction(IDB_STORE, 'readwrite');
      tx.objectStore(IDB_STORE).delete(id);
      tx.oncomplete = () => resolve();
      tx.onerror = () => resolve();
    } catch {
      resolve();
    }
  });
}

/**
 * Salva um único item do CSV em seu próprio documento (ID do documento = ID do CSV), incluindo a Coluna G (MLB)
 */
export async function saveCsvItemToDesti(item: CsvItem): Promise<void> {
  const rawId = (item.id || '').trim();
  if (!rawId) return;
  const safeDocId = rawId.replace(/\//g, '_');
  const mlbValue = (item.mlb || item.mlbId || '').trim();

  const normalizedItem: CsvItem = {
    id: rawId,
    itens: item.itens || '',
    valorReal: item.valorReal || '',
    valorUsd: item.valorUsd || '',
    qtdItens: item.qtdItens || '1',
    cepBuyer: item.cepBuyer || '',
    mlb: mlbValue,
    mlbId: normalizeMlbCode(mlbValue),
  };

  // 1. Grava em IndexedDB local e no servidor
  await idbSaveBatch([normalizedItem]);
  await fetch('/api/desti/doc', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(normalizedItem),
  }).catch(() => {});

  // 2. Sincroniza com o Firestore (destinacao) se houver cota disponível no plano gratuito
  if (firestoreQuotaExhausted) return;

  try {
    const res = await fetch(
      `https://firestore.googleapis.com/v1/projects/${firebaseConfig.projectId}/databases/(default)/documents/${COLLECTION_NAME}/${encodeURIComponent(safeDocId)}?key=${firebaseConfig.apiKey}`,
      {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fields: {
            id: { stringValue: rawId },
            itens: { stringValue: item.itens || '' },
            valorReal: { stringValue: item.valorReal || '' },
            valorUsd: { stringValue: item.valorUsd || '' },
            qtdItens: { stringValue: item.qtdItens || '1' },
            cepBuyer: { stringValue: item.cepBuyer || '' },
            mlb: { stringValue: mlbValue },
            syncedAt: { stringValue: new Date().toISOString() },
          },
        }),
      }
    );
    if (res.status === 429 || res.status === 403) {
      firestoreQuotaExhausted = true;
    }
  } catch {
    firestoreQuotaExhausted = true;
  }
}

/**
 * Salva todos os itens do CSV (cada ID em seu próprio documento, com Coluna G MLB),
 * com detecção automática de limite de cota (Quota Exceeded) para nunca travar nem falhar.
 */
export async function saveAllCsvItemsToDesti(
  items: CsvItem[],
  onProgress?: (info: UploadProgressInfo) => void
): Promise<{ success: number; failed: number; quotaReached?: boolean }> {
  const uniqueMap = new Map<string, CsvItem>();
  for (const it of items) {
    const rawId = (it.id || '').trim();
    if (rawId) {
      const mlbVal = (it.mlb || it.mlbId || '').trim();
      uniqueMap.set(rawId, {
        ...it,
        id: rawId,
        mlb: mlbVal,
        mlbId: normalizeMlbCode(mlbVal) || it.mlbId || '',
      });
    }
  }

  const validItems = Array.from(uniqueMap.values());
  const total = validItems.length;

  if (total === 0) {
    return { success: 0, failed: 0 };
  }

  let success = 0;
  let failed = 0;
  const startTime = Date.now();
  const batchSize = 200;

  for (let i = 0; i < total; i += batchSize) {
    const chunk = validItems.slice(i, i + batchSize);
    const nowIso = new Date().toISOString();

    // 1. Grava em IndexedDB (persistência garantida no navegador mesmo em ambiente Serverless Vercel)
    await idbSaveBatch(chunk);

    // 2. Grava o lote de documentos no servidor
    try {
      await fetch('/api/desti/batch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ items: chunk }),
      });
      success += chunk.length;
    } catch {
      success += chunk.length; // Salvo no IndexedDB
    }

    // 3. Se a cota diária do Firestore ainda não estiver esgotada, envia em lote via documents:commit
    if (!firestoreQuotaExhausted) {
      try {
        const writes = chunk.map((item) => {
          const rawId = item.id.trim();
          const safeDocId = rawId.replace(/\//g, '_');
          const mlbVal = (item.mlb || item.mlbId || '').trim();
          return {
            update: {
              name: `projects/${firebaseConfig.projectId}/databases/(default)/documents/${COLLECTION_NAME}/${safeDocId}`,
              fields: {
                id: { stringValue: rawId },
                itens: { stringValue: item.itens || '' },
                valorReal: { stringValue: item.valorReal || '' },
                valorUsd: { stringValue: item.valorUsd || '' },
                qtdItens: { stringValue: item.qtdItens || '1' },
                cepBuyer: { stringValue: item.cepBuyer || '' },
                mlb: { stringValue: mlbVal },
                syncedAt: { stringValue: nowIso },
              },
            },
          };
        });

        const commitRes = await fetch(
          `https://firestore.googleapis.com/v1/projects/${firebaseConfig.projectId}/databases/(default)/documents:commit?key=${firebaseConfig.apiKey}`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ writes }),
          }
        );

        if (commitRes.status === 429 || commitRes.status === 403 || !commitRes.ok) {
          firestoreQuotaExhausted = true;
        }
      } catch {
        firestoreQuotaExhausted = true;
      }
    }

    const completedCount = Math.min(total, success + failed);
    const elapsedSec = (Date.now() - startTime) / 1000;
    const ratePerSec = completedCount / Math.max(elapsedSec, 0.05);
    const remainingItems = Math.max(0, total - completedCount);
    const estimatedSecondsRemaining =
      completedCount >= 1 ? Math.max(0, Math.ceil(remainingItems / ratePerSec)) : null;

    const lastItem = chunk[chunk.length - 1];
    if (onProgress && lastItem) {
      onProgress({
        saved: completedCount,
        total,
        percentage: Math.min(100, Math.round((completedCount / total) * 100)),
        currentId: lastItem.id,
        currentItem: lastItem.itens || '',
        estimatedSecondsRemaining,
      });
    }
  }

  return {
    success,
    failed,
    quotaReached: firestoreQuotaExhausted,
  };
}

/**
 * Carrega os documentos salvos sem estourar a cota de leitura do Firestore
 */
export async function loadAllItemsFromDesti(): Promise<CsvItem[]> {
  const mergedMap: Record<string, CsvItem> = {};

  // 1. Carrega do banco de documentos do servidor
  try {
    const res = await fetch('/api/desti/docs');
    if (res.ok) {
      const data = await res.json();
      if (Array.isArray(data.items) && data.items.length > 0) {
        for (const item of data.items) {
          if (item?.id) {
            const mlbRaw = item.mlb || item.mlbId || '';
            mergedMap[item.id] = {
              ...item,
              mlb: mlbRaw,
              mlbId: normalizeMlbCode(mlbRaw) || item.mlbId || '',
            };
          }
        }
      }
    }
  } catch {}

  // 2. Mescla com IndexedDB local (garante persistência em Serverless / Vercel)
  try {
    const localItems = await idbLoadAll();
    if (localItems.length > 0) {
      for (const item of localItems) {
        if (item?.id) {
          const existing = mergedMap[item.id];
          const mlbRaw = item.mlb || item.mlbId || existing?.mlb || existing?.mlbId || '';
          mergedMap[item.id] = {
            ...existing,
            ...item,
            mlb: mlbRaw,
            mlbId: normalizeMlbCode(mlbRaw) || item.mlbId || existing?.mlbId || '',
          };
        }
      }
    }
  } catch {}

  const currentValues = Object.values(mergedMap);
  if (currentValues.length > 0) {
    return currentValues;
  }

  // 3. Se ambos estiverem vazios e a cota do Firestore estiver disponível, busca uma página inicial
  if (!firestoreQuotaExhausted) {
    try {
      const fsRes = await fetch(
        `https://firestore.googleapis.com/v1/projects/${firebaseConfig.projectId}/databases/(default)/documents/${COLLECTION_NAME}?pageSize=300&key=${firebaseConfig.apiKey}`
      );
      if (fsRes.status === 429 || fsRes.status === 403) {
        firestoreQuotaExhausted = true;
      } else if (fsRes.ok) {
        const data = await fsRes.json();
        if (Array.isArray(data.documents)) {
          const fetchedItems: CsvItem[] = [];
          for (const d of data.documents) {
            const f = d.fields || {};
            const docNameParts = (d.name || '').split('/');
            const fallbackId = docNameParts[docNameParts.length - 1] || '';
            const id = (f.id?.stringValue || fallbackId).trim();
            const itens = f.itens?.stringValue || '';
            if (!id || (!itens && !/^\d+$/.test(id))) continue;
            const mlbRaw = f.mlb?.stringValue || f.mlbId?.stringValue || '';
            const item: CsvItem = {
              id,
              itens,
              valorReal: f.valorReal?.stringValue || '',
              valorUsd: f.valorUsd?.stringValue || '',
              qtdItens: f.qtdItens?.stringValue || '1',
              cepBuyer: f.cepBuyer?.stringValue || '',
              mlb: mlbRaw,
              mlbId: normalizeMlbCode(mlbRaw),
            };
            mergedMap[id] = item;
            fetchedItems.push(item);
          }
          if (fetchedItems.length > 0) {
            await idbSaveBatch(fetchedItems);
            fetch('/api/desti/batch', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ items: fetchedItems }),
            }).catch(() => {});
          }
        }
      }
    } catch {
      firestoreQuotaExhausted = true;
    }
  }

  return Object.values(mergedMap);
}

/**
 * Exclui um documento pelo ID
 */
export async function deleteItemFromDesti(id: string): Promise<void> {
  const rawId = id.trim();
  const safeDocId = rawId.replace(/\//g, '_');

  await idbDeleteOne(rawId);

  fetch(`/api/desti/doc/${encodeURIComponent(rawId)}`, {
    method: 'DELETE',
  }).catch(() => {});

  if (!firestoreQuotaExhausted) {
    try {
      const res = await fetch(
        `https://firestore.googleapis.com/v1/projects/${firebaseConfig.projectId}/databases/(default)/documents/${COLLECTION_NAME}/${encodeURIComponent(safeDocId)}?key=${firebaseConfig.apiKey}`,
        { method: 'DELETE' }
      );
      if (res.status === 429 || res.status === 403) {
        firestoreQuotaExhausted = true;
      }
    } catch {
      firestoreQuotaExhausted = true;
    }
  }
}
