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

/* ---------- rota GET /margem ---------- */
/**
 * @route   GET /margem?cpf=00000000000[&rep=11111111111][&lead=123456]
 * @query   cpf   (obrigatório)  – CPF do beneficiário
 * @query   rep   (opcional)     – CPF do representante legal
 * @query   lead  (opcional)     – ID do lead no Kommo (se existir)
 * @returns {text/plain} resumo para o agente
 * @returns {400|500}    JSON de erro
 */
app.get('/margem', async (req, res) => {
  const cpf  = (req.query.cpf || '').replace(/\D/g, '');
  const rep  = (req.query.rep || '').replace(/\D/g, '');
  const lead = req.query.lead ? Number(req.query.lead) : null;   // ← novo

  if (!cpf) {
    return res.status(400).json({ error: 'Parâmetro "cpf" obrigatório' });
  }
  if (req.query.lead && Number.isNaN(lead)) {
    return res.status(400).json({ error: 'Parâmetro "lead" deve ser numérico' });
  }

  try {
    const texto = await buscaMargem(cpf, rep, lead);             // ← passa o lead
    res.type('text/plain').send(texto);
  } catch (err) {
    const detail = err.response?.data?.message || err.response?.data?.error;
    res.status(500).json({ error: detail || err.message });
  }
});

/* ---------- healthcheck ---------- */
app.get('/health', (_req, res) => res.json({ ok: true }));

/* ---------- inicia o servidor ---------- */
app.listen(port, () => {
  console.log(`✓ GFT Margem service ready on http://localhost:${port}`);
});
