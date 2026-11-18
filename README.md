# Modelwerk – lokales KI-Studio

Modelwerk ist eine deutschsprachige Website für deine lokalen KI-Modelle. Sie listet Modelle aus Ollama, LM Studio und einer weiteren OpenAI-kompatiblen Laufzeit in einer Ansicht. Du kannst mit Text-Chat-Modellen schreiben und weitere Modelle über Ollama herunterladen. Prompts und Chatverläufe werden nicht von Modelwerk gespeichert oder an GitHub gesendet.

## Auf deinem Rechner starten

1. Installiere [Node.js 22 oder neuer](https://nodejs.org/) und [Ollama](https://ollama.com/download) **oder** [LM Studio](https://lmstudio.ai/). Starte Ollama (falls nötig `ollama serve`) oder aktiviere in LM Studio im Bereich **Developer** den lokalen Server.
2. Lade das Projekt auf GitHub über **Code → Download ZIP** im Branch mit Modelwerk herunter und entpacke es. Alternativ kannst du das Repository klonen.
3. **Windows:** Doppelklick auf `Modelwerk starten.cmd`. **macOS/Linux:** `sh ./modelwerk-starten.sh` im Projektordner ausführen. Plattformübergreifend geht auch `npm run open`. Es ist kein `npm install` nötig.
4. Der Starter öffnet die lokale Seite unter `http://127.0.0.1:3210`. Unter **Meine Modelle** findest du die automatisch erkannten Modelle. Mit **Verbindung → Verbindung prüfen** kannst du nach einem Start oder Download neu suchen.

`npm start` startet dieselbe App ohne Browserfenster. Schließe das Starter-Fenster oder drücke `Strg+C`, um sie zu beenden.

## Modelle nutzen und installieren

- **Chat:** Wähle ein Modell aus. Du kannst Antworten stoppen oder kopieren. Der Verlauf ist nur im aktuellen Tab; mit „Neuer Chat“ setzt du ihn zurück. Modelwerk bietet Text-Chat; Bild- oder Datei-Uploads sind nicht Teil des Chats.
- **Modell-Bibliothek:** Unter **Installieren** bestätigst du einen Download in Ollama, mit Fortschrittsanzeige im Studio. Wenn Ollama nicht verbunden ist, kannst du den passenden `ollama pull …`-Befehl kopieren. Unter **Ollama-Modell hinzufügen** sind auch andere gültige Ollama-Namen wie `llama3.2:1b` möglich. Downloads brauchen Internet und ausreichend Speicherplatz; Modell-Lizenzen und Systemanforderungen unterscheiden sich.
- **Modellfamilien:** Filtere in der Bibliothek nach GPT-OSS (20B, 120B) oder Gemma (Gemma, Gemma 2, Gemma 3, Gemma 3n, Gemma 4). Die angegebenen Größen sind ungefähre Downloadgrößen, nicht der RAM-/VRAM-Bedarf beim Ausführen. Für neue Modelle empfiehlt sich eine aktuelle Ollama-Version.
- **Schnellsuche:** `Strg+K` beziehungsweise `⌘K` öffnet die Suche über Ansichten und Modelle.
- **Weitere Modelle:** Für LM Studio lade das gewünschte Modell in LM Studio selbst. Für eigene Dateiformate wie GGUF importiere oder lade das Modell zuerst in einer kompatiblen Laufzeit. Eine Website kann weder beliebige Modelldateien auf deinem Rechner finden noch eigenständig Programme installieren. Nicht jedes installierte Modell ist ein Chat-Modell (z. B. Embedding-Modelle).

## Lokale Laufzeiten konfigurieren

| Laufzeit | Vorgabe bzw. Konfiguration |
| --- | --- |
| Ollama | `http://127.0.0.1:11434`; überschreibbar mit `MODELWERK_OLLAMA_URL` |
| LM Studio | `http://127.0.0.1:1234/v1`; überschreibbar mit `MODELWERK_LMSTUDIO_URL`; falls aktiviert, API-Schlüssel in `MODELWERK_LMSTUDIO_KEY` |
| OpenAI-kompatibel (z. B. llama.cpp oder LocalAI) | Die Basis-URL mit `MODELWERK_OPENAI_URL` setzen; optionaler lokaler Schlüssel in `MODELWERK_OPENAI_KEY`. Der Server muss `/models` und `/chat/completions` unter dieser Basis bereitstellen. |

Beispiel für Bash/Zsh:

```sh
MODELWERK_OPENAI_URL=http://127.0.0.1:8080/v1 node server.mjs --open
```

Beispiel für PowerShell:

```powershell
$env:MODELWERK_OPENAI_URL = 'http://127.0.0.1:8080/v1'
node server.mjs --open
```

Modelwerk akzeptiert nur lokale Zieladressen (`localhost`, `127.0.0.1`, `[::1]`). Die App selbst lauscht nur auf `127.0.0.1` und braucht keine CORS-Freigabe in der Laufzeit. Verwende für private Unterhaltungen eine tatsächlich lokale Laufzeit ohne Weiterleitung zu Cloud-Diensten. Ollama-Cloud-Varianten werden ausgeblendet. Für zusätzliche Sicherheit kannst du Ollama mit `OLLAMA_NO_CLOUD=1` starten. Neue Modelle lädt Ollama selbst aus seiner Modell-Registry. Mit `PORT` kannst du den Port der Modelwerk-Oberfläche ändern.

## GitHub Pages und Entwicklung

Die GitHub-Pages-Seite ist ein statischer Einstieg mit Bibliothek und Startanleitung. Sie kann nicht auf deine Laufzeiten zugreifen. In **Settings → Pages → Source** einmal **GitHub Actions** wählen. Beim nächsten Push nach `main` oder über **Actions → GitHub Pages → Run workflow** auf `main` wird der Ordner `public/` bereitgestellt. Er kann auch unter jedem anderen statischen Webserver gehostet werden.

- `npm test` führt die Tests mit simulierten lokalen Laufzeiten aus, ohne Modelle herunterzuladen.
- `npm run preview` startet eine Web-Vorschau auf `0.0.0.0:3210`; diese Version greift nie auf Laufzeiten zu und erlaubt keine Chat- oder Download-Anfragen. Mit `MODELWERK_SOURCE_REF` kannst du in der Vorschau den Git-Branch für den ZIP-Link wählen.

Inter und Space Grotesk sind lokal gebündelt. Die Schriftlizenzen liegen unter [`public/assets`](public/assets).
