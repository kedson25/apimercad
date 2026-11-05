import React, { useState } from 'react';
import { RefreshCw, CheckCircle2, AlertCircle, Clock, Info, ShieldCheck } from 'lucide-react';
import { MLConfig, TokenResponse } from '../types/mercadolivre';
import { refreshAccessToken } from '../services/mlApi';
import { TokenDisplayCard } from './TokenDisplayCard';

interface TokenRefreshTabProps {
  config: MLConfig;
  tokenData: TokenResponse | null;
  onTokensUpdated: (data: TokenResponse) => void;
  onTestNow: () => void;
  onExportEnv: () => void;
}

export const TokenRefreshTab: React.FC<TokenRefreshTabProps> = ({
  config,
  tokenData,
  onTokensUpdated,
  onTestNow,
  onExportEnv,
}) => {
  const [refreshTokenInput, setRefreshTokenInput] = useState(tokenData?.refreshToken || '');
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Sync if prop updates
  React.useEffect(() => {
    if (tokenData?.refreshToken) {
      setRefreshTokenInput(tokenData.refreshToken);
    }
  }, [tokenData?.refreshToken]);

  const handleRefresh = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!refreshTokenInput.trim()) {
      setErrorMessage('Informe o Refresh Token para renovar.');
      return;
    }

    setIsRefreshing(true);
    setErrorMessage(null);
    setSuccessMessage(null);

    try {
      const refreshed = await refreshAccessToken({
        clientId: config.clientId,
        clientSecret: config.clientSecret,
        refreshToken: refreshTokenInput.trim(),
      });

      onTokensUpdated(refreshed);
      setSuccessMessage('Tokens renovados com sucesso! O novo access_token já está ativo.');
    } catch (err: any) {
      setErrorMessage(err.message || 'Erro ao renovar token.');
    } finally {
      setIsRefreshing(false);
    }
  };

  return (
    <div className="space-y-6">
      {tokenData && (
        <TokenDisplayCard
          tokenData={tokenData}
          onRefreshNow={() => handleRefresh({ preventDefault: () => {} } as any)}
          onTestNow={onTestNow}
          onExportEnv={onExportEnv}
          isRefreshing={isRefreshing}
        />
      )}

      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-6 shadow-xs">
        <div className="mb-6 pb-4 border-b border-slate-100 dark:border-slate-800">
          <h2 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <RefreshCw className="w-4 h-4 text-amber-500" />
            Renovar Tokens (Refresh Flow)
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            Gere novos tokens de acesso válidos sem que o usuário precise fazer login novamente no Mercado Livre.
          </p>
        </div>

        {errorMessage && (
          <div className="mb-6 p-4 rounded-lg bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900 text-rose-800 dark:text-rose-200 text-xs flex items-start gap-2.5">
            <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
            <div className="space-y-1">
              <span className="font-semibold block">Erro na Renovação</span>
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

        <form onSubmit={handleRefresh} className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
              ML_REFRESH_TOKEN Atual
            </label>
            <input
              type="text"
              value={refreshTokenInput}
              onChange={(e) => setRefreshTokenInput(e.target.value.trim())}
              placeholder="Cole o refresh_token salvo (ex: TG-67290...)"
              className="w-full px-3.5 py-2.5 text-xs font-mono bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white focus:outline-hidden focus:ring-2 focus:ring-amber-400"
            />
          </div>

          <div className="p-3.5 rounded-lg bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800/50 text-xs text-amber-900 dark:text-amber-300 space-y-1">
            <div className="font-semibold flex items-center gap-1.5">
              <Info className="w-3.5 h-3.5 text-amber-600" />
              <span>Rotação Obrigatória de Refresh Token:</span>
            </div>
            <p className="text-[11px] leading-relaxed text-amber-800 dark:text-amber-400">
              Cada renovação gera tanto um novo <code>access_token</code> quanto um novo <code>refresh_token</code>. O refresh token anterior é descartado imediatamente pela API do Mercado Livre. Salve sempre o novo par no seu <code>.env</code> ou banco de dados!
            </p>
          </div>

          <div className="pt-2">
            <button
              type="submit"
              disabled={isRefreshing || !refreshTokenInput.trim()}
              className={`px-5 py-2.5 text-xs font-bold rounded-lg flex items-center gap-2 transition-all shadow-xs ${
                isRefreshing || !refreshTokenInput.trim()
                  ? 'bg-slate-100 dark:bg-slate-800 text-slate-400 cursor-not-allowed'
                  : 'bg-amber-400 hover:bg-amber-300 text-slate-950'
              }`}
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin' : ''}`} />
              <span>{isRefreshing ? 'Renovando Token...' : 'Renovar Token Agora'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
