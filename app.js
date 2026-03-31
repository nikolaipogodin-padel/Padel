const STORAGE_KEY = 'padel-riga-local-v1';

const initialState = {
  tournament: {
    id: 1,
    name: 'Riga Padel Sunday Cup',
    date: '2026-04-12',
    location: 'Riga',
    deadline: '2026-04-10 20:00',
    status: 'Registration Open'
  },
  profile: null,
  participants: [],
  groups: []
};

const clone = (obj) => JSON.parse(JSON.stringify(obj));

function loadState() {
  const saved = localStorage.getItem(STORAGE_KEY);
  return saved ? JSON.parse(saved) : clone(initialState);
}

function saveState() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

function uid() {
  return Math.random().toString(36).slice(2, 10);
}

function shuffle(list) {
  const arr = [...list];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
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
  group.teams.forEach(team => {
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

  group.matches.forEach(match => {
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
      a.points += 1;
      b.losses += 1;
    } else if (gb > ga) {
      b.wins += 1;
      b.points += 1;
      a.losses += 1;
    }
  });

  return Object.values(standings)
    .map(row => ({ ...row, diff: row.gamesWon - row.gamesLost }))
    .sort((x, y) => y.points - x.points || y.diff - x.diff || y.gamesWon - x.gamesWon || x.teamName.localeCompare(y.teamName))
    .map((row, index) => ({ ...row, rank: index + 1 }));
}

function canPlayerUpdateMatch(playerName, match) {
  const allowedPlayers = [
    ...match.teamA.players.map(player => player.name),
    ...match.teamB.players.map(player => player.name)
  ];
  return allowedPlayers.includes(playerName);
}

let state = loadState();

const profileForm = document.getElementById('profileForm');
const profileStatus = document.getElementById('profileStatus');
const profileSavedPill = document.getElementById('profileSavedPill');
const profilePreview = document.getElementById('profilePreview');
const clearProfileBtn = document.getElementById('clearProfileBtn');

const tournamentStatus = document.getElementById('tournamentStatus');
const participantsCount = document.getElementById('participantsCount');
const participantsList = document.getElementById('participantsList');
const joinTournamentBtn = document.getElementById('joinTournamentBtn');
const closeRegistrationBtn = document.getElementById('closeRegistrationBtn');
const resetDemoBtn = document.getElementById('resetDemoBtn');
const seed20Btn = document.getElementById('seed20Btn');

const groupsView = document.getElementById('groupsView');
const standingsView = document.getElementById('standingsView');
const matchesView = document.getElementById('matchesView');

function renderProfile() {
  if (!state.profile) {
    profileStatus.textContent = 'Профиль не создан';
    profileSavedPill.textContent = 'Нет данных';
    profilePreview.innerHTML = '<div class="item empty">Сначала создай профиль игрока.</div>';
    document.getElementById('profileName').value = '';
    document.getElementById('profileContact').value = '';
    document.getElementById('profileLevel').value = 'Intermediate';
    return;
  }

  profileStatus.textContent = 'Профиль создан';
  profileSavedPill.textContent = state.profile.name;
  profilePreview.innerHTML = `
    <div class="item highlight">
      <strong>${state.profile.name}</strong>
      <div class="small muted">${state.profile.contact}</div>
      <div class="small muted">Уровень: ${state.profile.level}</div>
    </div>
  `;
  document.getElementById('profileName').value = state.profile.name;
  document.getElementById('profileContact').value = state.profile.contact;
  document.getElementById('profileLevel').value = state.profile.level;
}

function renderTournament() {
  tournamentStatus.textContent = state.tournament.status;
  participantsCount.textContent = `${state.participants.length} игроков`;

  participantsList.innerHTML = state.participants.length
    ? state.participants.map((player, index) => `
        <div class="item">
          <strong>${index + 1}. ${player.name}</strong>
          <div class="small muted">${player.contact} • ${player.level}</div>
        </div>
      `).join('')
    : '<div class="item empty">Пока никто не записан в турнир.</div>';

  joinTournamentBtn.disabled = state.tournament.status !== 'Registration Open';
  closeRegistrationBtn.disabled = state.tournament.status !== 'Registration Open';
}

function renderGroups() {
  if (!state.groups.length) {
    groupsView.innerHTML = '<div class="item empty">Пары и группы появятся после закрытия регистрации.</div>';
    standingsView.innerHTML = '<div class="item empty">Live таблица появится после генерации турнира.</div>';
    matchesView.innerHTML = '<div class="item empty">Матчи еще не созданы.</div>';
    return;
  }

  groupsView.innerHTML = state.groups.map(group => `
    <div class="item">
      <div class="section-head">
        <h3>${group.name}</h3>
        <div class="pill live">${group.teams.length} пары</div>
      </div>
      ${group.teams.map((team, index) => `<div class="small">${index + 1}. ${team.name}</div>`).join('')}
    </div>
  `).join('');

  standingsView.innerHTML = state.groups.map(group => {
    const rows = computeStandings(group);
    return `
      <div class="item" style="margin-bottom:12px;">
        <h3>${group.name}</h3>
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
  }).join('');

  const allMatches = state.groups.flatMap(group => group.matches.map(match => ({ ...match, groupName: group.name })));

  matchesView.innerHTML = allMatches.map(match => `
    <div class="item">
      <div class="section-head">
        <div>
          <strong>${match.teamA.name} vs ${match.teamB.name}</strong>
          <div class="small muted">${match.groupName}</div>
        </div>
        <div class="pill ${match.status === 'Completed' ? 'ok' : 'warn'}">${match.status}</div>
      </div>
      <form class="match-form" data-id="${match.id}">
        <div class="grid-3">
          <label>Games A
            <input type="number" min="0" name="gamesA" value="${match.gamesA}" />
          </label>
          <label>Games B
            <input type="number" min="0" name="gamesB" value="${match.gamesB}" />
          </label>
          <label>Кто вводит результат
            <input type="text" name="updatedBy" value="${match.lastUpdatedBy}" placeholder="Имя игрока из матча" />
          </label>
        </div>
        <div class="toolbar">
          <button type="submit" class="btn primary">Сохранить результат</button>
        </div>
      </form>
    </div>
  `).join('');

  document.querySelectorAll('.match-form').forEach(form => {
    form.addEventListener('submit', (event) => {
      event.preventDefault();
      const formData = new FormData(form);
      updateMatch(
        form.dataset.id,
        formData.get('gamesA'),
        formData.get('gamesB'),
        String(formData.get('updatedBy')).trim()
      );
    });
  });
}

function updateMatch(matchId, gamesA, gamesB, updatedBy) {
  for (const group of state.groups) {
    const match = group.matches.find(item => item.id === matchId);
    if (!match) continue;

    if (!updatedBy || !canPlayerUpdateMatch(updatedBy, match)) {
      alert('Результат может вводить только один из 4 игроков этого матча.');
      return;
    }

    match.gamesA = gamesA;
    match.gamesB = gamesB;
    match.lastUpdatedBy = updatedBy;
    match.status = gamesA !== '' && gamesB !== '' && Number(gamesA) !== Number(gamesB)
      ? 'Completed'
      : 'Scheduled';
  }

  saveState();
  render();
}


function createDemoPlayers20() {
  const names = [
    ['Alex', 'alex@padelriga.lv', 'Intermediate'],
    ['Marta', 'marta@padelriga.lv', 'Beginner'],
    ['Denis', 'denis@padelriga.lv', 'Intermediate'],
    ['Laura', 'laura@padelriga.lv', 'Advanced'],
    ['Igor', 'igor@padelriga.lv', 'Beginner'],
    ['Sofia', 'sofia@padelriga.lv', 'Intermediate'],
    ['Roman', 'roman@padelriga.lv', 'Advanced'],
    ['Elina', 'elina@padelriga.lv', 'Intermediate'],
    ['Mark', 'mark@padelriga.lv', 'Intermediate'],
    ['Anna', 'anna@padelriga.lv', 'Beginner'],
    ['Viktor', 'viktor@padelriga.lv', 'Advanced'],
    ['Liene', 'liene@padelriga.lv', 'Intermediate'],
    ['Artur', 'artur@padelriga.lv', 'Beginner'],
    ['Diana', 'diana@padelriga.lv', 'Advanced'],
    ['Sergey', 'sergey@padelriga.lv', 'Intermediate'],
    ['Inga', 'inga@padelriga.lv', 'Beginner'],
    ['Janis', 'janis@padelriga.lv', 'Advanced'],
    ['Kristine', 'kristine@padelriga.lv', 'Intermediate'],
    ['Pavel', 'pavel@padelriga.lv', 'Intermediate'],
    ['Eva', 'eva@padelriga.lv', 'Beginner']
  ];

  state.profile = null;
  state.groups = [];
  state.tournament.status = 'Registration Open';
  state.participants = names.map(([name, contact, level]) => ({
    id: uid(),
    name,
    contact,
    level
  }));

  saveState();
  render();
  alert('Загружены 20 демо-игроков. Важно: текущая версия формирует турнир только при количестве игроков, кратном 8.');
}

function generateTournamentStructure() {
  if (state.participants.length === 0 || state.participants.length % 8 !== 0) {
    alert('Количество игроков должно быть кратно 8. 8 игроков = 4 пары = 1 группа.');
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

  const groups = [];
  let groupCode = 65;
  for (let i = 0; i < teams.length; i += 4) {
    const groupTeams = teams.slice(i, i + 4);
    groups.push({
      id: uid(),
      name: `Group ${String.fromCharCode(groupCode++)}`,
      teams: groupTeams,
      matches: createMatches(groupTeams)
    });
  }

  state.groups = groups;
  state.tournament.status = 'In Progress';
  saveState();
  render();
}

function render() {
  renderProfile();
  renderTournament();
  renderGroups();
}

profileForm.addEventListener('submit', (event) => {
  event.preventDefault();
  state.profile = {
    id: state.profile?.id || uid(),
    name: document.getElementById('profileName').value.trim(),
    contact: document.getElementById('profileContact').value.trim(),
    level: document.getElementById('profileLevel').value
  };
  saveState();
  render();
  alert('Профиль сохранен.');
});

clearProfileBtn.addEventListener('click', () => {
  state.profile = null;
  saveState();
  render();
});

joinTournamentBtn.addEventListener('click', () => {
  if (!state.profile) {
    alert('Сначала создай профиль игрока.');
    return;
  }

  if (state.tournament.status !== 'Registration Open') {
    alert('Регистрация в турнир уже закрыта.');
    return;
  }

  const alreadyJoined = state.participants.some(player => player.id === state.profile.id);
  if (alreadyJoined) {
    alert('Ты уже записан в этот турнир.');
    return;
  }

  state.participants.push(clone(state.profile));
  saveState();
  render();
});

closeRegistrationBtn.addEventListener('click', () => {
  state.tournament.status = 'Registration Closed';
  saveState();
  generateTournamentStructure();
});

resetDemoBtn.addEventListener('click', () => {
  localStorage.removeItem(STORAGE_KEY);
  state = loadState();
  render();
});

seed20Btn.addEventListener('click', () => {
  createDemoPlayers20();
});

render();
