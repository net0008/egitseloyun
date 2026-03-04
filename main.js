function startMission(teamName) {
    console.log(teamName + " göreve hazır!");
    // Takım ismini URL parametresi olarak gönderiyoruz
    window.location.href = `operasyon.html?team=${teamName}`;
}
// main.js
document.addEventListener('click', function(e) {
    if (e.target && e.target.classList.contains('team-btn')) {
        const teamName = e.target.getAttribute('data-team');
        if (teamName) {
            // Takım ismini URL parametresi olarak ekleyip operasyon sayfasına git
            window.location.href = `operasyon.html?team=${encodeURIComponent(teamName)}`;
        }
    }
});