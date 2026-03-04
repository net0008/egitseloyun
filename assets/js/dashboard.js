import { db, ref, set, onValue } from "./firebase-config.js";

let localStudents = [];
const teamNames = ["Grup Manas", "Dede Korkut", "Türk Tim", "Serhadlar", "Mete Han", "Kurtalan Ekspres"];
const roles = ["Tim Kaptanı", "Kartograf", "Veri Analizcisi", "Matematikçi", "Lojistik"];

// 1. CSV Dosyasını Oku (Noktalı Virgül ve Türkçe Karakter Desteğiyle)
document.getElementById('csv-input').addEventListener('change', function(e) {
    const file = e.target.files[0];
    if (!file) return;

    Papa.parse(file, {
        header: true,
        delimiter: ";", // Senin dosyan için en kritik ayar burası!
        skipEmptyLines: true,
        complete: function(results) {
            localStudents = results.data;
            console.log("Veri çekildi:", localStudents);
            renderPreview(); // Tabloyu ekranda göster
            alert("PERSONEL LİSTESİ DOĞRULANDI: " + localStudents.length + " Analist bulundu.");
        },
        error: function(err) {
            console.error("CSV Okuma Hatası:", err);
            alert("HATA: Dosya formatı uyumsuz!");
        }
    });
});

// 2. Tabloyu Ekranda Önizleme Olarak Göster
function renderPreview() {
    const tbody = document.getElementById('status-body');
    tbody.innerHTML = "";

    localStudents.forEach((student, index) => {
        if(index >= 30) return; // İlk 30 kişiyi 6 gruba dağıtıyoruz

        const teamIdx = Math.floor(index / 5);
        const roleIdx = index % 5;

        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td>${teamNames[teamIdx]}</td>
            <td>SEKTÖR 2A</td>
            <td class="neon-text">1000</td>
            <td><span class="status-blink">${student["Adı Soyadı"]} (${roles[roleIdx]})</span></td>
        `;
        tbody.appendChild(tr);
    });
}

// 3. Operasyonu Başlat (Firebase'e Mühürle)
document.getElementById('btn-init-op').addEventListener('click', function() {
    if (localStudents.length === 0) {
        alert("Önce CSV dosyasını yüklemelisiniz!");
        return;
    }

    // Timlerin başlangıç skorlarını Firebase'e yaz
    teamNames.forEach(team => {
        set(ref(db, 'operasyon/skorlar/' + team), {
            puan: 1000,
            sektor: "2A",
            durum: "Aktif",
            zaman: new Date().toLocaleTimeString()
        });
    });

    // Öğrenci listesini ve rolleri buluta gönder
    set(ref(db, 'operasyon/kadro'), localStudents).then(() => {
        alert("SİNYAL GÖNDERİLDİ: Tüm laptoplar artık giriş yapabilir!");
    });
});

// 4. Canlı Skor Takibi (Senin Ekranın İçin)
onValue(ref(db, 'operasyon/skorlar'), (snapshot) => {
    const data = snapshot.val();
    if (data && localStudents.length > 0) {
        renderPreview(); // Skorlar değiştikçe tabloyu güncelle
    }
});