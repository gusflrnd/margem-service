// Lógica isolada — pode ser importada em outras apps também
import axios from 'axios';
import { config } from 'dotenv';
import { getTokenCached } from './tokenCache.js';
config();                            // carrega .env

/*---------------- Constantes ----------------*/
const BASE_HEADERS = {
  'Content-Type': 'application/json',
  Accept: 'application/json, text/plain, */*',
  Origin: 'https://acelereai.com',
  Referer: 'https://acelereai.com/',
  'User-Agent':
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 ' +
    '(KHTML, like Gecko) Chrome/135.0.0.0 Safari/537.36',
  'Sec-Ch-Ua':
    '"Google Chrome";v="135", "Not-A.Brand";v="8", "Chromium";v="135"',
  'Sec-Ch-Ua-Mobile': '?0',
  'Sec-Ch-Ua-Platform': '"Windows"',
  'Sec-Fetch-Dest': 'empty',
  'Sec-Fetch-Mode': 'cors',
  'Sec-Fetch-Site': 'cross-site',
};

const LOGIN_URL    = 'https://webservicesstaging.gfttech.com.br/api/v2/logar';
const BENEFITS_URL = 'https://acelereaistaging.gfttech.com.br/api/v1/marketplace/benefits';
const SIMULATE_URL = 'https://acelereaistaging.gfttech.com.br/api/v2/engine/simulate';

/*---------------- Credenciais ----------------*/
const LOGIN    = process.env.API_LOGIN;
const PASSWORD = process.env.API_PASSWORD;

/*---------------- Cache simples ----------------*/
let bearer;           // memo em memória
let tokenTs = 0;
const TTL   = (+process.env.TOKEN_TTL_MIN || 15) * 60_000;  // padrão 15 min

async function getToken () {
  const now = Date.now();
  if (bearer && now - tokenTs < TTL) return bearer;

  const { data } = await axios.post(
    LOGIN_URL,
    { login: LOGIN, password: PASSWORD },
    { headers: BASE_HEADERS },
  );
  bearer  = data.authorization || data.token;
  tokenTs = now;
  if (!bearer) throw new Error('Falha ao autenticar na API GFT');
  return getTokenCached(LOGIN);
}

const brl = v => new Intl.NumberFormat(
  'pt-BR', { style: 'currency', currency: 'BRL' }).format(v);

/*---------------- Função exportada ----------------*/
export async function buscaMargem (cpf, cpfLegalRep = '') {
  const t   = await getToken();

  /* 1. benefícios */
  const url = new URL(BENEFITS_URL);
  url.searchParams.append('cpf', cpf);
  if (cpfLegalRep) url.searchParams.append('cpfLegalRepresentative', cpfLegalRep);

  const benRes = await axios
    .get(url.toString(), { headers: { ...BASE_HEADERS, Authorization: `Bearer ${t}` } })
    .catch(e => e.response);

  if (benRes?.data?.error) {
    throw new Error(benRes.data.message || benRes.data.error);
  }
  const beneficio = benRes.data?.[0]?.beneficio;
  if (!beneficio) throw new Error('Benefícios não encontrados para o CPF');

  /* 2. simulação */
  const payload = {
    cpf,
    numeroBeneficio: beneficio.beneficio,
    idConvenio: beneficio.especie?.codigo || '3',
    bancos: ['2', '18', '5', '19'],
    margemOnline: false,
  };

  const sim = await axios
    .post(SIMULATE_URL, payload, { headers: { ...BASE_HEADERS, Authorization: `Bearer ${t}` } })
    .then(r => r.data);

  const m  = sim.margem || {};
  let resp =
    `Margem Empréstimo: ${brl(m.margemDisponivel || 0)}\n` +
    `Margem Cartão RMC: ${brl(m.margemDisponivelCartao || 0)}\n` +
    `Margem Cartão RCC: ${brl(m.margemDisponivelRCC || 0)}\n`;

  const ofertas = [];
  for (const [bank, arr] of Object.entries(sim.condicoes || {})) {
    arr.filter(o => o.status === 'success').forEach(o => {
      ofertas.push(
        `• ${bank.toUpperCase()} – ${o.produto}: ` +
        `saque ${brl(o.valorSaque)}, ` +
        `compra ${brl(o.valorCompra)}, ` +
        `limite ${brl(o.valorLimite)}`,
      );
    });
  }

  resp += ofertas.length
    ? '\nCondições disponíveis:\n' + ofertas.join('\n')
    : '\nNenhuma condição de crédito disponível.';

  return resp;
}
