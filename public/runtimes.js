export const defaultRuntimes = [
  { id: 'ollama', name: 'Ollama', icon: 'terminal', base: 'http://127.0.0.1:11434', url: 'https://ollama.com/download', description: 'Liste installierte Modelle auf und lade neue direkt im Studio herunter.', setup: 'Installiere und öffne Ollama. Falls der Server nicht läuft, starte ihn mit „ollama serve“.' },
  { id: 'lmstudio', name: 'LM Studio', icon: 'layers', base: 'http://127.0.0.1:1234/v1', url: 'https://lmstudio.ai/docs/developer/rest/quickstart', description: 'Nutze deine Bibliothek, lade Modelle zum Chat und installiere neue ohne Ollama.', setup: 'Starte in LM Studio unter Developer den lokalen Server. Für Downloads und automatisches Laden ist LM Studio ab 0.4 mit REST API v1 nötig.' },
];

export const runtimePresets = [
  { id: 'llamacpp', name: 'llama.cpp', icon: 'cpu', base: 'http://127.0.0.1:8080/v1', url: 'https://github.com/ggml-org/llama.cpp/tree/master/tools/server', setup: 'Starte llama-server mit deiner GGUF-Datei und binde ihn nur an 127.0.0.1.' },
  { id: 'jan', name: 'Jan', icon: 'message', base: 'http://127.0.0.1:1337/v1', url: 'https://jan.ai/docs/desktop/api-preference', setup: 'Aktiviere in Jan den Local API Server und wähle ein lokales Chatmodell. Trage unten den API-Schlüssel des Servers ein, falls gesetzt.' },
  { id: 'localai', name: 'LocalAI', icon: 'layers', base: 'http://127.0.0.1:8080/v1', url: 'https://localai.io/', setup: 'Starte LocalAI mit einem lokalen Chatmodell. Wenn LocalAI in einem Container läuft, gib den API-Port nur auf 127.0.0.1 frei.' },
  { id: 'vllm', name: 'vLLM', icon: 'cpu', base: 'http://127.0.0.1:8000/v1', url: 'https://docs.vllm.ai/en/latest/serving/openai_compatible_server/', setup: 'Starte vllm serve mit einem Chatmodell und der Option --host 127.0.0.1. Übernimm bei Bedarf den API-Schlüssel.' },
  { id: 'gpt4all', name: 'GPT4All', icon: 'message', base: 'http://127.0.0.1:4891/v1', url: 'https://docs.gpt4all.io/gpt4all_api_server/home.html', setup: 'Schalte in GPT4All unter Settings → Application → Advanced den lokalen API-Server ein.' },
  { id: 'compatible', name: 'Eigene OpenAI-kompatible API', icon: 'plug', base: 'http://127.0.0.1:8080/v1', setup: 'Die lokale API muss Modelle über /models auflisten und /chat/completions anbieten. Die Adresse enthält den API-Pfad, normalerweise /v1.' },
];

export const runtimes = [...defaultRuntimes, ...runtimePresets];
