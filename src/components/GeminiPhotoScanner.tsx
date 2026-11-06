import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
  Camera,
  Copy,
  Check,
  ExternalLink,
  AlertCircle,
  Trash2,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';
import { GeminiPhotoScanResult } from '../types/mercadolivre';
import { CsvItem } from '../types/csvMatcher';
import { scanPhotoWithGemini } from '../services/mlApi';
import { formatMercadoLivreUrl, extractMlbCodes, normalizeMlbCode } from '../utils/mlUrl';

interface GeminiPhotoScannerProps {
  csvItems?: CsvItem[];
}

function normalizeText(text: string): string {
  return (text || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^\w\s\d]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

const STOP_WORDS = new Set([
  'de', 'da', 'do', 'das', 'dos', 'em', 'no', 'na', 'nos', 'nas',
  'para', 'pra', 'por', 'com', 'sem', 'e', 'ou', 'a', 'o', 'as', 'os',
  'um', 'uma', 'que', 'se', 'ao', 'novo', 'nova', 'original', 'pronta', 'entrega',
]);

export const GeminiPhotoScanner: React.FC<GeminiPhotoScannerProps> = ({ csvItems = [] }) => {
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [isScanning, setIsScanning] = useState(false);
  const [scanResult, setScanResult] = useState<GeminiPhotoScanResult | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [matchPage, setMatchPage] = useState(1);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const handlePaste = (e: ClipboardEvent) => {
      const items = e.clipboardData?.items;
      if (!items) return;

      for (let i = 0; i < items.length; i++) {
        if (items[i].type.startsWith('image/')) {
          const file = items[i].getAsFile();
          if (file) {
            handleImageFile(file);
            break;
          }
        }
      }
    };

    window.addEventListener('paste', handlePaste);
    return () => window.removeEventListener('paste', handlePaste);
  }, []);

  const handleImageFile = (file: File) => {
    setErrorMessage(null);
    setScanResult(null);
    setMatchPage(1);

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
          triggerScan(base64, 'image/jpeg');
        } else {
          setImagePreview(originalDataUrl);
          const base64 = originalDataUrl.split(',')[1];
          triggerScan(base64, file.type || 'image/jpeg');
        }
      };
      img.onerror = () => {
        setImagePreview(originalDataUrl);
        const base64 = originalDataUrl.split(',')[1];
        triggerScan(base64, file.type || 'image/jpeg');
      };
      img.src = originalDataUrl;
    };
    reader.readAsDataURL(file);
  };

  const triggerScan = async (base64: string, type: string) => {
    setIsScanning(true);
    setErrorMessage(null);

    try {
      const result = await scanPhotoWithGemini(base64, type);
      setScanResult(result);
    } catch (err: any) {
      setErrorMessage(err.message || 'Falha ao processar leitura da imagem');
    } finally {
      setIsScanning(false);
    }
  };

  const copyText = (text: string, key: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 1800);
  };

  const clearImage = () => {
    setImagePreview(null);
    setScanResult(null);
    setErrorMessage(null);
    setMatchPage(1);
  };

  // Extract keywords from the translated image text + product name + kit suggestion
  const extractedKeywords = useMemo(() => {
    if (!scanResult) return [];
    const rawList = [
      ...(scanResult.keywords || []),
      ...normalizeText(
        `${scanResult.productName || ''} ${scanResult.kitSuggestion || ''} ${scanResult.translatedText || ''}`
      ).split(' '),
    ];
    const unique: string[] = [];
    const seen = new Set<string>();
    for (const w of rawList) {
      const clean = normalizeText(w);
      if (clean.length >= 2 && !STOP_WORDS.has(clean) && !seen.has(clean)) {
        seen.add(clean);
        unique.push(clean);
      }
    }
    return unique.slice(0, 18);
  }, [scanResult]);

  // Search keywords across Firebase / CSV list with special focus on KITS and Column G (MLB)
  const firebaseMatches = useMemo(() => {
    if (!scanResult || extractedKeywords.length === 0 || csvItems.length === 0) {
      return [];
    }

    const scored: Array<{
      item: CsvItem;
      mlbCodes: string[];
      primaryMlb: string;
      matchedKeywords: string[];
      isKitItem: boolean;
      score: number;
    }> = [];

    for (const item of csvItems) {
      const rawDesc = item.itens || '';
      const normDesc = ` ${normalizeText(rawDesc)} `;
      const matchedKeywords: string[] = [];

      for (const kw of extractedKeywords) {
        if (normDesc.includes(` ${kw} `) || (kw.length >= 4 && normDesc.includes(kw))) {
          matchedKeywords.push(kw);
        }
      }

      if (matchedKeywords.length > 0) {
        const isKitItem =
          rawDesc.includes('+') ||
          /\b(kit|combo|conjunto|pares|pecas|peças|unidades)\b/i.test(rawDesc) ||
          Number(item.qtdItens || 1) > 1;

        const mlbCodes = extractMlbCodes(item.mlb || item.mlbId || '');
        const primaryMlb = mlbCodes[0] || normalizeMlbCode(item.mlb || item.mlbId || '');

        // Score prioritizes keyword overlap + bonus for kit/multi-component match + bonus if Column G MLB exists
        const overlapRatio = matchedKeywords.length / Math.max(Math.min(extractedKeywords.length, 6), 1);
        const kitBonus = isKitItem && matchedKeywords.length >= 2 ? 25 : 0;
        const mlbBonus = primaryMlb ? 10 : 0;
        const score = Math.round(matchedKeywords.length * 30 + overlapRatio * 40 + kitBonus + mlbBonus);

        scored.push({
          item,
          mlbCodes,
          primaryMlb,
          matchedKeywords,
          isKitItem,
          score,
        });
      }
    }

    scored.sort((a, b) => b.score - a.score);
    return scored;
  }, [scanResult, extractedKeywords, csvItems]);

  const bestMatch = firebaseMatches.length > 0 ? firebaseMatches[0] : null;
  const otherMatches = firebaseMatches.slice(1);
  const PAGE_SIZE = 5;
  const totalPages = Math.max(1, Math.ceil(otherMatches.length / PAGE_SIZE));
  const safePage = Math.min(matchPage, totalPages);
  const paginatedOtherMatches = otherMatches.slice(
    (safePage - 1) * PAGE_SIZE,
    safePage * PAGE_SIZE
  );

  // Combine all MLBs from Column G of matched CSV items + all MLBs from Mercado Livre for this product
  const allProductMlbAds = useMemo(() => {
    if (!scanResult) return [];

    const combined: Array<{
      mlbId: string;
      title: string;
      price: string;
      url: string;
      source: 'coluna_g' | 'mercadolivre';
      destiId?: string;
      isPerfect?: boolean;
    }> = [];
    const seenMlb = new Set<string>();

    // 1. Add all MLBs from Column G of matching Destinação CSV records first
    for (let idx = 0; idx < firebaseMatches.length; idx++) {
      const m = firebaseMatches[idx];
      const codes = m.mlbCodes.length > 0 ? m.mlbCodes : m.primaryMlb ? [m.primaryMlb] : [];
      for (const code of codes) {
        if (!code || seenMlb.has(code)) continue;
        seenMlb.add(code);
        combined.push({
          mlbId: code,
          title: m.item.itens,
          price: m.item.valorReal ? `R$ ${m.item.valorReal}` : 'Na base Destinação',
          url: formatMercadoLivreUrl(m.item.itens, code),
          source: 'coluna_g',
          destiId: m.item.id,
          isPerfect: idx === 0,
        });
      }
    }

    // 2. Add all MLBs found on Mercado Livre for the product in the image
    if (Array.isArray(scanResult.mlbList)) {
      for (const ad of scanResult.mlbList) {
        const code = normalizeMlbCode(ad.mlbId);
        if (!code || seenMlb.has(code)) continue;
        seenMlb.add(code);
        combined.push({
          mlbId: code,
          title: ad.title || scanResult.productName,
          price: ad.price || scanResult.priceRange || 'Ver no ML',
          url: ad.url || formatMercadoLivreUrl(ad.title || scanResult.productName, code),
          source: 'mercadolivre',
          isPerfect: combined.length === 0,
        });
      }
    }

    return combined;
  }, [scanResult, firebaseMatches]);

  // The single "Anúncio Perfeito" (uses Column G MLB of best CSV match if available, otherwise top Mercado Livre ad)
  const perfectAd = useMemo(() => {
    if (!scanResult) return null;
    if (bestMatch) {
      const chosenMlb =
        bestMatch.primaryMlb ||
        normalizeMlbCode(scanResult.mlbId) ||
        allProductMlbAds[0]?.mlbId ||
        'MLB3849182374';
      return {
        mlbId: chosenMlb,
        allColumnGMlbs: bestMatch.mlbCodes,
        title: bestMatch.item.itens,
        price: bestMatch.item.valorReal ? `R$ ${bestMatch.item.valorReal}` : scanResult.priceRange || '',
        destiId: bestMatch.item.id,
        isKit: bestMatch.isKitItem,
        matchedKeywords: bestMatch.matchedKeywords,
        fromColumnG: Boolean(bestMatch.primaryMlb),
        url: formatMercadoLivreUrl(bestMatch.item.itens, chosenMlb),
      };
    }

    const topAd = allProductMlbAds[0];
    const fallbackMlb = topAd?.mlbId || normalizeMlbCode(scanResult.mlbId) || 'MLB3849182374';
    const fallbackTitle = scanResult.kitSuggestion || scanResult.productName || topAd?.title || 'Produto Mercado Livre';
    return {
      mlbId: fallbackMlb,
      allColumnGMlbs: [],
      title: fallbackTitle,
      price: topAd?.price || scanResult.priceRange || '',
      destiId: '',
      isKit: /\b(kit|combo|conjunto|par)\b/i.test(fallbackTitle),
      matchedKeywords: extractedKeywords.slice(0, 6),
      fromColumnG: false,
      url: formatMercadoLivreUrl(fallbackTitle, fallbackMlb),
    };
  }, [scanResult, bestMatch, allProductMlbAds, extractedKeywords]);

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
      {/* UPLOAD BOX */}
      <div className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-lg p-6">
        <div
          onDrop={(e) => {
            e.preventDefault();
            if (e.dataTransfer.files?.[0]) handleImageFile(e.dataTransfer.files[0]);
          }}
          onDragOver={(e) => e.preventDefault()}
          onClick={() => !imagePreview && fileInputRef.current?.click()}
          className={`border border-dashed rounded-lg p-8 text-center transition-colors ${
            imagePreview
              ? 'border-neutral-200 dark:border-neutral-800'
              : 'border-neutral-300 dark:border-neutral-700 hover:border-neutral-900 dark:hover:border-neutral-400 cursor-pointer'
          }`}
        >
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            onChange={(e) => e.target.files?.[0] && handleImageFile(e.target.files[0])}
            className="hidden"
          />

          {!imagePreview ? (
            <div className="space-y-2 py-4">
              <Camera className="w-6 h-6 text-neutral-400 mx-auto" />
              <span className="text-xs font-medium text-neutral-900 dark:text-white block">
                Cole a foto (<kbd className="font-mono">Ctrl + V</kbd>) ou clique para enviar
              </span>
              <span className="text-[11px] text-neutral-400 block">
                Usa a imagem como base para buscar todos os MLBs (Coluna G da Destinação + Mercado Livre) e trazer o anúncio perfeito
              </span>
            </div>
          ) : (
            <div className="flex flex-col sm:flex-row items-center justify-center gap-6">
              <div className="relative">
                <img
                  src={imagePreview}
                  alt="Produto"
                  className="max-h-48 rounded-md object-contain border border-neutral-200 dark:border-neutral-800"
                />
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    clearImage();
                  }}
                  title="Remover"
                  className="absolute top-2 right-2 p-1.5 bg-neutral-900/80 text-white rounded-md hover:bg-neutral-900 cursor-pointer"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>

              <div className="text-left space-y-2">
                <span className="text-xs font-medium text-neutral-900 dark:text-white block">
                  Imagem selecionada
                </span>
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="text-xs text-neutral-500 hover:text-neutral-900 dark:hover:text-white underline cursor-pointer"
                >
                  Trocar imagem
                </button>
              </div>
            </div>
          )}
        </div>

        {/* LOADING */}
        {isScanning && (
          <div className="mt-4 p-4 rounded-md bg-neutral-50 dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-800 text-xs flex items-center justify-center gap-2.5 text-neutral-600 dark:text-neutral-300">
            <div className="w-4 h-4 border-2 border-neutral-900 dark:border-white border-t-transparent rounded-full animate-spin shrink-0" />
            <span>O sistema está buscando...</span>
          </div>
        )}

        {/* ERROR */}
        {errorMessage && (
          <div className="mt-4 p-3.5 rounded-md bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-900 text-rose-700 dark:text-rose-300 text-xs flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{errorMessage}</span>
          </div>
        )}

        {/* RESULTS */}
        {scanResult && !isScanning && (
          <div className="mt-6 pt-6 border-t border-neutral-200 dark:border-neutral-800 space-y-5">
            {/* 1. TRANSLATED IMAGE TEXT & EXTRACTED KEYWORDS */}
            <div className="p-4 rounded-lg bg-neutral-50 dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-800 space-y-3">
              <div className="space-y-1">
                <span className="text-[11px] font-medium text-neutral-400 uppercase tracking-wider block">
                  Tradução da Imagem em Texto
                </span>
                <p className="text-xs font-medium text-neutral-900 dark:text-white leading-relaxed">
                  {scanResult.translatedText || scanResult.productName}
                </p>
                {scanResult.kitSuggestion && scanResult.kitSuggestion !== scanResult.productName && (
                  <p className="text-xs text-neutral-600 dark:text-neutral-400">
                    Sugestão de Kit: <strong className="text-neutral-900 dark:text-neutral-200">{scanResult.kitSuggestion}</strong>
                  </p>
                )}
              </div>

              {extractedKeywords.length > 0 && (
                <div className="pt-2 border-t border-neutral-200/70 dark:border-neutral-800">
                  <span className="text-[10px] font-medium text-neutral-400 uppercase tracking-wider block mb-1.5">
                    Palavras-Chave Buscadas na Base ({extractedKeywords.length})
                  </span>
                  <div className="flex flex-wrap gap-1">
                    {extractedKeywords.map((kw, idx) => {
                      const isInBestMatch = bestMatch?.matchedKeywords.includes(kw);
                      return (
                        <span
                          key={idx}
                          className={`text-[11px] font-mono px-2 py-0.5 rounded border ${
                            isInBestMatch
                              ? 'bg-neutral-900 text-white border-neutral-900 dark:bg-white dark:text-neutral-950 dark:border-white font-semibold'
                              : 'bg-white dark:bg-neutral-900 text-neutral-600 dark:text-neutral-400 border-neutral-200 dark:border-neutral-800'
                          }`}
                        >
                          {kw}
                        </span>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>

            {/* 2. O ANÚNCIO PERFEITO (BASEADO NA IMAGEM + COLUNA G MLB DA DESTINAÇÃO) */}
            {perfectAd && (
              <div className="border border-neutral-900 dark:border-neutral-200 rounded-lg overflow-hidden bg-white dark:bg-neutral-900">
                <div className="px-4 py-2.5 bg-neutral-900 text-white dark:bg-white dark:text-neutral-950 flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-xs font-semibold uppercase tracking-wider">
                      Anúncio Perfeito Encontrado
                    </span>
                    {perfectAd.fromColumnG && (
                      <span className="text-[10px] font-mono uppercase px-2 py-0.5 rounded bg-white/15 dark:bg-neutral-900/15">
                        Coluna G (MLB) · Destinação
                      </span>
                    )}
                    {perfectAd.isKit && (
                      <span className="text-[10px] font-mono uppercase px-2 py-0.5 rounded bg-white/15 dark:bg-neutral-900/15">
                        Kit / Conjunto
                      </span>
                    )}
                  </div>

                  {perfectAd.price && (
                    <span className="text-xs font-mono font-semibold tabular-nums">
                      {perfectAd.price}
                    </span>
                  )}
                </div>

                <div className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div className="space-y-1.5 min-w-0 flex-1">
                    <div className="flex items-center gap-2.5 flex-wrap">
                      <span className="text-lg font-mono font-bold text-neutral-900 dark:text-white tabular-nums">
                        {perfectAd.mlbId}
                      </span>

                      {perfectAd.destiId && (
                        <span className="text-sm font-mono font-semibold px-2 py-0.5 rounded bg-neutral-100 dark:bg-neutral-800 text-neutral-900 dark:text-neutral-100 tabular-nums">
                          ID: {perfectAd.destiId}
                        </span>
                      )}

                      {perfectAd.allColumnGMlbs.length > 1 && (
                        <span className="text-xs font-mono text-neutral-500">
                          Coluna G: {perfectAd.allColumnGMlbs.join(', ')}
                        </span>
                      )}
                    </div>

                    <p className="text-xs text-neutral-800 dark:text-neutral-200 leading-snug">
                      {highlightText(perfectAd.title, perfectAd.matchedKeywords)}
                    </p>
                  </div>

                  <div className="flex flex-wrap items-center gap-2 shrink-0">
                    <button
                      type="button"
                      onClick={() => copyText(perfectAd.mlbId, 'perfect-mlb')}
                      className="px-3.5 py-2 text-xs font-medium rounded-md bg-neutral-900 text-white dark:bg-white dark:text-neutral-950 hover:opacity-90 flex items-center gap-1.5 cursor-pointer"
                    >
                      {copiedKey === 'perfect-mlb' ? (
                        <Check className="w-3.5 h-3.5 text-emerald-400" />
                      ) : (
                        <Copy className="w-3.5 h-3.5" />
                      )}
                      <span>{copiedKey === 'perfect-mlb' ? 'MLB Copiado' : 'Copiar MLB'}</span>
                    </button>

                    {perfectAd.destiId && (
                      <button
                        type="button"
                        onClick={() => copyText(perfectAd.destiId, 'perfect-id')}
                        className="px-3 py-2 text-xs font-medium rounded-md border border-neutral-300 dark:border-neutral-700 text-neutral-900 dark:text-white hover:border-neutral-900 flex items-center gap-1.5 cursor-pointer"
                      >
                        {copiedKey === 'perfect-id' ? (
                          <Check className="w-3.5 h-3.5 text-emerald-600" />
                        ) : (
                          <Copy className="w-3.5 h-3.5" />
                        )}
                        <span>{copiedKey === 'perfect-id' ? 'ID Copiado' : 'Copiar ID'}</span>
                      </button>
                    )}

                    <a
                      href={perfectAd.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="px-3 py-2 text-xs font-medium rounded-md border border-neutral-200 dark:border-neutral-800 text-neutral-800 dark:text-neutral-200 hover:border-neutral-900 flex items-center gap-1.5"
                    >
                      <span>Abrir Anúncio Perfeito</span>
                      <ExternalLink className="w-3.5 h-3.5" />
                    </a>
                  </div>
                </div>

                {/* OTHER RELATED MATCHES IN DESTINACAO (PAGINATED) */}
                {otherMatches.length > 0 && (
                  <div className="border-t border-neutral-200 dark:border-neutral-800 bg-neutral-50/60 dark:bg-neutral-950/60 p-4 space-y-2.5">
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] font-medium text-neutral-500 uppercase tracking-wider">
                        Outros registros compatíveis no CSV ({otherMatches.length})
                      </span>

                      {totalPages > 1 && (
                        <div className="flex items-center gap-1.5 text-[11px] text-neutral-500">
                          <span className="font-mono tabular-nums">
                            Pág. {safePage}/{totalPages}
                          </span>
                          <button
                            type="button"
                            disabled={safePage <= 1}
                            onClick={() => setMatchPage((p) => Math.max(1, p - 1))}
                            className="p-1 rounded border border-neutral-200 dark:border-neutral-800 disabled:opacity-40 cursor-pointer"
                          >
                            <ChevronLeft className="w-3 h-3" />
                          </button>
                          <button
                            type="button"
                            disabled={safePage >= totalPages}
                            onClick={() => setMatchPage((p) => Math.min(totalPages, p + 1))}
                            className="p-1 rounded border border-neutral-200 dark:border-neutral-800 disabled:opacity-40 cursor-pointer"
                          >
                            <ChevronRight className="w-3 h-3" />
                          </button>
                        </div>
                      )}
                    </div>

                    <div className="divide-y divide-neutral-200/70 dark:divide-neutral-800">
                      {paginatedOtherMatches.map(({ item, primaryMlb, matchedKeywords, isKitItem }) => (
                        <div
                          key={item.id}
                          className="py-2 first:pt-0 last:pb-0 flex items-center justify-between gap-3"
                        >
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="text-xs font-mono font-semibold text-neutral-900 dark:text-neutral-200 tabular-nums">
                                ID: {item.id}
                              </span>
                              {primaryMlb && (
                                <span className="text-xs font-mono text-neutral-600 dark:text-neutral-300 tabular-nums">
                                  · Col. G: {primaryMlb}
                                </span>
                              )}
                              {isKitItem && (
                                <span className="text-[10px] font-mono px-1.5 py-0.2 rounded border border-neutral-300 dark:border-neutral-700 text-neutral-500">
                                  Kit
                                </span>
                              )}
                              {item.valorReal && (
                                <span className="text-[11px] font-mono text-neutral-500 tabular-nums">
                                  R$ {item.valorReal}
                                </span>
                              )}
                            </div>
                            <p className="text-xs text-neutral-600 dark:text-neutral-400 truncate">
                              {highlightText(item.itens, matchedKeywords)}
                            </p>
                          </div>

                          <div className="flex items-center gap-1.5 shrink-0">
                            {primaryMlb && (
                              <button
                                type="button"
                                onClick={() => copyText(primaryMlb, `other-mlb-${item.id}`)}
                                className="px-2 py-1 text-[11px] font-mono rounded border border-neutral-200 dark:border-neutral-800 text-neutral-700 dark:text-neutral-300 hover:border-neutral-900 flex items-center gap-1 cursor-pointer"
                              >
                                {copiedKey === `other-mlb-${item.id}` ? (
                                  <Check className="w-3 h-3 text-emerald-600" />
                                ) : (
                                  <Copy className="w-3 h-3" />
                                )}
                                <span>MLB</span>
                              </button>
                            )}
                            <button
                              type="button"
                              onClick={() => copyText(item.id, `other-id-${item.id}`)}
                              className="px-2.5 py-1 text-[11px] font-medium rounded border border-neutral-200 dark:border-neutral-800 text-neutral-800 dark:text-neutral-200 hover:border-neutral-900 flex items-center gap-1 cursor-pointer"
                            >
                              {copiedKey === `other-id-${item.id}` ? (
                                <Check className="w-3 h-3 text-emerald-600" />
                              ) : (
                                <Copy className="w-3 h-3" />
                              )}
                              <span>ID</span>
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* 3. TODOS OS MLBS ENCONTRADOS PARA O PRODUTO (COLUNA G + MERCADO LIVRE) */}
            {allProductMlbAds.length > 0 && (
              <div className="border border-neutral-200 dark:border-neutral-800 rounded-lg overflow-hidden bg-white dark:bg-neutral-900">
                <div className="px-4 py-3 bg-neutral-50 dark:bg-neutral-950 border-b border-neutral-200 dark:border-neutral-800 flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <span className="text-xs font-semibold text-neutral-900 dark:text-white uppercase tracking-wider block">
                      Todos os MLBs do Produto ({allProductMlbAds.length})
                    </span>
                    <span className="text-[11px] text-neutral-500">
                      Códigos MLB da Coluna G (Destinação) e anúncios correspondentes no Mercado Livre
                    </span>
                  </div>

                  <button
                    type="button"
                    onClick={() => {
                      const allCodes = allProductMlbAds.map((a) => a.mlbId).join('\n');
                      copyText(allCodes, 'copy-all-mlbs');
                    }}
                    className="px-2.5 py-1.5 text-xs font-medium rounded border border-neutral-200 dark:border-neutral-800 text-neutral-700 dark:text-neutral-300 hover:border-neutral-900 flex items-center gap-1.5 cursor-pointer"
                  >
                    {copiedKey === 'copy-all-mlbs' ? (
                      <Check className="w-3.5 h-3.5 text-emerald-600" />
                    ) : (
                      <Copy className="w-3.5 h-3.5" />
                    )}
                    <span>Copiar Todos os MLBs</span>
                  </button>
                </div>

                <div className="divide-y divide-neutral-200 dark:divide-neutral-800">
                  {allProductMlbAds.map((item, idx) => (
                    <div
                      key={`${item.mlbId}-${idx}`}
                      className={`p-3.5 hover:bg-neutral-50 dark:hover:bg-neutral-800/40 transition-colors flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${
                        item.source === 'coluna_g' ? 'bg-neutral-50/50 dark:bg-neutral-950/40' : ''
                      }`}
                    >
                      <div className="space-y-0.5 min-w-0 flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-xs font-mono font-bold text-neutral-900 dark:text-neutral-100 tabular-nums">
                            {item.mlbId}
                          </span>
                          {item.source === 'coluna_g' && (
                            <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-neutral-900 text-white dark:bg-white dark:text-neutral-950 font-semibold">
                              Coluna G · CSV
                            </span>
                          )}
                          {item.destiId && (
                            <span className="text-[11px] font-mono text-neutral-500 tabular-nums">
                              ID: {item.destiId}
                            </span>
                          )}
                          <span className="text-xs font-mono text-neutral-500 tabular-nums">
                            {item.price}
                          </span>
                        </div>
                        <p className="text-xs text-neutral-700 dark:text-neutral-300 truncate">
                          {item.title}
                        </p>
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        <button
                          type="button"
                          onClick={() => copyText(item.mlbId, `mlb-${idx}`)}
                          className="px-2.5 py-1 text-xs font-mono rounded border border-neutral-200 dark:border-neutral-800 text-neutral-600 dark:text-neutral-300 hover:border-neutral-900 flex items-center gap-1 cursor-pointer"
                        >
                          {copiedKey === `mlb-${idx}` ? <Check className="w-3 h-3 text-emerald-600" /> : <Copy className="w-3 h-3" />}
                          <span>MLB</span>
                        </button>

                        <a
                          href={item.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="px-2.5 py-1 text-xs font-medium rounded bg-neutral-900 text-white dark:bg-white dark:text-neutral-950 hover:opacity-90 flex items-center gap-1"
                        >
                          <span>Abrir</span>
                          <ExternalLink className="w-3 h-3" />
                        </a>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
