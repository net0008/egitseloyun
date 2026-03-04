import { db, ref, set, onValue } from "./firebase-config.js";

let localStudents = [];

// 1. Yeni 4 Sütunlu CSV'yi Oku
document.getElementById('csv-input').addEventListener('change', function(e) {
    const file = e.target.files[0];
    if (!file) return;

    Papa.parse(file, {
        header: true,
        delimiter: ";",
        skipEmptyLines: true,
        encoding: "UTF-8", // Türkçe karakter desteği için
        complete: function(results) {
            localStudents = results.data;
            console.log("Siber Kadro Okundu:", localStudents);
            renderPreview();
            alert("SİSTEM ONAYI: " + localStudents.length + " personel, takımları ve görevleriyle birlikte yüklendi.");
        }
    });
});

// 2. Tabloyu Excel'deki Görevlere Göre Göster
function renderPreview() {
    const tbody = document.getElementById('status-body');
    if (!tbody) return;
    tbody.innerHTML = "";

    localStudents.forEach((student) => {
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td>${student["Takım Adı"] || "Bilinmiyor"}</td>
            <td>SEKTÖR 2A</td>
            <td class="neon-text">1000</td>
            <td>
                <strong>${student["Adı Soyadı"]}</strong> 
                <span class="role-tag"> - ${student["Görev"] || "Analist"}</span>
            </td>
        `;
        tbody.appendChild(tr);
    });
}

// 3. Operasyonu Başlat (Her şeyi Firebase'e Gönder)
document.getElementById('btn-init-op').addEventListener('click', function() {
    if (localStudents.length === 0) return alert("HATA: Önce Excel listesini sisteme yükleyin!");

    // Benzersiz takım listesini al
    const teamsInFile = [...new Set(localStudents.map(s => s["Takım Adı"]))];

    // Takım skorlarını başlat
    teamsInFile.forEach(team => {
        if(team) { // Boş satır kontrolü
            set(ref(db, 'operasyon/skorlar/' + team), {
                puan: 1000,
                sektor: "2A",
                durum: "Aktif"
            });
        }
    });

    // Tüm kadroyu (Roller dahil) Firebase'e mühürle
    set(ref(db, 'operasyon/kadro'), localStudents).then(() => {
        alert("OPERASYON BAŞLADI: Tüm birimlere görev emirleri gönderildi.");
    });
});