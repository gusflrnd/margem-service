
import express from 'express';
import helmet  from 'helmet';
import morgan  from 'morgan';
import { config } from 'dotenv';
import { buscaMargem } from './gftMargem.js';

config();                                // .env

const app  = express();
const port = process.env.PORT || 3000;

/* ---------- middlewares ---------- */
app.use(helmet());
app.use(morgan('tiny'));
app.use(express.json());

/* ---------- rota GET / ---------- */
app.get('/', (_req, res) => res.send('GFT Margem API running'));

/* ---------- rota GET /margem ---------- */
/**
 * @route GET /margem?cpf=00000000000[&rep=11111111111]
 * @returns { text/plain }  mensagem formatada
 * @returns { 400 | 500 }   JSON de erro
 */
app.get('/margem', async (req, res) => {
  const cpf = (req.query.cpf || '').replace(/\D/g, '');
  const rep = (req.query.rep || '').replace(/\D/g, '');

  if (!cpf) return res.status(400).json({ error: 'Parâmetro "cpf" obrigatório' });

  try {
    const texto = await buscaMargem(cpf, rep);
    res.type('text/plain').send(texto);
  } catch (err) {
    const detail = err.response?.data?.message || err.response?.data?.error;
    res.status(500).json({ error: detail || err.message });
  }
});

/* ---------- healthcheck ---------- */
app.get('/health', (_req, res) => res.json({ ok: true }));

/* ---------- inicia o servidor ---------- */
app.listen(port, '0.0.0.0', () => {
  console.log(`✓ GFT Margem service ready on http://0.0.0.0:${port}`);
});
