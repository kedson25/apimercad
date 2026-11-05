/**
 * Helper para formatar links válidos do Mercado Livre Brasil (MLB)
 * Se houver código MLB numérico, gera link direto do produto (https://produto.mercadolivre.com.br/MLB-...)
 * Se for termo de busca ou título, gera a lista de anúncios com slug limpo (https://lista.mercadolivre.com.br/termo-de-busca)
 */
export function formatMercadoLivreUrl(queryOrTitle: string, _mlbId?: string | null): string {
  const textToUse = queryOrTitle || '';

  const clean = textToUse
    .trim()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // remove accents
    .replace(/[^\w\s-]/g, '')        // remove special chars
    .replace(/\s+/g, '-');           // replace spaces with hyphens

  if (!clean) return 'https://www.mercadolivre.com.br';
  return `https://lista.mercadolivre.com.br/${clean}`;
}
