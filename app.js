// Zeigt an, ob die App als Home-Bildschirm-App (ohne Browser-Leisten) läuft
const standalone =
  window.navigator.standalone === true ||
  window.matchMedia('(display-mode: standalone)').matches;

document.getElementById('mode').textContent = standalone
  ? 'Läuft als App ✓'
  : 'Läuft im Browser – über „Teilen → Zum Home-Bildschirm“ installieren';

// Beispiel-Logik: Zähler, der lokal gespeichert bleibt
let count = Number(localStorage.getItem('count') || 0);
const countEl = document.getElementById('count');
countEl.textContent = count;
document.getElementById('btn').addEventListener('click', () => {
  count++;
  countEl.textContent = count;
  localStorage.setItem('count', count);
});

// Tabs umschalten
document.querySelectorAll('.tabbar button').forEach((b) =>
  b.addEventListener('click', () => {
    document.querySelector('.tabbar .active').classList.remove('active');
    b.classList.add('active');
  })
);

// Service Worker: App funktioniert auch offline
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('sw.js');
}
