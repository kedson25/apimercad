import React, { useState } from 'react';
import { Copy, Check, Download, FileCode, Terminal, Code2 } from 'lucide-react';
import { MLConfig, TokenResponse } from '../types/mercadolivre';

interface ExportCodeTabProps {
  config: MLConfig;
  tokenData: TokenResponse | null;
}

export const ExportCodeTab: React.FC<ExportCodeTabProps> = ({ config, tokenData }) => {
  const [activeSnippet, setActiveSnippet] = useState<'env' | 'script' | 'curl' | 'node' | 'python'>('env');
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  const envContent = `# Configurações Mercado Livre OAuth 2.0 PKCE
ML_CLIENT_ID=${config.clientId}
ML_CLIENT_SECRET=${config.clientSecret}
ML_REDIRECT_URI=${config.redirectUri}

# Tokens Gerados
ML_ACCESS_TOKEN=${tokenData?.accessToken || 'COLE_OU_GERE_SEU_ACCESS_TOKEN'}
ML_REFRESH_TOKEN=${tokenData?.refreshToken || 'COLE_OU_GERE_SEU_REFRESH_TOKEN'}
ML_TOKEN_EXPIRES_AT=${tokenData?.expiresAt ? String(tokenData.expiresAt) : ''}
`;

  const scriptContent = `/**
 * Gerador de token Mercado Livre - Node.js 20+
 *
 * Comandos:
 *   node gerar-token.cjs             -> autoriza e gera os tokens
 *   node gerar-token.cjs --refresh   -> renova tokens salvos no .env
 *   node gerar-token.cjs --self-test -> testa sem acessar a API
 */
'use strict';

const crypto = require('node:crypto');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const readline = require('node:readline/promises');

// ===== CONFIGURACAO =====
const CLIENT_ID = '${config.clientId}';
const CLIENT_SECRET = '${config.clientSecret}';
const REDIRECT_URI = '${config.redirectUri}';
const PKCE_ENABLED = ${config.pkceEnabled};
// ========================

const ENV_PATH = path.join(__dirname, '.env');

function assertConfig() {
  if (!CLIENT_ID || !/^\\d+$/.test(CLIENT_ID)) throw new Error('CLIENT_ID invalido.');
  if (!CLIENT_SECRET) throw new Error('CLIENT_SECRET invalido.');
  let uri;
  try { uri = new URL(REDIRECT_URI); }
  catch { throw new Error('REDIRECT_URI invalida.'); }
  if (uri.protocol !== 'https:' || uri.search || uri.hash) {
    throw new Error('REDIRECT_URI precisa ser HTTPS e nao conter query/hash.');
  }
}

function createAuthorization() {
  const state = crypto.randomBytes(24).toString('hex');
  const verifier = crypto.randomBytes(48).toString('base64url');
  const challenge = crypto.createHash('sha256').update(verifier).digest('base64url');
  const url = new URL('https://auth.mercadolivre.com.br/authorization');
  url.searchParams.set('response_type', 'code');
  url.searchParams.set('client_id', CLIENT_ID);
  url.searchParams.set('redirect_uri', REDIRECT_URI);
  url.searchParams.set('state', state);
  if (PKCE_ENABLED) {
    url.searchParams.set('code_challenge', challenge);
    url.searchParams.set('code_challenge_method', 'S256');
  }
  return { state, verifier, challenge, url: url.toString() };
}

function readEnv(filename) {
  if (!fs.existsSync(filename)) return {};
  const values = {};
  for (const line of fs.readFileSync(filename, 'utf8').split(/\\r?\\n/)) {
    const match = line.match(/^\\s*([A-Za-z_][A-Za-z0-9_]*)=(.*)$/);
    if (match) values[match[1]] = match[2];
  }
  return values;
}

function updateEnv(filename, updates) {
  const previous = fs.existsSync(filename)
    ? fs.readFileSync(filename, 'utf8').replace(/\\r\\n/g, '\\n')
    : '';
  const lines = previous ? previous.replace(/\\n$/, '').split('\\n') : [];
  for (const [key, value] of Object.entries(updates)) {
    if (value == null) continue;
    const safeValue = String(value).replace(/[\\r\\n]/g, '');
    const match = new RegExp(\`^\\\\s*\${key}\\\\s*=\`);
    const index = lines.findIndex(line => match.test(line));
    if (index < 0) lines.push(\`\${key}=\${safeValue}\`);
    else lines[index] = \`\${key}=\${safeValue}\`;
  }
  const temp = \`\${filename}.\${process.pid}.tmp\`;
  try {
    fs.writeFileSync(temp, lines.join('\\n') + '\\n', { encoding: 'utf8', mode: 0o600 });
    fs.renameSync(temp, filename);
  } finally {
    if (fs.existsSync(temp)) fs.unlinkSync(temp);
  }
}

function parseCallback(text, expectedState) {
  let actual;
  try { actual = new URL(text.trim()); }
  catch { throw new Error('Cole a URL completa da barra de enderecos, com https://.'); }
  const expected = new URL(REDIRECT_URI);
  if (actual.origin !== expected.origin || actual.pathname !== expected.pathname) {
    throw new Error('O endereco retornado nao corresponde a REDIRECT_URI.');
  }
  if (actual.searchParams.get('state') !== expectedState) {
    throw new Error('State invalido.');
  }
  const failure = actual.searchParams.get('error');
  if (failure) throw new Error('Autorizacao negada: ' + failure);
  const code = actual.searchParams.get('code');
  if (!code) throw new Error('A URL nao contem code=');
  return code;
}

async function postToken(body) {
  const response = await fetch('https://api.mercadolibre.com/oauth/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded', Accept: 'application/json' },
    body: body.toString()
  });
  const data = await response.json();
  if (!response.ok) throw new Error(\`OAuth HTTP \${response.status}: \${data.error_description || data.message}\`);
  return data;
}

async function generateToken() {
  const auth = createAuthorization();
  console.log('\\n1. Abra este link no navegador:\\n' + auth.url + '\\n');
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  let pasted;
  try { pasted = await rl.question('Cole a URL COMPLETA aqui: '); }
  finally { rl.close(); }
  const code = parseCallback(pasted, auth.state);
  const body = new URLSearchParams({
    grant_type: 'authorization_code',
    client_id: CLIENT_ID,
    client_secret: CLIENT_SECRET,
    code,
    redirect_uri: REDIRECT_URI
  });
  if (PKCE_ENABLED) body.set('code_verifier', auth.verifier);
  const tokens = await postToken(body);
  updateEnv(ENV_PATH, {
    ML_ACCESS_TOKEN: tokens.access_token,
    ML_REFRESH_TOKEN: tokens.refresh_token,
    ML_TOKEN_EXPIRES_AT: String(Date.now() + tokens.expires_in * 1000)
  });
  console.log('Tokens salvos com sucesso no .env!');
}

async function refreshToken() {
  const refresh = readEnv(ENV_PATH).ML_REFRESH_TOKEN;
  if (!refresh) throw new Error('ML_REFRESH_TOKEN nao encontrado no .env.');
  const tokens = await postToken(new URLSearchParams({
    grant_type: 'refresh_token',
    client_id: CLIENT_ID,
    client_secret: CLIENT_SECRET,
    refresh_token: refresh
  }));
  updateEnv(ENV_PATH, {
    ML_ACCESS_TOKEN: tokens.access_token,
    ML_REFRESH_TOKEN: tokens.refresh_token,
    ML_TOKEN_EXPIRES_AT: String(Date.now() + tokens.expires_in * 1000)
  });
  console.log('Token renovado com sucesso!');
}

(async () => {
  assertConfig();
  if (process.argv.includes('--refresh')) return refreshToken();
  return generateToken();
})().catch(e => { console.error('ERRO:', e.message); process.exit(1); });
`;

  const curlContent = `# 1. Consultar dados da conta autenticada
curl -X GET "https://api.mercadolibre.com/users/me" \\
  -H "Authorization: Bearer ${tokenData?.accessToken || 'SEU_ACCESS_TOKEN'}"

# 2. Consultar anúncios ativos
curl -X GET "https://api.mercadolibre.com/users/${tokenData?.userId || 'USER_ID'}/items/search?status=active" \\
  -H "Authorization: Bearer ${tokenData?.accessToken || 'SEU_ACCESS_TOKEN'}"

# 3. Renovar o token via cURL
curl -X POST "https://api.mercadolibre.com/oauth/token" \\
  -H "Content-Type: application/x-www-form-urlencoded" \\
  -d "grant_type=refresh_token" \\
  -d "client_id=${config.clientId}" \\
  -d "client_secret=${config.clientSecret}" \\
  -d "refresh_token=${tokenData?.refreshToken || 'SEU_REFRESH_TOKEN'}"
`;

  const nodeContent = `import axios from 'axios';

const ML_API = axios.create({
  baseURL: 'https://api.mercadolibre.com',
  headers: {
    Authorization: 'Bearer ${tokenData?.accessToken || 'SEU_ACCESS_TOKEN'}',
  },
});

// Exemplo: obter dados do usuário
async function getMyProfile() {
  try {
    const res = await ML_API.get('/users/me');
    console.log('Logado como:', res.data.nickname);
  } catch (error) {
    if (error.response?.status === 401) {
      console.log('Token expirado. Execute a renovação com refresh_token.');
    }
  }
}

getMyProfile();
`;

  const pythonContent = `import requests

ACCESS_TOKEN = "${tokenData?.accessToken || 'SEU_ACCESS_TOKEN'}"

headers = {
    "Authorization": f"Bearer {ACCESS_TOKEN}"
}

# Consultar dados do usuário autenticado
response = requests.get("https://api.mercadolibre.com/users/me", headers=headers)

if response.status_code == 200:
    data = response.json()
    print("Usuário autenticado:", data.get("nickname"))
    print("ID:", data.get("id"))
else:
    print(f"Erro {response.status_code}:", response.text)
`;

  const copySnippet = (text: string, key: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 2000);
  };

  const downloadFile = (filename: string, content: string, type = 'text/plain') => {
    const blob = new Blob([content], { type });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6">
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-6 shadow-xs">
        <div className="mb-6 pb-4 border-b border-slate-100 dark:border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h2 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <Code2 className="w-4 h-4 text-amber-500" />
              Arquivos de Exportação e Exemplos de Integração
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
              Copie ou baixe as variáveis de ambiente, o script Node.js ou snippets prontos para sua aplicação.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => downloadFile('.env', envContent)}
              className="px-3 py-1.5 text-xs font-semibold rounded-md bg-slate-900 text-white dark:bg-amber-400 dark:text-slate-950 hover:bg-slate-800 flex items-center gap-1.5 shadow-xs"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Baixar .env</span>
            </button>
            <button
              type="button"
              onClick={() => downloadFile('gerar-token.cjs', scriptContent, 'application/javascript')}
              className="px-3 py-1.5 text-xs font-medium rounded-md bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:bg-slate-200 flex items-center gap-1.5"
            >
              <FileCode className="w-3.5 h-3.5" />
              <span>Baixar Script .cjs</span>
            </button>
          </div>
        </div>

        {/* Snippet Tabs */}
        <div className="flex items-center gap-1 p-1 bg-slate-100 dark:bg-slate-950 rounded-lg max-w-fit mb-4">
          <button
            type="button"
            onClick={() => setActiveSnippet('env')}
            className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
              activeSnippet === 'env'
                ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-xs'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
            }`}
          >
            Arquivo .env
          </button>
          <button
            type="button"
            onClick={() => setActiveSnippet('script')}
            className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
              activeSnippet === 'script'
                ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-xs'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
            }`}
          >
            gerar-token.cjs
          </button>
          <button
            type="button"
            onClick={() => setActiveSnippet('curl')}
            className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
              activeSnippet === 'curl'
                ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-xs'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
            }`}
          >
            cURL (Terminal)
          </button>
          <button
            type="button"
            onClick={() => setActiveSnippet('node')}
            className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
              activeSnippet === 'node'
                ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-xs'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
            }`}
          >
            Node.js
          </button>
          <button
            type="button"
            onClick={() => setActiveSnippet('python')}
            className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
              activeSnippet === 'python'
                ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-xs'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
            }`}
          >
            Python
          </button>
        </div>

        {/* Code display */}
        <div className="relative">
          <button
            type="button"
            onClick={() => {
              const text =
                activeSnippet === 'env'
                  ? envContent
                  : activeSnippet === 'script'
                  ? scriptContent
                  : activeSnippet === 'curl'
                  ? curlContent
                  : activeSnippet === 'node'
                  ? nodeContent
                  : pythonContent;
              copySnippet(text, activeSnippet);
            }}
            className="absolute right-3 top-3 px-2.5 py-1 text-xs font-medium rounded-md bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 flex items-center gap-1 z-10 transition-colors"
          >
            {copiedKey === activeSnippet ? (
              <>
                <Check className="w-3 h-3 text-emerald-400" />
                <span className="text-emerald-400">Copiado!</span>
              </>
            ) : (
              <>
                <Copy className="w-3 h-3" />
                <span>Copiar Código</span>
              </>
            )}
          </button>

          <pre className="p-4 bg-slate-950 rounded-lg text-slate-200 text-xs font-mono overflow-x-auto max-h-[460px] border border-slate-800 select-all leading-relaxed">
            {activeSnippet === 'env' && envContent}
            {activeSnippet === 'script' && scriptContent}
            {activeSnippet === 'curl' && curlContent}
            {activeSnippet === 'node' && nodeContent}
            {activeSnippet === 'python' && pythonContent}
          </pre>
        </div>
      </div>
    </div>
  );
};
