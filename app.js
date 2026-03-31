const STORAGE_KEY = 'padel-riga-local-v2';

const initialState = {
  tournament: {
    id: 1,
    name: 'Sunday Cup',
    date: '12.04.2026',
    location: 'Riga',
    status: 'Регистрация открыта'
  },
  participants: [],
  groups: []
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

function shuffle(list) {
  const arr = [...list];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

function escapeHtml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

function splitTeamsIntoGroups(teams) {
  if (teams.length <= 4) return [teams];

  const groupCount = Math.ceil(teams.length / 4);
  const baseSize = Math.floor(teams.length / groupCount);
  let remainder = teams.length % groupCount;
  let index = 0;
  const groups = [];

  for (let i = 0; i < groupCount; i++) {
    const size = baseSize + (remainder > 0 ? 1 : 0);
    remainder -= remainder > 0 ? 1 : 0;
    groups.push(teams.slice(index, index + size));
    index += size;
  }

  return groups;
}

function createMatches(teams) {
  const matches = [];
  for (let i = 0; i < teams.length; i++) {
    for (let j = i + 1; j < teams.length; j++) {
      matches.push({
        id: uid(),
        teamA: teams[i],
        teamB: teams[j],
        gamesA: '',
        gamesB: '',
        status: 'Scheduled',
        lastUpdatedBy: ''
      });
    }
  }
  return matches;
}

function computeStandings(group) {
  const standings = {};
  group.teams.forEach((team) => {
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

  group.matches.forEach((match) => {
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

function canPlayerUpdateMatch(playerName, match) {
  const allowedPlayers = [
    ...match.teamA.players.map((player) => player.name.toLowerCase()),
    ...match.teamB.players.map((player) => player.name.toLowerCase())
  ];
  return allowedPlayers.includes(playerName.trim().toLowerCase());
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
        <div class="muted">${escapeHtml(player.contact || '')}</div>
      </div>
      <button class="remove-btn" data-remove-player="${player.id}" title="Удалить">✕</button>
    </div>
  `).join('');

  document.querySelectorAll('[data-remove-player]').forEach((button) => {
    button.addEventListener('click', () => removePlayer(button.dataset.removePlayer));
  });
}

function renderGroups() {
  const groupsView = byId('groupsView');
  const standingsView = byId('standingsView');
  const matchesView = byId('matchesView');

  if (!state.groups.length) {
    groupsView.innerHTML = 'Пока турнир не сформирован.';
    groupsView.className = 'stack empty';
    standingsView.innerHTML = 'Нет данных.';
    standingsView.className = 'stack empty';
    matchesView.innerHTML = 'Нет матчей.';
    matchesView.className = 'stack empty';
    return;
  }

  groupsView.className = 'stack';
  standingsView.className = 'stack';
  matchesView.className = 'stack';

  groupsView.innerHTML = state.groups.map((group) => `
    <div class="item">
      <div class="row">
        <strong>${escapeHtml(group.name)}</strong>
        <div class="badge">${group.teams.length} пары</div>
      </div>
      <div class="stack" style="margin-top:10px;">
        ${group.teams.map((team, index) => `<div>${index + 1}. ${escapeHtml(team.name)}</div>`).join('')}
      </div>
    </div>
  `).join('');

  standingsView.innerHTML = state.groups.map((group) => {
    const rows = computeStandings(group);
    return `
      <div class="item">
        <strong>${escapeHtml(group.name)}</strong>
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
  }).join('');

  const allMatches = state.groups.flatMap((group) => group.matches.map((match) => ({ ...match, groupName: group.name })));

  matchesView.innerHTML = allMatches.map((match) => `
    <div class="item">
      <div class="row">
        <div>
          <strong>${escapeHtml(match.teamA.name)} — ${escapeHtml(match.teamB.name)}</strong>
          <div class="muted">${escapeHtml(match.groupName)}</div>
        </div>
        <div class="badge ${match.status === 'Completed' ? 'ok' : 'warn'}">${match.status === 'Completed' ? 'Готово' : 'Матч'}</div>
      </div>
      <form class="match-form" data-id="${match.id}">
        <div class="match-grid">
          <input type="number" min="0" name="gamesA" value="${match.gamesA}" placeholder="Геймы A" />
          <input type="number" min="0" name="gamesB" value="${match.gamesB}" placeholder="Геймы B" />
          <input type="text" name="updatedBy" value="${escapeHtml(match.lastUpdatedBy)}" placeholder="Кто вводит" />
        </div>
        <div class="actions" style="margin-top:10px;">
          <button type="submit" class="btn primary">Сохранить</button>
        </div>
      </form>
    </div>
  `).join('');

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

function renderHeader() {
  byId('tournamentStatus').textContent = state.tournament.status;
}

function render() {
  renderHeader();
  renderParticipants();
  renderGroups();
}

function addPlayer(name, contact, level) {
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
    level
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

function generateTournamentStructure() {
  if (state.participants.length === 0 || state.participants.length % 4 !== 0) {
    alert('Количество игроков должно быть кратно 4.');
    return;
  }

  const shuffledPlayers = shuffle(state.participants);
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

  const groupChunks = splitTeamsIntoGroups(teams);
  state.groups = groupChunks.map((groupTeams, index) => ({
    id: uid(),
    name: `Group ${String.fromCharCode(65 + index)}`,
    teams: groupTeams,
    matches: createMatches(groupTeams)
  }));
  state.tournament.status = 'Турнир сформирован';
  saveState();
  render();
}

function updateMatch(matchId, gamesA, gamesB, updatedBy) {
  for (const group of state.groups) {
    const match = group.matches.find((item) => item.id === matchId);
    if (!match) continue;

    if (!updatedBy || !canPlayerUpdateMatch(updatedBy, match)) {
      alert('Результат может вводить только игрок этого матча.');
      return;
    }

    if (gamesA === '' || gamesB === '') {
      alert('Заполни оба счета.');
      return;
    }

    if (Number(gamesA) === Number(gamesB)) {
      alert('Ничья не допускается.');
      return;
    }

    match.gamesA = gamesA;
    match.gamesB = gamesB;
    match.lastUpdatedBy = updatedBy;
    match.status = 'Completed';

    saveState();
    render();
    return;
  }
}

function resetAll() {
  localStorage.removeItem(STORAGE_KEY);
  state = loadState();
  render();
}

function loadDemoPlayers20() {
  if (state.tournament.status !== 'Регистрация открыта') {
    alert('Сначала сбрось турнир.');
    return;
  }

  state.participants = [
    ['Nikolaj', 'nikolaj@demo.lv'], ['Mark', 'mark@demo.lv'], ['Erik', 'erik@demo.lv'], ['Valera', 'valera@demo.lv'],
    ['Alex', 'alex@demo.lv'], ['Julia', 'julia@demo.lv'], ['Olga', 'olga@demo.lv'], ['David', 'david@demo.lv'],
    ['Nadya', 'nadya@demo.lv'], ['Emils', 'emils@demo.lv'], ['Simona', 'simona@demo.lv'], ['Ignat', 'ignat@demo.lv'],
    ['Inga', 'inga@demo.lv'], ['Alina', 'alina@demo.lv'], ['Lena', 'lena@demo.lv'], ['Anya', 'anya@demo.lv'],
    ['Roman', 'roman@demo.lv'], ['Kate', 'kate@demo.lv'], ['Denis', 'denis@demo.lv'], ['Marta', 'marta@demo.lv']
  ].map(([name, contact], index) => ({
    id: uid(),
    name,
    contact,
    level: index % 3 === 0 ? 'Advanced' : index % 2 === 0 ? 'Intermediate' : 'Beginner'
  }));

  saveState();
  render();
}

let state = loadState();

byId('playerForm').addEventListener('submit', (event) => {
  event.preventDefault();
  addPlayer(byId('playerName').value, byId('playerContact').value, byId('playerLevel').value);
  byId('playerForm').reset();
  byId('playerLevel').value = 'Intermediate';
  byId('playerName').focus();
});

byId('generateBtn').addEventListener('click', generateTournamentStructure);
byId('resetBtn').addEventListener('click', resetAll);
byId('demoPlayersBtn').addEventListener('click', loadDemoPlayers20);

render();
