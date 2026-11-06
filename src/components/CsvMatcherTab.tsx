import React, { useState, useMemo } from 'react';
import {
  Copy,
  Check,
  Search,
  Trash2,
  Plus,
  ExternalLink,
  RefreshCw,
  ListPlus,
  X,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';
import { CsvItem } from '../types/csvMatcher';
import { searchMlbByNames, MlbNameSearchItemResult } from '../services/mlApi';
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

function buildInstantMlbResult(rawQuery: string): MlbNameSearchItemResult {
  const query = rawQuery.trim();
  const searchUrl = formatMercadoLivreUrl(query);

  return {
    query,
    primaryMlbId: '',
    searchUrl,
    ads: [],
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

  const [copiedId, setCopiedId] = useState<string | null>(null);

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
            const hasCsvMlb = Boolean((item.mlbId || item.mlb || '').trim());
            const score =
              (hasCsvMlb ? 250 : 0) +
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

      const baseMlbData = mlbResultsMap[normQuery] || buildInstantMlbResult(rawQuery);
      // Prioritize MLBs that come from the CSV (Coluna G)
      const csvMlbAds = matchedItems
        .filter((m) => Boolean((m.item.mlbId || m.item.mlb || '').trim()))
        .map((m) => {
          const mlbCode = (m.item.mlbId || m.item.mlb || '').trim();
          return {
            mlbId: mlbCode,
            title: `[CSV · ID ${m.item.id}] ${m.item.itens}`,
            price: m.item.valorReal ? `R$ ${m.item.valorReal}` : 'No CSV',
            url: formatMercadoLivreUrl(m.item.itens, mlbCode),
            searchUrl: formatMercadoLivreUrl(m.item.itens, mlbCode),
            condition: 'Novo',
          };
        });

      const mlbData: MlbNameSearchItemResult =
        csvMlbAds.length > 0
          ? {
              query: baseMlbData.query,
              primaryMlbId: csvMlbAds[0].mlbId,
              searchUrl: csvMlbAds[0].url,
              ads: csvMlbAds,
            }
          : baseMlbData;

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
                        {group.mlbData.primaryMlbId && (
                          <span className="text-xs font-mono text-neutral-500 tabular-nums">
                            · {group.mlbData.primaryMlbId}
                          </span>
                        )}
                      </div>

                      <div className="flex items-center gap-2">
                        {group.mlbData.primaryMlbId && (
                          <button
                            type="button"
                            onClick={() => copyToClipboard(group.mlbData.primaryMlbId, `p-mlb-${group.queryIdx}`)}
                            className="px-2 py-1 text-[11px] font-mono rounded border border-neutral-200 dark:border-neutral-800 text-neutral-700 dark:text-neutral-300 hover:border-neutral-900 flex items-center gap-1 cursor-pointer"
                          >
                            {copiedId === `p-mlb-${group.queryIdx}` ? <Check className="w-3 h-3 text-emerald-600" /> : <Copy className="w-3 h-3" />}
                            <span>Copiar MLB</span>
                          </button>
                        )}

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

                        {group.mlbData.ads.length === 0 ? (
                          <p className="text-xs text-neutral-500 italic py-2">
                            Nenhum código MLB cadastrado no CSV ou anúncio direto encontrado para este termo. Use "Abrir no ML" para pesquisar.
                          </p>
                        ) : (
                          <div className="divide-y divide-neutral-100 dark:divide-neutral-800/60">
                            {group.mlbData.ads.map((ad, adIdx) => (
                              <div
                                key={adIdx}
                                className="py-2 first:pt-0 last:pb-0 flex items-center justify-between gap-3"
                              >
                                <div className="min-w-0 flex-1">
                                  <div className="flex items-center gap-2">
                                    {ad.mlbId && (
                                      <span className="text-xs font-mono font-semibold text-neutral-900 dark:text-neutral-200 tabular-nums">
                                        {ad.mlbId}
                                      </span>
                                    )}
                                    {ad.price && (
                                      <span className="text-[11px] font-mono text-neutral-500 tabular-nums">
                                        {ad.price}
                                      </span>
                                    )}
                                  </div>
                                  <p className="text-xs text-neutral-600 dark:text-neutral-400 truncate">
                                    {ad.title}
                                  </p>
                                </div>

                                <div className="flex items-center gap-1.5 shrink-0">
                                  {ad.mlbId && (
                                    <button
                                      type="button"
                                      onClick={() => copyToClipboard(ad.mlbId, `mlb-${group.queryIdx}-${adIdx}`)}
                                      className="px-2 py-1 text-[11px] font-mono rounded border border-neutral-200 dark:border-neutral-800 text-neutral-600 dark:text-neutral-300 hover:border-neutral-900 flex items-center gap-1 cursor-pointer"
                                    >
                                      {copiedId === `mlb-${group.queryIdx}-${adIdx}` ? <Check className="w-3 h-3 text-emerald-600" /> : <Copy className="w-3 h-3" />}
                                      <span>MLB</span>
                                    </button>
                                  )}

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
                        )}
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
    </div>
  );
};
