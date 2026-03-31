const STORAGE_KEY = 'padel-riga-round-robin-v4';

const initialState = {
  tournamentName: 'Riga Padel Cup',
  durationMinutes: 120,
  startTime: '10:00',
  participants: [],
  queue: [],
  teams: [],
  rounds: [],
  matches: []
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
  const [h, m] = value.split(':').map(Number);
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
  if (Math.abs(minutes - Math.round(minutes)) < 0.001) return `${Math.round(minutes)} мин`;
  return `${minutes.toFixed(1)} мин`;
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
      const home = rotating[i];
      const away = rotating[rotating.length - 1 - i];
      pairings.push([home, away]);
    }
    rounds.push(pairings);
    const fixed = rotating[0];
    const moved = rotating.pop();
    rotating.splice(1, 0, moved);
    rotating[0] = fixed;
  }

  return rounds;
}

function buildTournament() {
  const queuedCount = state.participants.length % 4;
  const activePlayers = state.participants.slice(0, state.participants.length - queuedCount);
  const queue = state.participants.slice(state.participants.length - queuedCount);

  state.queue = queue;
  state.teams = [];
  state.rounds = [];
  state.matches = [];

  if (activePlayers.length < 4) {
    saveState();
    render();
    return;
  }

  const shuffled = shuffle(activePlayers);
  const teams = [];
  for (let i = 0; i < shuffled.length; i += 2) {
    const p1 = shuffled[i];
    const p2 = shuffled[i + 1];
    teams.push({
      id: uid(),
      name: `${p1.name} / ${p2.name}`,
      players: [p1, p2]
    });
  }

  const roundPairs = roundRobinPairs(teams);
  const courts = teams.length / 2;
  const roundCount = roundPairs.length;
  const transition = 5;
  const totalTransitions = Math.max(0, roundCount - 1) * transition;
  const matchMinutes = Math.max(1, (Number(state.durationMinutes) - totalTransitions) / Math.max(1, roundCount));
  const startMinutes = timeToMinutes(state.startTime || '10:00');

  const rounds = roundPairs.map((round, roundIndex) => {
    const roundStart = startMinutes + roundIndex * (matchMinutes + transition);
    const roundEnd = roundStart + matchMinutes;
    const matches = round.map((pair, idx) => ({
      id: uid(),
      roundNumber: roundIndex + 1,
      court: idx + 1,
      start: minutesToTime(roundStart),
      end: minutesToTime(roundEnd),
      teamA: pair[0],
      teamB: pair[1],
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
  state.rounds = rounds;
  state.matches = rounds.flatMap((round) => round.matches);
  state.meta = {
    activePlayers: activePlayers.length,
    queuedPlayers: queue.length,
    teams: teams.length,
    courts,
    rounds: roundCount,
    transition,
    matchMinutes
  };

  saveState();
  render();
}

function updateMatch(matchId, gamesA, gamesB, updatedBy) {
  const match = state.matches.find((item) => item.id === matchId);
  if (!match) return;

  const allowed = [...match.teamA.players, ...match.teamB.players].map((p) => p.name.trim().toLowerCase());
  const actor = String(updatedBy || '').trim();
  if (!actor || !allowed.includes(actor.toLowerCase())) {
    alert('Результат может ввести только один из 4 игроков матча.');
    return;
  }

  const a = String(gamesA).trim();
  const b = String(gamesB).trim();
  match.gamesA = a;
  match.gamesB = b;
  match.updatedBy = actor;
  match.status = a !== '' && b !== '' && Number(a) !== Number(b) ? 'Completed' : 'Scheduled';

  for (const round of state.rounds) {
    const roundMatch = round.matches.find((item) => item.id === matchId);
    if (roundMatch) {
      roundMatch.gamesA = match.gamesA;
      roundMatch.gamesB = match.gamesB;
      roundMatch.updatedBy = match.updatedBy;
      roundMatch.status = match.status;
    }
  }

  saveState();
  renderStandings();
  renderMatches();
  renderSchedule();
}

function computeStandings() {
  const standings = {};
  for (const team of state.teams) {
    standings[team.id] = {
      teamName: team.name,
      played: 0,
      wins: 0,
      losses: 0,
      gamesWon: 0,
      gamesLost: 0,
      diff: 0
    };
  }

  for (const match of state.matches) {
    if (match.status !== 'Completed') continue;
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
  }

  return Object.values(standings)
    .map((row) => ({ ...row, diff: row.gamesWon - row.gamesLost }))
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
    <div class="player-row">
      <div class="player-main">
        <div class="player-index">${index + 1}</div>
        <div>${player.name}</div>
      </div>
      <button class="remove-btn" data-remove-id="${player.id}">Удалить</button>
    </div>
  `).join('');

  playersView.querySelectorAll('[data-remove-id]').forEach((button) => {
    button.addEventListener('click', () => {
      const id = button.dataset.removeId;
      state.participants = state.participants.filter((player) => player.id !== id);
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
  const matchMinutes = rounds ? Math.max(1, (Number(state.durationMinutes) - (rounds - 1) * transition) / rounds) : 0;

  byId('summaryView').innerHTML = `
    <div class="summary-item">Активных игроков<strong>${activePlayers}</strong></div>
    <div class="summary-item">В очереди<strong>${queued}</strong></div>
    <div class="summary-item">Пары<strong>${teams}</strong></div>
    <div class="summary-item">Корты<strong>${courts}</strong></div>
    <div class="summary-item">Раунды<strong>${rounds}</strong></div>
    <div class="summary-item">Игра / переход<strong>${formatDuration(matchMinutes)} / 5 мин</strong></div>
  `;
}

function renderPairs() {
  byId('pairsCount').textContent = state.teams.length;
  const pairsView = byId('pairsView');
  if (!state.teams.length) {
    pairsView.innerHTML = '<div class="empty">Пары появятся после формирования турнира.</div>';
    return;
  }
  pairsView.innerHTML = state.teams.map((team, index) => `
    <div class="item">${index + 1}. ${team.name}</div>
  `).join('');
}

function renderQueue() {
  byId('queueCount').textContent = state.queue.length;
  const queueView = byId('queueView');
  if (!state.queue.length) {
    queueView.innerHTML = '<div class="empty">Очереди нет.</div>';
    return;
  }
  queueView.innerHTML = state.queue.map((player, index) => `
    <div class="item">${index + 1}. ${player.name}</div>
  `).join('');
}

function renderSchedule() {
  const scheduleView = byId('scheduleView');
  if (!state.rounds.length) {
    scheduleView.innerHTML = '<div class="empty">Расписание появится после формирования турнира.</div>';
    return;
  }

  scheduleView.innerHTML = state.rounds.map((round) => `
    <div class="round">
      <div class="round-header">
        <h3>Раунд ${round.roundNumber}</h3>
        <div class="muted">${round.start}–${round.end}</div>
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
          ${round.matches.map((match) => `
            <tr>
              <td>${match.start}–${match.end}</td>
              <td>Корт ${match.court}</td>
              <td>${match.teamA.name} vs ${match.teamB.name}</td>
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
    matchesView.innerHTML = '<div class="empty">Матчи появятся после формирования турнира.</div>';
    return;
  }

  matchesView.innerHTML = state.matches.map((match) => `
    <div class="match-card">
      <div class="match-head">
        <div>
          <strong>${match.teamA.name} vs ${match.teamB.name}</strong>
          <div class="muted">Раунд ${match.roundNumber} · Корт ${match.court} · ${match.start}–${match.end}</div>
        </div>
        <div class="pill">${match.status === 'Completed' ? 'Готово' : 'Ожидает'}</div>
      </div>
      <form class="result-form" data-match-id="${match.id}">
        <input type="number" min="0" name="gamesA" value="${match.gamesA}" placeholder="Геймы A" />
        <input type="number" min="0" name="gamesB" value="${match.gamesB}" placeholder="Геймы B" />
        <input type="text" name="updatedBy" value="${match.updatedBy}" placeholder="Кто вводит результат" />
        <button class="btn primary" type="submit">Сохранить</button>
      </form>
    </div>
  `).join('');

  matchesView.querySelectorAll('.result-form').forEach((form) => {
    form.addEventListener('submit', (event) => {
      event.preventDefault();
      const data = new FormData(form);
      updateMatch(form.dataset.matchId, data.get('gamesA'), data.get('gamesB'), data.get('updatedBy'));
    });
  });
}

function renderStandings() {
  const standingsView = byId('standingsView');
  if (!state.teams.length) {
    standingsView.innerHTML = '<div class="empty">Таблица появится после формирования турнира.</div>';
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
          ${rows.map((row) => `
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

byId('playerForm').addEventListener('submit', (event) => {
  event.preventDefault();
  const nameInput = byId('playerName');
  const name = nameInput.value.trim();
  if (!name) return;
  if (state.participants.some((player) => player.name.toLowerCase() === name.toLowerCase())) {
    alert('Игрок с таким именем уже есть.');
    return;
  }
  state.participants.push({ id: uid(), name });
  nameInput.value = '';
  saveState();
  render();
});

byId('generateBtn').addEventListener('click', () => {
  state.tournamentName = byId('tournamentName').value.trim() || 'Riga Padel Cup';
  state.durationMinutes = Number(byId('durationSelect').value);
  state.startTime = byId('startTime').value || '10:00';
  buildTournament();
});

byId('demo20Btn').addEventListener('click', () => {
  state.participants = [
    'Roman', 'Julia', 'Ignat', 'Nadya', 'Erik', 'Valera', 'Anya', 'Inga', 'Kate', 'Mark',
    'Simona', 'Olga', 'Lena', 'Alex', 'David', 'Alina', 'Denis', 'Nikolaj', 'Marta', 'Emils'
  ].map((name) => ({ id: uid(), name }));
  saveState();
  render();
});

byId('resetBtn').addEventListener('click', () => {
  localStorage.removeItem(STORAGE_KEY);
  state = clone(initialState);
  render();
});

['tournamentName', 'durationSelect', 'startTime'].forEach((id) => {
  byId(id).addEventListener('change', () => {
    state.tournamentName = byId('tournamentName').value.trim() || 'Riga Padel Cup';
    state.durationMinutes = Number(byId('durationSelect').value);
    state.startTime = byId('startTime').value || '10:00';
    saveState();
    renderSummary();
  });
});

render();
