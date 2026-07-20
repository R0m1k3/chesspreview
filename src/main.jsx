import React, { useEffect, useMemo, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { Chess } from 'chess.js';
import { Brain, ChevronRight, CircleHelp, FlipVertical2, Lightbulb, LoaderCircle, RotateCcw, Settings, Sparkles, X } from 'lucide-react';
import './styles.css';

const PIECES = { p: '♟', n: '♞', b: '♝', r: '♜', q: '♛', k: '♚', P: '♟', N: '♞', B: '♝', R: '♜', Q: '♛', K: '♚' };
const FILES = ['a','b','c','d','e','f','g','h'];
const RANKS = ['8','7','6','5','4','3','2','1'];
const START_FEN = new Chess().fen();
const defaultSettings = { ollamaUrl: 'http://host.docker.internal:11434', model: 'qwen3:8b', depth: 16 };

function scoreLabel(score) {
  if (!score) return '—';
  if (score.type === 'mate') return `M${Math.abs(score.value)}`;
  const value = score.value / 100;
  return `${value >= 0 ? '+' : ''}${value.toFixed(1)}`;
}

function ChessBoard({ game, orientation, selected, targets, bestMove, lastMove, onSquare }) {
  const files = orientation === 'white' ? FILES : [...FILES].reverse();
  const ranks = orientation === 'white' ? RANKS : [...RANKS].reverse();
  const boardRef = useRef(null);
  const [dragFrom, setDragFrom] = useState(null);
  const arrow = useMemo(() => {
    if (!bestMove) return null;
    const index = (square) => ({ x: files.indexOf(square[0]), y: ranks.indexOf(square[1]) });
    const from = index(bestMove.slice(0, 2));
    const to = index(bestMove.slice(2, 4));
    return { x1: (from.x + .5) * 12.5, y1: (from.y + .5) * 12.5, x2: (to.x + .5) * 12.5, y2: (to.y + .5) * 12.5 };
  }, [bestMove, files.join(''), ranks.join('')]);

  return <div className="board-shell">
    <div className="board" ref={boardRef} aria-label="Échiquier interactif">
      {ranks.flatMap((rank, row) => files.map((file, col) => {
        const square = `${file}${rank}`;
        const piece = game.get(square);
        const code = piece ? (piece.color === 'w' ? piece.type.toUpperCase() : piece.type) : null;
        const dark = (FILES.indexOf(file) + Number(rank)) % 2 === 1;
        const isLast = lastMove?.includes(square);
        const isBest = bestMove?.slice(0, 2) === square || bestMove?.slice(2, 4) === square;
        return <button
          type="button"
          key={square}
          className={`square ${dark ? 'dark' : 'light'} ${selected === square ? 'selected' : ''} ${isLast ? 'last' : ''} ${isBest ? 'best' : ''}`}
          onClick={() => onSquare(square)}
          onDragOver={(event) => event.preventDefault()}
          onDrop={() => { if (dragFrom) onSquare(square, dragFrom); setDragFrom(null); }}
          aria-label={`${square}${piece ? ` ${piece.type}` : ''}`}
        >
          {col === 0 && <span className="rank-label">{rank}</span>}
          {row === 7 && <span className="file-label">{file}</span>}
          {targets.includes(square) && <span className={`target ${piece ? 'capture' : ''}`} />}
          {piece && <span className={`piece ${piece.color === 'w' ? 'white-piece' : 'black-piece'}`} draggable onDragStart={() => setDragFrom(square)}>{PIECES[code]}</span>}
        </button>;
      }))}
      {arrow && <svg className="arrow" viewBox="0 0 100 100" aria-hidden="true">
        <defs><marker id="head" markerWidth="4" markerHeight="4" refX="2.2" refY="2" orient="auto"><path d="M0,0 L4,2 L0,4 z" /></marker></defs>
        <line {...arrow} markerEnd="url(#head)" />
      </svg>}
    </div>
  </div>;
}

function SettingsPanel({ value, onSave, onClose }) {
  const [form, setForm] = useState(value);
  const [status, setStatus] = useState(null);
  const [models, setModels] = useState([]);
  async function testConnection() {
    setStatus('loading');
    try {
      const response = await fetch('/api/ollama/test', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ url: form.ollamaUrl }) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error);
      setModels(data.models);
      setStatus('ok');
    } catch (error) { setStatus(error.message); }
  }
  return <div className="modal-backdrop" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
    <section className="settings-panel" role="dialog" aria-modal="true" aria-label="Réglages">
      <div className="panel-heading"><div><span className="eyebrow">CONNEXIONS</span><h2>Réglages du studio</h2></div><button className="icon-button" onClick={onClose}><X size={20}/></button></div>
      <label>Adresse Ollama<input value={form.ollamaUrl} onChange={(e) => setForm({ ...form, ollamaUrl: e.target.value })} placeholder="http://192.168.1.10:11434" /></label>
      <p className="field-note">Depuis Docker Desktop, <code>host.docker.internal</code> atteint Ollama installé sur cette machine.</p>
      <label>Modèle<input list="model-list" value={form.model} onChange={(e) => setForm({ ...form, model: e.target.value })} /><datalist id="model-list">{models.map((m) => <option key={m} value={m}/>)}</datalist></label>
      <div className="recommendation"><Sparkles size={17}/><span><strong>Conseil</strong> — qwen3:8b offre bon équilibre. qwen3:30b produit meilleures explications si machine distante possède ~24 Go de RAM/VRAM.</span></div>
      <label>Profondeur Stockfish <span>{form.depth}</span><input type="range" min="10" max="22" value={form.depth} onChange={(e) => setForm({ ...form, depth: Number(e.target.value) })}/></label>
      <div className="settings-actions"><button className="secondary" onClick={testConnection}>{status === 'loading' ? <LoaderCircle className="spin" size={16}/> : null} Tester Ollama</button><button className="primary" onClick={() => onSave(form)}>Enregistrer</button></div>
      {status && status !== 'loading' && <p className={`connection-status ${status === 'ok' ? 'success' : 'error'}`}>{status === 'ok' ? `${models.length} modèle(s) disponible(s)` : status}</p>}
    </section>
  </div>;
}

function App() {
  const [fen, setFen] = useState(START_FEN);
  const [moves, setMoves] = useState([]);
  const [history, setHistory] = useState([]);
  const [selected, setSelected] = useState(null);
  const [orientation, setOrientation] = useState('white');
  const [analysis, setAnalysis] = useState([]);
  const [analyzing, setAnalyzing] = useState(true);
  const [error, setError] = useState('');
  const [explanation, setExplanation] = useState('');
  const [explaining, setExplaining] = useState(false);
  const [showHint, setShowHint] = useState(true);
  const [showSettings, setShowSettings] = useState(false);
  const [settings, setSettings] = useState(() => {
    try { return { ...defaultSettings, ...JSON.parse(localStorage.getItem('atelier64-settings')) }; } catch { return defaultSettings; }
  });
  const game = useMemo(() => new Chess(fen), [fen]);
  const targets = selected ? game.moves({ square: selected, verbose: true }).map((m) => m.to) : [];
  const bestMove = showHint ? analysis[0]?.pv?.[0] : null;
  const lastMove = moves.at(-1)?.uci;

  useEffect(() => {
    const controller = new AbortController();
    const timer = setTimeout(async () => {
      setAnalyzing(true); setError(''); setExplanation('');
      try {
        const response = await fetch('/api/analyze', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ fen, depth: settings.depth }), signal: controller.signal });
        const data = await response.json();
        if (!response.ok) throw new Error(data.error);
        setAnalysis(data.lines || []);
      } catch (err) { if (err.name !== 'AbortError') setError(err.message); }
      finally { if (!controller.signal.aborted) setAnalyzing(false); }
    }, 250);
    return () => { clearTimeout(timer); controller.abort(); };
  }, [fen, settings.depth]);

  function attemptMove(from, to) {
    const next = new Chess(fen);
    try {
      const move = next.move({ from, to, promotion: 'q' });
      setHistory([...history, { fen, moves }]);
      setMoves([...moves, { san: move.san, uci: `${move.from}${move.to}${move.promotion || ''}`, color: move.color }]);
      setFen(next.fen()); setSelected(null); setShowHint(true);
    } catch { setSelected(next.get(to)?.color === next.turn() ? to : null); }
  }

  function onSquare(square, draggedFrom) {
    if (game.isGameOver()) return;
    if (draggedFrom) return attemptMove(draggedFrom, square);
    if (selected) {
      if (selected === square) return setSelected(null);
      if (targets.includes(square)) return attemptMove(selected, square);
    }
    setSelected(game.get(square)?.color === game.turn() ? square : null);
  }

  function undo() {
    const previous = history.at(-1);
    if (!previous) return;
    setFen(previous.fen); setMoves(previous.moves); setHistory(history.slice(0, -1)); setSelected(null);
  }

  function reset() { setFen(START_FEN); setMoves([]); setHistory([]); setSelected(null); setAnalysis([]); setExplanation(''); }

  async function explain() {
    if (!analysis.length) return;
    setExplaining(true); setError('');
    try {
      const response = await fetch('/api/explain', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ url: settings.ollamaUrl, model: settings.model, fen, lastMove: moves.at(-1)?.san, lines: analysis.map((l) => ({ score: l.score, line: l.moves?.map((m) => m.san) })) }) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error);
      setExplanation(data.explanation);
    } catch (err) { setError(err.message); }
    finally { setExplaining(false); }
  }

  const status = game.isCheckmate() ? `Échec et mat — ${game.turn() === 'w' ? 'Noirs' : 'Blancs'} gagnent` : game.isDraw() ? 'Partie nulle' : game.inCheck() ? `Échec aux ${game.turn() === 'w' ? 'Blancs' : 'Noirs'}` : `${game.turn() === 'w' ? 'Blancs' : 'Noirs'} au trait`;
  const rawScore = analysis[0]?.score;
  const whiteScore = rawScore?.type === 'cp' ? (game.turn() === 'w' ? rawScore.value : -rawScore.value) : 0;
  const whiteShare = Math.max(8, Math.min(92, 50 + whiteScore / 15));

  return <div className="app">
    <header>
      <a className="brand" href="#" onClick={(e) => e.preventDefault()}><span className="brand-mark">64</span><span><strong>ATELIER</strong><small>STUDIO D’ÉCHECS</small></span></a>
      <div className="header-status"><span className="pulse"/> STOCKFISH ACTIF <i/> PROFONDEUR {settings.depth}</div>
      <button className="settings-button" onClick={() => setShowSettings(true)}><Settings size={17}/> Réglages</button>
    </header>

    <main>
      <section className="game-column">
        <div className="game-meta"><div><span className="eyebrow">PARTIE LIBRE · DEUX CÔTÉS</span><h1>{status}</h1></div><div className="turn-chip"><span className={game.turn() === 'w' ? 'mini-white' : 'mini-black'}/>{game.turn() === 'w' ? 'BLANCS' : 'NOIRS'}</div></div>
        <div className="board-area">
          <div className="eval-bar" aria-label="Évaluation"><span className="eval-number">{scoreLabel(rawScore)}</span><div className="eval-track"><div className="eval-white" style={{ height: `${whiteShare}%` }}/></div></div>
          <ChessBoard game={game} orientation={orientation} selected={selected} targets={targets} bestMove={bestMove} lastMove={lastMove} onSquare={onSquare}/>
        </div>
        <div className="board-actions">
          <button onClick={undo} disabled={!history.length}><RotateCcw size={17}/> Annuler</button>
          <button onClick={() => setOrientation(orientation === 'white' ? 'black' : 'white')}><FlipVertical2 size={17}/> Retourner</button>
          <button onClick={reset}>Nouvelle partie</button>
        </div>
      </section>

      <aside className="coach-column">
        <div className="coach-title"><div className="coach-orb"><Brain size={24}/></div><div><span className="eyebrow">ANALYSE EN DIRECT</span><h2>Le Cabinet</h2></div>{analyzing && <LoaderCircle className="spin analysis-spinner" size={18}/>}</div>
        <section className="best-card">
          <span className="card-index">01</span><span className="card-label">MEILLEUR COUP</span>
          {analysis[0] ? <><div className="best-move"><strong>{analysis[0].moves?.[0]?.san || analysis[0].pv[0]}</strong><span>{scoreLabel(analysis[0].score)}</span></div><p>Suggestion Stockfish pour position actuelle.</p><button className={`hint-toggle ${showHint ? 'active' : ''}`} onClick={() => setShowHint(!showHint)}><Lightbulb size={16}/>{showHint ? 'Indice visible' : 'Afficher indice'}</button></> : <div className="empty-analysis">{analyzing ? 'Calcul de la position…' : game.isGameOver() ? 'Partie terminée.' : 'Analyse indisponible.'}</div>}
        </section>

        <section className="variations">
          <div className="section-label"><span>VARIANTES PRINCIPALES</span><span>ÉVAL.</span></div>
          {analysis.slice(0, 3).map((line, index) => <div className="variation" key={index}><span className="variation-number">{String(index + 1).padStart(2, '0')}</span><div>{line.moves?.slice(0, 6).map((m, i) => <span key={i} className={i === 0 ? 'first-san' : ''}>{m.san} </span>)}</div><b>{scoreLabel(line.score)}</b></div>)}
        </section>

        <section className="coach-note">
          <div className="note-heading"><CircleHelp size={17}/><span>REGARD DU MAÎTRE</span></div>
          {explanation ? <p>{explanation}</p> : <p>Demandez au modèle Ollama de transformer calcul moteur en conseil humain, adapté à cette position.</p>}
          <button className="explain-button" onClick={explain} disabled={explaining || !analysis.length}>{explaining ? <LoaderCircle className="spin" size={17}/> : <Sparkles size={17}/>} {explanation ? 'Réexpliquer' : 'Expliquer ce coup'} <ChevronRight size={16}/></button>
        </section>
        {error && <div className="error-banner">{error}</div>}
        <section className="moves-panel"><div className="section-label"><span>FEUILLE DE PARTIE</span><span>{Math.ceil(moves.length / 2)} COUPS</span></div><div className="move-list">{Array.from({ length: Math.ceil(moves.length / 2) }, (_, i) => <div className="move-row" key={i}><span>{i + 1}.</span><b>{moves[i * 2]?.san}</b><b>{moves[i * 2 + 1]?.san}</b></div>)}{!moves.length && <span className="moves-empty">Déplacez une pièce pour commencer.</span>}</div></section>
      </aside>
    </main>
    <footer><span>ATELIER 64</span><span>Les coups viennent de Stockfish · Les explications viennent de {settings.model}</span></footer>
    {showSettings && <SettingsPanel value={settings} onClose={() => setShowSettings(false)} onSave={(next) => { setSettings(next); localStorage.setItem('atelier64-settings', JSON.stringify(next)); setShowSettings(false); }}/>} 
  </div>;
}

createRoot(document.getElementById('root')).render(<App />);
