export const categories = ['Alle', 'Allrounder', 'Kompakt', 'Coding', 'Reasoning', 'Multimodal'];

export const catalog = [
  { name: 'Llama 3.2', id: 'llama3.2:3b', aliases: ['llama3.2:latest'], vendor: 'Meta', brand: 'meta', params: '3B', size: '2,0 GB', tags: ['Allrounder', 'Kompakt'], badge: 'Beliebt', description: 'Leichtgewichtig und schnell. Ideal für Chat, Texte und Zusammenfassungen.' },
  { name: 'Qwen 2.5', id: 'qwen2.5:7b', aliases: ['qwen2.5:latest'], vendor: 'Alibaba', brand: 'qwen', params: '7B', size: '4,7 GB', tags: ['Allrounder', 'Coding'], badge: 'Allrounder', description: 'Vielseitig und mehrsprachig, mit Stärken bei Code und strukturierten Aufgaben.' },
  { name: 'Gemma 3', id: 'gemma3:4b', aliases: ['gemma3:latest'], vendor: 'Google', brand: 'gemma', params: '4B', size: '3,3 GB', tags: ['Allrounder', 'Multimodal'], badge: 'Multimodal', description: 'Ein kompaktes Modell für Sprache, das in Ollama auch Bilder verarbeiten kann.' },
  { name: 'DeepSeek-R1', id: 'deepseek-r1:8b', vendor: 'DeepSeek', brand: 'deepseek', params: '8B', size: '5,2 GB', tags: ['Reasoning', 'Coding'], badge: 'Reasoning', description: 'Die kompakte 8B-Variante für logische Fragen, Mathematik und Code.' },
  { name: 'Mistral 7B', id: 'mistral:7b', aliases: ['mistral:latest'], vendor: 'Mistral AI', brand: 'mistral', params: '7B', size: '4,4 GB', tags: ['Allrounder'], badge: 'Allrounder', description: 'Ein unkomplizierter Begleiter für Dokumente, Ideen und den Alltag.' },
  { name: 'Phi-4 Mini', id: 'phi4-mini:latest', vendor: 'Microsoft', brand: 'phi', params: '3,8B', size: '2,5 GB', tags: ['Kompakt', 'Reasoning'], badge: 'Kompakt', description: 'Ein kleines, mehrsprachiges Modell für schnelle Antworten mit wenig Speicher.' },
  { name: 'Qwen 2.5 Coder', id: 'qwen2.5-coder:7b', aliases: ['qwen2.5-coder:latest'], vendor: 'Alibaba', brand: 'qwen', params: '7B', size: '4,7 GB', tags: ['Coding'], badge: 'Coding', description: 'Auf Programmierung spezialisiert: hilft beim Schreiben und Erklären von Code.' },
  { name: 'Llama 3.2 · 1B', id: 'llama3.2:1b', vendor: 'Meta', brand: 'meta', params: '1B', size: '1,3 GB', tags: ['Kompakt'], badge: 'Kompakt', description: 'Die kleinste Llama-Variante für einfache Textaufgaben und Geräte mit wenig RAM.' },
];

export const runtimes = [
  { id: 'ollama', name: 'Ollama', icon: 'terminal', host: 'Port 11434', url: 'https://ollama.com/download', description: 'Entdecke installierte Modelle und lade neue direkt im Studio herunter.' },
  { id: 'lmstudio', name: 'LM Studio', icon: 'layers', host: 'Port 1234', url: 'https://lmstudio.ai/', description: 'Verwende Modelle aus deiner LM-Studio-Bibliothek über den lokalen API-Server.' },
  { id: 'compatible', name: 'OpenAI-kompatibel', icon: 'plug', host: 'Eigener Port', description: 'Für lokale Server wie llama.cpp, LocalAI oder vLLM mit kompatibler Chat-API.' },
];
