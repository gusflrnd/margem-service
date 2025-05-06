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

const LOGIN_URL = 'https://webservicesstaging.gfttech.com.br/api/v2/logar';
const BENEFITS_URL = 'https://acelereaistaging.gfttech.com.br/api/v1/marketplace/benefits';
const SIMULATE_URL = 'https://acelereaistaging.gfttech.com.br/api/v2/engine/simulate';

/*---------------- Credenciais ----------------*/
const LOGIN = process.env.API_LOGIN;
const PASSWORD = process.env.API_PASSWORD;

/*---------------- Cache simples ----------------*/
let bearer;           // memo em memória
let tokenTs = 0;
const TTL = (+process.env.TOKEN_TTL_MIN || 15) * 60_000;  // padrão 15 min

async function getToken() {
    return getTokenCached(LOGIN);
}

const brl = v => new Intl.NumberFormat(
    'pt-BR', { style: 'currency', currency: 'BRL' }).format(v);

/*---------------- Função exportada ----------------*/
/* ---------------- FUNÇÃO PRINCIPAL ---------------- */
export async function buscaMargem(cpf, cpfLegalRep = '') {
    const t = await getToken();         // já pega o token com cache

    /* 1. TODOS os benefícios ------------------------------------------------ */
    const url = new URL(BENEFITS_URL);
    url.searchParams.append('cpf', cpf);
    if (cpfLegalRep) url.searchParams.append('cpfLegalRepresentative', cpfLegalRep);

    const benRes = await axios
        .get(url.toString(), { headers: { ...BASE_HEADERS, Authorization: `Bearer ${t}` } })
        .catch(e => e.response);

    if (benRes?.data?.error) {
        throw new Error(benRes.data.message || benRes.data.error);
    }
    console.log(benRes.data)
    // -- filtra apenas os benefícios ativos
    const beneficiosAtivos = (benRes.data || []).filter(
        b => b.beneficio?.situacaoBeneficio === 'ATIVO',
    );

    if (!beneficiosAtivos.length) {
        return 'Nenhum benefício ATIVO localizado para o CPF informado.';
    }

    /* 2. Simula **cada** benefício ativo ------------------------------------ */
    const resultados = await Promise.all(
        beneficiosAtivos.map(async (b, idx) => {
            const numeroBeneficio = b.beneficio.beneficio;
            const convenio = b.beneficio?.IdOrigem || '3';

            const payload = {
                cpf,
                numeroBeneficio,
                idConvenio: convenio,
                bancos: ['2'],            // apenas banco 2
                margemOnline: true,
            };
            
            console.log(payload)

            // tenta simular; se a API falhar, captura a mensagem
            let simData, simErr;
            try {
                const simResp = await axios.post(
                    SIMULATE_URL,
                    payload,
                    {
                        headers: { ...BASE_HEADERS, Authorization: `Bearer ${t}` },
                        validateStatus: () => true,
                    },
                );
                if (simResp.status >= 400) {
                    simErr = simResp.data?.error || simResp.data?.message ||
                        `Erro ${simResp.status} na simulação`;
                } else {
                    simData = simResp.data;
                }
            } catch (e) {
                simErr = e.message;
            }
            console.log(simData)
            /* ----- formata a saída por benefício ----- */
            const cabecalho =
                `Benefício ${idx + 1}: ${numeroBeneficio} – Convênio ${convenio}\n`;

            if (simErr) {
                return cabecalho + `Não foi possível simular.\n${simErr}`;
            }

            const m = simData.margem || {};
            let bloco =
                cabecalho +
                `Margem Empréstimo: ${brl(m.margemDisponivel || 0)}\n` +
                `Margem Cartão RMC: ${brl(m.margemDisponivelCartao || 0)}\n` +
                `Margem Cartão RCC: ${brl(m.margemDisponivelRCC || 0)}\n`;

            // ofertas (status success) – pode estar ausente
            const ofertas = [];
            for (const [bank, arr] of Object.entries(simData.condicoes || {})) {
                if (!Array.isArray(arr)) continue;
                arr.filter(o => o.status === 'success').forEach(o => {
                    ofertas.push(
                        `• ${bank.toUpperCase()} – ${o.produto}: ` +
                        `saque ${brl(o.valorSaque)}, ` +
                        `compra ${brl(o.valorCompra)}, ` +
                        `limite ${brl(o.valorLimite)}`,
                    );
                });
            }

            bloco += ofertas.length
                ? '\nCondições disponíveis:\n' + ofertas.join('\n')
                : '\nNenhuma condição de crédito disponível.';

            return bloco;
        }),
    );

    /* 3. Junta tudo e devolve ---------------------------------------------- */
    return resultados.join('\n\n');      // separa blocos por linha em branco
}


