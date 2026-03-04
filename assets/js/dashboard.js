import { db, ref, set, onValue } from "./firebase-config.js";

let localStudents = [];
// Varsayılan takım isimleri (Kutucuklardan değiştirilebilir)
let teamNames = ["Grup Manas", "Dede Korkut", "Türk Tim", "Serhadlar", "Mete Han", "Kurtalan Ekspres"];
const roles = ["Tim Kaptanı", "Kartograf", "Veri Analizcisi", "Matematikçi", "Lojistik"];

// 1. CSV Yükleme ve Veriyi Hazırlama
document.getElementById('csv-input').addEventListener('change', function(e) {
    const file = e.target.files[0];
    Papa.parse(file, {
        header: true, delimiter: ";", skipEmptyLines: true,
        complete: function(results) {
            // Her öğrenciye varsayılan bir team özelliği ekliyoruz
            localStudents = results.data.map((s, index) => ({
                ...s,
                assignedTeam: teamNames[Math.floor(index / 5)] || teamNames[0]
            }));
            renderPreview();
            alert("LİSTE YÜKLENDİ: Değişiklikleri yapıp operasyonu başlatabilirsiniz.");
        }
    });
});

// 2. Dinamik Önizleme (Tüm Hücreler Değiştirilebilir)
function renderPreview() {
    const tbody = document.getElementById('status-body');
    tbody.innerHTML = "";

    localStudents.forEach((student, index) => {
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td>
                <select class="cyber-select" onchange="updateStudentTeam(${index}, this.value)">
                    ${teamNames.map(t => `<option value="${t}" ${t === student.assignedTeam ? 'selected' : ''}>${t}</option>`).join('')}
                </select>
            </td>
            <td>SEKTÖR 2A</td>
            <td class="neon-text">1000</td>
            <td>
                <strong>${student["Adı Soyadı"]}</strong> 
                <span class="role-hint">(${roles[index % 5]})</span>
            </td>
        `;
        tbody.appendChild(tr);
    });
}

// 3. Değişiklikleri Kaydetme Fonksiyonları (Global tanımlıyoruz)
window.updateStudentTeam = function(studentIndex, newTeam) {
    localStudents[studentIndex].assignedTeam = newTeam;
    console.log(`${localStudents[studentIndex]["Adı Soyadı"]} artık ${newTeam} takımında.`);
};

// 4. Operasyonu Başlat (Değiştirilmiş Son Halini Gönder)
document.getElementById('btn-init-op').addEventListener('click', function() {
    if (localStudents.length === 0) return alert("Önce liste yükleyin!");

    // Seçilen güncel takım isimlerini ve skorları Firebase'e mühürle
    const finalTeams = [...new Set(localStudents.map(s => s.assignedTeam))];
    
    finalTeams.forEach(team => {
        set(ref(db, 'operasyon/skorlar/' + team), {
            puan: 1000,
            sektor: "2A",
            durum: "Aktif"
        });
    });

    // Personel listesini güncel haliyle gönder
    set(ref(db, 'operasyon/kadro'), localStudents).then(() => {
        alert("OPERASYON MÜHÜRLENDİ! Artık değişiklik yapılamaz.");
    });
});