function goToOperation(teamName) {
  if (!teamName) return;
  window.location.href = `operasyon.html?team=${encodeURIComponent(teamName)}`;
}

document.addEventListener('DOMContentLoaded', () => {
  const teamButtons = document.querySelectorAll('.team-btn[data-team]');

  teamButtons.forEach((btn) => {
    btn.addEventListener('click', () => {
      const teamName = btn.getAttribute('data-team');
      goToOperation(teamName);
    });
  });
});