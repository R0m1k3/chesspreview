import express from 'express';
import { Chess } from 'chess.js';
import { analyzePosition, normalizeOllamaUrl } from './engine.js';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const app = express();
const port = Number(process.env.PORT || 3000);
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
app.use(express.json({ limit: '32kb' }));

app.get('/api/health', (_req, res) => res.json({ ok: true }));

app.post('/api/analyze', async (req, res) => {
  try {
    const chess = new Chess(req.body.fen);
    if (chess.isGameOver()) return res.json({ lines: [], gameOver: true });
    const depth = Math.max(8, Math.min(22, Number(req.body.depth) || 16));
    const raw = await analyzePosition(chess.fen(), depth, 3);
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
    res.status(400).json({ error: error.message || 'Analyse impossible' });
  }
});

app.post('/api/ollama/test', async (req, res) => {
  try {
    const base = normalizeOllamaUrl(req.body.url);
    const response = await fetch(`${base}/api/tags`, { signal: AbortSignal.timeout(7000) });
    if (!response.ok) throw new Error(`Ollama répond ${response.status}`);
    const data = await response.json();
    res.json({ ok: true, models: (data.models || []).map((m) => m.name) });
  } catch (error) {
    res.status(502).json({ error: error.message || 'Connexion Ollama impossible' });
  }
});

app.post('/api/explain', async (req, res) => {
  try {
    const base = normalizeOllamaUrl(req.body.url);
    const { fen, lines, model = 'qwen3:8b', lastMove } = req.body;
    new Chess(fen);
    const prompt = `Tu es un entraîneur d'échecs francophone précis et encourageant. Position FEN: ${fen}. Dernier coup: ${lastMove || 'début de position'}. Variantes Stockfish: ${JSON.stringify(lines)}. Explique en français le meilleur coup, son idée tactique ou stratégique, la menace, et un piège à éviter. 120 mots maximum. N'invente aucune variante hors des données. Utilise texte simple, sans markdown.`;
    const response = await fetch(`${base}/api/chat`, {
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
