const tournaments = {
  my: [
    {
      id: 'm1',
      name: 'Padel Cup Weekend',
      date: '2026-04-25',
      status: 'In Progress',
      statusClass: 'live',
      meta: 'Team: Dynamic Duo',
      stage: 'Group Stage',
      icon: 'racket'
    },
    {
      id: 'm2',
      name: 'City Night Padel',
      date: '2026-05-03',
      status: 'Joined',
      statusClass: 'joined',
      meta: 'Format: Americano',
      stage: 'Joined',
      icon: 'racket'
    }
  ],
  available: [
    {
      id: 'a1',
      name: 'Weekly Padel Challenge',
      date: '2026-04-24',
      status: 'Open',
      statusClass: 'open',
      meta: 'Mixed Doubles',
      stage: 'Join available',
      icon: 'trophy'
    },
    {
      id: 'a2',
      name: 'Weekend Mix Cup',
      date: '2026-05-10',
      status: 'Open',
      statusClass: 'open',
      meta: '8 spots left',
      stage: 'Join available',
      icon: 'trophy'
    }
  ],
  history: [
    {
      id: 'h1',
      name: 'Spring Padel Open',
      date: '2026-04-10',
      status: 'Finished',
      statusClass: 'open',
      meta: '2nd Place',
      stage: 'History',
      icon: 'trophy'
    },
    {
      id: 'h2',
      name: 'Winter Classic',
      date: '2026-03-12',
      status: 'Finished',
      statusClass: 'open',
      meta: 'Quarter Finals',
      stage: 'History',
      icon: 'trophy'
    }
  ]
};

const els = {
  myList: document.getElementById('myTournamentList'),
  availableList: document.getElementById('availableTournamentList'),
  newList: document.getElementById('newTournamentList'),
  historyList: document.getElementById('historyTournamentList'),
  navItems: [...document.querySelectorAll('.nav-item')],
  views: [...document.querySelectorAll('.view')],
  template: document.getElementById('tournamentCardTemplate')
};

function formatDate(dateStr) {
  const dt = new Date(dateStr + 'T12:00:00');
  return new Intl.DateTimeFormat('en', { month: 'long', day: 'numeric', year: 'numeric' }).format(dt);
}

function sortByDate(list) {
  return [...list].sort((a, b) => new Date(a.date) - new Date(b.date));
}

function createCard(item) {
  const node = els.template.content.firstElementChild.cloneNode(true);
  node.dataset.id = item.id;
  node.querySelector('.card-name').textContent = item.name;
  node.querySelector('.card-date').textContent = `Starts: ${formatDate(item.date)}`;
  const status = node.querySelector('.status-pill');
  status.textContent = item.status;
  status.classList.add(item.statusClass);
  const meta = node.querySelector('.card-meta');
  meta.textContent = item.meta;

  const stage = document.createElement('div');
  stage.className = 'status-pill stage';
  stage.textContent = item.stage;
  node.querySelector('.card-status-row').appendChild(stage);

  const icon = node.querySelector('.card-icon');
  if (item.icon === 'trophy') {
    icon.classList.add('trophy');
  }

  node.addEventListener('click', () => {
    alert(`${item.name}\n\nThis card is clickable and can open the tournament page.`);
  });
  node.addEventListener('keydown', (event) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      node.click();
    }
  });

  return node;
}

function renderMainLists() {
  els.myList.replaceChildren(...sortByDate(tournaments.my).map(createCard));
  els.availableList.replaceChildren(...sortByDate(tournaments.available).map(createCard));
}

function renderSecondaryLists() {
  const newWrap = document.createElement('div');
  newWrap.className = 'list-placeholder';
  sortByDate(tournaments.available).forEach(item => {
    const row = document.createElement('div');
    row.className = 'info-row';
    row.innerHTML = `<strong>${item.name}</strong><span>${formatDate(item.date)} · ${item.meta}</span>`;
    newWrap.appendChild(row);
  });
  els.newList.replaceChildren(newWrap);

  const historyWrap = document.createElement('div');
  historyWrap.className = 'list-placeholder';
  sortByDate(tournaments.history).forEach(item => {
    const row = document.createElement('div');
    row.className = 'info-row';
    row.innerHTML = `<strong>${item.name}</strong><span>${formatDate(item.date)} · ${item.meta}</span>`;
    historyWrap.appendChild(row);
  });
  els.historyList.replaceChildren(historyWrap);
}

function setActiveView(viewId) {
  els.views.forEach(view => view.classList.toggle('is-active', view.id === viewId));
  els.navItems.forEach(item => item.classList.toggle('is-active', item.dataset.view === viewId));
}

els.navItems.forEach(item => {
  item.addEventListener('click', () => setActiveView(item.dataset.view));
});

renderMainLists();
renderSecondaryLists();
setActiveView('homeView');
