const SUPABASE_URL = 'https://ybscycueqcnnettvahaa.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_yZs5Wnf9ceV0cS0tTyeXQg_WVstbQW5';

const sbClient = window.supabase?.createClient
  ? window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY)
  : null;

async function testSupabaseConnection() {
  if (!sbClient) {
    console.error('Supabase client was not created. Check CDN script loading.');
    return;
  }

  const { data, error } = await sbClient
    .from('tournaments')
    .select('*')
    .limit(1);

  if (error) {
    console.error('Supabase connection error:', error);
  } else {
    console.log('Supabase connected successfully:', data);
  }
}

testSupabaseConnection();

const STORAGE_KEY = 'padel-club-v15_2';
const UI_STORAGE_KEY = 'padel-club-ui-v1';
const DETAIL_TABS = ['overview', 'players', 'schedule', 'standings'];
const DURATIONS = [1.5, 2, 3];
const REALTIME_DEBOUNCE_MS = 250;

let realtimeChannel = null;
let realtimeSyncTimer = null;
let realtimeReady = false;
let realtimeInitStarted = false;
let realtimeSyncInFlight = false;
let realtimeSyncQueued = false;

const initialState = {
  ui: {
    screen: 'tournaments',
    selectedTournamentId: 't1',
    detailTab: 'overview',
    showHistory: false,
    clubSearch: '',
    clubStatusFilter: 'all',
    role: 'admin'
  },
  clubPlayers: [
    { id: 'p1', name: 'Nikolaj', contact: '+371 20000001', level: 'Intermediate', status: 'Pending', createdAt: '2026-03-01T10:00:00Z' },
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
refreshAllTournamentRegistrations(false);

async function loadClubPlayersFromSupabase() {
  if (!sbClient) {
    console.error('Supabase client is unavailable. Club players will stay local.');
    return [];
  }

  const { data, error } = await sbClient
    .from('clubplayers')
    .select('*')
    .order('created_at', { ascending: true });

  if (error) {
    console.error('Error loading club players from Supabase:', error);
    return [];
  }

  console.log('Club players loaded from Supabase:', data);
  return data || [];
}

async function loadTournamentsFromSupabase() {
  if (!sbClient) {
    console.error('Supabase client is unavailable. Tournaments will stay local.');
    return [];
  }

  const { data, error } = await sbClient
    .from('tournaments')
    .select('*')
    .order('date', { ascending: true });

  if (error) {
    console.error('Error loading tournaments from Supabase:', error);
    return [];
  }

  console.log('Tournaments loaded from Supabase:', data);
  return data || [];
}

async function loadRegistrationsFromSupabase() {
  if (!sbClient) {
    console.error('Supabase client is unavailable. Registrations will stay local.');
    return [];
  }

  const { data, error } = await sbClient
    .from('registrations')
    .select('*')
    .order('joinedat', { ascending: true });

  if (error) {
    console.error('Error loading registrations from Supabase:', error);
    return [];
  }

  console.log('Registrations loaded from Supabase:', data);
  return data || [];
}

function mapSupabasePlayer(row) {
  return {
    id: row.id,
    name: row.name || 'Unnamed player',
    contact: row.contact || '',
    level: row.level || 'Intermediate',
    status: row.status || 'Pending',
    createdAt: row.created_at || new Date().toISOString()
  };
}

function mapSupabaseTournament(row) {
  const rawStartTime = row.starttime || row.startTime || '';
  const normalizedStartTime = typeof rawStartTime === 'string' ? rawStartTime.slice(0, 5) : '';
  const durationMinutes = Number(row.duration || 0);
  const durationHours = durationMinutes > 0 ? durationMinutes / 60 : 2;
  const runtimeState = row.runtime_state || {};

  return {
    id: row.id,
    name: row.name || 'Untitled tournament',
    date: row.date || '',
    location: row.location || '',
    startTime: normalizedStartTime,
    durationHours,
    status: row.status || 'Open',
    registrations: [],
    teams: Array.isArray(runtimeState.teams) ? runtimeState.teams : [],
    rounds: Array.isArray(runtimeState.rounds) ? runtimeState.rounds : [],
    matches: Array.isArray(runtimeState.matches) ? runtimeState.matches : []
  };
}

function mapSupabaseRegistration(row) {
  return {
    id: row.id,
    playerId: row.playerid,
    tournamentId: row.tournamentid,
    status: row.status || 'Joined',
    joinedAt: row.joinedat || new Date().toISOString()
  };
}

function serializeTournamentRuntime(tournament) {
  return {
    teams: Array.isArray(tournament?.teams) ? tournament.teams : [],
    rounds: Array.isArray(tournament?.rounds) ? tournament.rounds : [],
    matches: Array.isArray(tournament?.matches) ? tournament.matches : []
  };
}

function clearTournamentRuntime(tournament) {
  if (!tournament) return;
  tournament.teams = [];
  tournament.rounds = [];
  tournament.matches = [];
  if (tournament.status === 'Live') {
    tournament.status = 'Open';
  }
}

async function saveTournamentRuntimeToSupabase(tournament) {
  if (!sbClient || !tournament?.id) return;

  const { error } = await sbClient
    .from('tournaments')
    .update({
      status: tournament.status,
      runtime_state: serializeTournamentRuntime(tournament)
    })
    .eq('id', tournament.id);

  if (error) throw error;
}

async function syncCoreDataFromSupabase() {
  const [remotePlayers, remoteTournaments, remoteRegistrations] = await Promise.all([
    loadClubPlayersFromSupabase(),
    loadTournamentsFromSupabase(),
    loadRegistrationsFromSupabase()
  ]);

  if (remotePlayers.length) {
    state.clubPlayers = remotePlayers.map(mapSupabasePlayer);
  } else {
    state.clubPlayers = [];
  }

  const tournamentsById = new Map(
    remoteTournaments.map(row => {
      const tournament = mapSupabaseTournament(row);
      return [tournament.id, tournament];
    })
  );

  remoteRegistrations
    .map(mapSupabaseRegistration)
    .forEach(reg => {
      const tournament = tournamentsById.get(reg.tournamentId);
      if (!tournament) return;
      tournament.registrations.push({
        id: reg.id,
        playerId: reg.playerId,
        status: reg.status,
        joinedAt: reg.joinedAt
      });
    });

  state.tournaments = Array.from(tournamentsById.values());
  refreshAllTournamentRegistrations(false);

  const currentSelectedExists = state.tournaments.some(t => t.id === state.ui.selectedTournamentId);
  if (!currentSelectedExists) {
    state.ui.selectedTournamentId = state.tournaments[0]?.id || null;
  }

  saveState();
}


function queueRealtimeSync(reason = 'db_change') {
  if (!sbClient) return;

  if (realtimeSyncTimer) {
    clearTimeout(realtimeSyncTimer);
  }

  realtimeSyncTimer = setTimeout(async () => {
    if (realtimeSyncInFlight) {
      realtimeSyncQueued = true;
      return;
    }

    realtimeSyncInFlight = true;

    try {
      console.log('Realtime sync started:', reason);
      await syncCoreDataFromSupabase();
      render();
    } catch (error) {
      console.error('Realtime sync error:', error);
    } finally {
      realtimeSyncInFlight = false;
      if (realtimeSyncQueued) {
        realtimeSyncQueued = false;
        queueRealtimeSync('queued_followup');
      }
    }
  }, REALTIME_DEBOUNCE_MS);
}

function handleRealtimePayload(payload) {
  console.log('Realtime change received:', payload);
  queueRealtimeSync(payload?.table || payload?.eventType || 'unknown_change');
}

function initRealtime() {
  if (!sbClient || realtimeInitStarted) return;
  realtimeInitStarted = true;

  realtimeChannel = sbClient
    .channel('padel-club-core-realtime')
    .on('postgres_changes', { event: '*', schema: 'public', table: 'clubplayers' }, handleRealtimePayload)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'tournaments' }, handleRealtimePayload)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'registrations' }, handleRealtimePayload)
    .subscribe((status) => {
      console.log('Supabase realtime status:', status);
      if (status === 'SUBSCRIBED') {
        realtimeReady = true;
        toast('Realtime connected.', 'success');
      }
      if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT' || status === 'CLOSED') {
        realtimeReady = false;
      }
    });
}

async function cleanupRealtime() {
  if (!sbClient || !realtimeChannel) return;
  try {
    await sbClient.removeChannel(realtimeChannel);
  } catch (error) {
    console.warn('Realtime cleanup warning:', error);
  } finally {
    realtimeChannel = null;
    realtimeReady = false;
  }
}

window.addEventListener('beforeunload', cleanupRealtime);

async function createTournamentInSupabase(payload) {
  const { data, error } = await sbClient
    .from('tournaments')
    .insert({
      name: payload.name,
      date: payload.date,
      location: payload.location,
      starttime: payload.startTime,
      duration: Math.round(Number(payload.durationHours || 2) * 60),
      status: payload.status
    })
    .select()
    .single();

  if (error) throw error;
  return mapSupabaseTournament(data);
}

async function updateTournamentInSupabase(payload) {
  const { data, error } = await sbClient
    .from('tournaments')
    .update({
      name: payload.name,
      date: payload.date,
      location: payload.location,
      starttime: payload.startTime,
      duration: Math.round(Number(payload.durationHours || 2) * 60),
      status: payload.status
    })
    .eq('id', payload.id)
    .select()
    .single();

  if (error) throw error;
  return mapSupabaseTournament(data);
}

async function deleteTournamentInSupabase(tournamentId) {
  const { error } = await sbClient
    .from('tournaments')
    .delete()
    .eq('id', tournamentId);

  if (error) throw error;
}

async function createClubPlayerInSupabase(payload) {
  const { data, error } = await sbClient
    .from('clubplayers')
    .insert({
      name: payload.name,
      contact: payload.contact,
      level: payload.level,
      status: payload.status
    })
    .select()
    .single();

  if (error) throw error;
  return mapSupabasePlayer(data);
}

async function updateClubPlayerStatusInSupabase(playerId, newStatus) {
  const { data, error } = await sbClient
    .from('clubplayers')
    .update({ status: newStatus })
    .eq('id', playerId)
    .select()
    .single();

  if (error) throw error;
  return mapSupabasePlayer(data);
}

async function createRegistrationInSupabase(tournamentId, playerId) {
  const { data, error } = await sbClient
    .from('registrations')
    .insert({
      playerid: playerId,
      tournamentid: tournamentId,
      status: 'Joined',
      joinedat: new Date().toISOString()
    })
    .select()
    .single();

  if (error) throw error;
  return mapSupabaseRegistration(data);
}

async function updateRegistrationInSupabase(registrationId, patch) {
  const dbPatch = {};
  if (patch.status !== undefined) dbPatch.status = patch.status;
  if (patch.joinedAt !== undefined) dbPatch.joinedat = patch.joinedAt;

  const { data, error } = await sbClient
    .from('registrations')
    .update(dbPatch)
    .eq('id', registrationId)
    .select()
    .single();

  if (error) throw error;
  return mapSupabaseRegistration(data);
}


function getFriendlySupabaseError(error, fallbackMessage = 'Supabase error') {
  const rawMessage = String(error?.message || error?.details || error?.hint || fallbackMessage).trim();
  const lower = rawMessage.toLowerCase();

  if (lower.includes('row-level security') || lower.includes('new row violates row-level security policy') || lower.includes('permission denied')) {
    return 'Supabase blocks write access. Most likely RLS/policies are not configured yet.';
  }

  if (lower.includes('invalid input syntax')) {
    return `Supabase rejected the data format: ${rawMessage}`;
  }

  if (lower.includes('violates check constraint')) {
    return `Supabase rejected one of the status values: ${rawMessage}`;
  }

  return rawMessage || fallbackMessage;
}

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
  roleSwitcher: document.getElementById('roleSwitcher')
};

bindEvents();
ensureModalClosed();
initApp();

function loadState() {
  try {
    const raw = localStorage.getItem(UI_STORAGE_KEY) || localStorage.getItem(STORAGE_KEY);
    const localState = raw ? JSON.parse(raw) : {};
    return {
      ...structuredClone(initialState),
      ...localState,
      ui: {
        ...structuredClone(initialState.ui),
        ...(localState?.ui || {})
      }
    };
  } catch {
    return structuredClone(initialState);
  }
}

async function initApp() {
  await syncCoreDataFromSupabase();
  initRealtime();
  render();
}

function saveState() {
  const stateToPersist = {
    ui: state.ui
  };
  localStorage.setItem(UI_STORAGE_KEY, JSON.stringify(stateToPersist));
}

function ensureStateShape() {
  state.ui ??= structuredClone(initialState.ui);
  state.ui.role ??= 'admin';
  state.clubPlayers ??= [];
  state.tournaments ??= [];
}

function uid(prefix = 'id') {
  return `${prefix}_${Math.random().toString(36).slice(2, 9)}`;
}

function getCurrentRole() {
  return state.ui?.role || 'admin';
}

function canEditClub() {
  return getCurrentRole() === 'admin';
}

function canManageTournaments() {
  return ['admin', 'operator'].includes(getCurrentRole());
}

function canEnterResults() {
  return ['admin', 'operator'].includes(getCurrentRole());
}

function guardPermission(check, message = 'This action is not allowed for the current role.') {
  if (check()) return true;
  toast(message, 'error');
  return false;
}

function capitalize(value) {
  return String(value || '').charAt(0).toUpperCase() + String(value || '').slice(1);
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
  });

  document.addEventListener('click', (e) => {
    const btn = e.target.closest('[data-detail-tab]');
    if (!btn) return;
    state.ui.detailTab = btn.dataset.detailTab;
    saveAndRender();
  });

  els.historyToggleBtn.addEventListener('click', () => {
    state.ui.showHistory = !state.ui.showHistory;
    saveAndRender();
  });

  els.newTournamentBtn?.addEventListener('click', () => openTournamentModal());
  els.addClubPlayerBtn?.addEventListener('click', openClubPlayerModal);

  els.roleSwitcher?.addEventListener('click', (e) => {
    const btn = e.target.closest('[data-role]');
    if (!btn) return;
    state.ui.role = btn.dataset.role;
    closeModal();
    saveAndRender();
    toast(`Role: ${capitalize(state.ui.role)}`, 'success');
  });

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
  const allRegs = [...(tournament.registrations || [])].sort((a, b) => new Date(a.joinedAt) - new Date(b.joinedAt));

  const activeRegs = allRegs.filter(r => r.status !== 'Withdrawn');
  const withdrawnRegs = allRegs.filter(r => r.status === 'Withdrawn');

  const joinedPlayers = activeRegs
    .map(reg => ({ ...getClubPlayer(reg.playerId), registrationStatus: reg.status, joinedAt: reg.joinedAt }))
    .filter(Boolean);

  const withdrawnPlayers = withdrawnRegs
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

function refreshAllTournamentRegistrations(shouldSave = true) {
  state.tournaments.forEach(t => normalizeTournamentRegistrations(t));
  if (shouldSave) saveState();
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
  try {
    renderScreens();
    renderGlobalTabs();
    renderTournamentList();
    renderRoleControls();
    renderTournamentDetails();
    renderClubPlayers();
    applyTemporaryTooltips();
  } catch (error) {
    console.error('Render error:', error);
    els.selectedTournamentHero.innerHTML = '<div class="empty">Rendering issue. Reload the page.</div>';
  }
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

function renderRoleControls() {
  els.roleSwitcher?.querySelectorAll('[data-role]').forEach(btn => {
    btn.classList.toggle('is-active', btn.dataset.role === getCurrentRole());
  });

  const clubLocked = !canEditClub();
  const tournamentLocked = !canManageTournaments();

  els.addClubPlayerBtn?.classList.toggle('is-disabled', clubLocked);
  if (els.addClubPlayerBtn) els.addClubPlayerBtn.disabled = clubLocked;

  els.newTournamentBtn?.classList.toggle('is-disabled', tournamentLocked);
  if (els.newTournamentBtn) els.newTournamentBtn.disabled = tournamentLocked;
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
        <span class="role-badge">${capitalize(getCurrentRole())}</span>
        ${canManageTournaments()
          ? `<button class="btn ghost" id="editTournamentBtn">Edit</button>
             <button class="btn secondary" id="joinFromClubBtn">Add from Club</button>
             <button class="btn primary" id="generateBtn">Generate</button>`
          : `<span class="readonly-note">Read only access</span>`}
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

  if (canManageTournaments()) {
    document.getElementById('joinFromClubBtn')?.addEventListener('click', () => openAddFromClubModal(tournament.id));
    document.getElementById('generateBtn')?.addEventListener('click', () => generateTournament(tournament.id));
    document.getElementById('editTournamentBtn')?.addEventListener('click', () => openTournamentModal(tournament));
  }

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
  const canManage = canManageTournaments();
  const map = {
    Joined: { badge: 'badge-main', action: canManage ? `<button class="btn ghost" data-withdraw-player="${player.id}" data-tournament="${tournamentId}">Move out</button>` : '' },
    Waitlist: { badge: 'badge-wait', action: canManage ? `<button class="btn ghost" data-withdraw-player="${player.id}" data-tournament="${tournamentId}">Withdraw</button>` : '' },
    Withdrawn: { badge: 'badge-withdrawn', action: canManage ? `<button class="btn ghost" data-restore-player="${player.id}" data-tournament="${tournamentId}">Restore</button>` : '' }
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
        ${canEnterResults() ? `<button class="btn primary" type="button" data-open-result="${match.id}">${match.status === 'Completed' ? 'Edit result' : 'Enter result'}</button>` : ''}
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
      ${canEditClub() ? `<button class="btn secondary" id="importClubBtn">Import players</button>` : ''}
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
            ${canEditClub() && player.status !== 'Approved' ? `<button class="btn secondary" data-set-status="Approved" data-player-id="${player.id}">Approve</button>` : ''}
            ${canEditClub() && player.status !== 'Blocked' ? `<button class="btn ghost" data-set-status="Blocked" data-player-id="${player.id}">Block</button>` : ''}
            ${canEditClub() && player.status !== 'Pending' ? `<button class="btn ghost" data-set-status="Pending" data-player-id="${player.id}">Reset</button>` : ''}
            ${!canEditClub() ? `<span class="readonly-note compact">Read only</span>` : ''}
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
  if (!guardPermission(canManageTournaments, 'Only Admin or Operator can manage tournaments.')) return;
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

  document.getElementById('tournamentForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const fd = new FormData(e.target);
    const date = String(fd.get('date'));
    if (date < todayISO() && !isEdit) {
      toast('Date cannot be in the past.', 'error');
      return;
    }

    const payload = {
      id: tournament?.id,
      name: String(fd.get('name')).trim(),
      location: String(fd.get('location')).trim(),
      date,
      startTime: String(fd.get('startTime')),
      durationHours: Number(fd.get('durationHours')),
      status: String(fd.get('status'))
    };

    try {
      if (isEdit) {
        const updatedTournament = await updateTournamentInSupabase(payload);
        updatedTournament.registrations = tournament.registrations || [];
        updatedTournament.rounds = tournament.rounds || [];
        updatedTournament.matches = tournament.matches || [];
        updatedTournament.teams = tournament.teams || [];
        const index = state.tournaments.findIndex(item => item.id === tournament.id);
        if (index >= 0) state.tournaments[index] = updatedTournament;
        if (updatedTournament.matches?.length && updatedTournament.status !== 'Finished') {
          clearTournamentRuntime(updatedTournament);
        }
        await saveTournamentRuntimeToSupabase(updatedTournament);
        toast('Tournament updated.', 'success');
      } else {
        const nextTournament = await createTournamentInSupabase(payload);
        state.tournaments.unshift(nextTournament);
        state.ui.selectedTournamentId = nextTournament.id;
        state.ui.screen = 'tournaments';
        toast('Tournament created.', 'success');
      }
      closeModal();
      saveAndRender();
    } catch (error) {
      console.error('Tournament save error:', error);
      toast(getFriendlySupabaseError(error, 'Could not save tournament to Supabase.'), 'error');
    }
  });

  document.getElementById('deleteTournamentBtn')?.addEventListener('click', async () => {
    if (!confirm('Delete this tournament?')) return;
    try {
      await deleteTournamentInSupabase(tournament.id);
      state.tournaments = state.tournaments.filter(item => item.id !== tournament.id);
      state.ui.selectedTournamentId = state.tournaments[0]?.id || null;
      closeModal();
      saveAndRender();
      toast('Tournament deleted.', 'success');
    } catch (error) {
      console.error('Tournament delete error:', error);
      toast(getFriendlySupabaseError(error, 'Could not delete tournament from Supabase.'), 'error');
    }
  });
}

function openClubPlayerModal() {
  if (!guardPermission(canEditClub, 'Only Admin can manage club players.')) return;
  openModal(`
    <div class="modal-head">
      <div>
        <div class="modal-title">Add club player</div>
        <div class="section-subtitle">New players enter the club as Pending and need approval</div>
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

  document.getElementById('clubPlayerForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const fd = new FormData(e.target);
    const name = String(fd.get('name')).trim();
    const contact = String(fd.get('contact')).trim();
    if (isDuplicateClubPlayer(name, contact)) {
      toast('Duplicate player.', 'error');
      return;
    }
    try {
      const createdPlayer = await createClubPlayerInSupabase({
        name,
        contact,
        level: String(fd.get('level')),
        status: 'Pending'
      });
      state.clubPlayers.unshift(createdPlayer);
      closeModal();
      saveAndRender();
      toast('Club player added.', 'success');
    } catch (error) {
      console.error('Club player save error:', error);
      toast(getFriendlySupabaseError(error, 'Could not save player to Supabase.'), 'error');
    }
  });
}

function openImportPlayersModal() {
  if (!guardPermission(canEditClub, 'Only Admin can import club players.')) return;
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

  document.getElementById('importPlayersForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const raw = String(new FormData(e.target).get('rows') || '');
    const rows = raw.split(/\r?\n/).map(line => line.trim()).filter(Boolean);
    if (!rows.length) {
      toast('Nothing to import.', 'error');
      return;
    }

    let imported = 0;
    let skipped = 0;

    for (const [index, row] of rows.entries()) {
      const parts = row.split(/[;,\t]/).map(x => x.trim()).filter(Boolean);
      if (!parts.length) continue;
      if (index === 0 && /name/i.test(parts[0])) continue;
      const [name, contact = '', level = 'Intermediate', status = 'Pending'] = parts;
      if (!name || !contact || isDuplicateClubPlayer(name, contact)) {
        skipped += 1;
        continue;
      }

      const normalizedStatus = ['Approved', 'Pending', 'Blocked'].includes(status) ? status : 'Pending';
      try {
        const createdPlayer = await createClubPlayerInSupabase({
          name,
          contact,
          level: ['Beginner', 'Intermediate', 'Advanced'].includes(level) ? level : 'Intermediate',
          status: normalizedStatus
        });
        state.clubPlayers.push(createdPlayer);
        imported += 1;
      } catch (error) {
        console.error('Club player import error:', error);
        skipped += 1;
      }
    }

    state.tournaments.forEach(normalizeTournamentRegistrations);
    closeModal();
    saveAndRender();
    toast(`Imported ${imported}, skipped ${skipped}.`, imported ? 'success' : 'error');
  });
}

function openAddFromClubModal(tournamentId) {
  if (!guardPermission(canManageTournaments, 'Only Admin or Operator can manage tournament players.')) return;
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
  if (!guardPermission(canEnterResults, 'Only Admin or Operator can enter results.')) return;
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

  document.getElementById('resultModalForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const fd = new FormData(e.target);
    const ok = await updateMatchResult(tournamentId, matchId, fd.get('gamesA'), fd.get('gamesB'), fd.get('updatedBy'));
    if (ok) closeModal();
  });
}

async function addPlayerToTournament(tournamentId, playerId) {
  if (!guardPermission(canManageTournaments, 'Only Admin or Operator can add players to tournaments.')) return;
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

  try {
    const createdRegistration = await createRegistrationInSupabase(tournamentId, playerId);
    tournament.registrations.push({
      id: createdRegistration.id,
      playerId,
      status: createdRegistration.status,
      joinedAt: createdRegistration.joinedAt
    });
    normalizeTournamentRegistrations(tournament);

    if (tournament.matches?.length) {
      clearTournamentRuntime(tournament);
      await saveTournamentRuntimeToSupabase(tournament);
    }

    const updatedRegs = tournament.registrations.filter(r => r.id);
    await Promise.all(updatedRegs.map(reg => updateRegistrationInSupabase(reg.id, {
      status: reg.status,
      joinedAt: reg.joinedAt
    })));

    saveAndRender();
    toast('Player added to tournament.', 'success');
  } catch (error) {
    console.error('Registration create error:', error);
    toast('Could not add player to tournament.', 'error');
  }
}

async function withdrawPlayer(tournamentId, playerId) {
  if (!guardPermission(canManageTournaments, 'Only Admin or Operator can change participation status.')) return;
  const tournament = state.tournaments.find(t => t.id === tournamentId);
  if (!tournament) return;
  const reg = (tournament.registrations || []).find(r => r.playerId === playerId);
  if (!reg?.id) return;

  try {
    const updatedRegistration = await updateRegistrationInSupabase(reg.id, { status: 'Withdrawn' });
    reg.status = updatedRegistration.status;
    normalizeTournamentRegistrations(tournament);

    if (tournament.matches?.length) {
      clearTournamentRuntime(tournament);
      await saveTournamentRuntimeToSupabase(tournament);
    }

    saveAndRender();
    toast('Player moved to withdrawn.', 'success');
  } catch (error) {
    console.error('Registration withdraw error:', error);
    toast('Could not update registration.', 'error');
  }
}

async function restorePlayer(tournamentId, playerId) {
  if (!guardPermission(canManageTournaments, 'Only Admin or Operator can change participation status.')) return;
  const tournament = state.tournaments.find(t => t.id === tournamentId);
  const player = getClubPlayer(playerId);
  if (!tournament) return;
  if (!player || player.status !== 'Approved') {
    toast('Only approved players can be restored to active tournament lists.', 'error');
    return;
  }
  const reg = (tournament.registrations || []).find(r => r.playerId === playerId);
  if (!reg?.id) return;

  try {
    const updatedRegistration = await updateRegistrationInSupabase(reg.id, {
      status: 'Waitlist',
      joinedAt: new Date().toISOString()
    });
    reg.status = updatedRegistration.status;
    reg.joinedAt = updatedRegistration.joinedAt;
    normalizeTournamentRegistrations(tournament);

    if (tournament.matches?.length) {
      clearTournamentRuntime(tournament);
      await saveTournamentRuntimeToSupabase(tournament);
    }

    const updatedRegs = tournament.registrations.filter(r => r.id);
    await Promise.all(updatedRegs.map(item => updateRegistrationInSupabase(item.id, {
      status: item.status,
      joinedAt: item.joinedAt
    })));

    saveAndRender();
    toast('Player restored to active list.', 'success');
  } catch (error) {
    console.error('Registration restore error:', error);
    toast('Could not restore registration.', 'error');
  }
}

async function setClubPlayerStatus(playerId, newStatus) {
  if (!guardPermission(canEditClub, 'Only Admin can change club player status.')) return;
  const player = getClubPlayer(playerId);
  if (!player) return;

  try {
    const updatedPlayer = await updateClubPlayerStatusInSupabase(playerId, newStatus);
    Object.assign(player, updatedPlayer);

    let removedFromTournaments = 0;

    if (newStatus !== 'Approved') {
      for (const tournament of state.tournaments) {
        const registration = (tournament.registrations || []).find(reg => reg.playerId === playerId && reg.status !== 'Withdrawn');
        if (!registration?.id) continue;

        const updatedRegistration = await updateRegistrationInSupabase(registration.id, { status: 'Withdrawn' });
        registration.status = updatedRegistration.status;
        registration.joinedAt = updatedRegistration.joinedAt;
        removedFromTournaments += 1;

        normalizeTournamentRegistrations(tournament);

        if (tournament.matches?.length) {
          clearTournamentRuntime(tournament);
          await saveTournamentRuntimeToSupabase(tournament);
        }
      }
    } else {
      state.tournaments.forEach(normalizeTournamentRegistrations);
    }

    saveAndRender();

    if (removedFromTournaments > 0) {
      toast(`Player status: ${newStatus}. Removed from ${removedFromTournaments} tournament(s).`, 'success');
    } else {
      toast(`Player status: ${newStatus}`, 'success');
    }
  } catch (error) {
    console.error('Club player status error:', error);
    toast(getFriendlySupabaseError(error, 'Could not update player status.'), 'error');
  }
}

async function generateTournament(tournamentId) {
  if (!guardPermission(canManageTournaments, 'Only Admin or Operator can generate the tournament.')) return;
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

  try {
    await saveTournamentRuntimeToSupabase(tournament);
    saveAndRender();
    toast('Tournament generated.', 'success');
  } catch (error) {
    console.error('Tournament generation sync error:', error);
    toast(getFriendlySupabaseError(error, 'Could not save generated schedule to Supabase.'), 'error');
    saveAndRender();
  }
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

async function updateMatchResult(tournamentId, matchId, gamesA, gamesB, updatedBy) {
  if (!guardPermission(canEnterResults, 'Only Admin or Operator can save results.')) return false;
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

  if (tournament.matches.every(item => item.status === 'Completed')) {
    tournament.status = 'Finished';
  }

  try {
    await saveTournamentRuntimeToSupabase(tournament);
    saveAndRender();
    toast('Result saved.', 'success');
    return true;
  } catch (error) {
    console.error('Result sync error:', error);
    toast(getFriendlySupabaseError(error, 'Could not save result to Supabase.'), 'error');
    saveAndRender();
    return false;
  }
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
    ['#newTournamentBtn', 'Create a new tournament.'],
    ['#addClubPlayerBtn', 'Add a player to the club base.'],
    ['#historyToggleBtn', 'Show or hide older tournaments.'],
    ['#editTournamentBtn', 'Edit the selected tournament.'],
    ['#joinFromClubBtn', 'Add approved club players to the tournament.'],
    ['#generateBtn', 'Generate pairs, schedule and matches.'],
    ['[data-screen="tournaments"]', 'Open tournaments.'],
    ['[data-screen="club"]', 'Open club players.'],
    ['[data-detail-tab="overview"]', 'Open overview.'],
    ['[data-detail-tab="players"]', 'Open players.'],
    ['[data-detail-tab="schedule"]', 'Open schedule.'],
    ['[data-detail-tab="standings"]', 'Open standings.'],
    ['[data-role="admin"]', 'Full access to club and tournaments.'],
    ['[data-role="operator"]', 'Can manage tournaments and results.'],
    ['[data-role="viewer"]', 'Read-only mode.']
  ];

  tips.forEach(([selector, text]) => {
    document.querySelectorAll(selector).forEach(el => {
      el.dataset.tooltip = text;
      el.setAttribute('aria-label', text);
      el.setAttribute('title', text);
    });
  });
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
