import React, { useState, useMemo } from 'react';
import {
  Search,
  ExternalLink,
  AlertCircle,
  Copy,
  Check,
  Plus,
  Trash2,
  X,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';
import { CsvItem, KitSearchResult } from '../types/csvMatcher';
import { searchKitsOnMercadoLivre } from '../services/mlApi';
import { formatMercadoLivreUrl } from '../utils/mlUrl';

interface KitSearchTabProps {
  csvItems: CsvItem[];
}

const MATCHES_PER_PAGE = 10;

const PT_STOP_WORDS = new Set([
  'de', 'da', 'do', 'das', 'dos', 'em', 'no', 'na', 'nos', 'nas',
  'para', 'p/', 'pra', 'por', 'com', 'sem', 'sob', 'sobre',
  'e', 'ou', 'a', 'o', 'as', 'os', 'um', 'uma', 'uns', 'umas',
  'que', 'se', 'ao', 'aos', 'ref', 'tipo', 'novo', 'nova',
]);

function normalizeText(text: string): string {
  return (text || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^\w\s\d]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function extractItemKeywords(text: string): string[] {
  const words = normalizeText(text).split(' ');
  const result: string[] = [];
  const seen = new Set<string>();
  for (const w of words) {
    const clean = w.trim();
    if (!clean || clean.length < 2 || PT_STOP_WORDS.has(clean) || seen.has(clean)) continue;
    seen.add(clean);
    result.push(clean);
  }
  return result;
}

export const KitSearchTab: React.FC<KitSearchTabProps> = ({ csvItems }) => {
  // Separate input field for each item in the kit (starts with 2 fields by default)
  const [kitInputs, setKitInputs] = useState<string[]>(['', '']);
  const [description, setDescription] = useState('');
  const [submittedItems, setSubmittedItems] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [result, setResult] = useState<KitSearchResult | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(1);

  const updateKitInput = (index: number, value: string) => {
    setKitInputs((prev) => {
      const next = [...prev];
      next[index] = value;
      return next;
    });
  };

  const addKitInputField = () => {
    setKitInputs((prev) => [...prev, '']);
  };

  const removeKitInputField = (index: number) => {
    setKitInputs((prev) => {
      if (prev.length <= 1) return [''];
      return prev.filter((_, idx) => idx !== index);
    });
  };

  const clearAllFields = () => {
    setKitInputs(['', '']);
    setDescription('');
    setSubmittedItems([]);
    setResult(null);
    setErrorMessage(null);
    setCurrentPage(1);
  };

  const filledItems = useMemo(
    () => kitInputs.map((item) => item.trim()).filter(Boolean),
    [kitInputs]
  );

  // Rank CSV / Firebase items based on how many of the typed kit items they match
  const localKitMatches = useMemo(() => {
    if (submittedItems.length === 0 || csvItems.length === 0) return [];

    const itemKeywordGroups = submittedItems.map((rawItem) => ({
      rawItem,
      keywords: extractItemKeywords(rawItem),
    })).filter((g) => g.keywords.length > 0);

    if (itemKeywordGroups.length === 0) return [];

    const allKeywords = Array.from(
      new Set(itemKeywordGroups.flatMap((g) => g.keywords))
    );

    const scored: Array<{
      item: CsvItem;
      matchedItemsCount: number;
      totalItemsSearched: number;
      matchedKeywords: string[];
      isKitRow: boolean;
      score: number;
    }> = [];

    for (const csvItem of csvItems) {
      const normDesc = ` ${normalizeText(csvItem.itens)} `;
      let matchedItemsCount = 0;
      const matchedKeywordsSet = new Set<string>();

      for (const group of itemKeywordGroups) {
        let groupHitCount = 0;
        for (const kw of group.keywords) {
          if (normDesc.includes(` ${kw} `) || normDesc.includes(kw)) {
            groupHitCount++;
            matchedKeywordsSet.add(kw);
          }
        }
        const minForGroup =
          group.keywords.length <= 2
            ? group.keywords.length
            : Math.ceil(group.keywords.length * 0.5);
        if (groupHitCount >= Math.max(1, minForGroup)) {
          matchedItemsCount++;
        }
      }

      if (matchedKeywordsSet.size === 0) continue;

      // Require at least 1 typed item matched (or strong keyword overlap)
      if (matchedItemsCount === 0 && matchedKeywordsSet.size < 2) continue;

      const isKitRow =
        /\b(kit|combo|conjunto|par|pares|unidades|pecas|pcs)\b/i.test(csvItem.itens) ||
        csvItem.itens.includes('+') ||
        Number(csvItem.qtdItens || '1') > 1;

      const allTypedItemsMatched = matchedItemsCount === itemKeywordGroups.length;
      const itemCoverageScore =
        (matchedItemsCount / Math.max(itemKeywordGroups.length, 1)) * 60;
      const kwCoverageScore =
        (matchedKeywordsSet.size / Math.max(allKeywords.length, 1)) * 30;
      const bonus = (allTypedItemsMatched ? 25 : 0) + (isKitRow ? 10 : 0);

      scored.push({
        item: csvItem,
        matchedItemsCount,
        totalItemsSearched: itemKeywordGroups.length,
        matchedKeywords: Array.from(matchedKeywordsSet),
        isKitRow,
        score: Math.min(100, Math.round(itemCoverageScore + kwCoverageScore + bonus)),
      });
    }

    scored.sort((a, b) => {
      if (b.matchedItemsCount !== a.matchedItemsCount) {
        return b.matchedItemsCount - a.matchedItemsCount;
      }
      if (b.score !== a.score) {
        return b.score - a.score;
      }
      return b.matchedKeywords.length - a.matchedKeywords.length;
    });

    return scored;
  }, [submittedItems, csvItems]);

  const handleSearch = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (filledItems.length === 0) {
      setErrorMessage('Digite pelo menos um item em uma das áreas para pesquisar o kit.');
      return;
    }

    setSubmittedItems(filledItems);
    setCurrentPage(1);
    setIsLoading(true);
    setErrorMessage(null);

    const combinedQuery = filledItems.join(' + ');

    // Send only top candidate CSV items to backend to keep request fast even with huge CSVs
    const allSearchKws = extractItemKeywords(`${combinedQuery} ${description}`);
    const topCandidates = [...csvItems]
      .map((it) => {
        const norm = normalizeText(it.itens);
        let hits = 0;
        for (const kw of allSearchKws) {
          if (norm.includes(kw)) hits++;
        }
        return { it, hits };
      })
      .sort((a, b) => b.hits - a.hits)
      .slice(0, 60)
      .map((x) => x.it);

    try {
      const data = await searchKitsOnMercadoLivre(combinedQuery, description, topCandidates);
      setResult(data);
    } catch (err: any) {
      setErrorMessage(err.message || 'Erro ao pesquisar kits');
    } finally {
      setIsLoading(false);
    }
  };

  const copyToClipboard = (text: string, key: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 1800);
  };

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

  const totalPages = Math.max(1, Math.ceil(localKitMatches.length / MATCHES_PER_PAGE));
  const safePage = Math.min(currentPage, totalPages);
  const paginatedMatches = localKitMatches.slice(
    (safePage - 1) * MATCHES_PER_PAGE,
    safePage * MATCHES_PER_PAGE
  );

  return (
    <div className="space-y-6">
      <div className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-lg p-6">
        <form onSubmit={handleSearch} className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <label className="text-xs font-semibold text-neutral-900 dark:text-white uppercase tracking-wider block">
                Itens do Kit (1 item por campo)
              </label>
              <span className="text-[11px] text-neutral-500">
                Digite cada produto em sua própria área para localizar o kit correspondente
              </span>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={addKitInputField}
                className="px-2.5 py-1.5 text-xs font-medium rounded-md border border-neutral-200 dark:border-neutral-800 text-neutral-700 dark:text-neutral-300 hover:border-neutral-900 dark:hover:border-neutral-500 transition-colors flex items-center gap-1 cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Mais 1 item</span>
              </button>

              {(filledItems.length > 0 || description.trim() !== '' || result) && (
                <button
                  type="button"
                  onClick={clearAllFields}
                  className="px-2.5 py-1.5 text-xs font-medium rounded-md text-neutral-500 hover:text-rose-600 transition-colors cursor-pointer"
                >
                  Limpar
                </button>
              )}
            </div>
          </div>

          {/* SEPARATE INPUT AREAS FOR EACH KIT ITEM */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
            {kitInputs.map((itemValue, idx) => (
              <div key={idx} className="flex items-center gap-2">
                <div className="relative flex-1">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[11px] font-mono font-semibold text-neutral-400 select-none">
                    #{idx + 1}
                  </span>
                  <input
                    type="text"
                    value={itemValue}
                    onChange={(e) => updateKitInput(idx, e.target.value)}
                    placeholder={
                      idx === 0
                        ? 'Item 1 (ex: Lixeira Basculante 12 Litros)'
                        : idx === 1
                        ? 'Item 2 (ex: Kit 2 Lixeira Inox 9L Tampa Click)'
                        : `Item ${idx + 1} do kit...`
                    }
                    className="w-full pl-9 pr-8 py-2 text-xs bg-neutral-50 dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-800 rounded-md text-neutral-900 dark:text-white focus:outline-hidden focus:border-neutral-900 dark:focus:border-neutral-400"
                  />
                  {itemValue && (
                    <button
                      type="button"
                      onClick={() => updateKitInput(idx, '')}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-200 cursor-pointer"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>

                {kitInputs.length > 1 && (
                  <button
                    type="button"
                    onClick={() => removeKitInputField(idx)}
                    title="Remover este campo"
                    className="p-2 rounded-md border border-neutral-200 dark:border-neutral-800 text-neutral-400 hover:text-rose-600 transition-colors cursor-pointer"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            ))}
          </div>

          <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-3 pt-1">
            <div className="flex-1">
              <label className="text-[11px] font-medium text-neutral-500 block mb-1">
                Observações / Detalhes Adicionais (Opcional)
              </label>
              <input
                type="text"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Ex: Inox, cor preta, voltagem, quantidade..."
                className="w-full px-3 py-2 text-xs bg-neutral-50 dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-800 rounded-md text-neutral-900 dark:text-white focus:outline-hidden focus:border-neutral-900"
              />
            </div>

            <button
              type="submit"
              disabled={isLoading || filledItems.length === 0}
              className="px-4 py-2 text-xs font-medium rounded-md bg-neutral-900 text-white dark:bg-white dark:text-neutral-950 hover:opacity-90 disabled:opacity-40 transition-opacity flex items-center justify-center gap-2 cursor-pointer shrink-0"
            >
              {isLoading ? (
                <>
                  <div className="w-3.5 h-3.5 border-2 border-current border-t-transparent rounded-full animate-spin" />
                  <span>O sistema está buscando...</span>
                </>
              ) : (
                <>
                  <Search className="w-3.5 h-3.5" />
                  <span>Buscar Kit ({filledItems.length})</span>
                </>
              )}
            </button>
          </div>
        </form>

        {errorMessage && (
          <div className="mt-4 p-3 rounded-md bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-900 text-rose-700 dark:text-rose-300 text-xs flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{errorMessage}</span>
          </div>
        )}
      </div>

      {/* 1. PERFECT KIT MATCHES IN FIREBASE / CSV (ONLY SHOWN WHEN MATCHES EXIST) */}
      {submittedItems.length > 0 && localKitMatches.length > 0 && (
        <div className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-lg overflow-hidden">
          <div className="px-6 py-3.5 bg-neutral-50 dark:bg-neutral-950 border-b border-neutral-200 dark:border-neutral-800 flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold text-neutral-900 dark:text-white uppercase tracking-wider">
                Match de Kit na Base ({localKitMatches.length})
              </span>
              {localKitMatches[0].matchedItemsCount === submittedItems.length && submittedItems.length > 1 && (
                <span className="text-[11px] font-mono px-2 py-0.5 rounded bg-neutral-900 text-white dark:bg-white dark:text-neutral-950">
                  Todos os {submittedItems.length} itens encontrados juntos
                </span>
              )}
            </div>

            <button
              type="button"
              onClick={() => {
                const ids = localKitMatches.map((m) => m.item.id);
                copyToClipboard(ids.join('\n'), 'all-kit-ids');
              }}
              className="px-2.5 py-1 text-xs font-medium rounded border border-neutral-200 dark:border-neutral-800 text-neutral-700 dark:text-neutral-300 hover:border-neutral-900 flex items-center gap-1 cursor-pointer"
            >
              {copiedKey === 'all-kit-ids' ? <Check className="w-3 h-3 text-emerald-600" /> : <Copy className="w-3 h-3" />}
              <span>Copiar IDs</span>
            </button>
          </div>

          <div className="divide-y divide-neutral-100 dark:divide-neutral-800/60">
            {paginatedMatches.map((match, idx) => {
              const isTopMatch = safePage === 1 && idx === 0;
              const colGMlb = match.item.mlbId || match.item.mlb || '';
              return (
                <div
                  key={match.item.id}
                  className={`px-6 py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4 ${
                    isTopMatch ? 'bg-neutral-50/60 dark:bg-neutral-950/50' : ''
                  }`}
                >
                  <div className="space-y-1 min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span
                        className={`font-mono font-bold text-neutral-900 dark:text-white tabular-nums ${
                          isTopMatch ? 'text-base' : 'text-xs'
                        }`}
                      >
                        ID: {match.item.id}
                      </span>

                      {colGMlb && (
                        <span className="text-xs font-mono text-neutral-600 dark:text-neutral-300 tabular-nums">
                          · Col. G: {colGMlb}
                        </span>
                      )}

                      <span className="text-[11px] font-mono px-1.5 py-0.5 rounded border border-neutral-200 dark:border-neutral-800 text-neutral-600 dark:text-neutral-400 tabular-nums">
                        {match.matchedItemsCount}/{match.totalItemsSearched} itens do kit
                      </span>

                      {match.item.valorReal && (
                        <span className="text-xs font-mono text-neutral-500 tabular-nums">
                          · R$ {match.item.valorReal}
                        </span>
                      )}
                    </div>

                    <p className="text-xs text-neutral-800 dark:text-neutral-200 leading-relaxed">
                      {highlightText(match.item.itens, match.matchedKeywords)}
                    </p>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    {colGMlb && (
                      <button
                        type="button"
                        onClick={() => copyToClipboard(colGMlb, `kit-mlb-csv-${match.item.id}`)}
                        className="px-2.5 py-1.5 text-xs font-mono rounded-md border border-neutral-200 dark:border-neutral-800 text-neutral-700 dark:text-neutral-300 hover:border-neutral-900 flex items-center gap-1 cursor-pointer"
                      >
                        {copiedKey === `kit-mlb-csv-${match.item.id}` ? (
                          <Check className="w-3.5 h-3.5 text-emerald-600" />
                        ) : (
                          <Copy className="w-3.5 h-3.5" />
                        )}
                        <span>MLB</span>
                      </button>
                    )}

                    <button
                      type="button"
                      onClick={() => copyToClipboard(match.item.id, `kit-csv-${match.item.id}`)}
                      className="px-3 py-1.5 text-xs font-medium rounded-md bg-neutral-900 text-white dark:bg-white dark:text-neutral-950 hover:opacity-90 flex items-center gap-1.5 cursor-pointer"
                    >
                      {copiedKey === `kit-csv-${match.item.id}` ? (
                        <Check className="w-3.5 h-3.5 text-emerald-400" />
                      ) : (
                        <Copy className="w-3.5 h-3.5" />
                      )}
                      <span>{copiedKey === `kit-csv-${match.item.id}` ? 'Copiado' : 'Copiar ID'}</span>
                    </button>

                    <a
                      href={formatMercadoLivreUrl(match.item.itens, colGMlb)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="px-2.5 py-1.5 text-xs font-medium rounded-md border border-neutral-200 dark:border-neutral-800 text-neutral-700 dark:text-neutral-300 hover:border-neutral-900 flex items-center gap-1"
                    >
                      <span>Anúncio ML</span>
                      <ExternalLink className="w-3 h-3" />
                    </a>
                  </div>
                </div>
              );
            })}
          </div>

          {totalPages > 1 && (
            <div className="px-6 py-3 border-t border-neutral-200 dark:border-neutral-800 flex items-center justify-between text-xs text-neutral-500">
              <span className="font-mono tabular-nums">
                Página {safePage} de {totalPages}
              </span>
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  disabled={safePage <= 1}
                  onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                  className="p-1.5 rounded border border-neutral-200 dark:border-neutral-800 disabled:opacity-40 cursor-pointer"
                >
                  <ChevronLeft className="w-3.5 h-3.5" />
                </button>
                <button
                  type="button"
                  disabled={safePage >= totalPages}
                  onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                  className="p-1.5 rounded border border-neutral-200 dark:border-neutral-800 disabled:opacity-40 cursor-pointer"
                >
                  <ChevronRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* 2. MERCADO LIVRE KIT RESULTS */}
      {result && (
        <div className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-lg p-6 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-neutral-200 dark:border-neutral-800">
            <div>
              <span className="text-[11px] font-medium text-neutral-400 uppercase tracking-wider block">
                Kit Sugerido no Mercado Livre
              </span>
              <h3 className="text-sm font-semibold text-neutral-900 dark:text-white">
                {result.kitTitle}
              </h3>
              <span className="text-xs font-mono text-neutral-500 tabular-nums">
                {result.estimatedPrice}
              </span>
            </div>

            <a
              href={result.mercadoLivreSearchUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="px-3.5 py-1.5 text-xs font-medium rounded-md bg-neutral-900 text-white dark:bg-white dark:text-neutral-950 hover:opacity-90 flex items-center gap-1.5 self-start sm:self-auto"
            >
              <span>Abrir Kit no ML</span>
              <ExternalLink className="w-3.5 h-3.5" />
            </a>
          </div>

          {result.ads && result.ads.length > 0 && (
            <div className="divide-y divide-neutral-100 dark:divide-neutral-800/60">
              {result.ads.map((ad, idx) => (
                <div key={idx} className="py-2.5 first:pt-0 last:pb-0 flex items-center justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      {ad.mlbId && (
                        <span className="text-xs font-mono font-semibold text-neutral-900 dark:text-neutral-200 tabular-nums">
                          {ad.mlbId}
                        </span>
                      )}
                      <span className="text-[11px] font-mono text-neutral-500 tabular-nums">
                        {ad.price}
                      </span>
                    </div>
                    <p className="text-xs text-neutral-700 dark:text-neutral-300 truncate">
                      {ad.title}
                    </p>
                  </div>

                  <div className="flex items-center gap-1.5 shrink-0">
                    {ad.mlbId && (
                      <button
                        type="button"
                        onClick={() => copyToClipboard(ad.mlbId || '', `kit-mlb-${idx}`)}
                        className="px-2 py-1 text-[11px] font-mono rounded border border-neutral-200 dark:border-neutral-800 text-neutral-600 dark:text-neutral-300 hover:border-neutral-900 flex items-center gap-1 cursor-pointer"
                      >
                        {copiedKey === `kit-mlb-${idx}` ? <Check className="w-3 h-3 text-emerald-600" /> : <Copy className="w-3 h-3" />}
                        <span>MLB</span>
                      </button>
                    )}
                    <a
                      href={ad.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="px-2.5 py-1 text-[11px] font-medium rounded border border-neutral-200 dark:border-neutral-800 text-neutral-800 dark:text-neutral-200 hover:border-neutral-900 flex items-center gap-1"
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
      )}
    </div>
  );
};
