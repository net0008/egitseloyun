import { db, ref, set, onValue } from "./firebase-config.js";

let localStudents = [];

// 1. 4 Sütunlu CSV'yi Oku (Okul No Dahil)
document.getElementById('csv-input').addEventListener('change', function(e) {
    const file = e.target.files[0];
    if (!file) return;

    Papa.parse(file, {
        header: true,
        delimiter: ";",
        skipEmptyLines: true,
        encoding: "UTF-8",
        complete: function(results) {
            localStudents = results.data;
            console.log("Personel Veritabanı Güncellendi:", localStudents);
            renderPreview();
            alert("SİSTEM ONAYI: " + localStudents.length + " personel kimlik numaralarıyla birlikte tanımlandı.");
        }
    });
});

// 2. Tabloyu Okul No Dahil Göster
function renderPreview() {
    const tbody = document.getElementById('status-body');
    if (!tbody) return;
    tbody.innerHTML = "";

    localStudents.forEach((student) => {
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td>${student["Okul No"] || "---"}</td>
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

// 3. Operasyonu Başlat (Tüm Kimlik Verilerini Firebase'e Mühürle)
document.getElementById('btn-init-op').addEventListener('click', function() {
    if (localStudents.length === 0) return alert("HATA: Önce personel listesini sisteme yükleyin!");

    const teamsInFile = [...new Set(localStudents.map(s => s["Takım Adı"]))];

    teamsInFile.forEach(team => {
        if(team) {
            set(ref(db, 'operasyon/skorlar/' + team), {
                puan: 1000,
                sektor: "2A",
                durum: "Aktif"
            });
        }
    });

    // Okul No dahil tüm kadroyu buluta işle
    set(ref(db, 'operasyon/kadro'), localStudents).then(() => {
        alert("OPERASYON KİLİTLENDİ: Kimlik doğrulama sistemleri aktif.");
    });
});