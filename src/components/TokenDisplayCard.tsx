import React, { useState, useEffect } from 'react';
import { Copy, Check, Eye, EyeOff, Clock, ShieldCheck, UserCheck, RefreshCw, Download, FileCode2 } from 'lucide-react';
import { TokenResponse } from '../types/mercadolivre';

interface TokenDisplayCardProps {
  tokenData: TokenResponse;
  onRefreshNow?: () => void;
  onTestNow?: () => void;
  onExportEnv?: () => void;
  isRefreshing?: boolean;
}

export const TokenDisplayCard: React.FC<TokenDisplayCardProps> = ({
  tokenData,
  onRefreshNow,
  onTestNow,
  onExportEnv,
  isRefreshing = false,
}) => {
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [showAccessToken, setShowAccessToken] = useState(false);
  const [showRefreshToken, setShowRefreshToken] = useState(false);
  const [timeLeft, setTimeLeft] = useState<number | null>(null);

  // Expiration countdown
  useEffect(() => {
    if (!tokenData.expiresAt) return;

    const updateTimer = () => {
      const remaining = Math.max(0, Math.floor((tokenData.expiresAt! - Date.now()) / 1000));
      setTimeLeft(remaining);
    };

    updateTimer();
    const interval = setInterval(updateTimer, 1000);
    return () => clearInterval(interval);
  }, [tokenData.expiresAt]);

  const copyToClipboard = (text: string, key: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 2000);
  };

  const formatCountdown = (totalSeconds: number) => {
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;
    return `${hours.toString().padStart(2, '0')}h ${minutes.toString().padStart(2, '0')}m ${seconds.toString().padStart(2, '0')}s`;
  };

  const isExpired = timeLeft !== null && timeLeft <= 0;

  return (
    <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 shadow-xs">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-slate-100 dark:border-slate-800">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center font-bold">
            <ShieldCheck className="w-4 h-4" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-slate-900 dark:text-white">
              Tokens OAuth 2.0 Gerados
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Credenciais de acesso prontas para consumo na API do Mercado Livre
            </p>
          </div>
        </div>

        {/* Quick action buttons */}
        <div className="flex items-center gap-2 flex-wrap">
          {onTestNow && (
            <button
              type="button"
              onClick={onTestNow}
              className="px-3 py-1.5 text-xs font-medium rounded-md bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors flex items-center gap-1.5"
            >
              <UserCheck className="w-3.5 h-3.5 text-amber-500" />
              <span>Testar /users/me</span>
            </button>
          )}

          {tokenData.refreshToken && onRefreshNow && (
            <button
              type="button"
              onClick={onRefreshNow}
              disabled={isRefreshing}
              className="px-3 py-1.5 text-xs font-medium rounded-md bg-amber-400/20 text-amber-900 dark:text-amber-300 hover:bg-amber-400/30 transition-colors flex items-center gap-1.5 border border-amber-400/30"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin' : ''}`} />
              <span>{isRefreshing ? 'Renovando...' : 'Renovar Token'}</span>
            </button>
          )}

          {onExportEnv && (
            <button
              type="button"
              onClick={onExportEnv}
              className="px-3 py-1.5 text-xs font-medium rounded-md bg-slate-900 text-white dark:bg-slate-800 dark:text-slate-200 hover:bg-slate-800 transition-colors flex items-center gap-1.5"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Baixar .env</span>
            </button>
          )}
        </div>
      </div>

      <div className="mt-4 space-y-4">
        {/* ACCESS TOKEN */}
        <div>
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-xs font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
              <span>ACCESS_TOKEN (Token de Acesso)</span>
              <span className="text-[11px] text-slate-400 font-normal">
                ({tokenData.accessToken.length} caracteres · Tipo: {tokenData.tokenType || 'Bearer'})
              </span>
            </span>
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => setShowAccessToken(!showAccessToken)}
                className="text-xs text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 px-2 py-0.5 rounded-sm flex items-center gap-1"
              >
                {showAccessToken ? <EyeOff className="w-3 h-3" /> : <Eye className="w-3 h-3" />}
                <span>{showAccessToken ? 'Ocultar' : 'Revelar'}</span>
              </button>
              <button
                type="button"
                onClick={() => copyToClipboard(tokenData.accessToken, 'access_token')}
                className="text-xs font-medium text-amber-700 dark:text-amber-400 hover:text-amber-800 dark:hover:text-amber-300 px-2 py-0.5 rounded-sm flex items-center gap-1"
              >
                {copiedKey === 'access_token' ? (
                  <>
                    <Check className="w-3 h-3 text-emerald-500" />
                    <span className="text-emerald-600 dark:text-emerald-400">Copiado!</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-3 h-3" />
                    <span>Copiar</span>
                  </>
                )}
              </button>
            </div>
          </div>

          <div className="relative">
            <input
              type={showAccessToken ? 'text' : 'password'}
              readOnly
              value={tokenData.accessToken}
              className="w-full px-3 py-2 text-xs font-mono bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg text-slate-900 dark:text-emerald-400 select-all"
            />
          </div>
        </div>

        {/* REFRESH TOKEN */}
        {tokenData.refreshToken && (
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-xs font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                <span>REFRESH_TOKEN (Token de Renovação)</span>
                <span className="text-[11px] text-slate-400 font-normal">
                  (Use para gerar novo access_token quando expirar)
                </span>
              </span>
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => setShowRefreshToken(!showRefreshToken)}
                  className="text-xs text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 px-2 py-0.5 rounded-sm flex items-center gap-1"
                >
                  {showRefreshToken ? <EyeOff className="w-3 h-3" /> : <Eye className="w-3 h-3" />}
                  <span>{showRefreshToken ? 'Ocultar' : 'Revelar'}</span>
                </button>
                <button
                  type="button"
                  onClick={() => copyToClipboard(tokenData.refreshToken!, 'refresh_token')}
                  className="text-xs font-medium text-amber-700 dark:text-amber-400 hover:text-amber-800 dark:hover:text-amber-300 px-2 py-0.5 rounded-sm flex items-center gap-1"
                >
                  {copiedKey === 'refresh_token' ? (
                    <>
                      <Check className="w-3 h-3 text-emerald-500" />
                      <span className="text-emerald-600 dark:text-emerald-400">Copiado!</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-3 h-3" />
                      <span>Copiar</span>
                    </>
                  )}
                </button>
              </div>
            </div>

            <input
              type={showRefreshToken ? 'text' : 'password'}
              readOnly
              value={tokenData.refreshToken}
              className="w-full px-3 py-2 text-xs font-mono bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg text-slate-900 dark:text-amber-400 select-all"
            />
          </div>
        )}

        {/* METADATA BAR (Expires in, user id, scope) */}
        <div className="pt-3 border-t border-slate-100 dark:border-slate-800/80 flex flex-wrap items-center justify-between gap-y-2 text-xs">
          <div className="flex items-center gap-2">
            <Clock className={`w-3.5 h-3.5 ${isExpired ? 'text-rose-500' : 'text-amber-500'}`} />
            <span className="text-slate-500 dark:text-slate-400">Validade do Token:</span>
            {timeLeft !== null ? (
              <span
                className={`font-mono font-semibold tabular-nums ${
                  isExpired
                    ? 'text-rose-600 dark:text-rose-400'
                    : timeLeft < 1800
                    ? 'text-amber-600 dark:text-amber-400'
                    : 'text-slate-900 dark:text-white'
                }`}
              >
                {isExpired ? 'Expirado' : formatCountdown(timeLeft)}
              </span>
            ) : (
              <span className="text-slate-400">6 horas (~21600 segundos)</span>
            )}
          </div>

          <div className="flex items-center gap-4 text-slate-500 dark:text-slate-400">
            {tokenData.userId && (
              <div>
                <span>User ID:</span>{' '}
                <span className="font-mono font-medium text-slate-800 dark:text-slate-200 tabular-nums">
                  {tokenData.userId}
                </span>
              </div>
            )}
            {tokenData.scope && (
              <div>
                <span>Escopo:</span>{' '}
                <span className="font-mono text-slate-800 dark:text-slate-200">{tokenData.scope}</span>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
