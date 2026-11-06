import express, { Request, Response } from 'express';
import fs from 'node:fs';
import crypto from 'node:crypto';
import { GoogleGenAI } from '@google/genai';

const app = express();

app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

const TMP_DESTI_FILE = '/tmp/desti_documents.json';

interface DestiDocument {
  id: string;
  itens: string;
  valorReal?: string;
  valorUsd?: string;
  qtdItens?: string;
  cepBuyer?: string;
  mlb?: string;
  mlbId?: string;
  updatedAt: string;
}

let memoryDestiCache: Record<string, DestiDocument> | null = null;

function readDestiStore(): Record<string, DestiDocument> {
  if (memoryDestiCache) return memoryDestiCache;
  try {
    if (fs.existsSync(TMP_DESTI_FILE)) {
      const raw = fs.readFileSync(TMP_DESTI_FILE, 'utf-8');
      memoryDestiCache = JSON.parse(raw);
      return memoryDestiCache!;
    }
  } catch {}
  memoryDestiCache = {};
  return memoryDestiCache;
}

function writeDestiStore(store: Record<string, DestiDocument>) {
  memoryDestiCache = store;
  try {
    fs.writeFileSync(TMP_DESTI_FILE, JSON.stringify(store), 'utf-8');
  } catch {}
}

function getGeminiClient(): GoogleGenAI {
  const envKey = (
    process.env.GEMINI_API_KEY ||
    process.env.GOOGLE_API_KEY ||
    process.env.VITE_GEMINI_API_KEY ||
    ''
  ).trim();

  // Valid Google Gemini API keys start with AIzaSy...
  // Never pass OAuth tokens (AQ...) to the Gemini API as they will fail with 401 ACCESS_TOKEN_TYPE_UNSUPPORTED
  const apiKey = envKey.startsWith('AIzaSy')
    ? envKey
    : 'AIzaSyDf0b7ZQeJRMsc9Lv74fBq02YVNe7GslWg';

  return new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: { 'User-Agent': 'aistudio-build' },
      timeout: 30000,
    },
  });
}

function formatGeminiError(err: any): string {
  const msg = String(err?.message || err || '');
  if (
    msg.includes('401') ||
    msg.includes('UNAUTHENTICATED') ||
    msg.includes('ACCESS_TOKEN_TYPE_UNSUPPORTED') ||
    msg.includes('API key not valid')
  ) {
    return 'Chave GEMINI_API_KEY inválida. Use uma chave do Google AI Studio (iniciada com AIzaSy...) nas configurações de Environment Variables da Vercel.';
  }
  if (
    msg.includes('429') ||
    msg.includes('RESOURCE_EXHAUSTED') ||
    msg.includes('Quota exceeded')
  ) {
    return 'Limite de cota temporariamente atingido. Tente novamente em instantes.';
  }
  return msg;
}

const DEFAULT_CONFIG = {
  get clientId() {
    return (process.env.ML_CLIENT_ID || '1316710088175307').trim();
  },
  get clientSecret() {
    return (process.env.ML_CLIENT_SECRET || 'hqnA1JYJ0ZL0I21dk4qj93IGiOjUN1L5').trim();
  },
  get redirectUri() {
    return (process.env.ML_REDIRECT_URI || 'http://localhost:3005/callback').trim();
  },
  pkceEnabled: true,
};

let latestTokens: {
  accessToken?: string;
  refreshToken?: string;
  expiresIn?: number;
  expiresAt?: number;
  userId?: number | string;
  tokenType?: string;
  scope?: string;
  updatedAt?: number;
} = {
  accessToken: (process.env.ML_ACCESS_TOKEN || 'APP_USR-1316710088175307-110419-8814e302652d2a7ed839336b4571b933-1690967397').trim(),
  refreshToken: (process.env.ML_REFRESH_TOKEN || 'TG-6aebba2ae6fe400001b97438-1690967397').trim(),
  expiresIn: 21600,
  expiresAt: 1793855113221,
  userId: 1690967397,
  tokenType: 'Bearer',
  updatedAt: Date.now(),
};

async function refreshMlTokenIfPossible(): Promise<string | null> {
  const refreshToken = (latestTokens.refreshToken || process.env.ML_REFRESH_TOKEN || '').trim();
  const clientId = DEFAULT_CONFIG.clientId;
  const clientSecret = DEFAULT_CONFIG.clientSecret;
  if (!refreshToken || !clientId || !clientSecret) return null;

  try {
    const refreshParams = new URLSearchParams({
      grant_type: 'refresh_token',
      client_id: clientId,
      client_secret: clientSecret,
      refresh_token: refreshToken,
    });
    const refRes = await fetch('https://api.mercadolibre.com/oauth/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        Accept: 'application/json',
      },
      body: refreshParams.toString(),
      signal: AbortSignal.timeout(5000),
    });
    if (refRes.ok) {
      const refData = await refRes.json();
      if (refData.access_token) {
        latestTokens = {
          accessToken: refData.access_token,
          refreshToken: refData.refresh_token || refreshToken,
          expiresIn: refData.expires_in,
          expiresAt: refData.expires_in ? Date.now() + refData.expires_in * 1000 : undefined,
          userId: refData.user_id || latestTokens.userId,
          tokenType: refData.token_type || 'Bearer',
          scope: refData.scope,
          updatedAt: Date.now(),
        };
        return refData.access_token;
      }
    }
  } catch {}
  return null;
}

function formatMercadoLivreUrl(queryOrTitle: string, mlbId?: string): string {
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
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\bmlb[-\s]?\d+\b/gi, '')
    .replace(/[^\w\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-');

  if (digits.length >= 6) {
    if (cleanSlug) {
      return `https://produto.mercadolivre.com.br/MLB-${digits}-${cleanSlug}-_JM`;
    }
    return `https://produto.mercadolivre.com.br/MLB-${digits}`;
  }

  const searchClean = (queryOrTitle || '').trim();
  if (searchClean) {
    return `https://lista.mercadolivre.com.br/${encodeURIComponent(searchClean)}`;
  }

  return 'https://www.mercadolivre.com.br';
}

function normalizePtText(text: string): string {
  return (text || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^\w\s\d]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

const PT_STOP_WORDS = new Set([
  'de', 'da', 'do', 'das', 'dos', 'em', 'no', 'na', 'nos', 'nas',
  'para', 'p/', 'pra', 'por', 'com', 'sem', 'sob', 'sobre',
  'e', 'ou', 'a', 'o', 'as', 'os', 'um', 'uma', 'uns', 'umas',
  'que', 'se', 'ao', 'aos', 'kit', 'ref', 'tipo', 'novo', 'nova',
  'original', 'unidade', 'unidades', 'peca', 'pecas', 'lote', 'mlb',
  'mais', 'menos', 'muito', 'pouco', 'mesmo', 'outra', 'outro',
]);

function extractKeywordsFromTitle(title: string, extraWords: string[] = []): string[] {
  const normTitle = normalizePtText(title);
  const words = normTitle.split(' ');
  const result: string[] = [];
  const seen = new Set<string>();

  const candidates = [...words, ...extraWords.map((w) => normalizePtText(w))];
  for (const raw of candidates) {
    const w = raw.trim();
    if (!w || seen.has(w) || PT_STOP_WORDS.has(w)) continue;
    if (w.length >= 2) {
      seen.add(w);
      result.push(w);
    }
  }
  return result;
}

function calculateKeywordOverlap(itemText: string, keywords: string[]) {
  const normItem = ` ${normalizePtText(itemText)} `;
  const matchedKeywords: string[] = [];

  for (const kw of keywords) {
    const cleanKw = kw.toLowerCase().trim();
    if (!cleanKw) continue;
    if (normItem.includes(` ${cleanKw} `) || normItem.includes(cleanKw)) {
      matchedKeywords.push(cleanKw);
    }
  }

  return {
    matchedKeywords,
    matchCount: matchedKeywords.length,
  };
}

async function searchMercadoLivreByQuery(rawQuery: string) {
  const query = (rawQuery || '').trim();
  const searchUrl = formatMercadoLivreUrl(query);

  try {
    const currentToken = (latestTokens.accessToken || process.env.ML_ACCESS_TOKEN || '').trim();
    const headers: Record<string, string> = { Accept: 'application/json' };
    if (currentToken) {
      headers.Authorization = `Bearer ${currentToken}`;
    }

    let mlRes = await fetch(
      `https://api.mercadolibre.com/sites/MLB/search?q=${encodeURIComponent(query)}&limit=6`,
      { headers, signal: AbortSignal.timeout(4500) }
    );

    if ((mlRes.status === 401 || mlRes.status === 403) && (latestTokens.refreshToken || process.env.ML_REFRESH_TOKEN)) {
      const refreshed = await refreshMlTokenIfPossible();
      if (refreshed) {
        headers.Authorization = `Bearer ${refreshed}`;
        mlRes = await fetch(
          `https://api.mercadolibre.com/sites/MLB/search?q=${encodeURIComponent(query)}&limit=6`,
          { headers, signal: AbortSignal.timeout(4500) }
        );
      }
    }

    if (mlRes.ok) {
      const data = await mlRes.json();
      if (Array.isArray(data.results) && data.results.length > 0) {
        const ads = data.results
          .slice(0, 6)
          .filter((r: any) => r && r.id && String(r.id).toUpperCase().startsWith('MLB'))
          .map((r: any) => {
            const mlbId = String(r.id).toUpperCase().trim();
            const title = r.title || `${query} Original`;
            const numPrice = typeof r.price === 'number' ? r.price : null;
            const price =
              numPrice !== null
                ? `R$ ${numPrice.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
                : 'Consulte no anúncio';
            const permalink =
              r.permalink && typeof r.permalink === 'string' && r.permalink.startsWith('http')
                ? r.permalink
                : formatMercadoLivreUrl(title, mlbId);
            return {
              mlbId,
              title,
              price,
              url: permalink,
              searchUrl: permalink,
              condition: r.condition === 'used' ? 'Usado' : 'Novo',
              sellerType: r.official_store_id ? 'Loja Oficial' : 'MercadoLíder',
            };
          });

        if (ads.length > 0) {
          return {
            query,
            primaryMlbId: ads[0].mlbId,
            searchUrl: ads[0].url,
            ads,
          };
        }
      }
    }
  } catch {}

  return {
    query,
    primaryMlbId: '',
    searchUrl,
    ads: [],
  };
}

// ==========================================
// DESTI DOCUMENT ROUTES
// ==========================================
app.get('/api/desti/docs', (_req: Request, res: Response) => {
  const store = readDestiStore();
  return res.json({ success: true, items: Object.values(store) });
});

app.post('/api/desti/doc', (req: Request, res: Response) => {
  const item = req.body;
  const rawId = String(item?.id || '').trim();
  if (!rawId) return res.status(400).json({ error: 'ID obrigatório' });
  const mlbVal = item.mlb ? String(item.mlb).trim() : item.mlbId ? String(item.mlbId).trim() : '';
  const store = readDestiStore();
  store[rawId] = {
    id: rawId,
    itens: String(item.itens || ''),
    valorReal: item.valorReal ? String(item.valorReal) : '',
    valorUsd: item.valorUsd ? String(item.valorUsd) : '',
    qtdItens: item.qtdItens ? String(item.qtdItens) : '1',
    cepBuyer: item.cepBuyer ? String(item.cepBuyer) : '',
    mlb: mlbVal,
    mlbId: item.mlbId ? String(item.mlbId).trim() : mlbVal,
    updatedAt: new Date().toISOString(),
  };
  writeDestiStore(store);
  return res.json({ success: true, id: rawId });
});

app.post('/api/desti/batch', (req: Request, res: Response) => {
  const items: any[] = Array.isArray(req.body?.items) ? req.body.items : [];
  const store = readDestiStore();
  let saved = 0;
  for (const item of items) {
    const rawId = String(item?.id || '').trim();
    if (!rawId) continue;
    const mlbVal = item.mlb ? String(item.mlb).trim() : item.mlbId ? String(item.mlbId).trim() : '';
    store[rawId] = {
      id: rawId,
      itens: String(item.itens || ''),
      valorReal: item.valorReal ? String(item.valorReal) : '',
      valorUsd: item.valorUsd ? String(item.valorUsd) : '',
      qtdItens: item.qtdItens ? String(item.qtdItens) : '1',
      cepBuyer: item.cepBuyer ? String(item.cepBuyer) : '',
      mlb: mlbVal,
      mlbId: item.mlbId ? String(item.mlbId).trim() : mlbVal,
      updatedAt: new Date().toISOString(),
    };
    saved++;
  }
  writeDestiStore(store);
  return res.json({ success: true, saved });
});

app.delete('/api/desti/doc/:id', (req: Request, res: Response) => {
  const id = String(req.params.id || '').trim();
  const store = readDestiStore();
  if (store[id]) {
    delete store[id];
    writeDestiStore(store);
  }
  return res.json({ success: true });
});

// ==========================================
// MERCADO LIVRE & GEMINI ROUTES
// ==========================================
app.get('/api/ml/config', async (_req: Request, res: Response) => {
  return res.json({
    defaultClientId: DEFAULT_CONFIG.clientId,
    defaultClientSecret: DEFAULT_CONFIG.clientSecret,
    defaultRedirectUri: DEFAULT_CONFIG.redirectUri,
    pkceEnabled: DEFAULT_CONFIG.pkceEnabled,
    appUrl: process.env.APP_URL || 'http://localhost:3000',
    latestTokens: latestTokens.accessToken ? latestTokens : null,
    connectedUser: null,
  });
});

app.post('/api/ml/search-name', async (req: Request, res: Response) => {
  try {
    const rawQueries: string[] = Array.isArray(req.body.queries)
      ? req.body.queries
      : req.body.query
      ? [String(req.body.query)]
      : [];

    const cleanQueries = rawQueries
      .map((q) => String(q || '').trim())
      .filter(Boolean)
      .slice(0, 30);

    if (cleanQueries.length === 0) {
      return res.status(400).json({ error: 'Informe ao menos um nome ou palavra-chave para buscar.' });
    }

    const results = await Promise.all(cleanQueries.map((q) => searchMercadoLivreByQuery(q)));
    return res.json({ success: true, results });
  } catch (err: any) {
    return res.status(500).json({
      error: 'Erro ao consultar anúncios no Mercado Livre: ' + (err.message || 'Erro desconhecido'),
    });
  }
});

app.post('/api/ml/gemini-scan-photo', async (req: Request, res: Response) => {
  try {
    let { imageBase64, mimeType = 'image/jpeg' } = req.body;
    if (!imageBase64) {
      return res.status(400).json({ error: 'Nenhuma foto fornecida.' });
    }

    if (imageBase64.includes(';base64,')) {
      const parts = imageBase64.split(';base64,');
      const mimeMatch = parts[0].match(/:(.*?)$/);
      if (mimeMatch) mimeType = mimeMatch[1];
      imageBase64 = parts[1];
    }

    const prompt = `Você é um especialista em catálogo, leitura de embalagens e montagem de KITS no Mercado Livre Brasil (MLB).
ATENÇÃO RIGOROSA:
- NÃO presuma que o item é água destilada, água desmineralizada ou qualquer garrafa/frasco genérico.
- Olhe com zoom e atenção para todos os textos, rótulos, quantidades, peças, números, marca, modelo e detalhes visuais reais da foto!
- Se o rótulo estiver em inglês ou outro idioma, TRADUZA tudo para o Português do Brasil usado comercialmente no Mercado Livre.
- Verifique se a imagem mostra um KIT, combo, conjunto de peças ou itens que fazem parte de um kit.

Retorne um objeto JSON contendo exatamente os seguintes campos:
- "translatedText": Tradução completa da imagem em texto comercial em Português
- "productName": Nome comercial completo do produto ou KIT no Mercado Livre Brasil
- "kitSuggestion": Título comercial focado em KIT / Conjunto no Mercado Livre Brasil
- "keywords": Array com 6 a 15 palavras-chave individuais em Português para buscar este item ou kit na base de dados
- "brand": Marca detectada
- "model": Modelo específico ou linha
- "category": Categoria recomendada no Mercado Livre Brasil
- "mlbId": Código MLB principal compatível no Mercado Livre Brasil (ex: MLB3948192031)
- "mlbList": Lista de 6 a 10 anúncios e códigos MLB encontrados para este produto e variações de KIT no Mercado Livre Brasil, no formato: [{"mlbId": "MLB3948192031", "title": "Título comercial do anúncio ou Kit no ML", "price": "R$ 149,90", "condition": "Novo", "sellerType": "MercadoLíder"}]
- "searchQuery": Termo exato para buscar este produto/kit no Mercado Livre
- "priceRange": Faixa de preço estimada em Reais (ex: "R$ 49,90 - R$ 89,90")
- "condition": Condição visual aparente
- "detectedTexts": Lista de textos originais lidos na imagem
- "keyFeatures": Array com 3 a 5 especificações principais
- "confidence": "Alta", "Média" ou "Baixa"`;

    let rawText = '';
    const geminiAi = getGeminiClient();
    const modelsToTry = ['gemini-3.1-flash-lite', 'gemini-flash-latest', 'gemini-3.8-flash'];
    let lastError: any = null;
    const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

    for (const model of modelsToTry) {
      try {
        const response = await geminiAi.models.generateContent({
          model,
          contents: {
            parts: [{ inlineData: { mimeType, data: imageBase64 } }, { text: prompt }],
          },
          config: { responseMimeType: 'application/json' },
        });
        rawText = response.text || '';
        if (rawText) break;
      } catch (err: any) {
        lastError = err;
        await sleep(800);
      }
    }

    if (!rawText) {
      throw lastError || new Error('Não foi possível processar a leitura da imagem no momento.');
    }

    let parsed: any;
    try {
      parsed = JSON.parse(rawText);
    } catch {
      const clean = rawText.replace(/```json/g, '').replace(/```/g, '').trim();
      parsed = JSON.parse(clean);
    }

    const combinedTextForKeywords = `${parsed.productName || ''} ${parsed.kitSuggestion || ''} ${parsed.translatedText || ''}`;
    const rawKeywords = Array.isArray(parsed.keywords) ? parsed.keywords : [];
    parsed.keywords = extractKeywordsFromTitle(combinedTextForKeywords, rawKeywords);
    parsed.translatedText = parsed.translatedText || parsed.kitSuggestion || parsed.productName || '';

    const searchQuery = parsed.searchQuery || parsed.productName || 'produto';
    parsed.mercadoLivreSearchUrl = formatMercadoLivreUrl(searchQuery, parsed.mlbId);

    let liveMlbAds: any[] = [];
    try {
      const liveSearch = await searchMercadoLivreByQuery(searchQuery);
      if (liveSearch && Array.isArray(liveSearch.ads)) {
        liveMlbAds = liveSearch.ads;
        if (!parsed.mlbId && liveSearch.primaryMlbId) {
          parsed.mlbId = liveSearch.primaryMlbId;
        }
      }
    } catch {}

    const rawList = [...liveMlbAds, ...(Array.isArray(parsed.mlbList) ? parsed.mlbList : [])];
    const seenMlbIds = new Set<string>();
    parsed.mlbList = rawList
      .filter((item: any) => item && (item.mlbId || item.title))
      .map((item: any) => {
        const rawCode = String(item.mlbId || '').toUpperCase().trim();
        const digits = rawCode.replace(/\D/g, '');
        const mlbId = (rawCode.startsWith('MLB') && digits.length >= 6) ? `MLB${digits}` : '';
        const title = item.title || parsed.productName || 'Anúncio Mercado Livre';
        return {
          mlbId,
          title,
          price: item.price || 'Consulte valor',
          condition: item.condition || 'Novo',
          sellerType: item.sellerType || 'Vendedor Mercado Livre',
          url: item.url || (mlbId ? formatMercadoLivreUrl(title, mlbId) : formatMercadoLivreUrl(title)),
        };
      })
      .filter((item: any) => {
        if (!item.mlbId) return true;
        if (seenMlbIds.has(item.mlbId)) return false;
        seenMlbIds.add(item.mlbId);
        return true;
      });

    return res.json({ success: true, data: parsed });
  } catch (err: any) {
    return res.status(500).json({
      error: 'Erro ao processar leitura da foto: ' + formatGeminiError(err),
    });
  }
});

app.post('/api/ml/csv-match-photo', async (req: Request, res: Response) => {
  try {
    let { imageBase64, mimeType = 'image/jpeg', csvItems = [] } = req.body;
    if (!imageBase64) {
      return res.status(400).json({ error: 'Nenhuma foto fornecida.' });
    }

    if (imageBase64.includes(';base64,')) {
      const parts = imageBase64.split(';base64,');
      const mimeMatch = parts[0].match(/:(.*?)$/);
      if (mimeMatch) mimeType = mimeMatch[1];
      imageBase64 = parts[1];
    }

    const candidateList = (csvItems as any[]).slice(0, 80).map((item) => {
      return `[ID: ${item.id}] ${item.itens || ''} (Valor: R$ ${item.valorReal || item.valorUsd || '0.00'})`;
    }).join('\n');

    const prompt = `Você é um perito em catalogação de produtos do Mercado Livre Brasil.
Analise a foto enviada e cruze com a lista real do CSV abaixo:
${candidateList}

REGRA RIGOROSA:
- NUNCA invente ou use IDs fictícios!
- O campo "matchedId" DEVE ser EXCLUSIVAMENTE um dos IDs presentes na lista do CSV acima.
- Se a foto não bater com nenhum item do CSV, retorne "matchedId": null.

Retorne um JSON puro com:
{
  "visualOcrText": "Texto lido na imagem",
  "productDescription": "Descrição do produto",
  "mercadoLivreTitle": "Título comercial no Mercado Livre Brasil",
  "keywords": ["palavra1", "palavra2"],
  "matchedId": "ID_REAL_DO_CSV_OU_NULL",
  "matchedItem": "Descrição exata do item no CSV",
  "matchedKeywords": ["palavras que bateram"],
  "confidenceScore": 95,
  "reasoning": "Motivo da correspondência"
}`;

    let rawText = '';
    const geminiAi = getGeminiClient();
    const modelsToTry = ['gemini-3.1-flash-lite', 'gemini-flash-latest', 'gemini-3.8-flash'];
    let lastError: any = null;
    const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

    for (const model of modelsToTry) {
      try {
        const response = await geminiAi.models.generateContent({
          model,
          contents: {
            parts: [{ inlineData: { mimeType, data: imageBase64 } }, { text: prompt }],
          },
          config: { responseMimeType: 'application/json' },
        });
        rawText = response.text || '';
        if (rawText) break;
      } catch (err: any) {
        lastError = err;
        await sleep(800);
      }
    }

    if (!rawText) {
      throw lastError || new Error('Não foi possível concluir a leitura da imagem no momento.');
    }

    let parsed: any;
    try {
      parsed = JSON.parse(rawText);
    } catch {
      const clean = rawText.replace(/```json/g, '').replace(/```/g, '').trim();
      parsed = JSON.parse(clean);
    }

    const geminiKeywords: string[] = Array.isArray(parsed.keywords) ? parsed.keywords : [];
    const mlTitle: string = parsed.mercadoLivreTitle || parsed.productDescription || '';
    const visualText: string = parsed.visualOcrText || '';
    const activeKeywords = extractKeywordsFromTitle(`${mlTitle} ${visualText}`, geminiKeywords);
    parsed.keywords = activeKeywords;

    const validCsvMap = new Map((csvItems as any[]).map((item) => [String(item.id).trim(), item]));
    const geminiId = String(parsed.matchedId || '').trim();
    let winner = validCsvMap.get(geminiId);

    const scoredCandidates = (csvItems as any[]).map((item) => {
      const { matchedKeywords, matchCount } = calculateKeywordOverlap(item.itens || '', activeKeywords);
      const isGeminiPick = winner ? String(item.id).trim() === String(winner.id).trim() : false;
      const hasCsvMlb = Boolean((item.mlbId || item.mlb || '').trim());
      let score = Math.min(100, Math.round((matchCount / Math.max(activeKeywords.length, 1)) * 100));
      if (isGeminiPick) score = Math.max(score, parsed.confidenceScore || 85);
      if (hasCsvMlb && matchCount >= 2) score += 35;
      return {
        id: item.id,
        itens: item.itens,
        mlb: (item.mlbId || item.mlb || '').trim(),
        matchedKeywords,
        matchCount,
        confidenceScore: score,
        isGeminiPick,
      };
    });

    scoredCandidates.sort((a, b) => {
      if (b.confidenceScore !== a.confidenceScore) return b.confidenceScore - a.confidenceScore;
      return b.matchCount - a.matchCount;
    });

    if (!winner || calculateKeywordOverlap(winner.itens || '', activeKeywords).matchCount === 0) {
      const topCand = scoredCandidates.find((c) => c.matchCount > 0);
      winner = topCand ? validCsvMap.get(String(topCand.id).trim()) : undefined;
    }

    if (winner) {
      const { matchedKeywords } = calculateKeywordOverlap(winner.itens || '', activeKeywords);
      parsed.matchedId = winner.id;
      parsed.matchedItem = winner.itens;
      parsed.matchedKeywords = matchedKeywords;
      parsed.confidenceScore = Math.max(parsed.confidenceScore || 75, 75);
      // STRICTLY real Column G MLB from the CSV
      parsed.mlbId = (winner.mlbId || winner.mlb || '').trim();
    } else {
      // NEVER output fictitious IDs
      parsed.matchedId = '';
      parsed.matchedItem = '';
      parsed.matchedKeywords = [];
      parsed.confidenceScore = 0;
      parsed.mlbId = '';
    }

    return res.json({ success: true, data: parsed });
  } catch (err: any) {
    return res.status(500).json({
      error: 'Erro ao comparar foto com CSV: ' + formatGeminiError(err),
    });
  }
});

app.post('/api/ml/kit-search', async (req: Request, res: Response) => {
  try {
    const { itemNames = '', description = '', csvItems = [] } = req.body;
    if (!itemNames.trim()) {
      return res.status(400).json({ error: 'Informe ao menos o nome dos itens para pesquisar o kit.' });
    }

    const candidateList = (csvItems as any[]).slice(0, 60).map((it) => {
      return `[ID: ${it.id}] ${it.itens || ''} (R$ ${it.valorReal || it.valorUsd || '0.00'})`;
    }).join('\n');

    const prompt = `Você é um perito em montagem e busca de KITS de produtos no Mercado Livre Brasil.
ITENS DO KIT: ${itemNames}
OBSERVAÇÕES: ${description || 'Nenhuma'}
CATÁLOGO CSV:
${candidateList}

Retorne um JSON puro com:
{
  "kitTitle": "Título comercial do Kit no Mercado Livre Brasil",
  "kitDescription": "Descrição detalhada do kit",
  "components": ["Componente 1", "Componente 2"],
  "estimatedPrice": "R$ 89,90 - R$ 120,00",
  "keywords": ["palavra1", "palavra2"],
  "ads": [{"title": "Título do anúncio", "price": "R$ 99,90", "relevance": "Alta", "condition": "Novo"}]
}`;

    let rawText = '';
    const geminiAi = getGeminiClient();
    const modelsToTry = ['gemini-3.1-flash-lite', 'gemini-flash-latest', 'gemini-3.8-flash'];
    let lastError: any = null;
    const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

    for (const model of modelsToTry) {
      try {
        const response = await geminiAi.models.generateContent({
          model,
          contents: prompt,
          config: { responseMimeType: 'application/json' },
        });
        rawText = response.text || '';
        if (rawText) break;
      } catch (err: any) {
        lastError = err;
        await sleep(800);
      }
    }

    if (!rawText) {
      throw lastError || new Error('Não foi possível concluir a pesquisa por kit no momento.');
    }

    let parsed: any;
    try {
      parsed = JSON.parse(rawText);
    } catch {
      const clean = rawText.replace(/```json/g, '').replace(/```/g, '').trim();
      parsed = JSON.parse(clean);
    }

    const kitTitle: string = parsed.kitTitle || itemNames;
    const kitKeywords = extractKeywordsFromTitle(kitTitle, Array.isArray(parsed.keywords) ? parsed.keywords : []);
    parsed.keywords = kitKeywords;

    let liveKitAds: any[] = [];
    try {
      const liveKit = await searchMercadoLivreByQuery(kitTitle);
      if (liveKit && Array.isArray(liveKit.ads)) {
        liveKitAds = liveKit.ads;
      }
    } catch {}

    const rawAds = [...liveKitAds, ...(Array.isArray(parsed.ads) ? parsed.ads : [])];
    const seenAdMlbs = new Set<string>();
    parsed.ads = rawAds
      .filter((ad: any) => ad && (ad.title || ad.mlbId))
      .map((ad: any) => {
        const title = ad.title || kitTitle;
        const rawCode = String(ad.mlbId || '').toUpperCase().trim();
        const digits = rawCode.replace(/\D/g, '');
        const mlbId = (rawCode.startsWith('MLB') && digits.length >= 6) ? `MLB${digits}` : '';
        const { matchedKeywords, matchCount } = calculateKeywordOverlap(title, kitKeywords);
        return {
          mlbId,
          title,
          price: ad.price || parsed.estimatedPrice || 'Consulte anúncio',
          url: ad.url || (mlbId ? formatMercadoLivreUrl(title, mlbId) : formatMercadoLivreUrl(title)),
          matchedKeywords,
          matchCount,
          relevance: ad.relevance || 'Alta',
          condition: ad.condition || 'Novo',
        };
      })
      .filter((ad: any) => {
        if (!ad.mlbId) return true;
        if (seenAdMlbs.has(ad.mlbId)) return false;
        seenAdMlbs.add(ad.mlbId);
        return true;
      });

    parsed.mercadoLivreSearchUrl =
      parsed.ads[0]?.url || formatMercadoLivreUrl(kitTitle);

    const matchingCsvItems: any[] = [];
    for (const it of csvItems as any[]) {
      const { matchedKeywords, matchCount } = calculateKeywordOverlap(it.itens || '', kitKeywords);
      if (matchCount >= 2) {
        matchingCsvItems.push({
          id: it.id,
          itens: it.itens,
          valorReal: it.valorReal,
          mlb: it.mlbId || it.mlb || '',
          matchedKeywords,
          matchCount,
        });
      }
    }

    matchingCsvItems.sort((a, b) => b.matchCount - a.matchCount);
    parsed.matchingCsvItems = matchingCsvItems;

    return res.json({ success: true, data: parsed });
  } catch (err: any) {
    return res.status(500).json({
      error: 'Erro ao pesquisar kits no Mercado Livre: ' + formatGeminiError(err),
    });
  }
});

export default app;
