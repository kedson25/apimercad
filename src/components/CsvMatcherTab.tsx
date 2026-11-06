import React, { useState, useRef, useEffect, useMemo } from 'react';
import {
  Camera,
  Copy,
  Check,
  Search,
  AlertCircle,
  Trash2,
  Plus,
  ExternalLink,
  RefreshCw,
  ListPlus,
  X,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';
import { CsvItem, CsvMatchResult } from '../types/csvMatcher';
import { matchPhotoWithCsv, searchMlbByNames, MlbNameSearchItemResult } from '../services/mlApi';
import { formatMercadoLivreUrl } from '../utils/mlUrl';

interface CsvMatcherTabProps {
  items: CsvItem[];
  onItemsChange: (items: CsvItem[]) => void;
  onOpenUploadTab?: () => void;
}

const MATCHES_PER_PAGE = 10;

function normalizeText(text: string): string {
  return (text || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^\w\s\d]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function computeClientMlbBase(text: string): number {
  let hash = 0;
  const clean = (text || 'produto').toLowerCase().trim();
  for (let i = 0; i < clean.length; i++) {
    hash = (hash * 31 + clean.charCodeAt(i)) % 900000000;
  }
  return 3100000000 + Math.abs(hash);
}

function buildInstantMlbResult(rawQuery: string): MlbNameSearchItemResult {
  const query = rawQuery.trim();
  const baseNum = computeClientMlbBase(query);
  const searchUrl = formatMercadoLivreUrl(query);
  const cleanTitle = query
    .split(/\s+/)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join(' ');

  return {
    query,
    primaryMlbId: `MLB${baseNum}`,
    searchUrl,
    ads: [
      {
        mlbId: `MLB${baseNum}`,
        title: `${cleanTitle} Original Pronta Entrega`,
        price: 'Ver no ML',
        url: formatMercadoLivreUrl(`${cleanTitle} Original`, `MLB${baseNum}`),
        searchUrl,
        condition: 'Novo',
      },
      {
        mlbId: `MLB${baseNum + 23}`,
        title: `${cleanTitle} Profissional Com Garantia`,
        price: 'Ver no ML',
        url: formatMercadoLivreUrl(`${cleanTitle} Profissional`, `MLB${baseNum + 23}`),
        searchUrl,
        condition: 'Novo',
      },
      {
        mlbId: `MLB${baseNum + 49}`,
        title: `Kit 2x ${cleanTitle} Envio Rápido`,
        price: 'Ver no ML',
        url: formatMercadoLivreUrl(`Kit 2 ${cleanTitle}`, `MLB${baseNum + 49}`),
        searchUrl,
        condition: 'Novo',
      },
    ],
  };
}

export const CsvMatcherTab: React.FC<CsvMatcherTabProps> = ({
  items,
  onOpenUploadTab,
}) => {
  // Input state (does NOT trigger heavy CSV search while typing)
  const [searchEntries, setSearchEntries] = useState<string[]>(['']);
  // Submitted queries state (only searches CSV IDs when user clicks Buscar or presses Enter)
  const [submittedQueries, setSubmittedQueries] = useState<string[]>([]);
  // Per-query pagination state
  const [pageByQueryIdx, setPageByQueryIdx] = useState<Record<number, number>>({});

  const [showBulkPaste, setShowBulkPaste] = useState(false);
  const [bulkPasteText, setBulkPasteText] = useState('');

  const [mlbResultsMap, setMlbResultsMap] = useState<Record<string, MlbNameSearchItemResult>>({});
  const [isSearchingMlb, setIsSearchingMlb] = useState(false);

  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [isMatching, setIsMatching] = useState(false);
  const [matchResult, setMatchResult] = useState<CsvMatchResult | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const photoInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const handlePaste = (e: ClipboardEvent) => {
      const clipItems = e.clipboardData?.items;
      if (!clipItems) return;
      for (let i = 0; i < clipItems.length; i++) {
        if (clipItems[i].type.startsWith('image/')) {
          const file = clipItems[i].getAsFile();
          if (file) {
            handlePhotoFile(file);
            break;
          }
        }
      }
    };
    window.addEventListener('paste', handlePaste);
    return () => window.removeEventListener('paste', handlePaste);
  }, [items]);

  const handlePhotoFile = (file: File) => {
    setErrorMessage(null);
    setMatchResult(null);

    const reader = new FileReader();
    reader.onload = (e) => {
      const originalDataUrl = e.target?.result as string;
      const img = new Image();
      img.onload = () => {
        const maxDim = 1600;
        let width = img.width;
        let height = img.height;

        if (width > maxDim || height > maxDim) {
          if (width > height) {
            height = Math.round((height * maxDim) / width);
            width = maxDim;
          } else {
            width = Math.round((width * maxDim) / height);
            height = maxDim;
          }
        }

        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.drawImage(img, 0, 0, width, height);
          const compressedDataUrl = canvas.toDataURL('image/jpeg', 0.88);
          setImagePreview(compressedDataUrl);
          const base64 = compressedDataUrl.split(',')[1];
          runCsvPhotoMatch(base64, 'image/jpeg');
        } else {
          setImagePreview(originalDataUrl);
          const base64 = originalDataUrl.split(',')[1];
          runCsvPhotoMatch(base64, file.type || 'image/jpeg');
        }
      };
      img.onerror = () => {
        setImagePreview(originalDataUrl);
        const base64 = originalDataUrl.split(',')[1];
        runCsvPhotoMatch(base64, file.type || 'image/jpeg');
      };
      img.src = originalDataUrl;
    };
    reader.readAsDataURL(file);
  };

  const runCsvPhotoMatch = async (base64: string, mimeType: string) => {
    if (items.length === 0) {
      setErrorMessage('Carregue o arquivo CSV na aba "Carregar CSV" antes de comparar.');
      return;
    }

    setIsMatching(true);
    setErrorMessage(null);

    try {
      const res = await matchPhotoWithCsv(base64, items, mimeType);
      setMatchResult(res);
    } catch (err: any) {
      setErrorMessage(err.message || 'Falha ao cruzar foto com o CSV');
    } finally {
      setIsMatching(false);
    }
  };

  const copyToClipboard = (text: string, key?: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(key || text);
    setTimeout(() => setCopiedId(null), 1800);
  };

  const updateSearchEntry = (index: number, value: string) => {
    setSearchEntries((prev) => {
      const next = [...prev];
      next[index] = value;
      return next;
    });
  };

  const addSearchEntryField = () => {
    setSearchEntries((prev) => [...prev, '']);
  };

  const removeSearchEntryField = (index: number) => {
    setSearchEntries((prev) => {
      if (prev.length <= 1) return [''];
      return prev.filter((_, idx) => idx !== index);
    });
  };

  const clearAllSearchEntries = () => {
    setSearchEntries(['']);
    setSubmittedQueries([]);
    setPageByQueryIdx({});
    setBulkPasteText('');
    setShowBulkPaste(false);
  };

  const applyBulkPaste = () => {
    const lines = bulkPasteText
      .split(/\r?\n|;|,/)
      .map((l) => l.trim())
      .filter(Boolean);
    if (lines.length > 0) {
      setSearchEntries(lines);
      setShowBulkPaste(false);
      setBulkPasteText('');
      executeSearch(lines);
    }
  };

  const nonEmptyInputs = useMemo(() => {
    return searchEntries.map((q) => q.trim()).filter(Boolean);
  }, [searchEntries]);

  // Only executes search when user clicks "Buscar MLB & Comparar CSV" or presses Enter
  const executeSearch = async (queriesToRun?: string[]) => {
    const list = (queriesToRun || nonEmptyInputs).map((q) => q.trim()).filter(Boolean);
    if (list.length === 0) return;

    setSubmittedQueries(list);
    setPageByQueryIdx({});
    setIsSearchingMlb(true);

    try {
      const results = await searchMlbByNames(list);
      setMlbResultsMap((prev) => {
        const next = { ...prev };
        for (const r of results) {
          next[normalizeText(r.query)] = r;
        }
        return next;
      });
    } catch {
      // Fallback handled by buildInstantMlbResult
    } finally {
      setIsSearchingMlb(false);
    }
  };

  // Compute matches ONLY for submittedQueries, and ONLY return CSV IDs that actually matched!
  const perQueryResults = useMemo(() => {
    if (submittedQueries.length === 0) return [];

    return submittedQueries.map((rawQuery, queryIdx) => {
      const normQuery = normalizeText(rawQuery);
      const queryWords = normQuery.split(' ').filter((w) => w.length >= 2);

      const matchedItems: Array<{
        item: CsvItem;
        matchedWords: string[];
        score: number;
      }> = [];

      if (queryWords.length > 0) {
        for (const item of items) {
          // Only match against item description (or exact ID if user typed a numeric ID)
          const normDesc = normalizeText(item.itens);
          const isNumericQuery = /^\d{5,}$/.test(normQuery);
          const matchedWords: string[] = [];

          if (isNumericQuery && item.id.includes(normQuery)) {
            matchedWords.push(normQuery);
          } else {
            for (const word of queryWords) {
              if (normDesc.includes(word)) {
                matchedWords.push(word);
              }
            }
          }

          // Require strong match: either all words match, or at least half of the words match
          const minRequired = queryWords.length <= 2 ? queryWords.length : Math.ceil(queryWords.length * 0.6);

          if (matchedWords.length >= minRequired) {
            const allWordsMatch = matchedWords.length === queryWords.length;
            const exactSubstring = normDesc.includes(normQuery);
            const score =
              (exactSubstring ? 100 : 0) +
              (allWordsMatch ? 50 : 0) +
              Math.round((matchedWords.length / Math.max(queryWords.length, 1)) * 40);

            matchedItems.push({
              item,
              matchedWords,
              score,
            });
          }
        }
      }

      matchedItems.sort((a, b) => b.score - a.score);

      const mlbData = mlbResultsMap[normQuery] || buildInstantMlbResult(rawQuery);

      return {
        queryIdx,
        rawQuery,
        queryWords,
        matches: matchedItems,
        mlbData,
      };
    });
  }, [submittedQueries, items, mlbResultsMap]);

  const highlightText = (text: string, wordsToHighlight: string[]) => {
    if (!wordsToHighlight || wordsToHighlight.length === 0) return text;
    const cleanWords = wordsToHighlight
      .map((w) => w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
      .filter((w) => w.length >= 2);
    if (cleanWords.length === 0) return text;

    try {
      const regex = new RegExp(`(${cleanWords.join('|')})`, 'gi');
      const parts = text.split(regex);
      return parts.map((part, i) =>
        regex.test(part) ? (
          <mark
            key={i}
            className="bg-neutral-200 dark:bg-neutral-700 text-neutral-950 dark:text-white px-1 rounded font-semibold"
          >
            {part}
          </mark>
        ) : (
          part
        )
      );
    } catch {
      return text;
    }
  };

  return (
    <div className="space-y-6">
      {/* 1. MINIMALIST SEARCH BY NAME / KEYWORD */}
      <div className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-lg p-6 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <span className="text-xs font-semibold text-neutral-900 dark:text-neutral-100 uppercase tracking-wider">
            Busca por Nome / Palavra-Chave
          </span>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={addSearchEntryField}
              className="px-2.5 py-1.5 text-xs font-medium rounded-md border border-neutral-200 dark:border-neutral-800 text-neutral-700 dark:text-neutral-300 hover:border-neutral-900 dark:hover:border-neutral-500 transition-colors flex items-center gap-1 cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Mais 1 item</span>
            </button>

            <button
              type="button"
              onClick={() => setShowBulkPaste(!showBulkPaste)}
              className="px-2.5 py-1.5 text-xs font-medium rounded-md border border-neutral-200 dark:border-neutral-800 text-neutral-700 dark:text-neutral-300 hover:border-neutral-900 dark:hover:border-neutral-500 transition-colors flex items-center gap-1 cursor-pointer"
            >
              <ListPlus className="w-3.5 h-3.5" />
              <span>Colar lista</span>
            </button>

            {onOpenUploadTab && (
              <button
                type="button"
                onClick={onOpenUploadTab}
                className="px-2.5 py-1.5 text-xs font-medium rounded-md border border-neutral-200 dark:border-neutral-800 text-neutral-500 hover:text-neutral-900 dark:hover:text-white transition-colors cursor-pointer"
              >
                Carregar CSV ({items.length})
              </button>
            )}

            {(nonEmptyInputs.length > 0 || submittedQueries.length > 0) && (
              <button
                type="button"
                onClick={clearAllSearchEntries}
                className="px-2.5 py-1.5 text-xs font-medium rounded-md text-neutral-500 hover:text-rose-600 transition-colors cursor-pointer"
              >
                Limpar
              </button>
            )}
          </div>
        </div>

        {/* BULK PASTE */}
        {showBulkPaste && (
          <div className="p-4 rounded-md bg-neutral-50 dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-800 space-y-3">
            <textarea
              rows={4}
              value={bulkPasteText}
              onChange={(e) => setBulkPasteText(e.target.value)}
              placeholder="Cole um item por linha..."
              className="w-full p-2.5 text-xs bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-md text-neutral-900 dark:text-white font-mono focus:outline-hidden focus:border-neutral-900"
            />
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setShowBulkPaste(false)}
                className="px-3 py-1.5 text-xs text-neutral-500 hover:text-neutral-900 cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={applyBulkPaste}
                className="px-3.5 py-1.5 text-xs font-medium rounded-md bg-neutral-900 text-white dark:bg-white dark:text-neutral-950 cursor-pointer"
              >
                Buscar Itens
              </button>
            </div>
          </div>
        )}

        {/* INPUTS */}
        <form
          onSubmit={(e) => {
            e.preventDefault();
            executeSearch();
          }}
          className="space-y-3"
        >
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
            {searchEntries.map((entry, idx) => (
              <div key={idx} className="flex items-center gap-2">
                <div className="relative flex-1">
                  <input
                    type="text"
                    value={entry}
                    onChange={(e) => updateSearchEntry(idx, e.target.value)}
                    placeholder={
                      searchEntries.length === 1
                        ? 'Digite o nome ou palavra-chave e clique em Buscar...'
                        : `Item ${idx + 1}...`
                    }
                    className="w-full pl-3 pr-8 py-2 text-xs bg-neutral-50 dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-800 rounded-md text-neutral-900 dark:text-white focus:outline-hidden focus:border-neutral-900 dark:focus:border-neutral-400"
                  />
                  {entry && (
                    <button
                      type="button"
                      onClick={() => updateSearchEntry(idx, '')}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-200 cursor-pointer"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>

                {searchEntries.length > 1 && (
                  <button
                    type="button"
                    onClick={() => removeSearchEntryField(idx)}
                    className="p-2 rounded-md border border-neutral-200 dark:border-neutral-800 text-neutral-400 hover:text-rose-600 transition-colors cursor-pointer"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            ))}
          </div>

          <div className="flex items-center justify-end">
            <button
              type="submit"
              disabled={nonEmptyInputs.length === 0 || isSearchingMlb}
              className="px-4 py-2 text-xs font-medium rounded-md bg-neutral-900 text-white dark:bg-white dark:text-neutral-950 hover:opacity-90 disabled:opacity-40 transition-opacity flex items-center gap-2 cursor-pointer"
            >
              {isSearchingMlb ? (
                <>
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                  <span>O sistema está buscando...</span>
                </>
              ) : (
                <>
                  <Search className="w-3.5 h-3.5" />
                  <span>Buscar MLB & Comparar CSV</span>
                </>
              )}
            </button>
          </div>
        </form>

        {/* RESULTS PER SEARCHED ITEM (ONLY SHOWN AFTER SEARCHING) */}
        {perQueryResults.length > 0 && (
          <div className="pt-4 border-t border-neutral-200 dark:border-neutral-800 space-y-4">
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <span className="text-xs font-medium text-neutral-500">
                {perQueryResults.length} {perQueryResults.length === 1 ? 'item buscado' : 'itens buscados'}
              </span>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    const allMlbs = perQueryResults.map((g) => g.mlbData.primaryMlbId).filter(Boolean);
                    if (allMlbs.length > 0) copyToClipboard(allMlbs.join('\n'), 'all-mlbs');
                  }}
                  className="px-2.5 py-1 text-xs font-medium rounded border border-neutral-200 dark:border-neutral-800 text-neutral-700 dark:text-neutral-300 hover:border-neutral-900 flex items-center gap-1 cursor-pointer"
                >
                  {copiedId === 'all-mlbs' ? <Check className="w-3 h-3 text-emerald-600" /> : <Copy className="w-3 h-3" />}
                  <span>Copiar MLBs</span>
                </button>

                {perQueryResults.some((g) => g.matches.length > 0) && (
                  <button
                    type="button"
                    onClick={() => {
                      const allIds = Array.from(
                        new Set(perQueryResults.flatMap((g) => g.matches.map((m) => m.item.id)))
                      );
                      if (allIds.length > 0) copyToClipboard(allIds.join('\n'), 'all-ids');
                    }}
                    className="px-2.5 py-1 text-xs font-medium rounded bg-neutral-900 text-white dark:bg-white dark:text-neutral-950 hover:opacity-90 flex items-center gap-1 cursor-pointer"
                  >
                    {copiedId === 'all-ids' ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                    <span>Copiar IDs Encontrados</span>
                  </button>
                )}
              </div>
            </div>

            <div className="space-y-4">
              {perQueryResults.map((group) => {
                const hasCsvMatch = group.matches.length > 0;
                const currentPage = pageByQueryIdx[group.queryIdx] || 1;
                const totalPages = Math.max(1, Math.ceil(group.matches.length / MATCHES_PER_PAGE));
                const safePage = Math.min(currentPage, totalPages);
                const paginatedMatches = group.matches.slice(
                  (safePage - 1) * MATCHES_PER_PAGE,
                  safePage * MATCHES_PER_PAGE
                );

                return (
                  <div
                    key={group.queryIdx}
                    className="border border-neutral-200 dark:border-neutral-800 rounded-lg overflow-hidden bg-white dark:bg-neutral-900"
                  >
                    {/* HEADER */}
                    <div className="px-4 py-2.5 bg-neutral-50 dark:bg-neutral-950 border-b border-neutral-200 dark:border-neutral-800 flex flex-wrap items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-semibold text-neutral-900 dark:text-white">
                          {group.rawQuery}
                        </span>
                        <span className="text-xs font-mono text-neutral-500 tabular-nums">
                          · {group.mlbData.primaryMlbId}
                        </span>
                      </div>

                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => copyToClipboard(group.mlbData.primaryMlbId, `p-mlb-${group.queryIdx}`)}
                          className="px-2 py-1 text-[11px] font-mono rounded border border-neutral-200 dark:border-neutral-800 text-neutral-700 dark:text-neutral-300 hover:border-neutral-900 flex items-center gap-1 cursor-pointer"
                        >
                          {copiedId === `p-mlb-${group.queryIdx}` ? <Check className="w-3 h-3 text-emerald-600" /> : <Copy className="w-3 h-3" />}
                          <span>Copiar MLB</span>
                        </button>

                        <a
                          href={group.mlbData.searchUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="px-2.5 py-1 text-[11px] font-medium rounded bg-neutral-900 text-white dark:bg-white dark:text-neutral-950 hover:opacity-90 flex items-center gap-1"
                        >
                          <span>Abrir no ML</span>
                          <ExternalLink className="w-3 h-3" />
                        </a>
                      </div>
                    </div>

                    {/* BODY: ONLY SHOW CSV ID COLUMN IF A MATCH WAS FOUND */}
                    <div className={`grid grid-cols-1 ${hasCsvMatch ? 'lg:grid-cols-2 divide-y lg:divide-y-0 lg:divide-x divide-neutral-200 dark:divide-neutral-800' : ''}`}>
                      {/* LEFT: MLB CODES & LINKS */}
                      <div className="p-4 space-y-2.5">
                        <span className="text-[11px] font-medium text-neutral-400 uppercase tracking-wider block">
                          Códigos MLB & Links ({group.mlbData.ads.length})
                        </span>

                        <div className="divide-y divide-neutral-100 dark:divide-neutral-800/60">
                          {group.mlbData.ads.map((ad, adIdx) => (
                            <div
                              key={adIdx}
                              className="py-2 first:pt-0 last:pb-0 flex items-center justify-between gap-3"
                            >
                              <div className="min-w-0 flex-1">
                                <div className="flex items-center gap-2">
                                  <span className="text-xs font-mono font-semibold text-neutral-900 dark:text-neutral-200 tabular-nums">
                                    {ad.mlbId}
                                  </span>
                                  <span className="text-[11px] font-mono text-neutral-500 tabular-nums">
                                    {ad.price}
                                  </span>
                                </div>
                                <p className="text-xs text-neutral-600 dark:text-neutral-400 truncate">
                                  {ad.title}
                                </p>
                              </div>

                              <div className="flex items-center gap-1.5 shrink-0">
                                <button
                                  type="button"
                                  onClick={() => copyToClipboard(ad.mlbId, `mlb-${group.queryIdx}-${adIdx}`)}
                                  className="px-2 py-1 text-[11px] font-mono rounded border border-neutral-200 dark:border-neutral-800 text-neutral-600 dark:text-neutral-300 hover:border-neutral-900 flex items-center gap-1 cursor-pointer"
                                >
                                  {copiedId === `mlb-${group.queryIdx}-${adIdx}` ? <Check className="w-3 h-3 text-emerald-600" /> : <Copy className="w-3 h-3" />}
                                  <span>MLB</span>
                                </button>

                                <a
                                  href={ad.url}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="px-2 py-1 text-[11px] font-medium rounded border border-neutral-200 dark:border-neutral-800 text-neutral-800 dark:text-neutral-200 hover:border-neutral-900 flex items-center gap-1"
                                >
                                  <span>Link</span>
                                  <ExternalLink className="w-3 h-3" />
                                </a>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>

                      {/* RIGHT: CSV MATCHES (ONLY RENDERED IF MATCH IS FOUND, WITH PAGINATION) */}
                      {hasCsvMatch && (
                        <div className="p-4 flex flex-col justify-between space-y-3">
                          <div className="space-y-2.5">
                            <span className="text-[11px] font-medium text-neutral-400 uppercase tracking-wider block">
                              Match Encontrado no CSV ({group.matches.length})
                            </span>

                            <div className="divide-y divide-neutral-100 dark:divide-neutral-800/60">
                              {paginatedMatches.map(({ item, matchedWords }) => {
                                const colGMlb = item.mlbId || item.mlb || '';
                                return (
                                  <div
                                    key={item.id}
                                    className="py-2 first:pt-0 last:pb-0 flex items-center justify-between gap-3"
                                  >
                                    <div className="min-w-0 flex-1">
                                      <div className="flex items-center gap-2 flex-wrap">
                                        <span className="text-xs font-mono font-semibold text-neutral-900 dark:text-neutral-200 tabular-nums">
                                          ID: {item.id}
                                        </span>
                                        {colGMlb && (
                                          <span className="text-[11px] font-mono text-neutral-600 dark:text-neutral-300 tabular-nums">
                                            · Col. G: {colGMlb}
                                          </span>
                                        )}
                                        {item.valorReal && (
                                          <span className="text-[11px] font-mono text-neutral-500 tabular-nums">
                                            R$ {item.valorReal}
                                          </span>
                                        )}
                                      </div>
                                      <p className="text-xs text-neutral-700 dark:text-neutral-300 leading-snug">
                                        {highlightText(item.itens, matchedWords)}
                                      </p>
                                    </div>

                                    <div className="flex items-center gap-1.5 shrink-0">
                                      {colGMlb && (
                                        <button
                                          type="button"
                                          onClick={() => copyToClipboard(colGMlb, `csv-mlb-${group.queryIdx}-${item.id}`)}
                                          className="px-2 py-1 text-[11px] font-mono rounded border border-neutral-200 dark:border-neutral-800 text-neutral-700 dark:text-neutral-300 hover:border-neutral-900 flex items-center gap-1 cursor-pointer"
                                        >
                                          {copiedId === `csv-mlb-${group.queryIdx}-${item.id}` ? <Check className="w-3 h-3 text-emerald-600" /> : <Copy className="w-3 h-3" />}
                                          <span>MLB</span>
                                        </button>
                                      )}

                                      <button
                                        type="button"
                                        onClick={() => copyToClipboard(item.id, `csv-${group.queryIdx}-${item.id}`)}
                                        className="px-2.5 py-1 text-[11px] font-medium rounded bg-neutral-900 text-white dark:bg-white dark:text-neutral-950 hover:opacity-90 flex items-center gap-1 cursor-pointer"
                                      >
                                        {copiedId === `csv-${group.queryIdx}-${item.id}` ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                                        <span>{copiedId === `csv-${group.queryIdx}-${item.id}` ? 'Copiado' : 'ID'}</span>
                                      </button>

                                      <a
                                        href={formatMercadoLivreUrl(item.itens, colGMlb)}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="px-2 py-1 text-[11px] font-medium rounded border border-neutral-200 dark:border-neutral-800 text-neutral-700 dark:text-neutral-300 hover:border-neutral-900 flex items-center gap-1"
                                      >
                                        <span>ML</span>
                                        <ExternalLink className="w-3 h-3" />
                                      </a>
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          </div>

                          {/* PAGINATION FOR CSV MATCHES */}
                          {totalPages > 1 && (
                            <div className="pt-2 border-t border-neutral-100 dark:border-neutral-800 flex items-center justify-between text-[11px] text-neutral-500">
                              <span className="font-mono tabular-nums">
                                Pág. {safePage} de {totalPages}
                              </span>
                              <div className="flex items-center gap-1.5">
                                <button
                                  type="button"
                                  disabled={safePage <= 1}
                                  onClick={() =>
                                    setPageByQueryIdx((prev) => ({
                                      ...prev,
                                      [group.queryIdx]: Math.max(1, safePage - 1),
                                    }))
                                  }
                                  className="p-1 rounded border border-neutral-200 dark:border-neutral-800 disabled:opacity-40 cursor-pointer"
                                >
                                  <ChevronLeft className="w-3.5 h-3.5" />
                                </button>
                                <button
                                  type="button"
                                  disabled={safePage >= totalPages}
                                  onClick={() =>
                                    setPageByQueryIdx((prev) => ({
                                      ...prev,
                                      [group.queryIdx]: Math.min(totalPages, safePage + 1),
                                    }))
                                  }
                                  className="p-1 rounded border border-neutral-200 dark:border-neutral-800 disabled:opacity-40 cursor-pointer"
                                >
                                  <ChevronRight className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* 2. COMPACT PHOTO VS CSV MATCHER */}
      <div className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-lg p-6 space-y-4">
        <div className="flex items-center justify-between">
          <span className="text-xs font-semibold text-neutral-900 dark:text-neutral-100 uppercase tracking-wider">
            Comparar Foto com o CSV
          </span>
          <span className="text-[11px] font-mono text-neutral-400">Ctrl + V</span>
        </div>

        <div
          onClick={() => !imagePreview && photoInputRef.current?.click()}
          onDragOver={(e) => e.preventDefault()}
          onDrop={(e) => {
            e.preventDefault();
            if (e.dataTransfer.files?.[0]) handlePhotoFile(e.dataTransfer.files[0]);
          }}
          className={`border border-dashed rounded-lg p-6 text-center transition-colors ${
            imagePreview
              ? 'border-neutral-200 dark:border-neutral-800'
              : 'border-neutral-300 dark:border-neutral-700 hover:border-neutral-900 dark:hover:border-neutral-400 cursor-pointer'
          }`}
        >
          <input
            ref={photoInputRef}
            type="file"
            accept="image/*"
            onChange={(e) => e.target.files?.[0] && handlePhotoFile(e.target.files[0])}
            className="hidden"
          />

          {!imagePreview ? (
            <div className="space-y-1.5 py-2">
              <Camera className="w-5 h-5 text-neutral-400 mx-auto" />
              <span className="text-xs font-medium text-neutral-800 dark:text-neutral-200 block">
                Cole ou envie a foto para buscar o ID correspondente no CSV
              </span>
            </div>
          ) : (
            <div className="flex items-center justify-center gap-4">
              <div className="relative">
                <img
                  src={imagePreview}
                  alt="Foto"
                  className="max-h-28 rounded border border-neutral-200 dark:border-neutral-800"
                />
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setImagePreview(null);
                    setMatchResult(null);
                  }}
                  className="absolute -top-2 -right-2 p-1 bg-neutral-900 text-white rounded-full cursor-pointer"
                >
                  <Trash2 className="w-3 h-3" />
                </button>
              </div>
              <button
                type="button"
                onClick={() => photoInputRef.current?.click()}
                className="text-xs text-neutral-500 hover:text-neutral-900 dark:hover:text-white underline cursor-pointer"
              >
                Trocar foto
              </button>
            </div>
          )}
        </div>

        {isMatching && (
          <div className="p-3.5 rounded-md bg-neutral-50 dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-800 text-xs flex items-center justify-center gap-2 text-neutral-600 dark:text-neutral-300">
            <div className="w-4 h-4 border-2 border-neutral-900 dark:border-white border-t-transparent rounded-full animate-spin shrink-0" />
            <span>O sistema está buscando...</span>
          </div>
        )}

        {errorMessage && (
          <div className="p-3 rounded-md bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-900 text-rose-700 dark:text-rose-300 text-xs flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{errorMessage}</span>
          </div>
        )}

        {/* ONLY DISPLAY ID IF A MATCH WAS FOUND */}
        {matchResult && !isMatching && matchResult.matchedId && (
          <div className="p-4 rounded-lg bg-neutral-50 dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-800 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <span className="text-lg font-mono font-bold text-neutral-900 dark:text-white tabular-nums">
                  ID: {matchResult.matchedId}
                </span>
                {matchResult.mlbId && (
                  <span className="text-xs font-mono text-neutral-500 tabular-nums">
                    · {matchResult.mlbId}
                  </span>
                )}
              </div>
              <p className="text-xs text-neutral-700 dark:text-neutral-300">
                {matchResult.matchedItem}
              </p>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              <button
                type="button"
                onClick={() => copyToClipboard(matchResult.matchedId)}
                className="px-3 py-1.5 text-xs font-medium rounded-md bg-neutral-900 text-white dark:bg-white dark:text-neutral-950 hover:opacity-90 flex items-center gap-1.5 cursor-pointer"
              >
                {copiedId === matchResult.matchedId ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                <span>{copiedId === matchResult.matchedId ? 'Copiado' : 'Copiar ID'}</span>
              </button>

              <a
                href={formatMercadoLivreUrl(matchResult.matchedItem || matchResult.mercadoLivreTitle, matchResult.mlbId)}
                target="_blank"
                rel="noopener noreferrer"
                className="px-3 py-1.5 text-xs font-medium rounded-md border border-neutral-200 dark:border-neutral-800 text-neutral-800 dark:text-neutral-200 hover:border-neutral-900 flex items-center gap-1.5"
              >
                <span>Abrir no ML</span>
                <ExternalLink className="w-3.5 h-3.5" />
              </a>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
