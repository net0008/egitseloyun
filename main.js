// main.js
console.log("Saha Terminali Giriş Sistemi Aktif.");

document.addEventListener('click', function(e) {
    // Tıklanan eleman .team-btn mi veya içinde mi kontrol et
    const btn = e.target.closest('.team-btn');
    
    if (btn) {
        const teamName = btn.getAttribute('data-team');
        console.log("Seçilen Tim:", teamName);
        
        if (teamName) {
            // Parametreyi ekle ve operasyon sayfasına fırlat
            const targetURL = `operasyon.html?team=${encodeURIComponent(teamName)}`;
            window.location.replace(targetURL);
        }
    }

    // Menüdeki "Öğretmen Rehberi" linki için tıklama olayı.
    // Linkin HTML'de `id="ogretmen-rehberi-link"`'e sahip olduğu varsayılmıştır.
    // "Saha kılavuzu gibi açılıp kapanacak" davranışının, yeni bir tarayıcı
    // sekmesinde açılıp kapatılabilmesi olduğu varsayılmıştır.
    if (e.target.closest('#ogretmen-rehberi-link')) {
        e.preventDefault();
        window.open('assets/pdf/cografi_becerilerin_dijital_donusumu.pdf', '_blank');
    }
});