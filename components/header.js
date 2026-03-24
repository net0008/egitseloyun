document.addEventListener("DOMContentLoaded", function() {
    const team = new URLSearchParams(window.location.search).get('team') || "BİRİM SEÇİLMEDİ";
    const pathname = window.location.pathname;

    // Karargah ve CMS gibi yönetimsel sayfalarda takım bilgisini gösterme.
    const showTeamInfo = !pathname.includes('cms.html') && !pathname.includes('karargah.html');

    const headerHTML = `
        <header class="cyber-header">
            <div class="logo-area">
                <span class="glitch" data-text="BERGAMA 2050">BERGAMA 2050</span>
            </div>
            ${showTeamInfo ? `
            <div class="mission-info">
                <span class="label">AKTİF TİM:</span>
                <span id="active-team-display">${team}</span>
            </div>` : ''}
            <div class="status-indicators">
                <div class="status-item">📡 BAĞLANTI: <span class="online">AKTİF</span></div>
            </div>
        </header>
    `;
    const headerElement = document.getElementById('header-placeholder');
    if (headerElement) headerElement.innerHTML = headerHTML;

    // --- YAN MENÜYE ÖĞRETMEN REHBERİ EKLEME ---
    // Not: Bu menü ana HTML dosyasında statik olarak yer aldığı varsayılmıştır.
    const sideMenuUl = document.querySelector('.side-comms-menu ul');
    if (sideMenuUl) {
        const teacherGuideLi = document.createElement('li');
        teacherGuideLi.innerHTML = `<a href="assets/pdf/cografi_becerilerin_dijital_donusumu.pdf" target="_blank" rel="noopener noreferrer">Öğretmen Rehberi</a>`;
        sideMenuUl.appendChild(teacherGuideLi);
    }
});