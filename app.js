
const state = {
  route: 'home',
  selectedTournamentId: 't1',
  tournaments: [
    { id:'t1', section:'mine', name:'Padel Cup Weekend', starts:'April 25, 2026', format:'Dynamic Duo', status:'In Progress', tone:'green', club:'Padel Arena Riga', players:16, joined:true, description:'Weekend event with live standings and same-day match flow.' },
    { id:'t2', section:'available', name:'Weekly Padel Challenge', starts:'Tomorrow', format:'Mixed Doubles', status:'Group Stage', tone:'blue', club:'Daugavpils Padel Club', players:24, joined:false, description:'Fast weekly challenge with player-driven result entry.' },
    { id:'t3', section:'available', name:'City Open Friday', starts:'May 02, 2026', format:'Americano', status:'Open', tone:'blue', club:'Jurmala Padel', players:20, joined:false, description:'Evening open tournament with short rounds and instant standings.' }
  ],
  matches: [
    { id:'m1', tournamentId:'t1', title:'Court 2 · Round 3', time:'18:40', teams:'Nikolajs / Janis vs Eriks / Mareks', score:'6:4 3:6 10:7', status:'Submitted' },
    { id:'m2', tournamentId:'t1', title:'Court 1 · Round 4', time:'19:20', teams:'Nikolajs / Janis vs Martins / Edgars', score:'Pending', status:'Upcoming' },
  ],
  activity: [
    'Result submitted for Court 2',
    'Standings refreshed automatically',
    'Weekly Padel Challenge opened for registration'
  ],
  profile: { name:'Nikolajs P.', level:'Advanced', club:'Forevers Padel Circle' }
};

const icons = {
  paddle: `<svg viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M23 10c10 0 18 7 18 17 0 8-6 15-14 17l9 9-5 5-10-10c-7-1-14-8-14-17 0-11 7-21 16-21Z" stroke="currentColor" stroke-width="3.6"/><circle cx="22" cy="26" r="2" fill="currentColor"/><circle cx="29" cy="21" r="2" fill="currentColor"/><circle cx="30" cy="30" r="2" fill="currentColor"/><circle cx="20" cy="34" r="2" fill="currentColor"/><circle cx="15" cy="26" r="2" fill="currentColor"/></svg>`,
  trophy: `<svg viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M18 14h28v8c0 10-7 18-14 18s-14-8-14-18v-8Z" stroke="currentColor" stroke-width="3.6"/><path d="M23 48h18M27 40v8m10-8v8" stroke="currentColor" stroke-width="3.6" stroke-linecap="round"/><path d="M18 18H10c0 7 3 12 10 12M46 18h8c0 7-3 12-10 12" stroke="currentColor" stroke-width="3.6" stroke-linecap="round"/></svg>`,
  new: `<svg viewBox="0 0 24 24" fill="none"><path d="M7 3v3M17 3v3M4 8h16M5 6h14a1 1 0 0 1 1 1v12a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V7a1 1 0 0 1 1-1Z" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>`,
  matches: `<svg viewBox="0 0 24 24" fill="none"><path d="M8 4h8v3H8zM6 7h12a2 2 0 0 1 2 2v8a3 3 0 0 1-3 3H7a3 3 0 0 1-3-3V9a2 2 0 0 1 2-2Z" stroke="currentColor" stroke-width="1.8"/><path d="M8 11h8M8 15h5" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>`,
  history: `<svg viewBox="0 0 24 24" fill="none"><path d="M12 8v5l3 2" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/><path d="M20 12a8 8 0 1 1-2.34-5.66M20 4v5h-5" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>`,
  profile: `<svg viewBox="0 0 24 24" fill="none"><path d="M12 12a4 4 0 1 0-4-4 4 4 0 0 0 4 4ZM5 20a7 7 0 0 1 14 0" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>`
};

function cardMarkup(t){
  const icon = t.tone === 'green' ? icons.paddle : icons.trophy;
  return `
    <button class="card ${t.tone==='blue'?'blue':''}" data-open="${t.id}" aria-label="Open ${t.name}">
      <div class="card-icon">${icon}</div>
      <div>
        <h3>${t.name}</h3>
        <div class="meta">
          <div><span>Starts:</span> ${t.starts}</div>
          <div><span>Team:</span> ${t.format}</div>
        </div>
      </div>
      <div class="status ${t.tone==='blue'?'blue':''}">${t.status}</div>
    </button>`;
}

function homeScreen(){
  return `
  <section class="screen ${state.route==='home'?'active':''}" id="screen-home">
    <div class="topbar">
      <div class="brand"><div class="brand-mark">${icons.paddle}</div><div class="brand-title">PADEL</div></div>
      <img class="avatar" alt="Profile" src="data:image/svg+xml;utf8,${encodeURIComponent(`<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 72 72'><defs><linearGradient id='g' x1='0' y1='0' x2='1' y2='1'><stop stop-color='#7aff9c'/><stop offset='1' stop-color='#14592d'/></linearGradient></defs><rect width='72' height='72' rx='36' fill='#11241a'/><circle cx='36' cy='28' r='14' fill='url(#g)' opacity='.92'/><path d='M16 61c4-11 14-16 20-16s16 5 20 16' fill='url(#g)' opacity='.86'/></svg>`) }" />
    </div>
    <div class="hero">
      <div class="eyebrow">Player Home</div>
      <h1>My Tournaments</h1>
      <p>One place to track active tournaments, join new ones, and open only the matches that matter to you.</p>
      <div class="hero-row">
        <div class="hero-chip"><span class="dot"></span> Live player-first flow</div>
        <div class="section-sub">${state.tournaments.filter(t=>t.section==='mine').length} active</div>
      </div>
    </div>
    <div class="section-head"><div class="section-title"><span class="diamond"></span>My Tournaments</div><div class="section-sub">Live & joined</div></div>
    <div class="stack">${state.tournaments.filter(t=>t.section==='mine').map(cardMarkup).join('')}</div>
    <div class="section-head"><div class="section-title"><span class="diamond blue"></span>Available Tournaments</div><div class="section-sub">Open now</div></div>
    <div class="stack">${state.tournaments.filter(t=>t.section==='available').map(cardMarkup).join('')}</div>
  </section>`;
}

function matchesScreen(){
  return `
  <section class="screen ${state.route==='matches'?'active':''}" id="screen-matches">
    <div class="topbar"><div class="brand"><div class="brand-mark">${icons.matches}</div><div class="brand-title" style="font-size:22px">MATCHES</div></div><img class="avatar" alt="Profile" src="data:image/svg+xml;utf8,${encodeURIComponent(`<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 72 72'><rect width='72' height='72' rx='36' fill='#11241a'/><circle cx='36' cy='28' r='14' fill='#7aff9c' opacity='.92'/><path d='M16 61c4-11 14-16 20-16s16 5 20 16' fill='#7aff9c' opacity='.76'/></svg>`) }" /></div>
    <div class="sheet"><h2>My Matches</h2><p>Only your relevant games, with fast result entry and clean scheduling.</p><div class="list">${state.matches.map(m=>`<div class="mini-card"><div class="mini-title">${m.title} · ${m.time}</div><div class="mini-sub">${m.teams}</div><div class="mini-sub" style="margin-top:6px">${m.status} · ${m.score}</div></div>`).join('')}</div></div>
  </section>`;
}

function historyScreen(){
  return `<section class="screen ${state.route==='history'?'active':''}" id="screen-history"><div class="topbar"><div class="brand"><div class="brand-mark">${icons.history}</div><div class="brand-title" style="font-size:22px">HISTORY</div></div><img class="avatar" alt="Profile" src="data:image/svg+xml;utf8,${encodeURIComponent(`<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 72 72'><rect width='72' height='72' rx='36' fill='#11241a'/><circle cx='36' cy='28' r='14' fill='#7aff9c' opacity='.92'/><path d='M16 61c4-11 14-16 20-16s16 5 20 16' fill='#7aff9c' opacity='.76'/></svg>`) }" /></div><div class="sheet"><h2>History</h2><p>Finished tournaments are moved here, so home stays focused and active.</p><div class="list"><div class="mini-card"><div class="mini-title">Spring Club Series</div><div class="mini-sub">Finished · Rank #3</div></div><div class="mini-card"><div class="mini-title">Riga Sunday Cup</div><div class="mini-sub">Finished · Rank #6</div></div></div></div></section>`;
}

function profileScreen(){
  return `<section class="screen ${state.route==='profile'?'active':''}" id="screen-profile"><div class="topbar"><div class="brand"><div class="brand-mark">${icons.profile}</div><div class="brand-title" style="font-size:22px">PROFILE</div></div><img class="avatar" alt="Profile" src="data:image/svg+xml;utf8,${encodeURIComponent(`<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 72 72'><rect width='72' height='72' rx='36' fill='#11241a'/><circle cx='36' cy='28' r='14' fill='#7aff9c' opacity='.92'/><path d='M16 61c4-11 14-16 20-16s16 5 20 16' fill='#7aff9c' opacity='.76'/></svg>`) }" /></div><div class="sheet"><h2>${state.profile.name}</h2><p>${state.profile.club}</p><div class="grid" style="margin-top:14px"><div class="kv"><small>Level</small><div>${state.profile.level}</div></div><div class="kv"><small>Active tournaments</small><div>${state.tournaments.filter(t=>t.section==='mine').length}</div></div><div class="kv"><small>Result entry mode</small><div>Player-driven</div></div></div></div></section>`;
}

function detailScreen(){
  const t = state.tournaments.find(x => x.id === state.selectedTournamentId) || state.tournaments[0];
  return `
  <section class="screen ${state.route==='detail'?'active':''}" id="screen-detail">
    <div class="topbar">
      <button class="tab active" data-route="home" style="padding:10px 14px">Back</button>
      <div class="brand"><div class="brand-title" style="font-size:20px">Tournament</div></div>
      <div style="width:48px"></div>
    </div>
    <div class="sheet">
      <h2>${t.name}</h2>
      <p>${t.description}</p>
      <div class="tabbar">
        <button class="tab active">Overview</button><button class="tab">Matches</button><button class="tab">Standings</button><button class="tab">Players</button>
      </div>
      <div class="grid">
        <div class="kv"><small>Club</small><div>${t.club}</div></div>
        <div class="kv"><small>Starts</small><div>${t.starts}</div></div>
        <div class="kv"><small>Format</small><div>${t.format}</div></div>
        <div class="kv"><small>Status</small><div>${t.status}</div></div>
      </div>
      <div class="cta-row">
        <button class="btn" id="joinBtn">${t.joined ? 'Joined' : 'Join Tournament'}</button>
        <button class="btn secondary" id="resultBtn">Submit Result</button>
      </div>
      <div class="list" style="margin-top:16px">
        <div class="mini-card"><div class="mini-title">Standings snapshot</div><div class="mini-sub">1. Nikolajs / Janis · 9 pts</div></div>
        <div class="mini-card"><div class="mini-title">Activity</div><div class="mini-sub">${state.activity.join(' · ')}</div></div>
      </div>
    </div>
  </section>`;
}

function navButton(route, label, icon){
  return `<button class="nav-btn ${state.route===route?'active':''}" data-route="${route}" aria-label="${label}">${icon}<div>${label}</div></button>`;
}

function app(){
  return `<div class="app-shell"><main class="phone">${homeScreen()}${matchesScreen()}${historyScreen()}${profileScreen()}${detailScreen()}</main><nav class="bottom-nav"><div class="nav-grid">${navButton('home','New',icons.new)}${navButton('matches','Matches',icons.matches)}${navButton('history','History',icons.history)}${navButton('profile','Profile',icons.profile)}</div></nav></div>`;
}

function render(){
  document.getElementById('app').innerHTML = app();
  document.querySelectorAll('[data-route]').forEach(el=>el.addEventListener('click',()=>{state.route = el.dataset.route; render();}));
  document.querySelectorAll('[data-open]').forEach(el=>el.addEventListener('click',()=>{state.selectedTournamentId = el.dataset.open; state.route='detail'; render();}));
  const joinBtn = document.getElementById('joinBtn');
  if(joinBtn) joinBtn.addEventListener('click',()=>{
    const t = state.tournaments.find(x=>x.id===state.selectedTournamentId);
    t.joined = !t.joined;
    if(t.joined){ t.section='mine'; state.activity.unshift(`Joined ${t.name}`); }
    else { t.section='available'; state.activity.unshift(`Withdrew from ${t.name}`); }
    render();
  });
  const resultBtn = document.getElementById('resultBtn');
  if(resultBtn) resultBtn.addEventListener('click',()=>{
    state.activity.unshift('Result submitted from player card');
    alert('Result submitted');
  });
}

document.addEventListener('DOMContentLoaded', render);
