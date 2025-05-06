// src/gftConst.js  (ESM)
import { config } from 'dotenv';
config();                               // lê .env apenas uma vez

/* ---------- HEADERS usados em TODAS as chamadas ---------- */
export const BASE_HEADERS = {
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

/* ---------- URLs fixas ---------- */
export const LOGIN_URL    = 'https://webservicesstaging.gfttech.com.br/api/v2/logar';
export const BENEFITS_URL = 'https://acelereaistaging.gfttech.com.br/api/v1/marketplace/benefits';
export const SIMULATE_URL = 'https://acelereaistaging.gfttech.com.br/api/v2/engine/simulate';

/* ---------- Credenciais ---------- */
export const LOGIN    = process.env.API_LOGIN;
export const PASSWORD = process.env.API_PASSWORD;
