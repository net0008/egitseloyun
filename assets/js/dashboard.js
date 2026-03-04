import { db, ref, set, onValue } from "./firebase-config.js";

let localStudents = [];
const roles = ["Tim Kaptanı", "Kartograf", "Veri Analizcisi", "Matematikçi", "Lojistik"];

// 1. Excel'den Hazır Gelen Listeyi Oku
document.getElementById('csv-input').addEventListener('change', function(e) {
    const file = e.target.files[0];
    Papa.parse(file, {
        header: true,
        delimiter: ";",
        skipEmptyLines: true,
        complete: function(results) {
            localStudents = results.data;
            renderPreview();
            alert("SİSTEM ONAYI: " + localStudents.length + " personel ve takımları Excel'den aktarıldı.");
        }
    });
});

// 2. Tabloyu Sadece Görüntüle (Excel Neyse O)
function renderPreview() {
    const tbody = document.getElementById('status-body');
    tbody.innerHTML = "";

    // Her takımdaki kaçıncı kişi olduğunu takip etmek için bir sayaç
    const teamCounters = {};

    localStudents.forEach((student) => {
        const team = student["Takım Adı"];
        if (!teamCounters[team]) teamCounters[team] = 0;
        
        const roleIdx = teamCounters[team] % 5;
        teamCounters[team]++;

        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td>${team}</td>
            <td>SEKTÖR 2A</td>
            <td class="neon-text">1000</td>
            <td>
                <strong>${student["Adı Soyadı"]}</strong> 
                <span class="role-tag"> - ${roles[roleIdx]}</span>
            </td>
        `;
        tbody.appendChild(tr);
    });
}

// 3. Operasyonu Başlat (Buluta Kilitle)
document.getElementById('btn-init-op').addEventListener('click', function() {
    if (localStudents.length === 0) return alert("HATA: Önce Excel listesini yükleyin!");

    // Excel'deki benzersiz takım isimlerini bul
    const teamsInFile = [...new Set(localStudents.map(s => s["Takım Adı"]))];

    // Her takımın skorunu başlat
    teamsInFile.forEach(team => {
        set(ref(db, 'operasyon/skorlar/' + team), {
            puan: 1000,
            sektor: "2A",
            durum: "Aktif"
        });
    });

    // Kadroyu mühürle
    set(ref(db, 'operasyon/kadro'), localStudents).then(() => {
        alert("OPERASYON BAŞLADI: Veriler Excel formatına göre kilitlendi.");
    });
});