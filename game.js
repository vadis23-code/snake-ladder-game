'use strict';

// ── GAME DATA ──────────────────────────────────────────────────────────────
const SNAKES  = { 16:6,  47:26, 49:11, 56:53, 62:19, 64:60, 87:24, 93:73, 95:75, 99:78 };
const LADDERS = { 4:14,  9:31,  20:38, 28:84, 40:59, 51:67, 63:81, 71:91 };

// ── STATE ──────────────────────────────────────────────────────────────────
let gameMode      = '2p';
let currentPlayer = 1;
let positions     = [0, 0];
let busy          = false;
let currentUser   = null; // null means guest

// ── DOM ────────────────────────────────────────────────────────────────────
const $ = id => document.getElementById(id);
const rollBtn      = $('roll-btn');
const messageBox   = $('message-box');
const turnText     = $('turn-text');
const diceEl       = $('dice');
const dotGrid      = $('dot-grid');
const diceResult   = $('dice-result');
const p1PosEl      = $('p1-pos');
const p2PosEl      = $('p2-pos');
const p2Label      = $('p2-label');
const winOverlay   = $('win-overlay');
const winText      = $('win-text');
const winEmoji     = $('win-emoji');
const confettiCont = $('confetti-container');
const boardGrid    = $('board-grid');
const overlaySvg   = $('overlay-svg');
const tokensLayer  = $('tokens-layer');

// ── AUTH ───────────────────────────────────────────────────────────────────
function getUsers() {
  try { return JSON.parse(localStorage.getItem('snl_users') || '{}'); } catch { return {}; }
}

function saveUsers(users) {
  localStorage.setItem('snl_users', JSON.stringify(users));
}

function switchTab(tab) {
  const isLogin = tab === 'login';
  document.getElementById('tab-login').classList.toggle('active', isLogin);
  document.getElementById('tab-register').classList.toggle('active', !isLogin);
  document.getElementById('form-login').classList.toggle('hidden', !isLogin);
  document.getElementById('form-register').classList.toggle('hidden', isLogin);
  document.getElementById('login-error').textContent = '';
  document.getElementById('reg-error').textContent = '';
}

function authLogin() {
  const username = document.getElementById('login-username').value.trim();
  const password = document.getElementById('login-password').value;
  const errEl    = document.getElementById('login-error');
  if (!username || !password) { errEl.textContent = 'Please fill in all fields.'; return; }
  const users = getUsers();
  if (!users[username])                       { errEl.textContent = 'Username not found.';   return; }
  if (users[username].password !== password)  { errEl.textContent = 'Incorrect password.';   return; }
  currentUser = username;
  enterGame();
}

function authRegister() {
  const username = document.getElementById('reg-username').value.trim();
  const password = document.getElementById('reg-password').value;
  const confirm  = document.getElementById('reg-confirm').value;
  const errEl    = document.getElementById('reg-error');
  if (!username || !password || !confirm) { errEl.textContent = 'Please fill in all fields.'; return; }
  if (username.length < 3 || username.length > 20) { errEl.textContent = 'Username must be 3–20 characters.'; return; }
  if (!/^[a-zA-Z0-9_]+$/.test(username))  { errEl.textContent = 'Letters, numbers and _ only.'; return; }
  if (password.length < 6)                { errEl.textContent = 'Password must be at least 6 characters.'; return; }
  if (password !== confirm)               { errEl.textContent = 'Passwords do not match.'; return; }
  const users = getUsers();
  if (users[username]) { errEl.textContent = 'Username already taken.'; return; }
  users[username] = { password };
  saveUsers(users);
  currentUser = username;
  enterGame();
}

function authGuest() {
  currentUser = null;
  enterGame();
}

function getUserStats() {
  if (!currentUser) return null;
  const users = getUsers();
  return users[currentUser]?.stats || { wins: 0, losses: 0, history: [] };
}

function recordGameResult(playerIdx) {
  if (!currentUser) return;
  const users = getUsers();
  const user  = users[currentUser];
  if (!user) return;
  if (!user.stats) user.stats = { wins: 0, losses: 0, history: [] };

  const userWon = playerIdx === 0;
  if (userWon) {
    user.stats.wins++;
  } else {
    user.stats.losses++;
  }

  const entry = {
    date:   new Date().toLocaleDateString(),
    mode:   gameMode === 'cpu' ? 'vs CPU' : '2 Players',
    result: userWon ? 'win' : 'loss',
  };
  user.stats.history.unshift(entry);
  if (user.stats.history.length > 10) user.stats.history.length = 10;

  users[currentUser] = user;
  saveUsers(users);
  updateUserBar();
}

function updateUserBar() {
  const nameDisplay = document.getElementById('user-name-display');
  if (!currentUser) {
    nameDisplay.textContent = '👤 Guest';
    return;
  }
  const stats = getUserStats();
  const hasGames = stats && (stats.wins > 0 || stats.losses > 0);
  nameDisplay.textContent = hasGames
    ? `👤 ${currentUser} · ${stats.wins}W ${stats.losses}L`
    : `👤 ${currentUser}`;
}

function showStats() {
  if (!currentUser) return;
  const stats = getUserStats();
  const total  = stats.wins + stats.losses;
  const rate   = total > 0 ? Math.round((stats.wins / total) * 100) + '%' : '—';

  document.getElementById('stats-title').textContent   = `📊 ${currentUser}'s Stats`;
  document.getElementById('stat-wins').textContent     = stats.wins;
  document.getElementById('stat-losses').textContent   = stats.losses;
  document.getElementById('stat-rate').textContent     = rate;

  const listEl = document.getElementById('history-list');
  if (stats.history.length === 0) {
    listEl.innerHTML = '<div class="no-history">No games played yet!</div>';
  } else {
    listEl.innerHTML = stats.history.map(g => `
      <div class="history-item ${g.result}">
        <span class="h-date">${g.date}</span>
        <span class="h-mode">${g.mode}</span>
        <span class="h-result">${g.result === 'win' ? '🏆 Win' : '💔 Loss'}</span>
      </div>`).join('');
  }
  document.getElementById('stats-overlay').classList.remove('hidden');
}

function hideStats() {
  document.getElementById('stats-overlay').classList.add('hidden');
}

function enterGame() {
  document.getElementById('auth-screen').classList.add('hidden');
  const statsBtn = document.getElementById('stats-btn');
  if (statsBtn) statsBtn.style.display = currentUser ? '' : 'none';
  updateUserBar();
  document.getElementById('user-bar').classList.remove('hidden');
  $('start-screen').classList.remove('hidden');
}

function logout() {
  currentUser = null;
  $('game').classList.add('hidden');
  $('start-screen').classList.add('hidden');
  winOverlay.classList.add('hidden');
  confettiCont.innerHTML = '';
  ['login-username', 'login-password', 'reg-username', 'reg-password', 'reg-confirm'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.value = '';
  });
  document.getElementById('login-error').textContent = '';
  document.getElementById('reg-error').textContent = '';
  switchTab('login');
  document.getElementById('user-bar').classList.add('hidden');
  document.getElementById('auth-screen').classList.remove('hidden');
}

function getPlayerName(playerIdx) {
  if (playerIdx === 0) return currentUser || 'Player 1';
  return gameMode === 'cpu' ? 'Computer' : 'Player 2';
}

// ── BOARD MATH ─────────────────────────────────────────────────────────────
// Board numbering: bottom row = 1-10 (L→R), next row = 11-20 (R→L), alternating.
// Top row = 91-100 (R→L).

function squareToGridIndex(sq) {
  const rowFromBot = Math.floor((sq - 1) / 10);
  const colInRow   = (sq - 1) % 10;
  const displayRow = 9 - rowFromBot;
  const displayCol = rowFromBot % 2 === 0 ? colInRow : 9 - colInRow;
  return displayRow * 10 + displayCol;
}

function getSquareAtGridIndex(idx) {
  const displayRow = Math.floor(idx / 10);
  const displayCol = idx % 10;
  const rowFromBot = 9 - displayRow;
  const colInRow   = rowFromBot % 2 === 0 ? displayCol : 9 - displayCol;
  return rowFromBot * 10 + colInRow + 1;
}

function getCellEl(sq) {
  return boardGrid.children[squareToGridIndex(sq)];
}

// Returns center {x, y} of a square relative to #board-wrapper
function getCellCenter(sq) {
  const wRect = $('board-wrapper').getBoundingClientRect();
  const cRect = getCellEl(sq).getBoundingClientRect();
  return {
    x: cRect.left - wRect.left + cRect.width  / 2,
    y: cRect.top  - wRect.top  + cRect.height / 2,
  };
}

// ── BUILD BOARD ────────────────────────────────────────────────────────────
function buildBoard() {
  boardGrid.innerHTML = '';
  for (let idx = 0; idx < 100; idx++) {
    const sq   = getSquareAtGridIndex(idx);
    const cell = document.createElement('div');
    cell.className  = 'cell';
    cell.dataset.sq = sq;
    const num = document.createElement('span');
    num.className   = 'cell-num';
    num.textContent = sq;
    cell.appendChild(num);
    boardGrid.appendChild(cell);
  }
  // Colour special squares
  for (const [head, tail] of Object.entries(SNAKES)) {
    getCellEl(+head)?.classList.add('snake-head');
    getCellEl(+tail)?.classList.add('snake-tail');
  }
  for (const [bot, top] of Object.entries(LADDERS)) {
    getCellEl(+bot)?.classList.add('ladder-bot');
    getCellEl(+top)?.classList.add('ladder-top');
  }
}

// ── DRAW SVG OVERLAY ───────────────────────────────────────────────────────
function drawOverlay() {
  overlaySvg.innerHTML = '';

  for (const [head, tail] of Object.entries(SNAKES)) {
    const h  = getCellCenter(+head);
    const t  = getCellCenter(+tail);
    const mx = (h.x + t.x) / 2;
    const my = (h.y + t.y) / 2;
    // Gentle S-curve
    const cp1 = { x: h.x + (t.x - h.x) * 0.25 + 22, y: h.y + (t.y - h.y) * 0.15 };
    const cp2 = { x: t.x + (h.x - t.x) * 0.25 - 22, y: t.y + (h.y - t.y) * 0.15 };

    const path = svgEl('path');
    path.setAttribute('d', `M${h.x},${h.y} C${cp1.x},${cp1.y} ${cp2.x},${cp2.y} ${t.x},${t.y}`);
    path.setAttribute('stroke', '#e53935');
    path.setAttribute('stroke-width', '5');
    path.setAttribute('stroke-linecap', 'round');
    path.setAttribute('fill', 'none');
    path.setAttribute('opacity', '0.8');
    overlaySvg.appendChild(path);

    // Snake emoji at head
    overlaySvg.appendChild(svgEmoji('🐍', h.x, h.y, 16));
  }

  for (const [bot, top] of Object.entries(LADDERS)) {
    const b  = getCellCenter(+bot);
    const t  = getCellCenter(+top);
    const dx = t.x - b.x;
    const dy = t.y - b.y;
    const len = Math.sqrt(dx * dx + dy * dy) || 1;
    const ux = (-dy / len) * 5;
    const uy = ( dx / len) * 5;

    // Two rails
    makeLine(b.x - ux, b.y - uy, t.x - ux, t.y - uy, '#f9a825', 3.5);
    makeLine(b.x + ux, b.y + uy, t.x + ux, t.y + uy, '#f9a825', 3.5);
    // Rungs
    const rungs = 5;
    for (let r = 1; r < rungs; r++) {
      const f  = r / rungs;
      const rx = b.x + dx * f;
      const ry = b.y + dy * f;
      makeLine(rx - ux, ry - uy, rx + ux, ry + uy, '#f57f17', 2.5);
    }
    // Ladder emoji at bottom
    overlaySvg.appendChild(svgEmoji('🪜', b.x, b.y, 14));
  }
}

function svgEl(tag) {
  return document.createElementNS('http://www.w3.org/2000/svg', tag);
}

function svgEmoji(char, x, y, size) {
  const t = svgEl('text');
  t.setAttribute('x', x);
  t.setAttribute('y', y + size * 0.4);
  t.setAttribute('text-anchor', 'middle');
  t.setAttribute('font-size', size);
  t.textContent = char;
  return t;
}

function makeLine(x1, y1, x2, y2, stroke, width) {
  const l = svgEl('line');
  l.setAttribute('x1', x1); l.setAttribute('y1', y1);
  l.setAttribute('x2', x2); l.setAttribute('y2', y2);
  l.setAttribute('stroke', stroke);
  l.setAttribute('stroke-width', width);
  l.setAttribute('stroke-linecap', 'round');
  overlaySvg.appendChild(l);
}

// ── TOKENS ─────────────────────────────────────────────────────────────────
let tokenEls = [null, null];

function createTokens() {
  tokensLayer.innerHTML = '';
  const emojis = ['⭐', gameMode === 'cpu' ? '🤖' : '🌟'];
  for (let p = 0; p < 2; p++) {
    const el = document.createElement('div');
    el.className = `token p${p + 1}`;
    el.textContent = emojis[p];
    el.style.display = 'none';
    tokensLayer.appendChild(el);
    tokenEls[p] = el;
  }
}

function placeToken(playerIdx, sq) {
  const el = tokenEls[playerIdx];
  if (!el) return;
  if (sq <= 0) { el.style.display = 'none'; return; }

  const wrapper   = $('board-wrapper');
  const tokenSize = wrapper.offsetWidth * 0.072;
  const c         = getCellCenter(sq);
  // Offset P1 slightly left, P2 slightly right so they don't overlap on same square
  const offsetX   = playerIdx === 0 ? -tokenSize * 0.3 : tokenSize * 0.3;

  el.style.display = 'flex';
  el.style.width   = tokenSize + 'px';
  el.style.height  = tokenSize + 'px';
  el.style.left    = (c.x - tokenSize / 2 + offsetX) + 'px';
  el.style.top     = (c.y - tokenSize / 2) + 'px';
  el.style.fontSize = Math.round(tokenSize * 0.55) + 'px';

  // Re-trigger pop animation
  el.classList.remove('pop');
  void el.offsetWidth;
  el.classList.add('pop');
}

// ── DICE ───────────────────────────────────────────────────────────────────
// 9 slots in a 3×3 grid; true = dot shown
const DOT_PATTERNS = {
  1: [0,0,0, 0,1,0, 0,0,0],
  2: [0,0,1, 0,0,0, 1,0,0],
  3: [0,0,1, 0,1,0, 1,0,0],
  4: [1,0,1, 0,0,0, 1,0,1],
  5: [1,0,1, 0,1,0, 1,0,1],
  6: [1,0,1, 1,0,1, 1,0,1],
};

function showDiceFace(n) {
  dotGrid.innerHTML = '';
  DOT_PATTERNS[n].forEach(on => {
    const d = document.createElement('div');
    d.className = on ? 'dot' : 'dot empty';
    dotGrid.appendChild(d);
  });
}

function animateDice(finalValue) {
  return new Promise(resolve => {
    diceEl.classList.add('rolling');
    let ticks = 0;
    const id = setInterval(() => {
      showDiceFace(Math.ceil(Math.random() * 6));
      if (++ticks >= 7) {
        clearInterval(id);
        showDiceFace(finalValue);
        diceEl.classList.remove('rolling');
        resolve();
      }
    }, 90);
  });
}

// ── SOUND (Web Audio API) ──────────────────────────────────────────────────
let audioCtx = null;

function getAudio() {
  if (!audioCtx) {
    try { audioCtx = new (window.AudioContext || window.webkitAudioContext)(); } catch (_) {}
  }
  return audioCtx;
}

function playTone(freq, dur, type = 'sine', vol = 0.25, delay = 0) {
  const ctx = getAudio();
  if (!ctx) return;
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.connect(gain);
  gain.connect(ctx.destination);
  osc.type = type;
  osc.frequency.setValueAtTime(freq, ctx.currentTime + delay);
  gain.gain.setValueAtTime(vol, ctx.currentTime + delay);
  gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + delay + dur);
  osc.start(ctx.currentTime + delay);
  osc.stop(ctx.currentTime + delay + dur + 0.05);
}

function playSound(type) {
  switch (type) {
    case 'roll':
      playTone(180, 0.06, 'square', 0.12);
      playTone(260, 0.06, 'square', 0.12, 0.08);
      break;
    case 'step':
      playTone(520, 0.07, 'sine', 0.08);
      break;
    case 'ladder':
      [261, 330, 392, 523].forEach((f, i) => playTone(f, 0.18, 'sine', 0.22, i * 0.13));
      break;
    case 'snake':
      [523, 392, 330, 220].forEach((f, i) => playTone(f, 0.15, 'sawtooth', 0.18, i * 0.11));
      break;
    case 'win':
      [523, 659, 784, 1047, 1319].forEach((f, i) => playTone(f, 0.22, 'sine', 0.28, i * 0.16));
      break;
  }
}

// ── MESSAGES ───────────────────────────────────────────────────────────────
function showMessage(msg, type) {
  messageBox.textContent = msg;
  messageBox.className   = type ? `${type}-msg` : '';
}

// ── SCORES & BANNER ────────────────────────────────────────────────────────
function updateScores() {
  p1PosEl.textContent = positions[0] === 0 ? 'Start' : `Square ${positions[0]}`;
  p2PosEl.textContent = positions[1] === 0 ? 'Start' : `Square ${positions[1]}`;
}

function updateTurnBanner() {
  const isP1 = currentPlayer === 1;
  const name = isP1 ? `${getPlayerName(0)} 🔴` : (gameMode === 'cpu' ? 'Computer 🤖' : 'Player 2 🔵');
  turnText.textContent = `${name}'s Turn!`;
  $('turn-banner').style.background = isP1 ? '#ffebee' : '#e3f2fd';
}

// ── MOVEMENT ───────────────────────────────────────────────────────────────
const wait = ms => new Promise(r => setTimeout(r, ms));

async function stepToken(playerIdx, steps) {
  const maxSteps = Math.min(steps, 100 - positions[playerIdx]);
  for (let i = 0; i < maxSteps; i++) {
    positions[playerIdx]++;
    placeToken(playerIdx, positions[playerIdx]);
    playSound('step');
    updateScores();
    await wait(220);
  }
}

async function handleSpecial(playerIdx) {
  const pos  = positions[playerIdx];
  const name = getPlayerName(playerIdx);

  if (SNAKES[pos] !== undefined) {
    const dest = SNAKES[pos];
    showMessage(`🐍 Oh no! ${name} hit a snake! Sliding down to ${dest}...`, 'snake');
    playSound('snake');
    await wait(1000);
    positions[playerIdx] = dest;
    placeToken(playerIdx, dest);
    updateScores();
    await wait(400);

  } else if (LADDERS[pos] !== undefined) {
    const dest = LADDERS[pos];
    showMessage(`🪜 Wheee! ${name} found a ladder! Climbing up to ${dest}!`, 'ladder');
    playSound('ladder');
    await wait(1000);
    positions[playerIdx] = dest;
    placeToken(playerIdx, dest);
    updateScores();
    await wait(400);
  }
}

// ── WIN ────────────────────────────────────────────────────────────────────
function checkWin(playerIdx) {
  return positions[playerIdx] >= 100;
}

function triggerWin(playerIdx) {
  const isP1  = playerIdx === 0;
  const isCpu = !isP1 && gameMode === 'cpu';
  const name  = getPlayerName(playerIdx);

  recordGameResult(playerIdx);

  winEmoji.textContent = isCpu ? '🤖' : (isP1 ? '🎉' : '🎊');
  winText.textContent  = isCpu
    ? 'Computer WINS!\nBetter luck next time!'
    : `${name} WINS!\nAmazing job! 🌟`;

  // Show updated record for the logged-in user
  const winStatsEl = document.getElementById('win-stats');
  if (currentUser) {
    const s = getUserStats();
    winStatsEl.textContent = `Record: ${s.wins}W – ${s.losses}L`;
  } else {
    winStatsEl.textContent = '';
  }

  winOverlay.classList.remove('hidden');
  playSound('win');
  launchConfetti();
}

// ── CONFETTI ───────────────────────────────────────────────────────────────
function launchConfetti() {
  confettiCont.innerHTML = '';
  const colors = ['#f44336','#e91e63','#9c27b0','#2196f3','#4caf50','#ffeb3b','#ff9800','#00bcd4'];
  for (let i = 0; i < 90; i++) {
    const p = document.createElement('div');
    p.className = 'confetti-piece';
    p.style.left              = (Math.random() * 100) + 'vw';
    p.style.background        = colors[Math.floor(Math.random() * colors.length)];
    p.style.width             = (8 + Math.random() * 10) + 'px';
    p.style.height            = (8 + Math.random() * 10) + 'px';
    p.style.animationDuration = (1.8 + Math.random() * 2) + 's';
    p.style.animationDelay    = (Math.random() * 1.2) + 's';
    confettiCont.appendChild(p);
  }
  setTimeout(() => { confettiCont.innerHTML = ''; }, 5500);
}

// ── ROLL DICE (main action) ────────────────────────────────────────────────
async function rollDice() {
  if (busy) return;
  busy = true;
  rollBtn.disabled = true;

  const playerIdx = currentPlayer - 1;
  const name      = getPlayerName(playerIdx);
  const roll      = Math.ceil(Math.random() * 6);

  // Dice animation
  playSound('roll');
  await animateDice(roll);
  diceResult.textContent = `Rolled a ${roll}!`;
  showMessage(`${name} rolled a ${roll}! Moving forward...`);
  await wait(300);

  // Move step by step
  await stepToken(playerIdx, roll);

  // Check win before special squares
  if (checkWin(playerIdx)) {
    triggerWin(playerIdx);
    busy = false;
    return;
  }

  // Snake or ladder
  await handleSpecial(playerIdx);

  // Check win again (ladder could reach 100)
  if (checkWin(playerIdx)) {
    triggerWin(playerIdx);
    busy = false;
    return;
  }

  // Switch turn
  currentPlayer = currentPlayer === 1 ? 2 : 1;
  updateTurnBanner();

  const nextName = getPlayerName(currentPlayer - 1);

  if (gameMode === '2p' || currentPlayer === 1) {
    showMessage(`${nextName}'s turn — press Roll Dice! 🎲`);
    rollBtn.disabled = false;
    busy = false;
  } else {
    // Computer auto-rolls
    showMessage('Computer is thinking... 🤖');
    await wait(1400);
    busy = false;
    await rollDice();
  }
}

// ── GAME FLOW ──────────────────────────────────────────────────────────────
function startGame(mode) {
  gameMode = mode;
  p2Label.textContent = mode === 'cpu' ? '🤖 Computer' : '🔵 Player 2';
  $('start-screen').classList.add('hidden');
  $('game').classList.remove('hidden');
  initGame();
}

function initGame() {
  currentPlayer    = 1;
  positions        = [0, 0];
  busy             = false;
  diceResult.textContent = '';
  dotGrid.innerHTML      = '';
  const p1Label = document.getElementById('p1-label');
  if (p1Label) p1Label.textContent = `🔴 ${currentUser || 'Player 1'}`;

  buildBoard();
  createTokens();
  updateScores();
  updateTurnBanner();
  showMessage('Roll the dice to start! 🎲');
  rollBtn.disabled = false;
  winOverlay.classList.add('hidden');
  confettiCont.innerHTML = '';

  // Draw SVG after layout is complete
  requestAnimationFrame(() => requestAnimationFrame(drawOverlay));
}

function newGame() {
  winOverlay.classList.add('hidden');
  confettiCont.innerHTML = '';
  $('game').classList.add('hidden');
  $('start-screen').classList.remove('hidden');
}

// Redraw on resize so tokens and SVG stay aligned
window.addEventListener('resize', () => {
  if (!$('game').classList.contains('hidden')) {
    requestAnimationFrame(() => {
      drawOverlay();
      positions.forEach((sq, i) => { if (sq > 0) placeToken(i, sq); });
    });
  }
});
