function startMission(teamName) {
    console.log(teamName + " göreve hazır!");
    // Takım ismini URL parametresi olarak gönderiyoruz
    window.location.href = `operasyon.html?team=${teamName}`;
}
