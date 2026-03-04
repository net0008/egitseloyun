import { db, ref, set, onValue } from "./firebase-config.js";

let localStudents = [];

// 1. CSV Okuma (Başlık temizleme özelliği eklendi)
document.getElementById('csv-input').addEventListener('change', function(e) {
    const file = e.target.files[0];
    if (!file) return;

    Papa.parse(file, {
        header: true,
        delimiter: ";",
        skipEmptyLines: true,
        encoding: "UTF-8",
        // KRİTİK DÜZELTME: Başlıklardaki gizli boşlukları ve karakterleri siler
        transformHeader: function(header) {
            return header.trim();
        },
        complete: function(results) {
            localStudents = results.data;
            console.log("Personel Veritabanı Temizlendi ve Okundu:", localStudents);
            renderPreview();
            alert("SİSTEM ONAYI: " + localStudents.length + " personel verisi kilitlendi.");
        }
    });
});

// 2. Tabloyu İnşa Etme (Okul No ve Görevler Dahil)
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
                <strong>${student["Adı Soyadı"] || "İsim Hatası"}</strong> 
                <span class="role-text">(${student["Görev"] || "Analist"})</span>
            </td>
        `;
        tbody.appendChild(tr);
    });
}

// 3. Operasyonu Başlat
document.getElementById('btn-init-op').addEventListener('click', function() {
    if (localStudents.length === 0) return alert("HATA: Önce personel listesini sisteme yükleyin!");

    const teamsInFile = [...new Set(localStudents.map(s => s["Takım Adı"]))].filter(t => t);

    teamsInFile.forEach(team => {
        set(ref(db, 'operasyon/skorlar/' + team), {
            puan: 1000,
            sektor: "2A",
            durum: "Aktif"
        });
    });

    set(ref(db, 'operasyon/kadro'), localStudents).then(() => {
        alert("SİSTEM KİLİTLENDİ: Operasyonel veri akışı kilitlendi.");
    });
});