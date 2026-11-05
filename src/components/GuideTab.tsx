import React from 'react';
import { BookOpen, ExternalLink, AlertCircle, CheckCircle2, Key, Globe, ShieldAlert } from 'lucide-react';

export const GuideTab: React.FC = () => {
  return (
    <div className="space-y-6">
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-6 shadow-xs">
        <div className="mb-6 pb-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
          <div>
            <h2 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <BookOpen className="w-4 h-4 text-amber-500" />
              Guia Passo a Passo: Configuração no DevCenter do Mercado Livre
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
              Como cadastrar sua aplicação, configurar a URL de retorno e resolver problemas comuns de autorização.
            </p>
          </div>

          <a
            href="https://developers.mercadolivre.com.br/devcenter"
            target="_blank"
            rel="noopener noreferrer"
            className="px-3 py-1.5 text-xs font-semibold rounded-md bg-amber-400 text-slate-950 hover:bg-amber-300 transition-colors flex items-center gap-1.5 shadow-xs shrink-0"
          >
            <span>Abrir DevCenter</span>
            <ExternalLink className="w-3.5 h-3.5" />
          </a>
        </div>

        {/* Steps */}
        <div className="space-y-6">
          <div className="flex gap-4">
            <div className="w-7 h-7 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-200 text-xs font-bold flex items-center justify-center shrink-0">
              1
            </div>
            <div className="space-y-1">
              <h3 className="text-sm font-semibold text-slate-900 dark:text-white">
                Acesse o DevCenter do Mercado Livre
              </h3>
              <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
                Entre com sua conta em{' '}
                <a
                  href="https://developers.mercadolivre.com.br/devcenter"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-amber-600 dark:text-amber-400 underline font-mono"
                >
                  developers.mercadolivre.com.br/devcenter
                </a>
                . No canto superior direito, clique em <strong>"Criar nova aplicação"</strong>.
              </p>
            </div>
          </div>

          <div className="flex gap-4">
            <div className="w-7 h-7 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-200 text-xs font-bold flex items-center justify-center shrink-0">
              2
            </div>
            <div className="space-y-1">
              <h3 className="text-sm font-semibold text-slate-900 dark:text-white">
                Cadastre a Redirect URI (URL de Redirecionamento)
              </h3>
              <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
                No campo <strong>"URI de redirecionamento"</strong>, informe exatamente a URL cadastrada (por exemplo,{' '}
                <code className="font-mono bg-slate-100 dark:bg-slate-800 px-1 py-0.5 rounded text-amber-700 dark:text-amber-300">
                  https://www.ecooy.com.br/oauth/retorno
                </code>
                ).
              </p>
              <div className="p-3 bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-900 rounded-md text-xs text-amber-900 dark:text-amber-300">
                <strong>Atenção:</strong> O Mercado Livre exige HTTPS obrigatório e a URL precisa ser caractere por caractere idêntica (inclusive barras no final ou caminhos /ked).
              </div>
            </div>
          </div>

          <div className="flex gap-4">
            <div className="w-7 h-7 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-200 text-xs font-bold flex items-center justify-center shrink-0">
              3
            </div>
            <div className="space-y-1">
              <h3 className="text-sm font-semibold text-slate-900 dark:text-white">
                Obtenha o Client ID e Client Secret
              </h3>
              <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
                Após criar a aplicação, você verá seu <strong>App ID (Client ID)</strong> numérico e poderá gerar uma <strong>Secret Key (Client Secret)</strong>. Copie e cole essas credenciais nesta ferramenta.
              </p>
            </div>
          </div>
        </div>

        {/* Troubleshooting / Error FAQs */}
        <div className="mt-8 pt-6 border-t border-slate-100 dark:border-slate-800 space-y-4">
          <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <ShieldAlert className="w-4 h-4 text-rose-500" />
            Erros Comuns e Como Corrigir
          </h3>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
            <div className="p-4 rounded-lg bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 space-y-1.5">
              <div className="font-bold text-slate-900 dark:text-white">
                Erro: <code>invalid_grant</code>
              </div>
              <p className="text-slate-600 dark:text-slate-400 leading-relaxed">
                O código (code) do Mercado Livre tem validade curta (~10 minutos) e <strong>só pode ser trocado 1 única vez</strong>. Se você já usou o código ou demorou para trocar, gere um novo link no Passo 1 e autorize novamente.
              </p>
            </div>

            <div className="p-4 rounded-lg bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 space-y-1.5">
              <div className="font-bold text-slate-900 dark:text-white">
                Erro: <code>redirect_uri mismatch</code>
              </div>
              <p className="text-slate-600 dark:text-slate-400 leading-relaxed">
                A URL de redirecionamento informada na requisição é diferente da cadastrada no DevCenter. Verifique se há barras extras (ex: <code>/oauth/retorno/</code> vs <code>/oauth/retorno</code>) ou protocolo HTTP sem S.
              </p>
            </div>

            <div className="p-4 rounded-lg bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 space-y-1.5">
              <div className="font-bold text-slate-900 dark:text-white">
                Erro: <code>invalid_client</code>
              </div>
              <p className="text-slate-600 dark:text-slate-400 leading-relaxed">
                O Client ID ou Client Secret foram preenchidos com valores incorretos. Se renovou a chave secreta no DevCenter, certifique-se de usar a nova chave ativa.
              </p>
            </div>

            <div className="p-4 rounded-lg bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 space-y-1.5">
              <div className="font-bold text-slate-900 dark:text-white">
                A página de retorno deu 404 (Não encontrada)
              </div>
              <p className="text-slate-600 dark:text-slate-400 leading-relaxed">
                Isso é completamente normal se o seu domínio (ex: ecooy.com.br) não tiver uma página nessa rota! O que importa é que a barra de endereços do seu navegador conterá <code>?code=TG-...&state=...</code>. Basta copiar a URL inteira da barra e colar aqui.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
