const STORAGE_KEY = 'padel-riga-local-v3';

const initialState = {
  tournament: {
    name: 'Padel Riga',
    date: '2026-04-12',
    startTime: '10:00',
    durationMinutes: 120,
    status: 'Регистрация открыта'
  },
  participants: [],
  activePlayers: [],
  waitingPlayers: [],
  teams: [],
  rounds: [],
  settings: {
    courts: 0,
    matchMinutes: 0,
    transitionMinutes: 5,
    totalRounds: 0,
    activePlayersCount: 0
  }
};

const clone = (obj) => JSON.parse(JSON.stringify(obj));
const byId = (id) => document.getElementById(id);

function uid() {
  return Math.random().toString(36).slice(2, 10);
}

function loadState() {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    return saved ? JSON.parse(saved) : clone(initialState);
  } catch {
    return clone(initialState);
  }
}

function saveState() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

function escapeHtml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

function shuffle(list) {
  const arr = [...list];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

function formatDate(value) {
  if (!value) return '—';
  const [year, month, day] = value.split('-');
  if (!year || !month || !day) return value;
  return `${day}.${month}.${year}`;
}

function formatMinutes(value) {
  if (!value || value <= 0) return '—';
  const rounded = Math.round(value * 10) / 10;
  return Number.isInteger(rounded) ? `${rounded} мин` : `${rounded.toFixed(1)} мин`;
}

function addMinutes(timeString, minutesToAdd) {
  const [hours, minutes] = timeString.split(':').map(Number);
  const total = hours * 60 + minutes + Math.round(minutesToAdd);
  const normalized = ((total % (24 * 60)) + (24 * 60)) % (24 * 60);
  const h = String(Math.floor(normalized / 60)).padStart(2, '0');
  const m = String(normalized % 60).padStart(2, '0');
  return `${h}:${m}`;
}

function canPlayerUpdateMatch(playerName, match) {
  const allowedPlayers = [
    ...match.teamA.players.map((player) => player.name.toLowerCase()),
    ...match.teamB.players.map((player) => player.name.toLowerCase())
  ];
  return allowedPlayers.includes(playerName.trim().toLowerCase());
}

function roundRobinPairs(teams) {
  if (teams.length < 2 || teams.length % 2 !== 0) return [];

  const rotation = [...teams];
  const rounds = [];
  const roundCount = rotation.length - 1;

  for (let roundIndex = 0; roundIndex < roundCount; roundIndex++) {
    const matches = [];
    for (let i = 0; i < rotation.length / 2; i++) {
      const home = rotation[i];
      const away = rotation[rotation.length - 1 - i];
      matches.push({
        id: uid(),
        teamA: roundIndex % 2 === 0 ? home : away,
        teamB: roundIndex % 2 === 0 ? away : home,
        gamesA: '',
        gamesB: '',
        status: 'Scheduled',
        lastUpdatedBy: '',
        court: i + 1,
        round: roundIndex + 1,
        startTime: '',
        endTime: ''
      });
    }

    rounds.push(matches);

    const fixed = rotation[0];
    const rest = rotation.slice(1);
    rest.unshift(rest.pop());
    rotation.splice(0, rotation.length, fixed, ...rest);
  }

  return rounds;
}

function buildSchedule(rounds, startTime, matchMinutes, transitionMinutes) {
  return rounds.map((matches, index) => {
    const slotStart = addMinutes(startTime, index * (matchMinutes + (index > 0 ? transitionMinutes : 0)) + Math.max(0, index - 1) * transitionMinutes);
    const trueStart = addMinutes(startTime, index * (matchMinutes + transitionMinutes));
    const trueEnd = addMinutes(trueStart, matchMinutes);
    return matches.map((match, courtIndex) => ({
      ...match,
      court: courtIndex + 1,
      startTime: trueStart,
      endTime: trueEnd
    }));
  });
}

function computeStandings() {
  const standings = {};
  state.teams.forEach((team) => {
    standings[team.id] = {
      teamName: team.name,
      played: 0,
      wins: 0,
      losses: 0,
      gamesWon: 0,
      gamesLost: 0,
      diff: 0,
      points: 0
    };
  });

  state.rounds.flat().forEach((match) => {
    if (match.status !== 'Completed') return;

    const ga = Number(match.gamesA);
    const gb = Number(match.gamesB);
    const a = standings[match.teamA.id];
    const b = standings[match.teamB.id];

    a.played += 1;
    b.played += 1;
    a.gamesWon += ga;
    a.gamesLost += gb;
    b.gamesWon += gb;
    b.gamesLost += ga;

    if (ga > gb) {
      a.wins += 1;
      a.points += 1;
      b.losses += 1;
    } else if (gb > ga) {
      b.wins += 1;
      b.points += 1;
      a.losses += 1;
    }
  });

  return Object.values(standings)
    .map((row) => ({ ...row, diff: row.gamesWon - row.gamesLost }))
    .sort((x, y) => y.points - x.points || y.diff - x.diff || y.gamesWon - x.gamesWon || x.teamName.localeCompare(y.teamName))
    .map((row, index) => ({ ...row, rank: index + 1 }));
}

function renderHeader() {
  byId('tournamentStatus').textContent = state.tournament.status;
  const metaParts = [
    state.tournament.name || 'Padel Riga',
    formatDate(state.tournament.date),
    state.tournament.startTime ? `Старт ${state.tournament.startTime}` : null
  ].filter(Boolean);
  byId('tournamentMeta').textContent = metaParts.join(' • ');
}

function renderParticipants() {
  byId('participantsCount').textContent = state.participants.length;
  const list = byId('participantsList');

  if (!state.participants.length) {
    list.innerHTML = '<div class="empty">Список пуст.</div>';
    return;
  }

  list.innerHTML = state.participants.map((player, index) => `
    <div class="item row">
      <div>
        <strong>${index + 1}. ${escapeHtml(player.name)}</strong>
        ${player.contact ? `<div class="muted">${escapeHtml(player.contact)}</div>` : ''}
      </div>
      <button class="remove-btn" data-remove-player="${player.id}" title="Удалить">✕</button>
    </div>
  `).join('');

  document.querySelectorAll('[data-remove-player]').forEach((button) => {
    button.addEventListener('click', () => removePlayer(button.dataset.removePlayer));
  });
}

function renderSummary() {
  const view = byId('summaryView');
  const courtsBadge = byId('courtsBadge');
  const matchTimeBadge = byId('matchTimeBadge');

  courtsBadge.textContent = `Корты: ${state.settings.courts}`;
  matchTimeBadge.textContent = `Матч: ${formatMinutes(state.settings.matchMinutes)}`;

  if (!state.teams.length) {
    view.className = 'summary-grid empty';
    view.innerHTML = 'Пока турнир не сформирован.';
    return;
  }

  view.className = 'summary-grid';
  view.innerHTML = `
    <div class="summary-box">
      <div class="label">Активные игроки</div>
      <div class="value">${state.activePlayers.length}</div>
    </div>
    <div class="summary-box">
      <div class="label">Очередь</div>
      <div class="value">${state.waitingPlayers.length}</div>
    </div>
    <div class="summary-box">
      <div class="label">Пары</div>
      <div class="value">${state.teams.length}</div>
    </div>
    <div class="summary-box">
      <div class="label">Раунды</div>
      <div class="value">${state.settings.totalRounds}</div>
    </div>
  `;
}

function renderStandings() {
  const standingsView = byId('standingsView');

  if (!state.teams.length) {
    standingsView.className = 'stack empty';
    standingsView.innerHTML = 'Нет данных.';
    return;
  }

  const rows = computeStandings();
  standingsView.className = 'stack';
  standingsView.innerHTML = `
    <div class="item">
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
              <td>${escapeHtml(row.teamName)}</td>
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

function renderSchedule() {
  const scheduleView = byId('scheduleView');

  if (!state.rounds.length) {
    scheduleView.className = 'stack empty';
    scheduleView.innerHTML = 'Нет матчей.';
    return;
  }

  scheduleView.className = 'stack';

  const queueHtml = state.waitingPlayers.length
    ? `
      <div class="item soft">
        <div class="row top">
          <strong>Очередь</strong>
          <div class="badge warn">${state.waitingPlayers.length}</div>
        </div>
        <div class="queue-list" style="margin-top:10px;">
          ${state.waitingPlayers.map((player) => `<div class="queue-pill">${escapeHtml(player.name)}</div>`).join('')}
        </div>
      </div>
    `
    : '';

  scheduleView.innerHTML = `
    ${queueHtml}
    ${state.rounds.map((roundMatches, roundIndex) => {
      const start = roundMatches[0]?.startTime || '—';
      const end = roundMatches[0]?.endTime || '—';
      return `
        <div class="item schedule-round">
          <div class="slot-head">
            <strong>Раунд ${roundIndex + 1}</strong>
            <div class="muted">${start}–${end}</div>
          </div>
          <div class="slot-grid">
            ${roundMatches.map((match) => `
              <div class="court-card">
                <div class="row">
                  <strong>Корт ${match.court}</strong>
                  <div class="badge ${match.status === 'Completed' ? 'ok' : ''}">${match.status === 'Completed' ? 'Готово' : 'Матч'}</div>
                </div>
                <div style="margin-top:8px;"><strong>${escapeHtml(match.teamA.name)}</strong></div>
                <div class="muted" style="margin:4px 0;">vs</div>
                <div><strong>${escapeHtml(match.teamB.name)}</strong></div>
                <form class="match-form" data-id="${match.id}">
                  <div class="match-grid">
                    <input type="number" min="0" name="gamesA" value="${match.gamesA}" placeholder="A" />
                    <input type="number" min="0" name="gamesB" value="${match.gamesB}" placeholder="B" />
                    <input type="text" name="updatedBy" value="${escapeHtml(match.lastUpdatedBy)}" placeholder="Кто вводит" />
                    <button type="submit" class="btn primary">Ок</button>
                  </div>
                </form>
              </div>
            `).join('')}
          </div>
        </div>
      `;
    }).join('')}
  `;

  document.querySelectorAll('.match-form').forEach((form) => {
    form.addEventListener('submit', (event) => {
      event.preventDefault();
      const formData = new FormData(form);
      updateMatch(
        form.dataset.id,
        String(formData.get('gamesA')).trim(),
        String(formData.get('gamesB')).trim(),
        String(formData.get('updatedBy')).trim()
      );
    });
  });
}

function render() {
  renderHeader();
  renderParticipants();
  renderSummary();
  renderStandings();
  renderSchedule();
}

function addPlayer(name, contact) {
  const normalizedName = name.trim();
  const normalizedContact = contact.trim();

  if (!normalizedName) {
    alert('Укажи имя игрока.');
    return;
  }

  const duplicate = state.participants.some((player) =>
    player.name.trim().toLowerCase() === normalizedName.toLowerCase() &&
    (player.contact || '').trim().toLowerCase() === normalizedContact.toLowerCase()
  );

  if (duplicate) {
    alert('Такой игрок уже есть.');
    return;
  }

  state.participants.push({
    id: uid(),
    name: normalizedName,
    contact: normalizedContact,
    registeredAt: Date.now() + state.participants.length
  });

  saveState();
  render();
}

function removePlayer(playerId) {
  if (state.tournament.status !== 'Регистрация открыта') {
    alert('Удаление доступно только до формирования турнира.');
    return;
  }
  state.participants = state.participants.filter((player) => player.id !== playerId);
  saveState();
  render();
}

function updateMatch(matchId, gamesA, gamesB, updatedBy) {
  let found = false;

  state.rounds = state.rounds.map((roundMatches) => roundMatches.map((match) => {
    if (match.id !== matchId) return match;
    found = true;

    if (!updatedBy || !canPlayerUpdateMatch(updatedBy, match)) {
      alert('Результат может вводить только один из 4 игроков этого матча.');
      return match;
    }

    const nextMatch = {
      ...match,
      gamesA,
      gamesB,
      lastUpdatedBy: updatedBy,
      status: gamesA !== '' && gamesB !== '' && Number(gamesA) !== Number(gamesB)
        ? 'Completed'
        : 'Scheduled'
    };

    return nextMatch;
  }));

  if (!found) return;
  saveState();
  renderStandings();
  renderSchedule();
}

function createDemoPlayers() {
  if (state.tournament.status !== 'Регистрация открыта') {
    alert('Сначала нажми Сбросить.');
    return;
  }

  state.participants = [
    'Nikolaj', 'Eriks', 'Valerijs', 'Aleksandrs', 'Igors',
    'Maksims', 'Dmitrijs', 'Artjoms', 'Janis', 'Mareks',
    'Deniss', 'Olegs', 'Ruslans', 'Sergejs', 'Edgars',
    'Kaspars', 'Martins', 'Aivars', 'Gints', 'Pauls'
  ].map((name, index) => ({
    id: uid(),
    name,
    contact: `player${index + 1}@padel.lv`,
    registeredAt: Date.now() + index
  }));

  saveState();
  render();
}

function generateTournament() {
  const participants = [...state.participants];
  if (participants.length < 4) {
    alert('Нужно минимум 4 игрока.');
    return;
  }

  const courts = Math.floor(participants.length / 4);
  if (courts < 1) {
    alert('Недостаточно игроков для одного корта.');
    return;
  }

  const activePlayersCount = courts * 4;
  const waitingPlayers = participants.slice(activePlayersCount);
  const activePlayers = participants.slice(0, activePlayersCount);
  const shuffledPlayers = shuffle(activePlayers);

  const teams = [];
  for (let i = 0; i < shuffledPlayers.length; i += 2) {
    const player1 = shuffledPlayers[i];
    const player2 = shuffledPlayers[i + 1];
    teams.push({
      id: uid(),
      players: [player1, player2],
      name: `${player1.name} / ${player2.name}`
    });
  }

  const baseRounds = roundRobinPairs(teams);
  const totalRounds = baseRounds.length;
  const transitionMinutes = 5;
  const totalDuration = Number(byId('tournamentDuration').value);
  const playableMinutes = totalDuration - transitionMinutes * Math.max(0, totalRounds - 1);
  const matchMinutes = playableMinutes / totalRounds;

  if (matchMinutes <= 0) {
    alert('Недостаточно времени турнира для выбранного количества игроков.');
    return;
  }

  if (matchMinutes < 10) {
    const proceed = confirm(`На матч получается только ${formatMinutes(matchMinutes)}. Продолжить?`);
    if (!proceed) return;
  }

  const scheduledRounds = buildSchedule(baseRounds, byId('tournamentStartTime').value, matchMinutes, transitionMinutes);

  state.tournament = {
    name: byId('tournamentName').value.trim() || 'Padel Riga',
    date: byId('tournamentDate').value,
    startTime: byId('tournamentStartTime').value,
    durationMinutes: totalDuration,
    status: 'Турнир сформирован'
  };
  state.activePlayers = activePlayers;
  state.waitingPlayers = waitingPlayers;
  state.teams = teams;
  state.rounds = scheduledRounds;
  state.settings = {
    courts,
    matchMinutes,
    transitionMinutes,
    totalRounds,
    activePlayersCount
  };

  saveState();
  render();
}

function resetState() {
  localStorage.removeItem(STORAGE_KEY);
  state = loadState();
  syncForm();
  render();
}

function syncForm() {
  byId('tournamentName').value = state.tournament.name || 'Padel Riga';
  byId('tournamentDate').value = state.tournament.date || '2026-04-12';
  byId('tournamentStartTime').value = state.tournament.startTime || '10:00';
  byId('tournamentDuration').value = String(state.tournament.durationMinutes || 120);
}

let state = loadState();

byId('playerForm').addEventListener('submit', (event) => {
  event.preventDefault();
  addPlayer(byId('playerName').value, byId('playerContact').value);
  event.target.reset();
  byId('playerName').focus();
});

byId('generateBtn').addEventListener('click', generateTournament);
byId('demoPlayersBtn').addEventListener('click', createDemoPlayers);
byId('resetBtn').addEventListener('click', resetState);

syncForm();
render();
