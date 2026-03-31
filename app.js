const STORAGE_KEY = 'padel-riga-multi-tournaments-v9';
const TRANSITION_MINUTES = 5;
const PLAYERS_PER_COURT = 4;
const PLAYERS_PER_TEAM = 2;
let historyExpanded = false;
let toastTimer = null;
let activeTab = 'playersTab';

const $ = (id) => document.getElementById(id);
const clone = (obj) => JSON.parse(JSON.stringify(obj));
const uid = () => Math.random().toString(36).slice(2, 10);

function makeTournament(overrides = {}) {
  return {
    id: uid(),
    name: 'Riga Padel Cup',
    date: '2026-04-12',
    location: 'Riga',
    startTime: '10:00',
    durationMinutes: 120,
    participants: [],
    queue: [],
    teams: [],
    rounds: [],
    matches: [],
    meta: null,
    createdAt: Date.now(),
    ...overrides
  };
}

const initialState = {
  activeTournamentId: null,
  tournaments: [
    makeTournament({ name: 'Riga Spring Open', date: '2026-04-12', location: 'Riga', startTime: '10:00', durationMinutes: 120 }),
    makeTournament({ name: 'Sunday Club Cup', date: '2026-04-19', location: 'Riga', startTime: '11:00', durationMinutes: 90 }),
    makeTournament({ name: 'Evening Padel Series', date: '2026-04-26', location: 'Riga', startTime: '18:00', durationMinutes: 180 }),
    makeTournament({ name: 'Winter Finals', date: '2026-02-15', location: 'Riga', startTime: '12:00', durationMinutes: 120 })
  ]
};
initialState.activeTournamentId = initialState.tournaments[0].id;

function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return clone(initialState);
    const parsed = JSON.parse(raw);
    if (!parsed.tournaments?.length) return clone(initialState);
    return parsed;
  } catch {
    return clone(initialState);
  }
}
let state = loadState();

function saveState() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}
function getActiveTournament() {
  return state.tournaments.find(t => t.id === state.activeTournamentId) || state.tournaments[0];
}
function updateActiveTournament(mutator) {
  const tournament = getActiveTournament();
  mutator(tournament);
  saveState();
  render();
}
function showToast(message) {
  const el = $('toast');
  el.textContent = message;
  el.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove('show'), 2200);
}
function formatDate(value) {
  if (!value) return '—';
  const [y,m,d] = value.split('-');
  return `${d}.${m}.${y}`;
}
function formatDuration(minutes) {
  if (minutes === 90) return '1.5 часа';
  if (minutes % 60 === 0) return `${minutes / 60} часа`;
  return `${minutes} мин`;
}
function minutesToTime(total) {
  const day = 24 * 60;
  const normalized = ((total % day) + day) % day;
  const h = Math.floor(normalized / 60);
  const m = normalized % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}
function timeToMinutes(value) {
  const [h,m] = String(value || '10:00').split(':').map(Number);
  return h * 60 + m;
}
function statusForTournament(tournament) {
  const today = new Date();
  const nowDate = today.toISOString().slice(0,10);
  if (tournament.matches?.length && tournament.matches.every(m => m.status === 'Completed')) return 'done';
  if (tournament.date < nowDate) return 'done';
  if (tournament.date === nowDate && tournament.matches?.length) return 'live';
  return 'open';
}
function statusLabel(status) {
  return status === 'done' ? 'Завершен' : status === 'live' ? 'Происходит' : 'Открыт';
}
function syncInputsFromTournament(t) {
  $('tournamentName').value = t.name;
  $('tournamentDate').value = t.date;
  $('tournamentLocation').value = t.location;
  $('startTime').value = t.startTime;
  $('durationSelect').value = String(t.durationMinutes);
}
function syncTournamentFromInputs(t) {
  t.name = $('tournamentName').value.trim() || 'Riga Padel Cup';
  t.date = $('tournamentDate').value || t.date;
  t.location = $('tournamentLocation').value.trim() || 'Riga';
  t.startTime = $('startTime').value || '10:00';
  t.durationMinutes = Number($('durationSelect').value || 120);
}
function shuffle(list) {
  const arr = [...list];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}
function roundRobinPairs(teams) {
  if (teams.length < 2 || teams.length % 2 !== 0) return [];
  const rotating = [...teams];
  const rounds = [];
  const roundCount = rotating.length - 1;
  const half = rotating.length / 2;
  for (let r = 0; r < roundCount; r++) {
    const pairings = [];
    for (let i = 0; i < half; i++) pairings.push([rotating[i], rotating[rotating.length - 1 - i]]);
    rounds.push(shuffle(pairings));
    const fixed = rotating[0];
    const moved = rotating.pop();
    rotating.splice(1, 0, moved);
    rotating[0] = fixed;
  }
  return rounds;
}
function assignCourts(roundPairings, courts, history, roundIndex) {
  const remaining = Array.from({length: courts}, (_, i) => i + 1);
  const result = [];
  for (const pairing of shuffle(roundPairings)) {
    const [a,b] = pairing;
    let bestCourt = remaining[0];
    let bestScore = Infinity;
    for (const court of remaining) {
      const ah = history[a.id] || {counts: {}, lastCourt: null};
      const bh = history[b.id] || {counts: {}, lastCourt: null};
      const repeat = (ah.lastCourt === court ? 4 : 0) + (bh.lastCourt === court ? 4 : 0);
      const visits = (ah.counts[court] || 0) + (bh.counts[court] || 0);
      const spread = court * 0.01 + ((roundIndex + court) % 3) * 0.001 + Math.random() * 0.0001;
      const score = repeat + visits + spread;
      if (score < bestScore) { bestScore = score; bestCourt = court; }
    }
    history[a.id] = history[a.id] || {counts: {}, lastCourt: null};
    history[b.id] = history[b.id] || {counts: {}, lastCourt: null};
    history[a.id].counts[bestCourt] = (history[a.id].counts[bestCourt] || 0) + 1;
    history[b.id].counts[bestCourt] = (history[b.id].counts[bestCourt] || 0) + 1;
    history[a.id].lastCourt = bestCourt;
    history[b.id].lastCourt = bestCourt;
    remaining.splice(remaining.indexOf(bestCourt), 1);
    result.push({ court: bestCourt, teams: pairing });
  }
  return result.sort((x,y) => x.court - y.court);
}
function buildTournament(t) {
  syncTournamentFromInputs(t);
  const queuedCount = t.participants.length % PLAYERS_PER_COURT;
  const activePlayers = t.participants.slice(0, t.participants.length - queuedCount);
  t.queue = t.participants.slice(t.participants.length - queuedCount);
  t.teams = [];
  t.rounds = [];
  t.matches = [];
  t.meta = null;
  if (activePlayers.length < PLAYERS_PER_COURT) { showToast('Нужно минимум 4 игрока.'); return; }
  const shuffledPlayers = shuffle(activePlayers);
  for (let i = 0; i < shuffledPlayers.length; i += PLAYERS_PER_TEAM) {
    t.teams.push({
      id: uid(),
      name: `${shuffledPlayers[i].name} / ${shuffledPlayers[i+1].name}`,
      players: [shuffledPlayers[i], shuffledPlayers[i+1]]
    });
  }
  const roundPairs = roundRobinPairs(t.teams);
  const courts = Math.max(1, Math.floor(activePlayers.length / PLAYERS_PER_COURT));
  const roundsCount = roundPairs.length;
  const rawMatchMinutes = roundsCount ? (t.durationMinutes - Math.max(0, roundsCount - 1) * TRANSITION_MINUTES) / roundsCount : 0;
  const matchMinutes = Math.max(5, Math.round(rawMatchMinutes / 5) * 5);
  const startMinutes = timeToMinutes(t.startTime);
  const courtHistory = {};
  t.rounds = roundPairs.map((round, index) => {
    const start = startMinutes + index * (matchMinutes + TRANSITION_MINUTES);
    const end = start + matchMinutes;
    const assignments = assignCourts(round, courts, courtHistory, index);
    const matches = assignments.map(item => ({
      id: uid(),
      roundNumber: index + 1,
      court: item.court,
      start: minutesToTime(start),
      end: minutesToTime(end),
      teamA: item.teams[0],
      teamB: item.teams[1],
      gamesA: '', gamesB: '', updatedBy: '', updatedAt: '', status: 'Scheduled'
    }));
    return { roundNumber: index + 1, start: minutesToTime(start), end: minutesToTime(end), matches };
  });
  t.matches = t.rounds.flatMap(r => r.matches);
  t.meta = { activePlayers: activePlayers.length, queuedPlayers: t.queue.length, teams: t.teams.length, courts, rounds: roundsCount, matchMinutes, transitionMinutes: TRANSITION_MINUTES };
  showToast('Турнир сформирован.');
}
function computeStandings(t) {
  const table = {};
  t.teams.forEach(team => table[team.id] = { teamName: team.name, played:0, wins:0, losses:0, gamesWon:0, gamesLost:0, diff:0 });
  t.matches.forEach(match => {
    if (match.status !== 'Completed') return;
    const a = table[match.teamA.id], b = table[match.teamB.id];
    const ga = Number(match.gamesA), gb = Number(match.gamesB);
    a.played++; b.played++; a.gamesWon += ga; a.gamesLost += gb; b.gamesWon += gb; b.gamesLost += ga;
    if (ga > gb) { a.wins++; b.losses++; } else if (gb > ga) { b.wins++; a.losses++; }
  });
  return Object.values(table)
    .map(r => ({ ...r, diff: r.gamesWon - r.gamesLost }))
    .sort((x,y) => y.wins - x.wins || y.diff - x.diff || y.gamesWon - x.gamesWon || x.teamName.localeCompare(y.teamName))
    .map((r, idx) => ({ ...r, rank: idx + 1 }));
}
function createDemoPlayers() {
  const names = ['Nikolajs','Roman','Julia','Ignat','Nadya','Erik','Valera','Anya','Inga','Kate','Mark','Simona','Olga','Lena','Alex','David','Alina','Denis','Marta','Emils'];
  updateActiveTournament(t => {
    t.participants = names.map((name, i) => ({ id: uid(), name, contact: `+371 2000${String(i).padStart(3,'0')}`, order: i + 1 }));
    t.queue = []; t.teams = []; t.rounds = []; t.matches = []; t.meta = null;
  });
  showToast('Демо-игроки загружены.');
}
function renderTournaments() {
  const list = $('tournamentsList');
  const tournaments = [...state.tournaments].sort((a,b) => (a.date > b.date ? 1 : -1));
  const visible = historyExpanded ? tournaments : tournaments.slice(0, 3);
  list.innerHTML = visible.map(t => {
    const status = statusForTournament(t);
    return `
      <button class="tournaments-table tournament-row ${t.id === state.activeTournamentId ? 'active' : ''}" data-id="${t.id}">
        <div data-label="Дата">${formatDate(t.date)}</div>
        <div data-label="Название"><strong>${t.name}</strong></div>
        <div data-label="Место">${t.location || '—'}</div>
        <div data-label="Старт">${t.startTime}</div>
        <div data-label="Длительность">${formatDuration(t.durationMinutes)}</div>
        <div data-label="Статус"><span class="status-badge status-${status}">${statusLabel(status)}</span></div>
      </button>`;
  }).join('');
  [...list.querySelectorAll('.tournament-row')].forEach(btn => btn.addEventListener('click', () => {
    state.activeTournamentId = btn.dataset.id; saveState(); render();
  }));
  $('toggleHistoryBtn').textContent = historyExpanded ? 'Скрыть историю' : 'История';
}
function renderHero(t) {
  $('heroTournamentName').textContent = t.name;
  $('heroDateLabel').textContent = formatDate(t.date);
  $('heroLocationLabel').textContent = t.location || '—';
  $('heroStatusLabel').textContent = statusLabel(statusForTournament(t));
  const meta = t.meta || { activePlayers: t.participants.length - (t.participants.length % 4), queuedPlayers: t.participants.length % 4, teams: 0, courts: Math.floor(t.participants.length / 4), rounds: 0, matchMinutes: 0 };
  $('summaryView').innerHTML = [
    ['Игроки', t.participants.length],
    ['Пары', meta.teams || 0],
    ['Корты', meta.courts || 0],
    ['Матч', meta.matchMinutes ? `${meta.matchMinutes} мин` : '—']
  ].map(([label, value]) => `<div class="summary-tile"><div class="muted">${label}</div><div class="summary-value">${value}</div></div>`).join('');
}
function renderPlayers(t) {
  $('participantsCount').textContent = String(t.participants.length);
  $('playersView').innerHTML = t.participants.length ? t.participants.map((p, idx) => `
    <div class="player-chip">
      <div>
        <div class="player-name">${idx + 1}. ${p.name}</div>
        <div class="player-contact">${p.contact || '—'}</div>
      </div>
      <button class="icon-link" data-remove-player="${p.id}">✕</button>
    </div>`).join('') : '<div class="list-item list-empty">Пока нет игроков.</div>';
  $('queueCount').textContent = String(t.queue?.length || (t.participants.length % 4));
  $('queueView').innerHTML = (t.queue?.length ? t.queue : t.participants.slice(t.participants.length - (t.participants.length % 4))).length
    ? (t.queue?.length ? t.queue : t.participants.slice(t.participants.length - (t.participants.length % 4))).map(p => `<div class="list-item">${p.name}</div>`).join('')
    : '<div class="list-item list-empty">Очереди нет.</div>';
  [...$('playersView').querySelectorAll('[data-remove-player]')].forEach(btn => btn.addEventListener('click', () => {
    updateActiveTournament(tt => {
      tt.participants = tt.participants.filter(p => p.id !== btn.dataset.removePlayer);
      tt.queue = []; tt.teams = []; tt.rounds = []; tt.matches = []; tt.meta = null;
    });
    showToast('Игрок удален.');
  }));
}
function renderSchedule(t) {
  $('scheduleMeta').textContent = t.meta ? `${formatDate(t.date)} • ${t.location} • ${t.meta.courts} кортов • переход ${t.meta.transitionMinutes} мин` : 'Пока турнир не сформирован.';
  $('scheduleView').innerHTML = t.rounds?.length ? t.rounds.map(round => `
    <div class="schedule-card">
      <div class="schedule-head"><h3>Раунд ${round.roundNumber}</h3><div class="muted">${round.start}–${round.end}</div></div>
      <table class="schedule-table"><thead><tr><th>Время</th><th>Корт</th><th>Матч</th><th>Статус</th></tr></thead><tbody>
      ${round.matches.map(match => `<tr><td>${match.start}–${match.end}</td><td>${match.court}</td><td>${match.teamA.name} — ${match.teamB.name}</td><td>${match.status === 'Completed' ? 'Завершен' : 'По плану'}</td></tr>`).join('')}
      </tbody></table>
    </div>`).join('') : '<div class="list-item list-empty">Нет матчей.</div>';
}
function renderMatches(t) {
  $('matchesView').innerHTML = t.matches?.length ? t.matches.map(match => {
    const options = [...match.teamA.players, ...match.teamB.players].map(p => `<option value="${p.name}" ${match.updatedBy === p.name ? 'selected' : ''}>${p.name}</option>`).join('');
    return `
      <form class="match-card" data-match-id="${match.id}">
        <div class="match-title">${match.teamA.name} — ${match.teamB.name}</div>
        <div class="muted">Раунд ${match.roundNumber} • Корт ${match.court} • ${match.start}–${match.end}</div>
        <div class="match-grid top-gap">
          <label>Games A<input type="number" name="gamesA" min="0" value="${match.gamesA}" /></label>
          <label>Games B<input type="number" name="gamesB" min="0" value="${match.gamesB}" /></label>
          <label>Кто вводит<select name="updatedBy"><option value="">Выбрать</option>${options}</select></label>
          <div><span class="status-badge ${match.status === 'Completed' ? 'status-done' : 'status-open'}">${match.status === 'Completed' ? 'Завершен' : 'По плану'}</span></div>
          <button class="btn primary" type="submit">Сохранить</button>
        </div>
      </form>`;
  }).join('') : '<div class="list-item list-empty">Нет матчей.</div>';
  [...$('matchesView').querySelectorAll('form[data-match-id]')].forEach(form => form.addEventListener('submit', (e) => {
    e.preventDefault();
    const tActive = getActiveTournament();
    const match = tActive.matches.find(m => m.id === form.dataset.matchId);
    if (!match) return;
    const fd = new FormData(form);
    const actor = String(fd.get('updatedBy') || '').trim();
    if (!actor) return showToast('Выбери игрока.');
    match.gamesA = String(fd.get('gamesA') || '').trim();
    match.gamesB = String(fd.get('gamesB') || '').trim();
    match.updatedBy = actor;
    match.updatedAt = new Date().toISOString();
    match.status = match.gamesA !== '' && match.gamesB !== '' && Number(match.gamesA) !== Number(match.gamesB) ? 'Completed' : 'Scheduled';
    tActive.rounds.forEach(r => {
      const m = r.matches.find(x => x.id === match.id);
      if (m) Object.assign(m, match);
    });
    saveState(); renderMatches(tActive); renderStandings(tActive); renderSchedule(tActive); showToast('Результат сохранен.');
  }));
}
function renderStandings(t) {
  const rows = computeStandings(t);
  $('standingsView').innerHTML = rows.length ? `
    <table class="standings-table"><thead><tr><th>#</th><th>Пара</th><th>И</th><th>В</th><th>П</th><th>GW</th><th>GL</th><th>+/-</th></tr></thead><tbody>
    ${rows.map(r => `<tr><td>${r.rank}</td><td>${r.teamName}</td><td>${r.played}</td><td>${r.wins}</td><td>${r.losses}</td><td>${r.gamesWon}</td><td>${r.gamesLost}</td><td>${r.diff}</td></tr>`).join('')}
    </tbody></table>` : '<div class="list-item list-empty">Нет данных.</div>';
}
function setActiveTab(tabId) {
  activeTab = tabId;
  document.querySelectorAll('.tab-btn').forEach(btn => btn.classList.toggle('active', btn.dataset.tab === tabId));
  document.querySelectorAll('.tab-panel').forEach(panel => panel.classList.toggle('active', panel.id === tabId));
}
function render() {
  if (!state.tournaments.length) state = clone(initialState);
  if (!state.activeTournamentId || !state.tournaments.some(t => t.id === state.activeTournamentId)) state.activeTournamentId = state.tournaments[0].id;
  const t = getActiveTournament();
  renderTournaments();
  renderHero(t);
  syncInputsFromTournament(t);
  renderPlayers(t);
  renderSchedule(t);
  renderMatches(t);
  renderStandings(t);
  setActiveTab(activeTab);
}

$('playerForm').addEventListener('submit', (e) => {
  e.preventDefault();
  const name = $('playerName').value.trim();
  const contact = $('playerContact').value.trim();
  if (!name) return;
  updateActiveTournament(t => {
    const dupe = t.participants.some(p => p.name.trim().toLowerCase() === name.toLowerCase());
    if (dupe) throw new Error('Игрок с таким именем уже есть.');
    t.participants.push({ id: uid(), name, contact, order: t.participants.length + 1 });
    t.queue = []; t.teams = []; t.rounds = []; t.matches = []; t.meta = null;
  });
  $('playerForm').reset();
  showToast('Игрок добавлен.');
});

document.querySelectorAll('.tab-btn').forEach(btn => btn.addEventListener('click', () => setActiveTab(btn.dataset.tab)));

const originalUpdateActiveTournament = updateActiveTournament;
updateActiveTournament = function(mutator) {
  try { originalUpdateActiveTournament(mutator); }
  catch (err) { showToast(err.message || 'Ошибка'); }
};

$('generateBtn').addEventListener('click', () => updateActiveTournament(buildTournament));
$('demo20Btn').addEventListener('click', createDemoPlayers);
$('saveSettingsBtn').addEventListener('click', () => { updateActiveTournament(syncTournamentFromInputs); showToast('Параметры сохранены.'); });
$('resetPlayersBtn').addEventListener('click', () => updateActiveTournament(t => { t.participants = []; t.queue = []; t.teams = []; t.rounds = []; t.matches = []; t.meta = null; }));
$('toggleHistoryBtn').addEventListener('click', () => { historyExpanded = !historyExpanded; renderTournaments(); });
$('newTournamentBtn').addEventListener('click', () => $('tournamentDialog').showModal());
$('closeDialogBtn').addEventListener('click', () => $('tournamentDialog').close());
$('demoTournamentBtn').addEventListener('click', () => {
  $('newTournamentName').value = 'New Padel Cup';
  $('newTournamentLocation').value = 'Riga';
  $('newTournamentStart').value = '10:00';
  $('newTournamentDuration').value = '120';
  $('newTournamentDate').value = new Date(Date.now() + 7 * 86400000).toISOString().slice(0,10);
});
$('newTournamentDate').value = new Date(Date.now() + 7 * 86400000).toISOString().slice(0,10);
$('newTournamentForm').addEventListener('submit', (e) => {
  e.preventDefault();
  const tournament = makeTournament({
    name: $('newTournamentName').value.trim() || 'Riga Padel Cup',
    date: $('newTournamentDate').value,
    location: $('newTournamentLocation').value.trim() || 'Riga',
    startTime: $('newTournamentStart').value || '10:00',
    durationMinutes: Number($('newTournamentDuration').value || 120),
    createdAt: Date.now()
  });
  state.tournaments.unshift(tournament);
  state.activeTournamentId = tournament.id;
  saveState();
  $('tournamentDialog').close();
  render();
  showToast('Турнир создан.');
});

render();
