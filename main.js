function goToOperation(teamName) {
  if (!teamName) return;
  window.location.href = `operasyon.html?team=${encodeURIComponent(teamName)}`;
}

window.startMission = goToOperation;

document.addEventListener('click', (event) => {
  const teamButton = event.target.closest('.team-btn[data-team]');
  if (!teamButton) return;

  const teamName = teamButton.getAttribute('data-team');
  goToOperation(teamName);
});