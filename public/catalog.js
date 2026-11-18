export const categories = ['Alle', 'Allrounder', 'Kompakt', 'Coding', 'Reasoning', 'Multimodal'];
export const families = [
  { id: 'gpt-oss', label: 'GPT-OSS' },
  { id: 'gemma', label: 'Gemma-Familie' },
];

const general = [
  { name: 'Llama 3.2', id: 'llama3.2:3b', lmstudio: 'meta/llama-3.2-3b', aliases: ['llama3.2:latest'], vendor: 'Meta', brand: 'meta', params: '3B', size: '2,0 GB', tags: ['Allrounder', 'Kompakt'], badge: 'Beliebt', description: 'Leichtgewichtig und schnell. Ideal für Chat, Texte und Zusammenfassungen.' },
  { name: 'Qwen 2.5', id: 'qwen2.5:7b', aliases: ['qwen2.5:latest'], vendor: 'Alibaba', brand: 'qwen', params: '7B', size: '4,7 GB', tags: ['Allrounder', 'Coding'], badge: 'Allrounder', description: 'Vielseitig und mehrsprachig, mit Stärken bei Code und strukturierten Aufgaben.' },
  { name: 'DeepSeek-R1', id: 'deepseek-r1:8b', vendor: 'DeepSeek', brand: 'deepseek', params: '8B', size: '5,2 GB', tags: ['Reasoning', 'Coding'], badge: 'Reasoning', description: 'Die kompakte 8B-Variante für logische Fragen, Mathematik und Code.' },
  { name: 'Mistral 7B', id: 'mistral:7b', aliases: ['mistral:latest'], vendor: 'Mistral AI', brand: 'mistral', params: '7B', size: '4,4 GB', tags: ['Allrounder'], badge: 'Allrounder', description: 'Ein unkomplizierter Begleiter für Dokumente, Ideen und den Alltag.' },
  { name: 'Phi-4 Mini', id: 'phi4-mini:latest', vendor: 'Microsoft', brand: 'phi', params: '3,8B', size: '2,5 GB', tags: ['Kompakt', 'Reasoning'], badge: 'Kompakt', description: 'Ein kleines, mehrsprachiges Modell für schnelle Antworten mit wenig Speicher.' },
  { name: 'Qwen 2.5 Coder', id: 'qwen2.5-coder:7b', aliases: ['qwen2.5-coder:latest'], vendor: 'Alibaba', brand: 'qwen', params: '7B', size: '4,7 GB', tags: ['Coding'], badge: 'Coding', description: 'Auf Programmierung spezialisiert: hilft beim Schreiben und Erklären von Code.' },
  { name: 'Llama 3.2 · 1B', id: 'llama3.2:1b', vendor: 'Meta', brand: 'meta', params: '1B', size: '1,3 GB', tags: ['Kompakt'], badge: 'Kompakt', description: 'Die kleinste Llama-Variante für einfache Textaufgaben und Geräte mit wenig RAM.' },
];

// Standard-Tags und ungefähre Downloadgrößen: https://ollama.com/library/gpt-oss/tags
const gptOss = [
  { name: 'GPT-OSS 20B', id: 'gpt-oss:20b', lmstudio: 'openai/gpt-oss-20b', aliases: ['gpt-oss:latest'], params: '20B', size: '14 GB', description: 'Die kleinere GPT-OSS-Variante für mehrstufige Aufgaben, Logik und Code.' },
  { name: 'GPT-OSS 120B', id: 'gpt-oss:120b', lmstudio: 'openai/gpt-oss-120b', params: '120B', size: '65 GB', description: 'Die große GPT-OSS-Variante für komplexes Reasoning. Benötigt sehr viel RAM oder VRAM.' },
].map(entry => ({ vendor: 'OpenAI', brand: 'gpt-oss', family: 'gpt-oss', tags: ['Reasoning', 'Coding'], badge: 'Reasoning', ...entry }));

const gemma = [
  // https://ollama.com/library/gemma4 — der Download kann je nach Hardware unterschiedlich ausfallen.
  { name: 'Gemma 4 · E2B', id: 'gemma4:e2b', lmstudio: 'google/gemma-4-e2b', params: 'E2B', size: '4,6–7,5 GB', tags: ['Kompakt', 'Multimodal', 'Reasoning'], description: 'Die kleinste Gemma-4-Variante für Textchat auf Geräten mit weniger Speicher.' },
  { name: 'Gemma 4 · E4B', id: 'gemma4:e4b', lmstudio: 'google/gemma-4-e4b', aliases: ['gemma4:latest'], params: 'E4B', size: '6,6–9,5 GB', tags: ['Allrounder', 'Multimodal', 'Reasoning'], description: 'Die Gemma-4-Standardvariante für Fragen, Texte und Code.' },
  { name: 'Gemma 4 · 12B', id: 'gemma4:12b', lmstudio: 'google/gemma-4-12b', params: '12B', size: '7,7–8,0 GB', tags: ['Allrounder', 'Multimodal', 'Reasoning', 'Coding'], description: 'Die mittelgroße Variante für längere Texte und komplexere Aufgaben.' },
  { name: 'Gemma 4 · 26B', id: 'gemma4:26b', lmstudio: 'google/gemma-4-26b-a4b', params: '26B', size: '16–19 GB', tags: ['Reasoning', 'Multimodal', 'Coding'], description: 'Mixture-of-Experts-Modell mit rund 4B aktiven Parametern pro Token.' },
  { name: 'Gemma 4 · 31B', id: 'gemma4:31b', lmstudio: 'google/gemma-4-31b', params: '31B', size: '19–20 GB', tags: ['Reasoning', 'Multimodal', 'Coding'], description: 'Die größte Gemma-4-Variante für komplexe Texte und Analysen.' },

  // https://ollama.com/library/gemma3n/tags
  { name: 'Gemma 3n · E2B', id: 'gemma3n:e2b', params: 'E2B', size: '5,6 GB', tags: ['Kompakt', 'Allrounder'], description: 'Kleinere Gemma-3n-Variante für effizienten Textchat auf Alltagsgeräten.' },
  { name: 'Gemma 3n · E4B', id: 'gemma3n:e4b', lmstudio: 'google/gemma-3n-e4b', aliases: ['gemma3n:latest'], params: 'E4B', size: '7,5 GB', tags: ['Allrounder'], description: 'Größere Gemma-3n-Variante für Chat, Texte und Zusammenfassungen.' },

  // https://ollama.com/library/gemma3/tags
  { name: 'Gemma 3 · 270M', id: 'gemma3:270m', lmstudio: 'google/gemma-3-270m', params: '270M', size: '292 MB', tags: ['Kompakt'], description: 'Sehr kleines Textmodell für kurze, klar umrissene Aufgaben.' },
  { name: 'Gemma 3 · 1B', id: 'gemma3:1b', lmstudio: 'google/gemma-3-1b', params: '1B', size: '810 MB', tags: ['Kompakt'], description: 'Leichtes Modell für einfache Fragen und kurze Textaufgaben.' },
  { name: 'Gemma 3 · 4B', id: 'gemma3:4b', lmstudio: 'google/gemma-3-4b', aliases: ['gemma3:latest'], params: '4B', size: '3,4 GB', tags: ['Multimodal', 'Allrounder'], description: 'Ein kompaktes Modell für Sprache, das in Ollama auch Bilder verarbeiten kann.' },
  { name: 'Gemma 3 · 12B', id: 'gemma3:12b', lmstudio: 'google/gemma-3-12b', params: '12B', size: '8,2 GB', tags: ['Allrounder', 'Multimodal'], description: 'Die mittlere Gemma-3-Variante für längere Texte und Zusammenfassungen.' },
  { name: 'Gemma 3 · 27B', id: 'gemma3:27b', lmstudio: 'google/gemma-3-27b', params: '27B', size: '17 GB', tags: ['Multimodal', 'Reasoning'], description: 'Die größte Gemma-3-Variante für komplexere Textaufgaben.' },

  // https://ollama.com/library/gemma2/tags
  { name: 'Gemma 2 · 2B', id: 'gemma2:2b', params: '2B', size: '1,6 GB', tags: ['Kompakt'], description: 'Kompakte Variante der zweiten Generation für einfache Textfragen.' },
  { name: 'Gemma 2 · 9B', id: 'gemma2:9b', aliases: ['gemma2:latest'], params: '9B', size: '5,4 GB', tags: ['Allrounder'], description: 'Die Gemma-2-Standardvariante für Textchat und Schreibaufgaben.' },
  { name: 'Gemma 2 · 27B', id: 'gemma2:27b', params: '27B', size: '16 GB', tags: ['Allrounder'], description: 'Die größte Gemma-2-Variante für anspruchsvollere Textaufgaben.' },

  // https://ollama.com/library/gemma/tags
  { name: 'Gemma · 2B', id: 'gemma:2b', params: '2B', size: '1,7 GB', tags: ['Kompakt'], description: 'Die kleine Variante der ersten Gemma-Generation für kurze Texte.' },
  { name: 'Gemma · 7B', id: 'gemma:7b', aliases: ['gemma:latest'], params: '7B', size: '5,0 GB', tags: ['Allrounder'], description: 'Die größere Variante der ersten Gemma-Generation für Textchat.' },
].map(entry => ({ vendor: 'Google', brand: 'gemma', family: 'gemma', badge: entry.tags[0], ...entry }));

const models = [...general, ...gptOss, ...gemma];
const featuredIds = ['llama3.2:3b', 'gpt-oss:20b', 'gemma4:e2b'];
export const featuredCatalog = featuredIds.map(id => models.find(entry => entry.id === id));
export const catalog = [...featuredCatalog, ...models.filter(entry => !featuredIds.includes(entry.id))];
