/**
 * Normaliza um código MLB da Coluna G (ex: "3849182374", "MLB-3849182374" -> "MLB3849182374")
 */
export function normalizeMlbCode(raw?: string | null): string {
  if (!raw) return '';
  const trimmed = raw.trim().toUpperCase();
  if (!trimmed) return '';
  const digits = trimmed.replace(/\D/g, '');
  if (digits.length >= 6) {
    return `MLB${digits}`;
  }
  return trimmed.startsWith('MLB') ? trimmed.replace(/[^A-Z0-9]/g, '') : trimmed;
}

/**
 * Extrai todos os códigos MLB presentes em uma célula da Coluna G do CSV
 * (suporta 1 ou múltiplos códigos separados por vírgula, espaço, barra ou +)
 */
export function extractMlbCodes(rawColumnG?: string | null): string[] {
  if (!rawColumnG) return [];
  const raw = String(rawColumnG).trim();
  if (!raw) return [];

  // Procura padrões explícitos MLB12345678 ou sequências numéricas de 7+ dígitos
  const matches = raw.match(/(?:MLB[-\s]?\d{6,14}|\b\d{7,14}\b)/gi);
  const codes: string[] = [];
  const seen = new Set<string>();

  if (matches && matches.length > 0) {
    for (const m of matches) {
      const norm = normalizeMlbCode(m);
      if (norm && !seen.has(norm)) {
        seen.add(norm);
        codes.push(norm);
      }
    }
    return codes;
  }

  // Fallback para separadores caso o código tenha formato customizado
  const parts = raw.split(/[,;|+/]+/).map((p) => normalizeMlbCode(p)).filter(Boolean);
  for (const p of parts) {
    if (!seen.has(p)) {
      seen.add(p);
      codes.push(p);
    }
  }
  return codes;
}

/**
 * Formata o link DIRETO do anúncio específico no Mercado Livre Brasil (https://produto.mercadolivre.com.br/MLB-...)
 * Se não houver código MLB real (Coluna G), direciona para a busca real no Mercado Livre sem inventar IDs fictícios.
 */
export function formatMercadoLivreUrl(queryOrTitle: string, mlbId?: string | null): string {
  if (queryOrTitle && /^https?:\/\//i.test(queryOrTitle.trim())) {
    return queryOrTitle.trim();
  }

  const rawMlb =
    mlbId ||
    (queryOrTitle ? queryOrTitle.match(/\bMLB[-\s]?\d{6,14}\b/i)?.[0] : '') ||
    '';

  let digits = (rawMlb || '').replace(/\D/g, '');
  if (digits.length < 6 && queryOrTitle && /^\d{7,14}$/.test(queryOrTitle.trim())) {
    digits = queryOrTitle.trim();
  }

  const cleanSlug = (queryOrTitle || '')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // remove accents
    .replace(/\bmlb[-\s]?\d+\b/gi, '') // remove MLB code from slug
    .replace(/[^\w\s-]/g, '')        // remove special chars
    .trim()
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-');

  // Link direto para o anúncio APENAS quando há um código MLB real
  if (digits.length >= 6) {
    if (cleanSlug) {
      return `https://produto.mercadolivre.com.br/MLB-${digits}-${cleanSlug}-_JM`;
    }
    return `https://produto.mercadolivre.com.br/MLB-${digits}`;
  }

  // Sem MLB real: link direto para a busca dos anúncios no Mercado Livre
  const searchClean = (queryOrTitle || '').trim();
  if (searchClean) {
    return `https://lista.mercadolivre.com.br/${encodeURIComponent(searchClean)}`;
  }

  return 'https://www.mercadolivre.com.br';
}
