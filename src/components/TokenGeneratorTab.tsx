import React, { useState, useEffect } from 'react';
import {
  ExternalLink,
  Copy,
  Check,
  ArrowRight,
  ShieldCheck,
  AlertCircle,
  Sparkles,
  Link as LinkIcon,
  CheckCircle2,
  Lock,
  Globe,
  Zap,
} from 'lucide-react';
import { AuthUrlResponse, MLConfig, TokenResponse } from '../types/mercadolivre';
import { createAuthUrl, exchangeToken } from '../services/mlApi';
import { TokenDisplayCard } from './TokenDisplayCard';

interface TokenGeneratorTabProps {
  config: MLConfig;
  onConfigChange: (updated: MLConfig) => void;
  tokenData: TokenResponse | null;
  onTokensGenerated: (data: TokenResponse) => void;
  onRefreshNow: () => void;
  onTestNow: () => void;
  onExportEnv: () => void;
  isRefreshing: boolean;
  autoExchangeSuccess?: string | null;
  autoExchangeError?: string | null;
  isAutoExchanging?: boolean;
}

export const TokenGeneratorTab: React.FC<TokenGeneratorTabProps> = ({
  config,
  onConfigChange,
  tokenData,
  onTokensGenerated,
  onRefreshNow,
  onTestNow,
  onExportEnv,
  isRefreshing,
  autoExchangeSuccess,
  autoExchangeError,
  isAutoExchanging,
}) => {
  const [authData, setAuthData] = useState<AuthUrlResponse | null>(null);
  const [isGeneratingUrl, setIsGeneratingUrl] = useState(false);
  const [copiedUrl, setCopiedUrl] = useState(false);
  const [copiedRedirectUri, setCopiedRedirectUri] = useState(false);
  const [callbackInput, setCallbackInput] = useState('');
  const [isExchanging, setIsExchanging] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [autoExchangeOnPaste, setAutoExchangeOnPaste] = useState(true);

  const ownSiteCallbackUri = typeof window !== 'undefined'
    ? `${window.location.origin}/oauth/retorno`
    : '';

  const isUsingOwnUrl = ownSiteCallbackUri && config.redirectUri === ownSiteCallbackUri;

  // Real-time parser for user paste input
  const parsedCodeInfo = React.useMemo(() => {
    const raw = callbackInput.trim();
    if (!raw) return null;

    if (raw.startsWith('http://') || raw.startsWith('https://')) {
      try {
        const url = new URL(raw);
        const code = url.searchParams.get('code');
        const state = url.searchParams.get('state');
        const error = url.searchParams.get('error') || url.searchParams.get('error_description');

        const stateMatch = authData ? state === authData.state : null;

        return {
          isUrl: true,
          code,
          state,
          stateMatch,
          error,
          isValid: Boolean(code && !error),
        };
      } catch {
        return { isUrl: true, code: null, state: null, error: 'URL malformada', isValid: false };
      }
    }

    return {
      isUrl: false,
      code: raw,
      state: null,
      stateMatch: null,
      error: null,
      isValid: raw.length > 5,
    };
  }, [callbackInput, authData]);

  // Step 1: Create Auth URL
  const handleCreateAuthUrl = async (overrideRedirect?: string) => {
    setIsGeneratingUrl(true);
    setErrorMessage(null);
    setSuccessMessage(null);
    try {
      const targetRedirect = overrideRedirect || config.redirectUri;
      const data = await createAuthUrl({
        clientId: config.clientId,
        redirectUri: targetRedirect,
        pkceEnabled: config.pkceEnabled,
      });
      setAuthData(data);

      // Save to sessionStorage so even after redirect we have the verifier
      try {
        sessionStorage.setItem(
          'ml_active_oauth_session',
          JSON.stringify({
            state: data.state,
            verifier: data.verifier,
            challenge: data.challenge,
            redirectUri: data.redirectUri,
            clientId: data.clientId,
          })
        );
      } catch {}

      setSuccessMessage('URL de autorização gerada com sucesso! Clique em "Abrir no Mercado Livre".');
      return data;
    } catch (err: any) {
      setErrorMessage(err.message || 'Erro ao gerar URL');
      return null;
    } finally {
      setIsGeneratingUrl(false);
    }
  };

  const handleCopyUrl = () => {
    if (authData?.authUrl) {
      navigator.clipboard.writeText(authData.authUrl);
      setCopiedUrl(true);
      setTimeout(() => setCopiedUrl(false), 2000);
    }
  };

  const handleCopyRedirectUri = (uri: string) => {
    navigator.clipboard.writeText(uri);
    setCopiedRedirectUri(true);
    setTimeout(() => setCopiedRedirectUri(false), 2000);
  };

  // Perform exchange
  const executeExchange = async (codeToUse: string) => {
    if (!codeToUse.trim()) return;
    setIsExchanging(true);
    setErrorMessage(null);
    setSuccessMessage(null);

    try {
      let sessionVerifier = authData?.verifier;
      let sessionRedirect = authData?.redirectUri || config.redirectUri;

      try {
        const savedSession = sessionStorage.getItem('ml_active_oauth_session');
        if (savedSession) {
          const parsed = JSON.parse(savedSession);
          if (!sessionVerifier) sessionVerifier = parsed.verifier;
          if (!sessionRedirect) sessionRedirect = parsed.redirectUri;
        }
      } catch {}

      const tokens = await exchangeToken({
        clientId: config.clientId,
        clientSecret: config.clientSecret,
        redirectUri: sessionRedirect,
        code: codeToUse.trim(),
        codeVerifier: sessionVerifier,
        expectedState: authData?.state,
      });

      onTokensGenerated(tokens);
      setSuccessMessage('Tokens gerados e validados com sucesso pelo Mercado Livre!');
      setCallbackInput('');
    } catch (err: any) {
      setErrorMessage(err.message || 'Erro ao trocar código por tokens.');
    } finally {
      setIsExchanging(false);
    }
  };

  // Auto exchange when user pastes URL/code if toggle is on
  const handleInputChange = (val: string) => {
    setCallbackInput(val);
    const trimmed = val.trim();

    if (autoExchangeOnPaste && trimmed.length > 10) {
      if (trimmed.includes('code=') || trimmed.startsWith('TG-')) {
        // Auto trigger after brief debounce
        setTimeout(() => {
          executeExchange(trimmed);
        }, 300);
      }
    }
  };

  // 1-Click Authorize with Own URL
  const handleAuthorizeWithOwnUrl = async () => {
    if (!isUsingOwnUrl && ownSiteCallbackUri) {
      onConfigChange({ ...config, redirectUri: ownSiteCallbackUri });
    }
    const generated = await handleCreateAuthUrl(ownSiteCallbackUri);
    if (generated?.authUrl) {
      // Redirect or open window
      window.location.href = generated.authUrl;
    }
  };

  return (
    <div className="space-y-6">
      {/* If tokens were already generated, display current tokens at the top */}
      {tokenData && (
        <TokenDisplayCard
          tokenData={tokenData}
          onRefreshNow={onRefreshNow}
          onTestNow={onTestNow}
          onExportEnv={onExportEnv}
          isRefreshing={isRefreshing}
        />
      )}

      {/* Auto-exchange loader or banner */}
      {isAutoExchanging && (
        <div className="p-4 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-900 dark:text-amber-200 text-xs flex items-center gap-3">
          <div className="w-5 h-5 border-2 border-amber-500 border-t-transparent rounded-full animate-spin shrink-0" />
          <div>
            <span className="font-bold block">Mercado Livre retornou para esta URL!</span>
            <span>Trocando código de autorização por Access Token e Refresh Token automaticamente...</span>
          </div>
        </div>
      )}

      {autoExchangeSuccess && (
        <div className="p-4 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-900 text-emerald-800 dark:text-emerald-200 text-xs flex items-center gap-2.5">
          <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
          <span>{autoExchangeSuccess}</span>
        </div>
      )}

      {autoExchangeError && (
        <div className="p-4 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900 text-rose-800 dark:text-rose-200 text-xs flex items-start gap-2.5">
          <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
          <div>
            <span className="font-bold block">Falha no Retorno Automático</span>
            <span>{autoExchangeError}</span>
          </div>
        </div>
      )}

      {/* Choose Mode Banner: Própria URL vs Site Aleatório */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 shadow-xs">
        <h3 className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-3">
          Escolha como deseja obter seu token
        </h3>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* OPTION 1: Própria URL deste site */}
          <div
            onClick={() => {
              if (ownSiteCallbackUri) {
                onConfigChange({ ...config, redirectUri: ownSiteCallbackUri });
              }
            }}
            className={`p-4 rounded-xl border text-left cursor-pointer transition-all ${
              isUsingOwnUrl
                ? 'border-amber-400 bg-amber-500/5 dark:bg-amber-400/5 shadow-xs ring-1 ring-amber-400'
                : 'border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700 bg-slate-50/50 dark:bg-slate-950/50'
            }`}
          >
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-lg bg-amber-400 text-slate-950 flex items-center justify-center font-bold">
                  <Zap className="w-4 h-4" />
                </div>
                <span className="text-sm font-bold text-slate-900 dark:text-white">
                  1. Usar URL Própria Deste Site
                </span>
              </div>
              <span className="text-[11px] font-semibold text-amber-600 dark:text-amber-400">
                100% Automático
              </span>
            </div>

            <p className="text-xs text-slate-600 dark:text-slate-400 mb-3 leading-relaxed">
              O Mercado Livre redireciona de volta para esta mesma página. O site captura o código, gera e <strong>mostra o token na tela automaticamente</strong>!
            </p>

            <div className="space-y-2">
              <div className="flex items-center justify-between text-[11px] text-slate-500">
                <span>URL a cadastrar no DevCenter:</span>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleCopyRedirectUri(ownSiteCallbackUri);
                  }}
                  className="text-amber-600 dark:text-amber-400 hover:underline flex items-center gap-1 font-medium"
                >
                  {copiedRedirectUri ? <Check className="w-3 h-3 text-emerald-500" /> : <Copy className="w-3 h-3" />}
                  <span>{copiedRedirectUri ? 'Copiado!' : 'Copiar URL'}</span>
                </button>
              </div>

              <div className="p-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-md text-[11px] font-mono text-slate-800 dark:text-slate-200 break-all select-all">
                {ownSiteCallbackUri}
              </div>

              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  handleAuthorizeWithOwnUrl();
                }}
                disabled={isGeneratingUrl}
                className="w-full mt-2 py-2 px-3 bg-amber-400 hover:bg-amber-300 text-slate-950 font-bold rounded-lg text-xs transition-colors flex items-center justify-center gap-2 shadow-xs"
              >
                <Lock className="w-3.5 h-3.5" />
                <span>Autorizar com URL Própria (Gera e Mostra na Tela)</span>
              </button>
            </div>
          </div>

          {/* OPTION 2: Site Aleatório / URL Externa (ex: ecooy.com.br) */}
          <div
            onClick={() => {
              if (isUsingOwnUrl) {
                onConfigChange({ ...config, redirectUri: 'https://www.ecooy.com.br/oauth/retorno' });
              }
            }}
            className={`p-4 rounded-xl border text-left cursor-pointer transition-all ${
              !isUsingOwnUrl
                ? 'border-amber-400 bg-amber-500/5 dark:bg-amber-400/5 shadow-xs ring-1 ring-amber-400'
                : 'border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700 bg-slate-50/50 dark:bg-slate-950/50'
            }`}
          >
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-lg bg-slate-200 dark:bg-slate-800 text-slate-800 dark:text-slate-200 flex items-center justify-center font-bold">
                  <Globe className="w-4 h-4" />
                </div>
                <span className="text-sm font-bold text-slate-900 dark:text-white">
                  2. Usar Site Aleatório / Externo
                </span>
              </div>
              <span className="text-[11px] text-slate-500">ecooy.com.br, etc.</span>
            </div>

            <p className="text-xs text-slate-600 dark:text-slate-400 mb-3 leading-relaxed">
              Use qualquer site aleatório HTTPS cadastrado no DevCenter (mesmo que dê erro 404). Após autorizar, basta colar o link completo aqui que <strong>o token é gerado imediatamente</strong>.
            </p>

            <div className="space-y-2">
              <div className="text-[11px] text-slate-500">Sua Redirect URI atual cadastrada:</div>
              <input
                type="text"
                value={config.redirectUri}
                onChange={(e) => onConfigChange({ ...config, redirectUri: e.target.value.trim() })}
                onClick={(e) => e.stopPropagation()}
                placeholder="https://www.ecooy.com.br/oauth/retorno"
                className="w-full px-2.5 py-1.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-md text-[11px] font-mono text-slate-800 dark:text-slate-200"
              />
              <p className="text-[10px] text-slate-400">
                Se a página do outro site der 404, não tem problema: a URL da barra de endereços contém o código!
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Main Flow Card */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-6 shadow-xs">
        <div className="mb-6 pb-4 border-b border-slate-100 dark:border-slate-800">
          <h2 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-amber-500" />
            Passo a Passo de Geração do Token
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            Redirect URI ativa no momento:{' '}
            <code className="font-mono bg-slate-100 dark:bg-slate-800 px-1 py-0.5 rounded text-amber-600 dark:text-amber-400">
              {config.redirectUri}
            </code>
          </p>
        </div>

        {/* Status / Alert notifications */}
        {errorMessage && (
          <div className="mb-6 p-4 rounded-lg bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900 text-rose-800 dark:text-rose-200 text-xs flex items-start gap-2.5">
            <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
            <div className="space-y-1">
              <span className="font-semibold block">Erro na Autorização</span>
              <span>{errorMessage}</span>
            </div>
          </div>
        )}

        {successMessage && (
          <div className="mb-6 p-4 rounded-lg bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-900 text-emerald-800 dark:text-emerald-200 text-xs flex items-center gap-2.5">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>{successMessage}</span>
          </div>
        )}

        <div className="space-y-8">
          {/* STEP 1 */}
          <div className="relative pl-8 before:absolute before:left-3 before:top-8 before:bottom-0 before:w-px before:bg-slate-200 dark:before:bg-slate-800">
            <div className="absolute left-0 top-0 w-6 h-6 rounded-full bg-slate-900 text-white dark:bg-amber-400 dark:text-slate-950 text-xs font-bold flex items-center justify-center">
              1
            </div>

            <div>
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-2">
                <div>
                  <h3 className="text-sm font-semibold text-slate-900 dark:text-white">
                    Gerar URL e Abrir no Mercado Livre
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    Cria o link oficial com PKCE SHA-256 e abre a tela de login/autorização.
                  </p>
                </div>

                <button
                  type="button"
                  onClick={() => handleCreateAuthUrl()}
                  disabled={isGeneratingUrl}
                  className="px-4 py-2 text-xs font-semibold rounded-lg bg-amber-400 text-slate-950 hover:bg-amber-300 transition-colors shadow-xs flex items-center justify-center gap-2 whitespace-nowrap"
                >
                  <Lock className="w-3.5 h-3.5" />
                  <span>{isGeneratingUrl ? 'Gerando Link...' : 'Gerar Link de Autorização'}</span>
                </button>
              </div>

              {authData && (
                <div className="mt-4 p-4 rounded-lg bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 space-y-3">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <span className="text-xs font-medium text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                      <LinkIcon className="w-3.5 h-3.5 text-amber-500" />
                      <span>Link Pronto para Autorizar:</span>
                    </span>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={handleCopyUrl}
                        className="px-2.5 py-1 text-xs font-medium rounded-md bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-100 flex items-center gap-1"
                      >
                        {copiedUrl ? <Check className="w-3 h-3 text-emerald-500" /> : <Copy className="w-3 h-3" />}
                        <span>{copiedUrl ? 'Copiado!' : 'Copiar Link'}</span>
                      </button>

                      <a
                        href={authData.authUrl}
                        target={isUsingOwnUrl ? '_self' : '_blank'}
                        rel="noopener noreferrer"
                        className="px-3.5 py-1.5 text-xs font-semibold rounded-md bg-slate-900 text-white dark:bg-white dark:text-slate-900 hover:bg-slate-800 transition-colors flex items-center gap-1.5 shadow-xs"
                      >
                        <span>Abrir no Mercado Livre</span>
                        <ExternalLink className="w-3 h-3" />
                      </a>
                    </div>
                  </div>

                  <div className="p-2.5 bg-white dark:bg-slate-900 rounded-md border border-slate-200 dark:border-slate-800 text-[11px] font-mono text-slate-600 dark:text-slate-400 break-all select-all">
                    {authData.authUrl}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* STEP 2 */}
          <div className="relative pl-8">
            <div className="absolute left-0 top-0 w-6 h-6 rounded-full bg-slate-900 text-white dark:bg-amber-400 dark:text-slate-950 text-xs font-bold flex items-center justify-center">
              2
            </div>

            <div>
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-1">
                <h3 className="text-sm font-semibold text-slate-900 dark:text-white">
                  Colar URL de Retorno (Geração Imediata)
                </h3>
                <label className="flex items-center gap-2 text-xs text-slate-600 dark:text-slate-400 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={autoExchangeOnPaste}
                    onChange={(e) => setAutoExchangeOnPaste(e.target.checked)}
                    className="w-3.5 h-3.5 text-amber-500 rounded border-slate-300 dark:border-slate-700 focus:ring-amber-400"
                  />
                  <span>Trocar e mostrar token automaticamente ao colar</span>
                </label>
              </div>

              <p className="text-xs text-slate-500 dark:text-slate-400 mb-3">
                Cole a URL inteira da barra de endereços (mesmo que a página dê 404) ou apenas o código <code>TG-...</code>.
              </p>

              <div className="space-y-3">
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={callbackInput}
                    onChange={(e) => handleInputChange(e.target.value)}
                    placeholder="Ex: https://www.ecooy.com.br/oauth/retorno?code=TG-67290fa... ou https://.../oauth/retorno?code=TG-..."
                    className="flex-1 px-3.5 py-2.5 text-xs font-mono bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white focus:outline-hidden focus:ring-2 focus:ring-amber-400"
                  />
                  <button
                    type="button"
                    onClick={() => executeExchange(callbackInput)}
                    disabled={isExchanging || !callbackInput.trim()}
                    className={`px-4 py-2.5 text-xs font-bold rounded-lg flex items-center gap-1.5 transition-all shadow-xs shrink-0 ${
                      isExchanging || !callbackInput.trim()
                        ? 'bg-slate-100 dark:bg-slate-800 text-slate-400 cursor-not-allowed'
                        : 'bg-emerald-600 hover:bg-emerald-500 text-white'
                    }`}
                  >
                    <span>{isExchanging ? 'Gerando...' : 'Gerar e Mostrar Token'}</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                </div>

                {/* Real-time parse feedback */}
                {parsedCodeInfo && (
                  <div className="p-3 rounded-md bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-xs space-y-1.5">
                    {parsedCodeInfo.error ? (
                      <div className="text-rose-600 dark:text-rose-400 flex items-center gap-1.5">
                        <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                        <span>Aviso do Mercado Livre: {parsedCodeInfo.error}</span>
                      </div>
                    ) : parsedCodeInfo.code ? (
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                          <span className="text-emerald-700 dark:text-emerald-400 font-medium">
                            Código detectado:
                          </span>
                          <span className="font-mono text-slate-800 dark:text-slate-200">
                            {parsedCodeInfo.code.slice(0, 20)}...
                          </span>
                        </div>
                        {parsedCodeInfo.state && (
                          <div className="text-[11px] text-slate-500">
                            State: <span className="font-mono text-slate-700 dark:text-slate-300">{parsedCodeInfo.state.slice(0, 10)}...</span>
                          </div>
                        )}
                      </div>
                    ) : (
                      <span className="text-slate-400">
                        Insira a URL que contém o parâmetro <code>code=</code>.
                      </span>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
