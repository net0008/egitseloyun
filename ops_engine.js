import { db, ref, onValue, update } from "./assets/js/firebase-config.js";
// 1. URL'den Takım Bilgisini Al
const params = new URLSearchParams(window.location.search);
const teamName = params.get('team') || "Bilinmeyen Birim";

// Global Değişkenler
let currentScore = 1000;
let teamMembers = [];

// 2. Takım Bilgilerini ve Skorunu Dinle
const scoreRef = ref(db, `operasyon/skorlar/${teamName}`);
onValue(scoreRef, (snapshot) => {
    const data = snapshot.val();
    if (data) {
        currentScore = data.puan;
        document.getElementById('current-score').innerText = currentScore;
        document.getElementById('current-sector').innerText = data.sektor;
    }
});

// 3. Kadro Bilgisini Al ve Ekranın Bir Köşesine Yaz (Excel'den Gelen İsimler)
const kadroRef = ref(db, "operasyon/kadro");
onValue(kadroRef, (snapshot) => {
    const allStudents = snapshot.val() || [];
    // Sadece bu takıma ait olanları filtrele
    teamMembers = allStudents.filter(s => s["Takım Adı"] === teamName);
    
    const teamListEl = document.getElementById('team-members-list');
    if (teamListEl) {
        teamListEl.innerHTML = teamMembers.map(m => 
            `<li>${m["Adı Soyadı"]} <small>(${m["Görev"]})</small></li>`
        ).join('');
    }
});

// 4. Sektör 2A Kripto Doğrulama (x^2 Mantığı)
window.verifyCode = function() {
    const input = document.getElementById('kripto-val').value;
    const terminal = document.getElementById('terminal-output');
    
    // SEKTÖR 2A: En yüksek izohips 200m -> 200^2 = 40.000
    if (input === "40000") {
        terminal.innerHTML += `<p class="success">> [BAŞARILI]: Kripto çözüldü. İrtifa 200m onaylandı!</p>`;
        
        // Firebase'i Güncelle (Puan ekle ve sektörü 2B yap)
        update(scoreRef, {
            puan: currentScore + 200,
            sektor: "2B",
            durum: "İntikal Başladı"
        });

        alert("Tebrikler! Sektör 2B'ye geçiş izni verildi.");
    } else {
        terminal.innerHTML += `<p class="error">> [HATA]: Yanlış analiz! Enerji kaybı: -50 Puan.</p>`;
        
        // Yanlış cevap cezası
        update(scoreRef, {
            puan: Math.max(0, currentScore - 50)
        });
    }
    document.getElementById('kripto-val').value = ""; // Inputu temizle
    terminal.scrollTop = terminal.scrollHeight; // Terminali aşağı kaydır
};