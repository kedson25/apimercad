import React, { useState, useRef, useMemo } from 'react';
import {
  Upload,
  Plus,
  Trash2,
  Copy,
  Check,
  RefreshCw,
  Search,
  AlertCircle,
  CheckCircle2,
  Database,
  ChevronLeft,
  ChevronRight,
  ExternalLink,
} from 'lucide-react';
import { CsvItem } from '../types/csvMatcher';
import {
  loadAllItemsFromDesti,
  saveAllCsvItemsToDesti,
  saveCsvItemToDesti,
  deleteItemFromDesti,
  clearAllItemsFromDesti,
  UploadProgressInfo,
} from '../services/firebase';
import { extractMlbCodes, normalizeMlbCode, formatMercadoLivreUrl } from '../utils/mlUrl';

interface CsvUploadTabProps {
  items: CsvItem[];
  onItemsChange: (items: CsvItem[]) => void;
}

const PAGE_SIZE = 20;

export const CsvUploadTab: React.FC<CsvUploadTabProps> = ({ items, onItemsChange }) => {
  const [newId, setNewId] = useState('');
  const [newItemName, setNewItemName] = useState('');
  const [newPrice, setNewPrice] = useState('');
  const [newMlb, setNewMlb] = useState('');

  // Search & pagination state (only searches when user types/submits, and paginates 20 per page)
  const [searchInput, setSearchInput] = useState('');
  const [submittedSearch, setSubmittedSearch] = useState('');
  const [showAllIds, setShowAllIds] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);

  const [isLoading, setIsLoading] = useState(false);
  const [isClearingAll, setIsClearingAll] = useState(false);
  const [showConfirmClearModal, setShowConfirmClearModal] = useState(false);
  const [isSavingManual, setIsSavingManual] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Popup modal state for CSV upload progress
  const [uploadModalOpen, setUploadModalOpen] = useState(false);
  const [uploadFinished, setUploadFinished] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<UploadProgressInfo>({
    saved: 0,
    total: 0,
    percentage: 0,
    currentId: '',
    currentItem: '',
    estimatedSecondsRemaining: null,
  });
  const [uploadResultSummary, setUploadResultSummary] = useState<{
    success: number;
    failed: number;
  } | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const parseCsvContent = (csvText: string): CsvItem[] => {
    const lines = csvText
      .split(/\r?\n/)
      .map((l) => l.trim())
      .filter(Boolean);

    if (lines.length === 0) return [];

    const firstLine = lines[0];
    const delimiter = firstLine.includes(';')
      ? ';'
      : firstLine.includes('\t')
      ? '\t'
      : ',';

    const splitCsvLine = (line: string): string[] => {
      const result: string[] = [];
      let current = '';
      let inQuotes = false;
      for (let i = 0; i < line.length; i++) {
        const ch = line[i];
        if (ch === '"') {
          inQuotes = !inQuotes;
        } else if (ch === delimiter && !inQuotes) {
          result.push(current.trim());
          current = '';
        } else {
          current += ch;
        }
      }
      result.push(current.trim());
      return result.map((col) => col.replace(/^"|"$/g, '').trim());
    };

    const headers = splitCsvLine(lines[0]).map((h) => h.toUpperCase());
    let idIdx = headers.findIndex((h) => h === 'ID' || h.includes('ID') || h.includes('ORDER') || h.includes('PEDIDO'));
    let itensIdx = headers.findIndex((h) => h.includes('ITEN') || h.includes('ITEM') || h.includes('PRODUTO') || h.includes('TITULO') || h.includes('DESCRI'));
    let usdIdx = headers.findIndex((h) => h.includes('USD') || h.includes('DOLAR'));
    let realIdx = headers.findIndex((h) => h.includes('REAL') || h.includes('BRL') || h.includes('VALOR'));
    let qtdIdx = headers.findIndex((h) => h.includes('QTD') || h.includes('QUANT'));
    let cepIdx = headers.findIndex((h) => h.includes('CEP') || h.includes('ZIP'));
    // Coluna G chamada MLB (índice 6 ou cabeçalho com MLB)
    let mlbIdx = headers.findIndex((h) => h === 'MLB' || h.includes('MLB') || h.includes('ANUNCIO') || h.includes('ANÚNCIO'));

    let startRow = 1;
    if (idIdx === -1 && itensIdx === -1) {
      idIdx = 0;
      itensIdx = 1;
      usdIdx = 2;
      realIdx = 3;
      qtdIdx = 4;
      cepIdx = 5;
      mlbIdx = 6; // Coluna G padrão (A=0, B=1, C=2, D=3, E=4, F=5, G=6)
      if (/^\d+$/.test(splitCsvLine(lines[0])[0])) {
        startRow = 0;
      }
    } else {
      if (idIdx === -1) idIdx = 0;
      if (itensIdx === -1) itensIdx = 1;
      // Se não encontrou cabeçalho explícito MLB mas houver 7+ colunas, usa a Coluna G (índice 6)
      if (mlbIdx === -1 && headers.length >= 7) {
        mlbIdx = 6;
      }
    }

    const parsedItems: CsvItem[] = [];
    for (let i = startRow; i < lines.length; i++) {
      const cols = splitCsvLine(lines[i]);
      if (cols.length < 2) continue;
      const id = (cols[idIdx] || '').trim();
      const itens = (cols[itensIdx] || '').trim();
      if (!id && !itens) continue;

      // Lê a Coluna G (MLB) ou detecta código MLB em qualquer coluna extra
      let rawMlb = '';
      if (mlbIdx >= 0 && cols[mlbIdx]) {
        rawMlb = cols[mlbIdx].trim();
      } else if (cols[6]) {
        rawMlb = cols[6].trim();
      } else {
        const foundCol = cols.find((c, cIdx) => cIdx !== idIdx && cIdx !== itensIdx && /^MLB[-\s]?\d{6,}/i.test(c.trim()));
        if (foundCol) rawMlb = foundCol.trim();
      }

      const extractedCodes = extractMlbCodes(rawMlb);
      const primaryMlb = extractedCodes[0] || normalizeMlbCode(rawMlb);

      parsedItems.push({
        id,
        itens,
        valorUsd: usdIdx >= 0 ? cols[usdIdx] : undefined,
        valorReal: realIdx >= 0 ? cols[realIdx] : undefined,
        qtdItens: qtdIdx >= 0 ? cols[qtdIdx] : undefined,
        cepBuyer: cepIdx >= 0 ? cols[cepIdx] : undefined,
        mlb: rawMlb || primaryMlb || undefined,
        mlbId: primaryMlb || undefined,
      });
    }

    return parsedItems;
  };

  const handleFileUpload = (file: File) => {
    setErrorMessage(null);
    setStatusMessage(null);

    const reader = new FileReader();
    reader.onload = async (e) => {
      const content = e.target?.result as string;
      if (!content) return;

      const parsed = parseCsvContent(content);
      if (parsed.length === 0) {
        setErrorMessage('Colunas ID e ITENS não encontradas no arquivo CSV.');
        return;
      }

      onItemsChange(parsed);
      setUploadFinished(false);
      setUploadResultSummary(null);
      setUploadProgress({
        saved: 0,
        total: parsed.length,
        percentage: 0,
        currentId: parsed[0]?.id || '',
        currentItem: parsed[0]?.itens || '',
        estimatedSecondsRemaining: null,
      });
      setUploadModalOpen(true);

      try {
        const res = await saveAllCsvItemsToDesti(parsed, (progress) => {
          setUploadProgress(progress);
        });
        setUploadResultSummary(res);
        setUploadFinished(true);
        setStatusMessage(`${res.success} documentos salvos na base.`);
      } catch (err: any) {
        setErrorMessage('Erro ao salvar documentos: ' + (err.message || 'Erro desconhecido'));
        setUploadModalOpen(false);
      } finally {
        if (fileInputRef.current) {
          fileInputRef.current.value = '';
        }
      }
    };
    reader.readAsText(file, 'UTF-8');
  };

  const handleSync = async () => {
    setIsLoading(true);
    setErrorMessage(null);
    try {
      const fbItems = await loadAllItemsFromDesti();
      onItemsChange(fbItems);
      setStatusMessage(`${fbItems.length} documentos sincronizados.`);
    } catch {
      setErrorMessage('Não foi possível sincronizar os documentos.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleAddManual = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newId.trim() || !newItemName.trim()) return;

    const cleanMlbCodes = extractMlbCodes(newMlb);
    const primaryMlb = cleanMlbCodes[0] || normalizeMlbCode(newMlb);

    const newItem: CsvItem = {
      id: newId.trim(),
      itens: newItemName.trim(),
      valorReal: newPrice.trim() || undefined,
      qtdItens: '1',
      mlb: newMlb.trim() || primaryMlb || undefined,
      mlbId: primaryMlb || undefined,
    };

    const updated = [newItem, ...items.filter((it) => it.id !== newItem.id)];
    onItemsChange(updated);
    setNewId('');
    setNewItemName('');
    setNewPrice('');
    setNewMlb('');

    setIsSavingManual(true);
    try {
      await saveCsvItemToDesti(newItem);
      setStatusMessage(`Documento ID ${newItem.id} salvo.`);
    } catch (err: any) {
      setErrorMessage('Erro ao salvar documento: ' + err.message);
    } finally {
      setIsSavingManual(false);
    }
  };

  const handleDelete = async (id: string) => {
    onItemsChange(items.filter((it) => it.id !== id));
    try {
      await deleteItemFromDesti(id);
      setStatusMessage(`Documento ${id} removido.`);
    } catch {}
  };

  const handleClearAllCsv = async () => {
    setIsClearingAll(true);
    setErrorMessage(null);
    try {
      await clearAllItemsFromDesti();
      onItemsChange([]);
      setShowConfirmClearModal(false);
      setStatusMessage('Todos os documentos do CSV foram apagados.');
    } catch (err: any) {
      setErrorMessage('Erro ao apagar documentos: ' + (err.message || 'Erro desconhecido'));
    } finally {
      setIsClearingAll(false);
    }
  };

  const copyId = (text: string, key?: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(key || text);
    setTimeout(() => setCopiedId(null), 1800);
  };

  // Only compute filtered list when user searches or explicitly requests paginated view
  const matchedItems = useMemo(() => {
    const q = submittedSearch.trim().toLowerCase();
    if (!q && !showAllIds) {
      return [];
    }
    if (!q && showAllIds) {
      return items;
    }
    return items.filter((it) =>
      `${it.id} ${it.itens} ${it.mlb || ''} ${it.mlbId || ''}`.toLowerCase().includes(q)
    );
  }, [items, submittedSearch, showAllIds]);

  const totalPages = Math.max(1, Math.ceil(matchedItems.length / PAGE_SIZE));
  const safePage = Math.min(currentPage, totalPages);

  const paginatedItems = useMemo(() => {
    const start = (safePage - 1) * PAGE_SIZE;
    return matchedItems.slice(start, start + PAGE_SIZE);
  }, [matchedItems, safePage]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setSubmittedSearch(searchInput);
    setCurrentPage(1);
  };

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      {/* POPUP MODAL DE CARREGAMENTO DO CSV NO FIREBASE */}
      {uploadModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-lg max-w-md w-full p-6 shadow-xl space-y-5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                {!uploadFinished ? (
                  <div className="w-4 h-4 border-2 border-neutral-900 dark:border-white border-t-transparent rounded-full animate-spin shrink-0" />
                ) : (
                  <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
                )}
                <h3 className="text-sm font-semibold text-neutral-900 dark:text-white">
                  {!uploadFinished
                    ? 'caregando destinacao'
                    : 'Carregamento Concluído'}
                </h3>
              </div>

              <span className="text-xs font-mono font-semibold text-neutral-900 dark:text-white tabular-nums">
                {uploadProgress.percentage}%
              </span>
            </div>

            <div className="space-y-2">
              <div className="h-2 w-full bg-neutral-100 dark:bg-neutral-800 rounded-full overflow-hidden">
                <div
                  className="h-full bg-neutral-900 dark:bg-white transition-all duration-200 ease-out"
                  style={{ width: `${uploadProgress.percentage}%` }}
                />
              </div>

              <div className="flex items-center justify-between text-xs text-neutral-500 font-mono tabular-nums">
                <span>
                  {uploadProgress.saved} de {uploadProgress.total} documentos
                </span>
                <span>
                  {!uploadFinished && uploadProgress.estimatedSecondsRemaining !== null
                    ? `~${uploadProgress.estimatedSecondsRemaining}s restantes`
                    : uploadFinished
                    ? 'Finalizado'
                    : 'Calculando tempo...'}
                </span>
              </div>
            </div>

            {!uploadFinished && uploadProgress.currentId && (
              <div className="p-3 rounded-md bg-neutral-50 dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-800 space-y-1">
                <div className="flex items-center justify-between text-[11px]">
                  <span className="text-neutral-400">Documento (ID):</span>
                  <span className="font-mono font-semibold text-neutral-900 dark:text-neutral-200 tabular-nums">
                    {uploadProgress.currentId}
                  </span>
                </div>
                <p className="text-xs text-neutral-600 dark:text-neutral-400 truncate">
                  {uploadProgress.currentItem}
                </p>
              </div>
            )}

            {uploadFinished && uploadResultSummary && (
              <div className="p-3.5 rounded-md bg-neutral-50 dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-800 space-y-1 text-xs">
                <div className="flex items-center justify-between">
                  <span className="text-neutral-500">Documentos gravados:</span>
                  <span className="font-mono font-semibold text-neutral-900 dark:text-white tabular-nums">
                    {uploadResultSummary.success}
                  </span>
                </div>
              </div>
            )}

            {uploadFinished && (
              <button
                type="button"
                onClick={() => setUploadModalOpen(false)}
                className="w-full py-2 px-4 text-xs font-medium rounded-md bg-neutral-900 text-white dark:bg-white dark:text-neutral-950 hover:opacity-90 transition-opacity cursor-pointer"
              >
                Concluir e Fechar
              </button>
            )}
          </div>
        </div>
      )}

      {/* CONFIRM CLEAR ALL CSV MODAL */}
      {showConfirmClearModal && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-lg max-w-sm w-full p-6 shadow-xl space-y-4">
            <div className="flex items-center gap-3 text-rose-600">
              <div className="p-2 rounded-full bg-rose-50 dark:bg-rose-950/40">
                <Trash2 className="w-5 h-5" />
              </div>
              <h3 className="text-sm font-semibold text-neutral-900 dark:text-white">
                Apagar Todos os CSVs?
              </h3>
            </div>
            <p className="text-xs text-neutral-600 dark:text-neutral-400 leading-relaxed">
              Tem certeza de que deseja apagar todos os <strong>{items.length}</strong> documentos da base? Essa ação removerá todos os dados do banco local e do servidor.
            </p>
            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                disabled={isClearingAll}
                onClick={() => setShowConfirmClearModal(false)}
                className="px-3 py-1.5 text-xs font-medium rounded-md border border-neutral-200 dark:border-neutral-800 text-neutral-700 dark:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-neutral-800 cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="button"
                disabled={isClearingAll}
                onClick={handleClearAllCsv}
                className="px-3 py-1.5 text-xs font-medium rounded-md bg-rose-600 text-white hover:bg-rose-700 disabled:opacity-50 flex items-center gap-1.5 cursor-pointer"
              >
                {isClearingAll ? (
                  <>
                    <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    <span>Apagando...</span>
                  </>
                ) : (
                  <>
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>Sim, Apagar Tudo</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* UPLOAD & MANUAL ADD */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-lg p-6 flex flex-col justify-between">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Database className="w-4 h-4 text-neutral-500" />
              <span className="text-xs font-semibold text-neutral-900 dark:text-neutral-100 uppercase tracking-wider">
                Carregar CSV ({items.length} na base)
              </span>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleSync}
                disabled={isLoading || isClearingAll}
                className="text-xs text-neutral-500 hover:text-neutral-900 dark:hover:text-white flex items-center gap-1.5 cursor-pointer"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
                <span>Sincronizar</span>
              </button>
              {items.length > 0 && (
                <button
                  type="button"
                  onClick={() => setShowConfirmClearModal(true)}
                  disabled={isLoading || isClearingAll}
                  className="text-xs text-rose-600 hover:text-rose-700 dark:text-rose-400 dark:hover:text-rose-300 flex items-center gap-1.5 cursor-pointer ml-1"
                  title="Apagar todos os documentos do CSV"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>Apagar CSVs</span>
                </button>
              )}
            </div>
          </div>

          <div
            onClick={() => fileInputRef.current?.click()}
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => {
              e.preventDefault();
              if (e.dataTransfer.files?.[0]) handleFileUpload(e.dataTransfer.files[0]);
            }}
            className="border border-dashed border-neutral-300 dark:border-neutral-700 hover:border-neutral-900 dark:hover:border-neutral-400 rounded-lg p-8 text-center cursor-pointer transition-colors"
          >
            <input
              ref={fileInputRef}
              type="file"
              accept=".csv,.txt,.tsv"
              onChange={(e) => e.target.files?.[0] && handleFileUpload(e.target.files[0])}
              className="hidden"
            />
            <Upload className="w-5 h-5 text-neutral-500 mx-auto mb-2" />
            <span className="text-xs font-medium text-neutral-900 dark:text-neutral-100 block">
              Clique ou arraste o arquivo .CSV de Destinação
            </span>
            <span className="text-[11px] text-neutral-400 block mt-1">
              Lê automaticamente ID (Col A), ITENS (Col B) e MLB (Coluna G)
            </span>
          </div>

          {(statusMessage || isSavingManual) && (
            <div className="mt-3 text-[11px] font-mono text-neutral-500">
              {isSavingManual ? 'Salvando documento...' : statusMessage}
            </div>
          )}

          {errorMessage && (
            <div className="mt-3 text-xs text-rose-600 flex items-center gap-1.5">
              <AlertCircle className="w-3.5 h-3.5 shrink-0" />
              <span>{errorMessage}</span>
            </div>
          )}
        </div>

        <form
          onSubmit={handleAddManual}
          className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-lg p-6 flex flex-col justify-between space-y-4"
        >
          <span className="text-xs font-semibold text-neutral-900 dark:text-neutral-100 uppercase tracking-wider block">
            Novo Documento Manual
          </span>

          <div className="space-y-3">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="text-[11px] text-neutral-500 block mb-1">ID (Coluna A)</label>
                <input
                  type="text"
                  placeholder="Ex: 2000015111037864"
                  value={newId}
                  onChange={(e) => setNewId(e.target.value)}
                  className="w-full px-3 py-2 text-xs bg-neutral-50 dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-800 rounded-md text-neutral-900 dark:text-white font-mono focus:outline-hidden focus:border-neutral-900 dark:focus:border-neutral-400"
                />
              </div>

              <div>
                <label className="text-[11px] text-neutral-500 block mb-1">MLB (Coluna G)</label>
                <input
                  type="text"
                  placeholder="Ex: MLB3849102931"
                  value={newMlb}
                  onChange={(e) => setNewMlb(e.target.value)}
                  className="w-full px-3 py-2 text-xs bg-neutral-50 dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-800 rounded-md text-neutral-900 dark:text-white font-mono focus:outline-hidden focus:border-neutral-900 dark:focus:border-neutral-400"
                />
              </div>
            </div>

            <div>
              <label className="text-[11px] text-neutral-500 block mb-1">Descrição do Item (Coluna B)</label>
              <input
                type="text"
                placeholder="Ex: Kit 10 Anilhas De Latão Para Compressão"
                value={newItemName}
                onChange={(e) => setNewItemName(e.target.value)}
                className="w-full px-3 py-2 text-xs bg-neutral-50 dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-800 rounded-md text-neutral-900 dark:text-white focus:outline-hidden focus:border-neutral-900 dark:focus:border-neutral-400"
              />
            </div>

            <div>
              <label className="text-[11px] text-neutral-500 block mb-1">Valor R$ (opcional)</label>
              <input
                type="text"
                placeholder="Ex: 49.99"
                value={newPrice}
                onChange={(e) => setNewPrice(e.target.value)}
                className="w-full px-3 py-2 text-xs bg-neutral-50 dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-800 rounded-md text-neutral-900 dark:text-white font-mono focus:outline-hidden focus:border-neutral-900 dark:focus:border-neutral-400"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={!newId.trim() || !newItemName.trim() || isSavingManual}
            className="w-full py-2 px-4 text-xs font-medium rounded-md bg-neutral-900 text-white dark:bg-white dark:text-neutral-950 hover:opacity-90 disabled:opacity-40 transition-opacity flex items-center justify-center gap-1.5 cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Salvar Documento no Firebase</span>
          </button>
        </form>
      </div>

      {/* SEARCH & PAGINATED RESULTS (DOES NOT RENDER THOUSANDS OF IDS BY DEFAULT) */}
      <div className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-lg overflow-hidden">
        <div className="p-4 border-b border-neutral-200 dark:border-neutral-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <span className="text-xs font-semibold text-neutral-900 dark:text-neutral-100">
              Consultar Base ({items.length} documentos)
            </span>
            <button
              type="button"
              onClick={() => {
                setShowAllIds(!showAllIds);
                setCurrentPage(1);
              }}
              className="text-xs text-neutral-500 hover:text-neutral-900 dark:hover:text-white underline cursor-pointer"
            >
              {showAllIds ? 'Ocultar lista geral' : 'Ver lista paginada'}
            </button>
          </div>

          <form onSubmit={handleSearchSubmit} className="flex items-center gap-2 w-full sm:w-auto">
            <div className="relative flex-1 sm:w-64">
              <Search className="w-3.5 h-3.5 text-neutral-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                placeholder="Buscar ID, MLB ou produto..."
                className="w-full pl-8 pr-3 py-1.5 text-xs bg-neutral-50 dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-800 rounded-md text-neutral-900 dark:text-white focus:outline-hidden focus:border-neutral-900"
              />
            </div>
            <button
              type="submit"
              className="px-3 py-1.5 text-xs font-medium rounded-md bg-neutral-900 text-white dark:bg-white dark:text-neutral-950 cursor-pointer"
            >
              Buscar
            </button>
          </form>
        </div>

        {!submittedSearch.trim() && !showAllIds ? (
          <div className="p-6 text-center text-xs text-neutral-400">
            Os {items.length} IDs estão salvos e ocultos para manter o sistema rápido. Digite acima para buscar um item/MLB ou clique em "Ver lista paginada".
          </div>
        ) : matchedItems.length === 0 ? (
          <div className="p-6 text-center text-xs text-neutral-400">
            Nenhum documento encontrado para "{submittedSearch}".
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs divide-y divide-neutral-200 dark:divide-neutral-800">
                <thead className="bg-neutral-50 dark:bg-neutral-950 text-neutral-500 font-medium">
                  <tr>
                    <th className="py-2.5 px-4">Documento ID</th>
                    <th className="py-2.5 px-4">Item</th>
                    <th className="py-2.5 px-4">Coluna G (MLB)</th>
                    <th className="py-2.5 px-4 text-right">Valor</th>
                    <th className="py-2.5 px-4 text-center">Qtd</th>
                    <th className="py-2.5 px-4 text-right">Ações</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-100 dark:divide-neutral-800/60">
                  {paginatedItems.map((it, idx) => {
                    const mlbDisplay = it.mlb || it.mlbId || '';
                    return (
                      <tr key={`${it.id}-${idx}`} className="hover:bg-neutral-50 dark:hover:bg-neutral-800/40">
                        <td className="py-2.5 px-4 font-mono font-medium text-neutral-900 dark:text-neutral-200 whitespace-nowrap tabular-nums">
                          {it.id}
                        </td>
                        <td className="py-2.5 px-4 text-neutral-700 dark:text-neutral-300 max-w-md">
                          {it.itens}
                        </td>
                        <td className="py-2.5 px-4 font-mono text-neutral-700 dark:text-neutral-300 whitespace-nowrap tabular-nums">
                          {mlbDisplay ? (
                            <div className="inline-flex items-center gap-1.5">
                              <span>{mlbDisplay}</span>
                              <button
                                type="button"
                                onClick={() => copyId(mlbDisplay, `mlb-${it.id}`)}
                                className="p-1 text-neutral-400 hover:text-neutral-900 dark:hover:text-white rounded cursor-pointer"
                                title="Copiar MLB"
                              >
                                {copiedId === `mlb-${it.id}` ? (
                                  <Check className="w-3 h-3 text-emerald-600" />
                                ) : (
                                  <Copy className="w-3 h-3" />
                                )}
                              </button>
                              <a
                                href={formatMercadoLivreUrl(it.itens, mlbDisplay)}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="p-1 text-neutral-400 hover:text-neutral-900 dark:hover:text-white rounded"
                                title="Abrir anúncio no ML"
                              >
                                <ExternalLink className="w-3 h-3" />
                              </a>
                            </div>
                          ) : (
                            <span className="text-neutral-400">—</span>
                          )}
                        </td>
                        <td className="py-2.5 px-4 font-mono text-right text-neutral-600 dark:text-neutral-400 whitespace-nowrap tabular-nums">
                          {it.valorReal ? `R$ ${it.valorReal}` : '—'}
                        </td>
                        <td className="py-2.5 px-4 font-mono text-center text-neutral-500 tabular-nums">
                          {it.qtdItens || '1'}
                        </td>
                        <td className="py-2.5 px-4 text-right whitespace-nowrap">
                          <div className="inline-flex items-center gap-1">
                            <button
                              type="button"
                              onClick={() => copyId(it.id)}
                              className="p-1.5 text-neutral-400 hover:text-neutral-900 dark:hover:text-white rounded cursor-pointer"
                              title="Copiar ID"
                            >
                              {copiedId === it.id ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDelete(it.id)}
                              className="p-1.5 text-neutral-400 hover:text-rose-600 rounded cursor-pointer"
                              title="Excluir documento"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* PAGINATION FOOTER */}
            <div className="px-4 py-3 border-t border-neutral-200 dark:border-neutral-800 flex items-center justify-between text-xs text-neutral-500">
              <span className="font-mono tabular-nums">
                Exibindo {(safePage - 1) * PAGE_SIZE + 1}–{Math.min(safePage * PAGE_SIZE, matchedItems.length)} de {matchedItems.length}
              </span>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  disabled={safePage <= 1}
                  onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                  className="px-2.5 py-1 rounded border border-neutral-200 dark:border-neutral-800 disabled:opacity-40 hover:border-neutral-900 dark:hover:border-neutral-400 flex items-center gap-1 cursor-pointer"
                >
                  <ChevronLeft className="w-3.5 h-3.5" />
                  <span>Anterior</span>
                </button>
                <span className="font-mono tabular-nums px-2">
                  Página {safePage} de {totalPages}
                </span>
                <button
                  type="button"
                  disabled={safePage >= totalPages}
                  onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                  className="px-2.5 py-1 rounded border border-neutral-200 dark:border-neutral-800 disabled:opacity-40 hover:border-neutral-900 dark:hover:border-neutral-400 flex items-center gap-1 cursor-pointer"
                >
                  <span>Próxima</span>
                  <ChevronRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
};
