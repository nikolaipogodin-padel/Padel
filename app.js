
const block = (selector, message) => {
  document.querySelectorAll(selector).forEach((el) => {
    el.addEventListener('click', (e) => {
      e.preventDefault();
      console.log(message);
    });
  });
};
block('.tournament-one', 'Open tournament: Padel Cup Weekend');
block('.tournament-two', 'Open tournament: Weekly Padel Challenge');
block('.new-tournaments', 'Open New Tournaments');
block('.my-history', 'Open My History');
block('.my-profile', 'Open My Profile');
