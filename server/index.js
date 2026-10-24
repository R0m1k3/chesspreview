import express from 'express';
import { Chess } from 'chess.js';
import { rateLimit } from 'express-rate-limit';
import { analyzePosition, EngineBusyError, normalizeOllamaUrl } from './engine.js';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const app = express();
const port = Number(process.env.PORT || 3000);
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
// Adresse Ollama fixée côté serveur : le client ne choisit jamais l'URL
// contactée par le serveur (sinon SSRF vers le réseau interne).
const ollamaBase = normalizeOllamaUrl(process.env.OLLAMA_URL || 'http://host.docker.internal:11434');

// Derrière un reverse proxy, TRUST_PROXY (ex. 1) permet de limiter par IP réelle.
if (process.env.TRUST_PROXY) app.set('trust proxy', Number(process.env.TRUST_PROXY) || process.env.TRUST_PROXY);

const limitMessage = { error: 'Trop de requêtes, réessayez dans une minute' };
const analyzeLimiter = rateLimit({ windowMs: 60_000, limit: Number(process.env.ANALYZE_RATE_LIMIT) || 60, standardHeaders: 'draft-7', legacyHeaders: false, message: limitMessage });
const ollamaLimiter = rateLimit({ windowMs: 60_000, limit: Number(process.env.OLLAMA_RATE_LIMIT) || 20, standardHeaders: 'draft-7', legacyHeaders: false, message: limitMessage });

app.use(express.json({ limit: '32kb' }));

app.get('/api/health', (_req, res) => res.json({ ok: true }));

app.post('/api/analyze', analyzeLimiter, async (req, res) => {
  // Le client annule l'analyse précédente à chaque coup : on arrête alors Stockfish.
  const abort = new AbortController();
  res.on('close', () => { if (!res.writableEnded) abort.abort(); });
  try {
    const chess = new Chess(req.body.fen);
    if (chess.isGameOver()) return res.json({ lines: [], gameOver: true });
    const depth = Math.max(8, Math.min(22, Number(req.body.depth) || 16));
    const raw = await analyzePosition(chess.fen(), depth, 3, abort.signal);
    const lines = raw.map((line) => {
      const replay = new Chess(chess.fen());
      const moves = [];
      for (const uci of line.pv.slice(0, 8)) {
        const move = replay.move({ from: uci.slice(0, 2), to: uci.slice(2, 4), promotion: uci[4] || 'q' });
        if (!move) break;
        moves.push({ uci, san: move.san });
      }
      return { ...line, moves };
    });
    res.json({ lines, gameOver: false });
  } catch (error) {
    if (res.writableEnded || abort.signal.aborted) return;
    res.status(error instanceof EngineBusyError ? 503 : 400).json({ error: error.message || 'Analyse impossible' });
  }
});

app.post('/api/ollama/test', ollamaLimiter, async (_req, res) => {
  try {
    const response = await fetch(`${ollamaBase}/api/tags`, { signal: AbortSignal.timeout(7000) });
    if (!response.ok) throw new Error(`Ollama répond ${response.status}`);
    const data = await response.json();
    res.json({ ok: true, models: (data.models || []).map((m) => m.name) });
  } catch (error) {
    res.status(502).json({ error: error.message || 'Connexion Ollama impossible' });
  }
});

app.post('/api/explain', ollamaLimiter, async (req, res) => {
  try {
    const { fen, lines, model = 'qwen3:8b', lastMove } = req.body;
    if (typeof model !== 'string' || model.length > 100) throw new Error('Modèle invalide');
    new Chess(fen);
    const prompt = `Tu es un entraîneur d'échecs francophone précis et encourageant. Position FEN: ${fen}. Dernier coup: ${lastMove || 'début de position'}. Variantes Stockfish: ${JSON.stringify(lines)}. Explique en français le meilleur coup, son idée tactique ou stratégique, la menace, et un piège à éviter. 120 mots maximum. N'invente aucune variante hors des données. Utilise texte simple, sans markdown.`;
    const response = await fetch(`${ollamaBase}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ model, stream: false, messages: [{ role: 'user', content: prompt }], options: { temperature: 0.25 } }),
      signal: AbortSignal.timeout(90000),
    });
    if (!response.ok) throw new Error(`Ollama répond ${response.status}`);
    const data = await response.json();
    res.json({ explanation: data.message?.content?.replace(/<think>[\s\S]*?<\/think>/g, '').trim() || 'Aucune explication reçue.' });
  } catch (error) {
    res.status(502).json({ error: error.message || 'Explication impossible' });
  }
});

app.use(express.static(path.join(root, 'dist')));
app.use((_req, res) => res.sendFile(path.join(root, 'dist', 'index.html')));

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  app.listen(port, () => console.log(`Atelier 64 écoute sur :${port}`));
}

export default app;
