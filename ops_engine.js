import { db, ref, onValue, update } from './firebase-config.js';

const params = new URLSearchParams(window.location.search);
const myTeam = params.get('team') || 'Bilinmeyen Birim';

const scoreEl = document.getElementById('current-score');
const sectorEl = document.getElementById('current-sector');
const teamMembersEl = document.getElementById('team-members-list');
const verifyBtn = document.getElementById('btn-verify');
const cryptoInput = document.getElementById('kripto-val');
const terminalOutput = document.getElementById('terminal-output');

function appendTerminalMessage(message, cls = 'sys-msg') {
  if (!terminalOutput) return;
  const p = document.createElement('p');
  p.className = cls;
  p.textContent = `> ${message}`;
  terminalOutput.appendChild(p);
}

document.addEventListener('DOMContentLoaded', () => {
  const teamTitle = document.querySelector('.panel-tag');
  if (teamTitle) teamTitle.innerText = `UYDU ANALİZİ: ${myTeam.toUpperCase()}`;
});

const scoreRef = ref(db, `operasyon/skorlar/${myTeam}`);
onValue(scoreRef, (snapshot) => {
  const data = snapshot.val();
  if (!data) return;

  if (scoreEl) scoreEl.innerText = data.puan ?? '---';
  if (sectorEl) sectorEl.innerText = data.sektor ?? '---';
});

const kadroRef = ref(db, 'operasyon/kadro');
onValue(kadroRef, (snapshot) => {
  const allStudents = snapshot.val() || [];
  const myMembers = allStudents.filter((s) => s['Takım Adı'] === myTeam);

  if (teamMembersEl) {
    teamMembersEl.innerHTML = '';
    myMembers.forEach((member) => {
      const li = document.createElement('li');
      li.textContent = `${member['Adı Soyadı'] || 'İsimsiz Personel'} (${member['Görev'] || 'Analist'})`;
      teamMembersEl.appendChild(li);
    });
  }

  if (myMembers.length > 0) {
    const memberNames = myMembers.map((m) => m['Adı Soyadı']).filter(Boolean).join(', ');
    appendTerminalMessage(`[TİM]: ${memberNames}`);
  }
});

function verifyMission() {
  if (!cryptoInput) return;
  const val = cryptoInput.value;

  if (val === '40000') {
    appendTerminalMessage('[MERKEZ]: KRİPTO ÇÖZÜLDÜ! Sektör 2B\'ye intikal ediliyor...');
    update(scoreRef, {
      puan: 1200,
      sektor: '2B',
      durum: 'İntikalde'
    });
  } else {
    appendTerminalMessage('[MERKEZ]: HATALI ANALİZ! Enerji kaybı yaşanıyor.');
    update(scoreRef, {
      puan: 950
    });
  }
}

if (verifyBtn) {
  verifyBtn.addEventListener('click', verifyMission);
}

if (cryptoInput) {
  cryptoInput.addEventListener('keydown', (event) => {
    if (event.key === 'Enter') {
      verifyMission();
    }
  });
}