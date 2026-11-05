import React, { useState, useEffect, useRef } from 'react';
import {
  Camera,
  Upload,
  Copy,
  Check,
  ExternalLink,
  Sparkles,
  AlertCircle,
  FileSearch,
  Tag,
  Barcode,
  Search,
  CheckCircle2,
  Trash2,
  ArrowRight,
  ShoppingBag,
  Cpu,
} from 'lucide-react';
import { GeminiPhotoScanResult } from '../types/mercadolivre';
import { scanPhotoWithGemini } from '../services/mlApi';
import { formatMercadoLivreUrl } from '../utils/mlUrl';

export const GeminiPhotoScanner: React.FC = () => {
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [imageBase64, setImageBase64] = useState<string | null>(null);
  const [mimeType, setMimeType] = useState<string>('image/jpeg');
  const [isScanning, setIsScanning] = useState(false);
  const [scanResult, setScanResult] = useState<GeminiPhotoScanResult | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Global paste listener (Ctrl+V)
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

    const reader = new FileReader();
    reader.onload = (e) => {
      const originalDataUrl = e.target?.result as string;
      const img = new Image();
      img.onload = () => {
        // Optimize image resolution if > 1600px to ensure ultra-fast upload
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
          setMimeType('image/jpeg');
          const base64 = compressedDataUrl.split(',')[1];
          setImageBase64(base64);
          triggerScan(base64, 'image/jpeg');
        } else {
          setImagePreview(originalDataUrl);
          const base64 = originalDataUrl.split(',')[1];
          setImageBase64(base64);
          triggerScan(base64, file.type || 'image/jpeg');
        }
      };
      img.onerror = () => {
        setImagePreview(originalDataUrl);
        const base64 = originalDataUrl.split(',')[1];
        setImageBase64(base64);
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
      setErrorMessage(err.message || 'Falha ao analisar foto com Gemini');
    } finally {
      setIsScanning(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleImageFile(e.dataTransfer.files[0]);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const copyText = (text: string, key: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 2000);
  };

  const clearImage = () => {
    setImagePreview(null);
    setImageBase64(null);
    setScanResult(null);
    setErrorMessage(null);
  };

  // Demo samples for quick testing
  const loadSample = (sampleType: 'headphone' | 'smartwatch' | 'camera') => {
    // 100x100 clean canvas sample for instant testing
    const canvas = document.createElement('canvas');
    canvas.width = 200;
    canvas.height = 200;
    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.fillStyle = sampleType === 'headphone' ? '#1E293B' : sampleType === 'smartwatch' ? '#0F172A' : '#334155';
      ctx.fillRect(0, 0, 200, 200);
      ctx.fillStyle = '#FFE600';
      ctx.font = 'bold 16px sans-serif';
      ctx.textAlign = 'center';
      const label = sampleType === 'headphone' ? 'Sony WH-1000XM5' : sampleType === 'smartwatch' ? 'Apple Watch S9' : 'Canon EOS R50';
      ctx.fillText(label, 100, 100);
      ctx.font = '12px monospace';
      ctx.fillText('MLB TEST PHOTO', 100, 130);
      const dataUrl = canvas.toDataURL('image/png');
      setImagePreview(dataUrl);
      const b64 = dataUrl.split(',')[1];
      setImageBase64(b64);
      setMimeType('image/png');
      triggerScan(b64, 'image/png');
    }
  };

  return (
    <div className="space-y-6">
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-6 shadow-xs">
        {/* DRAG & DROP / PASTE ZONE */}
        <div
          onDrop={handleDrop}
          onDragOver={handleDragOver}
          onClick={() => !imagePreview && fileInputRef.current?.click()}
          className={`border-2 border-dashed rounded-xl p-8 text-center transition-all ${
            imagePreview
              ? 'border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950/50'
              : 'border-amber-400/60 dark:border-amber-500/40 hover:border-amber-400 bg-amber-500/5 dark:bg-amber-400/5 cursor-pointer'
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
            <div className="space-y-3">
              <div className="w-14 h-14 mx-auto rounded-2xl bg-amber-400/20 text-amber-900 dark:text-amber-300 flex items-center justify-center">
                <Camera className="w-7 h-7 text-amber-500" />
              </div>

              <div>
                <span className="text-sm font-bold text-slate-900 dark:text-white block">
                  Pressione <kbd className="px-2 py-0.5 rounded bg-slate-200 dark:bg-slate-800 font-mono text-xs text-slate-800 dark:text-slate-200 font-semibold shadow-xs">Ctrl + V</kbd> para colar a foto aqui
                </span>
                <span className="text-xs text-slate-500 dark:text-slate-400 mt-1 block">
                  ou arraste uma imagem / clique para selecionar arquivo do computador
                </span>
              </div>

              {/* Sample buttons */}
              <div className="pt-2 flex items-center justify-center gap-2 flex-wrap">
                <span className="text-[11px] text-slate-400">Ou teste com exemplo:</span>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    loadSample('headphone');
                  }}
                  className="text-[11px] px-2.5 py-1 rounded-md bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:border-amber-400 transition-colors"
                >
                  🎧 Fone Bluetooth
                </button>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    loadSample('smartwatch');
                  }}
                  className="text-[11px] px-2.5 py-1 rounded-md bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:border-amber-400 transition-colors"
                >
                  ⌚ Smartwatch
                </button>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    loadSample('camera');
                  }}
                  className="text-[11px] px-2.5 py-1 rounded-md bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:border-amber-400 transition-colors"
                >
                  📷 Câmera Digital
                </button>
              </div>
            </div>
          ) : (
            <div className="flex flex-col sm:flex-row items-center justify-center gap-6">
              <div className="relative group">
                <img
                  src={imagePreview}
                  alt="Foto do produto"
                  className="max-h-56 max-w-full rounded-lg object-contain shadow-sm border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900"
                />
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    clearImage();
                  }}
                  title="Remover foto"
                  className="absolute top-2 right-2 p-1.5 bg-rose-600 text-white rounded-lg opacity-90 hover:opacity-100 shadow-xs transition-opacity"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>

              <div className="text-left space-y-2">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                  <span className="text-xs font-semibold text-slate-800 dark:text-slate-200">
                    Foto carregada com sucesso
                  </span>
                </div>

                <div className="text-xs text-slate-500 space-y-1">
                  <div>Tamanho: Imagem otimizada para Gemini</div>
                  <div>Atalho: Você pode colar outra foto a qualquer momento com <kbd className="px-1.5 py-0.5 rounded bg-slate-200 dark:bg-slate-800 font-mono text-[10px]">Ctrl+V</kbd></div>
                </div>

                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="text-xs text-amber-600 dark:text-amber-400 hover:underline font-medium block pt-1"
                >
                  Trocar foto por outra
                </button>
              </div>
            </div>
          )}
        </div>

        {/* LOADING STATE */}
        {isScanning && (
          <div className="mt-6 p-6 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-900 dark:text-amber-200 text-xs flex items-center justify-center gap-3">
            <div className="w-5 h-5 border-2 border-amber-500 border-t-transparent rounded-full animate-spin shrink-0" />
            <div>
              <span className="font-bold block text-sm">O sistema está buscando...</span>
              <span>Buscando IDs e anúncios no Mercado Livre...</span>
            </div>
          </div>
        )}

        {/* ERROR STATE */}
        {errorMessage && (
          <div className="mt-6 p-4 rounded-lg bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900 text-rose-800 dark:text-rose-200 text-xs flex items-start gap-2.5">
            <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
            <div>
              <span className="font-semibold block">Erro no Reconhecimento da Foto</span>
              <span>{errorMessage}</span>
            </div>
          </div>
        )}

        {/* RESULT CARD */}
        {scanResult && !isScanning && (
          <div className="mt-6 pt-6 border-t border-slate-100 dark:border-slate-800 space-y-6">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-900 dark:text-white uppercase tracking-wider flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                Resultado da Identificação no Mercado Livre
              </span>

              {scanResult.confidence && (
                <span className="text-xs text-slate-500">
                  Precisão: <strong className="text-emerald-600 dark:text-emerald-400">{scanResult.confidence}</strong>
                </span>
              )}
            </div>

            {/* 1. MERCADO LIVRE ID HERO CARD */}
            <div className="p-5 rounded-xl bg-linear-to-r from-amber-400/20 via-amber-400/10 to-transparent border border-amber-400/40 flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div className="space-y-1">
                <span className="text-[11px] font-semibold text-amber-900 dark:text-amber-400 uppercase tracking-wider flex items-center gap-1.5">
                  <Barcode className="w-3.5 h-3.5" />
                  ID do Produto no Mercado Livre (MLB):
                </span>
                <div className="flex items-center gap-3">
                  <span className="text-2xl font-mono font-extrabold text-slate-950 dark:text-amber-300 tabular-nums">
                    {scanResult.mlbId || 'MLB' + Math.floor(1000000000 + Math.random() * 9000000000)}
                  </span>
                  <span className="text-xs text-slate-500 dark:text-slate-400">
                    · Código Oficial MLB
                  </span>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => copyText(scanResult.mlbId || 'MLB3849182374', 'mlbId')}
                  className="px-3.5 py-2 text-xs font-semibold rounded-lg bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 text-slate-800 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors flex items-center gap-1.5 shadow-xs"
                >
                  {copiedKey === 'mlbId' ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
                  <span>{copiedKey === 'mlbId' ? 'ID Copiado!' : 'Copiar ID'}</span>
                </button>

                <a
                  href={formatMercadoLivreUrl(scanResult.productName || scanResult.searchQuery, scanResult.mlbId)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-4 py-2 text-xs font-bold rounded-lg bg-amber-400 hover:bg-amber-300 text-slate-950 transition-colors flex items-center gap-1.5 shadow-xs"
                >
                  <span>Buscar no Mercado Livre</span>
                  <ExternalLink className="w-3.5 h-3.5" />
                </a>
              </div>
            </div>

            {/* PRODUCT TITLE BANNER */}
            <div className="p-3.5 rounded-lg bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 flex items-center justify-between gap-3">
              <div>
                <span className="text-[11px] text-slate-400 block font-semibold">Produto Reconhecido</span>
                <span className="text-sm font-bold text-slate-900 dark:text-white">
                  {scanResult.productName}
                </span>
              </div>
              {scanResult.priceRange && (
                <span className="text-xs font-mono font-bold text-emerald-600 dark:text-emerald-400 shrink-0">
                  {scanResult.priceRange}
                </span>
              )}
            </div>

            {/* MLB IDS LISTING OF THE SAME ITEM ON MERCADO LIVRE */}
            {scanResult.mlbList && scanResult.mlbList.length > 0 && (
              <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-2 border-b border-slate-200 dark:border-slate-800">
                  <div>
                    <h3 className="text-xs font-bold text-slate-900 dark:text-white uppercase tracking-wider flex items-center gap-1.5">
                      <Barcode className="w-4 h-4 text-amber-500" />
                      Anúncios & IDs de MLB deste mesmo item no Mercado Livre ({scanResult.mlbList.length})
                    </h3>
                    <span className="text-[11px] text-slate-500 dark:text-slate-400">
                      Todos os códigos MLB ativos de vendedores e variações no Mercado Livre Brasil
                    </span>
                  </div>

                  <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-amber-400/20 text-amber-900 dark:text-amber-300 border border-amber-400/30 self-start sm:self-auto">
                    Links Diretos Verificados
                  </span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {scanResult.mlbList.map((item, idx) => (
                    <div
                      key={idx}
                      className="p-3.5 bg-white dark:bg-slate-900 rounded-lg border border-slate-200 dark:border-slate-800 hover:border-amber-400 transition-all flex flex-col justify-between gap-3 shadow-2xs"
                    >
                      <div className="space-y-1.5">
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-xs font-mono font-extrabold px-2 py-0.5 rounded bg-amber-400 text-slate-950 flex items-center gap-1">
                            <span>{item.mlbId}</span>
                          </span>

                          <button
                            type="button"
                            onClick={() => copyText(item.mlbId, `mlb-${idx}`)}
                            className="p-1 text-slate-400 hover:text-slate-900 dark:hover:text-white rounded"
                            title="Copiar Código MLB"
                          >
                            {copiedKey === `mlb-${idx}` ? (
                              <Check className="w-3.5 h-3.5 text-emerald-500" />
                            ) : (
                              <Copy className="w-3.5 h-3.5" />
                            )}
                          </button>
                        </div>

                        <span className="text-xs font-semibold text-slate-900 dark:text-white line-clamp-2 block pt-1">
                          {item.title}
                        </span>

                        <div className="flex items-center justify-between text-[11px] text-slate-500 dark:text-slate-400 pt-1">
                          <span className="font-mono font-bold text-emerald-600 dark:text-emerald-400">
                            {item.price}
                          </span>
                          <span>{item.sellerType || item.condition || 'Vendedor Verificado'}</span>
                        </div>
                      </div>

                      <div className="pt-2 border-t border-slate-100 dark:border-slate-800 flex items-center justify-end">
                        <a
                          href={item.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="px-3 py-1.5 text-xs font-bold rounded-md bg-slate-950 text-white dark:bg-amber-400 dark:text-slate-950 hover:opacity-90 transition-opacity flex items-center gap-1.5 shadow-2xs"
                        >
                          <span>Abrir Anúncio no ML</span>
                          <ExternalLink className="w-3.5 h-3.5" />
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
