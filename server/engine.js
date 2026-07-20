import { spawn } from 'node:child_process';

export function parseInfo(line) {
  if (!line.startsWith('info ') || !line.includes(' pv ')) return null;
  const depth = Number(line.match(/\bdepth (\d+)/)?.[1] || 0);
  const multipv = Number(line.match(/\bmultipv (\d+)/)?.[1] || 1);
  const scoreMatch = line.match(/\bscore (cp|mate) (-?\d+)/);
  const pv = line.split(' pv ')[1]?.trim().split(/\s+/) || [];
  if (!scoreMatch || !pv.length) return null;
  return {
    depth,
    multipv,
    score: { type: scoreMatch[1], value: Number(scoreMatch[2]) },
    pv,
  };
}

export function normalizeOllamaUrl(value) {
  const url = new URL(value);
  if (!['http:', 'https:'].includes(url.protocol)) throw new Error('Adresse Ollama invalide');
  return url.origin + url.pathname.replace(/\/$/, '');
}

export function analyzePosition(fen, depth = 16, multiPv = 3) {
  return new Promise((resolve, reject) => {
    const binary = process.env.STOCKFISH_PATH || (process.platform === 'win32' ? 'stockfish' : '/usr/games/stockfish');
    const engine = spawn(binary, [], { stdio: ['pipe', 'pipe', 'pipe'] });
    const lines = new Map();
    let buffer = '';
    const timeout = setTimeout(() => finish(new Error('Analyse Stockfish expirée')), 25000);

    function finish(error) {
      clearTimeout(timeout);
      if (!engine.killed) engine.kill();
      if (error) reject(error);
      else resolve([...lines.values()].sort((a, b) => a.multipv - b.multipv));
    }

    engine.on('error', finish);
    engine.stderr.on('data', () => {});
    engine.stdout.on('data', (chunk) => {
      buffer += chunk.toString();
      const rows = buffer.split(/\r?\n/);
      buffer = rows.pop() || '';
      for (const row of rows) {
        const parsed = parseInfo(row);
        if (parsed && parsed.depth >= depth - 1) lines.set(parsed.multipv, parsed);
        if (row.startsWith('bestmove')) finish(lines.size ? null : new Error('Stockfish sans résultat'));
      }
    });
    engine.stdin.write('uci\n');
    engine.stdin.write(`setoption name MultiPV value ${multiPv}\n`);
    engine.stdin.write(`position fen ${fen}\n`);
    engine.stdin.write(`go depth ${depth}\n`);
  });
}
