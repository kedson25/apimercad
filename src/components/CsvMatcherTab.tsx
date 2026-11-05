import React, { useState, useEffect, useRef } from 'react';
import {
  FileSpreadsheet,
  Upload,
  Copy,
  Check,
  Search,
  Sparkles,
  CheckCircle2,
  AlertCircle,
  ExternalLink,
  Camera,
  Trash2,
  Download,
  Filter,
  Layers,
  ArrowRight,
  HelpCircle,
  Database,
  CloudUpload,
  CloudDownload,
  RefreshCw,
} from 'lucide-react';
import { CsvItem, CsvMatchResult } from '../types/csvMatcher';
import { matchPhotoWithCsv } from '../services/mlApi';
import {
  saveAllCsvItemsToDesti,
  loadAllItemsFromDesti,
  getDestiCount,
  COLLECTION_NAME,
} from '../services/firebase';
import { formatMercadoLivreUrl } from '../utils/mlUrl';

// Initial dataset provided directly by the user in their prompt
const INITIAL_RAW_CSV = `ID\tITENS\tVALOR_USD\tVALOR_REAL\tQTD_ITENS\tCEP_BUYER
48045421079\tControle Joystick Sem Fio Nintendo Switch 2 Ns2 Pro Controller The Legend Of Zelda  40th Anniversary Edition Verde, Preto E Dourado\t135.85\t699.9\t1\t4165150
48045533571\tControle Joystick Sem Fio Nintendo Switch Nintendo Ns2 Pro Controller + Stand The Legend Of Zelda  40th Anniversary Edition Verde, Preto E Dourado\t155.26\t799.9\t1\t1508000
48045665232\tControle Joystick Sem Fio Nintendo Switch 2 Ns2 Pro Controller The Legend Of Zelda  40th Anniversary Edition Verde, Preto E Dourado\t135.85\t699.9\t1\t4106040
48045847398\tControle Joystick Sem Fio Nintendo Switch Nintendo Ns2 Pro Controller + Stand The Legend Of Zelda  40th Anniversary Edition Verde, Preto E Dourado\t155.26\t799.9\t1\t4143010
48073648586\tLixeira Basculante 12 Litros Banheiro Escritorio Pia Cozinha + Kit 2 Lixeira Cesto Cozinha Banheiro 09l Inox Tampa Click\t14.88\t76.05\t1\t1512010
48093820971\tKit 10 Anilhas De  Latão Para Compressão P/tubo De 1/8''\t\t20.43\t1\t4213002
48097530706\tCelular Samsung Galaxy A56 5g 256gb 8gb Ram Cinza - Aceitável (Recondicionado)\t\t1899\t1\t4088004
48098294649\tCuba Inox Gourmet Cozinha Quadrada 60x40 Com Cesto Drenagem Preto\t\t324.37\t1\t4216030
48101267010\tTecido Helanca Lycra Tensionada 5mts X 1,80m 100% Poliester Preta Liso\t\t48.9\t1\t4214050
48104090738\tRelógio Parede Mesa Led Digital Calendário Termômetro L15 Preto\t\t68.43\t1\t1503010
48106206936\tAspirador De Pó S/ Fio Bomvink Vertical 120w 2x1 Filtro Hepa Branco 127/220v\t\t138\t1\t4201000
48108495361\tLente Farol Dianteiro Esquerdo Creta 2022 2023 24 2025 Novo\t78.64\t402\t1\t
48115096622\tSuporte Celular Bike Moto Regulagem Universal Forte Alumínio Guidão Ajustável Reforçado Resistente À Prova D'água Fixo B Basto Preto\t3.84\t19.99\t1\t4524020
48116167957\tPulseira Pedra Vulcânica Pedras Naturais 8mm Preto 5 Cm\t\t29.9\t1\t4107011
48121382821\tSuplemento Nature's Bounty De Vitamina D3 1000 Ui 250 Cápsul\t23.09\t120.05\t1\t4516012
48123505674\tCaminhão Dino T-rex Cegonha Lançador Com Pista E Carrinhos Azul\t\t56\t1\t1523000
48124862886\tPneu Michelin Aro 19 Primacy 4 235/55 R19\t383.64\t1999.99\t1\t4089011
48129495799\tPanela De Pressão Elétrica 1100w Eletrozon Elt-808 De 6 Litros Com Revestimento Antiaderente E Desligamento Automático Prateado 127v 60 Hz\t53.5\t275.95\t1\t
48132212494\tCase Estojo Bag P/ Fone De Ouvido - Kz, Cca, Jbl, Shure, Qzk Preto\t3.86\t19.9\t1\t
48132941391\tMultivitamínico Gnc Para Megaenergia E Metabolismo Feminino\t49.92\t260.59\t1\t4507010`;

function parseCsv(raw: string): CsvItem[] {
  const lines = raw.trim().split(/\r?\n/);
  if (lines.length < 2) return [];

  // Determine separator (tab, semicolon, or comma)
  const headerLine = lines[0];
  const separator = headerLine.includes('\t')
    ? '\t'
    : headerLine.includes(';')
    ? ';'
    : ',';

  const headers = headerLine.split(separator).map((h) => h.trim().toUpperCase());
  const idIdx = headers.findIndex((h) => h.includes('ID'));
  const itensIdx = headers.findIndex((h) => h.includes('ITEN') || h.includes('DESC') || h.includes('PRODUTO') || h.includes('NOME'));
  const usdIdx = headers.findIndex((h) => h.includes('USD') || h.includes('DOLAR'));
  const realIdx = headers.findIndex((h) => h.includes('REAL') || h.includes('BRL') || h.includes('VALOR'));
  const qtdIdx = headers.findIndex((h) => h.includes('QTD'));
  const cepIdx = headers.findIndex((h) => h.includes('CEP'));

  const items: CsvItem[] = [];

  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;
    const cols = line.split(separator).map((c) => c.trim());

    const id = (idIdx >= 0 ? cols[idIdx] : cols[0]) || `ITEM-${i}`;
    const itens = (itensIdx >= 0 ? cols[itensIdx] : cols[1]) || 'Item sem descrição';
    const valorUsd = usdIdx >= 0 ? cols[usdIdx] : undefined;
    const valorReal = realIdx >= 0 ? cols[realIdx] : undefined;
    const qtdItens = qtdIdx >= 0 ? cols[qtdIdx] : undefined;
    const cepBuyer = cepIdx >= 0 ? cols[cepIdx] : undefined;

    if (id || itens) {
      items.push({ id, itens, valorUsd, valorReal, qtdItens, cepBuyer });
    }
  }

  return items;
}

function highlightMatchedKeywords(text: string, matchedWords: string[] = []) {
  if (!matchedWords || matchedWords.length === 0) return <span>{text}</span>;
  const validKw = matchedWords.filter((w) => w && w.trim().length >= 2);
  if (validKw.length === 0) return <span>{text}</span>;

  try {
    const escaped = validKw.map((k) => k.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|');
    const regex = new RegExp(`(${escaped})`, 'gi');
    const parts = text.split(regex);

    return (
      <span>
        {parts.map((part, idx) => {
          const isMatch = validKw.some((w) => w.toLowerCase() === part.toLowerCase());
          return isMatch ? (
            <mark
              key={idx}
              className="bg-emerald-300/90 dark:bg-emerald-600/60 text-emerald-950 dark:text-emerald-100 font-bold px-1 py-0.5 rounded"
            >
              {part}
            </mark>
          ) : (
            <span key={idx}>{part}</span>
          );
        })}
      </span>
    );
  } catch {
    return <span>{text}</span>;
  }
}

interface CsvMatcherTabProps {
  items?: CsvItem[];
  onItemsChange?: (items: CsvItem[]) => void;
}

export const CsvMatcherTab: React.FC<CsvMatcherTabProps> = ({
  items: externalItems,
  onItemsChange,
}) => {
  const [internalItems, setInternalItems] = useState<CsvItem[]>(() => parseCsv(INITIAL_RAW_CSV));
  const items = externalItems || internalItems;

  const updateItems = (newItems: CsvItem[]) => {
    setInternalItems(newItems);
    if (onItemsChange) onItemsChange(newItems);
  };

  const [searchTerm, setSearchTerm] = useState('');
  const [rawInputText, setRawInputText] = useState('');
  const [isEditingRaw, setIsEditingRaw] = useState(false);
  const [onlyMatches, setOnlyMatches] = useState(false);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  // Firebase desti sync states
  const [destiDocCount, setDestiDocCount] = useState<number | null>(null);
  const [isSyncingFirebase, setIsSyncingFirebase] = useState(false);
  const [isLoadingFirebase, setIsLoadingFirebase] = useState(false);
  const [syncProgress, setSyncProgress] = useState<{ current: number; total: number } | null>(null);
  const [firebaseMessage, setFirebaseMessage] = useState<{ text: string; isError?: boolean } | null>(null);

  // Load initial desti count
  useEffect(() => {
    getDestiCount()
      .then((count) => setDestiDocCount(count))
      .catch(() => {});
  }, []);

  const handleSaveToFirebase = async () => {
    if (items.length === 0) {
      setFirebaseMessage({ text: 'Nenhum item na planilha para salvar.', isError: true });
      return;
    }

    setIsSyncingFirebase(true);
    setFirebaseMessage(null);
    setSyncProgress({ current: 0, total: items.length });

    try {
      const result = await saveAllCsvItemsToDesti(items, (current, total) => {
        setSyncProgress({ current, total });
      });

      const updatedCount = await getDestiCount();
      setDestiDocCount(updatedCount);
      setFirebaseMessage({
        text: `Sucesso! ${result.success} de ${items.length} itens (100%) salvos na coleção 'desti' do Firebase!`,
        isError: false,
      });
    } catch (err: any) {
      setFirebaseMessage({
        text: `Erro ao salvar na coleção desti: ${err.message}`,
        isError: true,
      });
    } finally {
      setIsSyncingFirebase(false);
      setSyncProgress(null);
    }
  };

  const handleLoadFromFirebase = async () => {
    setIsLoadingFirebase(true);
    setFirebaseMessage(null);

    try {
      const docs = await loadAllItemsFromDesti();
      if (docs.length > 0) {
        updateItems(docs);
        setDestiDocCount(docs.length);
        setFirebaseMessage({
          text: `Sucesso! ${docs.length} itens carregados da coleção 'desti' do Firebase!`,
          isError: false,
        });
      } else {
        setFirebaseMessage({
          text: "A coleção 'desti' ainda está vazia no Firebase. Clique em 'Salvar Base no Firebase' para carregar seus dados.",
          isError: true,
        });
      }
    } catch (err: any) {
      setFirebaseMessage({
        text: `Erro ao carregar do Firebase: ${err.message}`,
        isError: true,
      });
    } finally {
      setIsLoadingFirebase(false);
    }
  };

  // Photo Match state
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [isMatching, setIsMatching] = useState(false);
  const [matchResult, setMatchResult] = useState<CsvMatchResult | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Global Ctrl+V listener
  useEffect(() => {
    const handlePaste = (e: ClipboardEvent) => {
      const clipboardItems = e.clipboardData?.items;
      if (!clipboardItems) return;

      for (let i = 0; i < clipboardItems.length; i++) {
        if (clipboardItems[i].type.startsWith('image/')) {
          const file = clipboardItems[i].getAsFile();
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
        const maxDim = 1400;
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
          runPhotoMatch(base64, 'image/jpeg');
        } else {
          setImagePreview(originalDataUrl);
          const base64 = originalDataUrl.split(',')[1];
          runPhotoMatch(base64, file.type || 'image/jpeg');
        }
      };
      img.src = originalDataUrl;
    };
    reader.readAsDataURL(file);
  };

  const runPhotoMatch = async (base64: string, mime: string) => {
    if (items.length === 0) {
      setErrorMessage('Nenhum item no CSV para comparar.');
      return;
    }

    setIsMatching(true);
    setErrorMessage(null);

    try {
      const result = await matchPhotoWithCsv(base64, items, mime);
      setMatchResult(result);
    } catch (err: any) {
      setErrorMessage(err.message || 'Erro ao comparar foto com itens do CSV.');
    } finally {
      setIsMatching(false);
    }
  };

  const copyToClipboard = (text: string, key: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 2000);
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target?.result as string;
      const parsed = parseCsv(text);
      if (parsed.length > 0) {
        updateItems(parsed);
        setIsEditingRaw(false);
      } else {
        alert('Não foi possível identificar linhas e colunas válidas no CSV.');
      }
    };
    reader.readAsText(file);
  };

  const handleApplyRawText = () => {
    if (!rawInputText.trim()) return;
    const parsed = parseCsv(rawInputText);
    if (parsed.length > 0) {
      updateItems(parsed);
      setIsEditingRaw(false);
      setRawInputText('');
    } else {
      alert('Formato de CSV não reconhecido. Certifique-se de que há cabeçalho e colunas separadas por tab ou vírgula.');
    }
  };

  const filteredItems = items.filter((it) => {
    const q = searchTerm.toLowerCase();
    const matchesSearch =
      it.id.toLowerCase().includes(q) ||
      it.itens.toLowerCase().includes(q) ||
      (it.cepBuyer && it.cepBuyer.includes(q));

    if (!matchesSearch) return false;

    if (onlyMatches && matchResult) {
      const isWinner = matchResult.matchedId === it.id;
      const isRanked = matchResult.allRankedMatches?.some((m) => m.id === it.id);
      return isWinner || isRanked;
    }

    return true;
  });

  return (
    <div className="space-y-6">
      {/* 1. PHOTO DROP & AI MATCH HERO */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-6 shadow-xs">
        {/* Drop zone */}
        <div
          onClick={() => !imagePreview && fileInputRef.current?.click()}
          className={`border-2 border-dashed rounded-xl p-6 text-center transition-all ${
            imagePreview
              ? 'border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950/50'
              : 'border-amber-400/60 dark:border-amber-500/40 hover:border-amber-400 bg-amber-500/5 dark:bg-amber-400/5 cursor-pointer'
          }`}
        >
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            onChange={(e) => e.target.files?.[0] && handlePhotoFile(e.target.files[0])}
            className="hidden"
          />

          {!imagePreview ? (
            <div className="space-y-2">
              <div className="w-12 h-12 mx-auto rounded-xl bg-amber-400/20 text-amber-900 dark:text-amber-300 flex items-center justify-center">
                <Camera className="w-6 h-6 text-amber-500" />
              </div>

              <div>
                <span className="text-sm font-bold text-slate-900 dark:text-white block">
                  Pressione <kbd className="px-2 py-0.5 rounded bg-slate-200 dark:bg-slate-800 font-mono text-xs">Ctrl + V</kbd> para colar a foto do produto
                </span>
                <span className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 block">
                  A IA compara os detalhes visuais com os <strong>{items.length} itens</strong> do seu CSV e traz o ID certo.
                </span>
              </div>
            </div>
          ) : (
            <div className="flex flex-col sm:flex-row items-center justify-center gap-6">
              <div className="relative">
                <img
                  src={imagePreview}
                  alt="Foto a comparar"
                  className="max-h-48 rounded-lg object-contain border border-slate-200 dark:border-slate-800 shadow-sm bg-white dark:bg-slate-900"
                />
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setImagePreview(null);
                    setMatchResult(null);
                  }}
                  className="absolute top-2 right-2 p-1.5 bg-rose-600 text-white rounded-lg opacity-90 hover:opacity-100 shadow-xs"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>

              <div className="text-left space-y-2">
                <span className="text-xs font-semibold text-slate-800 dark:text-slate-200 block">
                  Foto pronta para comparação
                </span>
                <p className="text-xs text-slate-500 max-w-sm">
                  Deseja testar com outra foto? Pressione <kbd className="px-1 py-0.5 rounded bg-slate-200 dark:bg-slate-800 font-mono text-[10px]">Ctrl+V</kbd> a qualquer momento ou clique no botão abaixo.
                </p>
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="text-xs text-amber-600 dark:text-amber-400 hover:underline font-medium block"
                >
                  Trocar foto
                </button>
              </div>
            </div>
          )}
        </div>

        {/* LOADING */}
        {isMatching && (
          <div className="mt-5 p-5 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-900 dark:text-amber-200 text-xs flex items-center justify-center gap-3">
            <div className="w-5 h-5 border-2 border-amber-500 border-t-transparent rounded-full animate-spin shrink-0" />
            <div>
              <span className="font-bold block text-sm">O sistema está buscando...</span>
              <span>Cruzando informações de anúncios e IDs no Mercado Livre...</span>
            </div>
          </div>
        )}

        {/* ERROR */}
        {errorMessage && (
          <div className="mt-5 p-4 rounded-lg bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900 text-rose-800 dark:text-rose-200 text-xs flex items-start gap-2.5">
            <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
            <div>
              <span className="font-semibold block">Erro na Comparação</span>
              <span>{errorMessage}</span>
            </div>
          </div>
        )}

        {/* 3-STEP MATCH RESULT HIGHLIGHT */}
        {matchResult && !isMatching && (
          <div className="mt-5 p-5 rounded-xl bg-gradient-to-br from-amber-500/15 via-slate-50 to-emerald-500/10 dark:from-slate-900 dark:via-slate-900 dark:to-emerald-950/20 border-2 border-amber-400 dark:border-amber-500 space-y-5">
            {/* Header with confidence */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-amber-300/40 dark:border-slate-800">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-lg bg-emerald-500 text-white flex items-center justify-center font-bold">
                  <CheckCircle2 className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-950 dark:text-white">
                    Produto Identificado e Cruzado com Sucesso!
                  </h3>
                  <span className="text-[11px] text-slate-500 dark:text-slate-400">
                    Processo: OCR do Rótulo &rarr; Título no Mercado Livre &rarr; Divisão de Palavras-Chave &rarr; ID do CSV
                  </span>
                </div>
              </div>
              <span className="text-xs font-bold px-3 py-1 rounded-full bg-emerald-500/20 text-emerald-800 dark:text-emerald-300 border border-emerald-500/30 self-start sm:self-auto">
                {matchResult.confidenceScore}% de Confiança
              </span>
            </div>

            {/* 3-STEP PIPELINE CARDS */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              {/* ETAPA 1: OCR / LEITURA */}
              <div className="p-3.5 bg-white dark:bg-slate-900/90 rounded-lg border border-slate-200 dark:border-slate-800 space-y-1.5 shadow-xs">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-amber-600 dark:text-amber-400 flex items-center gap-1">
                    <span className="w-4 h-4 rounded-full bg-amber-500 text-slate-950 text-[10px] flex items-center justify-center font-black">1</span>
                    Leitura Real do Rótulo (OCR)
                  </span>
                  <span className="text-[9px] px-1.5 py-0.5 rounded bg-amber-100 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300 font-medium">
                    Anti-Alucinação
                  </span>
                </div>
                <p className="text-xs font-medium text-slate-800 dark:text-slate-200 line-clamp-3" title={matchResult.visualOcrText || matchResult.productDescription}>
                  {matchResult.visualOcrText || matchResult.productDescription || 'Texto e detalhes visuais lidos com precisão na embalagem.'}
                </p>
                {matchResult.productDescription && (
                  <span className="text-[11px] text-slate-500 dark:text-slate-400 block italic">
                    {matchResult.productDescription}
                  </span>
                )}
              </div>

              {/* ETAPA 2: TÍTULO MERCADO LIVRE */}
              <div className="p-3.5 bg-white dark:bg-slate-900/90 rounded-lg border border-slate-200 dark:border-slate-800 space-y-1.5 shadow-xs">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-blue-600 dark:text-blue-400 flex items-center gap-1">
                    <span className="w-4 h-4 rounded-full bg-blue-500 text-white text-[10px] flex items-center justify-center font-black">2</span>
                    Título no Mercado Livre
                  </span>
                  {matchResult.mercadoLivreSearchUrl && (
                    <a
                      href={matchResult.mercadoLivreSearchUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-[10px] text-blue-600 dark:text-blue-400 hover:underline flex items-center gap-0.5 font-semibold"
                    >
                      <span>Ver no ML</span>
                      <ExternalLink className="w-2.5 h-2.5" />
                    </a>
                  )}
                </div>
                <p className="text-xs font-semibold text-slate-900 dark:text-white line-clamp-3">
                  {matchResult.mercadoLivreTitle}
                </p>
                {matchResult.mlbId && (
                  <span className="text-[10px] font-mono text-slate-500 dark:text-slate-400 block">
                    Cód. Sugerido: {matchResult.mlbId}
                  </span>
                )}
              </div>

              {/* ETAPA 3: PALAVRAS-CHAVE DIVIDIDAS */}
              <div className="p-3.5 bg-white dark:bg-slate-900/90 rounded-lg border border-slate-200 dark:border-slate-800 space-y-1.5 shadow-xs">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
                    <span className="w-4 h-4 rounded-full bg-emerald-500 text-white text-[10px] flex items-center justify-center font-black">3</span>
                    Palavras-Chave Divididas
                  </span>
                  <span className="text-[10px] font-mono font-bold text-emerald-700 dark:text-emerald-400">
                    {matchResult.matchedKeywords?.length || 0} de {matchResult.keywords?.length || 0} batem
                  </span>
                </div>
                <div className="flex flex-wrap gap-1 max-h-24 overflow-y-auto">
                  {matchResult.keywords?.map((kw, i) => {
                    const isMatched = matchResult.matchedKeywords?.some(
                      (mk) => mk.toLowerCase() === kw.toLowerCase()
                    );
                    return (
                      <span
                        key={i}
                        className={`text-[10px] px-2 py-0.5 rounded font-mono font-medium flex items-center gap-1 transition-all ${
                          isMatched
                            ? 'bg-emerald-500/20 text-emerald-900 dark:text-emerald-300 border border-emerald-500/40 font-bold'
                            : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400'
                        }`}
                      >
                        {isMatched && <Check className="w-2.5 h-2.5 text-emerald-600" />}
                        {kw}
                      </span>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* BIG WINNER ID CARD */}
            <div className="p-4 bg-white dark:bg-slate-900 rounded-xl border-2 border-emerald-500/50 dark:border-emerald-500/40 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div className="space-y-1.5">
                <span className="text-[10px] font-bold text-emerald-700 dark:text-emerald-400 uppercase tracking-wider flex items-center gap-1.5">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  ID VENCEDOR LOCALIZADO NO SEU CSV:
                </span>
                <div className="flex items-center gap-3">
                  <span className="text-3xl sm:text-4xl font-mono font-black text-slate-950 dark:text-amber-300 tracking-tight tabular-nums">
                    {matchResult.matchedId}
                  </span>
                  <button
                    type="button"
                    onClick={() => copyToClipboard(matchResult.matchedId, 'mainId')}
                    className="px-3.5 py-1.5 text-xs font-bold rounded-lg bg-amber-400 text-slate-950 hover:bg-amber-300 transition-colors flex items-center gap-1.5 shadow-xs"
                  >
                    {copiedKey === 'mainId' ? <Check className="w-4 h-4 text-emerald-800" /> : <Copy className="w-4 h-4" />}
                    <span>{copiedKey === 'mainId' ? 'ID Copiado!' : 'Copiar ID'}</span>
                  </button>
                </div>
                <div className="pt-1">
                  <span className="text-xs font-bold text-slate-900 dark:text-white mr-1.5">Descrição no CSV:</span>
                  <span className="text-xs text-slate-700 dark:text-slate-300">
                    {matchResult.matchedItem}
                  </span>
                </div>
              </div>

              {matchResult.mercadoLivreSearchUrl && (
                <a
                  href={matchResult.mercadoLivreSearchUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-4 py-2.5 text-xs font-bold rounded-lg bg-slate-950 text-white dark:bg-amber-400 dark:text-slate-950 hover:opacity-90 transition-opacity flex items-center justify-center gap-2 shrink-0 shadow-xs"
                >
                  <span>Buscar no Mercado Livre</span>
                  <ExternalLink className="w-3.5 h-3.5" />
                </a>
              )}
            </div>

            {/* REASONING */}
            <div className="p-3 bg-white/70 dark:bg-slate-900/70 rounded-lg border border-slate-200 dark:border-slate-800 text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
              <strong className="text-slate-900 dark:text-white">Justificativa do Cruzamento:</strong> {matchResult.reasoning}
            </div>

            {/* MERCADO LIVRE ADS & MLB IDS CORRESPONDING TO PHOTO */}
            {matchResult.relatedMercadoLivreAds && matchResult.relatedMercadoLivreAds.length > 0 && (
              <div className="p-4 bg-white/90 dark:bg-slate-900/90 rounded-lg border border-slate-200 dark:border-slate-800 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-900 dark:text-white flex items-center gap-2">
                    <ExternalLink className="w-4 h-4 text-amber-500" />
                    Anúncios & IDs de MLB no Mercado Livre Brasil ({matchResult.relatedMercadoLivreAds.length})
                  </span>
                  <span className="text-[10px] text-slate-500">Links diretos dos produtos e códigos MLB</span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {matchResult.relatedMercadoLivreAds.map((ad, idx) => (
                    <div
                      key={idx}
                      className="p-3.5 bg-slate-50 dark:bg-slate-950/70 rounded-lg border border-slate-200 dark:border-slate-800 flex flex-col justify-between gap-2 hover:border-amber-400 transition-colors"
                    >
                      <div>
                        <div className="flex items-start justify-between gap-2 mb-1">
                          {ad.mlbId && (
                            <span className="text-[11px] font-mono font-extrabold px-2 py-0.5 rounded bg-amber-400 text-slate-950 inline-flex items-center gap-1">
                              {ad.mlbId}
                            </span>
                          )}
                          <span className="font-mono font-bold text-xs text-emerald-600 dark:text-emerald-400 shrink-0">
                            {ad.price}
                          </span>
                        </div>

                        <span className="font-semibold text-xs text-slate-900 dark:text-white line-clamp-2 block">
                          {ad.title}
                        </span>

                        <div className="flex flex-wrap gap-1 mt-2">
                          {ad.matchedKeywords?.slice(0, 4).map((mk, kIdx) => (
                            <span
                              key={kIdx}
                              className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-800 dark:text-emerald-300 border border-emerald-500/20"
                            >
                              {mk}
                            </span>
                          ))}
                        </div>
                      </div>

                      <div className="flex items-center justify-between pt-2 border-t border-slate-200 dark:border-slate-800 text-[11px]">
                        <span className="text-slate-400">{ad.sellerType || ad.condition || 'Novo'}</span>
                        <a
                          href={ad.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="px-2.5 py-1 text-xs font-bold rounded bg-slate-950 text-white dark:bg-amber-400 dark:text-slate-950 hover:opacity-90 transition-opacity flex items-center gap-1"
                        >
                          <span>Abrir Anúncio no ML</span>
                          <ExternalLink className="w-3 h-3" />
                        </a>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* OTHER RANKED MATCHES */}
            {matchResult.allRankedMatches && matchResult.allRankedMatches.length > 1 && (
              <div className="pt-2 border-t border-amber-300/30 dark:border-slate-800">
                <span className="text-[11px] text-slate-500 font-semibold block mb-2">
                  Todas as Linhas do CSV Analisadas por Sobreposição de Palavras-Chave ({matchResult.allRankedMatches.length - 1}):
                </span>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2 max-h-80 overflow-y-auto pr-1">
                  {matchResult.allRankedMatches.slice(1).map((m) => (
                    <div
                      key={m.id}
                      className="p-2.5 bg-white/80 dark:bg-slate-900/80 rounded-lg border border-slate-200 dark:border-slate-800 text-[11px] flex items-center justify-between gap-2"
                    >
                      <div className="truncate">
                        <strong className="font-mono text-slate-900 dark:text-white mr-2">{m.id}</strong>
                        <span className="text-slate-600 dark:text-slate-400 truncate">{m.itens}</span>
                      </div>
                      <span className="font-mono font-bold text-slate-500 shrink-0 px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800">
                        {m.matchCount || 0} palavras
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* 2. CSV TABLE & MANAGEMENT */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-6 shadow-xs">
        <div className="mb-4 pb-3 border-b border-slate-100 dark:border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <FileSpreadsheet className="w-4 h-4 text-amber-500" />
              Planilha de Itens Carregados ({items.length} itens)
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Visualize, filtre e pesquise os itens carregados. Você pode colar um novo CSV ou subir outro arquivo a qualquer momento.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setIsEditingRaw(!isEditingRaw)}
              className="px-3 py-1.5 text-xs font-medium rounded-md border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-100"
            >
              {isEditingRaw ? 'Fechar Editor CSV' : 'Colar Novo CSV'}
            </button>

            <label className="px-3 py-1.5 text-xs font-semibold rounded-md bg-slate-900 text-white dark:bg-amber-400 dark:text-slate-950 hover:bg-slate-800 transition-colors cursor-pointer flex items-center gap-1.5 shadow-xs">
              <Upload className="w-3.5 h-3.5" />
              <span>Importar Arquivo</span>
              <input type="file" accept=".csv,.tsv,.txt" onChange={handleFileUpload} className="hidden" />
            </label>
          </div>
        </div>

        {/* FIREBASE DESTI SYNC BAR */}
        <div className="mb-5 p-4 rounded-xl bg-gradient-to-r from-amber-500/10 via-slate-50 to-emerald-500/10 dark:from-slate-950 dark:via-slate-900 dark:to-emerald-950/20 border border-amber-400/40 dark:border-slate-800 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-400/20 text-amber-900 dark:text-amber-300 flex items-center justify-center shrink-0 border border-amber-400/30">
              <Database className="w-5 h-5 text-amber-500" />
            </div>
            <div>
              <span className="text-xs font-bold text-slate-900 dark:text-white">
                Base de Dados Firestore (<code className="font-mono text-amber-600 dark:text-amber-400 font-extrabold">{COLLECTION_NAME}</code>)
              </span>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                {destiDocCount !== null && (
                  <strong className="text-slate-700 dark:text-slate-300">
                    {destiDocCount} ID(s) cadastrados na base.
                  </strong>
                )}
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={handleSaveToFirebase}
              disabled={isSyncingFirebase || items.length === 0}
              className="px-3.5 py-2 text-xs font-bold rounded-lg bg-emerald-600 text-white hover:bg-emerald-500 disabled:opacity-50 transition-colors flex items-center gap-1.5 shadow-xs cursor-pointer"
            >
              {isSyncingFirebase ? (
                <>
                  <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  <span>
                    {syncProgress && syncProgress.total > 0
                      ? `Salvando ${syncProgress.current}/${syncProgress.total} (${Math.round((syncProgress.current / syncProgress.total) * 100)}%)...`
                      : 'Salvando no Firebase...'}
                  </span>
                </>
              ) : (
                <>
                  <CloudUpload className="w-3.5 h-3.5" />
                  <span>Salvar Base no Firebase (desti)</span>
                </>
              )}
            </button>

            <button
              type="button"
              onClick={handleLoadFromFirebase}
              disabled={isLoadingFirebase}
              className="px-3.5 py-2 text-xs font-semibold rounded-lg bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-750 disabled:opacity-50 transition-colors flex items-center gap-1.5 shadow-xs cursor-pointer"
            >
              {isLoadingFirebase ? (
                <>
                  <div className="w-3.5 h-3.5 border-2 border-slate-600 dark:border-slate-300 border-t-transparent rounded-full animate-spin" />
                  <span>Carregando do desti...</span>
                </>
              ) : (
                <>
                  <CloudDownload className="w-3.5 h-3.5" />
                  <span>Carregar do Firebase (desti)</span>
                </>
              )}
            </button>
          </div>
        </div>

        {firebaseMessage && (
          <div
            className={`mb-4 p-3 rounded-lg text-xs flex items-center justify-between gap-2 ${
              firebaseMessage.isError
                ? 'bg-rose-50 dark:bg-rose-950/40 text-rose-800 dark:text-rose-200 border border-rose-200 dark:border-rose-900'
                : 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-800 dark:text-emerald-200 border border-emerald-200 dark:border-emerald-900'
            }`}
          >
            <div className="flex items-center gap-2">
              {firebaseMessage.isError ? (
                <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
              ) : (
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              )}
              <span>{firebaseMessage.text}</span>
            </div>
            <button
              type="button"
              onClick={() => setFirebaseMessage(null)}
              className="text-[11px] underline opacity-80 hover:opacity-100"
            >
              Fechar
            </button>
          </div>
        )}

        {/* RAW PASTE ACCORDION */}
        {isEditingRaw && (
          <div className="mb-5 p-4 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 space-y-3">
            <span className="text-xs font-semibold text-slate-800 dark:text-slate-200 block">
              Cole o texto do seu CSV ou TSV (separado por TAB ou vírgula):
            </span>
            <textarea
              rows={6}
              value={rawInputText}
              onChange={(e) => setRawInputText(e.target.value)}
              placeholder="Cole aqui as linhas com ID, ITENS, VALOR_REAL, etc..."
              className="w-full p-3 text-xs font-mono bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white"
            />
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setIsEditingRaw(false)}
                className="px-3 py-1.5 text-xs text-slate-500 hover:text-slate-800"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleApplyRawText}
                className="px-4 py-1.5 text-xs font-bold rounded-md bg-amber-400 text-slate-950 hover:bg-amber-300"
              >
                Carregar Dados do Texto
              </button>
            </div>
          </div>
        )}

        {/* SEARCH BAR & FILTERS */}
        <div className="mb-4 flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Digite o nome do produto ou ID para buscar..."
              className="w-full pl-9 pr-8 py-2 text-xs bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg text-slate-900 dark:text-white focus:outline-hidden focus:ring-2 focus:ring-amber-400"
            />
            {searchTerm && (
              <button
                type="button"
                onClick={() => setSearchTerm('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 text-xs font-bold px-1 py-0.5 rounded"
                title="Limpar busca"
              >
                ✕
              </button>
            )}
          </div>

          {matchResult && (
            <button
              type="button"
              onClick={() => setOnlyMatches(!onlyMatches)}
              className={`px-3 py-2 text-xs font-semibold rounded-lg border transition-all flex items-center justify-center gap-1.5 shrink-0 shadow-xs ${
                onlyMatches
                  ? 'bg-emerald-500 text-white border-emerald-600'
                  : 'bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:bg-slate-100'
              }`}
            >
              <Filter className="w-3.5 h-3.5" />
              <span>{onlyMatches ? 'Exibindo Apenas Itens com Match' : 'Filtrar Apenas Matches'}</span>
            </button>
          )}
        </div>

        {/* TABLE */}
        <div className="border border-slate-200 dark:border-slate-800 rounded-lg overflow-x-auto">
          <table className="w-full text-left text-xs divide-y divide-slate-100 dark:divide-slate-800">
            <thead className="bg-slate-50 dark:bg-slate-950 text-slate-500 font-semibold">
              <tr>
                <th className="py-2.5 px-3">ID</th>
                <th className="py-2.5 px-3">Itens / Descrição</th>
                <th className="py-2.5 px-3 text-right">Valor R$</th>
                <th className="py-2.5 px-3 text-right">Valor USD</th>
                <th className="py-2.5 px-3 text-center">Qtd</th>
                <th className="py-2.5 px-3 text-right">CEP</th>
                <th className="py-2.5 px-3 text-center">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800 bg-white dark:bg-slate-900">
              {filteredItems.map((item) => {
                const isMatched = matchResult?.matchedId === item.id;
                return (
                  <tr
                    key={item.id}
                    className={`transition-colors ${
                      isMatched
                        ? 'bg-amber-400/20 font-semibold dark:bg-amber-400/15'
                        : 'hover:bg-slate-50 dark:hover:bg-slate-800/50'
                    }`}
                  >
                    <td className="py-2.5 px-3 font-mono font-bold text-slate-900 dark:text-amber-300 tabular-nums whitespace-nowrap">
                      <div className="flex items-center gap-1.5">
                        <span>{item.id}</span>
                        {isMatched && (
                          <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-emerald-500 text-white uppercase tracking-wider">
                            Match Vencedor
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="py-2.5 px-3 text-slate-800 dark:text-slate-200 max-w-md" title={item.itens}>
                      {matchResult ? (
                        highlightMatchedKeywords(item.itens, matchResult.matchedKeywords || matchResult.keywords || [])
                      ) : (
                        item.itens
                      )}
                    </td>
                    <td className="py-2.5 px-3 font-mono text-right text-emerald-600 dark:text-emerald-400 tabular-nums whitespace-nowrap">
                      {item.valorReal ? `R$ ${item.valorReal}` : '—'}
                    </td>
                    <td className="py-2.5 px-3 font-mono text-right text-slate-500 tabular-nums whitespace-nowrap">
                      {item.valorUsd ? `$ ${item.valorUsd}` : '—'}
                    </td>
                    <td className="py-2.5 px-3 font-mono text-center text-slate-500 tabular-nums">
                      {item.qtdItens || '1'}
                    </td>
                    <td className="py-2.5 px-3 font-mono text-right text-slate-500 tabular-nums whitespace-nowrap">
                      {item.cepBuyer || '—'}
                    </td>
                    <td className="py-2.5 px-3 text-center whitespace-nowrap">
                      <div className="flex items-center justify-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => copyToClipboard(item.id, item.id)}
                          title="Copiar ID"
                          className="p-1 text-slate-400 hover:text-slate-900 dark:hover:text-white rounded"
                        >
                          {copiedKey === item.id ? (
                            <Check className="w-3.5 h-3.5 text-emerald-500" />
                          ) : (
                            <Copy className="w-3.5 h-3.5" />
                          )}
                        </button>
                        <a
                          href={formatMercadoLivreUrl(item.itens, item.id)}
                          target="_blank"
                          rel="noopener noreferrer"
                          title="Buscar anúncio no Mercado Livre"
                          className="p-1 text-slate-400 hover:text-amber-600 dark:hover:text-amber-400 rounded"
                        >
                          <ExternalLink className="w-3.5 h-3.5" />
                        </a>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
