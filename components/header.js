document.addEventListener("DOMContentLoaded", function() {
    const team = new URLSearchParams(window.location.search).get('team') || "BİRİM SEÇİLMEDİ";
    const headerHTML = `
        <header class="cyber-header">
            <div class="logo-area">
                <span class="glitch" data-text="BERGAMA 2050">BERGAMA 2050</span>
            </div>
            <div class="mission-info">
                <span class="label">AKTİF TİM:</span>
                <span id="active-team-display">${team}</span>
            </div>
            <div class="status-indicators">
                <div class="status-item">📡 BAĞLANTI: <span class="online">AKTİF</span></div>
            </div>
        </header>
    `;
    const headerElement = document.getElementById('header-placeholder');
    if (headerElement) headerElement.innerHTML = headerHTML;
});