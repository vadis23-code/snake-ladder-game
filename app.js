const STORE_KEY = "courtcall-pro-v1";
const AUTH_KEY = "courtcall-pro-auth-v1";
const AUTH_SESSION_KEY = "courtcall-pro-session-v1";
const OTP_TTL_MS = 5 * 60 * 1000;
const VIEWS = ["game", "teams", "tournament", "community", "insights", "settings"];

function uid() {
  if (globalThis.crypto?.randomUUID) return globalThis.crypto.randomUUID();
  return `id-${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
}

function clone(value) {
  if (globalThis.structuredClone) return structuredClone(value);
  return JSON.parse(JSON.stringify(value));
}

function bytesToHex(bytes) {
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
}

function randomHex(length = 16) {
  const bytes = new Uint8Array(length);
  if (globalThis.crypto?.getRandomValues) globalThis.crypto.getRandomValues(bytes);
  else for (let i = 0; i < bytes.length; i += 1) bytes[i] = Math.floor(Math.random() * 256);
  return bytesToHex(bytes);
}

function normalizeEmail(email) {
  return safeText(email).toLowerCase();
}

function normalizePhone(phone) {
  return safeText(phone).replace(/[^\d+]/g, "");
}

function passwordScore(password) {
  let score = 0;
  if (password.length >= 12) score += 1;
  if (/[a-z]/.test(password) && /[A-Z]/.test(password)) score += 1;
  if (/\d/.test(password)) score += 1;
  if (/[^A-Za-z0-9]/.test(password)) score += 1;
  return score;
}

function localPasswordHash(password, salt) {
  const text = `${salt}:${password}`;
  let hash = 2166136261;
  for (let i = 0; i < text.length; i += 1) {
    hash ^= text.charCodeAt(i);
    hash += (hash << 1) + (hash << 4) + (hash << 7) + (hash << 8) + (hash << 24);
  }
  return `local:${(hash >>> 0).toString(16)}`;
}

async function hashPassword(password, salt, existingHash = "") {
  const storedHash = String(existingHash || "");
  if (storedHash.startsWith("local:")) return localPasswordHash(password, salt);
  if (globalThis.crypto?.subtle && globalThis.TextEncoder) {
    try {
      const enc = new TextEncoder();
      const key = await globalThis.crypto.subtle.importKey("raw", enc.encode(password), "PBKDF2", false, ["deriveBits"]);
      const bits = await globalThis.crypto.subtle.deriveBits(
        { name: "PBKDF2", salt: enc.encode(salt), iterations: 160000, hash: "SHA-256" },
        key,
        256
      );
      return `pbkdf2:${bytesToHex(new Uint8Array(bits))}`;
    } catch {
      return localPasswordHash(password, salt);
    }
  }
  return localPasswordHash(password, salt);
}

const DEFAULT_STATE = {
  view: "game",
  settings: { reduceMotion: false, sound: true },
  game: {
    teamA: "Home",
    teamB: "Away",
    scoreA: 0,
    scoreB: 0,
    foulsA: 0,
    foulsB: 0,
    gameSeconds: 600,
    shotSeconds: 24,
    defaultGameSeconds: 600,
    defaultShotSeconds: 24,
    targetScore: 21,
    winMode: "time",
    running: false,
    finalized: false,
    log: [],
    undo: []
  },
  roster: [
    { id: uid(), name: "Maya", skill: 8 },
    { id: uid(), name: "Jordan", skill: 7 },
    { id: uid(), name: "Dev", skill: 6 },
    { id: uid(), name: "Sam", skill: 6 }
  ],
  generatedTeams: [],
  bracket: [],
  games: [],
  events: [],
  posts: [
    { id: uid(), text: "Court 2 is open after 7:30 PM.", createdAt: new Date().toISOString() }
  ]
};

let state = loadState();
let auth = loadAuth();
const hashView = location.hash.replace("#", "");
if (VIEWS.includes(hashView)) state.view = hashView;
if (!VIEWS.includes(state.view)) state.view = "game";
sanitizeState();
let ticker = null;
let installPrompt = null;
let lastLegalTrigger = null;

const $ = (selector, root = document) => root.querySelector(selector);
const $$ = (selector, root = document) => Array.from(root.querySelectorAll(selector));

function loadState() {
  try {
    const saved = JSON.parse(localStorage.getItem(STORE_KEY));
    if (!saved || typeof saved !== "object") return clone(DEFAULT_STATE);
    return mergeState(clone(DEFAULT_STATE), saved);
  } catch {
    return clone(DEFAULT_STATE);
  }
}

function mergeState(base, saved) {
  if (!saved || typeof saved !== "object") return base;
  for (const key of Object.keys(saved)) {
    if (!(key in base)) continue;
    const incoming = saved[key];
    const current = base[key];
    if (incoming === null || incoming === undefined) continue;
    if (Array.isArray(current)) {
      if (Array.isArray(incoming)) base[key] = incoming;
    } else if (current && typeof current === "object") {
      if (typeof incoming === "object" && !Array.isArray(incoming)) base[key] = mergeState(current, incoming);
    } else {
      base[key] = incoming;
    }
  }
  return base;
}

function asArray(value) {
  return Array.isArray(value) ? value : [];
}

function sanitizeState() {
  if (!state.settings || typeof state.settings !== "object") state.settings = clone(DEFAULT_STATE.settings);
  state.settings.reduceMotion = Boolean(state.settings.reduceMotion);
  state.settings.sound = state.settings.sound !== false;
  if (!state.game || typeof state.game !== "object") state.game = clone(DEFAULT_STATE.game);
  state.game.teamA = safeText(state.game.teamA) || "Home";
  state.game.teamB = safeText(state.game.teamB) || "Away";
  state.game.scoreA = clampNumber(state.game.scoreA, 0, 999, 0);
  state.game.scoreB = clampNumber(state.game.scoreB, 0, 999, 0);
  state.game.foulsA = clampNumber(state.game.foulsA, 0, 99, 0);
  state.game.foulsB = clampNumber(state.game.foulsB, 0, 99, 0);
  state.game.defaultGameSeconds = clampNumber(state.game.defaultGameSeconds, 120, 3600, 600);
  state.game.defaultShotSeconds = clampNumber(state.game.defaultShotSeconds, 8, 35, 24);
  state.game.gameSeconds = clampNumber(state.game.gameSeconds, 0, 3600, state.game.defaultGameSeconds);
  state.game.shotSeconds = clampNumber(state.game.shotSeconds, 0, 35, state.game.defaultShotSeconds);
  state.game.targetScore = clampNumber(state.game.targetScore, 7, 51, 21);
  state.game.winMode = state.game.winMode === "target" ? "target" : "time";
  state.game.running = false;
  state.game.finalized = Boolean(state.game.finalized);
  state.game.log = asArray(state.game.log)
    .filter((entry) => entry && typeof entry === "object" && safeText(entry.text))
    .map((entry) => ({ id: entry.id || uid(), text: safeText(entry.text), at: entry.at || new Date().toISOString() }))
    .slice(0, 30);
  state.game.undo = asArray(state.game.undo).filter((entry) => entry && typeof entry === "object").slice(-20);
  state.roster = asArray(state.roster)
    .filter((player) => player && typeof player === "object" && safeText(player.name))
    .map((player) => ({ id: player.id || uid(), name: safeText(player.name).slice(0, 32), skill: clampNumber(player.skill, 1, 10, 6) }));
  state.generatedTeams = asArray(state.generatedTeams)
    .filter((team) => team && Array.isArray(team.players))
    .map((team) => {
      const players = team.players
        .filter((player) => player && typeof player === "object" && safeText(player.name))
        .map((player) => ({ id: player.id || uid(), name: safeText(player.name), skill: clampNumber(player.skill, 1, 10, 6) }));
      return { players, total: clampNumber(team.total, 0, 1000, players.reduce((sum, player) => sum + player.skill, 0)) };
    });
  state.bracket = asArray(state.bracket)
    .filter((match) => match && typeof match === "object" && safeText(match.a))
    .map((match) => ({ round: safeText(match.round) || "Round", a: safeText(match.a), b: safeText(match.b), type: safeText(match.type) || "Scheduled" }));
  state.games = asArray(state.games)
    .filter((game) => game && typeof game === "object" && safeText(game.teamA) && safeText(game.teamB))
    .map((game) => ({
      id: game.id || uid(),
      teamA: safeText(game.teamA),
      teamB: safeText(game.teamB),
      scoreA: clampNumber(game.scoreA, 0, 999, 0),
      scoreB: clampNumber(game.scoreB, 0, 999, 0),
      winner: safeText(game.winner) || "Unknown",
      finishedAt: game.finishedAt || new Date().toISOString()
    }));
  state.events = asArray(state.events)
    .filter((event) => event && typeof event === "object" && safeText(event.title))
    .map((event) => ({
      id: event.id || uid(),
      title: safeText(event.title).slice(0, 48),
      date: event.date || todayInputValue(),
      time: event.time || "19:00",
      location: safeText(event.location) || "TBD"
    }));
  state.posts = asArray(state.posts)
    .filter((post) => post && typeof post === "object" && safeText(post.text))
    .map((post) => ({ id: post.id || uid(), text: safeText(post.text).slice(0, 220), createdAt: post.createdAt || new Date().toISOString() }));
}

function saveState() {
  try {
    localStorage.setItem(STORE_KEY, JSON.stringify(state));
  } catch {
    toast("Local storage is full or blocked. Export a backup before adding more data.");
  }
}

function safeText(value) {
  return String(value ?? "").trim();
}

function loadAuth() {
  try {
    const saved = JSON.parse(localStorage.getItem(AUTH_KEY));
    const session = saved?.session || JSON.parse(sessionStorage.getItem(AUTH_SESSION_KEY) || "null");
    if (!saved || typeof saved !== "object") return { users: [], session, otp: null };
    return {
      users: Array.isArray(saved.users) ? saved.users.filter((user) => user && typeof user === "object") : [],
      session,
      otp: saved.otp || null
    };
  } catch {
    return { users: [], session: null, otp: null };
  }
}

function saveAuth() {
  const persistentSession = auth.session?.remember ? auth.session : null;
  try {
    localStorage.setItem(AUTH_KEY, JSON.stringify({ users: auth.users, otp: auth.otp, session: persistentSession }));
    if (auth.session && !auth.session.remember) sessionStorage.setItem(AUTH_SESSION_KEY, JSON.stringify(auth.session));
    else sessionStorage.removeItem(AUTH_SESSION_KEY);
  } catch {
    toast("Your browser blocked local account storage.");
  }
}

function currentUser() {
  if (auth.session?.guest) return { name: "Guest", email: "", guest: true };
  return auth.users.find((user) => user.id === auth.session?.userId) || null;
}

function setAuthError(message = "") {
  $("#authError").textContent = message;
}

function showAuthMode(mode) {
  const activePanel = $(`[data-auth-panel="${mode}"]`);
  if (!activePanel) return;
  setAuthError("");
  $$(".auth-tab").forEach((tab) => {
    const isActive = tab.dataset.authMode === mode;
    tab.classList.toggle("active", isActive);
    tab.setAttribute("aria-selected", String(isActive));
    tab.tabIndex = isActive ? 0 : -1;
  });
  $$(".auth-form").forEach((panel) => {
    const isActive = panel.dataset.authPanel === mode;
    panel.classList.toggle("active", isActive);
    panel.hidden = !isActive;
  });
  window.setTimeout(() => {
    if (activePanel.hidden || $("#authGate").classList.contains("hidden")) return;
    $("input, textarea, select", activePanel)?.focus();
  }, 0);
}

function updateAuthUI() {
  const user = currentUser();
  $("#authGate").classList.toggle("hidden", Boolean(user));
  $("#authGate").setAttribute("aria-hidden", user ? "true" : "false");
  $("#profileChip").textContent = user ? (user.guest ? "Guest session" : user.name) : "Signed out";
  $("#logoutBtn").hidden = !user;
  $("#newGameBtn").disabled = !user;
  if (!user) window.setTimeout(() => $("#signinEmail")?.focus(), 0);
}

function validateEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function validatePhone(phone) {
  return /^\+?\d{8,15}$/.test(phone);
}

function setBusy(button, busy, label = "Working...") {
  if (!button) return;
  if (busy) {
    button.dataset.originalText = button.textContent;
    button.textContent = label;
    button.disabled = true;
    button.classList.add("loading-btn");
  } else {
    button.textContent = button.dataset.originalText || button.textContent;
    button.disabled = false;
    button.classList.remove("loading-btn");
  }
}

function clampNumber(value, min, max, fallback) {
  const number = Number(value);
  if (!Number.isFinite(number)) return fallback;
  return Math.min(max, Math.max(min, Math.round(number)));
}

function formatClock(total) {
  const seconds = Math.max(0, total);
  const minutes = Math.floor(seconds / 60);
  const rest = String(seconds % 60).padStart(2, "0");
  return `${minutes}:${rest}`;
}

function todayInputValue() {
  const date = new Date();
  date.setMinutes(date.getMinutes() - date.getTimezoneOffset());
  return date.toISOString().slice(0, 10);
}

function emptyState(title, description) {
  return `<div class="empty-state"><strong>${title}</strong><p>${description}</p></div>`;
}

function toast(message) {
  const item = document.createElement("div");
  item.className = "toast";
  item.textContent = message;
  $("#toastRegion").append(item);
  window.setTimeout(() => item.remove(), 3200);
}

function announce(message) {
  state.game.log.unshift({ id: uid(), text: message, at: new Date().toISOString() });
  state.game.log = state.game.log.slice(0, 30);
}

function snapshot() {
  state.game.undo.push({
    teamA: state.game.teamA,
    teamB: state.game.teamB,
    scoreA: state.game.scoreA,
    scoreB: state.game.scoreB,
    foulsA: state.game.foulsA,
    foulsB: state.game.foulsB,
    gameSeconds: state.game.gameSeconds,
    shotSeconds: state.game.shotSeconds,
    defaultGameSeconds: state.game.defaultGameSeconds,
    defaultShotSeconds: state.game.defaultShotSeconds,
    targetScore: state.game.targetScore,
    winMode: state.game.winMode,
    running: state.game.running,
    finalized: state.game.finalized,
    log: clone(state.game.log),
    gamesLength: state.games.length
  });
  state.game.undo = state.game.undo.slice(-20);
}

function restoreSnapshot(last) {
  const { gamesLength, ...gameSnapshot } = last;
  Object.assign(state.game, gameSnapshot);
  if (Number.isInteger(gamesLength)) state.games = state.games.slice(0, gamesLength);
  if (state.game.running) startTicker();
  else stopTicker();
}

function render() {
  updateAuthUI();
  renderTabs();
  renderGame();
  renderRoster();
  renderBracket();
  renderCommunity();
  renderInsights();
  renderSettings();
  saveState();
}

function renderTabs() {
  if (!VIEWS.includes(state.view)) state.view = "game";
  $$(".tab").forEach((tab) => {
    const isActive = tab.dataset.view === state.view;
    tab.classList.toggle("active", isActive);
    tab.setAttribute("aria-current", isActive ? "page" : "false");
    tab.setAttribute("aria-selected", String(isActive));
    tab.tabIndex = isActive ? 0 : -1;
  });
  $$(".view-panel").forEach((panel) => {
    const isActive = panel.id === `view-${state.view}`;
    panel.classList.toggle("active", isActive);
    panel.hidden = !isActive;
  });
}

function renderGame() {
  const finished = gameIsFinished();
  $("#teamAName").value = state.game.teamA;
  $("#teamBName").value = state.game.teamB;
  $("#scoreA").textContent = state.game.scoreA;
  $("#scoreB").textContent = state.game.scoreB;
  $("#foulsA").textContent = state.game.foulsA;
  $("#foulsB").textContent = state.game.foulsB;
  $("#gameClock").textContent = formatClock(state.game.gameSeconds);
  $("#shotClock").textContent = state.game.shotSeconds;
  $("#clockToggle").textContent = state.game.running ? "Pause" : "Start";
  $("#clockToggle").disabled = finished;
  $("#shotReset").disabled = finished;
  $("#endGameBtn").disabled = finished;
  $$("[data-score], [data-foul]").forEach((button) => {
    button.disabled = finished;
  });
  $("#gameStatus").textContent = state.game.running ? "Live" : finished ? "Final" : "Ready";
  $("#winMode").value = state.game.winMode;
  $("#targetScore").value = state.game.targetScore;
  $("#gameMinutes").value = Math.round(state.game.defaultGameSeconds / 60);
  $("#shotSeconds").value = state.game.defaultShotSeconds;

  const feed = $("#gameFeed");
  feed.innerHTML = "";
  if (!state.game.log.length) {
    const li = document.createElement("li");
    li.innerHTML = emptyState("No game events yet", "Start the clock or add a score to build a live game timeline.");
    feed.append(li);
  } else {
    for (const entry of state.game.log) {
      const li = document.createElement("li");
      li.textContent = `${new Date(entry.at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })} - ${entry.text}`;
      feed.append(li);
    }
  }
}

function gameIsFinished() {
  if (state.game.finalized) return true;
  if (state.game.winMode === "target") {
    return state.game.scoreA >= state.game.targetScore || state.game.scoreB >= state.game.targetScore;
  }
  return state.game.gameSeconds === 0;
}

function renderRoster() {
  const list = $("#rosterList");
  list.innerHTML = "";
  if (!state.roster.length) {
    const li = document.createElement("li");
    li.textContent = "No players yet.";
    list.append(li);
  }
  for (const player of state.roster) {
    const li = document.createElement("li");
    li.innerHTML = `<strong></strong><span></span>`;
    $("strong", li).textContent = player.name;
    $("span", li).textContent = `Skill ${player.skill}`;
    const remove = document.createElement("button");
    remove.type = "button";
    remove.setAttribute("aria-label", `Remove ${player.name}`);
    remove.textContent = "×";
    remove.addEventListener("click", () => {
      state.roster = state.roster.filter((item) => item.id !== player.id);
      render();
    });
    li.append(remove);
    list.append(li);
  }

  const output = $("#teamOutput");
  output.innerHTML = "";
  if (!state.generatedTeams.length) {
    output.innerHTML = emptyState("Teams are ready when you are", "Add at least four players, then build balanced sides with one click.");
    return;
  }
  state.generatedTeams.forEach((team, index) => {
    const card = document.createElement("article");
    card.className = "team-card";
    card.innerHTML = `<strong></strong><p></p><small></small>`;
    $("strong", card).textContent = `Team ${index + 1}`;
    $("p", card).textContent = team.players.map((player) => player.name).join(", ");
    $("small", card).textContent = `Total skill ${team.total}`;
    output.append(card);
  });
}

function renderBracket() {
  const output = $("#bracketOutput");
  output.innerHTML = "";
  if (!state.bracket.length) {
    output.innerHTML = emptyState("No bracket generated", "Paste team names, choose a format, and generate a launch-ready schedule.");
    return;
  }
  for (const match of state.bracket) {
    const card = document.createElement("article");
    card.className = "match-card";
    card.innerHTML = `<strong></strong><p></p><small></small>`;
    $("strong", card).textContent = match.round;
    $("p", card).textContent = match.b ? `${match.a} vs ${match.b}` : `${match.a} has a bye`;
    $("small", card).textContent = match.type;
    output.append(card);
  }
}

function renderCommunity() {
  const eventList = $("#eventList");
  eventList.innerHTML = "";
  const sortedEvents = [...state.events].sort((a, b) => `${a.date}T${a.time}`.localeCompare(`${b.date}T${b.time}`));
  if (!sortedEvents.length) {
    eventList.innerHTML = `<li>${emptyState("No events scheduled", "Create the next run so players know when and where to show up.")}</li>`;
  }
  for (const event of sortedEvents) {
    const li = document.createElement("li");
    li.innerHTML = `<strong></strong><span></span><button type="button" class="ghost-btn">Remove</button>`;
    $("strong", li).textContent = event.title;
    $("span", li).textContent = `${event.date} ${event.time} at ${event.location}`;
    $("button", li).addEventListener("click", () => {
      state.events = state.events.filter((item) => item.id !== event.id);
      render();
    });
    eventList.append(li);
  }

  const postList = $("#postList");
  postList.innerHTML = "";
  if (!state.posts.length) postList.innerHTML = `<li>${emptyState("No announcements yet", "Share court updates, rules, or schedule changes with the community.")}</li>`;
  for (const post of state.posts) {
    const li = document.createElement("li");
    li.innerHTML = `<p></p><small></small>`;
    $("p", li).textContent = post.text;
    $("small", li).textContent = new Date(post.createdAt).toLocaleString();
    postList.append(li);
  }
}

function renderInsights() {
  $("#metricGames").textContent = state.games.length;
  $("#metricPlayers").textContent = state.roster.length;
  $("#metricEvents").textContent = state.events.length;
  const avg = state.games.length
    ? Math.round(state.games.reduce((sum, game) => sum + game.scoreA + game.scoreB, 0) / state.games.length)
    : 0;
  $("#metricAvg").textContent = avg;

  const rows = $("#historyRows");
  rows.innerHTML = "";
  if (!state.games.length) {
    rows.innerHTML = `<tr><td colspan="4">${emptyState("No completed games", "Finish a game from the scoreboard to see history and scoring insights here.")}</td></tr>`;
    return;
  }
  for (const game of state.games.slice(0, 12)) {
    const row = document.createElement("tr");
    row.innerHTML = `<td></td><td></td><td></td><td></td>`;
    row.children[0].textContent = `${game.teamA} vs ${game.teamB}`;
    row.children[1].textContent = `${game.scoreA}-${game.scoreB}`;
    row.children[2].textContent = game.winner;
    row.children[3].textContent = new Date(game.finishedAt).toLocaleDateString();
    rows.append(row);
  }
}

function renderSettings() {
  $("#motionToggle").checked = state.settings.reduceMotion;
  $("#soundToggle").checked = state.settings.sound;
  document.body.classList.toggle("reduce-motion", state.settings.reduceMotion);
}

function applyRules() {
  state.game.winMode = $("#winMode").value;
  state.game.targetScore = clampNumber($("#targetScore").value, 7, 51, 21);
  state.game.defaultGameSeconds = clampNumber($("#gameMinutes").value, 2, 60, 10) * 60;
  state.game.defaultShotSeconds = clampNumber($("#shotSeconds").value, 8, 35, 24);
  if (!state.game.running && !state.game.finalized) {
    state.game.gameSeconds = state.game.defaultGameSeconds;
    state.game.shotSeconds = state.game.defaultShotSeconds;
  }
}

function addScore(team, points) {
  if (gameIsFinished()) return toast("Start a new game to keep scoring.");
  snapshot();
  const key = team === "A" ? "scoreA" : "scoreB";
  const name = team === "A" ? state.game.teamA : state.game.teamB;
  state.game[key] += points;
  state.game.shotSeconds = state.game.defaultShotSeconds;
  announce(`${name} scored ${points}.`);
  if (gameIsFinished()) finishGame();
  render();
}

function addFoul(team) {
  if (gameIsFinished()) return toast("Start a new game to record more fouls.");
  snapshot();
  const key = team === "A" ? "foulsA" : "foulsB";
  const name = team === "A" ? state.game.teamA : state.game.teamB;
  state.game[key] += 1;
  announce(`${name} committed a foul.`);
  render();
}

function finishGame() {
  if (state.game.finalized) {
    toast("This game is already final.");
    return;
  }
  state.game.running = false;
  stopTicker();
  const a = state.game.scoreA;
  const b = state.game.scoreB;
  const winner = a === b ? "Tie" : a > b ? state.game.teamA : state.game.teamB;
  state.games.unshift({
    id: uid(),
    teamA: state.game.teamA,
    teamB: state.game.teamB,
    scoreA: a,
    scoreB: b,
    winner,
    finishedAt: new Date().toISOString()
  });
  state.game.finalized = true;
  announce(winner === "Tie" ? `Final: ${state.game.teamA} and ${state.game.teamB} tied ${a}-${b}.` : `Final: ${winner} won ${a}-${b}.`);
  toast(winner === "Tie" ? "Game ended in a tie." : `${winner} wins.`);
}

function resetGame(keepTeams = true) {
  state.game = {
    ...clone(DEFAULT_STATE.game),
    teamA: keepTeams ? state.game.teamA : "Home",
    teamB: keepTeams ? state.game.teamB : "Away",
    defaultGameSeconds: state.game.defaultGameSeconds,
    defaultShotSeconds: state.game.defaultShotSeconds,
    gameSeconds: state.game.defaultGameSeconds,
    shotSeconds: state.game.defaultShotSeconds,
    targetScore: state.game.targetScore,
    winMode: state.game.winMode
  };
  stopTicker();
  announce("New game started.");
  render();
}

function tick() {
  if (!state.game.running) return;
  if (state.game.gameSeconds > 0) state.game.gameSeconds -= 1;
  if (state.game.shotSeconds > 0) state.game.shotSeconds -= 1;
  if (state.game.shotSeconds === 0) {
    announce("Shot clock expired.");
    state.game.shotSeconds = state.game.defaultShotSeconds;
  }
  if (gameIsFinished()) finishGame();
  render();
}

function startTicker() {
  if (ticker) return;
  ticker = window.setInterval(tick, 1000);
}

function stopTicker() {
  window.clearInterval(ticker);
  ticker = null;
}

function balanceTeams() {
  if (state.roster.length < 4) return toast("Add at least four players.");
  const sorted = [...state.roster].sort((a, b) => b.skill - a.skill);
  const teams = [{ players: [], total: 0 }, { players: [], total: 0 }];
  sorted.forEach((player) => {
    const target = teams[0].total <= teams[1].total ? teams[0] : teams[1];
    target.players.push(player);
    target.total += player.skill;
  });
  state.generatedTeams = teams;
  toast("Balanced teams created.");
  render();
}

function makeBracket() {
  const teams = $("#tournamentTeams").value
    .split("\n")
    .map((team) => safeText(team))
    .filter(Boolean);
  const uniqueTeams = [...new Set(teams)];
  if (uniqueTeams.length < 2) return toast("Add at least two teams.");
  const format = $("#tournamentFormat").value;
  const bracket = [];
  if (format === "roundRobin") {
    for (let i = 0; i < uniqueTeams.length; i += 1) {
      for (let j = i + 1; j < uniqueTeams.length; j += 1) {
        bracket.push({ round: "Round robin", a: uniqueTeams[i], b: uniqueTeams[j], type: "Scheduled" });
      }
    }
  } else {
    const queue = [...uniqueTeams];
    if (queue.length % 2 === 1) {
      bracket.push({ round: "Round 1", a: queue.shift(), b: "", type: "Bye" });
    }
    for (let i = 0; i < queue.length; i += 2) {
      bracket.push({ round: "Round 1", a: queue[i], b: queue[i + 1], type: "Elimination" });
    }
  }
  state.bracket = bracket;
  toast("Bracket generated.");
  render();
}

function exportBackup() {
  const payload = {
    version: 1,
    exportedAt: new Date().toISOString(),
    app: "CourtCall Pro",
    data: state
  };
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `courtcall-backup-${new Date().toISOString().slice(0, 10)}.json`;
  link.hidden = true;
  document.body.append(link);
  link.click();
  window.setTimeout(() => {
    URL.revokeObjectURL(url);
    link.remove();
  }, 0);
}

function runHealthCheck() {
  const ids = $$("[id]").map((node) => node.id);
  const uniqueIds = new Set(ids).size === ids.length;
  const tabControls = $$(".tab").every((tab) => Boolean($(`#${tab.getAttribute("aria-controls")}`)));
  const authControls = $$(".auth-tab").every((tab) => Boolean($(`#${tab.getAttribute("aria-controls")}`)));
  const requiredButtons = [
    "newGameBtn", "logoutBtn", "clockToggle", "shotReset", "undoBtn", "swapBtn", "endGameBtn",
    "balanceTeamsBtn", "makeBracketBtn", "seedDemoBtn", "exportBtn", "healthBtn", "assistantBtn"
  ];
  const checks = [
    ["Navigation tabs", $$(".tab").length === VIEWS.length],
    ["View panels", VIEWS.every((view) => Boolean($(`#view-${view}`)))],
    ["Tab ARIA wiring", tabControls && authControls && uniqueIds],
    ["Auth forms", ["signinForm", "registerForm", "otpForm", "resetForm"].every((id) => Boolean($(`#${id}`)))],
    ["Password confirmation", Boolean($("#registerPasswordConfirm")) && Boolean($("#resetPasswordConfirm"))],
    ["Score controls", $$("[data-score]").length === 6 && $$("[data-foul]").length === 2],
    ["Primary button wiring", requiredButtons.every((id) => Boolean($(`#${id}`)))],
    ["Local storage", (() => {
      try {
        localStorage.setItem("courtcall-health", "ok");
        localStorage.removeItem("courtcall-health");
        return true;
      } catch {
        return false;
      }
    })()],
    ["Service worker support", "serviceWorker" in navigator || location.protocol === "file:"],
    ["Reduced motion setting", Boolean($("#motionToggle"))],
    ["Backup export", Boolean($("#exportBtn"))],
    ["Demo auth disclosure", $("#authGate").textContent.toLowerCase().includes("demo")]
  ];
  const list = $("#healthList");
  list.innerHTML = "";
  checks.forEach(([label, pass]) => {
    const li = document.createElement("li");
    li.className = pass ? "pass" : "warn";
    li.textContent = `${pass ? "Pass" : "Review"}: ${label}`;
    list.append(li);
  });
  toast(checks.every(([, pass]) => pass) ? "Health check passed." : "Health check found items to review.");
}

async function importBackup(file) {
  if (!file) return;
  try {
    const payload = JSON.parse(await file.text());
    if (payload?.app !== "CourtCall Pro" || !payload.data) throw new Error("Invalid file");
    state = mergeState(clone(DEFAULT_STATE), payload.data);
    sanitizeState();
    render();
    toast("Backup imported.");
  } catch {
    toast("That backup file could not be imported.");
  } finally {
    $("#importFile").value = "";
  }
}

function seedDemo() {
  state.games = [
    { id: uid(), teamA: "Northside", teamB: "Fastbreak", scoreA: 21, scoreB: 17, winner: "Northside", finishedAt: new Date().toISOString() },
    { id: uid(), teamA: "Downtown", teamB: "Baseline", scoreA: 18, scoreB: 21, winner: "Baseline", finishedAt: new Date(Date.now() - 86400000).toISOString() }
  ];
  state.events = [
    { id: uid(), title: "Friday Night Run", date: new Date(Date.now() + 86400000).toISOString().slice(0, 10), time: "19:30", location: "Court 2" }
  ];
  toast("Sample data loaded.");
  render();
}

function assistantAnswer(text) {
  const q = text.toLowerCase();
  if (q.includes("backup") || q.includes("export")) return "Open Settings and choose Export backup. This version exports the full app state, including games, roster, events, posts, settings, and brackets.";
  if (q.includes("team")) return "Open Teams, add players with skill ratings from 1 to 10, then build teams. The balancer assigns the next strongest player to the lower-rated side.";
  if (q.includes("tournament") || q.includes("bracket")) return "Open Tournament, paste one team per line, choose knockout or round robin, then generate. Odd knockout counts receive a bye.";
  if (q.includes("score") || q.includes("clock")) return "Use the Game screen for +1, +2, +3, fouls, game clock, shot clock, undo, and final game logging.";
  if (q.includes("privacy") || q.includes("data")) return "This version stores data locally in your browser. It does not send your games, roster, or events to a server.";
  return "I can help with scoring, teams, tournaments, backups, privacy, and events. Try asking one of those.";
}

function addAssistantMessage(role, text) {
  const message = document.createElement("div");
  message.className = `assistant-message ${role}`;
  message.textContent = text;
  $("#assistantLog").append(message);
  $("#assistantLog").scrollTop = $("#assistantLog").scrollHeight;
}

function setInert(element, inert) {
  element.inert = inert;
  element.toggleAttribute("inert", inert);
}

function openAssistant() {
  $("#assistantPanel").classList.add("open");
  $("#assistantPanel").setAttribute("aria-hidden", "false");
  setInert($("#assistantPanel"), false);
  $("#assistantBtn").setAttribute("aria-expanded", "true");
  $("#assistantInput").focus();
  if (!$("#assistantLog").children.length) {
    addAssistantMessage("bot", "Ask me about scoring, teams, tournaments, backups, privacy, or events.");
  }
}

function closeAssistant() {
  $("#assistantPanel").classList.remove("open");
  $("#assistantPanel").setAttribute("aria-hidden", "true");
  setInert($("#assistantPanel"), true);
  $("#assistantBtn").setAttribute("aria-expanded", "false");
  $("#assistantBtn").focus();
}

function openLegalModal(type) {
  lastLegalTrigger = document.activeElement instanceof HTMLElement ? document.activeElement : null;
  const isTerms = type === "terms";
  $("#legalTitle").textContent = isTerms ? "Terms" : "Privacy notice";
  $("#legalBody").textContent = isTerms
    ? "This launch prototype is provided for testing CourtCall Pro workflows. Production use should add hosted authentication, account recovery, abuse prevention, monitoring, and region-specific legal terms."
    : "This static version stores accounts, games, rosters, events, posts, and settings locally in your browser. No server receives this data until you connect a production backend.";
  $("#legalModal").classList.add("open");
  $("#legalModal").setAttribute("aria-hidden", "false");
  setInert($("#legalModal"), false);
  $("#legalOk").focus();
}

function closeLegalModal() {
  $("#legalModal").classList.remove("open");
  $("#legalModal").setAttribute("aria-hidden", "true");
  setInert($("#legalModal"), true);
  if (lastLegalTrigger && document.contains(lastLegalTrigger)) lastLegalTrigger.focus();
  lastLegalTrigger = null;
}

function moveWithinTabs(tabs, current, direction) {
  const index = tabs.indexOf(current);
  const next = tabs[(index + direction + tabs.length) % tabs.length];
  next.focus();
  next.click();
}

function trapFocusIn(container, event) {
  if (event.key !== "Tab") return;
  const focusable = $$("button, input, textarea, select, a[href], [tabindex]:not([tabindex='-1'])", container)
    .filter((item) => !item.disabled && item.offsetParent !== null);
  if (!focusable.length) return;
  const first = focusable[0];
  const last = focusable[focusable.length - 1];
  if (event.shiftKey && document.activeElement === first) {
    event.preventDefault();
    last.focus();
  } else if (!event.shiftKey && document.activeElement === last) {
    event.preventDefault();
    first.focus();
  }
}

function trapAssistantFocus(event) {
  if (!$("#authGate").classList.contains("hidden")) trapFocusIn($("#authGate"), event);
  if ($("#assistantPanel").classList.contains("open")) trapFocusIn($("#assistantPanel"), event);
  if ($("#legalModal").classList.contains("open")) trapFocusIn($("#legalModal"), event);
}

function bindEvents() {
  $("#eventDate").min = todayInputValue();

  $$("[data-auth-mode]").forEach((button) => button.addEventListener("click", () => showAuthMode(button.dataset.authMode)));
  $$(".auth-tab").forEach((tab) => tab.addEventListener("keydown", (event) => {
    if (!["ArrowRight", "ArrowLeft", "Home", "End"].includes(event.key)) return;
    event.preventDefault();
    const tabs = $$(".auth-tab");
    if (event.key === "Home") return tabs[0].click();
    if (event.key === "End") return tabs[tabs.length - 1].click();
    moveWithinTabs(tabs, tab, event.key === "ArrowRight" ? 1 : -1);
  }));

  $("#registerPassword").addEventListener("input", (event) => {
    const score = passwordScore(event.target.value);
    $("#passwordMeter").value = score;
    $("#passwordHelp").textContent = score < 4
      ? "Use 12+ characters with uppercase, lowercase, number, and symbol."
      : "Strong password. Nice.";
  });

  $$("[data-toggle-password]").forEach((button) => button.addEventListener("click", () => {
    const input = $(`#${button.dataset.togglePassword}`);
    const showing = input.type === "text";
    input.type = showing ? "password" : "text";
    button.textContent = showing ? "Show" : "Hide";
    button.setAttribute("aria-label", `${showing ? "Show" : "Hide"} password`);
  }));

  $$("[data-legal]").forEach((button) => button.addEventListener("click", () => openLegalModal(button.dataset.legal)));
  $("#legalClose").addEventListener("click", closeLegalModal);
  $("#legalOk").addEventListener("click", closeLegalModal);
  $("#legalModal").addEventListener("click", (event) => {
    if (event.target.id === "legalModal") closeLegalModal();
  });

  $("#registerForm").addEventListener("submit", async (event) => {
    event.preventDefault();
    const submit = event.submitter;
    const name = safeText($("#registerName").value);
    const email = normalizeEmail($("#registerEmail").value);
    const phone = normalizePhone($("#registerPhone").value);
    const password = $("#registerPassword").value;
    const passwordConfirm = $("#registerPasswordConfirm").value;
    if (name.length < 2) return setAuthError("Please enter your name.");
    if (!validateEmail(email)) return setAuthError("Enter a valid email address.");
    if (phone && !validatePhone(phone)) return setAuthError("Enter a valid mobile number with country code.");
    if (passwordScore(password) < 4) return setAuthError("Password must be 12+ characters and include uppercase, lowercase, number, and symbol.");
    if (password !== passwordConfirm) return setAuthError("Passwords do not match.");
    if (auth.users.some((user) => user.email === email)) return setAuthError("An account already exists for this email.");
    setBusy(submit, true, "Creating...");
    const salt = randomHex();
    const passwordHash = await hashPassword(password, salt);
    const user = { id: uid(), name, email, phone, salt, passwordHash, createdAt: new Date().toISOString() };
    auth.users.push(user);
    auth.session = { userId: user.id, signedInAt: new Date().toISOString(), remember: true };
    saveAuth();
    setBusy(submit, false);
    toast("Account created. Welcome to CourtCall Pro.");
    render();
  });

  $("#signinForm").addEventListener("submit", async (event) => {
    event.preventDefault();
    const submit = event.submitter;
    const email = normalizeEmail($("#signinEmail").value);
    const password = $("#signinPassword").value;
    if (!email) return setAuthError("Enter your email address.");
    if (!validateEmail(email)) return setAuthError("Enter a valid email address.");
    if (!password) return setAuthError("Enter your password.");
    const user = auth.users.find((item) => item.email === email);
    if (!user) return setAuthError("No account found for this email. Create one first.");
    setBusy(submit, true, "Signing in...");
    const passwordHash = await hashPassword(password, user.salt, user.passwordHash);
    setBusy(submit, false);
    if (passwordHash !== user.passwordHash) return setAuthError("Incorrect password.");
    auth.session = { userId: user.id, signedInAt: new Date().toISOString(), remember: $("#rememberMe").checked };
    saveAuth();
    toast("Signed in.");
    render();
  });

  $("#forgotBtn").addEventListener("click", () => {
    $("#resetEmail").value = $("#signinEmail").value;
    showAuthMode("reset");
  });

  $("#resetForm").addEventListener("submit", async (event) => {
    event.preventDefault();
    const submit = event.submitter;
    const email = normalizeEmail($("#resetEmail").value);
    const password = $("#resetPassword").value;
    const passwordConfirm = $("#resetPasswordConfirm").value;
    const user = auth.users.find((item) => item.email === email);
    if (!validateEmail(email)) return setAuthError("Enter the email for your account.");
    if (!user) return setAuthError("No local account found for that email.");
    if (passwordScore(password) < 4) return setAuthError("Choose a stronger password before resetting.");
    if (password !== passwordConfirm) return setAuthError("New passwords do not match.");
    setBusy(submit, true, "Resetting...");
    user.salt = randomHex();
    user.passwordHash = await hashPassword(password, user.salt);
    saveAuth();
    setBusy(submit, false);
    showAuthMode("signin");
    toast("Password reset. Please sign in.");
  });

  $("#sendOtpBtn").addEventListener("click", () => {
    const phone = normalizePhone($("#otpPhone").value);
    if (!validatePhone(phone)) return setAuthError("Enter a valid mobile number with country code.");
    const code = String(Math.floor(100000 + Math.random() * 900000));
    auth.otp = { phone, code, expiresAt: Date.now() + OTP_TTL_MS };
    saveAuth();
    $("#otpHint").textContent = `Local demo code: ${code}. For production, connect an SMS provider.`;
    setAuthError("");
    toast("Verification code generated.");
  });

  $("#otpForm").addEventListener("submit", (event) => {
    event.preventDefault();
    const phone = normalizePhone($("#otpPhone").value);
    const code = safeText($("#otpCode").value);
    if (!auth.otp || auth.otp.phone !== phone || auth.otp.code !== code) return setAuthError("Invalid verification code.");
    if (Date.now() > auth.otp.expiresAt) return setAuthError("That code expired. Send a new code.");
    let user = auth.users.find((item) => item.phone === phone);
    if (!user) {
      user = { id: uid(), name: `Player ${phone.slice(-4)}`, email: "", phone, salt: "", passwordHash: "", createdAt: new Date().toISOString(), otpOnly: true };
      auth.users.push(user);
    }
    auth.session = { userId: user.id, signedInAt: new Date().toISOString(), method: "otp", remember: true };
    auth.otp = null;
    saveAuth();
    toast("Mobile verified.");
    render();
  });

  $("#guestBtn").addEventListener("click", () => {
    auth.session = { guest: true, signedInAt: new Date().toISOString(), remember: false };
    saveAuth();
    toast("Guest session started.");
    render();
  });

  $("#logoutBtn").addEventListener("click", () => {
    auth.session = null;
    saveAuth();
    stopTicker();
    toast("Signed out.");
    render();
  });

  $$(".tab").forEach((tab) => tab.addEventListener("click", () => {
    state.view = tab.dataset.view;
    history.replaceState(null, "", `#${state.view}`);
    tab.scrollIntoView({ block: "nearest", inline: "nearest" });
    render();
  }));
  $$(".tab").forEach((tab) => tab.addEventListener("keydown", (event) => {
    if (!["ArrowRight", "ArrowLeft", "Home", "End"].includes(event.key)) return;
    event.preventDefault();
    const tabs = $$(".tab");
    if (event.key === "Home") return tabs[0].click();
    if (event.key === "End") return tabs[tabs.length - 1].click();
    moveWithinTabs(tabs, tab, event.key === "ArrowRight" ? 1 : -1);
  }));

  window.addEventListener("hashchange", () => {
    const next = location.hash.replace("#", "");
    if (VIEWS.includes(next)) {
      state.view = next;
      render();
    }
  });

  $("#teamAName").addEventListener("change", (event) => {
    state.game.teamA = safeText(event.target.value) || "Home";
    render();
  });
  $("#teamBName").addEventListener("change", (event) => {
    state.game.teamB = safeText(event.target.value) || "Away";
    render();
  });

  $$("[data-score]").forEach((button) => button.addEventListener("click", () => {
    const [team, points] = button.dataset.score.split(":");
    addScore(team, Number(points));
  }));

  $$("[data-foul]").forEach((button) => button.addEventListener("click", () => addFoul(button.dataset.foul)));

  $("#undoBtn").addEventListener("click", () => {
    const last = state.game.undo.pop();
    if (!last) return toast("Nothing to undo.");
    restoreSnapshot(last);
    render();
  });

  $("#swapBtn").addEventListener("click", () => {
    snapshot();
    [state.game.teamA, state.game.teamB] = [state.game.teamB, state.game.teamA];
    [state.game.scoreA, state.game.scoreB] = [state.game.scoreB, state.game.scoreA];
    [state.game.foulsA, state.game.foulsB] = [state.game.foulsB, state.game.foulsA];
    announce("Teams swapped sides.");
    render();
  });

  $("#endGameBtn").addEventListener("click", () => finishGame() || render());
  $("#newGameBtn").addEventListener("click", () => resetGame(true));
  $("#resetGameBtn").addEventListener("click", () => resetGame(false));
  $("#clearLogBtn").addEventListener("click", () => {
    state.game.log = [];
    render();
  });

  $("#clockToggle").addEventListener("click", () => {
    if (gameIsFinished()) return toast("Start a new game to run the clock.");
    state.game.running = !state.game.running;
    state.game.running ? startTicker() : stopTicker();
    render();
  });

  $("#shotReset").addEventListener("click", () => {
    if (gameIsFinished()) return toast("Start a new game to reset the shot clock.");
    state.game.shotSeconds = state.game.defaultShotSeconds;
    render();
  });

  $("#rulesForm").addEventListener("change", () => {
    applyRules();
    render();
  });

  $("#playerForm").addEventListener("submit", (event) => {
    event.preventDefault();
    const name = safeText($("#playerName").value);
    const skill = clampNumber($("#playerSkill").value, 1, 10, 6);
    if (!name) return toast("Player name is required.");
    if (state.roster.some((player) => player.name.toLowerCase() === name.toLowerCase())) {
      return toast("That player is already on the roster.");
    }
    state.roster.push({ id: uid(), name, skill });
    event.target.reset();
    $("#playerSkill").value = 6;
    render();
  });

  $("#balanceTeamsBtn").addEventListener("click", balanceTeams);
  $("#makeBracketBtn").addEventListener("click", makeBracket);

  $("#eventForm").addEventListener("submit", (event) => {
    event.preventDefault();
    const title = safeText($("#eventTitle").value);
    const date = $("#eventDate").value;
    const time = $("#eventTime").value;
    const location = safeText($("#eventLocation").value);
    if (!title || !date || !time || !location) return toast("All event fields are required.");
    if (date < todayInputValue()) return toast("Choose today or a future date.");
    state.events.push({ id: uid(), title, date, time, location });
    event.target.reset();
    render();
  });

  $("#postForm").addEventListener("submit", (event) => {
    event.preventDefault();
    const text = safeText($("#postText").value);
    if (!text) return toast("Post text is required.");
    state.posts.unshift({ id: uid(), text, createdAt: new Date().toISOString() });
    event.target.reset();
    render();
  });

  $("#seedDemoBtn").addEventListener("click", seedDemo);
  $("#motionToggle").addEventListener("change", (event) => {
    state.settings.reduceMotion = event.target.checked;
    render();
  });
  $("#soundToggle").addEventListener("change", (event) => {
    state.settings.sound = event.target.checked;
    render();
  });
  $("#exportBtn").addEventListener("click", exportBackup);
  $("#importFile").addEventListener("change", (event) => importBackup(event.target.files[0]));
  $("#healthBtn").addEventListener("click", runHealthCheck);
  $("#wipeBtn").addEventListener("click", () => {
    if (!confirm("Clear all local CourtCall Pro data and demo accounts in this browser?")) return;
    localStorage.removeItem(STORE_KEY);
    localStorage.removeItem(AUTH_KEY);
    sessionStorage.removeItem(AUTH_SESSION_KEY);
    state = clone(DEFAULT_STATE);
    auth = { users: [], session: null, otp: null };
    stopTicker();
    render();
    toast("Local data and demo accounts cleared.");
  });

  window.addEventListener("offline", () => toast("Offline mode active. CourtCall keeps local scoring available."));
  window.addEventListener("online", () => toast("Back online."));

  $("#assistantBtn").addEventListener("click", openAssistant);
  $("#assistantClose").addEventListener("click", closeAssistant);
  $("#assistantForm").addEventListener("submit", (event) => {
    event.preventDefault();
    const text = safeText($("#assistantInput").value);
    if (!text) return;
    addAssistantMessage("user", text);
    $("#assistantInput").value = "";
    window.setTimeout(() => addAssistantMessage("bot", assistantAnswer(text)), 120);
  });

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && $("#assistantPanel").classList.contains("open")) closeAssistant();
    if (event.key === "Escape" && $("#legalModal").classList.contains("open")) closeLegalModal();
    trapAssistantFocus(event);
  });

  window.addEventListener("beforeinstallprompt", (event) => {
    event.preventDefault();
    installPrompt = event;
    $("#installBtn").hidden = false;
  });
  $("#installBtn").addEventListener("click", async () => {
    if (!installPrompt) return;
    installPrompt.prompt();
    await installPrompt.userChoice;
    installPrompt = null;
    $("#installBtn").hidden = true;
  });
}

try {
  showAuthMode("signin");
  bindEvents();
  setInert($("#assistantPanel"), true);
  setInert($("#legalModal"), true);
  applyRules();
  render();
} catch (error) {
  console.error("CourtCall Pro failed to start", error);
  const message = document.createElement("div");
  message.className = "toast";
  message.textContent = "CourtCall Pro could not start. Refresh the page or check the browser console.";
  document.body.append(message);
}

if ("serviceWorker" in navigator && location.protocol !== "file:") {
  navigator.serviceWorker.register("sw.js").catch(() => {});
}
