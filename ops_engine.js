import { db, ref, onValue, update } from "./assets/js/firebase-config.js";

// 1. URL'den Takımı Al
const params = new URLSearchParams(window.location.search);
const myTeam = params.get('team') || "Bilinmeyen Birim";

// 2. Takım Bilgilerini Ekrana Yaz
document.addEventListener("DOMContentLoaded", () => {
    const teamTitle = document.querySelector(".panel-tag");
    if(teamTitle) teamTitle.innerText = `UYDU ANALİZİ: ${myTeam.toUpperCase()}`;
});

// 3. Canlı Skor ve Sektör Takibi
const scoreRef = ref(db, `operasyon/skorlar/${myTeam}`);
onValue(scoreRef, (snapshot) => {
    const data = snapshot.val();
    if (data) {
        // Puan ve Sektör bilgilerini HTML'deki ilgili yerlere bas
        const scoreEl = document.getElementById("current-score");
        if(scoreEl) scoreEl.innerText = data.puan;
    }
});

// 4. Takım Kadrosunu Firebase'den Çek (Senin Dashboard'dan gelen liste)
const kadroRef = ref(db, "operasyon/kadro");
onValue(kadroRef, (snapshot) => {
    const allStudents = snapshot.val() || [];
    const myMembers = allStudents.filter(s => s["Takım Adı"] === myTeam);
    
    const listEl = document.getElementById("terminal-output"); // Veya özel bir div
    if(listEl && myMembers.length > 0) {
        let memberNames = myMembers.map(m => m["Adı Soyadı"]).join(", ");
        console.log("Tim Üyeleri:", memberNames);
        // İstersen terminalin en başına "Hoş geldin" mesajı yazdırabilirsin
    }
});

// 5. Kripto Doğrulama (Sektör 2A: 200^2 = 40000)
window.verifyMission = function() {
    const val = document.getElementById("kripto-val").value;
    
    if (val === "40000") {
        alert("KRİPTO ÇÖZÜLDÜ! Sektör 2B'ye intikal ediliyor...");
        update(scoreRef, {
            puan: 1200, // 200 puan ödül
            sektor: "2B",
            durum: "İntikalde"
        });
        // Haritayı değiştirme kodunu buraya ekleyeceğiz
    } else {
        alert("HATALI ANALİZ! Enerji kaybı yaşanıyor.");
        update(scoreRef, {
            puan: 950 // 50 puan ceza
        });
    }
};