let students = [];
const teamNames = ["Grup Manas", "Dede Korkut", "Türk Tim", "Serhadlar", "Mete Han", "Kurtalan Ekspres"];
const roles = ["Tim Kaptanı", "Kartograf (Coğrafya)", "Veri Analizcisi (Fizik/Kimya)", "Matematikçi", "Lojistik (İpucu)"];

document.getElementById('csv-file').addEventListener('change', function(e) {
    const file = e.target.files[0];
    Papa.parse(file, {
        header: true,
        complete: function(results) {
            students = results.data;
            renderPreview();
        }
    });
});

function renderPreview() {
    const tbody = document.getElementById('table-body');
    tbody.innerHTML = "";

    students.forEach((student, index) => {
        if(index >= 30) return; // Sadece ilk 30 kişiyi al

        // Takım ve Rol Atama Algoritması
        const teamIdx = Math.floor(index / 5);
        const roleIdx = index % 5;

        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td>${student["Okul No"]}</td>
            <td>${student["Adı Soyadı"]}</td>
            <td class="team-cell">${teamNames[teamIdx]}</td>
            <td>${roles[roleIdx]}</td>
        `;
        tbody.appendChild(tr);
    });
}

function distributeTeams() {
    // Bu fonksiyon verileri LocalStorage veya Firebase'e kaydedecek
    localStorage.setItem('finalOperationList', JSON.stringify(students));
    alert("Operasyon kadrosu mühürlendi! Laptoplar artık giriş yapabilir.");
}
