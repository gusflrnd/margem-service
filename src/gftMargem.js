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

const BENEFITS_URL =
  'https://acelereaistaging.gfttech.com.br/api/v1/marketplace/benefits';

/*---------------- Credenciais ----------------*/
const LOGIN = process.env.API_LOGIN;

/*---------------- Funções utilitárias ----------------*/
async function getToken() {
  return getTokenCached(LOGIN); // cache já implementado
}
const brl = v =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(
    v ?? 0,
  );

/* ---------------- FUNÇÃO PRINCIPAL ---------------- */
export async function buscaMargem(cpf, cpfLegalRep = '') {
  const token = await getToken();

  /* 1. Consulta benefícios -------------------------------------------------- */
  const url = new URL(BENEFITS_URL);
  url.searchParams.append('cpf', cpf);
  if (cpfLegalRep) url.searchParams.append('cpfLegalRepresentative', cpfLegalRep);

  const benRes = await axios
    .get(url.toString(), {
    //headers: { ...BASE_HEADERS, Authorization: `Bearer ${token}` },
      headers: { ...BASE_HEADERS },
      validateStatus: () => true,
    })
    .catch(e => e.response);

  if (benRes?.data?.error) {
    throw new Error(benRes.data.message || benRes.data.error);
  }

  // Filtra apenas os benefícios ATIVOS
  const beneficiosAtivos = (benRes.data || []).filter(
    b => b.beneficio?.situacaoBeneficio === 'ATIVO',
  );

  if (!beneficiosAtivos.length) {
    return 'Negado: Nenhum benefício ATIVO localizado para o CPF informado.';
  }

  /* 2. Avalia a margem ------------------------------------------------------ */
  const blocos = beneficiosAtivos.map((b, idx) => {
    const { beneficio } = b;
    const numero = beneficio.beneficio;
    const m = beneficio.margem || {};
    const margemEmp = m.margemDisponivelEmprestimo ?? 0;

    const possuiMargem = margemEmp >= 19; // <<< regra solicitada

    return (
      `Benefício ${idx + 1}: ${numero}\n` +
      //`Possui Margem disponível para empréstimo: ${brl(margemEmp)}\n` +
      (possuiMargem
        ? 'Aceito: POSSUI margem para empréstimo\n'
        : 'Negado: NÃO possui margem nenhuma para empréstimo (< 19)\n')
    );
  });

  /* 3. Resultado final ------------------------------------------------------ */
  return blocos.join('\n');
}
