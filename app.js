(function () {
  const data = window.TOURNAMENT_DATA;

  function sortByDate(list) {
    return [...list].sort((a, b) => new Date(a.dateSort) - new Date(b.dateSort));
  }

  function createCard(item) {
    const link = document.createElement('a');
    link.className = 'tournament-card';
    link.href = `tournament.html?id=${encodeURIComponent(item.id)}`;
    link.setAttribute('aria-label', item.name);

    const icon = document.createElement('div');
    icon.className = 'card-icon';
    if (item.icon === 'trophy') icon.classList.add('trophy');

    const body = document.createElement('div');
    body.className = 'card-body';
    body.innerHTML = `
      <div class="card-name">${item.name}</div>
      <div class="card-club">${item.club}</div>
      <div class="card-date">Starts: ${item.dateLabel}</div>
      <div class="card-status-row">
        <span class="status-pill ${item.statusClass}">${item.status}</span>
        <span class="status-pill stage">${item.tag}</span>
      </div>
      <div class="card-meta">${item.meta}</div>
    `;

    link.append(icon, body);
    return link;
  }

  function renderList(id, list) {
    const root = document.getElementById(id);
    if (!root) return;
    root.replaceChildren(...sortByDate(list).map(createCard));
  }

  function renderProfile() {
    const profile = data.profile;
    const root = document.getElementById('profileStats');
    if (!root) return;
    root.replaceChildren(...profile.stats.map(stat => {
      const box = document.createElement('div');
      box.innerHTML = `<strong>${stat.value}</strong><span>${stat.label}</span>`;
      return box;
    }));
  }

  renderList('myTournamentList', data.my);
  renderList('availableTournamentList', data.available);
  renderList('historyTournamentList', data.history);
  renderList('newTournamentList', data.available);
  renderProfile();
})();
