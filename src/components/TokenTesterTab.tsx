import React, { useState } from 'react';
import { UserCheck, CheckCircle2, AlertCircle, Copy, Check, ExternalLink, ShieldCheck, Mail, Calendar, Award, Star } from 'lucide-react';
import { MLUser, TokenResponse } from '../types/mercadolivre';
import { testToken } from '../services/mlApi';

interface TokenTesterTabProps {
  tokenData: TokenResponse | null;
}

export const TokenTesterTab: React.FC<TokenTesterTabProps> = ({ tokenData }) => {
  const [tokenInput, setTokenInput] = useState(tokenData?.accessToken || '');
  const [isLoading, setIsLoading] = useState(false);
  const [userProfile, setUserProfile] = useState<MLUser | null>(null);
  const [rawResponse, setRawResponse] = useState<any>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [copiedRaw, setCopiedRaw] = useState(false);

  // Sync when prop updates
  React.useEffect(() => {
    if (tokenData?.accessToken) {
      setTokenInput(tokenData.accessToken);
    }
  }, [tokenData?.accessToken]);

  const handleTest = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!tokenInput.trim()) {
      setErrorMessage('Informe um Access Token para testar.');
      return;
    }

    setIsLoading(true);
    setErrorMessage(null);
    setUserProfile(null);
    setRawResponse(null);

    try {
      const result = await testToken(tokenInput.trim());
      if (result.valid && result.user) {
        setUserProfile(result.user);
        setRawResponse(result.raw);
      } else {
        setErrorMessage(result.error || `Token inválido ou recusado (Status HTTP ${result.status})`);
        setRawResponse(result.raw);
      }
    } catch (err: any) {
      setErrorMessage(err.message || 'Erro ao conectar à API do Mercado Livre.');
    } finally {
      setIsLoading(false);
    }
  };

  const copyRawJson = () => {
    if (rawResponse) {
      navigator.clipboard.writeText(JSON.stringify(rawResponse, null, 2));
      setCopiedRaw(true);
      setTimeout(() => setCopiedRaw(false), 2000);
    }
  };

  return (
    <div className="space-y-6">
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-6 shadow-xs">
        <div className="mb-6 pb-4 border-b border-slate-100 dark:border-slate-800">
          <h2 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <UserCheck className="w-4 h-4 text-amber-500" />
            Teste de Autenticação na API (/users/me)
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            Valide se o seu Access Token possui permissões ativas e consulte os dados cadastrais da conta autenticada no Mercado Livre.
          </p>
        </div>

        <form onSubmit={handleTest} className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
              Access Token a Ser Testado
            </label>
            <input
              type="text"
              value={tokenInput}
              onChange={(e) => setTokenInput(e.target.value.trim())}
              placeholder="Cole o access_token (ex: APP_USR-1316710088175307-...)"
              className="w-full px-3.5 py-2.5 text-xs font-mono bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white focus:outline-hidden focus:ring-2 focus:ring-amber-400"
            />
          </div>

          <button
            type="submit"
            disabled={isLoading || !tokenInput.trim()}
            className={`px-5 py-2.5 text-xs font-bold rounded-lg flex items-center gap-2 transition-all shadow-xs ${
              isLoading || !tokenInput.trim()
                ? 'bg-slate-100 dark:bg-slate-800 text-slate-400 cursor-not-allowed'
                : 'bg-slate-900 text-white dark:bg-amber-400 dark:text-slate-950 hover:bg-slate-800 dark:hover:bg-amber-300'
            }`}
          >
            <UserCheck className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
            <span>{isLoading ? 'Verificando com a API...' : 'Executar Teste /users/me'}</span>
          </button>
        </form>

        {errorMessage && (
          <div className="mt-6 p-4 rounded-lg bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900 text-rose-800 dark:text-rose-200 text-xs flex items-start gap-2.5">
            <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
            <div className="space-y-1">
              <span className="font-semibold block">Falha na Verificação do Token</span>
              <span>{errorMessage}</span>
            </div>
          </div>
        )}

        {/* Profile Card if valid */}
        {userProfile && (
          <div className="mt-6 pt-6 border-t border-slate-100 dark:border-slate-800 space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-emerald-600 dark:text-emerald-400 text-xs font-semibold">
                <CheckCircle2 className="w-4 h-4" />
                <span>Token Válido e Autorizado pelo Mercado Livre!</span>
              </div>
              {userProfile.permalink && (
                <a
                  href={userProfile.permalink}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs text-amber-600 dark:text-amber-400 hover:underline flex items-center gap-1 font-medium"
                >
                  <span>Ver perfil no Mercado Livre</span>
                  <ExternalLink className="w-3 h-3" />
                </a>
              )}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
              <div className="p-3.5 rounded-lg bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800">
                <span className="text-[11px] text-slate-400 block mb-0.5">Apelido (Nickname)</span>
                <span className="text-sm font-bold text-slate-900 dark:text-white">
                  {userProfile.nickname}
                </span>
              </div>

              <div className="p-3.5 rounded-lg bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800">
                <span className="text-[11px] text-slate-400 block mb-0.5">User ID</span>
                <span className="text-sm font-mono font-bold text-slate-900 dark:text-white tabular-nums">
                  {userProfile.id}
                </span>
              </div>

              <div className="p-3.5 rounded-lg bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800">
                <span className="text-[11px] text-slate-400 block mb-0.5">Site / País</span>
                <span className="text-sm font-bold text-slate-900 dark:text-white">
                  {userProfile.siteId === 'MLB' ? 'Brasil (MLB)' : userProfile.siteId}
                </span>
              </div>

              <div className="p-3.5 rounded-lg bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800">
                <span className="text-[11px] text-slate-400 block mb-0.5">Pontos / Nível</span>
                <span className="text-sm font-bold text-slate-900 dark:text-white tabular-nums">
                  {userProfile.points ?? '—'} pts
                </span>
              </div>
            </div>

            {/* Email & Registration if available */}
            <div className="flex flex-wrap items-center gap-x-6 gap-y-2 text-xs text-slate-600 dark:text-slate-400 pt-2">
              {userProfile.email && (
                <div className="flex items-center gap-1.5">
                  <Mail className="w-3.5 h-3.5 text-slate-400" />
                  <span>E-mail:</span>
                  <span className="font-medium text-slate-900 dark:text-slate-200">{userProfile.email}</span>
                </div>
              )}
              {userProfile.registrationDate && (
                <div className="flex items-center gap-1.5">
                  <Calendar className="w-3.5 h-3.5 text-slate-400" />
                  <span>Cadastrado em:</span>
                  <span className="font-medium text-slate-900 dark:text-slate-200">
                    {new Date(userProfile.registrationDate).toLocaleDateString('pt-BR')}
                  </span>
                </div>
              )}
              {userProfile.sellerReputation?.power_seller_status && (
                <div className="flex items-center gap-1.5 text-amber-600 dark:text-amber-400 font-semibold">
                  <Star className="w-3.5 h-3.5" />
                  <span>MercadoLíder: {userProfile.sellerReputation.power_seller_status}</span>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Raw JSON inspector */}
        {rawResponse && (
          <div className="mt-6 pt-6 border-t border-slate-100 dark:border-slate-800 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                Resposta Completa da API Mercado Livre
              </span>
              <button
                type="button"
                onClick={copyRawJson}
                className="text-xs text-amber-700 dark:text-amber-400 hover:text-amber-800 flex items-center gap-1"
              >
                {copiedRaw ? <Check className="w-3 h-3 text-emerald-500" /> : <Copy className="w-3 h-3" />}
                <span>{copiedRaw ? 'Copiado!' : 'Copiar JSON'}</span>
              </button>
            </div>
            <pre className="p-3.5 bg-slate-950 rounded-lg text-emerald-400 text-[11px] font-mono overflow-x-auto max-h-72 border border-slate-800 select-all">
              {JSON.stringify(rawResponse, null, 2)}
            </pre>
          </div>
        )}
      </div>
    </div>
  );
};
