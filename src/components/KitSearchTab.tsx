import React, { useState } from 'react';
import {
  Boxes,
  Search,
  ExternalLink,
  Sparkles,
  CheckCircle2,
  AlertCircle,
  Copy,
  Check,
  Plus,
  FileSpreadsheet,
  Database,
  ArrowRight,
  DollarSign,
  Tag,
} from 'lucide-react';
import { CsvItem, KitSearchResult } from '../types/csvMatcher';
import { searchKitsOnMercadoLivre } from '../services/mlApi';

interface KitSearchTabProps {
  csvItems: CsvItem[];
  onSelectCsvItem?: (item: CsvItem) => void;
}

const PRESET_KITS = [
  {
    label: 'Kit Lixeiras Cozinha + Banheiro',
    itens: 'Lixeira Basculante 12 Litros Banheiro Escritorio Pia Cozinha + Kit 2 Lixeira Cesto Cozinha Banheiro 09l Inox Tampa Click',
    desc: 'Conjunto completo de lixeiras inox click e basculante para escritório e pia.',
  },
  {
    label: 'Controle Switch Pro + Stand Zelda 40th',
    itens: 'Controle Joystick Sem Fio Nintendo Switch Nintendo Ns2 Pro Controller + Stand The Legend Of Zelda 40th Anniversary Edition',
    desc: 'Controle edição especial verde preto dourado com suporte stand incluso.',
  },
  {
    label: 'Kit 10 Anilhas Latão Tubo 1/8',
    itens: 'Kit 10 Anilhas De Latão Para Compressão P/tubo De 1/8',
    desc: 'Anilhas de alta precisão para conexão e compressão em tubulações.',
  },
  {
    label: 'Cuba Inox Gourmet + Cesto Drenagem',
    itens: 'Cuba Inox Gourmet Cozinha Quadrada 60x40 Com Cesto Drenagem Preto',
    desc: 'Cuba quadrada acabamento preto com cesto escorredor embutido.',
  },
];

export const KitSearchTab: React.FC<KitSearchTabProps> = ({ csvItems }) => {
  const [itemNames, setItemNames] = useState(PRESET_KITS[0].itens);
  const [description, setDescription] = useState(PRESET_KITS[0].desc);
  const [isLoading, setIsLoading] = useState(false);
  const [result, setResult] = useState<KitSearchResult | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  const handleSearch = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!itemNames.trim()) {
      setErrorMessage('Informe o nome dos itens para pesquisar o kit.');
      return;
    }

    setIsLoading(true);
    setErrorMessage(null);

    try {
      const data = await searchKitsOnMercadoLivre(itemNames, description, csvItems);
      setResult(data);
    } catch (err: any) {
      setErrorMessage(err.message || 'Erro ao pesquisar kits no Mercado Livre');
    } finally {
      setIsLoading(false);
    }
  };

  const copyToClipboard = (text: string, key: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 2000);
  };

  const applyPreset = (preset: typeof PRESET_KITS[0]) => {
    setItemNames(preset.itens);
    setDescription(preset.desc);
    setResult(null);
  };

  return (
    <div className="space-y-6">
      {/* HERO / INTRO */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-6 shadow-xs">
        {/* PRESET CHIPS */}
        <div className="mt-4">
          <span className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 block mb-2">
            Exemplos Rápidos de Kits do seu Catálogo:
          </span>
          <div className="flex flex-wrap gap-2">
            {PRESET_KITS.map((p, idx) => (
              <button
                key={idx}
                type="button"
                onClick={() => applyPreset(p)}
                className="text-xs px-3 py-1.5 rounded-lg bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:border-amber-400 hover:text-amber-600 dark:hover:text-amber-400 transition-colors flex items-center gap-1.5"
              >
                <Plus className="w-3 h-3 text-amber-500" />
                <span>{p.label}</span>
              </button>
            ))}
          </div>
        </div>

        {/* SEARCH FORM */}
        <form onSubmit={handleSearch} className="mt-5 space-y-4">
          <div>
            <label className="text-xs font-bold text-slate-900 dark:text-white block mb-1">
              Nomes dos Itens / Composição do Kit:
            </label>
            <textarea
              rows={3}
              value={itemNames}
              onChange={(e) => setItemNames(e.target.value)}
              placeholder="Ex: Lixeira Basculante 12 Litros + Kit 2 Lixeira Inox 9L Tampa Click"
              className="w-full p-3 text-xs bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg text-slate-900 dark:text-white focus:outline-hidden focus:ring-2 focus:ring-amber-400"
            />
          </div>

          <div>
            <label className="text-xs font-bold text-slate-900 dark:text-white block mb-1">
              Descrição adicional / Observações do Kit (Opcional):
            </label>
            <input
              type="text"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Ex: Cor preta, inox, acabamento premium, voltagem ou quantidade de peças"
              className="w-full px-3 py-2 text-xs bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg text-slate-900 dark:text-white focus:outline-hidden focus:ring-2 focus:ring-amber-400"
            />
          </div>

          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-2">
            <span className="text-[11px] text-slate-400 flex items-center gap-1">
              <Database className="w-3.5 h-3.5 text-amber-500" />
              Cruzará com <strong>{csvItems.length} itens</strong> da coleção desti do Firebase
            </span>

            <button
              type="submit"
              disabled={isLoading || !itemNames.trim()}
              className="px-5 py-2.5 text-xs font-bold rounded-lg bg-amber-400 text-slate-950 hover:bg-amber-300 disabled:opacity-50 transition-colors flex items-center justify-center gap-2 shadow-xs cursor-pointer"
            >
              {isLoading ? (
                <>
                  <div className="w-4 h-4 border-2 border-slate-950 border-t-transparent rounded-full animate-spin" />
                  <span>Buscando Kits no Mercado Livre...</span>
                </>
              ) : (
                <>
                  <Search className="w-4 h-4" />
                  <span>Pesquisar Kits no Mercado Livre</span>
                </>
              )}
            </button>
          </div>
        </form>

        {/* ERROR */}
        {errorMessage && (
          <div className="mt-4 p-4 rounded-lg bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900 text-rose-800 dark:text-rose-200 text-xs flex items-start gap-2.5">
            <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
            <div>
              <span className="font-semibold block">Erro na Pesquisa de Kits</span>
              <span>{errorMessage}</span>
            </div>
          </div>
        )}
      </div>

      {/* RESULTS DISPLAY */}
      {result && (
        <div className="space-y-6">
          {/* 1. KIT OVERVIEW CARD */}
          <div className="bg-gradient-to-br from-amber-500/15 via-white to-emerald-500/10 dark:from-slate-900 dark:via-slate-900 dark:to-emerald-950/20 border-2 border-amber-400 dark:border-amber-500 rounded-xl p-6 shadow-sm space-y-4">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 pb-3 border-b border-amber-300/40 dark:border-slate-800">
              <div className="space-y-1">
                <span className="text-[10px] font-bold uppercase tracking-wider text-amber-800 dark:text-amber-400 flex items-center gap-1.5">
                  <Boxes className="w-3.5 h-3.5" />
                  Kit Oficial Formulado para o Mercado Livre
                </span>
                <h3 className="text-base sm:text-lg font-extrabold text-slate-950 dark:text-white">
                  {result.kitTitle}
                </h3>
              </div>

              <div className="flex items-center gap-3">
                <div className="text-right">
                  <span className="text-[10px] text-slate-400 uppercase tracking-wider block">Preço Médio</span>
                  <span className="text-sm font-bold font-mono text-emerald-600 dark:text-emerald-400">
                    {result.estimatedPrice}
                  </span>
                </div>

                <a
                  href={result.mercadoLivreSearchUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-4 py-2 text-xs font-bold rounded-lg bg-slate-950 text-white dark:bg-amber-400 dark:text-slate-950 hover:opacity-90 transition-opacity flex items-center gap-1.5 shadow-xs shrink-0"
                >
                  <span>Abrir Busca no ML</span>
                  <ExternalLink className="w-3.5 h-3.5" />
                </a>
              </div>
            </div>

            {/* Description & Components */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="p-3.5 bg-white dark:bg-slate-900 rounded-lg border border-slate-200 dark:border-slate-800 space-y-2">
                <span className="text-xs font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
                  <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                  Descrição & Montagem do Kit
                </span>
                <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
                  {result.kitDescription}
                </p>
              </div>

              <div className="p-3.5 bg-white dark:bg-slate-900 rounded-lg border border-slate-200 dark:border-slate-800 space-y-2">
                <span className="text-xs font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
                  <Tag className="w-4 h-4 text-amber-500" />
                  Componentes Identificados
                </span>
                <div className="flex flex-wrap gap-1.5">
                  {result.components?.map((c, i) => (
                    <span
                      key={i}
                      className="text-xs px-2.5 py-1 rounded-md bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-200 font-medium border border-slate-200 dark:border-slate-700"
                    >
                      {c}
                    </span>
                  ))}
                </div>
              </div>
            </div>

            {/* Keywords */}
            <div>
              <span className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 block mb-1.5">
                Palavras-Chave do Kit Extraídas para o Mercado Livre:
              </span>
              <div className="flex flex-wrap gap-1">
                {result.keywords?.map((kw, i) => (
                  <span
                    key={i}
                    className="text-[10px] font-mono font-medium px-2 py-0.5 rounded bg-amber-400/20 text-amber-900 dark:text-amber-300 border border-amber-400/30"
                  >
                    {kw}
                  </span>
                ))}
              </div>
            </div>
          </div>

          {/* 2. MERCADO LIVRE ADS GRID */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-6 shadow-xs space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h4 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                  <ExternalLink className="w-4 h-4 text-amber-500" />
                  Anúncios e Variações de Kits no Mercado Livre Brasil ({result.ads?.length || 0})
                </h4>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  Anúncios prontos com termos de busca diretos e cruzamento de palavras-chave.
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {result.ads?.map((ad, idx) => (
                <div
                  key={idx}
                  className="p-3.5 bg-slate-50 dark:bg-slate-950/60 rounded-lg border border-slate-200 dark:border-slate-800 hover:border-amber-400 transition-colors space-y-2 flex flex-col justify-between"
                >
                  <div>
                    <div className="flex items-start justify-between gap-2 mb-1">
                      {ad.mlbId && (
                        <span className="text-[11px] font-mono font-extrabold px-2 py-0.5 rounded bg-amber-400 text-slate-950 inline-flex items-center gap-1">
                          {ad.mlbId}
                        </span>
                      )}
                      <span className="text-xs font-mono font-bold text-emerald-600 dark:text-emerald-400 shrink-0">
                        {ad.price}
                      </span>
                    </div>

                    <span className="text-xs font-bold text-slate-900 dark:text-white line-clamp-2 block">
                      {ad.title}
                    </span>

                    <div className="flex flex-wrap gap-1 mt-2">
                      {ad.matchedKeywords?.slice(0, 5).map((mk, kIdx) => (
                        <span
                          key={kIdx}
                          className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-800 dark:text-emerald-300 border border-emerald-500/20"
                        >
                          {mk}
                        </span>
                      ))}
                    </div>
                  </div>

                  <div className="pt-2 flex items-center justify-between border-t border-slate-200 dark:border-slate-800 text-[11px]">
                    <span className="text-slate-400">Relevância: {ad.relevance || 'Alta'}</span>
                    <a
                      href={ad.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="px-2.5 py-1 text-xs font-bold rounded bg-slate-950 text-white dark:bg-amber-400 dark:text-slate-950 hover:opacity-90 transition-opacity flex items-center gap-1"
                    >
                      <span>Abrir Anúncio no ML</span>
                      <ExternalLink className="w-3 h-3" />
                    </a>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* 3. MATCHING ITEMS FROM DESTI COLLECTION */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-6 shadow-xs space-y-4">
            <div>
              <h4 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <Database className="w-4 h-4 text-emerald-500" />
                Itens Identificados na Coleção 'desti' do Firebase que Compõem o Kit ({result.matchingCsvItems?.length || 0})
              </h4>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                A IA cruzou os componentes do kit com os documentos salvos na coleção desti para revelar os IDs exatos correspondentes.
              </p>
            </div>

            {result.matchingCsvItems && result.matchingCsvItems.length > 0 ? (
              <div className="border border-slate-200 dark:border-slate-800 rounded-lg overflow-x-auto">
                <table className="w-full text-left text-xs divide-y divide-slate-100 dark:divide-slate-800">
                  <thead className="bg-slate-50 dark:bg-slate-950 text-slate-500 font-semibold">
                    <tr>
                      <th className="py-2.5 px-3">ID (Documento desti)</th>
                      <th className="py-2.5 px-3">Descrição do Item</th>
                      <th className="py-2.5 px-3 text-right">Valor R$</th>
                      <th className="py-2.5 px-3 text-center">Palavras Coincidentes</th>
                      <th className="py-2.5 px-3 text-center">Ações</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800 bg-white dark:bg-slate-900">
                    {result.matchingCsvItems.map((item) => (
                      <tr key={item.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50">
                        <td className="py-2.5 px-3 font-mono font-bold text-slate-900 dark:text-amber-300 tabular-nums whitespace-nowrap">
                          {item.id}
                        </td>
                        <td className="py-2.5 px-3 text-slate-800 dark:text-slate-200 max-w-md">
                          {item.itens}
                        </td>
                        <td className="py-2.5 px-3 font-mono text-right text-emerald-600 dark:text-emerald-400 tabular-nums whitespace-nowrap">
                          {item.valorReal ? `R$ ${item.valorReal}` : '—'}
                        </td>
                        <td className="py-2.5 px-3 text-center whitespace-nowrap">
                          <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-800 dark:text-emerald-300">
                            {item.matchCount} palavras
                          </span>
                        </td>
                        <td className="py-2.5 px-3 text-center whitespace-nowrap">
                          <button
                            type="button"
                            onClick={() => copyToClipboard(item.id, `kit-${item.id}`)}
                            className="px-2.5 py-1 text-xs font-semibold rounded bg-amber-400 text-slate-950 hover:bg-amber-300 transition-colors inline-flex items-center gap-1"
                          >
                            {copiedKey === `kit-${item.id}` ? (
                              <Check className="w-3 h-3 text-emerald-800" />
                            ) : (
                              <Copy className="w-3 h-3" />
                            )}
                            <span>{copiedKey === `kit-${item.id}` ? 'Copiado!' : 'Copiar ID'}</span>
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="p-4 rounded-lg bg-slate-50 dark:bg-slate-950 text-slate-500 text-xs text-center">
                Nenhum item do catálogo atual atingiu os critérios de combinação para este kit.
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
