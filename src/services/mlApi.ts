import { AuthUrlResponse, MLConfig, MLUser, SelfTestResult, TokenResponse, AIProductAnalysis } from '../types/mercadolivre';

export async function fetchInitialConfig(): Promise<{
  defaultClientId: string;
  defaultRedirectUri: string;
  defaultClientSecret: string;
  pkceEnabled: boolean;
  appUrl: string;
  latestTokens: TokenResponse | null;
  connectedUser?: MLUser | null;
}> {
  const res = await fetch('/api/ml/config');
  if (!res.ok) throw new Error('Falha ao carregar configurações do servidor');
  return res.json();
}

export async function createAuthUrl(config: Partial<MLConfig>): Promise<AuthUrlResponse> {
  const res = await fetch('/api/ml/create-auth-url', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(config),
  });
  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.error || 'Erro ao gerar URL de autorização');
  }
  return data;
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
  const data = await res.json();
  if (!res.ok) {
    const errorMsg = data.error || 'Erro ao trocar código por token';
    const hint = data.hint ? ` (${data.hint})` : '';
    throw new Error(`${errorMsg}${hint}`);
  }
  return data;
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
  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.error || 'Erro ao renovar token');
  }
  return data;
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
  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.error || `Erro ao testar token (HTTP ${res.status})`);
  }
  return data;
}

export async function runSelfTest(config: MLConfig): Promise<SelfTestResult> {
  const res = await fetch('/api/ml/self-test', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(config),
  });
  if (!res.ok) {
    const data = await res.json();
    throw new Error(data.error || 'Erro ao executar auto-teste');
  }
  return res.json();
}

export async function proxyApiCall(endpoint: string, method = 'GET', body?: any) {
  const res = await fetch('/api/ml/api-proxy', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ endpoint, method, body }),
  });
  const data = await res.json();
  return data;
}

export async function analyzeProductImage(productHint: string, imageUrl?: string): Promise<AIProductAnalysis> {
  const res = await fetch('/api/ml/ai-analyze-image', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ productHint, imageUrl }),
  });
  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.error || 'Erro na análise de imagem');
  }
  return data;
}

export async function scanPhotoWithGemini(imageBase64: string, mimeType?: string): Promise<import('../types/mercadolivre').GeminiPhotoScanResult> {
  const res = await fetch('/api/ml/gemini-scan-photo', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ imageBase64, mimeType }),
  });
  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.error || 'Erro ao escanear foto com Gemini');
  }
  return data.data;
}

export async function matchPhotoWithCsv(
  imageBase64: string,
  csvItems: import('../types/csvMatcher').CsvItem[],
  mimeType?: string
): Promise<import('../types/csvMatcher').CsvMatchResult> {
  const res = await fetch('/api/ml/csv-match-photo', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ imageBase64, csvItems, mimeType }),
  });
  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.error || 'Erro ao cruzar foto com itens do CSV');
  }
  return data.data;
}

export async function searchKitsOnMercadoLivre(
  itemNames: string,
  description: string,
  csvItems: import('../types/csvMatcher').CsvItem[]
): Promise<import('../types/csvMatcher').KitSearchResult> {
  const res = await fetch('/api/ml/kit-search', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ itemNames, description, csvItems }),
  });
  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.error || 'Erro ao pesquisar kits no Mercado Livre');
  }
  return data.data;
}
