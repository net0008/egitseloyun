// URL'den Takımı Oku
const params = new URLSearchParams(window.location.search);
const team = params.get('team') || "Bilinmeyen Birim";
document.getElementById('active-team-name').innerText = team;

let score = 1000;

function checkKripto() {
    const userInput = document.getElementById('kripto-input').value;
    const log = document.getElementById('log-window');

    // 1. Soru Cevabı: 200m'nin karesi = 40000
    if (userInput === "40000") {
        log.innerHTML += `<p class="success-msg">> [BAŞARILI]: Kripto çözüldü. İrtifa 200m onaylandı!</p>`;
        log.innerHTML += `<p>> [SİSTEM]: Sektör 2A temiz. Bir sonraki göreve aktarılıyorsunuz...</p>`;
        // Bir sonraki seviye fonksiyonu buraya gelecek
    } else {
        score -= 50;
        document.getElementById('current-score').innerText = score;
        log.innerHTML += `<p class="error-msg">> [HATA]: Geçersiz kod! Puan düşürüldü.</p>`;
    }
    log.scrollTop = log.scrollHeight; // Logu otomatik aşağı kaydır
}
