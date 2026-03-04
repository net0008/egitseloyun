/* * OPERASYON MOTORU (ops_engine.js) 
 * Sürüm: v2.2.1
 * Güncelleme Notları:
 * - Firebase Realtime Database bağlantısı stabilize edildi.
 * - Butonlar (Onayla/İpucu) için Event Listener yapısına geçildi.
 * - Takım kadrosu ve puan takibi eşzamanlı hale getirildi.
 */

import { db, ref, onValue, update } from './assets/js/firebase-config.js';

const params = new URLSearchParams(window.location.search);
const myTeam = params.get('team') || 'Bilinmeyen Birim';

const scoreEl = document.getElementById('current-score');
const sectorEl = document.getElementById('current-sector');
const teamMembersEl = document.getElementById('team-members-list');
const verifyBtn = document.getElementById('btn-verify');
const hintBtn = document.getElementById('btn-hint');
const cryptoInput = document.getElementById('kripto-val');
const terminalOutput = document.getElementById('terminal-output');

// Terminale mesaj yazdırma ve otomatik kaydırma
function appendTerminalMessage(message, cls = 'sys-msg') {
  if (!terminalOutput) return;
  const p = document.createElement('p');
  p.className = cls;
  p.textContent = `> ${message}`;
  terminalOutput.appendChild(p);
  terminalOutput.scrollTop = terminalOutput.scrollHeight;
}

document.addEventListener('DOMContentLoaded', () => {
  const teamTitle = document.querySelector('.panel-tag');
  if (teamTitle) teamTitle.innerText = `UYDU ANALİZİ: ${myTeam.toUpperCase()}`;
});

// Puan ve Sektör Takibi
const scoreRef = ref(db, `operasyon/skorlar/${myTeam}`);
onValue(scoreRef, (snapshot) => {
  const data = snapshot.val();
  if (!data) return;
  if (scoreEl) scoreEl.innerText = data.puan ?? '---';
  if (sectorEl) sectorEl.innerText = data.sektor ?? '---';
});

// Takım Kadrosunu Çekme
const kadroRef = ref(db, 'operasyon/kadro');
onValue(kadroRef, (snapshot) => {
  const allStudents = snapshot.val() || [];
  const myMembers = allStudents.filter((s) => s['Takım Adı'] === myTeam);
  if (teamMembersEl) {
    teamMembersEl.innerHTML = '';
    myMembers.forEach((member) => {
      const li = document.createElement('li');
      li.textContent = `${member['Adı Soyadı'] || 'İsimsiz'} (${member['Görev'] || 'Analist'})`;
      teamMembersEl.appendChild(li);
    });
  }
});

// Görev Doğrulama (Sektör 2A -> 200^2 = 40000)
function verifyMission() {
  if (!cryptoInput) return;
  const val = cryptoInput.value;
  if (val === '40000') {
    appendTerminalMessage('KRİPTO ÇÖZÜLDÜ! Sektör 2B\'ye intikal ediliyor...', 'success-msg');
    update(scoreRef, { puan: 1200, sektor: '2B', durum: 'Başarılı' });
  } else {
    appendTerminalMessage('HATALI ANALİZ! Enerji kaybı yaşanıyor.', 'error-msg');
    update(scoreRef, { durum: 'Hatalı Giriş' });
  }
  cryptoInput.value = "";
}

// Buton Bağlantıları
if (verifyBtn) verifyBtn.addEventListener('click', verifyMission);
if (hintBtn) {
    hintBtn.addEventListener('click', () => {
        appendTerminalMessage('İpucu Talebi: En yüksek izohips çizgisinin karesini alın.', 'info-msg');
        update(scoreRef, { durum: 'İpucu Aldı' });
    });
}