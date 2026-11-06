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
// automatically pause cloud calls for the session and operate seamlessly on the server document store.
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

/**
 * Salva um único item do CSV em seu próprio documento (ID do documento = ID do CSV), incluindo a Coluna G (MLB)
 */
export async function saveCsvItemToDesti(item: CsvItem): Promise<void> {
  const rawId = (item.id || '').trim();
  if (!rawId) return;
  const safeDocId = rawId.replace(/\//g, '_');
  const mlbValue = (item.mlb || item.mlbId || '').trim();

  // 1. Grava no banco de documentos persistente do servidor (sem limite de cota)
  await fetch('/api/desti/doc', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      id: rawId,
      itens: item.itens || '',
      valorReal: item.valorReal || '',
      valorUsd: item.valorUsd || '',
      qtdItens: item.qtdItens || '1',
      cepBuyer: item.cepBuyer || '',
      mlb: mlbValue,
      mlbId: normalizeMlbCode(mlbValue),
    }),
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
      uniqueMap.set(rawId, it);
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

    // 1. Grava o lote de documentos (1 documento por ID) no servidor local/cloud persistente
    try {
      await fetch('/api/desti/batch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ items: chunk }),
      });
      success += chunk.length;
    } catch {
      failed += chunk.length;
    }

    // 2. Se a cota diária do Firestore ainda não estiver esgotada, envia em lote via documents:commit
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

  // Carrega prioritariamente do banco de documentos do servidor (rápido e sem consumo de cota diária)
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
        return Object.values(mergedMap);
      }
    }
  } catch {}

  // Se o servidor estiver vazio e a cota do Firestore estiver disponível, busca uma página inicial
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
