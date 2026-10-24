import { spawn } from 'node:child_process';
import os from 'node:os';

// Chaque analyse lance un processus Stockfish : on borne leur nombre simultané
// et la file d'attente pour qu'un afflux de requêtes ne sature pas le serveur.
const MAX_ENGINES = Math.max(1, Number(process.env.STOCKFISH_MAX_CONCURRENT) || Math.min(2, os.availableParallelism()));
const MAX_QUEUE = Math.max(0, Number(process.env.STOCKFISH_MAX_QUEUE) || 8);
let running = 0;
const waiting = [];

export class EngineBusyError extends Error {}

function acquireEngine(signal) {
  if (running < MAX_ENGINES) {
    running += 1;
    return Promise.resolve();
  }
  if (waiting.length >= MAX_QUEUE) return Promise.reject(new EngineBusyError('Serveur occupé, réessayez dans un instant'));
  return new Promise((resolve, reject) => {
    const entry = { resolve, reject };
    waiting.push(entry);
    signal?.addEventListener('abort', () => {
      const index = waiting.indexOf(entry);
      if (index !== -1) {
        waiting.splice(index, 1);
        reject(new Error('Analyse annulée'));
      }
    }, { once: true });
  });
}

function releaseEngine() {
  const next = waiting.shift();
  if (next) next.resolve();
  else running -= 1;
}

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

export async function analyzePosition(fen, depth = 16, multiPv = 3, signal) {
  await acquireEngine(signal);
  try {
    return await runEngine(fen, depth, multiPv, signal);
  } finally {
    releaseEngine();
  }
}

function runEngine(fen, depth, multiPv, signal) {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) return reject(new Error('Analyse annulée'));
    const binary = process.env.STOCKFISH_PATH || (process.platform === 'win32' ? 'stockfish' : '/usr/games/stockfish');
    const engine = spawn(binary, [], { stdio: ['pipe', 'pipe', 'pipe'] });
    const lines = new Map();
    let buffer = '';
    const timeout = setTimeout(() => finish(new Error('Analyse Stockfish expirée')), 25000);

    const onAbort = () => finish(new Error('Analyse annulée'));
    signal?.addEventListener('abort', onAbort, { once: true });

    function finish(error) {
      clearTimeout(timeout);
      signal?.removeEventListener('abort', onAbort);
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
