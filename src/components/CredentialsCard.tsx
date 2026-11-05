import React, { useState } from 'react';
import { Eye, EyeOff, ShieldCheck, RotateCcw, Globe, Sliders } from 'lucide-react';
import { MLConfig } from '../types/mercadolivre';

interface CredentialsCardProps {
  config: MLConfig;
  onChange: (updated: MLConfig) => void;
  onReset: () => void;
  defaultConfig: MLConfig;
}

export const CredentialsCard: React.FC<CredentialsCardProps> = ({
  config,
  onChange,
  onReset,
  defaultConfig,
}) => {
  const [showSecret, setShowSecret] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);

  const isNumericClientId = /^\d+$/.test(config.clientId);
  const isHttpsRedirect = config.redirectUri.startsWith('https://');

  const currentAppCallback = typeof window !== 'undefined'
    ? `${window.location.origin}/oauth/retorno`
    : '';

  const handleUseAppCallback = () => {
    if (currentAppCallback) {
      onChange({ ...config, redirectUri: currentAppCallback });
    }
  };

  return (
    <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 shadow-xs mb-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-slate-100 dark:border-slate-800">
        <div>
          <h2 className="text-sm font-semibold text-slate-900 dark:text-white flex items-center gap-2">
            <Sliders className="w-4 h-4 text-amber-500" />
            Credenciais do Aplicativo Mercado Livre
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            Configurações registradas no DevCenter do Mercado Livre para autorização OAuth 2.0 PKCE.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setIsExpanded(!isExpanded)}
            className="text-xs font-medium text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white px-2.5 py-1 rounded-md border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/60"
          >
            {isExpanded ? 'Recolher detalhes' : 'Editar credenciais'}
          </button>
          <button
            type="button"
            onClick={onReset}
            title="Restaurar valores padrão"
            className="text-xs text-slate-500 hover:text-slate-800 dark:hover:text-slate-300 p-1 rounded-md transition-colors"
          >
            <RotateCcw className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Summary line when collapsed */}
      {!isExpanded && (
        <div className="pt-3 flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-slate-600 dark:text-slate-400">
          <div>
            <span className="text-slate-400 dark:text-slate-500">Client ID:</span>{' '}
            <span className="font-mono font-medium text-slate-900 dark:text-slate-200 tabular-nums">
              {config.clientId || 'Não definido'}
            </span>
          </div>
          <span className="text-slate-300 dark:text-slate-700">·</span>
          <div>
            <span className="text-slate-400 dark:text-slate-500">Redirect URI:</span>{' '}
            <span className="font-mono text-slate-700 dark:text-slate-300 truncate max-w-xs inline-block align-bottom">
              {config.redirectUri}
            </span>
          </div>
          <span className="text-slate-300 dark:text-slate-700">·</span>
          <div className="flex items-center gap-1 text-emerald-600 dark:text-emerald-400 font-medium">
            <ShieldCheck className="w-3.5 h-3.5" />
            <span>PKCE S256 Ativo</span>
          </div>
        </div>
      )}

      {/* Expanded form */}
      {isExpanded && (
        <div className="pt-4 grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* CLIENT ID */}
          <div>
            <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
              Client ID (App ID)
            </label>
            <input
              type="text"
              value={config.clientId}
              onChange={(e) => onChange({ ...config, clientId: e.target.value.trim() })}
              placeholder="Ex: 1316710088175307"
              className={`w-full px-3 py-2 text-xs font-mono rounded-lg border bg-white dark:bg-slate-950 text-slate-900 dark:text-white focus:outline-hidden focus:ring-2 focus:ring-amber-400 ${
                isNumericClientId
                  ? 'border-slate-300 dark:border-slate-700'
                  : 'border-rose-400 dark:border-rose-600'
              }`}
            />
            {!isNumericClientId && (
              <p className="text-[11px] text-rose-500 mt-1">O Client ID deve conter apenas dígitos numéricos.</p>
            )}
          </div>

          {/* CLIENT SECRET */}
          <div>
            <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
              Client Secret (Chave Secreta)
            </label>
            <div className="relative">
              <input
                type={showSecret ? 'text' : 'password'}
                value={config.clientSecret}
                onChange={(e) => onChange({ ...config, clientSecret: e.target.value.trim() })}
                placeholder="Insira a chave secreta gerada no DevCenter"
                className="w-full pl-3 pr-10 py-2 text-xs font-mono rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-white focus:outline-hidden focus:ring-2 focus:ring-amber-400"
              />
              <button
                type="button"
                onClick={() => setShowSecret(!showSecret)}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200"
              >
                {showSecret ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
              </button>
            </div>
            <p className="text-[11px] text-slate-400 dark:text-slate-500 mt-1">
              Processado apenas em chamadas server-side seguras via backend.
            </p>
          </div>

          {/* REDIRECT URI */}
          <div className="md:col-span-2">
            <div className="flex items-center justify-between mb-1">
              <label className="text-xs font-medium text-slate-700 dark:text-slate-300">
                Redirect URI (URL de Retorno Cadastrada)
              </label>
              {currentAppCallback && currentAppCallback !== config.redirectUri && (
                <button
                  type="button"
                  onClick={handleUseAppCallback}
                  className="text-[11px] text-amber-600 dark:text-amber-400 hover:underline flex items-center gap-1"
                >
                  <Globe className="w-3 h-3" />
                  <span>Usar URL deste applet como retorno</span>
                </button>
              )}
            </div>
            <input
              type="text"
              value={config.redirectUri}
              onChange={(e) => onChange({ ...config, redirectUri: e.target.value.trim() })}
              placeholder="https://www.ecooy.com.br/oauth/retorno"
              className={`w-full px-3 py-2 text-xs font-mono rounded-lg border bg-white dark:bg-slate-950 text-slate-900 dark:text-white focus:outline-hidden focus:ring-2 focus:ring-amber-400 ${
                isHttpsRedirect
                  ? 'border-slate-300 dark:border-slate-700'
                  : 'border-rose-400 dark:border-rose-600'
              }`}
            />
            {!isHttpsRedirect && (
              <p className="text-[11px] text-rose-500 mt-1">
                A URL de redirecionamento do Mercado Livre precisa obrigatoriamente usar HTTPS.
              </p>
            )}
            <p className="text-[11px] text-slate-400 dark:text-slate-500 mt-1">
              IMPORTANTE: Esta URL precisa estar cadastrada com precisão exata no DevCenter do Mercado Livre.
            </p>
          </div>

          {/* PKCE TOGGLE */}
          <div className="md:col-span-2 pt-2 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <input
                id="pkce-toggle"
                type="checkbox"
                checked={config.pkceEnabled}
                onChange={(e) => onChange({ ...config, pkceEnabled: e.target.checked })}
                className="w-4 h-4 text-amber-500 rounded border-slate-300 dark:border-slate-700 focus:ring-amber-400"
              />
              <label htmlFor="pkce-toggle" className="text-xs font-medium text-slate-700 dark:text-slate-300">
                Habilitar PKCE (Proof Key for Code Exchange com SHA-256)
              </label>
            </div>
            <span className="text-[11px] text-slate-400">Recomendado e ativado por padrão</span>
          </div>
        </div>
      )}
    </div>
  );
};
