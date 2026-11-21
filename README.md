# Sudokez – iPhone-Web-App (PWA) über GitHub Pages

Dateien: `index.html` (Aufbau), `style.css` (Papier-Design), `paper.js` (ungleichmäßige Papierformen
und Risskanten), `app.js` (Spiellogik), `sudoku.js` (Rätsel-Generator), `bg.js` (gepunktetes Papier,
füllt sich mit dem Fortschritt), `sw.js` (Offline), `manifest.json`, `icons/`.

## Stil-Versionen
Der frühere dunkle Liquid-Glass-Stil ist im Git-Tag `stil-liquid-glass` gespeichert.

## Online stellen
1. Auf github.com ein neues **öffentliches** Repository anlegen (z. B. `meine-app`).
2. Alle Dateien aus diesem Ordner hochladen („Add file → Upload files“), inklusive Ordner `icons`.
3. Im Repo: **Settings → Pages → Source: „Deploy from a branch“**, Branch `main`, Ordner `/ (root)` → Save.
4. Nach ca. 1 Minute ist die App erreichbar unter `https://<dein-github-name>.github.io/meine-app/`.

## Auf dem iPhone installieren
1. Die URL in **Safari** öffnen.
2. **Teilen** (Quadrat mit Pfeil) → **Zum Home-Bildschirm** → Hinzufügen.
3. Vom Home-Bildschirm starten: keine Adressleiste, keine Browser-Leisten, Vollbild.

## Was sorgt für das App-Gefühl?
- `apple-mobile-web-app-capable` + `manifest.json` mit `"display": "standalone"` → keine Browser-Ränder
- `viewport-fit=cover` + `env(safe-area-inset-*)` → Inhalt nutzt den ganzen Bildschirm, respektiert Notch & Home-Indicator
- `black-translucent` Statusleiste → Statusleiste liegt über deiner App
- Service Worker (`sw.js`) → funktioniert offline
- CSS: kein Gummiband-Scrollen, keine Textauswahl, kein Tap-Highlight

## Updates
Dateien in GitHub ändern und in `sw.js` die Versionsnummer `meine-app-v1` erhöhen. Die App holt sich die neue Version beim nächsten Öffnen (ggf. App einmal schließen und neu öffnen).

## Anpassen
- Name: `manifest.json` und `<title>` / `apple-mobile-web-app-title` in `index.html`
- Icons: `icons/icon-180.png`, `icon-192.png`, `icon-512.png` durch eigene PNGs ersetzen (quadratisch, ohne Transparenz)
- Farben: oben in `style.css`
