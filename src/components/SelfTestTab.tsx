import React, { useState } from 'react';
import { Play, CheckCircle2, AlertTriangle, ShieldCheck, Check, RotateCw } from 'lucide-react';
import { MLConfig, SelfTestResult } from '../types/mercadolivre';
import { runSelfTest } from '../services/mlApi';

interface SelfTestTabProps {
  config: MLConfig;
}

export const SelfTestTab: React.FC<SelfTestTabProps> = ({ config }) => {
  const [isRunning, setIsRunning] = useState(false);
  const [result, setResult] = useState<SelfTestResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleRunTest = async () => {
    setIsRunning(true);
    setError(null);
    try {
      const data = await runSelfTest(config);
      setResult(data);
    } catch (e: any) {
      setError(e.message || 'Erro ao executar diagnóstico.');
    } finally {
      setIsRunning(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-6 shadow-xs">
        <div className="mb-6 pb-4 border-b border-slate-100 dark:border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h2 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-amber-500" />
              Diagnóstico e Auto-Teste (--self-test)
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
              Testa a sintaxe das credenciais, entropia criptográfica PKCE S256 e conectividade com os servidores do Mercado Livre.
            </p>
          </div>

          <button
            type="button"
            onClick={handleRunTest}
            disabled={isRunning}
            className="px-4 py-2 text-xs font-semibold rounded-lg bg-slate-900 text-white dark:bg-amber-400 dark:text-slate-950 hover:bg-slate-800 dark:hover:bg-amber-300 transition-colors flex items-center gap-2 shadow-xs shrink-0"
          >
            <RotateCw className={`w-3.5 h-3.5 ${isRunning ? 'animate-spin' : ''}`} />
            <span>{isRunning ? 'Executando Testes...' : 'Executar Diagnóstico'}</span>
          </button>
        </div>

        {error && (
          <div className="mb-6 p-4 rounded-lg bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900 text-rose-800 dark:text-rose-200 text-xs">
            {error}
          </div>
        )}

        {result ? (
          <div className="space-y-4">
            <div
              className={`p-4 rounded-lg border text-xs font-semibold flex items-center justify-between ${
                result.allPassed
                  ? 'bg-emerald-50 dark:bg-emerald-950/30 border-emerald-200 dark:border-emerald-900 text-emerald-800 dark:text-emerald-300'
                  : 'bg-amber-50 dark:bg-amber-950/30 border-amber-200 dark:border-amber-900 text-amber-800 dark:text-amber-300'
              }`}
            >
              <div className="flex items-center gap-2">
                {result.allPassed ? (
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                ) : (
                  <AlertTriangle className="w-4 h-4 text-amber-600 dark:text-amber-400" />
                )}
                <span>
                  {result.allPassed
                    ? 'Todos os 5 testes de diagnóstico foram aprovados com sucesso!'
                    : 'Atenção: Um ou mais itens de diagnóstico apresentaram avisos.'}
                </span>
              </div>
              <span className="text-[11px] font-mono">
                {result.checks.filter((c) => c.status === 'ok').length}/{result.checks.length} Aprovados
              </span>
            </div>

            <div className="divide-y divide-slate-100 dark:divide-slate-800 border border-slate-200 dark:border-slate-800 rounded-lg overflow-hidden">
              {result.checks.map((check, index) => (
                <div
                  key={index}
                  className="p-3.5 bg-white dark:bg-slate-900 flex items-start justify-between gap-4 text-xs"
                >
                  <div className="space-y-1">
                    <span className="font-semibold text-slate-800 dark:text-slate-200 block">
                      {check.name}
                    </span>
                    <span className="text-slate-600 dark:text-slate-400 font-mono text-[11px]">
                      {check.message}
                    </span>
                  </div>

                  <div className="shrink-0 pt-0.5">
                    {check.status === 'ok' ? (
                      <span className="inline-flex items-center gap-1 text-[11px] font-medium text-emerald-600 dark:text-emerald-400">
                        <Check className="w-3.5 h-3.5" />
                        <span>Aprovado</span>
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-[11px] font-medium text-rose-600 dark:text-rose-400">
                        <AlertTriangle className="w-3.5 h-3.5" />
                        <span>Falha</span>
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <div className="text-center py-10 text-slate-400 dark:text-slate-500 text-xs">
            Clique em "Executar Diagnóstico" para testar a configuração sem realizar chamadas de autenticação reais.
          </div>
        )}
      </div>
    </div>
  );
};
