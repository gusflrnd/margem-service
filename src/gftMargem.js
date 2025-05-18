// gftMargem.js
import axios from 'axios';
import { config } from 'dotenv';
import { getTokenCached } from './tokenCache.js';
config();

/*---------- Constantes ----------*/
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

// --- Kommo ---
const KOMMO_URL = 'https://damaconsig.kommo.com/api/v4/leads';
const KOMMO_TOKEN = process.env.API_KOMMO;          // só o token, sem "Bearer "
const KOMMO_HEADERS = {
  'Content-Type': 'application/json',
  Authorization: `Bearer ${KOMMO_TOKEN}`,
};

/*---------- Credenciais ----------*/
const LOGIN = process.env.API_LOGIN;

/*---------- Utilidades ----------*/
async function getToken() {
  return getTokenCached(LOGIN);
}
const brl = v =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(
    v ?? 0,
  );

/*---------- Funções de movimentação ----------*/
const moverLead = async (leadId, statusId) => {
  if (!leadId) {
    console.error('⚠️  moverLead: leadId vazio');
    return;
  }
  const body = { pipeline_id: 11169635, status_id: statusId };
  const url = `${KOMMO_URL}/${leadId}`;

  try {
    console.log('➡️  PATCH', url, body);
    const res = await axios.patch(url, body, { headers: KOMMO_HEADERS });
    console.log('✅ Kommo status', res.status);
  } catch (err) {
    console.error(
      '❌ Kommo erro',
      err?.response?.status,
      err?.response?.data || err.message,
    );
  }
};

const moverLeadParaAprovado = leadId => moverLead(leadId, 85709555); // COM margem
const moverLeadSemMargem    = leadId => moverLead(leadId, 85710815); // SEM margem

/*---------- Função principal ----------*/
export async function buscaMargem(cpf, cpfLegalRep = '', lead = null) {
  const token = await getToken();

  /* 1. Consulta benefícios */
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

  /* 1.1 Erros tratados explicitamente */
  if (benRes?.data?.error) {
    const raw = benRes.data.message || benRes.data.error || '';

    // "Não encontrados dados" → move para SEM margem
    if (/não\s*foram\s*encontrados\s*dados/i.test(raw)) {
      if (lead) await moverLeadSemMargem(lead);
      return 'Inexistente: Nenhum benefício ATIVO localizado para o CPF informado.';
    }

    // CPF inválido (não movimenta)
    if (/cpf\s*inv[aá]lido/i.test(raw)) {
      return 'O número do CPF do beneficiário está incorreto, digite um número válido.';
    }

    // Outros erros → 500
    throw new Error(raw);
  }

  /* 2. Filtra benefícios ATIVOS */
  const beneficiosAtivos = (benRes.data || []).filter(
    b => b.beneficio?.situacaoBeneficio === 'ATIVO',
  );

  if (!beneficiosAtivos.length) {
    if (lead) await moverLeadSemMargem(lead);      // ← NOVO
    return 'Inexistente: Nenhum benefício ATIVO localizado para o CPF informado.';
  }

  /* 3. Representante legal */
  const exigeRepresentante =
    !cpfLegalRep &&
    beneficiosAtivos.some(
      b => b.beneficio?.possuiRepresentanteLegalProcurador === true,
    );

  if (exigeRepresentante) {
    return 'Informe: O benefício possui um representante legal, informe o CPF do representante também.';
  }

  /* 4. Avalia margem */
  let possuiAlgumaMargem = false;

  const blocos = beneficiosAtivos.map((b, idx) => {
    const { beneficio } = b;
    const numero = beneficio.beneficio;
    const m = beneficio.margem || {};
    const margemEmp = m.margemDisponivelEmprestimo ?? 0;

    const possuiMargem = margemEmp >= 19;
    if (possuiMargem) possuiAlgumaMargem = true;

    return (
      `Benefício ${idx + 1}: ${numero}\n` +
      (possuiMargem
        ? 'Aceito: POSSUI margem para empréstimo\n'
        : 'Negado: NÃO possui margem nenhuma para empréstimo\n')
    );
  });

  /* 5. Movimenta o lead */
  if (lead) {
    if (possuiAlgumaMargem) {
      await moverLeadParaAprovado(lead);   // 85709555
    } else {
      await moverLeadSemMargem(lead);      // 85710815
    }
  }

  /* 6. Retorno para o agente */
  return blocos.join('\n');
}
