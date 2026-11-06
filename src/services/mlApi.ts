import {
  AuthUrlResponse,
  MLConfig,
  MLUser,
  SelfTestResult,
  TokenResponse,
  AIProductAnalysis,
  GeminiPhotoScanResult,
} from '../types/mercadolivre';
import { CsvItem, CsvMatchResult, KitSearchResult } from '../types/csvMatcher';

async function safeParseJson(res: Response): Promise<{ ok: boolean; status: number; data: any; rawText: string }> {
  const rawText = await res.text();
  try {
    const data = JSON.parse(rawText);
    return { ok: res.ok, status: res.status, data, rawText };
  } catch {
    return { ok: false, status: res.status, data: null, rawText };
  }
}

export async function fetchInitialConfig(): Promise<{
  defaultClientId: string;
  defaultRedirectUri: string;
  defaultClientSecret: string;
  pkceEnabled: boolean;
  appUrl: string;
  latestTokens: TokenResponse | null;
  connectedUser?: MLUser | null;
}> {
  try {
    const res = await fetch('/api/ml/config');
    const parsed = await safeParseJson(res);
    if (parsed.ok && parsed.data) return parsed.data;
  } catch {}
  return {
    defaultClientId: '',
    defaultRedirectUri: '',
    defaultClientSecret: '',
    pkceEnabled: true,
    appUrl: typeof window !== 'undefined' ? window.location.origin : '',
    latestTokens: null,
    connectedUser: null,
  };
}

export async function createAuthUrl(config: Partial<MLConfig>): Promise<AuthUrlResponse> {
  const res = await fetch('/api/ml/create-auth-url', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(config),
  });
  const parsed = await safeParseJson(res);
  if (!parsed.ok || !parsed.data) {
    throw new Error(parsed.data?.error || 'Erro ao gerar URL de autorização');
  }
  return parsed.data;
}

export async function exchangeToken(payload: {
  clientId: string;
  clientSecret: string;
  redirectUri: string;
  code: string;
  codeVerifier?: string;
  expectedState?: string;
}): Promise<TokenResponse> {
  const res = await fetch('/api/ml/exchange-token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  const parsed = await safeParseJson(res);
  if (!parsed.ok || !parsed.data) {
    const errorMsg = parsed.data?.error || 'Erro ao trocar código por token';
    const hint = parsed.data?.hint ? ` (${parsed.data.hint})` : '';
    throw new Error(`${errorMsg}${hint}`);
  }
  return parsed.data;
}

export async function refreshAccessToken(payload: {
  clientId: string;
  clientSecret: string;
  refreshToken: string;
}): Promise<TokenResponse> {
  const res = await fetch('/api/ml/refresh-token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  const parsed = await safeParseJson(res);
  if (!parsed.ok || !parsed.data) {
    throw new Error(parsed.data?.error || 'Erro ao renovar token');
  }
  return parsed.data;
}

export async function testToken(accessToken: string): Promise<{
  valid: boolean;
  status: number;
  user?: MLUser;
  error?: string;
  raw?: any;
}> {
  const res = await fetch('/api/ml/test-token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ accessToken }),
  });
  const parsed = await safeParseJson(res);
  if (!parsed.ok || !parsed.data) {
    throw new Error(parsed.data?.error || `Erro ao testar token (HTTP ${res.status})`);
  }
  return parsed.data;
}

export async function runSelfTest(config: MLConfig): Promise<SelfTestResult> {
  const res = await fetch('/api/ml/self-test', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(config),
  });
  const parsed = await safeParseJson(res);
  if (!parsed.ok || !parsed.data) {
    throw new Error(parsed.data?.error || 'Erro ao executar auto-teste');
  }
  return parsed.data;
}

export async function proxyApiCall(endpoint: string, method = 'GET', body?: any) {
  const res = await fetch('/api/ml/api-proxy', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ endpoint, method, body }),
  });
  const parsed = await safeParseJson(res);
  return parsed.data || {};
}

export async function analyzeProductImage(productHint: string, imageUrl?: string): Promise<AIProductAnalysis> {
  const res = await fetch('/api/ml/ai-analyze-image', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ productHint, imageUrl }),
  });
  const parsed = await safeParseJson(res);
  if (!parsed.ok || !parsed.data) {
    throw new Error(parsed.data?.error || 'Erro na análise de imagem');
  }
  return parsed.data;
}

export async function scanPhotoWithGemini(
  imageBase64: string,
  mimeType = 'image/jpeg'
): Promise<GeminiPhotoScanResult> {
  let cleanBase64 = imageBase64;
  let cleanMime = mimeType;
  if (cleanBase64.includes(';base64,')) {
    const parts = cleanBase64.split(';base64,');
    const mimeMatch = parts[0].match(/:(.*?)$/);
    if (mimeMatch) cleanMime = mimeMatch[1];
    cleanBase64 = parts[1];
  }

  const res = await fetch('/api/ml/gemini-scan-photo', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ imageBase64: cleanBase64, mimeType: cleanMime }),
  });

  const parsed = await safeParseJson(res);
  if (!parsed.ok || !parsed.data?.data) {
    const errorMsg =
      parsed.data?.error ||
      parsed.data?.message ||
      (parsed.status === 401
        ? 'Chave GEMINI_API_KEY inválida na Vercel. Verifique as Environment Variables.'
        : parsed.status === 429
        ? 'Limite de cota do Gemini temporariamente atingido. Tente novamente em instantes.'
        : `Erro na leitura da imagem (HTTP ${parsed.status})`);
    throw new Error(errorMsg);
  }

  return parsed.data.data;
}

export async function matchPhotoWithCsv(
  imageBase64: string,
  csvItems: CsvItem[],
  mimeType = 'image/jpeg'
): Promise<CsvMatchResult> {
  const subset = csvItems.slice(0, 80);

  const res = await fetch('/api/ml/csv-match-photo', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ imageBase64, csvItems: subset, mimeType }),
  });

  const parsed = await safeParseJson(res);
  if (!parsed.ok || !parsed.data?.data) {
    const errorMsg =
      parsed.data?.error ||
      parsed.data?.message ||
      (parsed.status === 401
        ? 'Chave GEMINI_API_KEY inválida na Vercel.'
        : `Erro ao cruzar foto com CSV (HTTP ${parsed.status})`);
    throw new Error(errorMsg);
  }

  return parsed.data.data;
}

export async function searchKitsOnMercadoLivre(
  itemNames: string,
  description: string,
  csvItems: CsvItem[]
): Promise<KitSearchResult> {
  const subset = csvItems.slice(0, 60);

  const res = await fetch('/api/ml/kit-search', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ itemNames, description, csvItems: subset }),
  });

  const parsed = await safeParseJson(res);
  if (!parsed.ok || !parsed.data?.data) {
    const errorMsg =
      parsed.data?.error ||
      parsed.data?.message ||
      `Erro ao pesquisar kits no Mercado Livre (HTTP ${parsed.status})`;
    throw new Error(errorMsg);
  }

  return parsed.data.data;
}

export interface MlbNameSearchItemResult {
  query: string;
  primaryMlbId: string;
  searchUrl: string;
  ads: Array<{
    mlbId: string;
    title: string;
    price: string;
    url: string;
    searchUrl?: string;
    condition?: string;
    sellerType?: string;
  }>;
}

export async function searchMlbByNames(queries: string[]): Promise<MlbNameSearchItemResult[]> {
  const res = await fetch('/api/ml/search-name', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ queries }),
  });

  const parsed = await safeParseJson(res);
  if (!parsed.ok || !Array.isArray(parsed.data?.results)) {
    throw new Error(parsed.data?.error || 'Erro ao buscar códigos MLB no Mercado Livre');
  }

  return parsed.data.results;
}
