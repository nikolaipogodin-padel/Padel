const STORAGE_KEY = 'padel-club-v13';
const DETAIL_TABS = ['overview', 'players', 'schedule', 'standings'];
const DURATIONS = [1.5, 2, 3];

const initialState = {
  ui: {
    screen: 'tournaments',
    selectedTournamentId: 't1',
    detailTab: 'overview',
    showHistory: false,
    clubSearch: '',
    clubStatusFilter: 'all'
  },
  clubPlayers: [
    { id: 'p1', name: 'Nikolaj', contact: '+371 20000001', level: 'Intermediate', status: 'Approved', createdAt: '2026-03-01T10:00:00Z' },
    { id: 'p2', name: 'Eriks', contact: '+371 20000002', level: 'Advanced', status: 'Approved', createdAt: '2026-03-02T10:00:00Z' },
    { id: 'p3', name: 'Alina', contact: '+371 20000003', level: 'Intermediate', status: 'Approved', createdAt: '2026-03-03T10:00:00Z' },
    { id: 'p4', name: 'Valerija', contact: '+371 20000004', level: 'Intermediate', status: 'Approved', createdAt: '2026-03-04T10:00:00Z' },
    { id: 'p5', name: 'Ignats', contact: '+371 20000005', level: 'Beginner', status: 'Pending', createdAt: '2026-03-04T10:00:00Z' }
  ],
  tournaments: [
    {
      id: 't1',
      name: 'Riga Evening Open',
      date: '2026-04-12',
      location: 'Riga',
      startTime: '18:00',
      durationHours: 2,
      status: 'Open',
      registrations: [
        { playerId: 'p1', status: 'Joined', joinedAt: '2026-03-22T10:00:00Z' },
        { playerId: 'p2', status: 'Joined', joinedAt: '2026-03-22T10:05:00Z' },
        { playerId: 'p3', status: 'Joined', joinedAt: '2026-03-22T10:08:00Z' },
        { playerId: 'p4', status: 'Joined', joinedAt: '2026-03-22T10:09:00Z' }
      ],
      teams: [],
      rounds: [],
      matches: []
    },
    {
      id: 't2', name: 'Spring Club Cup', date: '2026-04-19', location: 'Riga', startTime: '10:00', durationHours: 3, status: 'Open',
      registrations: [], teams: [], rounds: [], matches: []
    },
    {
      id: 't3', name: 'Morning Mini', date: '2026-04-26', location: 'Jurmala', startTime: '09:00', durationHours: 1.5, status: 'Open',
      registrations: [], teams: [], rounds: [], matches: []
    },
    {
      id: 't4', name: 'Archive Sunday Cup', date: '2026-03-09', location: 'Riga', startTime: '11:00', durationHours: 2, status: 'Finished',
      registrations: [], teams: [], rounds: [], matches: []
    }
  ]
};

let state = loadState();
ensureStateShape();
refreshAllTournamentRegistrations();

const els = {
  screenTournaments: document.getElementById('screenTournaments'),
  screenClub: document.getElementById('screenClub'),
  globalTabs: document.getElementById('globalTabs'),
  tournamentRows: document.getElementById('tournamentRows'),
  historyToggleBtn: document.getElementById('historyToggleBtn'),
  selectedTournamentHero: document.getElementById('selectedTournamentHero'),
  detailTabs: document.getElementById('detailTabs'),
  overviewTab: document.getElementById('overviewTab'),
  playersTab: document.getElementById('playersTab'),
  scheduleTab: document.getElementById('scheduleTab'),
  standingsTab: document.getElementById('standingsTab'),
  clubPlayersTable: document.getElementById('clubPlayersTable'),
  clubSearchInput: document.getElementById('clubSearchInput'),
  clubStatusFilter: document.getElementById('clubStatusFilter'),
  modalOverlay: document.getElementById('modalOverlay'),
  modalCard: document.getElementById('modalCard'),
  toastStack: document.getElementById('toastStack'),
  newTournamentBtn: document.getElementById('newTournamentBtn'),
  addClubPlayerBtn: document.getElementById('addClubPlayerBtn'),
  seedDemoBtn: document.getElementById('seedDemoBtn'),
  resetAllBtn: document.getElementById('resetAllBtn')
};

bindEvents();
ensureModalClosed();
render();

function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : structuredClone(initialState);
  } catch {
    return structuredClone(initialState);
  }
}

function saveState() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

function ensureStateShape() {
  state.ui ??= structuredClone(initialState.ui);
  state.clubPlayers ??= [];
  state.tournaments ??= [];
}

function uid(prefix = 'id') {
  return `${prefix}_${Math.random().toString(36).slice(2, 9)}`;
}

function bindEvents() {
  els.globalTabs.addEventListener('click', (e) => {
    const btn = e.target.closest('[data-screen]');
    if (!btn) return;
    state.ui.screen = btn.dataset.screen;
    saveAndRender();
  });

  els.detailTabs.addEventListener('click', (e) => {
    const btn = e.target.closest('[data-detail-tab]');
    if (!btn) return;
    state.ui.detailTab = btn.dataset.detailTab;
    saveAndRender();
    setTimeout(() => document.getElementById(`${state.ui.detailTab}Tab`)?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 0);
  });

  els.historyToggleBtn.addEventListener('click', () => {
    state.ui.showHistory = !state.ui.showHistory;
    saveAndRender();
  });

  els.newTournamentBtn.addEventListener('click', () => openTournamentModal());
  els.addClubPlayerBtn.addEventListener('click', openClubPlayerModal);
  els.seedDemoBtn.addEventListener('click', seedDemo);
  els.resetAllBtn.addEventListener('click', resetAll);

  els.clubSearchInput.addEventListener('input', () => {
    state.ui.clubSearch = els.clubSearchInput.value;
    saveAndRender(false);
  });
  els.clubStatusFilter.addEventListener('change', () => {
    state.ui.clubStatusFilter = els.clubStatusFilter.value;
    saveAndRender(false);
  });

  document.addEventListener('keydown', (e) => {
    if (e.ctrlKey && e.key === 'Enter' && state.ui.screen === 'tournaments' && state.ui.selectedTournamentId) {
      generateTournament(state.ui.selectedTournamentId);
    }
  });
}

function saveAndRender(save = true) {
  if (save) saveState();
  render();
}

function getSelectedTournament() {
  return state.tournaments.find(t => t.id === state.ui.selectedTournamentId) || state.tournaments[0] || null;
}

function getClubPlayer(playerId) {
  return state.clubPlayers.find(p => p.id === playerId);
}

function getTournamentDerived(tournament) {
  const joinedRegs = [...(tournament.registrations || [])]
    .filter(r => r.status !== 'Withdrawn')
    .sort((a, b) => new Date(a.joinedAt) - new Date(b.joinedAt));

  const joinedPlayers = joinedRegs
    .map(reg => ({ ...getClubPlayer(reg.playerId), registrationStatus: reg.status, joinedAt: reg.joinedAt }))
    .filter(Boolean);

  const mainCount = Math.floor(joinedPlayers.length / 4) * 4;
  const mainDrawPlayers = joinedPlayers.slice(0, mainCount);
  const waitlistPlayers = joinedPlayers.slice(mainCount);
  const courts = Math.max(1, Math.floor(mainDrawPlayers.length / 4) || 1);
  const activeTeams = Math.floor(mainDrawPlayers.length / 2);
  const totalMatches = activeTeams > 1 ? (activeTeams * (activeTeams - 1)) / 2 : 0;
  const rounds = activeTeams > 1 ? activeTeams - 1 : 0;
  const totalMinutes = tournament.durationHours * 60;
  const transitionMinutes = 5;
  let matchMinutes = rounds ? Math.floor((totalMinutes - (rounds - 1) * transitionMinutes) / rounds) : 0;
  matchMinutes = matchMinutes > 0 ? Math.max(10, Math.round(matchMinutes / 5) * 5) : 0;

  return { joinedPlayers, mainDrawPlayers, waitlistPlayers, withdrawnPlayers, mainCount, courts, activeTeams, totalMatches, rounds, matchMinutes, transitionMinutes };
}

function refreshAllTournamentRegistrations() {
  state.tournaments.forEach(t => normalizeTournamentRegistrations(t));
  saveState();
}

function normalizeTournamentRegistrations(tournament) {
  const allRegs = [...(tournament.registrations || [])].sort((a, b) => new Date(a.joinedAt) - new Date(b.joinedAt));
  const withdrawnRegs = allRegs.filter(r => r.status === 'Withdrawn');
  const activeRegs = allRegs.filter(r => r.status !== 'Withdrawn' && getClubPlayer(r.playerId)?.status === 'Approved');
  const mainCount = Math.floor(activeRegs.length / 4) * 4;
  activeRegs.forEach((reg, idx) => {
    reg.status = idx < mainCount ? 'Joined' : 'Waitlist';
  });
  tournament.registrations = [...activeRegs, ...withdrawnRegs];
}

function render() {
  renderScreens();
  renderGlobalTabs();
  renderTournamentList();
  renderTournamentDetails();
  renderClubPlayers();
  applyTemporaryTooltips();
}

function renderScreens() {
  els.screenTournaments.classList.toggle('is-active', state.ui.screen === 'tournaments');
  els.screenClub.classList.toggle('is-active', state.ui.screen === 'club');
}

function renderGlobalTabs() {
  els.globalTabs.querySelectorAll('[data-screen]').forEach(btn => {
    btn.classList.toggle('is-active', btn.dataset.screen === state.ui.screen);
  });
  els.detailTabs.querySelectorAll('[data-detail-tab]').forEach(btn => {
    btn.classList.toggle('is-active', btn.dataset.detailTab === state.ui.detailTab);
  });
  DETAIL_TABS.forEach(tab => {
    document.getElementById(`${tab}Tab`).classList.toggle('is-active', tab === state.ui.detailTab);
  });
}

function renderTournamentList() {
  if (!state.tournaments.length) {
    els.tournamentRows.innerHTML = '<div class="empty">No tournaments yet.</div>';
    return;
  }

  if (!state.tournaments.some(t => t.id === state.ui.selectedTournamentId)) {
    state.ui.selectedTournamentId = state.tournaments[0].id;
  }

  const visible = state.ui.showHistory ? state.tournaments : state.tournaments.slice(0, 3);
  els.tournamentRows.innerHTML = visible.map(t => {
    const active = t.id === state.ui.selectedTournamentId ? 'is-active' : '';
    const statusClass = `status-${(t.status || 'open').toLowerCase()}`;
    return `
      <button class="tournament-item tournament-row ${active}" data-select-tournament="${t.id}">
        <div class="name-cell">
          <strong>${escapeHtml(t.name)}</strong>
          <span>${escapeHtml(t.location)}</span>
        </div>
        <div>${formatDate(t.date)}</div>
        <div>${escapeHtml(t.location)}</div>
        <div>${escapeHtml(t.startTime)}</div>
        <div>${t.durationHours}h</div>
        <div><span class="status-badge ${statusClass}">${escapeHtml(t.status)}</span></div>
      </button>
    `;
  }).join('');

  els.historyToggleBtn.textContent = state.ui.showHistory ? 'Hide history' : 'Show history';

  els.tournamentRows.querySelectorAll('[data-select-tournament]').forEach(btn => {
    btn.addEventListener('click', () => {
      state.ui.selectedTournamentId = btn.dataset.selectTournament;
      saveAndRender();
    });
  });
}

function renderTournamentDetails() {
  const tournament = getSelectedTournament();
  if (!tournament) {
    els.selectedTournamentHero.innerHTML = '<div class="empty">Create your first tournament.</div>';
    els.overviewTab.innerHTML = els.playersTab.innerHTML = els.scheduleTab.innerHTML = els.standingsTab.innerHTML = '';
    return;
  }

  const derived = getTournamentDerived(tournament);
  const leader = computeStandings(tournament)[0] || null;

  els.selectedTournamentHero.innerHTML = `
    <div class="hero-top">
      <div>
        <div class="hero-title">${escapeHtml(tournament.name)}</div>
        <div class="hero-meta">
          <span>${formatDate(tournament.date)}</span>
          <span>•</span>
          <span>${escapeHtml(tournament.location)}</span>
          <span>•</span>
          <span>${escapeHtml(tournament.startTime)}</span>
          <span>•</span>
          <span>${tournament.durationHours}h</span>
        </div>
      </div>
      <div class="hero-actions">
        <span class="status-badge status-${tournament.status.toLowerCase()}">${escapeHtml(tournament.status)}</span>
        <button class="btn ghost" id="editTournamentBtn">Edit</button>
        <button class="btn secondary" id="joinFromClubBtn">Add from Club</button>
        <button class="btn primary" id="generateBtn">Generate</button>
      </div>
    </div>
    <div class="metrics-grid">
      <div class="metric"><div class="metric-label">Joined</div><div class="metric-value">${derived.joinedPlayers.length}</div></div>
      <div class="metric"><div class="metric-label">Main draw</div><div class="metric-value">${derived.mainDrawPlayers.length}</div></div>
      <div class="metric"><div class="metric-label">Waitlist</div><div class="metric-value">${derived.waitlistPlayers.length}</div></div>
      <div class="metric"><div class="metric-label">Withdrawn</div><div class="metric-value">${derived.withdrawnPlayers.length}</div></div>
      <div class="metric"><div class="metric-label">Courts</div><div class="metric-value">${derived.courts}</div></div>
      <div class="metric"><div class="metric-label">Teams</div><div class="metric-value">${derived.activeTeams}</div></div>
      <div class="metric"><div class="metric-label">Match time</div><div class="metric-value">${derived.matchMinutes || '—'} min</div></div>
    </div>
  `;

  document.getElementById('joinFromClubBtn').addEventListener('click', () => openAddFromClubModal(tournament.id));
  document.getElementById('generateBtn').addEventListener('click', () => generateTournament(tournament.id));
  document.getElementById('editTournamentBtn').addEventListener('click', () => openTournamentModal(tournament));

  renderOverview(tournament, derived, leader);
  renderPlayersTab(tournament, derived);
  renderScheduleTab(tournament);
  renderStandingsTab(tournament, leader);
}

function renderOverview(tournament, derived, leader) {
  els.overviewTab.innerHTML = `
    <div class="grid-2">
      <div class="card">
        <h3>Tournament summary</h3>
        <div class="roster-list">
          <div class="mini-item"><span>Date</span><strong>${formatDate(tournament.date)}</strong></div>
          <div class="mini-item"><span>Location</span><strong>${escapeHtml(tournament.location)}</strong></div>
          <div class="mini-item"><span>Start</span><strong>${escapeHtml(tournament.startTime)}</strong></div>
          <div class="mini-item"><span>Duration</span><strong>${tournament.durationHours} hours</strong></div>
          <div class="mini-item"><span>Match time</span><strong>${derived.matchMinutes || '—'} min</strong></div>
          <div class="mini-item"><span>Total matches</span><strong>${derived.totalMatches}</strong></div>
        </div>
      </div>
      <div class="card">
        <h3>Readiness</h3>
        <div class="roster-list">
          <div class="mini-item"><span>Joined players</span><strong>${derived.joinedPlayers.length}</strong></div>
          <div class="mini-item"><span>Main draw</span><strong>${derived.mainDrawPlayers.length}</strong></div>
          <div class="mini-item"><span>Waitlist</span><strong>${derived.waitlistPlayers.length}</strong></div>
          <div class="mini-item"><span>Withdrawn</span><strong>${derived.withdrawnPlayers.length}</strong></div>
          <div class="mini-item"><span>Courts used</span><strong>${derived.courts}</strong></div>
          <div class="mini-item"><span>Schedule generated</span><strong>${tournament.rounds?.length ? 'Yes' : 'No'}</strong></div>
          <div class="mini-item"><span>Current leader</span><strong>${leader ? leader.teamName : '—'}</strong></div>
        </div>
      </div>
    </div>
  `;
}

function renderPlayersTab(tournament, derived) {
  const joinedRows = derived.mainDrawPlayers.length ? derived.mainDrawPlayers.map(player => playerRowHtml(player, 'Joined', tournament.id)).join('') : '<div class="empty">No joined players in main draw.</div>';
  const waitRows = derived.waitlistPlayers.length ? derived.waitlistPlayers.map(player => playerRowHtml(player, 'Waitlist', tournament.id)).join('') : '<div class="empty">No waitlist players.</div>';
  const withdrawnRows = derived.withdrawnPlayers.length ? derived.withdrawnPlayers.map(player => playerRowHtml(player, 'Withdrawn', tournament.id)).join('') : '<div class="empty">No withdrawn players.</div>';

  els.playersTab.innerHTML = `
    <div class="status-strip">
      <div class="status-tile joined"><div class="status-kicker">Joined</div><div class="status-count">${derived.mainDrawPlayers.length}</div><div class="status-note">Included in schedule</div></div>
      <div class="status-tile waitlist"><div class="status-kicker">Waitlist</div><div class="status-count">${derived.waitlistPlayers.length}</div><div class="status-note">Next in line</div></div>
      <div class="status-tile withdrawn"><div class="status-kicker">Withdrawn</div><div class="status-count">${derived.withdrawnPlayers.length}</div><div class="status-note">Kept in history</div></div>
    </div>
    <div class="player-status-layout">
      <div class="card status-card joined">
        <div class="panel-head"><div><h3>Joined</h3><div class="section-subtitle">Players used for schedule generation</div></div><span class="badge badge-main">${derived.mainDrawPlayers.length}</span></div>
        <div class="roster-list">${joinedRows}</div>
      </div>
      <div class="card status-card waitlist">
        <div class="panel-head"><div><h3>Waitlist</h3><div class="section-subtitle">Auto-filled when count is not divisible by 4</div></div><span class="badge badge-wait">${derived.waitlistPlayers.length}</span></div>
        <div class="roster-list">${waitRows}</div>
      </div>
      <div class="card status-card withdrawn">
        <div class="panel-head"><div><h3>Withdrawn</h3><div class="section-subtitle">Removed from active draw, kept for reference</div></div><span class="badge badge-withdrawn">${derived.withdrawnPlayers.length}</span></div>
        <div class="roster-list">${withdrawnRows}</div>
      </div>
    </div>
  `;

  els.playersTab.querySelectorAll('[data-withdraw-player]').forEach(btn => {
    btn.addEventListener('click', () => withdrawPlayer(tournament.id, btn.dataset.withdrawPlayer));
  });
  els.playersTab.querySelectorAll('[data-restore-player]').forEach(btn => {
    btn.addEventListener('click', () => restorePlayer(tournament.id, btn.dataset.restorePlayer));
  });
}

function playerRowHtml(player, bucket, tournamentId) {
  const map = {
    Joined: { badge: 'badge-main', action: `<button class="btn ghost" data-withdraw-player="${player.id}" data-tournament="${tournamentId}">Move out</button>` },
    Waitlist: { badge: 'badge-wait', action: `<button class="btn ghost" data-withdraw-player="${player.id}" data-tournament="${tournamentId}">Withdraw</button>` },
    Withdrawn: { badge: 'badge-withdrawn', action: `<button class="btn ghost" data-restore-player="${player.id}" data-tournament="${tournamentId}">Restore</button>` }
  };
  const cfg = map[bucket];
  return `
    <div class="player-row player-row-${bucket.toLowerCase()}">
      <div>
        <strong>${escapeHtml(player.name)}</strong>
        <small>${escapeHtml(player.level)} • ${escapeHtml(player.contact)}</small>
      </div>
      <div class="actions-row">
        <span class="badge ${cfg.badge}">${bucket}</span>
        ${cfg.action}
      </div>
    </div>
  `;
}

function renderScheduleTab(tournament) {
  if (!tournament.rounds?.length) {
    els.scheduleTab.innerHTML = '<div class="empty">No schedule yet. Add approved players and click Generate.</div>';
    return;
  }

  els.scheduleTab.innerHTML = `
    <div class="schedule-grid">
      ${tournament.rounds.map((round, index) => `
        <div class="round-card">
          <div class="round-head">
            <div>
              <div class="round-title">Round ${index + 1}</div>
              <div class="round-sub">${round.startTime} – ${round.endTime}</div>
            </div>
            <span class="badge">${round.matches.length} matches</span>
          </div>
          <div class="round-body">
            ${round.matches.map(match => `
              <div class="round-match">
                <div>
                  <div><span class="court-pill">Court ${match.court}</span></div>
                  <strong>${escapeHtml(match.teamA.name)} vs ${escapeHtml(match.teamB.name)}</strong>
                </div>
                <div>
                  <span class="status-badge status-${match.status.toLowerCase() === 'completed' ? 'finished' : 'open'}">${escapeHtml(match.status)}</span>
                </div>
              </div>
            `).join('')}
          </div>
        </div>
      `).join('')}
    </div>
    <div class="card" style="margin-top:16px;">
      <div class="results-toolbar">
        <div>
          <h3 style="margin:0;">Results</h3>
          <div class="section-subtitle">Open result editor for a clean modal workflow</div>
        </div>
      </div>
      <div class="results-list">
        ${tournament.matches.map(match => resultCardHtml(match)).join('')}
      </div>
    </div>
  `;

  els.scheduleTab.querySelectorAll('[data-open-result]').forEach(btn => {
    btn.addEventListener('click', () => openResultModal(tournament.id, btn.dataset.openResult));
  });
}

function resultCardHtml(match) {
  const score = match.status === 'Completed' ? `${match.gamesA} : ${match.gamesB}` : 'Not entered';
  const updatedBy = match.lastUpdatedBy ? ` • by ${escapeHtml(match.lastUpdatedBy)}` : '';
  return `
    <div class="result-card result-card-clean">
      <div>
        <strong>${escapeHtml(match.teamA.name)} vs ${escapeHtml(match.teamB.name)}</strong>
        <div class="muted">Court ${match.court} • ${match.roundTime}</div>
      </div>
      <div class="result-card-side">
        <div class="score-chip ${match.status === 'Completed' ? 'is-complete' : ''}">${score}${updatedBy}</div>
        <button class="btn primary" type="button" data-open-result="${match.id}">${match.status === 'Completed' ? 'Edit result' : 'Enter result'}</button>
      </div>
    </div>
  `;
}

function renderStandingsTab(tournament, leader) {
  const standings = computeStandings(tournament);
  if (!standings.length) {
    els.standingsTab.innerHTML = '<div class="empty">Standings will appear after tournament generation.</div>';
    return;
  }

  els.standingsTab.innerHTML = `
    <div class="leader-card">
      <strong>Current leader:</strong> ${leader ? escapeHtml(leader.teamName) : '—'}
    </div>
    <div class="card table-wrap">
      <table>
        <thead>
          <tr>
            <th>#</th><th>Team</th><th>P</th><th>W</th><th>L</th><th>GW</th><th>GL</th><th>Diff</th>
          </tr>
        </thead>
        <tbody>
          ${standings.map(row => `
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

function renderClubPlayers() {
  els.clubSearchInput.value = state.ui.clubSearch;
  els.clubStatusFilter.value = state.ui.clubStatusFilter;

  const q = state.ui.clubSearch.trim().toLowerCase();
  const statusFilter = state.ui.clubStatusFilter;
  const players = state.clubPlayers.filter(player => {
    const matchQ = !q || player.name.toLowerCase().includes(q) || player.contact.toLowerCase().includes(q);
    const matchStatus = statusFilter === 'all' || player.status === statusFilter;
    return matchQ && matchStatus;
  });

  els.clubPlayersTable.innerHTML = `
    <div class="club-toolbar club-toolbar-top">
      <button class="btn secondary" id="importClubBtn">Import players</button>
      <button class="btn ghost" id="exportClubBtn">Export JSON</button>
    </div>
    <div class="club-table-header">
      <div>Player</div>
      <div>Level</div>
      <div>Status</div>
      <div>Actions</div>
    </div>
    <div class="club-rows">
      ${players.length ? players.map(player => `
        <div class="club-row">
          <div><strong>${escapeHtml(player.name)}</strong><br><small>${escapeHtml(player.contact)}</small></div>
          <div>${escapeHtml(player.level)}</div>
          <div><span class="badge badge-${player.status.toLowerCase()}">${escapeHtml(player.status)}</span></div>
          <div class="actions-row">
            ${player.status !== 'Approved' ? `<button class="btn secondary" data-set-status="Approved" data-player-id="${player.id}">Approve</button>` : ''}
            ${player.status !== 'Blocked' ? `<button class="btn ghost" data-set-status="Blocked" data-player-id="${player.id}">Block</button>` : ''}
            ${player.status !== 'Pending' ? `<button class="btn ghost" data-set-status="Pending" data-player-id="${player.id}">Pending</button>` : ''}
          </div>
        </div>
      `).join('') : '<div class="empty">No players found.</div>'}
    </div>
  `;

  els.clubPlayersTable.querySelectorAll('[data-set-status]').forEach(btn => {
    btn.addEventListener('click', () => setClubPlayerStatus(btn.dataset.playerId, btn.dataset.setStatus));
  });
  document.getElementById('importClubBtn')?.addEventListener('click', openImportPlayersModal);
  document.getElementById('exportClubBtn')?.addEventListener('click', exportClubPlayers);
}

function openTournamentModal(tournament = null) {
  const isEdit = Boolean(tournament);
  openModal(`
    <div class="modal-head">
      <div>
        <div class="modal-title">${isEdit ? 'Edit tournament' : 'New tournament'}</div>
        <div class="section-subtitle">${isEdit ? 'Update tournament details and regenerate if needed' : 'Create a tournament in one quick step'}</div>
      </div>
      <button class="btn ghost" data-close-modal>Close</button>
    </div>
    <form id="tournamentForm">
      <div class="form-grid">
        <label><div class="section-subtitle">Name</div><input class="input" name="name" required placeholder="Sunday Open" value="${escapeHtml(tournament?.name || '')}" /></label>
        <label><div class="section-subtitle">Location</div><input class="input" name="location" required placeholder="Riga" value="${escapeHtml(tournament?.location || '')}" /></label>
        <label><div class="section-subtitle">Date</div><input class="input" type="date" name="date" required value="${escapeHtml(tournament?.date || '')}" /></label>
        <label><div class="section-subtitle">Start</div><input class="input" type="time" name="startTime" required value="${escapeHtml(tournament?.startTime || '18:00')}" /></label>
        <label><div class="section-subtitle">Duration</div><select class="select" name="durationHours">${DURATIONS.map(d => `<option value="${d}" ${Number(tournament?.durationHours || 2) === d ? 'selected' : ''}>${d}h</option>`).join('')}</select></label>
        <label><div class="section-subtitle">Status</div><select class="select" name="status">
          ${['Open','Live','Finished'].map(s => `<option value="${s}" ${((tournament?.status || 'Open') === s) ? 'selected' : ''}>${s}</option>`).join('')}
        </select></label>
      </div>
      <div class="modal-foot">
        <button class="btn ghost" type="button" data-close-modal>Cancel</button>
        ${isEdit ? '<button class="btn ghost danger-btn" type="button" id="deleteTournamentBtn">Delete</button>' : ''}
        <button class="btn primary" type="submit">${isEdit ? 'Save changes' : 'Create'}</button>
      </div>
    </form>
  `);

  document.getElementById('tournamentForm').addEventListener('submit', (e) => {
    e.preventDefault();
    const fd = new FormData(e.target);
    const date = String(fd.get('date'));
    if (date < todayISO() && !isEdit) {
      toast('Date cannot be in the past.', 'error');
      return;
    }

    if (isEdit) {
      tournament.name = String(fd.get('name')).trim();
      tournament.location = String(fd.get('location')).trim();
      tournament.date = date;
      tournament.startTime = String(fd.get('startTime'));
      tournament.durationHours = Number(fd.get('durationHours'));
      tournament.status = String(fd.get('status'));
      if (tournament.matches?.length) {
        tournament.rounds = [];
        tournament.matches = [];
        tournament.teams = [];
        if (tournament.status === 'Finished') {
          // keep finished if admin sets it explicitly
        } else {
          tournament.status = 'Open';
        }
      }
      toast('Tournament updated.', 'success');
    } else {
      const nextTournament = {
        id: uid('t'),
        name: String(fd.get('name')).trim(),
        location: String(fd.get('location')).trim(),
        date,
        startTime: String(fd.get('startTime')),
        durationHours: Number(fd.get('durationHours')),
        status: String(fd.get('status')),
        registrations: [], teams: [], rounds: [], matches: []
      };
      state.tournaments.unshift(nextTournament);
      state.ui.selectedTournamentId = nextTournament.id;
      state.ui.screen = 'tournaments';
      toast('Tournament created.', 'success');
    }
    closeModal();
    saveAndRender();
  });

  document.getElementById('deleteTournamentBtn')?.addEventListener('click', () => {
    if (!confirm('Delete this tournament?')) return;
    state.tournaments = state.tournaments.filter(item => item.id !== tournament.id);
    state.ui.selectedTournamentId = state.tournaments[0]?.id || null;
    closeModal();
    saveAndRender();
    toast('Tournament deleted.', 'success');
  });
}

function openClubPlayerModal() {
  openModal(`
    <div class="modal-head">
      <div>
        <div class="modal-title">Add club player</div>
        <div class="section-subtitle">Player will be approved by default in MVP</div>
      </div>
      <button class="btn ghost" data-close-modal>Close</button>
    </div>
    <form id="clubPlayerForm">
      <div class="form-grid">
        <label><div class="section-subtitle">Name</div><input class="input" name="name" required /></label>
        <label><div class="section-subtitle">Contact</div><input class="input" name="contact" required /></label>
        <label><div class="section-subtitle">Level</div>
          <select class="select" name="level">
            <option>Beginner</option>
            <option selected>Intermediate</option>
            <option>Advanced</option>
          </select>
        </label>
      </div>
      <div class="modal-foot">
        <button class="btn ghost" type="button" data-close-modal>Cancel</button>
        <button class="btn primary" type="submit">Add player</button>
      </div>
    </form>
  `);

  document.getElementById('clubPlayerForm').addEventListener('submit', (e) => {
    e.preventDefault();
    const fd = new FormData(e.target);
    const name = String(fd.get('name')).trim();
    const contact = String(fd.get('contact')).trim();
    if (isDuplicateClubPlayer(name, contact)) {
      toast('Duplicate player.', 'error');
      return;
    }
    state.clubPlayers.unshift({
      id: uid('p'), name, contact,
      level: String(fd.get('level')),
      status: 'Approved',
      createdAt: new Date().toISOString()
    });
    closeModal();
    saveAndRender();
    toast('Club player added.', 'success');
  });
}

function openImportPlayersModal() {
  openModal(`
    <div class="modal-head">
      <div>
        <div class="modal-title">Import club players</div>
        <div class="section-subtitle">Paste CSV or lines: Name, Contact, Level, Status</div>
      </div>
      <button class="btn ghost" data-close-modal>Close</button>
    </div>
    <form id="importPlayersForm">
      <div class="form-grid one">
        <label>
          <div class="section-subtitle">Rows</div>
          <textarea class="input textarea" name="rows" rows="12" placeholder="Name, Contact, Level, Status\nAnna, +37120000007, Intermediate, Approved\nMark, +37120000008, Advanced, Pending"></textarea>
        </label>
      </div>
      <div class="modal-foot">
        <button class="btn ghost" type="button" data-close-modal>Cancel</button>
        <button class="btn primary" type="submit">Import</button>
      </div>
    </form>
  `);

  document.getElementById('importPlayersForm').addEventListener('submit', (e) => {
    e.preventDefault();
    const raw = String(new FormData(e.target).get('rows') || '');
    const rows = raw.split(/\r?\n/).map(line => line.trim()).filter(Boolean);
    if (!rows.length) {
      toast('Nothing to import.', 'error');
      return;
    }

    let imported = 0;
    let skipped = 0;
    rows.forEach((row, index) => {
      const parts = row.split(/[;,\t]/).map(x => x.trim()).filter(Boolean);
      if (!parts.length) return;
      if (index === 0 && /name/i.test(parts[0])) return;
      const [name, contact = '', level = 'Intermediate', status = 'Approved'] = parts;
      if (!name || !contact || isDuplicateClubPlayer(name, contact)) {
        skipped += 1;
        return;
      }
      const normalizedStatus = ['Approved', 'Pending', 'Blocked'].includes(status) ? status : 'Approved';
      state.clubPlayers.push({
        id: uid('p'),
        name,
        contact,
        level: ['Beginner', 'Intermediate', 'Advanced'].includes(level) ? level : 'Intermediate',
        status: normalizedStatus,
        createdAt: new Date().toISOString()
      });
      imported += 1;
    });

    state.tournaments.forEach(normalizeTournamentRegistrations);
    closeModal();
    saveAndRender();
    toast(`Imported ${imported}, skipped ${skipped}.`, imported ? 'success' : 'error');
  });
}

function openAddFromClubModal(tournamentId) {
  const tournament = state.tournaments.find(t => t.id === tournamentId);
  const existingIds = new Set((tournament.registrations || []).map(r => r.playerId));
  const approved = state.clubPlayers.filter(p => p.status === 'Approved' && !existingIds.has(p.id));

  openModal(`
    <div class="modal-head">
      <div>
        <div class="modal-title">Add from Club</div>
        <div class="section-subtitle">Only approved players are available</div>
      </div>
      <button class="btn ghost" data-close-modal>Close</button>
    </div>
    <div class="roster-list">
      ${approved.length ? approved.map(player => `
        <button class="player-row" data-add-club-player="${player.id}">
          <div>
            <strong>${escapeHtml(player.name)}</strong>
            <small>${escapeHtml(player.level)} • ${escapeHtml(player.contact)}</small>
          </div>
          <span class="badge badge-approved">Approved</span>
        </button>
      `).join('') : '<div class="empty">No available approved players.</div>'}
    </div>
  `);

  document.querySelectorAll('[data-add-club-player]').forEach(btn => {
    btn.addEventListener('click', () => {
      addPlayerToTournament(tournamentId, btn.dataset.addClubPlayer);
      closeModal();
    });
  });
}

function openResultModal(tournamentId, matchId) {
  const tournament = state.tournaments.find(t => t.id === tournamentId);
  const match = tournament?.matches.find(m => m.id === matchId);
  if (!match) return;

  const options = [...match.teamA.players, ...match.teamB.players].map(player => {
    const selected = player.name === match.lastUpdatedBy ? 'selected' : '';
    return `<option value="${escapeHtml(player.name)}" ${selected}>${escapeHtml(player.name)}</option>`;
  }).join('');

  openModal(`
    <div class="modal-head">
      <div>
        <div class="modal-title">Result editor</div>
        <div class="section-subtitle">${escapeHtml(match.teamA.name)} vs ${escapeHtml(match.teamB.name)} • Court ${match.court}</div>
      </div>
      <button class="btn ghost" data-close-modal>Close</button>
    </div>
    <form id="resultModalForm">
      <div class="form-grid">
        <label><div class="section-subtitle">Games team A</div><input class="input" type="number" name="gamesA" min="0" required value="${match.gamesA ?? ''}" /></label>
        <label><div class="section-subtitle">Games team B</div><input class="input" type="number" name="gamesB" min="0" required value="${match.gamesB ?? ''}" /></label>
        <label style="grid-column:1 / -1"><div class="section-subtitle">Who enters</div><select class="select" name="updatedBy" required><option value="">Select player</option>${options}</select></label>
      </div>
      <div class="modal-foot">
        <button class="btn ghost" type="button" data-close-modal>Cancel</button>
        <button class="btn primary" type="submit">Save result</button>
      </div>
    </form>
  `);

  document.getElementById('resultModalForm').addEventListener('submit', (e) => {
    e.preventDefault();
    const fd = new FormData(e.target);
    const ok = updateMatchResult(tournamentId, matchId, fd.get('gamesA'), fd.get('gamesB'), fd.get('updatedBy'));
    if (ok) closeModal();
  });
}

function addPlayerToTournament(tournamentId, playerId) {
  const tournament = state.tournaments.find(t => t.id === tournamentId);
  const player = getClubPlayer(playerId);
  if (!tournament || !player) return;
  if (player.status !== 'Approved') {
    toast('Only approved players can join tournaments.', 'error');
    return;
  }
  if ((tournament.registrations || []).some(r => r.playerId === playerId)) {
    toast('Player already added.', 'error');
    return;
  }
  tournament.registrations.push({ playerId, status: 'Joined', joinedAt: new Date().toISOString() });
  normalizeTournamentRegistrations(tournament);
  saveAndRender();
  toast('Player added to tournament.', 'success');
}

function withdrawPlayer(tournamentId, playerId) {
  const tournament = state.tournaments.find(t => t.id === tournamentId);
  if (!tournament) return;
  const reg = (tournament.registrations || []).find(r => r.playerId === playerId);
  if (!reg) return;
  reg.status = 'Withdrawn';
  normalizeTournamentRegistrations(tournament);
  saveAndRender();
  toast('Player moved to withdrawn.', 'success');
}

function restorePlayer(tournamentId, playerId) {
  const tournament = state.tournaments.find(t => t.id === tournamentId);
  if (!tournament) return;
  const reg = (tournament.registrations || []).find(r => r.playerId === playerId);
  if (!reg) return;
  reg.status = 'Waitlist';
  reg.joinedAt = new Date().toISOString();
  normalizeTournamentRegistrations(tournament);
  saveAndRender();
  toast('Player restored to active list.', 'success');
}

function setClubPlayerStatus(playerId, newStatus) {
  const player = getClubPlayer(playerId);
  if (!player) return;
  player.status = newStatus;
  state.tournaments.forEach(normalizeTournamentRegistrations);
  saveAndRender();
  toast(`Player status: ${newStatus}`, 'success');
}

function generateTournament(tournamentId) {
  const tournament = state.tournaments.find(t => t.id === tournamentId);
  if (!tournament) return;
  const derived = getTournamentDerived(tournament);
  if (derived.mainDrawPlayers.length < 4) {
    toast('Need at least 4 approved players in main draw.', 'error');
    state.ui.detailTab = 'players';
    saveAndRender();
    return;
  }
  if (derived.matchMinutes < 10) {
    toast('Not enough time for all rounds.', 'error');
    state.ui.detailTab = 'overview';
    saveAndRender();
    return;
  }

  const shuffledPlayers = shuffle([...derived.mainDrawPlayers]);
  const teams = [];
  for (let i = 0; i < shuffledPlayers.length; i += 2) {
    const p1 = shuffledPlayers[i];
    const p2 = shuffledPlayers[i + 1];
    teams.push({ id: uid('team'), players: [p1, p2], name: `${p1.name} / ${p2.name}` });
  }

  const allMatches = [];
  for (let i = 0; i < teams.length; i++) {
    for (let j = i + 1; j < teams.length; j++) {
      allMatches.push({
        id: uid('m'),
        teamA: teams[i],
        teamB: teams[j],
        gamesA: '',
        gamesB: '',
        status: 'Scheduled',
        lastUpdatedBy: '',
        court: null,
        roundIndex: null,
        roundTime: ''
      });
    }
  }

  const rounds = scheduleRoundRobin(allMatches, derived.courts, tournament.startTime, derived.matchMinutes, derived.transitionMinutes);
  tournament.teams = teams;
  tournament.rounds = rounds;
  tournament.matches = rounds.flatMap((round, roundIndex) => round.matches.map(match => ({ ...match, roundIndex, roundTime: `${round.startTime} – ${round.endTime}` })));
  tournament.status = 'Live';
  state.ui.detailTab = 'schedule';
  saveAndRender();
  toast('Tournament generated.', 'success');
}

function scheduleRoundRobin(matches, courtCount, startTime, matchMinutes, transitionMinutes) {
  if (!matches.length) return [];
  const queue = shuffle(matches);
  const rounds = [];
  let previousCourtByTeam = new Map();
  let remaining = [...queue];
  let roundIndex = 0;

  while (remaining.length) {
    const usedTeams = new Set();
    const roundMatches = [];
    let candidates = [...remaining];

    for (let court = 1; court <= courtCount; court++) {
      let bestIdx = -1;
      let bestScore = Infinity;
      for (let i = 0; i < candidates.length; i++) {
        const match = candidates[i];
        if (usedTeams.has(match.teamA.id) || usedTeams.has(match.teamB.id)) continue;
        const penalty = (previousCourtByTeam.get(match.teamA.id) === court ? 1 : 0) + (previousCourtByTeam.get(match.teamB.id) === court ? 1 : 0);
        if (penalty < bestScore) {
          bestScore = penalty;
          bestIdx = i;
          if (penalty === 0) break;
        }
      }
      if (bestIdx === -1) continue;
      const selected = candidates.splice(bestIdx, 1)[0];
      usedTeams.add(selected.teamA.id);
      usedTeams.add(selected.teamB.id);
      previousCourtByTeam.set(selected.teamA.id, court);
      previousCourtByTeam.set(selected.teamB.id, court);
      roundMatches.push({ ...selected, court });
    }

    if (!roundMatches.length) {
      const fallback = remaining.splice(0, Math.min(courtCount, remaining.length)).map((m, idx) => ({ ...m, court: idx + 1 }));
      rounds.push(buildRound(roundIndex, startTime, matchMinutes, transitionMinutes, fallback));
      remaining = remaining.filter(m => !fallback.some(f => f.id === m.id));
      roundIndex++;
      continue;
    }

    rounds.push(buildRound(roundIndex, startTime, matchMinutes, transitionMinutes, roundMatches));
    remaining = remaining.filter(match => !roundMatches.some(rm => rm.id === match.id));
    roundIndex++;
  }

  return rounds;
}

function buildRound(index, startTime, matchMinutes, transitionMinutes, matches) {
  const startTotal = timeToMinutes(startTime) + index * (matchMinutes + transitionMinutes);
  const endTotal = startTotal + matchMinutes;
  return {
    id: uid('round'),
    startTime: minutesToTime(startTotal),
    endTime: minutesToTime(endTotal),
    matches
  };
}

function updateMatchResult(tournamentId, matchId, gamesA, gamesB, updatedBy) {
  const tournament = state.tournaments.find(t => t.id === tournamentId);
  if (!tournament) return false;
  const match = tournament.matches.find(m => m.id === matchId);
  if (!match) return false;
  const allowedPlayers = [...match.teamA.players, ...match.teamB.players].map(p => p.name);
  if (!allowedPlayers.includes(updatedBy)) {
    toast('Only one of the 4 players can enter the result.', 'error');
    return false;
  }
  if (Number(gamesA) === Number(gamesB)) {
    toast('Tie score is not allowed.', 'error');
    return false;
  }
  match.gamesA = Number(gamesA);
  match.gamesB = Number(gamesB);
  match.lastUpdatedBy = updatedBy;
  match.status = 'Completed';

  tournament.rounds.forEach(round => {
    round.matches = round.matches.map(item => item.id === match.id ? { ...item, ...match } : item);
  });

  saveAndRender();
  toast('Result saved.', 'success');
  return true;
}

function computeStandings(tournament) {
  if (!tournament.teams?.length) return [];
  const standings = Object.fromEntries(tournament.teams.map(team => [team.id, {
    teamName: team.name, played: 0, wins: 0, losses: 0, gamesWon: 0, gamesLost: 0, diff: 0
  }]));

  (tournament.matches || []).forEach(match => {
    if (match.status !== 'Completed') return;
    const a = standings[match.teamA.id];
    const b = standings[match.teamB.id];
    const ga = Number(match.gamesA);
    const gb = Number(match.gamesB);
    a.played++; b.played++;
    a.gamesWon += ga; a.gamesLost += gb;
    b.gamesWon += gb; b.gamesLost += ga;
    if (ga > gb) { a.wins++; b.losses++; }
    if (gb > ga) { b.wins++; a.losses++; }
  });

  return Object.values(standings)
    .map(row => ({ ...row, diff: row.gamesWon - row.gamesLost }))
    .sort((x, y) => y.wins - x.wins || y.diff - x.diff || y.gamesWon - x.gamesWon || x.teamName.localeCompare(y.teamName))
    .map((row, idx) => ({ ...row, rank: idx + 1 }));
}

function ensureModalClosed() {
  els.modalOverlay.hidden = true;
  els.modalOverlay.setAttribute('aria-hidden', 'true');
  els.modalOverlay.classList.remove('is-open');
  els.modalOverlay.style.display = 'none';
  els.modalCard.innerHTML = '';
}

function openModal(html) {
  els.modalCard.innerHTML = html;
  els.modalOverlay.hidden = false;
  els.modalOverlay.setAttribute('aria-hidden', 'false');
  els.modalOverlay.classList.add('is-open');
  els.modalOverlay.style.display = 'grid';
  els.modalOverlay.querySelectorAll('[data-close-modal]').forEach(btn => btn.addEventListener('click', closeModal));
  els.modalOverlay.addEventListener('click', overlayCloseHandler);
}

function overlayCloseHandler(e) {
  if (e.target === els.modalOverlay) closeModal();
}

function closeModal() {
  ensureModalClosed();
  els.modalOverlay.removeEventListener('click', overlayCloseHandler);
}

function applyTemporaryTooltips() {
  const tips = [
    ['#seedDemoBtn', 'Временно: загрузить демонстрационные данные для быстрого просмотра системы.'],
    ['#resetAllBtn', 'Временно: полностью сбросить локальные данные приложения.'],
    ['#newTournamentBtn', 'Временно: создать новый турнир.'],
    ['#addClubPlayerBtn', 'Временно: добавить нового игрока в базу клуба.'],
    ['#historyToggleBtn', 'Временно: показать или скрыть историю турниров.'],
    ['#editTournamentBtn', 'Временно: редактировать параметры выбранного турнира.'],
    ['#joinFromClubBtn', 'Временно: добавить в турнир игроков из базы клуба.'],
    ['#generateBtn', 'Временно: автоматически сформировать пары, расписание и матчи турнира.'],
    ['[data-screen="tournaments"]', 'Временно: открыть раздел управления турнирами.'],
    ['[data-screen="club"]', 'Временно: открыть базу игроков клуба.'],
    ['[data-detail-tab="overview"]', 'Временно: открыть краткий обзор турнира.'],
    ['[data-detail-tab="players"]', 'Временно: открыть список участников турнира.'],
    ['[data-detail-tab="schedule"]', 'Временно: открыть расписание матчей по времени и кортам.'],
    ['[data-detail-tab="standings"]', 'Временно: открыть live-таблицу результатов.']
  ];

  tips.forEach(([selector, text]) => {
    document.querySelectorAll(selector).forEach(el => {
      el.dataset.tooltip = text;
      el.setAttribute('aria-label', text);
    });
  });
}

function seedDemo() {
  state = structuredClone(initialState);
  const more = [
    ['Aleksejs', 'Advanced'], ['Olga', 'Intermediate'], ['David', 'Advanced'], ['Simona', 'Intermediate'],
    ['Nadja', 'Intermediate'], ['Emils', 'Intermediate'], ['Lena', 'Beginner'], ['Juris', 'Intermediate'],
    ['Daina', 'Intermediate'], ['Liga', 'Beginner'], ['Marta', 'Advanced'], ['Andris', 'Intermediate']
  ].map((row, idx) => ({
    id: `dp${idx + 10}`,
    name: row[0], contact: `+371 2999${String(idx).padStart(4, '0')}`,
    level: row[1], status: 'Approved', createdAt: new Date().toISOString()
  }));
  state.clubPlayers.push(...more);
  const t = state.tournaments[0];
  state.clubPlayers.filter(p => p.status === 'Approved').slice(0, 14).forEach((player, idx) => {
    t.registrations.push({ playerId: player.id, status: 'Joined', joinedAt: new Date(Date.now() + idx * 1000).toISOString() });
  });
  normalizeTournamentRegistrations(t);
  state.ui.selectedTournamentId = t.id;
  state.ui.screen = 'tournaments';
  state.ui.detailTab = 'players';
  saveAndRender();
  toast('Demo data loaded.', 'success');
}

function resetAll() {
  if (!confirm('Reset all local data?')) return;
  localStorage.removeItem(STORAGE_KEY);
  state = structuredClone(initialState);
  saveAndRender();
  toast('All data reset.', 'success');
}

function exportClubPlayers() {
  const blob = new Blob([JSON.stringify(state.clubPlayers, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'club-players.json';
  a.click();
  URL.revokeObjectURL(url);
  toast('Club players exported.', 'success');
}

function isDuplicateClubPlayer(name, contact) {
  return state.clubPlayers.some(p => p.name.toLowerCase() === name.toLowerCase() && p.contact.toLowerCase() === contact.toLowerCase());
}

function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function timeToMinutes(t) {
  const [h, m] = t.split(':').map(Number);
  return h * 60 + m;
}

function minutesToTime(total) {
  const h = Math.floor(total / 60) % 24;
  const m = total % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

function formatDate(date) {
  try {
    return new Intl.DateTimeFormat('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }).format(new Date(date));
  } catch {
    return date;
  }
}

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

function escapeHtml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function toast(message, type = 'default') {
  const el = document.createElement('div');
  el.className = `toast ${type === 'success' ? 'success' : ''}`;
  el.textContent = message;
  els.toastStack.appendChild(el);
  setTimeout(() => el.remove(), 2600);
}
