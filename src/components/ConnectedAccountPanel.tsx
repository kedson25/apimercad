import React, { useState } from 'react';
import {
  UserCheck,
  ExternalLink,
  ShieldCheck,
  Mail,
  MapPin,
  Building2,
  Tag,
  Star,
  RefreshCw,
  Copy,
  Check,
  Sparkles,
  Terminal,
  Send,
  Layers,
  ShoppingBag,
  ArrowRight,
  HelpCircle,
} from 'lucide-react';
import { MLUser, TokenResponse, AIProductAnalysis } from '../types/mercadolivre';
import { proxyApiCall, analyzeProductImage } from '../services/mlApi';

interface ConnectedAccountPanelProps {
  user: MLUser;
  tokenData: TokenResponse | null;
  onRefreshNow: () => void;
  isRefreshing: boolean;
  onOpenScanner?: () => void;
}

export const ConnectedAccountPanel: React.FC<ConnectedAccountPanelProps> = ({
  user,
  tokenData,
  onRefreshNow,
  isRefreshing,
  onOpenScanner,
}) => {
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  // AI Product Analysis state
  const [productHint, setProductHint] = useState('Smartwatch Bluetooth Pro');
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisResult, setAnalysisResult] = useState<AIProductAnalysis | null>(null);

  // API Console state
  const [apiEndpoint, setApiEndpoint] = useState('/users/me');
  const [apiMethod, setApiMethod] = useState<'GET' | 'POST'>('GET');
  const [isCallingApi, setIsCallingApi] = useState(false);
  const [apiConsoleResponse, setApiConsoleResponse] = useState<any>(null);

  const copyText = (text: string, key: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 2000);
  };

  const handleRunAiAnalysis = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsAnalyzing(true);
    try {
      const result = await analyzeProductImage(productHint);
      setAnalysisResult(result);
    } catch (err: any) {
      alert('Erro na análise de imagem: ' + err.message);
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleRunApiCall = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsCallingApi(true);
    try {
      const res = await proxyApiCall(apiEndpoint, apiMethod);
      setApiConsoleResponse(res);
    } catch (err: any) {
      setApiConsoleResponse({ error: err.message });
    } finally {
      setIsCallingApi(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* 1. MAIN CONNECTED HERO CARD */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-6 shadow-xs relative overflow-hidden">
        <div className="absolute top-0 right-0 w-64 h-64 bg-amber-400/10 rounded-full blur-3xl pointer-events-none" />

        <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-6 pb-6 border-b border-slate-100 dark:border-slate-800">
          <div className="flex items-center gap-4">
            {/* Avatar image or fallback */}
            <div className="relative">
              {user.thumbnailUrl ? (
                <img
                  src={user.thumbnailUrl}
                  alt={user.nickname}
                  referrerPolicy="no-referrer"
                  className="w-16 h-16 rounded-full object-cover border-2 border-amber-400 shadow-sm"
                />
              ) : (
                <div className="w-16 h-16 rounded-full bg-amber-400 text-slate-950 flex items-center justify-center font-bold text-xl shadow-sm">
                  {user.nickname.slice(0, 2).toUpperCase()}
                </div>
              )}
              <div
                className="absolute bottom-0 right-0 w-4 h-4 rounded-full bg-emerald-500 border-2 border-white dark:border-slate-900"
                title="Conta Conectada e Ativa"
              />
            </div>

            <div className="space-y-0.5">
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-bold text-slate-900 dark:text-white">
                  {user.firstName || user.lastName
                    ? `${user.firstName} ${user.lastName}`
                    : user.nickname}
                </h2>
                <span className="text-xs font-mono font-semibold px-2 py-0.5 rounded-md bg-amber-400/20 text-amber-900 dark:text-amber-300 border border-amber-400/40">
                  {user.nickname}
                </span>
              </div>

              <div className="flex flex-wrap items-center gap-x-3 text-xs text-slate-500 dark:text-slate-400">
                <span>ID: <strong className="font-mono text-slate-700 dark:text-slate-300">{user.id}</strong></span>
                <span>·</span>
                <span>País: <strong>Brasil (MLB)</strong></span>
                <span>·</span>
                <span className="text-emerald-600 dark:text-emerald-400 font-semibold">Status: Ativo</span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2.5 flex-wrap">
            {onOpenScanner && (
              <button
                type="button"
                onClick={onOpenScanner}
                className="px-3.5 py-2 text-xs font-bold rounded-lg bg-slate-900 text-white dark:bg-amber-400 dark:text-slate-950 hover:bg-slate-800 dark:hover:bg-amber-300 transition-colors flex items-center gap-1.5 shadow-xs"
              >
                <Sparkles className="w-3.5 h-3.5 text-amber-400 dark:text-slate-950" />
                <span>Colar Foto & Buscar ID (Gemini)</span>
              </button>
            )}

            <button
              type="button"
              onClick={onRefreshNow}
              disabled={isRefreshing}
              className="px-3.5 py-2 text-xs font-semibold rounded-lg bg-amber-400/20 text-amber-900 dark:text-amber-300 border border-amber-400/30 hover:bg-amber-400/30 transition-colors flex items-center gap-1.5"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin' : ''}`} />
              <span>{isRefreshing ? 'Renovando Token...' : 'Renovar Token'}</span>
            </button>

            {user.permalink && (
              <a
                href={user.permalink}
                target="_blank"
                rel="noopener noreferrer"
                className="px-3.5 py-2 text-xs font-medium rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:bg-slate-200 transition-colors flex items-center gap-1.5"
              >
                <span>Ver Perfil no Mercado Livre</span>
                <ExternalLink className="w-3.5 h-3.5" />
              </a>
            )}
          </div>
        </div>

        {/* DETAILS GRID */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mt-6">
          <div className="p-3.5 rounded-lg bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 space-y-1">
            <span className="text-[11px] text-slate-400 flex items-center gap-1">
              <Mail className="w-3 h-3 text-amber-500" />
              E-mails Cadastrados
            </span>
            <div className="text-xs font-medium text-slate-900 dark:text-white truncate">
              {user.email || 'Não informado'}
            </div>
            {user.contactEmail && (
              <div className="text-[11px] text-slate-500 truncate" title={user.contactEmail}>
                Contato: {user.contactEmail}
              </div>
            )}
          </div>

          <div className="p-3.5 rounded-lg bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 space-y-1">
            <span className="text-[11px] text-slate-400 flex items-center gap-1">
              <MapPin className="w-3 h-3 text-amber-500" />
              Localização da Loja
            </span>
            <div className="text-xs font-medium text-slate-900 dark:text-white truncate">
              {user.address?.city} - {user.address?.state?.replace('BR-', '')}
            </div>
            <div className="text-[11px] text-slate-500 truncate">
              {user.address?.address}
            </div>
          </div>

          <div className="p-3.5 rounded-lg bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 space-y-1">
            <span className="text-[11px] text-slate-400 flex items-center gap-1">
              <Building2 className="w-3 h-3 text-amber-500" />
              Marca / Empresa
            </span>
            <div className="text-xs font-bold text-slate-900 dark:text-white">
              {user.company?.brandName || 'ked'}
            </div>
            <div className="text-[11px] text-slate-500">
              Tipo: Pessoa Física ({user.identification?.type || 'CPF'})
            </div>
          </div>

          <div className="p-3.5 rounded-lg bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 space-y-1">
            <span className="text-[11px] text-slate-400 flex items-center gap-1">
              <Star className="w-3 h-3 text-amber-500" />
              Reputação & Pontos
            </span>
            <div className="text-xs font-bold text-slate-900 dark:text-white">
              {user.points ?? 1} Ponto no Mercado Pontos
            </div>
            <div className="text-[11px] text-slate-500">
              Nível: {user.sellerExperience || 'Iniciante (Newbie)'}
            </div>
          </div>
        </div>

        {/* ACTIVE TAGS */}
        {user.tags && user.tags.length > 0 && (
          <div className="mt-4 pt-4 border-t border-slate-100 dark:border-slate-800 flex items-center gap-2 flex-wrap">
            <span className="text-xs text-slate-400 flex items-center gap-1">
              <Tag className="w-3 h-3 text-amber-500" />
              Permissões da Conta:
            </span>
            {user.tags.map((tag) => (
              <span
                key={tag}
                className="text-[11px] font-mono px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300"
              >
                {tag}
              </span>
            ))}
          </div>
        )}
      </div>

      {/* 2. RECONHECIMENTO DE IMAGEM & GERADOR DE ANÚNCIO (OPENAI INTEGRATION) */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-6 shadow-xs">
        <div className="mb-4 pb-3 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
          <div>
            <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-amber-500" />
              Reconhecimento de Produtos & Otimizador de Anúncios ML
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Gere títulos de 60 caracteres, descrição persuasiva, categoria e ficha técnica compatível com o algoritmo do Mercado Livre.
            </p>
          </div>
          <span className="text-[11px] font-semibold text-amber-600 dark:text-amber-400 bg-amber-500/10 px-2 py-1 rounded-md">
            IA Otimizada para Mercado Livre Brasil
          </span>
        </div>

        <form onSubmit={handleRunAiAnalysis} className="space-y-3">
          <div>
            <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
              Nome do Produto ou Descrição Breve da Foto
            </label>
            <div className="flex gap-2">
              <input
                type="text"
                value={productHint}
                onChange={(e) => setProductHint(e.target.value)}
                placeholder="Ex: Câmera de Segurança Wi-Fi Externa Prova D'Água 1080p"
                className="flex-1 px-3.5 py-2 text-xs bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white focus:outline-hidden focus:ring-2 focus:ring-amber-400"
              />
              <button
                type="submit"
                disabled={isAnalyzing || !productHint.trim()}
                className={`px-4 py-2 text-xs font-bold rounded-lg flex items-center gap-2 shadow-xs transition-colors shrink-0 ${
                  isAnalyzing || !productHint.trim()
                    ? 'bg-slate-100 dark:bg-slate-800 text-slate-400 cursor-not-allowed'
                    : 'bg-slate-900 text-white dark:bg-amber-400 dark:text-slate-950 hover:bg-slate-800 dark:hover:bg-amber-300'
                }`}
              >
                <Sparkles className={`w-3.5 h-3.5 ${isAnalyzing ? 'animate-spin' : ''}`} />
                <span>{isAnalyzing ? 'Gerando Anúncio...' : 'Gerar Anúncio Completo'}</span>
              </button>
            </div>
          </div>
        </form>

        {analysisResult && (
          <div className="mt-5 p-4 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 space-y-4">
            {/* Title */}
            <div>
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                  Título Otimizado (Máx 60 caracteres no Mercado Livre):
                </span>
                <div className="flex items-center gap-2">
                  <span className="text-[11px] font-mono text-slate-400">
                    {analysisResult.productTitle.length}/60 chars
                  </span>
                  <button
                    type="button"
                    onClick={() => copyText(analysisResult.productTitle, 'title')}
                    className="text-xs text-amber-700 dark:text-amber-400 hover:underline flex items-center gap-1 font-medium"
                  >
                    {copiedKey === 'title' ? <Check className="w-3 h-3 text-emerald-500" /> : <Copy className="w-3 h-3" />}
                    <span>{copiedKey === 'title' ? 'Copiado' : 'Copiar'}</span>
                  </button>
                </div>
              </div>
              <div className="p-2.5 bg-white dark:bg-slate-900 rounded-lg border border-slate-200 dark:border-slate-800 text-xs font-bold text-slate-900 dark:text-white">
                {analysisResult.productTitle}
              </div>
            </div>

            {/* Category & Price */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="p-3 bg-white dark:bg-slate-900 rounded-lg border border-slate-200 dark:border-slate-800">
                <span className="text-[11px] text-slate-400 block mb-0.5">Categoria Sugerida</span>
                <span className="text-xs font-medium text-slate-800 dark:text-slate-200">
                  {analysisResult.suggestedCategory}
                </span>
              </div>
              <div className="p-3 bg-white dark:bg-slate-900 rounded-lg border border-slate-200 dark:border-slate-800">
                <span className="text-[11px] text-slate-400 block mb-0.5">Faixa de Preço Estimada</span>
                <span className="text-xs font-bold text-emerald-600 dark:text-emerald-400">
                  {analysisResult.estimatedPriceRange}
                </span>
              </div>
            </div>

            {/* Description */}
            <div>
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                  Descrição Completa Formatada para o Anúncio:
                </span>
                <button
                  type="button"
                  onClick={() => copyText(analysisResult.seoDescription, 'desc')}
                  className="text-xs text-amber-700 dark:text-amber-400 hover:underline flex items-center gap-1 font-medium"
                >
                  {copiedKey === 'desc' ? <Check className="w-3 h-3 text-emerald-500" /> : <Copy className="w-3 h-3" />}
                  <span>{copiedKey === 'desc' ? 'Copiado' : 'Copiar Descrição'}</span>
                </button>
              </div>
              <pre className="p-3 bg-white dark:bg-slate-900 rounded-lg border border-slate-200 dark:border-slate-800 text-xs font-mono text-slate-700 dark:text-slate-300 whitespace-pre-wrap max-h-48 overflow-y-auto">
                {analysisResult.seoDescription}
              </pre>
            </div>
          </div>
        )}
      </div>

      {/* 3. CONSOLE DE REQUISIÇÕES DA API MERCADO LIVRE */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-6 shadow-xs">
        <div className="mb-4 pb-3 border-b border-slate-100 dark:border-slate-800">
          <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <Terminal className="w-4 h-4 text-amber-500" />
            Console Interativo de API do Mercado Livre
          </h3>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            Execute qualquer chamada autenticada com seu token ativo para a API do Mercado Livre.
          </p>
        </div>

        {/* Quick presets */}
        <div className="flex items-center gap-1.5 flex-wrap mb-3">
          <span className="text-[11px] text-slate-400 mr-1">Exemplos rápidos:</span>
          {[
            { label: 'Meus Dados (/users/me)', endpoint: '/users/me' },
            { label: 'Meu Perfil (/users/1690967397)', endpoint: '/users/1690967397' },
            { label: 'Categorias MLB (/sites/MLB/categories)', endpoint: '/sites/MLB/categories' },
            { label: 'Moedas (/currencies)', endpoint: '/currencies' },
          ].map((preset) => (
            <button
              key={preset.endpoint}
              type="button"
              onClick={() => setApiEndpoint(preset.endpoint)}
              className="text-[11px] px-2 py-0.5 rounded-md border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:border-amber-400"
            >
              {preset.label}
            </button>
          ))}
        </div>

        <form onSubmit={handleRunApiCall} className="flex gap-2">
          <select
            value={apiMethod}
            onChange={(e) => setApiMethod(e.target.value as any)}
            className="px-3 py-2 text-xs font-mono font-semibold rounded-lg bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-white"
          >
            <option value="GET">GET</option>
            <option value="POST">POST</option>
          </select>

          <div className="flex-1 relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-mono text-slate-400">
              https://api.mercadolibre.com
            </span>
            <input
              type="text"
              value={apiEndpoint}
              onChange={(e) => setApiEndpoint(e.target.value)}
              className="w-full pl-52 pr-3 py-2 text-xs font-mono bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white focus:outline-hidden focus:ring-2 focus:ring-amber-400"
            />
          </div>

          <button
            type="submit"
            disabled={isCallingApi}
            className="px-4 py-2 text-xs font-bold rounded-lg bg-slate-900 text-white dark:bg-amber-400 dark:text-slate-950 hover:bg-slate-800 transition-colors flex items-center gap-1.5 shadow-xs shrink-0"
          >
            <Send className={`w-3.5 h-3.5 ${isCallingApi ? 'animate-spin' : ''}`} />
            <span>{isCallingApi ? 'Consultando...' : 'Executar'}</span>
          </button>
        </form>

        {apiConsoleResponse && (
          <div className="mt-4 pt-4 border-t border-slate-100 dark:border-slate-800 space-y-2">
            <div className="flex items-center justify-between text-xs">
              <span className="font-semibold text-slate-700 dark:text-slate-300">
                Resposta da API Mercado Livre
              </span>
              <button
                type="button"
                onClick={() => copyText(JSON.stringify(apiConsoleResponse, null, 2), 'console')}
                className="text-amber-700 dark:text-amber-400 hover:underline flex items-center gap-1 font-medium"
              >
                {copiedKey === 'console' ? <Check className="w-3 h-3 text-emerald-500" /> : <Copy className="w-3 h-3" />}
                <span>{copiedKey === 'console' ? 'Copiado' : 'Copiar Resposta'}</span>
              </button>
            </div>

            <pre className="p-3.5 bg-slate-950 rounded-lg text-emerald-400 text-[11px] font-mono overflow-x-auto max-h-72 border border-slate-800 select-all">
              {JSON.stringify(apiConsoleResponse, null, 2)}
            </pre>
          </div>
        )}
      </div>
    </div>
  );
};
