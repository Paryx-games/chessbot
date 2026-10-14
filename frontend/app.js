
const $ = s => document.querySelector(s);
const board = $('#board'), fen = $('#fen'), pal = $('#pal');
const START = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR';
const THEMES = {green:['#eeeed2','#769656'],brown:['#edd6b0','#b88762'],blue:['#dee3e6','#4b7399'],purple:['#efefef','#8475b9']};
const P = {
  p:'<path d="M19 19.5h7c0 2-1 3-1 4 3 2.5 5.5 6 5.5 10.5h-16c0-4.5 2.5-8 5.5-10.5 0-1-1-2-1-4z"/><rect x="16.5" y="18.5" width="12" height="3" rx="1.5"/><circle cx="22.5" cy="13" r="6"/>',
  r:'<path d="M16 20.5h13l1.5 13.5h-16z"/><rect x="12.5" y="17.5" width="20" height="3.5" rx="1"/><path d="M13 9h5v3h3V9h3v3h3V9h5v9.5H13z"/>',
  n:'<path d="M14 34C14 28 15 23.5 19.5 20L14 22.5C12 23 10.5 22 10.5 20.5C10.5 18.5 13 15 16 11L17 6.5L20.5 9.5C29 10 34 17 33 34Z"/><path class="n" d="M23 12c5 2 8 7 8 14"/><circle class="e" cx="17" cy="14.5" r="1.3"/><circle class="e" cx="12" cy="19.5" r=".8"/>',
  b:'<path d="M18 30.5h9c.5 2 1.5 3.5 4 3.5H14c2.5 0 3.5-1.5 4-3.5z"/><path d="M22.5 10c5.5 3.5 8 8 8 12 0 3-2 5-4.5 6h-7c-2.5-1-4.5-3-4.5-6 0-4 2.5-8.5 8-12z"/><rect x="15.5" y="27.5" width="14" height="3" rx="1.5"/><circle cx="22.5" cy="7.5" r="2.4"/><path class="n" d="M24.5 14l-4.5 6.5"/>',
  q:'<path d="M13 34L9.5 16L13.5 25L16.5 12.5L19.5 25L22.5 11L25.5 25L28.5 12.5L31.5 25L35.5 16L32 34Z"/><rect x="12.5" y="29" width="20" height="4.5" rx="2.2"/><circle cx="9.5" cy="14.5" r="2.1"/><circle cx="16.5" cy="11" r="2.1"/><circle cx="22.5" cy="9.5" r="2.1"/><circle cx="28.5" cy="11" r="2.1"/><circle cx="35.5" cy="14.5" r="2.1"/>',
  k:'<path d="M22.5 15c-6 0-11 4-11 9.5 0 3 1.5 5 3 6.5L13 34h19l-1.5-3c1.5-1.5 3-3.5 3-6.5 0-5.5-5-9.5-11-9.5z"/><rect x="12" y="29.5" width="21" height="3.5" rx="1.75"/><rect x="21" y="3" width="3" height="12" rx="1"/><rect x="17.5" y="6" width="10" height="3" rx="1"/>'
};
const BASE = '<path d="M11.5 40v-2.5c0-1.9 1.4-3.3 3.3-3.3h15.4c1.9 0 3.3 1.4 3.3 3.3V40z"/>';
let grid = Array(64).fill(''), flip = false, tool = null, drag = null, ghost = null;
let turn = 'w', ep = '-', cr = new Set('KQkq'), sfSide = null, sug = null;
let activeView = 'analyzer', legalRules = false, allowCastling = true, movePending = false;
let elo = 1600, fullStrength = true, settingsOpen = false;
let preferences = { theme: 'green', appearance: 'system', reducedMotion: false, coordinates: true, suggestions: true, soundEffects: true };
let saveEnabled = true;
const saveChoices = Object.fromEntries(['depth', 'strength', 'side', 'rules', 'automation', 'position', 'orientation', 'workspace'].map(key => [key, true]));
let configReady = false, saveTimer = null, saveChain = Promise.resolve(), closingWindow = false;
const sessions = { analyzer: null, training: null };
let halfmoves = 0, fullmoves = 1, history = [], gameState = null, stateFen = '';

const pc = ch => { const t = ch.toLowerCase(); return `<svg viewBox="0 0 45 45" class="${ch === t ? 'b' : 'w'}" stroke-width="1.5" stroke-linejoin="round">${BASE}${P[t]}</svg>`; };
const sqEl = i => board.querySelector(`[data-i="${i}"]`);
const sqAt = e => document.elementFromPoint(e.clientX, e.clientY)?.closest('.sq');

function toFen() {
  const rows = [];
  for (let r = 0; r < 8; r++) {
    let s = '', n = 0;
    for (let c = 0; c < 8; c++) {
      const ch = grid[r * 8 + c];
      if (ch) { s += (n || '') + ch; n = 0; } else n++;
    }
    rows.push(s + (n || ''));
  }
  const CR = [['K', 60, 'K', 63, 'R'], ['Q', 60, 'K', 56, 'R'], ['k', 4, 'k', 7, 'r'], ['q', 4, 'k', 0, 'r']];
  const castle = CR.filter(([f, k, kc, rk, rc]) => cr.has(f) && grid[k] === kc && grid[rk] === rc).map(x => x[0]).join('') || '-';
  return `${rows.join('/')} ${turn} ${castle} ${ep} ${halfmoves} ${fullmoves}`;
}

function load(f) {
  const parts = f.trim().split(/\s+/), rows = parts[0].split('/');
  if (rows.length !== 8) return false;
  const g = [];
  for (const r of rows) {
    let n = 0;
    for (const ch of r) {
      if (/[1-8]/.test(ch)) { n += +ch; for (let k = 0; k < +ch; k++) g.push(''); }
      else if ('pnbrqkPNBRQK'.includes(ch)) { n++; g.push(ch); }
      else return false;
    }
    if (n !== 8) return false;
  }
  grid = g;
  turn = parts[1] === 'b' ? 'b' : 'w';
  cr = new Set(parts[2] ? (parts[2] === '-' ? '' : parts[2]) : 'KQkq');
  ep = /^[a-h][36]$/.test(parts[3]) ? parts[3] : '-';
  halfmoves = /^\d+$/.test(parts[4]) ? Math.min(+parts[4], 4294967295) : 0;
  fullmoves = /^[1-9]\d*$/.test(parts[5]) ? Math.min(+parts[5], 4294967295) : 1;
  return true;
}

function render() {
  queueSave();
  $('.board-area').classList.toggle('flipped', flip);
  board.innerHTML = '';
  for (let dr = 0; dr < 8; dr++) for (let dc = 0; dc < 8; dc++) {
    const r = flip ? 7 - dr : dr, c = flip ? 7 - dc : dc, i = r * 8 + c;
    const s = document.createElement('div');
    s.className = 'sq ' + ((r + c) % 2 ? 'd' : 'l');
    s.dataset.i = i;
    let h = '';
    if (dc === 0) h += `<b class="r">${8 - r}</b>`;
    if (dr === 7) h += `<b class="f">${'abcdefgh'[c]}</b>`;
    if (grid[i]) h += pc(grid[i]);
    s.innerHTML = h;
    board.append(s);
  }
  fen.value = toFen();
  fen.classList.remove('bad');
  drawArrow();
  if (stateFen === toFen() && gameState) paintGameStatus(gameState);
}

function syncTool() {
  pal.querySelectorAll('.pb').forEach(b => b.classList.toggle('on', b.dataset.ch === tool));
  $('#erase').classList.toggle('on', tool === 'x');
  board.classList.toggle('stamp', !!tool);
}

function place(e) { ghost.style.left = e.clientX + 'px'; ghost.style.top = e.clientY + 'px'; }

function begin(e, ch, from) {
  if (e.button > 0) return;
  e.preventDefault();
  if (movePending) return;
  if (legalRules && (from == null || (ch === ch.toUpperCase()) !== (turn === 'w'))) return moveNotice('Move a piece belonging to the side to move.');
  drag = { ch, from, x: e.clientX, y: e.clientY, moved: false };
  ghost = document.createElement('div');
  ghost.className = 'ghost';
  ghost.innerHTML = pc(ch);
  ghost.style.width = ghost.style.height = (board.clientWidth / 8 * 1.15) + 'px';
  document.body.append(ghost);
  place(e);
  if (from != null) { const s = sqEl(from); s.classList.add('hi'); s.querySelector('svg').style.opacity = .35; showDots(from); }
}

'KQRBNPkqrbnp'.split('').forEach(ch => {
  const b = document.createElement('button');
  b.className = 'pb'; b.dataset.ch = ch; b.innerHTML = pc(ch);
  b.title = (ch === ch.toLowerCase() ? 'Black ' : 'White ') + {p:'pawn',n:'knight',b:'bishop',r:'rook',q:'queen',k:'king'}[ch.toLowerCase()];
  b.addEventListener('pointerdown', e => begin(e, ch, null));
  pal.append(b);
});

board.addEventListener('pointerdown', e => {
  if (e.button !== 0) return;
  const s = e.target.closest('.sq'); if (!s) return;
  const i = +s.dataset.i;
  if (movePending) return;
  if (legalRules && tool) return;
  if (tool) { grid[i] = tool === 'x' ? '' : tool; ep = '-'; changed(true); return; }
  if (grid[i]) begin(e, grid[i], i);
});
board.addEventListener('contextmenu', e => {
  e.preventDefault();
  const s = e.target.closest('.sq');
  if (s && !legalRules && !movePending) { grid[+s.dataset.i] = ''; ep = '-'; changed(true); }
});

addEventListener('pointermove', e => {
  if (!drag) return;
  if (!drag.moved && Math.hypot(e.clientX - drag.x, e.clientY - drag.y) > 5) { drag.moved = true; ghost.style.display = 'block'; }
  if (!drag.moved) return;
  place(e);
  board.querySelectorAll('.hov').forEach(n => n.classList.remove('hov'));
  sqAt(e)?.classList.add('hov');
});

function finish(e, cancel) {
  if (!drag) return;
  const d = drag; drag = null; ghost.remove();
  if (d.moved && !cancel) {
    const square = sqAt(e), to = square ? +square.dataset.i : -1;
    if (d.from != null && to >= 0 && to !== d.from) { render(); syncTool(); manualMove(d.from, to); return; }
    if (!legalRules) {
      if (d.from == null && to >= 0) { grid[to] = d.ch; ep = '-'; changed(true); return; }
      if (d.from != null && to < 0) { grid[d.from] = ''; ep = '-'; changed(true); return; }
    }
  } else if (!d.moved && d.from == null && !legalRules) tool = tool === d.ch ? null : d.ch;
  render(); syncTool();
}
addEventListener('pointerup', e => finish(e, false));
addEventListener('pointercancel', e => finish(e, true));

$('#start').onclick = () => { load(START); changed(); };
$('#clear').onclick = () => { if (legalRules) return; grid = Array(64).fill(''); ep = '-'; changed(true); };
$('#flip').onclick = () => { flip = !flip; render(); };
$('#erase').onclick = () => { if (legalRules) return; tool = tool === 'x' ? null : 'x'; syncTool(); };
function applyPreferences() {
  if (!THEMES[preferences.theme]) preferences.theme = 'green';
  if (!['system', 'light', 'dark'].includes(preferences.appearance)) preferences.appearance = 'system';
  const root = document.documentElement;
  const [l, d] = THEMES[preferences.theme];
  root.style.setProperty('--l', l); root.style.setProperty('--d', d);
  root.dataset.theme = preferences.appearance;
  root.dataset.reducedMotion = String(preferences.reducedMotion);
  root.dataset.coordinates = String(preferences.coordinates);
  $('#theme').value = preferences.theme; $('#appearance').value = preferences.appearance;
  $('#reduced-motion').checked = preferences.reducedMotion;
  $('#coordinates').checked = preferences.coordinates; $('#suggestions').checked = preferences.suggestions;
  $('#sound-effects').checked = preferences.soundEffects;
  if (!preferences.soundEffects) currentSound?.pause();
  drawArrow();
}
for (const [id, key] of Object.entries({theme:'theme', appearance:'appearance', 'reduced-motion':'reducedMotion', coordinates:'coordinates', suggestions:'suggestions', 'sound-effects':'soundEffects'})) {
  $('#' + id).onchange = event => {
    preferences[key] = event.target.type === 'checkbox' ? event.target.checked : event.target.value;
    applyPreferences();
    queueSave();
  };
}
fen.addEventListener('change', async () => {
  if (movePending) { fen.value = toFen(); return; }
  const before = toFen();
  if (!load(fen.value)) { fen.classList.add('bad'); return; }
  if (legalRules) {
    const revision = ++token; movePending = true;
    clearTimeout(timer); invoke('engine_cancel').catch(() => {});
    try { await invoke('legal_moves', { fen: toFen(), castling: allowCastling }); }
    catch (error) {
      if (revision === token) { load(before); moveNotice(String(error)); render(); }
      return;
    } finally { movePending = false; }
    if (revision !== token) return;
  }
  changed();
});
$('#copy').onclick = async e => {
  const b = e.currentTarget;
  try { await navigator.clipboard.writeText(fen.value); b.textContent = 'Copied'; }
  catch { fen.select(); b.textContent = 'Press Ctrl+C'; }
  setTimeout(() => b.textContent = 'Copy FEN', 1200);
};


const name = c => c === 'w' ? 'White' : 'Black';
const status = t => { $('#status').textContent = t; };
const idx = q => (8 - +q[1]) * 8 + 'abcdefgh'.indexOf(q[0]);
let auto = false, both = false, plies = 0;
const { invoke, Channel } = window.__TAURI__.core;
let ready = false, crashed = false, token = 0, timer = 0, depth = 12;
let depthPreset = '12', customDepth = 24;
let cancellation = Promise.resolve();

const moveSounds = Object.fromEntries(['move', 'capture', 'castle', 'check'].map(name => {
  const audio = new Audio(`sounds/${name}.mp3`); audio.preload = 'auto';
  return [name, audio];
}));
let currentSound = null, pendingMoveSound = null;
function playMoveSound(result, position) {
  if (!pendingMoveSound || pendingMoveSound.fen !== position) return;
  const type = result.checked_square != null ? 'check' : pendingMoveSound.type;
  pendingMoveSound = null;
  if (!preferences.soundEffects) return;
  currentSound?.pause();
  currentSound = moveSounds[type]; currentSound.currentTime = 0;
  currentSound.play().catch(() => {});
}

function changed(resetClock = false) {
  pendingMoveSound = null;
  moveNotice();
  crashed = false; plies = 0; history = []; gameState = null;
  if (resetClock) { halfmoves = 0; fullmoves = 1; }
  render(); syncTool(); schedule();
}

// a board move: handles en passant, castling and auto-queen, then passes the turn
function applyMove(a, b) {
  history.push(toFen());
  if (history.length > 1000) history.shift();
  const ch = grid[a], white = ch === ch.toUpperCase(), t = ch.toLowerCase();
  halfmoves = t === 'p' || grid[b] ? 0 : halfmoves + 1;
  if (!white) fullmoves++;
  const fr = a >> 3, fc = a & 7, tr = b >> 3, tc = b & 7;
  let next = '-';
  if (t === 'p') {
    if (!grid[b] && fc !== tc && 'abcdefgh'[tc] + (8 - tr) === ep) grid[fr * 8 + tc] = '';
    if (Math.abs(tr - fr) === 2) next = 'abcdefgh'[fc] + (8 - (fr + tr) / 2);
  }
  if (t === 'k' && (a === 60 || a === 4) && fr === tr && Math.abs(tc - fc) === 2) {
    const rk = tc > fc ? 7 : 0, nr = tc > fc ? 5 : 3;
    grid[tr * 8 + nr] = grid[tr * 8 + rk]; grid[tr * 8 + rk] = '';
  }
  grid[a] = ''; grid[b] = ch;
  if (t === 'p' && (tr === 0 || tr === 7)) grid[b] = white ? 'Q' : 'q';
  const lose = {60: 'KQ', 63: 'K', 56: 'Q', 4: 'kq', 7: 'k', 0: 'q'};
  [a, b].forEach(q => (lose[q] || '').split('').forEach(f => cr.delete(f)));
  ep = next;
  turn = white ? 'b' : 'w';
}

const inb = (r, c) => r >= 0 && r < 8 && c >= 0 && c < 8;
const isW = ch => ch === ch.toUpperCase();
const DIRS = [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]];
const JUMPS = [[1, 2], [2, 1], [-1, 2], [-2, 1], [1, -2], [2, -1], [-1, -2], [-2, -1]];

// is sq attacked by the given color in grid g
function attacked(g, sq, byW) {
  const r = sq >> 3, c = sq & 7, own = ch => byW ? ch : ch.toLowerCase();
  const pr = byW ? r + 1 : r - 1;
  for (const dc of [-1, 1]) if (inb(pr, c + dc) && g[pr * 8 + c + dc] === own('P')) return true;
  for (const [dr, dc] of JUMPS) if (inb(r + dr, c + dc) && g[(r + dr) * 8 + c + dc] === own('N')) return true;
  for (const [dr, dc] of DIRS) {
    if (inb(r + dr, c + dc) && g[(r + dr) * 8 + c + dc] === own('K')) return true;
    for (let rr = r + dr, cc = c + dc; inb(rr, cc); rr += dr, cc += dc) {
      const x = g[rr * 8 + cc];
      if (!x) continue;
      if (x === own('Q') || x === own(dr && dc ? 'B' : 'R')) return true;
      break;
    }
  }
  return false;
}

// legal destinations for the piece on square i, ignoring whose turn it is (en passant needs the right turn)
function legalMoves(i) {
  const ch = grid[i], w = isW(ch), t = ch.toLowerCase(), r = i >> 3, c = i & 7, raw = [];
  const free = (rr, cc) => inb(rr, cc) && (!grid[rr * 8 + cc] || isW(grid[rr * 8 + cc]) !== w);
  if (t === 'p') {
    const dir = w ? -1 : 1;
    if (inb(r + dir, c) && !grid[(r + dir) * 8 + c]) {
      raw.push((r + dir) * 8 + c);
      if (r === (w ? 6 : 1) && !grid[(r + 2 * dir) * 8 + c]) raw.push((r + 2 * dir) * 8 + c);
    }
    for (const dc of [-1, 1]) {
      const rr = r + dir, cc = c + dc;
      if (!inb(rr, cc)) continue;
      const x = grid[rr * 8 + cc];
      if (x ? isW(x) !== w : (w === (turn === 'w') && 'abcdefgh'[cc] + (8 - rr) === ep)) raw.push(rr * 8 + cc);
    }
  } else if (t === 'n' || t === 'k') {
    for (const [dr, dc] of t === 'n' ? JUMPS : DIRS) if (free(r + dr, c + dc)) raw.push((r + dr) * 8 + c + dc);
  } else {
    for (const [dr, dc] of DIRS) {
      if ((t === 'r' && dr && dc) || (t === 'b' && !(dr && dc))) continue;
      for (let rr = r + dr, cc = c + dc; free(rr, cc); rr += dr, cc += dc) { raw.push(rr * 8 + cc); if (grid[rr * 8 + cc]) break; }
    }
  }
  const safe = j => {
    const g = grid.slice(); g[j] = ch; g[i] = '';
    if (t === 'p' && !grid[j] && (j & 7) !== c) g[r * 8 + (j & 7)] = '';
    const k = g.indexOf(w ? 'K' : 'k');
    return k < 0 || !attacked(g, k, !w);
  };
  const out = raw.filter(safe);
  if (allowCastling && t === 'k' && i === (w ? 60 : 4) && !attacked(grid, i, !w)) {
    const row = w ? 56 : 0, rk = w ? 'R' : 'r';
    if (cr.has(w ? 'K' : 'k') && grid[row + 7] === rk && !grid[row + 5] && !grid[row + 6] && !attacked(grid, row + 5, !w) && !attacked(grid, row + 6, !w)) out.push(row + 6);
    if (cr.has(w ? 'Q' : 'q') && grid[row] === rk && !grid[row + 1] && !grid[row + 2] && !grid[row + 3] && !attacked(grid, row + 2, !w) && !attacked(grid, row + 3, !w)) out.push(row + 2);
  }
  return out;
}

async function showDots(i) {
  if (!legalRules) { legalMoves(i).forEach(j => sqEl(j)?.classList.add(grid[j] ? 'cap' : 'dot')); return; }
  const currentDrag = drag, position = toFen();
  try {
    const moves = await invoke('legal_moves', { fen: position, castling: allowCastling });
    if (drag !== currentDrag || position !== toFen()) return;
    moves.filter(move => idx(move.slice(0, 2)) === i).forEach(move => {
      const j = idx(move.slice(2, 4)); sqEl(j)?.classList.add(grid[j] ? 'cap' : 'dot');
    });
  } catch { /* I leave hints empty while the position is incomplete. */ }
}

function validate() {
  const n = c => grid.filter(x => x === c).length;
  if (n('K') !== 1 || n('k') !== 1) return 'Need exactly one king per side';
  if ([...grid.slice(0, 8), ...grid.slice(56)].some(x => x === 'p' || x === 'P')) return "Pawns can't sit on the first or last rank";
  return '';
}

function drawArrow() {
  const svg = $('#arrows');
  if (!sug || !preferences.suggestions) { svg.innerHTML = ''; return; }
  const pt = i => { const r = i >> 3, c = i & 7; return [(flip ? 7 - c : c) + .5, (flip ? 7 - r : r) + .5]; };
  const [x1, y1] = pt(sug.a), [x2, y2] = pt(sug.b);
  const L = Math.hypot(x2 - x1, y2 - y1), ux = (x2 - x1) / L, uy = (y2 - y1) / L;
  const tx = x2 - ux * .05, ty = y2 - uy * .05, bx = tx - ux * .45, by = ty - uy * .45;
  const px = -uy * .27, py = ux * .27;
  svg.innerHTML = `<g fill="#f5a623" stroke="#f5a623" opacity=".85"><line x1="${x1 + ux * .15}" y1="${y1 + uy * .15}" x2="${bx}" y2="${by}" stroke-width=".17"/><polygon points="${tx},${ty} ${bx + px},${by + py} ${bx - px},${by - py}" stroke="none"/></g>`;
}

function syncUI() {
  document.querySelectorAll('[data-side]').forEach(b => b.classList.toggle('on', b.dataset.side === (sfSide || 'off')));
  document.querySelectorAll('[data-turn]').forEach(b => b.classList.toggle('on', b.dataset.turn === turn));
  document.querySelectorAll('[data-flag]').forEach(b => b.classList.toggle('on', b.dataset.flag === 'auto' ? auto : both));
}

// every position change clears the old suggestion and only searches when it is stockfish's turn
function paintGameStatus(result) {
  const box = $('#game-status');
  box.textContent = result.kind === 'playing' && !sfSide && !both ? 'Pick a side for Stockfish to play' : result.message;
  box.dataset.kind = result.kind;
  board.querySelectorAll('.check').forEach(square => {
    square.classList.remove('check');
    square.removeAttribute('title');
  });
  if (result.checked_square != null) {
    const square = sqEl(result.checked_square);
    square?.classList.add('check');
    if (square) square.title = result.message;
  }
}

async function schedule() {
  queueSave();
  clearTimeout(timer);
  if (activeView === 'training') both = false;
  const my = ++token;
  cancellation = invoke('engine_cancel').catch(() => {});
  sug = null; $('#line').textContent = ''; $('#evf').style.height = '50%';
  syncUI(); drawArrow();
  const currentFen = toFen();
  paintGameStatus({ kind: 'playing', message: 'Checking position…', checked_square: null });
  try {
    const result = await invoke('position_status', { fen: currentFen, history, castling: allowCastling });
    if (my !== token) return;
    gameState = result; stateFen = currentFen;
    paintGameStatus(result);
    playMoveSound(result, currentFen);
    if (result.terminal || result.kind === 'invalid') return status(result.message);
  } catch (error) {
    if (my !== token) return;
    paintGameStatus({ kind: 'invalid', message: String(error), checked_square: null });
    return status('Could not check position');
  }
  if (settingsOpen) return status('');
  if (!both && !sfSide) status('');
  else if (!both && turn !== sfSide) status(`Waiting for ${name(turn)} to move...`);
  else if (crashed) status('Engine crashed - make sure the position is legal');
  else if (!ready) status('Engine loading...');
  else timer = setTimeout(() => search(my), auto || both ? 40 : 250);
}

async function search(my) {
  await cancellation;
  if (my !== token || settingsOpen) return;
  const bad = validate();
  if (bad) return status(bad);
  status(`Thinking for ${name(turn)}...`);
  let info = '';
  const onLine = new Channel();
  onLine.onmessage = line => {
    if (my !== token) return;
    if (/^info .* score .* pv /.test(line)) {
      if (+(line.match(/\bmultipv (\d+)/)?.[1] || 1) !== 1) return;
      info = line;
      const best = line.split(' pv ')[1]?.split(' ')[0];
      const currentDepth = +(line.match(/\bdepth (\d+)/)?.[1] || 1);
      if (best) show(best, info, currentDepth);

    } else if (line.startsWith('bestmove ')) {
      show(line.split(' ')[1], info, 0);
    }
  };
  try {
    await invoke('engine_analyse', { fen: toFen(), depth, onLine, castling: allowCastling, elo: fullStrength ? null : elo });
  } catch (error) {
    if (my !== token) return;
    crashed = true;
    sug = null;
    drawArrow();
    status(String(error));
  }
}

function show(best, info, live) {
  if (!best || best === '(none)' || best === '0000') return status('No legal moves here (mate or stalemate)');
  sug = { a: idx(best.slice(0, 2)), b: idx(best.slice(2, 4)) };
  const sc = info.match(/score (cp|mate) (-?\d+)/);
  const pv = (info.split(' pv ')[1] || '').split(' ').filter(x => /^[a-h][1-8][a-h][1-8][qrbn]?$/.test(x)).slice(0, 6).join(' ');
  let txt = '', pct = 50;
  if (sc) {
    let v = +sc[2]; if (turn === 'b') v = -v;
    if (sc[1] === 'cp') { txt = (v > 0 ? '+' : '') + (v / 100).toFixed(2); pct = 50 + 50 * (2 / (1 + Math.exp(-v / 400)) - 1); }
    else { txt = (v > 0 ? '+' : '-') + 'M' + Math.abs(v); pct = v > 0 ? 100 : 0; }
  }
  $('#evf').style.height = pct + '%';
  const label = !fullStrength ? 'Suggested move' : 'Best move';
  status(live ? `Thinking for ${name(turn)}... depth ${live}` : `${label} for ${name(turn)}: ${best.slice(0, 2)}-${best.slice(2)}`);
  $('#line').textContent = `eval ${txt}  ${pv}`;
  drawArrow();
  if (!live && (auto || both)) { const my = token; timer = setTimeout(() => playSug(my, best), 150); }
}

// auto-play: plays the suggestion, with caps so a both-sides game can't run forever
async function playSug(my, mv) {
  if (my !== token || !sug || settingsOpen) return;
  if (plies >= 200) { sug = null; drawArrow(); return status('Stopped after 200 auto moves - change the position to continue'); }
  const position = toFen(), sound = moveSoundType(grid, idx(mv.slice(0, 2)), idx(mv.slice(2, 4)), ep);
  try {
    const next = await invoke('make_move', { fen: position, uci: mv, castling: allowCastling });
    if (my !== token || position !== toFen()) return;
    history.push(position); load(next);
    pendingMoveSound = { fen: toFen(), type: sound };
  } catch (error) { if (my === token) moveNotice(String(error)); return; }
  plies++;
  render(); syncTool();
  schedule();
}

async function boot() {
  ready = false;
  try {
    const engineName = await invoke('engine_start');
    $('#status').title = engineName;
    ready = true;
    schedule();
  } catch (error) {
    crashed = true;
    status(String(error));
  }
}

document.querySelectorAll('[data-side]').forEach(b => b.onclick = () => { sfSide = b.dataset.side === 'off' ? null : b.dataset.side; schedule(); });
document.querySelectorAll('[data-turn]').forEach(b => b.onclick = () => { turn = b.dataset.turn; ep = '-'; changed(true); });
const depthOptions = [...document.querySelectorAll('[data-depth]')];
function syncDepth() {
  $('#depth-slider').value = customDepth;
  const selected = depthOptions.find(option => option.dataset.depth === depthPreset);
  $('#depth-label').textContent = depthPreset === 'custom'
    ? `Custom · ${customDepth}` : `${depth} · ${selected.lastElementChild.textContent}`;
  depthOptions.forEach(option => option.setAttribute('aria-selected', String(option === selected)));
  $('#custom-depth').hidden = depthPreset !== 'custom';
  $('#depth-value').textContent = customDepth;
  $('#depth-warning').hidden = depth <= 24;
}
function closeDepth(returnFocus = false) {
  $('#depth-options').hidden = true;
  $('#depth').setAttribute('aria-expanded', 'false');
  if (returnFocus) $('#depth').focus();
}
function openDepth() {
  $('#depth-options').hidden = false;
  $('#depth').setAttribute('aria-expanded', 'true');
  depthOptions.find(option => option.dataset.depth === depthPreset).focus();
}
$('#depth').onclick = () => $('#depth-options').hidden ? openDepth() : closeDepth();
$('#depth').addEventListener('keydown', event => {
  if (['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(event.key)) {
    event.preventDefault(); openDepth();
    if (event.key === 'Home') depthOptions[0].focus();
    if (event.key === 'End') depthOptions.at(-1).focus();
  }
});
depthOptions.forEach((option, index) => {
  option.onclick = () => {
    depthPreset = option.dataset.depth;
    depth = depthPreset === 'custom' ? customDepth : +depthPreset;
    syncDepth(); closeDepth(true); schedule();
  };
  option.addEventListener('keydown', event => {
    let next;
    if (event.key === 'ArrowDown') next = (index + 1) % depthOptions.length;
    if (event.key === 'ArrowUp') next = (index + depthOptions.length - 1) % depthOptions.length;
    if (event.key === 'Home') next = 0;
    if (event.key === 'End') next = depthOptions.length - 1;
    if (next != null) { event.preventDefault(); depthOptions[next].focus(); }
  });
});
$('#depth-picker').addEventListener('keydown', event => {
  if (event.key === 'Escape' && !$('#depth-options').hidden) {
    event.preventDefault(); event.stopPropagation(); closeDepth(true);
  }
});
document.addEventListener('pointerdown', event => {
  if (!$('#depth-picker').contains(event.target)) closeDepth();
});
document.addEventListener('focusin', event => {
  if (!$('#depth-picker').contains(event.target)) closeDepth();
});
$('#depth-slider').addEventListener('input', event => {
  customDepth = +event.target.value; depth = customDepth;
  syncDepth(); schedule();
});
document.querySelectorAll('[data-flag]').forEach(b => b.onclick = () => {
  if (b.dataset.flag === 'auto') auto = !auto; else { if (activeView === 'training') return; both = !both; }
  plies = 0; schedule();
});

function moveNotice(message = '') {
  $('#move-notice').textContent = message;
  $('#move-notice').hidden = !message;
}

async function manualMove(from, to) {
  if (movePending) return;
  moveNotice();
  const ch = grid[from], sound = moveSoundType(grid, from, to, ep);
  const castleAttempt = ch.toLowerCase() === 'k' && (from >> 3) === (to >> 3) && Math.abs((from & 7) - (to & 7)) === 2;
  if (!legalRules && !castleAttempt) { applyMove(from, to); pendingMoveSound = { fen: toFen(), type: sound }; render(); syncTool(); schedule(); return; }
  const position = toFen(), revision = ++token;
  clearTimeout(timer); invoke('engine_cancel').catch(() => {}); movePending = true;
  const notation = index => 'abcdefgh'[index & 7] + (8 - (index >> 3));
  const promotion = ch.toLowerCase() === 'p' && (to < 8 || to >= 56) ? 'q' : '';
  try {
    const next = await invoke('make_move', { fen: position, uci: notation(from) + notation(to) + promotion, castling: allowCastling });
    if (revision !== token || position !== toFen()) return;
    history.push(position); load(next); pendingMoveSound = { fen: toFen(), type: sound }; render(); syncTool(); schedule();
  } catch (error) {
    if (revision === token) { moveNotice(String(error)); render(); schedule(); }
  } finally { movePending = false; }
}

function syncWorkspace() {
  const training = activeView === 'training';
  const page = settingsOpen ? 'settings' : activeView;
  $('#workspace').hidden = settingsOpen; $('#settings').hidden = !settingsOpen;
  document.querySelectorAll('[data-view]').forEach(button => {
    const selected = button.dataset.view === page;
    button.setAttribute('aria-selected', String(selected)); button.tabIndex = selected ? 0 : -1;
  });
  $('#workspace').setAttribute('aria-labelledby', training ? 'tab-training' : 'tab-analyzer');
  $('#workspace-heading').textContent = training ? 'Game Training' : 'Analyzer';
  document.querySelector('[data-flag=both]').disabled = training;
  if (training) both = false;
  syncStrength();
  $('#legal-rules').checked = legalRules; $('#allow-castling').checked = allowCastling;
  pal.hidden = legalRules;
  $('#clear').disabled = legalRules; $('#erase').disabled = legalRules;
  document.querySelectorAll('[data-turn]').forEach(button => button.disabled = legalRules);
  $('#board-help').textContent = legalRules
    ? 'Move the side to play. Legal rules apply, including check, en passant, and promotion. Load a valid FEN to train another position.'
    : 'Drag pieces from the tray onto the board, or drop them off the board to remove. Right-click clears a square. Castling follows the position’s rights.';
}

function switchWorkspace(nextView) {
  if (movePending) return;
  if (nextView === 'settings') {
    if (drag) finish({}, true);
    closeDepth(); settingsOpen = true; ++token; clearTimeout(timer);
    cancellation = invoke('engine_cancel').catch(() => {});
    syncWorkspace(); $('#board-help').textContent = 'Appearance and board preferences apply to both workspaces.';
    return;
  }
  const wasSettings = settingsOpen; settingsOpen = false;
  if (nextView === activeView) { if (wasSettings) { syncWorkspace(); schedule(); } return; }
  if (drag) finish({}, true);
  closeDepth();
  sessions[activeView] = captureWorkspace();
  activeView = nextView;
  const next = sessions[nextView];
  if (next) {
    restoreWorkspace(next);
  } else {
    restoreWorkspace(defaultWorkspace(nextView));
  }
  pendingMoveSound = null;
  tool = null; crashed = false; sug = null; gameState = null; moveNotice();
  syncDepth(); syncWorkspace(); render(); syncTool(); schedule();
}

document.querySelectorAll('[data-view]').forEach(button => {
  button.onclick = () => switchWorkspace(button.dataset.view);
  button.addEventListener('keydown', event => {
    if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
    event.preventDefault();
    const tabs = [...document.querySelectorAll('[data-view]')];
    const index = tabs.indexOf(button);
    const next = event.key === 'Home' ? 0 : event.key === 'End' ? tabs.length - 1 : (index + (event.key === 'ArrowRight' ? 1 : -1) + tabs.length) % tabs.length;
    switchWorkspace(tabs[next].dataset.view); tabs[next].focus();
  });
});
$('#legal-rules').onchange = event => {
  legalRules = event.target.checked; tool = null; moveNotice(); syncWorkspace(); syncTool(); schedule();
};
$('#allow-castling').onchange = event => { allowCastling = event.target.checked; moveNotice(); schedule(); };
function syncStrength() {
  $('#full-strength').checked = fullStrength; $('#elo').disabled = fullStrength;
  $('#elo-controls').hidden = fullStrength;
  $('#elo').value = elo; $('#elo-value').textContent = fullStrength ? 'Unlimited' : `${elo} Elo`;
}
$('#full-strength').onchange = event => { fullStrength = event.target.checked; syncStrength(); schedule(); };
$('#elo').oninput = event => { elo = +event.target.value; syncStrength(); schedule(); };

function captureWorkspace() {
  return { fen: toFen(), history: history.slice(-1000), sfSide, auto, both, legalRules, allowCastling, flip, plies, depth, depthPreset, customDepth, elo, fullStrength };
}
function defaultWorkspace(view) {
  const training = view === 'training';
  return { fen: START, history: [], sfSide: training ? 'b' : null, auto: training, both: false, legalRules: training, allowCastling: true, flip: false, plies: 0, depth: 12, depthPreset: '12', customDepth: 24, elo: 1600, fullStrength: true };
}
function restoreWorkspace(next) {
  load(next.fen); history = next.history.slice();
  ({ sfSide, auto, both, legalRules, allowCastling, flip, plies, depth, depthPreset, customDepth, elo, fullStrength } = next);
  if (activeView === 'training') both = false;
}
function decodeWorkspace(values, view) {
  const next = defaultWorkspace(view);
  for (const [key, value] of Object.entries(values || {})) {
    if (!(key in next) || key === 'history') continue;
    if (key === 'sfSide') next.sfSide = value === 'off' ? null : value;
    else if (typeof next[key] === 'boolean') next[key] = value === 'true';
    else if (typeof next[key] === 'number') next[key] = +value;
    else next[key] = value;
  }
  if (values?.fen && values.history) {
    try {
      const restored = JSON.parse(values.history);
      if (Array.isArray(restored)) next.history = restored.filter(fen => typeof fen === 'string' && fen.length <= 200).slice(-1000);
    } catch { /* I keep the position and start a fresh repetition history. */ }
  }
  next.depth = next.depthPreset === 'custom' ? next.customDepth : +next.depthPreset;
  if (view === 'training') next.both = false;
  return next;
}
function configSnapshot() {
  const current = { ...sessions, [activeView]: captureWorkspace() };
  const saved = { app: { activeView } };
  for (const view of ['analyzer', 'training']) {
    if (!current[view]) continue;
    saved[view] = Object.fromEntries(Object.entries(current[view]).map(([key, value]) => [key,
      key === 'history' ? JSON.stringify(value) : key === 'sfSide' ? value || 'off' : String(value)]));
  }
  const settings = Object.fromEntries(Object.entries(preferences).map(([key, value]) => [key, String(value)]));
  settings.saveEnabled = String(saveEnabled);
  for (const [key, value] of Object.entries(saveChoices)) settings['save_' + key] = String(value);
  return { settings, saved };
}
function configError(error) {
  $('#persistence-error').hidden = !error;
  $('#persistence-error').textContent = error ? 'Configuration: ' + String(error) : '';
  $('#config-notice').textContent = error ? String(error) : 'Saved automatically to settings.ini and saved.ini.';
}
function queueSave() {
  if (!configReady) return;
  clearTimeout(saveTimer);
  saveTimer = setTimeout(flushConfig, 150);
}
function flushConfig() {
  clearTimeout(saveTimer); saveTimer = null;
  if (!configReady) return saveChain;
  const config = configSnapshot();
  saveChain = saveChain.then(() => invoke('config_save', { config })).then(() => { configError(null); try { localStorage.removeItem('chessbot.preferences'); } catch { /* I keep using the INI files. */ } }).catch(configError);
  return saveChain;
}
function syncSaveChoices() {
  $('#save-enabled').checked = saveEnabled;
  document.querySelectorAll('[data-save]').forEach(input => {
    input.checked = saveChoices[input.dataset.save]; input.disabled = !saveEnabled;
  });
}
$('#save-enabled').onchange = event => { saveEnabled = event.target.checked; syncSaveChoices(); queueSave(); };
document.querySelectorAll('[data-save]').forEach(input => input.onchange = () => { saveChoices[input.dataset.save] = input.checked; queueSave(); });
async function initialize() {
  load(START);
  try {
    const config = await invoke('config_load');
    for (const key of Object.keys(preferences)) {
      if (config.settings[key] != null) preferences[key] = typeof preferences[key] === 'boolean' ? config.settings[key] === 'true' : config.settings[key];
    }
    if (!config.settings_exists) {
      try {
        const old = JSON.parse(localStorage.getItem('chessbot.preferences'));
        for (const key of Object.keys(preferences)) if (typeof old?.[key] === typeof preferences[key]) preferences[key] = old[key];
      } catch { /* I use defaults when there are no earlier preferences. */ }
    }
    saveEnabled = config.settings.saveEnabled !== 'false';
    for (const key of Object.keys(saveChoices)) saveChoices[key] = config.settings['save_' + key] !== 'false';
    for (const view of ['analyzer', 'training']) sessions[view] = decodeWorkspace(config.saved[view], view);
    activeView = config.saved.app?.activeView || 'analyzer';
    restoreWorkspace(sessions[activeView]);
    $('#config-location').textContent = 'Configuration folder: ' + config.directory;
    configReady = true;
  } catch (error) {
    configError('Could not load configuration: ' + String(error));
  }
  applyPreferences(); syncSaveChoices(); syncDepth(); syncWorkspace(); render(); syncTool(); boot(); schedule();
}

const appWindow = window.__TAURI__.window.getCurrentWindow();
$('#window-minimize').onclick = () => appWindow.minimize().catch(error => status(String(error)));
$('#window-maximize').onclick = () => appWindow.toggleMaximize().catch(error => status(String(error)));
$('#window-close').onclick = () => appWindow.close().catch(error => status(String(error)));
appWindow.onCloseRequested(async event => {
  if (closingWindow) { event.preventDefault(); return; }
  closingWindow = true;
  clearTimeout(timer); ++token;
  await invoke('engine_cancel').catch(() => {});
  await flushConfig();
});
async function syncWindowIcon() {
  const maximized = await appWindow.isMaximized();
  $('#window-maximize').setAttribute('aria-label', maximized ? 'Restore window' : 'Maximize window');
  $('#window-maximize').title = maximized ? 'Restore' : 'Maximize';
  $('#maximize-icon').setAttribute('d', maximized ? 'M5.5 3.5v-1h8v8h-1m-9-6h8v8h-8z' : 'M3.5 3.5h9v9h-9z');
}
appWindow.onResized(() => syncWindowIcon().catch(() => {}));
syncWindowIcon().catch(() => {});

initialize();
