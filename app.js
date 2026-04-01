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
const UI_STORAGE_KEY = 'padel-club-ui-v3';
const AUTH_STORAGE_KEY = 'padel-club-auth-v2';
const ROLE_CREDENTIALS = {
  admin: { username: 'admin', label: 'Admin' },
  operator: { username: 'operator', label: 'Operator' },
  viewer: { username: 'viewer', label: 'Viewer' },
  player: { username: 'player', label: 'Player' }
};
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
    scheduleView: 'rounds',
    showHistory: false,
    clubSearch: '',
    clubStatusFilter: 'all',
    playerSearch: '',
    playerScreenFilter: 'all',
    currentPlayerId: '',
    role: 'viewer',
    auth: { isAuthenticated: false, username: '', role: 'viewer' }
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

  const approvedPlayers = state.clubPlayers.filter(player => player.status === 'Approved');
  if (!approvedPlayers.some(player => player.id === state.ui.currentPlayerId)) {
    state.ui.currentPlayerId = approvedPlayers[0]?.id || '';
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
      await loadPlayerMatchesForCurrentPlayer();
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
  screenPlayerMatches: document.getElementById('screenPlayerMatches'),
  globalTabs: document.getElementById('globalTabs'),
  playerIdentitySelect: document.getElementById('playerIdentitySelect'),
  playerStatsGrid: document.getElementById('playerStatsGrid'),
  playerMatchesContent: document.getElementById('playerMatchesContent'),
  tournamentRows: document.getElementById('tournamentRows'),
  tournamentSearchInput: document.getElementById('tournamentSearchInput'),
  tournamentStatusFilter: document.getElementById('tournamentStatusFilter'),
  tournamentStatusChips: document.getElementById('tournamentStatusChips'),
  tournamentCommandSummary: document.getElementById('tournamentCommandSummary'),
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
  roleSession: document.getElementById('roleSession'),
  sessionRolePill: document.getElementById('sessionRolePill'),
  sessionUserLine: document.getElementById('sessionUserLine'),
  changeRoleBtn: document.getElementById('changeRoleBtn'),
  logoutBtn: document.getElementById('logoutBtn'),
  authOverlay: document.getElementById('authOverlay'),
  rolePickerGrid: document.getElementById('rolePickerGrid')
};

bindEvents();
bindAuthEvents();
ensureModalClosed();
updateAuthUi();
initApp();

function loadState() {
  try {
    const raw = localStorage.getItem(UI_STORAGE_KEY) || localStorage.getItem(STORAGE_KEY);
    const rawAuth = sessionStorage.getItem(AUTH_STORAGE_KEY) || localStorage.getItem(AUTH_STORAGE_KEY);
    const localState = raw ? JSON.parse(raw) : {};
    const authState = rawAuth ? JSON.parse(rawAuth) : {};
    return {
      ...structuredClone(initialState),
      ...localState,
      ui: {
        ...structuredClone(initialState.ui),
        ...(localState?.ui || {}),
        auth: {
          ...structuredClone(initialState.ui.auth),
          ...(authState || {}),
          ...(localState?.ui?.auth || {})
        }
      }
    };
  } catch {
    return structuredClone(initialState);
  }
}

async function initApp() {
  await syncCoreDataFromSupabase();
  await loadPlayerMatchesForCurrentPlayer();
  initRealtime();
  enforceRoleUi();
  updateAuthUi();
  render();
}

function saveState() {
  const stateToPersist = {
    ui: {
      ...state.ui,
      auth: {
        ...state.ui.auth,
        password: undefined
      }
    }
  };
  try {
    localStorage.setItem(UI_STORAGE_KEY, JSON.stringify(stateToPersist));
    sessionStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(state.ui.auth || {}));
  } catch (error) {
    console.warn('State persistence is unavailable in this browser/context.', error);
  }
}

function ensureStateShape() {
  state.ui ??= structuredClone(initialState.ui);
  state.ui.role ??= 'viewer';
  state.ui.auth ??= structuredClone(initialState.ui.auth);
  state.ui.auth.isAuthenticated ??= false;
  state.ui.auth.username ??= '';
  state.ui.auth.role ??= state.ui.role || 'viewer';
  state.ui.scheduleView ??= 'rounds';
  state.ui.tournamentSearch ??= '';
  state.ui.tournamentStatusFilter ??= 'all';
  state.clubPlayers ??= [];
  state.tournaments ??= [];
  enforceRoleUi();
}

function uid(prefix = 'id') {
  return `${prefix}_${Math.random().toString(36).slice(2, 9)}`;
}

function getCurrentRole() {
  if (state.ui?.auth?.isAuthenticated) {
    return state.ui?.auth?.role || state.ui?.role || 'viewer';
  }
  return 'viewer';
}


function isAuthenticated() {
  return Boolean(state.ui?.auth?.isAuthenticated);
}

function enforceRoleUi() {
  const role = getCurrentRole();
  state.ui.role = role;
  if (role === 'player') {
    state.ui.screen = 'playerMatches';
  }
  if (role !== 'admin' && state.ui.screen === 'club') {
    state.ui.screen = role === 'player' ? 'playerMatches' : 'tournaments';
  }
  if (role === 'viewer' && state.ui.detailTab === 'players') {
    state.ui.detailTab = 'overview';
  }
  if (!['rounds','results'].includes(state.ui.scheduleView)) {
    state.ui.scheduleView = 'rounds';
  }
}

function setAuthSession(role, username) {
  state.ui.auth = { isAuthenticated: true, username, role };
  state.ui.role = role;
  enforceRoleUi();
  if (els.authOverlay) {
    els.authOverlay.classList.remove('is-visible');
    els.authOverlay.setAttribute('aria-hidden', 'true');
  }
  saveState();
}

function clearAuthSession() {
  state.ui.auth = { isAuthenticated: false, username: '', role: 'viewer' };
  state.ui.role = 'viewer';
  enforceRoleUi();
  if (els.authOverlay) {
    els.authOverlay.classList.add('is-visible');
    els.authOverlay.removeAttribute('aria-hidden');
  }
  saveState();
}

function authenticateUser(role) {
  const normalized = String(role || '').trim().toLowerCase();
  if (!normalized || !ROLE_CREDENTIALS[normalized]) return null;
  return [normalized, ROLE_CREDENTIALS[normalized]];
}

function updateAuthUi() {
  const role = getCurrentRole();
  if (els.sessionRolePill) els.sessionRolePill.textContent = capitalize(role);
  if (els.sessionUserLine) {
    els.sessionUserLine.textContent = isAuthenticated() ? `${state.ui.auth.username} signed in` : 'Signed out';
  }
  if (els.authOverlay) {
    els.authOverlay.classList.toggle('is-visible', !isAuthenticated());
  }
}

function bindAuthEvents() {
  els.rolePickerGrid?.addEventListener('click', e => {
    const btn = e.target.closest('[data-login-role]');
    if (!btn) return;
    const matched = authenticateUser(btn.dataset.loginRole);
    if (!matched) {
      toast('Unknown access role.', 'error');
      return;
    }
    const [role, creds] = matched;
    setAuthSession(role, creds.label);
    updateAuthUi();
    render();
    toast(`${creds.label} workspace is ready.`, 'success');
  });

  els.changeRoleBtn?.addEventListener('click', () => {
    clearAuthSession();
    updateAuthUi();
    render();
  });

  els.logoutBtn?.addEventListener('click', () => {
    clearAuthSession();
    updateAuthUi();
    render();
    toast('You have been logged out.', 'success');
  });
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

function canUsePlayerScreen() {
  return ['admin', 'operator', 'player'].includes(getCurrentRole());
}

function getCurrentPlayerId() {
  return state.ui?.currentPlayerId || '';
}

function getCurrentPlayer() {
  return getClubPlayer(getCurrentPlayerId()) || null;
}

function guardPermission(check, message = 'This action is not allowed for the current role.') {
  if (!isAuthenticated()) {
    toast('Please sign in first.', 'error');
    updateAuthUi();
    return false;
  }
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

  els.tournamentSearchInput?.addEventListener('input', () => {
    state.ui.tournamentSearch = els.tournamentSearchInput.value;
    saveAndRender(false);
  });

  els.tournamentStatusFilter?.addEventListener('change', () => {
    state.ui.tournamentStatusFilter = els.tournamentStatusFilter.value;
    saveAndRender(false);
  });

  els.historyToggleBtn.addEventListener('click', () => {
    state.ui.showHistory = !state.ui.showHistory;
    saveAndRender();
  });

  els.newTournamentBtn?.addEventListener('click', () => openTournamentModal());
  els.addClubPlayerBtn?.addEventListener('click', openClubPlayerModal);


  els.clubSearchInput.addEventListener('input', () => {
    state.ui.clubSearch = els.clubSearchInput.value;
    saveAndRender(false);
  });
  els.clubStatusFilter.addEventListener('change', () => {
    state.ui.clubStatusFilter = els.clubStatusFilter.value;
    saveAndRender(false);
  });

  els.playerIdentitySelect?.addEventListener('change', async () => {
    state.ui.currentPlayerId = els.playerIdentitySelect.value || '';
    await loadPlayerMatchesForCurrentPlayer();
    saveAndRender(false);
  });

  document.addEventListener('keydown', (e) => {
    if (e.ctrlKey && e.key === 'Enter' && state.ui.screen === 'tournaments' && state.ui.selectedTournamentId) {
      generateTournament(state.ui.selectedTournamentId);
    }
  });
}

function saveAndRender(save = true) {
  enforceRoleUi();
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
    renderPlayerMatchesScreen();
    applyTemporaryTooltips();
  } catch (error) {
    console.error('Render error:', error);
    els.selectedTournamentHero.innerHTML = emptyStateHtml('Rendering issue', 'Reload the page to restore the workspace.', 'warning');
  }
}

function renderScreens() {
  enforceRoleUi();
  els.screenTournaments.classList.toggle('is-active', state.ui.screen === 'tournaments');
  els.screenClub.classList.toggle('is-active', state.ui.screen === 'club' && canEditClub());
  els.screenPlayerMatches.classList.toggle('is-active', state.ui.screen === 'playerMatches' && canUsePlayerScreen());
}

function renderGlobalTabs() {
  const role = getCurrentRole();
  els.globalTabs.querySelectorAll('[data-screen]').forEach(btn => {
    const screen = btn.dataset.screen;
    let allowed = true;
    if (screen === 'club') allowed = canEditClub();
    if (screen === 'playerMatches') allowed = canUsePlayerScreen();
    if (role === 'player' && screen !== 'playerMatches') allowed = false;
    btn.hidden = !allowed;
    btn.classList.toggle('is-active', allowed && screen === state.ui.screen);
  });
  els.detailTabs.querySelectorAll('[data-detail-tab]').forEach(btn => {
    const isPlayers = btn.dataset.detailTab === 'players';
    const allowed = role !== 'viewer' || !isPlayers;
    btn.hidden = !allowed;
    btn.classList.toggle('is-active', allowed && btn.dataset.detailTab === state.ui.detailTab);
  });
  DETAIL_TABS.forEach(tab => {
    const allowed = role !== 'viewer' || tab !== 'players';
    document.getElementById(`${tab}Tab`).classList.toggle('is-active', allowed && tab === state.ui.detailTab);
    document.getElementById(`${tab}Tab`).hidden = !allowed;
  });
}

function renderRoleControls() {
  updateAuthUi();
  const clubLocked = !canEditClub();
  const tournamentLocked = !canManageTournaments();

  if (els.addClubPlayerBtn) {
    els.addClubPlayerBtn.disabled = clubLocked;
    els.addClubPlayerBtn.hidden = clubLocked;
  }

  if (els.newTournamentBtn) {
    els.newTournamentBtn.disabled = tournamentLocked;
    els.newTournamentBtn.hidden = tournamentLocked;
  }

  if (els.playerIdentitySelect) {
    const approvedPlayers = state.clubPlayers.filter(player => player.status === 'Approved');
    if (!state.ui.currentPlayerId && approvedPlayers.length) {
      state.ui.currentPlayerId = approvedPlayers[0].id;
    }
    els.playerIdentitySelect.innerHTML = `
      <option value="">Select player</option>
      ${approvedPlayers.map(player => `<option value="${player.id}" ${player.id === state.ui.currentPlayerId ? 'selected' : ''}>${escapeHtml(player.name)}</option>`).join('')}
    `;
  }
}


function renderTournamentList() {
  const search = String(state.ui.tournamentSearch || '').trim().toLowerCase();
  const statusFilter = state.ui.tournamentStatusFilter || 'all';
  const totals = {
    all: state.tournaments.length,
    Open: state.tournaments.filter(t => t.status === 'Open').length,
    Live: state.tournaments.filter(t => t.status === 'Live').length,
    Finished: state.tournaments.filter(t => t.status === 'Finished').length
  };

  if (els.tournamentSearchInput && els.tournamentSearchInput.value !== state.ui.tournamentSearch) {
    els.tournamentSearchInput.value = state.ui.tournamentSearch || '';
  }
  if (els.tournamentStatusFilter) {
    els.tournamentStatusFilter.value = statusFilter;
  }

  if (els.tournamentCommandSummary) {
    const liveNow = state.tournaments.find(t => t.status === 'Live');
    const selected = getSelectedTournament();
    els.tournamentCommandSummary.innerHTML = `
      <button class="command-summary-card ${statusFilter === 'all' ? 'is-active' : ''}" type="button" data-status-filter="all">
        <span class="command-summary-label">All</span>
        <strong>${totals.all}</strong>
      </button>
      <button class="command-summary-card ${statusFilter === 'Live' ? 'is-active' : ''}" type="button" data-status-filter="Live">
        <span class="command-summary-label">Live</span>
        <strong>${totals.Live}</strong>
      </button>
      <div class="command-summary-card static ${liveNow ? 'is-live' : ''}">
        <span class="command-summary-label">Now</span>
        <strong>${liveNow ? escapeHtml(liveNow.name) : 'No live event'}</strong>
      </div>
      <div class="command-summary-card static">
        <span class="command-summary-label">Selected</span>
        <strong>${selected ? escapeHtml(selected.status) : '—'}</strong>
      </div>
    `;
  }

  if (els.tournamentStatusChips) {
    const filters = [
      ['all', 'All', totals.all],
      ['Open', 'Open', totals.Open],
      ['Live', 'Live', totals.Live],
      ['Finished', 'Finished', totals.Finished]
    ];
    els.tournamentStatusChips.innerHTML = filters.map(([value, label, count]) => `
      <button class="filter-pill ${statusFilter === value ? 'is-active' : ''}" type="button" data-status-filter="${value}">
        <span>${label}</span>
        <strong>${count}</strong>
      </button>
    `).join('');
  }

  let items = [...state.tournaments];
  if (statusFilter !== 'all') {
    items = items.filter(t => t.status === statusFilter);
  }
  if (search) {
    items = items.filter(t => `${t.name} ${t.location} ${t.date}`.toLowerCase().includes(search));
  }

  if (!items.length) {
    els.tournamentRows.innerHTML = emptyStateHtml('No tournaments found', 'Try a different search or clear the status filter.');
    els.historyToggleBtn.hidden = false;
    els.historyToggleBtn.textContent = state.ui.showHistory ? 'Show less' : 'Show more';
    return;
  }

  if (!items.some(t => t.id === state.ui.selectedTournamentId)) {
    state.ui.selectedTournamentId = items[0].id;
  }

  const visible = state.ui.showHistory ? items : items.slice(0, 10);
  els.tournamentRows.innerHTML = visible.map(t => {
    const active = t.id === state.ui.selectedTournamentId ? 'is-active' : '';
    const statusClass = `status-${(t.status || 'open').toLowerCase()}`;
    const isLive = t.status === 'Live';
    const derived = getTournamentDerived(t);
    const canManage = canManageTournaments();
    return `
      <article class="tournament-command-card ${active} ${isLive ? 'is-live' : ''}">
        <button class="tournament-item tournament-item-compact tournament-command-main ${active}" type="button" data-select-tournament="${t.id}">
          <div class="tournament-item-main">
            <div class="tournament-item-top">
              <div class="tournament-name-wrap">
                <strong class="tournament-name">${escapeHtml(t.name)}</strong>
                <span class="tournament-place">${escapeHtml(t.location)}</span>
              </div>
              <span class="status-badge ${statusClass}">${escapeHtml(t.status)}</span>
            </div>
            <div class="tournament-meta-row compact compact-meta-grid">
              <span class="meta-chip">${formatDate(t.date)}</span>
              <span class="meta-chip">${escapeHtml(t.startTime)}</span>
              <span class="meta-chip">${t.durationHours}h</span>
              <span class="meta-chip">${derived.joinedPlayers.length} players</span>
              <span class="meta-chip ${isLive ? 'accent live-chip' : ''}">${isLive ? '<span class="live-dot"></span>Live now' : `${derived.totalMatches} matches`}</span>
            </div>
          </div>
        </button>
        ${canManage ? `
          <div class="tournament-quick-actions">
            <button class="quick-status-btn ${t.status === 'Open' ? 'is-current' : ''}" type="button" data-quick-status="Open" data-quick-tournament="${t.id}">Open</button>
            <button class="quick-status-btn ${t.status === 'Live' ? 'is-current' : ''} ${!t.matches?.length ? 'is-disabled' : ''}" type="button" data-quick-status="Live" data-quick-tournament="${t.id}">Live</button>
            <button class="quick-status-btn ${t.status === 'Finished' ? 'is-current' : ''} ${!t.matches?.length ? 'is-disabled' : ''}" type="button" data-quick-status="Finished" data-quick-tournament="${t.id}">Finish</button>
          </div>` : ''}
      </article>
    `;
  }).join('');

  els.historyToggleBtn.hidden = items.length <= 10;
  els.historyToggleBtn.textContent = state.ui.showHistory ? 'Show less' : `Show more (${items.length - Math.min(items.length, 10)})`;

  els.tournamentRows.querySelectorAll('[data-select-tournament]').forEach(btn => {
    btn.addEventListener('click', () => {
      state.ui.selectedTournamentId = btn.dataset.selectTournament;
      saveAndRender();
    });
  });

  els.tournamentRows.querySelectorAll('[data-quick-status]').forEach(btn => {
    btn.addEventListener('click', (event) => {
      event.stopPropagation();
      if (btn.classList.contains('is-disabled')) return;
      setTournamentStatus(btn.dataset.quickTournament, btn.dataset.quickStatus);
    });
  });
}

async function setTournamentStatus(tournamentId, nextStatus) {
  if (!guardPermission(canManageTournaments, 'Only Admin or Operator can change tournament status.')) return;
  const tournament = state.tournaments.find(t => t.id === tournamentId);
  if (!tournament || tournament.status === nextStatus) return;

  if ((nextStatus === 'Live' || nextStatus === 'Finished') && !tournament.matches?.length) {
    toast('Generate the tournament before switching to Live or Finished.', 'warning');
    return;
  }

  tournament.status = nextStatus;

  try {
    await saveTournamentRuntimeToSupabase(tournament);
    saveAndRender();
    toast(`Tournament status updated to ${nextStatus}.`, 'success');
  } catch (error) {
    console.error('Tournament status sync error:', error);
    toast(getFriendlySupabaseError(error, 'Could not update tournament status.'), 'error');
    saveAndRender();
  }
}

function renderTournamentDetails() {
  const tournament = getSelectedTournament();
  if (!tournament) {
    els.selectedTournamentHero.innerHTML = emptyStateHtml('No tournament selected', 'Create a tournament to open the control center.', 'success');
    els.overviewTab.innerHTML = els.playersTab.innerHTML = els.scheduleTab.innerHTML = els.standingsTab.innerHTML = '';
    return;
  }

  const derived = getTournamentDerived(tournament);
  const leader = computeStandings(tournament)[0] || null;
  const progress = derived.joinedPlayers.length ? Math.round((derived.mainDrawPlayers.length / derived.joinedPlayers.length) * 100) : 0;
  const completedMatches = tournament.matches?.filter(match => match.status === 'Completed').length || 0;
  const completionRate = derived.totalMatches ? Math.round((completedMatches / derived.totalMatches) * 100) : 0;
  const statusTone = tournament.status === 'Live' ? 'live' : tournament.status === 'Finished' ? 'finished' : 'open';

  els.selectedTournamentHero.innerHTML = `
    <div class="dashboard-hero-grid">
      <div class="dashboard-hero-main card-shell ${statusTone}">
        <div class="dashboard-hero-head">
          <div>
            <div class="hero-kicker">Tournament control center</div>
            <div class="hero-title">${escapeHtml(tournament.name)}</div>
            <div class="hero-subline">${formatDate(tournament.date)} · ${escapeHtml(tournament.location)} · ${escapeHtml(tournament.startTime)} · ${tournament.durationHours}h</div>
          </div>
          <div class="hero-status-stack">
            <span class="status-badge status-${tournament.status.toLowerCase()}">${escapeHtml(tournament.status)}</span>
            ${tournament.status === 'Live' ? `<span class="live-inline-pill"><span class="live-dot"></span>Live</span>` : ``}
          </div>
        </div>
        <div class="hero-kpi-strip">
          <div class="hero-kpi-card emphasis"><span>Joined</span><strong>${derived.joinedPlayers.length}</strong><small>confirmed</small></div>
          <div class="hero-kpi-card"><span>Main draw</span><strong>${derived.mainDrawPlayers.length}</strong><small>scheduled</small></div>
          <div class="hero-kpi-card"><span>Courts</span><strong>${derived.courts}</strong><small>auto count</small></div>
          <div class="hero-kpi-card"><span>Rounds</span><strong>${derived.rounds}</strong><small>rotation</small></div>
          <div class="hero-kpi-card"><span>Completed</span><strong>${completedMatches}/${derived.totalMatches}</strong><small>results</small></div>
        </div>
        <div class="hero-progress-panel">
          <div class="hero-progress-copy">
            <div>
              <div class="hero-progress-label">Schedule coverage</div>
              <div class="hero-progress-value">${progress}% ready</div>
            </div>
            <div>
              <div class="hero-progress-label">Live completion</div>
              <div class="hero-progress-value">${completionRate}% complete</div>
            </div>
          </div>
          <div class="progress-bar double"><span style="width:${Math.min(progress,100)}%"></span></div>
        </div>
      </div>
      <aside class="dashboard-hero-side card-shell">
        <div class="dashboard-side-head">
          <div>
            <div class="hero-kicker">Live panel</div>
            <h3>Operations</h3>
          </div>
          <span class="mini-badge ${statusTone}">${escapeHtml(tournament.status)}</span>
        </div>
        <div class="ops-stack">
          <div class="ops-row"><span>Leader</span><strong>${leader ? escapeHtml(leader.teamName) : '—'}</strong></div>
          <div class="ops-row"><span>Waitlist</span><strong>${derived.waitlistPlayers.length}</strong></div>
          <div class="ops-row"><span>Match time</span><strong>${derived.matchMinutes || '—'} min</strong></div>
          <div class="ops-row"><span>Next action</span><strong>${tournament.matches?.length ? (tournament.status === 'Finished' ? 'Review standings' : 'Enter results') : 'Generate draw'}</strong></div>
        </div>
        ${canManageTournaments()
          ? `<div class="hero-action-stack">
               <button class="btn ghost" type="button" id="editTournamentBtn">Edit</button>
               <button class="btn secondary" type="button" id="joinFromClubBtn">Add players</button>
               <button class="btn primary" type="button" id="generateBtn">Generate</button>
             </div>`
          : `<div class="readonly-note-block compact"><div class="readonly-note">Viewer mode</div><div class="section-subtitle">Overview, schedule and standings only</div></div>`}
      </aside>
    </div>`;

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
  const completion = tournament.matches?.length
    ? tournament.matches.filter(match => match.status === 'Completed').length
    : 0;
  const completionRate = derived.totalMatches ? Math.round((completion / derived.totalMatches) * 100) : 0;
  const readinessRate = derived.joinedPlayers.length ? Math.round((derived.mainDrawPlayers.length / derived.joinedPlayers.length) * 100) : 0;
  const nextAction = !tournament.matches?.length
    ? 'Generate schedule'
    : completion < derived.totalMatches
      ? 'Keep entering scores'
      : 'Review final standings';

  els.overviewTab.innerHTML = `
    <div class="dashboard-overview-grid">
      <div class="card overview-dashboard-card overview-primary-card">
        <div class="card-kicker">Control overview</div>
        <h3>Command snapshot</h3>
        <div class="overview-kpi-grid">
          <div class="overview-kpi"><span>Readiness</span><strong>${readinessRate}%</strong><small>main draw filled</small></div>
          <div class="overview-kpi"><span>Completion</span><strong>${completionRate}%</strong><small>results entered</small></div>
          <div class="overview-kpi"><span>Leader</span><strong>${leader ? escapeHtml(leader.teamName) : '—'}</strong><small>current top team</small></div>
          <div class="overview-kpi"><span>Next move</span><strong>${nextAction}</strong><small>suggested action</small></div>
        </div>
      </div>

      <div class="card overview-dashboard-card">
        <div class="card-kicker">Event brief</div>
        <h3>Tournament info</h3>
        <div class="info-list compact-info-list dashboard-info-list">
          <div class="info-row"><span>Date</span><strong>${formatDate(tournament.date)}</strong></div>
          <div class="info-row"><span>Venue</span><strong>${escapeHtml(tournament.location)}</strong></div>
          <div class="info-row"><span>Start time</span><strong>${escapeHtml(tournament.startTime)}</strong></div>
          <div class="info-row"><span>Duration</span><strong>${tournament.durationHours} hours</strong></div>
        </div>
      </div>

      <div class="card overview-dashboard-card">
        <div class="card-kicker">Player flow</div>
        <h3>Registration funnel</h3>
        <div class="funnel-metrics">
          <div class="funnel-row"><span>Joined</span><strong>${derived.joinedPlayers.length}</strong></div>
          <div class="funnel-row"><span>Main draw</span><strong>${derived.mainDrawPlayers.length}</strong></div>
          <div class="funnel-row"><span>Waitlist</span><strong>${derived.waitlistPlayers.length}</strong></div>
          <div class="funnel-row"><span>Withdrawn</span><strong>${derived.withdrawnPlayers.length}</strong></div>
        </div>
      </div>

      <div class="card overview-dashboard-card overview-accent-card">
        <div class="card-kicker">Engine</div>
        <h3>Auto-calculation</h3>
        <div class="pill-cloud">
          <span class="meta-chip">${derived.courts} courts</span>
          <span class="meta-chip">${derived.activeTeams} teams</span>
          <span class="meta-chip">${derived.rounds} rounds</span>
          <span class="meta-chip">${derived.matchMinutes || '—'} min / match</span>
          <span class="meta-chip">${completion}/${derived.totalMatches} results</span>
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
    els.scheduleTab.innerHTML = emptyStateHtml('No schedule yet', 'Add approved players and generate the event schedule.', 'warning');
    return;
  }

  const scheduleView = state.ui.scheduleView || 'rounds';
  const completedMatches = tournament.matches.filter(match => match.status === 'Completed').length;

  const roundsHtml = `
    <div class="schedule-summary-bar card">
      <div class="summary-pill"><span>Rounds</span><strong>${tournament.rounds.length}</strong></div>
      <div class="summary-pill"><span>Matches</span><strong>${tournament.matches.length}</strong></div>
      <div class="summary-pill"><span>Completed</span><strong>${completedMatches}</strong></div>
    </div>
    <div class="rounds-accordion">
      ${tournament.rounds.map((round, index) => `
        <details class="round-accordion-item" ${index === 0 ? 'open' : ''}>
          <summary>
            <div>
              <div class="round-title">Round ${index + 1}</div>
              <div class="round-sub">${round.startTime} – ${round.endTime}</div>
            </div>
            <span class="badge">${round.matches.length} matches</span>
          </summary>
          <div class="round-body compact-round-body">
            ${round.matches.map(match => `
              <div class="round-match compact-round-match">
                <div class="round-match-main">
                  <span class="court-pill">Court ${match.court}</span>
                  <strong>${escapeHtml(match.teamA.name)} vs ${escapeHtml(match.teamB.name)}</strong>
                </div>
                <span class="status-badge status-${match.status.toLowerCase() === 'completed' ? 'finished' : 'open'}">${escapeHtml(match.status)}</span>
              </div>
            `).join('')}
          </div>
        </details>
      `).join('')}
    </div>`;

  const resultsHtml = `
    <div class="card schedule-results-card">
      <div class="results-list compact-results-list">
        ${tournament.matches.map(match => resultCardHtml(match)).join('')}
      </div>
    </div>`;

  els.scheduleTab.innerHTML = `
    <div class="sub-tabs sticky-sub-tabs" id="scheduleSubTabs">
      <button class="tab ${scheduleView === 'rounds' ? 'is-active' : ''}" type="button" data-schedule-view="rounds">Timeline</button>
      <button class="tab ${scheduleView === 'results' ? 'is-active' : ''}" type="button" data-schedule-view="results">Results</button>
    </div>
    ${scheduleView === 'rounds' ? roundsHtml : resultsHtml}
  `;

  els.scheduleTab.querySelectorAll('[data-schedule-view]').forEach(btn => {
    btn.addEventListener('click', () => {
      state.ui.scheduleView = btn.dataset.scheduleView;
      saveAndRender();
    });
  });

  els.scheduleTab.querySelectorAll('[data-open-result]').forEach(btn => {
    btn.addEventListener('click', () => openResultModal(tournament.id, btn.dataset.openResult));
  });
}

function resultCardHtml(match) {
  const score = match.status === 'Completed' ? `${match.gamesA} : ${match.gamesB}` : 'Not entered';
  const updatedBy = match.lastUpdatedBy ? ` · ${escapeHtml(match.lastUpdatedBy)}` : '';
  return `
    <div class="result-card result-card-compact">
      <div class="result-card-main">
        <strong>${escapeHtml(match.teamA.name)} vs ${escapeHtml(match.teamB.name)}</strong>
        <div class="muted">Round ${escapeHtml(String(match.round || '').replace('Round ', '') || '—')} · Court ${match.court} · ${match.roundTime}${updatedBy}</div>
      </div>
      <div class="result-card-side compact-side">
        <div class="score-chip ${match.status === 'Completed' ? 'is-complete' : ''}">${score}</div>
        ${canEnterResults() ? `<button class="btn secondary" type="button" data-open-result="${match.id}">${match.status === 'Completed' ? 'Edit' : 'Enter'}</button>` : ''}
      </div>
    </div>
  `;
}

function renderStandingsTab(tournament, leader) {
  const standings = computeStandings(tournament);
  if (!standings.length) {
    els.standingsTab.innerHTML = emptyStateHtml('Standings are empty', 'Generate the tournament and enter results to see rankings.');
    return;
  }

  const totalMatches = tournament.matches?.length || 0;
  const playedMatches = tournament.matches?.filter(match => match.result).length || 0;
  const totalTeams = standings.length;
  const bestDiff = Math.max(...standings.map(row => row.diff));
  const podium = standings.slice(0, 3);

  els.standingsTab.innerHTML = `
    <section class="standings-shell">
      <div class="leader-card standings-leader-card">
        <div>
          <div class="eyebrow">Current leader</div>
          <h3>${leader ? escapeHtml(leader.teamName) : '—'}</h3>
          <div class="section-subtitle">Updated from submitted results and team game differential.</div>
        </div>
        <div class="standings-leader-metrics">
          <div class="summary-pill">
            <span>Teams</span>
            <strong>${totalTeams}</strong>
          </div>
          <div class="summary-pill">
            <span>Played</span>
            <strong>${playedMatches}/${totalMatches}</strong>
          </div>
          <div class="summary-pill">
            <span>Best diff</span>
            <strong>${bestDiff > 0 ? '+' : ''}${bestDiff}</strong>
          </div>
        </div>
      </div>

      <div class="podium-grid">
        ${podium.map((row, index) => `
          <article class="podium-card ${index === 0 ? 'is-first' : ''}">
            <div class="podium-rank">#${row.rank}</div>
            <strong>${escapeHtml(row.teamName)}</strong>
            <div class="podium-meta">${row.wins}W · ${row.losses}L · Diff ${row.diff > 0 ? '+' : ''}${row.diff}</div>
          </article>
        `).join('')}
      </div>

      <div class="standings-card-grid">
        ${standings.map(row => `
          <article class="standing-card ${row.rank === 1 ? 'is-leading' : ''}">
            <div class="standing-card-main">
              <div class="standing-rank-wrap">
                <span class="standing-rank">#${row.rank}</span>
                <div>
                  <strong>${escapeHtml(row.teamName)}</strong>
                  <div class="muted">${row.played} matches played</div>
                </div>
              </div>
              <div class="standing-chip-row">
                <span class="score-chip">${row.wins}W</span>
                <span class="score-chip ghost">${row.losses}L</span>
                <span class="score-chip ${row.diff >= 0 ? 'positive' : 'negative'}">Diff ${row.diff > 0 ? '+' : ''}${row.diff}</span>
              </div>
            </div>
            <div class="standing-stats-grid">
              <div><span>Games won</span><strong>${row.gamesWon}</strong></div>
              <div><span>Games lost</span><strong>${row.gamesLost}</strong></div>
              <div><span>Points</span><strong>${row.wins * 3}</strong></div>
            </div>
          </article>
        `).join('')}
      </div>
    </section>
  `;
}



async function loadPlayerMatchesForCurrentPlayer() {
  const playerId = getCurrentPlayerId();
  if (!playerId || !sbClient) {
    state.playerMatchCards = [];
    return;
  }

  try {
    const { data, error } = await sbClient
      .from('v2_my_match_cards')
      .select('*')
      .eq('viewer_player_id', playerId);

    if (error) throw error;
    state.playerMatchCards = Array.isArray(data) ? data : [];
  } catch (error) {
    console.error('Player matches load error:', error);
    state.playerMatchCards = [];
  }
}

function normalizePlayerMatchCard(row) {
  const teamAScore = row.team_a_score ?? row.games_a ?? row.score_a ?? null;
  const teamBScore = row.team_b_score ?? row.games_b ?? row.score_b ?? null;
  const submittedBy = row.submitted_by_name || row.result_submitted_by_name || row.submitted_by || '';
  const hasResult = Number.isInteger(Number(teamAScore)) && Number.isInteger(Number(teamBScore));

  return {
    id: row.match_id || row.id,
    tournamentName: row.tournament_name || row.tournament || 'Tournament',
    stageName: row.stage_name || row.round_name || row.phase_name || 'Match',
    matchDate: row.match_date || row.date || '',
    matchTime: row.match_time || row.time || '',
    court: row.court_name || row.court || '',
    partnerName: row.partner_name || row.partner || '—',
    opponents: [row.opponent_1_name, row.opponent_2_name].filter(Boolean),
    teamAScore,
    teamBScore,
    submittedBy,
    completed: hasResult,
    raw: row
  };
}

function renderPlayerMatchesScreen() {
  if (!els.playerMatchesContent || !els.playerStatsGrid) return;

  const currentPlayer = getCurrentPlayer();
  const role = getCurrentRole();
  const cards = (state.playerMatchCards || []).map(normalizePlayerMatchCard);
  const completedCount = cards.filter(item => item.completed).length;
  const pendingCount = cards.length - completedCount;

  els.playerStatsGrid.innerHTML = `
    <article class="player-stat-card">
      <span class="player-stat-label">Identity</span>
      <strong class="player-stat-value">${currentPlayer ? escapeHtml(currentPlayer.name) : 'Not selected'}</strong>
      <small class="player-stat-note">${currentPlayer ? escapeHtml(currentPlayer.level || 'Club player') : 'Choose a player to load match cards'}</small>
    </article>
    <article class="player-stat-card">
      <span class="player-stat-label">Matches</span>
      <strong class="player-stat-value">${cards.length}</strong>
      <small class="player-stat-note">Loaded from v2_my_match_cards</small>
    </article>
    <article class="player-stat-card">
      <span class="player-stat-label">Pending result</span>
      <strong class="player-stat-value">${pendingCount}</strong>
      <small class="player-stat-note">Still waiting for submission</small>
    </article>
    <article class="player-stat-card">
      <span class="player-stat-label">Completed</span>
      <strong class="player-stat-value">${completedCount}</strong>
      <small class="player-stat-note">Results already saved</small>
    </article>
  `;

  if (!currentPlayer) {
    els.playerMatchesContent.innerHTML = emptyStateHtml('Select player', 'Choose the player identity above to load only that player\'s matches.');
    return;
  }

  if (!cards.length) {
    els.playerMatchesContent.innerHTML = emptyStateHtml('No matches yet', 'There are no match cards returned for this player yet.');
    return;
  }

  const sorted = cards.sort((a, b) => {
    if (a.completed !== b.completed) return a.completed ? 1 : -1;
    return String(a.matchDate + ' ' + a.matchTime).localeCompare(String(b.matchDate + ' ' + b.matchTime));
  });

  els.playerMatchesContent.innerHTML = `
    <div class="player-match-grid">
      ${sorted.map(card => `
        <article class="player-match-card ${card.completed ? 'is-completed' : 'is-pending'}">
          <div class="player-match-glow"></div>
          <div class="player-match-head">
            <div>
              <div class="player-card-kicker">${escapeHtml(card.tournamentName)}</div>
              <h3>${escapeHtml(card.stageName)}</h3>
            </div>
            <span class="player-status-pill ${card.completed ? 'is-completed' : 'is-pending'}">${card.completed ? 'Completed' : 'Ready for result'}</span>
          </div>

          <div class="player-chip-row">
            <span class="player-chip">${escapeHtml(card.matchDate || 'Date TBC')}</span>
            <span class="player-chip">${escapeHtml(card.matchTime || 'Time TBC')}</span>
            <span class="player-chip">${escapeHtml(card.court || 'Court TBC')}</span>
          </div>

          <div class="player-lines">
            <div class="player-line"><span>Partner</span><strong>${escapeHtml(card.partnerName || '—')}</strong></div>
            <div class="player-line"><span>Opponents</span><strong>${escapeHtml(card.opponents.join(' / ') || '—')}</strong></div>
          </div>

          <div class="player-score-pill ${card.completed ? '' : 'is-empty'}">
            ${card.completed ? `${escapeHtml(card.teamAScore)} : ${escapeHtml(card.teamBScore)}` : 'No result yet'}
          </div>

          <div class="player-submit-row">
            <div class="player-submit-meta">
              <span>Submitted by</span>
              <strong>${card.submittedBy ? escapeHtml(card.submittedBy) : '—'}</strong>
            </div>
            ${(role === 'player' || role === 'admin' || role === 'operator') && !card.completed ? `<button class="btn primary player-submit-btn" type="button" data-player-submit="${card.id}">Submit result</button>` : ''}
          </div>
        </article>
      `).join('')}
    </div>
  `;

  els.playerMatchesContent.querySelectorAll('[data-player-submit]').forEach(btn => {
    btn.addEventListener('click', () => openPlayerResultModal(btn.dataset.playerSubmit));
  });
}

function openPlayerResultModal(matchId) {
  const currentPlayer = getCurrentPlayer();
  if (!currentPlayer) {
    toast('Select a player first.', 'error');
    return;
  }
  const rawCard = (state.playerMatchCards || []).find(row => String(row.match_id || row.id) === String(matchId));
  const card = rawCard ? normalizePlayerMatchCard(rawCard) : null;
  if (!card) return;

  openModal(`
    <div class="modal-head">
      <div>
        <div class="modal-title">Submit Result</div>
        <div class="section-subtitle">${escapeHtml(card.tournamentName)} • ${escapeHtml(card.stageName)}</div>
      </div>
      <button class="btn ghost" data-close-modal>Close</button>
    </div>
    <form id="playerResultForm">
      <div class="player-result-modal-grid">
        <label><div class="section-subtitle">Team A score</div><input class="input input-score" type="number" name="scoreA" min="0" step="1" required /></label>
        <label><div class="section-subtitle">Team B score</div><input class="input input-score" type="number" name="scoreB" min="0" step="1" required /></label>
      </div>
      <div class="player-modal-note">Result author will be linked to the selected player identity: <strong>${escapeHtml(currentPlayer.name)}</strong></div>
      <div class="modal-foot">
        <button class="btn ghost" type="button" data-close-modal>Cancel</button>
        <button class="btn primary" type="submit">Save result</button>
      </div>
    </form>
  `);

  document.getElementById('playerResultForm')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const fd = new FormData(e.target);
    const ok = await submitPlayerMatchResult({
      matchId: card.id,
      teamAScore: Number(fd.get('scoreA')),
      teamBScore: Number(fd.get('scoreB')),
      playerId: currentPlayer.id
    });
    if (ok) closeModal();
  });
}

async function submitPlayerMatchResult({ matchId, teamAScore, teamBScore, playerId }) {
  if (!playerId) {
    toast('Select a player first.', 'error');
    return false;
  }
  if (!Number.isInteger(teamAScore) || !Number.isInteger(teamBScore)) {
    toast('Enter valid integer scores.', 'error');
    return false;
  }
  if (teamAScore === teamBScore) {
    toast('Tie score is not allowed.', 'error');
    return false;
  }
  const candidates = [
    { p_match_id: matchId, p_team_a_score: teamAScore, p_team_b_score: teamBScore, p_submitted_by_player_id: playerId },
    { match_id: matchId, team_a_score: teamAScore, team_b_score: teamBScore, submitted_by_player_id: playerId },
    { p_match_id: matchId, p_team_a_score: teamAScore, p_team_b_score: teamBScore },
    { match_id: matchId, team_a_score: teamAScore, team_b_score: teamBScore }
  ];

  let lastError = null;
  for (const payload of candidates) {
    try {
      const { error } = await sbClient.rpc('v2_submit_match_result', payload);
      if (!error) {
        await loadPlayerMatchesForCurrentPlayer();
        saveAndRender();
        toast('Result saved.', 'success');
        return true;
      }
      lastError = error;
    } catch (error) {
      lastError = error;
    }
  }

  console.error('Player result submit error:', lastError);
  toast(getFriendlySupabaseError(lastError, 'Could not save result to Supabase.'), 'error');
  return false;
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

  const approvedCount = state.clubPlayers.filter(player => player.status === 'Approved').length;
  const pendingCount = state.clubPlayers.filter(player => player.status === 'Pending').length;
  const blockedCount = state.clubPlayers.filter(player => player.status === 'Blocked').length;

  els.clubPlayersTable.innerHTML = `
    <section class="club-premium-shell">
      <div class="club-topline">
        <div class="status-strip club-status-strip">
          <div class="status-tile card soft-success">
            <span class="status-label">Approved</span>
            <strong class="status-count">${approvedCount}</strong>
            <small>Available for tournaments</small>
          </div>
          <div class="status-tile card soft-warning">
            <span class="status-label">Pending</span>
            <strong class="status-count">${pendingCount}</strong>
            <small>Need admin review</small>
          </div>
          <div class="status-tile card soft-danger">
            <span class="status-label">Blocked</span>
            <strong class="status-count">${blockedCount}</strong>
            <small>Restricted from play</small>
          </div>
        </div>

        <div class="club-toolbar club-toolbar-top premium-toolbar-top">
          ${canEditClub() ? `<button class="btn secondary" type="button" id="importClubBtn">Import players</button>` : ''}
          <button class="btn ghost" type="button" id="exportClubBtn">Export JSON</button>
        </div>
      </div>

      <div class="club-card-grid">
        ${players.length ? players.map(player => `
          <article class="club-player-card status-${player.status.toLowerCase()}">
            <div class="club-player-main">
              <div class="club-player-headline">
                <div>
                  <strong>${escapeHtml(player.name)}</strong>
                  <div class="muted">${escapeHtml(player.contact)}</div>
                </div>
                <span class="badge badge-${player.status.toLowerCase()}">${escapeHtml(player.status)}</span>
              </div>
              <div class="club-player-meta">
                <span class="meta-chip"><span class="meta-chip-label">Level</span><strong>${escapeHtml(player.level)}</strong></span>
                <span class="meta-chip"><span class="meta-chip-label">Role</span><strong>Club player</strong></span>
              </div>
            </div>
            <div class="club-player-footer">
              <div class="club-player-presence ${player.status === 'Approved' ? 'ready' : player.status === 'Pending' ? 'review' : 'locked'}">
                ${player.status === 'Approved' ? 'Ready for tournament entry' : player.status === 'Pending' ? 'Awaiting approval' : 'Access restricted'}
              </div>
              <div class="actions-row actions-row-wrap club-card-actions">
                ${canEditClub() && player.status !== 'Approved' ? `<button class="btn secondary" type="button" data-set-status="Approved" data-player-id="${player.id}">Approve</button>` : ''}
                ${canEditClub() && player.status !== 'Blocked' ? `<button class="btn ghost" type="button" data-set-status="Blocked" data-player-id="${player.id}">Block</button>` : ''}
                ${canEditClub() && player.status !== 'Pending' ? `<button class="btn ghost" type="button" data-set-status="Pending" data-player-id="${player.id}">Reset</button>` : ''}
                ${!canEditClub() ? `<span class="readonly-note compact">Read only</span>` : ''}
              </div>
            </div>
          </article>
        `).join('') : emptyStateHtml('No club players found', 'Add a player or adjust the active search and status filter.')}
      </div>
    </section>
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
    ['[data-screen="playerMatches"]', 'Open player-only match cards.'],
    ['[data-detail-tab="overview"]', 'Open overview.'],
    ['[data-detail-tab="players"]', 'Open players.'],
    ['[data-detail-tab="schedule"]', 'Open schedule.'],
    ['[data-detail-tab="standings"]', 'Open standings.'],
    ['#changeRoleBtn', 'Sign in under a different role.'],
    ['#logoutBtn', 'End the current session.']
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


function emptyStateHtml(title, description, tone = 'default') {
  return `
    <div class="empty-state empty-state-${tone}">
      <div class="empty-state-icon">${tone === 'warning' ? '!' : tone === 'success' ? '✓' : '•'}</div>
      <div class="empty-state-content">
        <strong>${escapeHtml(title)}</strong>
        <p>${escapeHtml(description)}</p>
      </div>
    </div>
  `;
}

function toast(message, type = 'default') {
  const el = document.createElement('div');
  el.className = `toast ${type}`;
  const icon = type === 'success' ? '✓' : type === 'error' ? '!' : '•';
  el.innerHTML = `
    <div class="toast-icon">${icon}</div>
    <div class="toast-body">
      <div class="toast-title">${type === 'success' ? 'Updated' : type === 'error' ? 'Attention' : 'Notice'}</div>
      <div class="toast-message">${escapeHtml(message)}</div>
    </div>
    <button class="toast-close" type="button" aria-label="Close notification">×</button>
    <span class="toast-progress"></span>
  `;
  els.toastStack.appendChild(el);
  const remove = () => el.remove();
  el.querySelector('.toast-close')?.addEventListener('click', remove);
  setTimeout(remove, 3200);
}
