const STORAGE_KEY = 'padel-riga-round-robin-v6';

const initialState = {
  tournamentName: 'Riga Padel Cup',
  tournamentDate: '2026-04-12',
  durationMinutes: 120,
  startTime: '10:00',
  participants: [],
  queue: [],
  teams: [],
  rounds: [],
  matches: [],
  meta: null
};

const clone = (obj) => JSON.parse(JSON.stringify(obj));
const byId = (id) => document.getElementById(id);

function uid() {
  return Math.random().toString(36).slice(2, 10);
}

function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? { ...clone(initialState), ...JSON.parse(raw) } : clone(initialState);
  } catch {
    return clone(initialState);
  }
}

let state = loadState();

function saveState() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

function shuffle(list) {
  const arr = [...list];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

function timeToMinutes(value) {
  const [h, m] = String(value || '10:00').split(':').map(Number);
  return h * 60 + m;
}

function minutesToTime(total) {
  const day = 24 * 60;
  const normalized = ((total % day) + day) % day;
  const h = Math.floor(normalized / 60);
  const m = normalized % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

function formatDuration(minutes) {
  if (!Number.isFinite(minutes) || minutes <= 0) return '—';
  if (minutes % 60 === 0) return `${minutes / 60} ч`;
  if (minutes > 60) return `${Math.floor(minutes / 60)} ч ${minutes % 60} мин`;
  return `${minutes} мин`;
}

function formatDate(value) {
  if (!value) return '—';
  const [y, m, d] = value.split('-');
  return `${d}.${m}.${y}`;
}

function roundRobinPairs(teams) {
  const list = [...teams];
  if (list.length < 2) return [];
  const rounds = [];
  const rotating = [...list];
  const roundCount = list.length - 1;
  const half = list.length / 2;

  for (let roundIndex = 0; roundIndex < roundCount; roundIndex++) {
    const pairings = [];
    for (let i = 0; i < half; i++) {
      pairings.push([rotating[i], rotating[rotating.length - 1 - i]]);
    }
    rounds.push(shuffle(pairings));
    const fixed = rotating[0];
    const moved = rotating.pop();
    rotating.splice(1, 0, moved);
    rotating[0] = fixed;
  }

  return rounds;
}

function syncSettingsFromInputs() {
  state.tournamentName = byId('tournamentName').value.trim() || 'Riga Padel Cup';
  state.tournamentDate = byId('tournamentDate').value || '2026-04-12';
  state.durationMinutes = Number(byId('durationSelect').value || 120);
  state.startTime = byId('startTime').value || '10:00';
}

function assignCourts(roundPairings, courts, usage) {
  const available = Array.from({ length: courts }, (_, i) => i + 1);
  const matches = shuffle(roundPairings);
  const result = [];

  for (const pair of matches) {
    const [teamA, teamB] = pair;
    let bestCourt = available[0];
    let bestScore = Infinity;

    for (const court of available) {
      const aKey = `${teamA.id}:${court}`;
      const bKey = `${teamB.id}:${court}`;
      const score = (usage[aKey] || 0) + (usage[bKey] || 0) + Math.random() * 0.01;
      if (score < bestScore) {
        bestScore = score;
        bestCourt = court;
      }
    }

    usage[`${teamA.id}:${bestCourt}`] = (usage[`${teamA.id}:${bestCourt}`] || 0) + 1;
    usage[`${teamB.id}:${bestCourt}`] = (usage[`${teamB.id}:${bestCourt}`] || 0) + 1;
    available.splice(available.indexOf(bestCourt), 1);
    result.push({ court: bestCourt, teams: pair });
  }

  return result.sort((a, b) => a.court - b.court);
}

function buildTournament() {
  syncSettingsFromInputs();

  const queuedCount = state.participants.length % 4;
  const activePlayers = state.participants.slice(0, state.participants.length - queuedCount);
  state.queue = state.participants.slice(state.participants.length - queuedCount);
  state.teams = [];
  state.rounds = [];
  state.matches = [];
  state.meta = null;

  if (activePlayers.length < 4) {
    saveState();
    render();
    alert('Нужно минимум 4 игрока.');
    return;
  }

  const shuffledPlayers = shuffle(activePlayers);
  const teams = [];
  for (let i = 0; i < shuffledPlayers.length; i += 2) {
    teams.push({
      id: uid(),
      name: `${shuffledPlayers[i].name} / ${shuffledPlayers[i + 1].name}`,
      players: [shuffledPlayers[i], shuffledPlayers[i + 1]]
    });
  }

  const roundPairs = roundRobinPairs(teams);
  const courts = Math.max(1, Math.floor(activePlayers.length / 4));
  const roundsCount = roundPairs.length;
  const transitionMinutes = 5;
  const rawMatchMinutes = roundsCount ? (state.durationMinutes - Math.max(0, roundsCount - 1) * transitionMinutes) / roundsCount : 0;
  const matchMinutes = Math.max(5, Math.floor(rawMatchMinutes / 5) * 5);
  const startMinutes = timeToMinutes(state.startTime);
  const usage = {};

  state.rounds = roundPairs.map((round, roundIndex) => {
    const roundStart = startMinutes + roundIndex * (matchMinutes + transitionMinutes);
    const roundEnd = roundStart + matchMinutes;
    const courtAssignments = assignCourts(round, courts, usage);
    const matches = courtAssignments.map(item => ({
      id: uid(),
      roundNumber: roundIndex + 1,
      court: item.court,
      start: minutesToTime(roundStart),
      end: minutesToTime(roundEnd),
      teamA: item.teams[0],
      teamB: item.teams[1],
      gamesA: '',
      gamesB: '',
      updatedBy: '',
      status: 'Scheduled'
    }));

    return {
      roundNumber: roundIndex + 1,
      start: minutesToTime(roundStart),
      end: minutesToTime(roundEnd),
      matches
    };
  });

  state.teams = teams;
  state.matches = state.rounds.flatMap(round => round.matches);
  state.meta = {
    activePlayers: activePlayers.length,
    queuedPlayers: state.queue.length,
    teams: teams.length,
    courts,
    rounds: roundsCount,
    transitionMinutes,
    matchMinutes,
    date: state.tournamentDate
  };

  saveState();
  render();
}

function updateMatch(matchId, gamesA, gamesB, updatedBy) {
  const match = state.matches.find(item => item.id === matchId);
  if (!match) return;

  const actor = String(updatedBy || '').trim();
  const allowed = [...match.teamA.players, ...match.teamB.players].map(p => p.name.trim().toLowerCase());
  if (!actor || !allowed.includes(actor.toLowerCase())) {
    alert('Результат может ввести только один из 4 игроков матча.');
    return;
  }

  match.gamesA = String(gamesA).trim();
  match.gamesB = String(gamesB).trim();
  match.updatedBy = actor;
  match.status = match.gamesA !== '' && match.gamesB !== '' && Number(match.gamesA) !== Number(match.gamesB)
    ? 'Completed'
    : 'Scheduled';

  state.rounds.forEach(round => {
    const roundMatch = round.matches.find(item => item.id === matchId);
    if (roundMatch) Object.assign(roundMatch, match);
  });

  saveState();
  renderSchedule();
  renderMatches();
  renderStandings();
}

function computeStandings() {
  const standings = {};
  state.teams.forEach(team => {
    standings[team.id] = {
      teamName: team.name,
      played: 0,
      wins: 0,
      losses: 0,
      gamesWon: 0,
      gamesLost: 0,
      diff: 0
    };
  });

  state.matches.forEach(match => {
    if (match.status !== 'Completed') return;
    const a = standings[match.teamA.id];
    const b = standings[match.teamB.id];
    const ga = Number(match.gamesA);
    const gb = Number(match.gamesB);

    a.played += 1;
    b.played += 1;
    a.gamesWon += ga;
    a.gamesLost += gb;
    b.gamesWon += gb;
    b.gamesLost += ga;

    if (ga > gb) {
      a.wins += 1;
      b.losses += 1;
    } else if (gb > ga) {
      b.wins += 1;
      a.losses += 1;
    }
  });

  return Object.values(standings)
    .map(row => ({ ...row, diff: row.gamesWon - row.gamesLost }))
    .sort((x, y) => y.wins - x.wins || y.diff - x.diff || y.gamesWon - x.gamesWon || x.teamName.localeCompare(y.teamName))
    .map((row, index) => ({ ...row, rank: index + 1 }));
}

function renderPlayers() {
  byId('participantsCount').textContent = state.participants.length;
  const playersView = byId('playersView');

  if (!state.participants.length) {
    playersView.innerHTML = '<div class="empty">Игроков пока нет.</div>';
    return;
  }

  playersView.innerHTML = state.participants.map((player, index) => `
    <div class="player-chip">
      <span class="player-chip-index">${index + 1}</span>
      <span>${player.name}</span>
      <button class="remove-chip" data-remove-id="${player.id}" type="button">×</button>
    </div>
  `).join('');

  playersView.querySelectorAll('[data-remove-id]').forEach(button => {
    button.addEventListener('click', () => {
      state.participants = state.participants.filter(player => player.id !== button.dataset.removeId);
      saveState();
      render();
    });
  });
}

function renderSummary() {
  const activePlayers = state.participants.length - (state.participants.length % 4);
  const queued = state.participants.length % 4;
  const teams = activePlayers / 2;
  const courts = activePlayers / 4;
  const rounds = teams >= 2 ? teams - 1 : 0;
  const transition = 5;
  const rawMatchMinutes = rounds ? (Number(state.durationMinutes) - Math.max(0, rounds - 1) * transition) / rounds : 0;
  const matchMinutes = rounds ? Math.max(5, Math.floor(rawMatchMinutes / 5) * 5) : 0;

  byId('summaryView').innerHTML = `
    <div class="summary-item"><span>Дата</span><strong>${formatDate(state.tournamentDate)}</strong></div>
    <div class="summary-item"><span>Игроки</span><strong>${state.participants.length}</strong></div>
    <div class="summary-item"><span>Активные</span><strong>${activePlayers}</strong></div>
    <div class="summary-item"><span>Очередь</span><strong>${queued}</strong></div>
    <div class="summary-item"><span>Пары</span><strong>${teams}</strong></div>
    <div class="summary-item"><span>Корты</span><strong>${courts}</strong></div>
    <div class="summary-item"><span>Раунды</span><strong>${rounds}</strong></div>
    <div class="summary-item"><span>Игра</span><strong>${formatDuration(matchMinutes)}</strong></div>
  `;
}

function renderPairs() {
  byId('pairsCount').textContent = state.teams.length;
  const pairsView = byId('pairsView');
  pairsView.innerHTML = state.teams.length
    ? state.teams.map((team, index) => `<div class="item">${index + 1}. ${team.name}</div>`).join('')
    : '<div class="empty">Пары появятся после формирования.</div>';
}

function renderQueue() {
  byId('queueCount').textContent = state.queue.length;
  const queueView = byId('queueView');
  queueView.innerHTML = state.queue.length
    ? state.queue.map((player, index) => `<div class="item">${index + 1}. ${player.name}</div>`).join('')
    : '<div class="empty">Очереди нет.</div>';
}

function renderSchedule() {
  const scheduleView = byId('scheduleView');
  byId('scheduleMeta').textContent = state.meta
    ? `${state.tournamentName} · ${formatDate(state.meta.date)} · ${state.meta.courts} корт${state.meta.courts === 1 ? '' : state.meta.courts < 5 ? 'а' : 'ов'}`
    : '';

  if (!state.rounds.length) {
    scheduleView.innerHTML = '<div class="empty">Сетка появится после формирования.</div>';
    return;
  }

  scheduleView.innerHTML = state.rounds.map(round => `
    <div class="round">
      <div class="round-header">
        <div>
          <h3>Раунд ${round.roundNumber}</h3>
          <div class="muted">${formatDate(state.tournamentDate)} · ${round.start}–${round.end}</div>
        </div>
        <div class="pill">${round.matches.length} матч${round.matches.length === 1 ? '' : round.matches.length < 5 ? 'а' : 'ей'}</div>
      </div>
      <table class="schedule-table">
        <thead>
          <tr>
            <th>Время</th>
            <th>Корт</th>
            <th>Матч</th>
            <th>Статус</th>
          </tr>
        </thead>
        <tbody>
          ${round.matches.map(match => `
            <tr>
              <td>${match.start}–${match.end}</td>
              <td>${match.court}</td>
              <td>${match.teamA.name} — ${match.teamB.name}</td>
              <td>${match.status === 'Completed' ? 'Готово' : 'По плану'}</td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    </div>
  `).join('');
}

function renderMatches() {
  const matchesView = byId('matchesView');
  if (!state.matches.length) {
    matchesView.innerHTML = '<div class="empty">Матчи появятся после формирования.</div>';
    return;
  }

  matchesView.innerHTML = state.matches.map(match => `
    <div class="match-card">
      <div class="match-head">
        <div>
          <strong>${match.teamA.name} — ${match.teamB.name}</strong>
          <div class="muted">${formatDate(state.tournamentDate)} · Раунд ${match.roundNumber} · Корт ${match.court} · ${match.start}–${match.end}</div>
        </div>
        <div class="pill">${match.status === 'Completed' ? 'Готово' : 'Ожидает'}</div>
      </div>
      <form class="result-form" data-match-id="${match.id}">
        <input type="number" min="0" name="gamesA" value="${match.gamesA}" placeholder="Пара A" />
        <input type="number" min="0" name="gamesB" value="${match.gamesB}" placeholder="Пара B" />
        <input type="text" name="updatedBy" value="${match.updatedBy}" placeholder="Кто вводит" />
        <button class="btn primary" type="submit">Сохранить</button>
      </form>
    </div>
  `).join('');

  matchesView.querySelectorAll('.result-form').forEach(form => {
    form.addEventListener('submit', event => {
      event.preventDefault();
      const data = new FormData(form);
      updateMatch(form.dataset.matchId, data.get('gamesA'), data.get('gamesB'), data.get('updatedBy'));
    });
  });
}

function renderStandings() {
  const standingsView = byId('standingsView');
  if (!state.teams.length) {
    standingsView.innerHTML = '<div class="empty">Таблица появится после формирования.</div>';
    return;
  }

  const rows = computeStandings();
  standingsView.innerHTML = `
    <div class="table-wrap">
      <table>
        <thead>
          <tr>
            <th>#</th>
            <th>Пара</th>
            <th>И</th>
            <th>В</th>
            <th>П</th>
            <th>GW</th>
            <th>GL</th>
            <th>+/-</th>
          </tr>
        </thead>
        <tbody>
          ${rows.map(row => `
            <tr>
              <td>${row.rank}</td>
              <td>${row.teamName}</td>
              <td>${row.played}</td>
              <td>${row.wins}</td>
              <td>${row.losses}</td>
              <td>${row.gamesWon}</td>
              <td>${row.gamesLost}</td>
              <td>${row.diff}</td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    </div>
  `;
}

function render() {
  byId('tournamentName').value = state.tournamentName;
  byId('tournamentDate').value = state.tournamentDate;
  byId('durationSelect').value = String(state.durationMinutes);
  byId('startTime').value = state.startTime;
  renderPlayers();
  renderSummary();
  renderPairs();
  renderQueue();
  renderSchedule();
  renderMatches();
  renderStandings();
}

byId('playerForm').addEventListener('submit', event => {
  event.preventDefault();
  const nameInput = byId('playerName');
  const name = nameInput.value.trim();
  if (!name) return;
  if (state.participants.some(player => player.name.toLowerCase() === name.toLowerCase())) {
    alert('Игрок с таким именем уже есть.');
    return;
  }
  state.participants.push({ id: uid(), name });
  nameInput.value = '';
  saveState();
  render();
});

byId('generateBtn').addEventListener('click', buildTournament);

byId('demo20Btn').addEventListener('click', () => {
  state.participants = [
    'Roman', 'Julia', 'Ignat', 'Nadya', 'Erik', 'Valera', 'Anya', 'Inga', 'Kate', 'Mark',
    'Simona', 'Olga', 'Lena', 'Alex', 'David', 'Alina', 'Denis', 'Nikolaj', 'Marta', 'Emils'
  ].map(name => ({ id: uid(), name }));
  state.queue = [];
  state.teams = [];
  state.rounds = [];
  state.matches = [];
  state.meta = null;
  saveState();
  render();
});

byId('resetBtn').addEventListener('click', () => {
  localStorage.removeItem(STORAGE_KEY);
  state = clone(initialState);
  render();
});

['tournamentName', 'tournamentDate', 'durationSelect', 'startTime'].forEach(id => {
  byId(id).addEventListener('change', () => {
    syncSettingsFromInputs();
    saveState();
    renderSummary();
    renderSchedule();
    renderMatches();
  });
});

render();
