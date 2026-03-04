import { db, ref, set, onValue } from "./firebase-config.js";

let localStudents = [];

// 1. CSV Okuma (4 Sütun: Okul No; Adı Soyadı; Takım Adı; Görev)
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
            renderPreview();
            alert("PERSONEL VERİTABANI: " + localStudents.length + " kayıt Okul No ile eşleşti.");
        }
    });
});

// 2. Tabloyu Okul No Dahil İnşa Etme
function renderPreview() {
    const tbody = document.getElementById('status-body');
    if (!tbody) return;
    tbody.innerHTML = "";

    localStudents.forEach((student) => {
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td><span class="id-tag">${student["Okul No"] || "---"}</span></td>
            <td>${student["Takım Adı"] || "Bilinmiyor"}</td>
            <td>2A</td>
            <td class="neon-text">1000</td>
            <td>
                <strong>${student["Adı Soyadı"]}</strong> 
                <span class="role-text">(${student["Görev"] || "Analist"})</span>
            </td>
        `;
        tbody.appendChild(tr);
    });
}

// 3. Operasyonu Başlat ve Firebase'e Mühürle
document.getElementById('btn-init-op').addEventListener('click', function() {
    if (localStudents.length === 0) return alert("HATA: Önce personel listesini yükleyin!");

    // Benzersiz takımları al ve skorlarını başlat
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

    // OKUL NO DAHİL tüm kadroyu Firebase'e gönder
    set(ref(db, 'operasyon/kadro'), localStudents).then(() => {
        alert("SİSTEM KİLİTLENDİ: Okul No tabanlı giriş protokolleri aktif.");
    });
});