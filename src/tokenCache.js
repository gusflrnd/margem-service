// src/tokenCache.js
import { jwtDecode } from 'jwt-decode';
import { redis } from './redisClient.js';
import axios from 'axios';
import { BASE_HEADERS, LOGIN_URL, LOGIN, PASSWORD } from './gftConst.js';

const KEY = email => `gft:token:${email}`;

function ttlFromJwt(token) {
  try {
    const { exp } = jwtDecode(token);
    const secs = exp - Math.floor(Date.now() / 1000);
    return secs > 0 ? secs : 0;
  } catch {
    return 0;                        // se não for JWT
  }
}

export async function getTokenCached(email) {
  // 1. tenta achar no Redis
  const cached = await redis.get(KEY(email));
  if (cached) return cached;

  // 2. autentica na API
  const { data } = await axios.post(
    LOGIN_URL,
    { login: email, password: PASSWORD },   // email ≅ LOGIN
    { headers: BASE_HEADERS }
  );
  const token = data.authorization || data.token;
  if (!token) throw new Error('Falha ao autenticar');

  // 3. calcula TTL
  const ttl = ttlFromJwt(token) || 15 * 60; // fallback 15 min :contentReference[oaicite:5]{index=5}
  await redis.set(KEY(email), token, { EX: ttl }); // SETEX equivalente :contentReference[oaicite:6]{index=6}
  return token;
}
