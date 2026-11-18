import { catalog, categories, families, featuredCatalog } from './catalog.js';
import { defaultRuntimes, runtimePresets, runtimes } from './runtimes.js';
import { icon, modelIcon } from './icons.js';
import { isCloudOllamaName, validOllamaName, validLMStudioModel, validLMStudioQuantization, isHuggingFaceRepo } from './model-name.js';

const $ = (selector, root = document) => root.querySelector(selector);
const app = $('#app');
const modal = $('#modal');
const palette = $('#palette');
const mode = $('meta[name="modelwerk-mode"]').content;
const local = mode === 'local';
const repo = 'https://github.com/Joshua49561/Test';
const sourceRef = $('meta[name="modelwerk-source-ref"]').content.split('/').map(encodeURIComponent).join('/');
const zip = `${repo}/archive/refs/heads/${sourceRef}.zip`;
const mobile = matchMedia('(max-width: 740px)');
const pages = {
  uebersicht: { title: 'Übersicht', icon: 'layout' },
  chat: { title: 'Chat', icon: 'message' },
  modelle: { title: 'Meine Modelle', icon: 'layers' },
  bibliothek: { title: 'Modell-Bibliothek', icon: 'library' },
  verbindung: { title: 'Verbindung', icon: 'plug' },
};
const getPage = () => Object.hasOwn(pages, location.hash.slice(1)) ? location.hash.slice(1) : 'uebersicht';
const state = {
  page: getPage(), models: [], providers: [], loading: local, checked: false,
  libraryQuery: '', libraryFilter: 'Alle', libraryFamily: '', inventoryQuery: '',
  selection: '', draft: '', chats: new Map(), generating: null,
  pull: null, dialog: null, paletteIndex: 0,
};
const esc = value => String(value ?? '').replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]);
const norm = value => String(value ?? '').normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase();
const matches = (haystack, query) => norm(query).trim().split(/\s+/).every(term => norm(haystack).includes(term));
const catalogKeywords = item => `${item.id} ${item.vendor} ${item.tags.join(' ')} ${families.find(family => family.id === item.family)?.label ?? ''}`;
const installedKey = model => `${model.provider}/${model.id}`;
const providerName = id => runtimes.find(item => item.id === id)?.name ?? id;
const runtimeInfo = id => state.providers.find(runtime => runtime.id === id);
const isUp = id => runtimeInfo(id)?.status === 'connected';
const canDownload = id => local && Boolean(runtimeInfo(id)?.download);
const preferredInstaller = () => isUp('lmstudio') && !isUp('ollama') ? 'lmstudio' : 'ollama';
const hasConnection = () => state.providers.some(runtime => runtime.status === 'connected');
const ollamaId = id => id.includes(':') ? id.toLowerCase() : `${id.toLowerCase()}:latest`;
const refersTo = (entry, id) => [entry.id, ...(entry.aliases ?? [])].some(name => ollamaId(name) === ollamaId(id));
const modelMatches = (item, model) => (model.provider === 'ollama' && item.target !== 'lmstudio' && refersTo(item, model.id)) ||
  (model.provider === 'lmstudio' && item.lmstudio && model.id.toLowerCase().split('@', 1)[0] === item.lmstudio.toLowerCase());
const catalogFor = model => catalog.find(item => modelMatches(item, model));
const installedFor = (item, provider) => state.models.find(model => (!provider || model.provider === provider) && modelMatches(item, model));
const installRef = (item, provider) => provider === 'lmstudio' ? item.lmstudio : item.id;
const transferFor = (item, provider) => state.pull && state.pull.provider === provider &&
  state.pull.ref === installRef(item, provider) && state.pull.item.quantization === item.quantization ? state.pull : null;
const sizeFormat = new Intl.NumberFormat('de-DE', { maximumFractionDigits: 1 });
const fileSize = bytes => bytes >= 1e9 ? `${sizeFormat.format(bytes / 1e9)} GB` : `${sizeFormat.format(bytes / 1e6)} MB`;
const currentModel = () => state.models.find(model => installedKey(model) === state.selection);
const chatHistory = (key = state.selection) => state.chats.get(key) ?? [];

function button(label, { style = 'outline', glyph, action, href, attrs = '' } = {}) {
  const content = `${glyph ? icon(glyph) : ''}${esc(label)}`;
  return href
    ? `<a class="btn btn-${style}" href="${esc(href)}" ${attrs}>${content}</a>`
    : `<button class="btn btn-${style}" type="button" ${action ? `data-action="${action}"` : ''} ${attrs}>${content}</button>`;
}
function notice(text, error = false) {
  return `<div class="notice${error ? ' is-error' : ''}" ${error ? 'role="alert"' : ''}>${icon('info', 16)}<p>${esc(text)}</p></div>`;
}
function heading(kicker, title, description, actions = '') {
  return `<header class="page-heading"><div><p class="eyebrow">${esc(kicker)}</p><h1>${esc(title)}</h1><p>${esc(description)}</p></div>${actions ? `<div class="heading-actions">${actions}</div>` : ''}</header>`;
}
function refreshButton(label = 'Aktualisieren') {
  return `<button class="btn btn-outline" type="button" data-action="refresh" ${state.loading ? 'disabled' : ''}><span class="${state.loading ? 'spin' : ''}">${icon('refresh', 16)}</span>${state.loading ? 'Wird geprüft …' : esc(label)}</button>`;
}
function commandBlock(command, label = 'Befehl kopieren') {
  return `<div class="command-block"><code>${esc(command)}</code><button class="icon-button" type="button" data-action="copy" data-value="${esc(command)}" aria-label="${esc(label)}" title="${esc(label)}">${icon('copy', 15)}</button></div>`;
}
function searchField(id, value, label) {
  return `<label class="field-search" for="${id}">${icon('search')}<span class="sr-only">${esc(label)}</span><input type="search" id="${id}" placeholder="${esc(label)} …" value="${esc(value)}" autocomplete="off"></label>`;
}

function updateSidebar() {
  const status = $('#sidebar-status');
  const connected = hasConnection();
  status.classList.toggle('is-connected', connected);
  status.classList.toggle('is-pending', state.loading && !connected);
  const count = state.providers.filter(provider => provider.status === 'connected').length;
  status.innerHTML = `<i class="status-dot"></i>${connected ? `${count} ${count === 1 ? 'Laufzeit' : 'Laufzeiten'} aktiv` : state.loading ? 'Wird geprüft …' : 'Nicht verbunden'}`;
}

function emptyInstalled(isOverview = false) {
  const level = isOverview ? 'h3' : 'h2';
  if (state.loading && !state.checked) return `<div class="inline-empty surface" role="status"><span class="icon-tile"><span class="spin">${icon('refresh', 22)}</span></span><div><${level}>Lokale Laufzeiten werden geprüft</${level}><p>Modelwerk sucht nach installierten Modellen.</p></div></div>`;
  const connected = hasConnection();
  return `<div class="inline-empty surface">
    <span class="icon-tile">${icon('layers', 24)}</span>
    <div><${level}>${connected ? 'Noch keine Modelle installiert' : 'Noch keine Modelle verbunden'}</${level}><p>${connected ? 'Wähle ein Modell aus der Bibliothek oder lade es in deiner Laufzeit.' : 'Verbinde Ollama, LM Studio oder eine andere lokale Laufzeit, um loszulegen.'}</p></div>
    ${connected ? button('Bibliothek öffnen', { glyph: 'library', href: '#bibliothek' }) : button('Laufzeit verbinden', { glyph: 'plug', href: '#verbindung' })}
  </div>`;
}
function inventoryRows(models, isOverview = false) {
  const level = isOverview ? 'h3' : 'h2';
  return `<div class="inventory-list">${models.map(model => {
    const found = catalogFor(model);
    const meta = [model.parameters, model.size ? fileSize(model.size) : '', model.quantization || model.family, model.loaded === false ? 'Nicht geladen' : model.loaded === true ? 'Geladen' : ''].filter(Boolean);
    return `<article class="inventory-row surface">
      <span class="model-tile brand-${found?.brand ?? 'generic'}">${modelIcon(found?.brand, 22)}</span>
      <div><${level}>${esc(model.name || model.id)}</${level}><div class="model-meta"><span class="provider-badge">${esc(providerName(model.provider))}</span>${meta.length ? `<span>${esc(meta.join(' · '))}</span>` : ''}</div></div>
      ${button('Chat öffnen', { style: 'accent btn-small', glyph: 'message', action: 'open-chat', attrs: `data-key="${esc(installedKey(model))}"` })}
    </article>`;
  }).join('')}</div>`;
}
function catalogCards(entries, isOverview = false) {
  const level = isOverview ? 'h3' : 'h2';
  if (!entries.length) return `<div class="empty-tall surface"><div><span class="icon-tile">${icon('search', 22)}</span><h2>Keine Treffer</h2><p>Probiere einen anderen Suchbegriff oder Filter.</p><div class="button-row">${button('Filter zurücksetzen', { action: 'reset-library' })}</div></div></div>`;
  return `<div class="catalog-grid${isOverview ? ' overview-catalog' : ''}">${entries.map(item => {
    const installed = installedFor(item);
    const downloading = state.pull?.phase === 'active' && Boolean(transferFor(item, state.pull.provider));
    return `<article class="catalog-card surface">
      <div class="catalog-top"><span class="model-tile brand-${item.brand}">${modelIcon(item.brand)}</span>
      ${installed ? `<span class="catalog-badge installed" title="Installiert in ${esc(providerName(installed.provider))}">${icon('check', 12)}Installiert</span>` : `<span class="catalog-badge${item.badge === 'Beliebt' ? ' featured' : ''}">${esc(item.badge)}</span>`}</div>
      <div class="catalog-name"><${level}>${esc(item.name)}</${level}><span>${esc(item.vendor)}</span></div>
      <p class="catalog-description">${esc(item.description)}</p>
      <div class="catalog-bottom"><span class="model-meta" title="Ungefähre Downloadgröße in Ollama">${icon('drive', 14)} ${esc(item.params)} <span aria-hidden="true">·</span> ${esc(item.size)}</span>
      ${installed
        ? button('Chat öffnen', { style: 'accent btn-small', glyph: 'message', action: 'open-chat', attrs: `data-key="${esc(installedKey(installed))}"` })
        : button(downloading ? 'Download läuft' : 'Installieren', { style: 'accent btn-small', glyph: 'download', action: 'install', attrs: `data-id="${esc(item.id)}" aria-label="${esc(item.name)} ${downloading ? '– Download ansehen' : 'installieren'}"` })}</div>
    </article>`;
  }).join('')}</div>`;
}

function renderOverview() {
  return `<section class="hero" aria-labelledby="hero-title">
    <img class="hero-art" src="./assets/hero-chip.jpg" alt="" fetchpriority="high" width="1264" height="848">
    <div class="hero-content"><span class="hero-kicker">${icon('sparkle', 14)} LOCAL AI WORKSPACE</span>
      <h1 id="hero-title">Deine KI.<br><span>Dein Rechner.</span></h1>
      <p>Entdecke, installiere und nutze KI-Modelle direkt auf deinem Rechner. Ohne Cloud, mit voller Kontrolle.</p>
      <div class="button-row"><a class="btn btn-primary" href="#bibliothek">Modelle entdecken ${icon('arrowRight', 16)}</a>${hasConnection() ? button('Chat öffnen', { glyph: 'message', href: '#chat' }) : button('Lokal verbinden', { glyph: 'plug', href: '#verbindung' })}</div>
    </div><span class="hero-marker" aria-hidden="true">LOCAL CORE / 01</span>
  </section>
  <section class="section" aria-labelledby="overview-models">
    <header class="section-heading"><div><h2 id="overview-models">Meine Modelle <span class="count" aria-label="${state.models.length} gefundene Modelle">${state.models.length}</span></h2><p>Deine installierten Modelle an einem Ort.</p></div>${refreshButton()}</header>
    ${state.models.length ? `${inventoryRows(state.models.slice(0, 3), true)}${state.models.length > 3 ? `<a class="text-link" href="#modelle">Alle ${state.models.length} ansehen ${icon('arrowRight', 16)}</a>` : ''}` : emptyInstalled(true)}
  </section>
  <section class="section" aria-labelledby="overview-library">
    <header class="section-heading"><div><h2 id="overview-library">Modell-Bibliothek</h2><p>Entdecke beliebte KI-Modelle für deinen Rechner.</p></div><a class="text-link" href="#bibliothek">Alle Modelle ${icon('arrowRight', 16)}</a></header>
    ${catalogCards(featuredCatalog, true)}
  </section>`;
}
function renderInventory() {
  return `${heading('Lokale Modelle', 'Meine Modelle', 'Hier findest du die Modelle deiner verbundenen Laufzeiten.', refreshButton())}
    ${state.models.length ? `<div class="library-tools">${searchField('inventory-query', state.inventoryQuery, 'Installierte Modelle suchen')}<a class="text-link" href="#bibliothek">Modelle entdecken ${icon('arrowRight', 16)}</a></div>` : ''}
    <div id="inventory-results">${inventoryResults()}</div>`;
}
function inventoryResults() {
  if (!state.models.length) return emptyInstalled();
  const selected = state.models.filter(model => matches(`${model.id} ${model.name ?? ''} ${providerName(model.provider)} ${model.family ?? ''}`, state.inventoryQuery));
  return `<p class="results-caption" role="status">${selected.length} ${selected.length === 1 ? 'Modell' : 'Modelle'}</p>${selected.length ? inventoryRows(selected) : `<div class="empty-tall surface"><div><span class="icon-tile">${icon('search', 22)}</span><h2>Kein Modell gefunden</h2><p>Versuche es mit einem anderen Namen.</p></div></div>`}`;
}
function renderLibrary() {
  return `${heading('Entdecken', 'Modell-Bibliothek', 'Installiere Modelle mit Ollama oder LM Studio. Die Größen auf den Karten beziehen sich auf Ollama.', button('Modell hinzufügen', { style: 'accent', glyph: 'plus', action: 'custom' }))}
    <div class="library-tools">
      <div class="filter-list" role="group" aria-label="Nach Modelltyp filtern">${categoryButtons()}</div>
      <div class="library-search">${familySelect()}${searchField('library-query', state.libraryQuery, 'Modelle suchen')}</div>
    </div>
    <div id="library-results">${libraryResults()}</div>`;
}
function categoryButtons() {
  return categories.map(category => `<button class="filter-button" data-action="filter" data-category="${esc(category)}" aria-pressed="${state.libraryFilter === category}" type="button">${esc(category)}</button>`).join('');
}
function familySelect() {
  const options = [{ id: '', label: 'Alle Familien' }, ...families];
  return `<label class="sr-only" for="library-family">Modellfamilie</label><select id="library-family" class="field family-select">
    ${options.map(family => `<option value="${esc(family.id)}" ${state.libraryFamily === family.id ? 'selected' : ''}>${esc(family.label)}</option>`).join('')}
  </select>`;
}
function libraryResults() {
  const entries = catalog.filter(item =>
    (!state.libraryFamily || item.family === state.libraryFamily) &&
    (state.libraryFilter === 'Alle' || item.tags.includes(state.libraryFilter)) &&
    matches(`${item.name} ${catalogKeywords(item)}`, state.libraryQuery));
  return `<p class="results-caption" role="status">${entries.length} ${entries.length === 1 ? 'Modell' : 'Modelle'}</p>${catalogCards(entries)}`;
}
function refreshLibrary() {
  const results = $('#library-results');
  if (!results) return;
  results.innerHTML = libraryResults();
  for (const button of app.querySelectorAll('[data-action="filter"]')) button.setAttribute('aria-pressed', String(button.dataset.category === state.libraryFilter));
}

function connectionCard(runtime) {
  const info = runtimeInfo(runtime.id);
  const status = info?.status;
  const badge = status === 'connected' ? 'Verbunden' : status === 'auth-required' ? 'Schlüssel prüfen' : state.loading && !state.checked ? 'Wird geprüft' : 'Nicht verbunden';
  const description = runtime.id === 'lmstudio' && status === 'connected' && !info.download
    ? 'Chat verfügbar. Für Downloads und erweiterten Zugriff benötigst du die REST API v1.'
    : runtime.description ?? 'Modelle aus dieser Laufzeit stehen im lokalen Textchat bereit.';
  return `<article class="provider-card surface"><div class="provider-top"><span class="icon-tile">${icon(runtime.icon, 20)}</span><span class="provider-badge${status === 'connected' ? ' is-connected' : ''}"><i class="status-dot"></i>${badge}</span></div>
    <h2>${esc(runtime.name)}</h2><span class="provider-host">${esc(info?.base ?? runtime.base)}</span><p class="provider-description">${esc(description)}</p>
    <div class="provider-bottom">${button('Einrichtung', { style: 'outline btn-small', glyph: 'terminal', action: 'provider', attrs: `data-id="${runtime.id}" aria-label="${esc(runtime.name)} – Einrichtung"` })}${runtime.url ? `<a href="${runtime.url}" class="text-link" target="_blank" rel="noreferrer">Anleitung ${icon('arrowUpRight', 14)}</a>` : ''}</div></article>`;
}
function renderConnection() {
  const connectionNotice = !local
    ? 'Diese Web-Ansicht hat keinen Zugriff auf deinen Rechner. Starte Modelwerk auf deinem Gerät, um lokale Laufzeiten zu verbinden.'
    : hasConnection() ? 'Verbunden. Deine Modelle stehen in „Meine Modelle“ und im Chat bereit.'
      : state.loading ? 'Modelwerk sucht nach lokalen Laufzeiten.' : 'Keine Laufzeit erreichbar. Starte einen lokalen Server und prüfe die Verbindung erneut.';
  const extra = runtimePresets.filter(runtime => runtimeInfo(runtime.id)?.base);
  return `${heading('System', 'Verbindung', 'Verbinde Ollama, LM Studio oder einen anderen lokalen Server. Es ist kein Cloud-Konto nötig.', local ? refreshButton('Verbindung prüfen') : button('Startanleitung', { style: 'primary', glyph: 'terminal', action: 'guide' }))}
    <div class="connection-status">${notice(connectionNotice)}</div>
    <div class="runtime-list">${defaultRuntimes.map(connectionCard).join('')}
      <article class="provider-card surface"><span class="icon-tile">${icon('plug', 20)}</span><h2>Weitere Laufzeiten</h2><span class="provider-host">OpenAI-kompatible lokale API</span>
        <p class="provider-description">Verbinde llama.cpp, Jan, LocalAI, vLLM, GPT4All oder eine eigene lokale API.</p>
        <div class="provider-bottom">${button('Laufzeit hinzufügen', { style: 'accent btn-small', glyph: 'plus', action: 'add-runtime' })}</div></article>
    </div>
    ${extra.length ? `<section class="section" aria-label="Weitere Verbindungen"><div class="runtime-list">${extra.map(connectionCard).join('')}</div></section>` : ''}
    <section class="setup-guide surface" id="startanleitung" tabindex="-1" aria-labelledby="guide-title">
      <p class="eyebrow">Einmalige Einrichtung</p><h2 id="guide-title">So startest du Modelwerk lokal</h2>
      <p>Die lokale App sieht genauso aus wie diese Website. Sie verbindet sich direkt mit den KI-Diensten auf deinem Gerät.</p>
      <ol class="setup-steps">
        <li><strong>Projekt herunterladen</strong><p>Lade <a href="${zip}">Modelwerk als ZIP</a> und entpacke es. Du brauchst <a href="https://nodejs.org/" target="_blank" rel="noreferrer">Node.js 22</a> oder neuer.</p></li>
        <li><strong>Starter öffnen</strong><p>Doppelklick auf <code>Modelwerk starten.cmd</code> unter Windows. Alternativ startet dieser Befehl im Projektordner die App:</p>${commandBlock('npm run open')}</li>
        <li><strong>Laufzeit starten</strong><p>Starte Ollama, den lokalen Server in LM Studio oder deine andere Laufzeit. Klicke anschließend auf „Verbindung prüfen“.</p></li>
      </ol>
    </section>`;
}


const suggestions = ['Erkläre mir ein Thema in einfachen Worten', 'Hilf mir, eine Idee auszuarbeiten', 'Schreibe eine kurze Zusammenfassung'];
function renderChat() {
  if (!currentModel() && state.models.length) state.selection = installedKey(state.models[0]);
  const enabled = Boolean(currentModel());
  const running = Boolean(state.generating);
  const toolbar = `<div class="chat-toolbar"><div class="model-picker">${icon('cpu', 17)}<label for="chat-model" class="sr-only">Aktives Modell</label><select id="chat-model" class="field" ${!enabled || running ? 'disabled' : ''}>
    ${enabled ? runtimes.map(runtime => {
      const models = state.models.filter(model => model.provider === runtime.id);
      return models.length ? `<optgroup label="${esc(runtime.name)}">${models.map(model => `<option value="${esc(installedKey(model))}" ${installedKey(model) === state.selection ? 'selected' : ''}>${esc(model.name || model.id)}</option>`).join('')}</optgroup>` : '';
    }).join('') : '<option>Kein Modell verfügbar</option>'}</select></div>
    ${button('Neuer Chat', { style: 'outline btn-small', glyph: 'plus', action: 'new-chat', attrs: !enabled || running || !chatHistory().length ? 'disabled' : '' })}</div>`;
  return `${heading('Lokale Inferenz', 'Chat', 'Schreibe mit einem Modell, das auf deinem Rechner läuft.')}
    <section class="chat-shell surface" aria-label="Lokaler Chat">${toolbar}
    <div id="chat-messages" class="chat-messages">${chatContents()}</div>
    <div class="composer-wrap"><form class="composer" id="composer"><label for="chat-input" class="sr-only">Deine Nachricht</label><textarea id="chat-input" rows="1" maxlength="16000" placeholder="${enabled ? 'Schreib eine Nachricht …' : 'Verbinde ein Modell, um zu schreiben …'}" ${enabled ? '' : 'disabled'}>${esc(state.draft)}</textarea>
    ${running ? `<button class="btn btn-primary" data-action="stop-chat" type="button" title="Antwort stoppen" aria-label="Antwort stoppen">${icon('stop', 19)}</button>` : `<button class="btn btn-primary" type="submit" title="Nachricht senden" aria-label="Nachricht senden" ${enabled && state.draft.trim() ? '' : 'disabled'}>${icon('send', 19)}</button>`}</form>
    <p class="composer-footer">Textchat · Enter sendet, Umschalt + Enter fügt eine Zeile hinzu. Der Verlauf bleibt in diesem Tab.</p></div></section>`;
}
function chatContents() {
  if (!currentModel()) return `<div class="chat-welcome"><div><span class="icon-tile">${icon('message', 23)}</span><h2>Noch kein Chat-Modell bereit</h2><p>Verbinde eine Laufzeit oder installiere ein Chat-Modell, um zu starten.</p><div class="button-row">${button('Lokal verbinden', { style: 'primary', glyph: 'plug', href: '#verbindung' })}${button('Modelle entdecken', { glyph: 'library', href: '#bibliothek' })}</div></div></div>`;
  const history = chatHistory();
  if (!history.length) return `<div class="chat-welcome"><div><span class="icon-tile">${icon('sparkle', 24)}</span><h2>Worüber möchtest du sprechen?</h2><p>Frag dein Modell etwas oder starte mit einer Idee.</p><div class="button-row">${suggestions.map(text => button(text, { style: 'outline btn-small', action: 'suggestion', attrs: `data-value="${esc(text)}"` })).join('')}</div></div></div>`;
  return `<ol class="messages" aria-label="Chatverlauf">${history.map((message, index) => {
    const user = message.role === 'user';
    return `<li class="chat-message ${user ? 'from-user' : 'from-model'}"><span class="message-icon">${icon(user ? 'user' : 'sparkle', 16)}</span><div><div class="message-title"><span>${user ? 'Du' : esc(currentModel()?.name || currentModel()?.id || 'Modell')}</span>${message.content && !message.pending ? `<button class="icon-button" type="button" data-action="copy-message" data-index="${index}" aria-label="Nachricht kopieren" title="Nachricht kopieren">${icon('copy', 13)}</button>` : ''}</div>${user ? '' : `<details class="reasoning" ${message.reasoning ? '' : 'hidden'}><summary>Modellüberlegungen</summary><p class="reasoning-text">${esc(message.reasoning)}</p></details>`}<p class="message-text">${esc(message.content || (message.pending ? 'Antwort wird vorbereitet …' : ''))}</p>${message.note ? `<p class="message-note">${esc(message.note)}</p>` : ''}</div></li>`;
  }).join('')}</ol>`;
}
function scrollChat() {
  const list = $('#chat-messages');
  if (list) list.scrollTop = list.scrollHeight;
}
function renderPage() {
  const chatFocused = document.activeElement?.id === 'chat-input';
  const oldDraft = chatFocused ? [document.activeElement.selectionStart, document.activeElement.selectionEnd] : null;
  const inventoryFocused = document.activeElement?.id === 'inventory-query';
  const renderers = { uebersicht: renderOverview, chat: renderChat, modelle: renderInventory, bibliothek: renderLibrary, verbindung: renderConnection };
  app.innerHTML = renderers[state.page]();
  if (state.page === 'chat') {
    scrollChat();
    if (oldDraft) {
      const input = $('#chat-input');
      input.focus({ preventScroll: true });
      input.setSelectionRange(...oldDraft);
    }
  } else if (inventoryFocused) $('#inventory-query')?.focus({ preventScroll: true });
}
function navigate(page) {
  if (getPage() !== page) location.hash = page;
  else if (!location.hash) history.replaceState(null, '', `#${page}`);
}
function syncRoute({ focus = false } = {}) {
  state.page = getPage();
  const title = pages[state.page].title;
  document.title = `${title} · Modelwerk`;
  $('#breadcrumb-current').textContent = title;
  for (const link of document.querySelectorAll('[data-page]')) {
    if (link.dataset.page === state.page) link.setAttribute('aria-current', 'page');
    else link.removeAttribute('aria-current');
  }
  renderPage();
  if (focus) {
    window.scrollTo(0, 0);
    app.focus({ preventScroll: true });
  }
}

function notify(text, kind = 'info') {
  const toast = document.createElement('div');
  toast.className = `toast is-${kind}`;
  toast.innerHTML = icon(kind === 'success' ? 'checkCircle' : 'info', 16);
  const content = document.createElement('span');
  content.textContent = text;
  toast.append(content);
  $('#toast-area').append(toast);
  setTimeout(() => toast.remove(), 4600);
}
async function copyText(text, buttonEl) {
  try {
    if (navigator.clipboard?.writeText) await navigator.clipboard.writeText(text);
    else throw new Error('Zwischenablage nicht verfügbar');
  } catch {
    const input = document.createElement('textarea');
    input.className = 'clipboard-input';
    input.value = text;
    (modal.open ? modal : document.body).append(input);
    input.select();
    let copied = false;
    try { copied = document.execCommand('copy'); } catch { /* selection still available in the UI */ }
    input.remove();
    buttonEl?.focus({ preventScroll: true });
    if (!copied) return notify('Kopieren ist nicht verfügbar. Markiere den Text zum Kopieren.', 'error');
  }
  notify('In die Zwischenablage kopiert.', 'success');
  if (buttonEl?.isConnected) {
    const old = buttonEl.innerHTML;
    buttonEl.innerHTML = icon('check', 15);
    setTimeout(() => { buttonEl.innerHTML = old; }, 950);
  }
}

let checking = null;
async function refreshModels({ announce = false } = {}) {
  if (!local) {
    if (announce) notify('Starte Modelwerk lokal, damit es deine Laufzeiten prüfen kann.');
    return;
  }
  if (checking) return checking;
  state.loading = true;
  updateSidebar();
  if (state.page !== 'chat') renderPage();
  checking = (async () => {
    try {
      const response = await fetch('./api/models', { cache: 'no-store' });
      if (!response.ok) throw new Error('Lokale Laufzeiten konnten nicht geprüft werden.');
      const payload = await response.json();
      state.providers = payload.providers ?? [];
      state.models = payload.models ?? [];
      if (!currentModel()) state.selection = state.models.length ? installedKey(state.models[0]) : '';
      if (announce) notify(hasConnection() ? `${state.models.length} ${state.models.length === 1 ? 'Modell gefunden' : 'Modelle gefunden'}.` : 'Keine lokale Laufzeit erreichbar.', hasConnection() ? 'success' : 'info');
    } catch (error) {
      if (announce) notify(error.message || 'Verbindung konnte nicht geprüft werden.', 'error');
    } finally {
      state.loading = false;
      state.checked = true;
      checking = null;
      updateSidebar();
      renderPage();
      if (palette.open) refreshPalette();
    }
  })();
  return checking;
}

async function apiStream(path, data, signal, receive) {
  const response = await fetch(`./api/${path}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data), signal });
  if (!response.ok || !response.body) {
    const payload = await response.json().catch(() => ({}));
    throw new Error(payload.error || `Die lokale Anfrage ist fehlgeschlagen (${response.status}).`);
  }
  const decoder = new TextDecoder();
  const reader = response.body.getReader();
  let buffer = '';
  let completed = false;
  const line = text => {
    if (!text.trim()) return;
    const event = JSON.parse(text);
    if (event.error) throw new Error(event.error);
    if (event.done) completed = true;
    receive(event);
  };
  try {
    while (true) {
      const chunk = await reader.read();
      if (chunk.done) break;
      buffer += decoder.decode(chunk.value, { stream: true });
      let newline;
      while ((newline = buffer.indexOf('\n')) !== -1) {
        line(buffer.slice(0, newline));
        buffer = buffer.slice(newline + 1);
      }
    }
    line(buffer + decoder.decode());
    if (!completed) throw new Error('Die lokale Laufzeit hat den Vorgang nicht abgeschlossen.');
  } finally {
    await reader.cancel().catch(() => {});
    reader.releaseLock();
  }
}

function selectChat(key) {
  if (state.generating && state.selection !== key) {
    notify('Stoppe zuerst die laufende Antwort, um das Modell zu wechseln.');
    return;
  }
  if (!state.models.some(model => installedKey(model) === key)) return;
  if (state.selection !== key) state.draft = '';
  state.selection = key;
  if (state.page === 'chat') renderPage();
  else navigate('chat');
}
function updateDraft(input) {
  state.draft = input.value;
  const send = $('#composer button[type="submit"]');
  if (send) send.disabled = !state.draft.trim() || !currentModel();
}
function messageContext(history) {
  const messages = [];
  let remaining = 76_000;
  for (const entry of history.filter(message => message.content.trim() && !message.note).slice(-24).reverse()) {
    if (remaining <= 0) break;
    const content = entry.content.slice(0, Math.min(remaining, 46_000));
    messages.unshift({ role: entry.role, content });
    remaining -= content.length;
  }
  while (messages[0]?.role === 'assistant') messages.shift();
  return messages;
}
function updateChatAnswer(answer, key) {
  if (state.page !== 'chat' || state.selection !== key) return;
  const messages = $('#chat-messages');
  if (!messages) return;
  const atBottom = messages.scrollHeight - messages.clientHeight - messages.scrollTop < 58;
  const last = $('.chat-message:last-child', messages);
  if (!last) return;
  $('.message-text', last).textContent = answer.content || 'Antwort wird vorbereitet …';
  const details = $('.reasoning', last);
  if (answer.reasoning && details) {
    details.hidden = false;
    $('.reasoning-text', details).textContent = answer.reasoning;
  }
  if (atBottom) scrollChat();
}
async function sendChat() {
  const model = currentModel();
  const text = state.draft.trim();
  if (!local || !model || !text || state.generating) return;
  const key = installedKey(model);
  const history = chatHistory(key);
  const answer = { role: 'assistant', content: '', reasoning: '', pending: true, note: '' };
  history.push({ role: 'user', content: text }, answer);
  state.chats.set(key, history);
  state.draft = '';
  const controller = new AbortController();
  state.generating = controller;
  renderPage();
  $('#chat-input')?.focus({ preventScroll: true });
  try {
    await apiStream('chat', { provider: model.provider, model: model.id, messages: messageContext(history) }, controller.signal, event => {
      if (event.text) answer.content += event.text;
      if (event.reasoning) answer.reasoning += event.reasoning;
      updateChatAnswer(answer, key);
    });
    if (!answer.content.trim()) answer.note = 'Das Modell hat keinen Antworttext zurückgegeben.';
    if (model.loaded === false) void refreshModels();
  } catch (error) {
    answer.note = controller.signal.aborted ? 'Antwort gestoppt.' : error.message || 'Die Antwort ist fehlgeschlagen.';
  } finally {
    answer.pending = false;
    state.generating = null;
    if (state.page === 'chat') renderPage();
  }
}

function modalHeader(title, kicker, glyph) {
  return `<header class="modal-header"><div class="modal-heading"><span class="icon-tile">${icon(glyph, 20)}</span><div><p class="eyebrow">${esc(kicker)}</p><h2 id="modal-title">${esc(title)}</h2></div></div><button class="icon-button" aria-label="Schließen" data-action="close-modal" type="button">${icon('x', 16)}</button></header>`;
}
function showModal(dialog) {
  if (palette.open) palette.close();
  state.dialog = dialog;
  renderModal();
  if (!modal.open) modal.showModal();
  if (dialog.type === 'custom') $('#custom-model', modal)?.focus();
  if (dialog.choose) $('#runtime-preset', modal)?.focus();
}
function renderModal() {
  const dialog = state.dialog;
  if (!dialog) return;
  if (dialog.type === 'provider') renderProviderDialog(dialog);
  else if (dialog.type === 'custom') renderCustomDialog(dialog.provider);
  else if (dialog.type === 'install') renderInstall(dialog.item, dialog.provider);
}
function renderProviderDialog({ id, choose }) {
  const runtime = runtimes.find(item => item.id === id);
  const info = runtimeInfo(id);
  const preset = choose ? `<label class="form-field" for="runtime-preset"><strong>Laufzeit</strong><select class="field" id="runtime-preset">
    ${runtimePresets.map(item => `<option value="${item.id}" ${id === item.id ? 'selected' : ''}>${esc(item.name)}</option>`).join('')}
    </select></label>` : '';
  const help = `<p>${esc(runtime.setup)}${runtime.url ? ` <a href="${runtime.url}" target="_blank" rel="noreferrer">Anleitung öffnen</a>` : ''}</p>`;
  const auth = info?.status === 'auth-required' ? notice('Die Laufzeit verlangt einen gültigen API-Schlüssel. Trage ihn unten ein.') : '';
  const form = local ? `<form id="runtime-form" data-id="${id}">
      <label class="form-field" for="runtime-base"><strong>Lokale API-Adresse</strong><input id="runtime-base" name="base" class="field" type="url" value="${esc(info?.base ?? runtime.base)}" required maxlength="512" spellcheck="false" autocomplete="off"></label>
      <label class="form-field" for="runtime-key"><strong>API-Schlüssel <span class="muted">(optional)</span></strong><input id="runtime-key" name="key" class="field" type="password" placeholder="${info?.hasKey ? 'Leer lassen, um den Schlüssel zu behalten' : 'Nur wenn die Laufzeit einen Schlüssel verlangt'}" maxlength="4096" autocomplete="off"></label>
      ${info?.hasKey ? '<label class="checkbox-field"><input name="clearKey" type="checkbox">Gespeicherten Schlüssel entfernen</label>' : ''}
      <p class="field-hint">Nur Loopback-Adressen sind erlaubt. Änderungen gelten bis zum Neustart von Modelwerk.</p>
      <p class="notice is-error" role="alert" data-config-error hidden></p>
      <div class="button-row">${info?.base ? button(defaultRuntimes.includes(runtime) ? 'Zurücksetzen' : 'Verbindung entfernen', { style: 'quiet', action: 'remove-runtime', attrs: `data-id="${id}"` }) : ''}<button class="btn btn-primary" type="submit">${icon('check', 16)} Speichern &amp; prüfen</button></div>
    </form>` : `<p><strong>Standardadresse:</strong> <code>${esc(runtime.base)}</code></p>${notice('Startest du Modelwerk lokal, kannst du hier die URL und einen Schlüssel eintragen.')}<div class="button-row">${button('Zur Startanleitung', { style: 'primary', glyph: 'arrowRight', action: 'provider-guide' })}</div>`;
  modal.innerHTML = `${modalHeader(choose ? 'Laufzeit hinzufügen' : runtime.name, 'Verbindung', runtime.icon)}<div class="modal-content">${preset}${help}${auth}${form}</div>`;
}
async function saveRuntime(form, data) {
  if (!local || !form || form.getAttribute('aria-busy') === 'true') return;
  const buttons = [...form.querySelectorAll('button')];
  const failure = $('[data-config-error]', form);
  failure.hidden = true;
  form.setAttribute('aria-busy', 'true');
  buttons.forEach(button => { button.disabled = true; });
  try {
    if (checking) await checking;
    const response = await fetch('./api/connection', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) });
    const result = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(result.error || 'Verbindung konnte nicht gespeichert werden.');
    // Don't reuse prior chats when a preset is pointed at another server/model instance.
    if (currentModel()?.provider === data.id) {
      state.generating?.abort();
      state.selection = '';
      state.draft = '';
    }
    for (const key of state.chats.keys()) if (key.startsWith(`${data.id}/`)) state.chats.delete(key);
    state.models = state.models.filter(model => model.provider !== data.id);
    if (modal.open && form.isConnected) modal.close();
    await refreshModels({ announce: true });
  } catch (error) {
    if (modal.open && form.isConnected) {
      failure.textContent = error.message;
      failure.hidden = false;
    } else notify(error.message, 'error');
  } finally {
    form.removeAttribute('aria-busy');
    buttons.forEach(button => { button.disabled = false; });
  }
}
function installerSwitch(provider) {
  return `<div class="installer-switch" role="group" aria-label="Download-Laufzeit">${['ollama', 'lmstudio'].map(id => `<button class="filter-button" type="button" data-action="install-provider" data-id="${id}" aria-pressed="${id === provider}">${icon(id === 'ollama' ? 'terminal' : 'layers', 15)}${esc(providerName(id))}</button>`).join('')}</div>`;
}
function renderCustomDialog(provider) {
  const lmstudio = provider === 'lmstudio';
  const help = lmstudio
    ? `Trage eine ID aus dem <a href="https://lmstudio.ai/models" target="_blank" rel="noreferrer">LM-Studio-Katalog</a> oder eine Hugging-Face-Modell-URL ein.`
    : `Gib den Namen und optional das Tag aus der <a href="https://ollama.com/library" target="_blank" rel="noreferrer">Ollama-Bibliothek</a> ein.`;
  modal.innerHTML = `${modalHeader('Modell hinzufügen', 'Modell-Bibliothek', 'plus')}<div class="modal-content">${installerSwitch(provider)}<p>${help}</p>
    <form id="custom-form"><label class="form-field" for="custom-model"><strong>${lmstudio ? 'Modell-ID oder Hugging-Face-URL' : 'Modellname'}</strong><input class="field" id="custom-model" name="model" placeholder="${lmstudio ? 'z. B. openai/gpt-oss-20b' : 'z. B. llama3.2:1b'}" required maxlength="${lmstudio ? 250 : 200}" autocomplete="off" spellcheck="false"></label>
    ${lmstudio ? '<label class="form-field" for="custom-quant"><strong>Quantisierung <span class="muted">(optional, nur für Hugging Face)</span></strong><input class="field" id="custom-quant" name="quantization" placeholder="z. B. Q4_K_M" maxlength="32" autocomplete="off" spellcheck="false"></label>' : ''}
    <div class="button-row">${button('Abbrechen', { action: 'close-modal' })}<button class="btn btn-primary" type="submit">Weiter ${icon('arrowRight', 16)}</button></div></form></div>`;
}
function openInstall(item, provider) {
  if (!item) return;
  const current = state.pull?.phase === 'active' && state.pull.item.id === item.id ? state.pull.provider : null;
  showModal({ type: 'install', item, provider: provider ?? item.target ?? current ?? preferredInstaller() });
}
function setInstallProvider(provider) {
  const dialog = state.dialog;
  if (!['ollama', 'lmstudio'].includes(provider) || !['install', 'custom'].includes(dialog?.type) || dialog.provider === provider || dialog.item?.target) return;
  dialog.provider = provider;
  renderModal();
  $(`[data-action="install-provider"][data-id="${provider}"]`, modal)?.focus();
}
function renderInstall(item, provider) {
  const lmstudio = provider === 'lmstudio';
  const name = providerName(provider);
  const ref = installRef(item, provider);
  const installed = installedFor(item, provider);
  const pull = transferFor(item, provider);
  const active = pull?.phase === 'active';
  const complete = pull?.phase === 'success';
  const connected = canDownload(provider);
  const busy = !active && state.pull?.phase === 'active';
  let statusHTML;
  if (active) {
    statusHTML = `<div class="progress-panel"><div class="progress-row"><strong id="pull-status">${esc(pull.label)}</strong><span id="pull-percentage"></span></div><progress id="pull-meter" aria-label="${lmstudio ? 'Download-Fortschritt' : 'Fortschritt der aktuellen Modellschicht'}" max="100"></progress></div>${lmstudio ? '<p class="field-hint">Zum Pausieren oder Abbrechen öffne LM Studio.</p>' : ''}`;
  } else if (complete || installed) statusHTML = notice(`Dieses Modell ist in ${name} verfügbar.`);
  else if (pull?.phase === 'error') statusHTML = notice(pull.label, true);
  else if (pull?.phase === 'cancelled') statusHTML = notice(lmstudio ? 'Anzeige beendet. Der Download kann in LM Studio weiterlaufen.' : 'Download in Modelwerk abgebrochen.');
  else if (!ref) statusHTML = notice('Für diese Variante gibt es hier keinen direkten LM-Studio-Eintrag. Suche in LM Studio danach oder gib einen Hugging-Face-Link ein.');
  else if (!connected) statusHTML = notice(lmstudio && isUp(provider)
    ? 'Dein LM-Studio-Server bietet keine REST API v1 für den Download. Aktualisiere LM Studio oder lade das Modell direkt dort herunter.'
    : `${name} ist nicht verbunden. Du kannst die Laufzeit einrichten oder den Befehl kopieren.`);
  else if (busy) statusHTML = notice('Es läuft bereits ein anderer Download.');
  else statusHTML = notice(lmstudio ? 'LM Studio lädt das Modell herunter. Die Größe hängt vom Format und der Quantisierung ab.' : 'Der Download braucht eine Internetverbindung und ausreichend freien Speicherplatz.');
  const link = ref && (lmstudio ? `lms get ${ref}${item.quantization ? `@${item.quantization}` : ''}` : `ollama pull ${ref}`);
  let actions;
  if (active) actions = button(lmstudio ? 'Anzeige stoppen' : 'Download abbrechen', { glyph: 'stop', action: 'stop-pull' });
  else if (installed) actions = button('Chat öffnen', { style: 'primary', glyph: 'message', action: 'open-chat', attrs: `data-key="${esc(installedKey(installed))}"` });
  else if (complete) actions = button('Meine Modelle', { style: 'primary', glyph: 'layers', href: '#modelle' });
  else if (!ref) actions = button('Modell-Link eingeben', { style: 'primary', glyph: 'plus', action: 'custom-lmstudio' });
  else if (busy) actions = button('Laufenden Download ansehen', { glyph: 'download', action: 'show-pull' });
  else if (connected) actions = button('Download starten', { style: 'primary', glyph: 'download', action: 'pull' });
  else actions = button(`${name} verbinden`, { style: 'primary', glyph: 'plug', href: '#verbindung' });
  modal.innerHTML = `${modalHeader(item.name, `${name} · Modell installieren`, 'download')}<div class="modal-content">
    ${item.target ? '' : installerSwitch(provider)}
    <p>${item.description ? `${esc(item.description)}<br>` : ''}${ref ? `<code>${esc(ref)}</code>` : ''}${lmstudio && item.quantization ? ` · ${esc(item.quantization)}` : !lmstudio && item.size ? ` · ca. ${esc(item.size)}` : ''}</p>
    ${statusHTML}${active || installed || complete ? '' : link ? commandBlock(link) : commandBlock(item.name, 'Suchbegriff kopieren')}
    <div class="button-row">${button(active ? 'Im Hintergrund' : 'Schließen', { style: 'quiet', action: 'close-modal' })}${actions}</div></div>`;
  if (active) updatePullProgress(pull);
}
function updatePullProgress(pull) {
  if (!modal.open || state.dialog?.type !== 'install' || transferFor(state.dialog.item, state.dialog.provider) !== pull) return;
  const meter = $('#pull-meter', modal);
  if (!meter) return;
  $('#pull-status', modal).textContent = pull.label;
  $('#pull-percentage', modal).textContent = pull.progress === null ? '' : `${pull.progress} %`;
  if (pull.progress === null) meter.removeAttribute('value');
  else meter.value = pull.progress;
}
function pullLabel(status) {
  if (status === 'downloading') return 'LM Studio lädt das Modell …';
  if (status === 'paused') return 'In LM Studio pausiert';
  if (status === 'pulling manifest') return 'Download wird vorbereitet …';
  if (status.startsWith('pulling')) return 'Modellschicht wird geladen …';
  if (status.includes('verifying')) return 'Dateien werden überprüft …';
  if (status.includes('writing')) return 'Modell wird registriert …';
  if (status === 'success') return 'Download abgeschlossen';
  return 'Download läuft …';
}
async function startPull({ item, provider }) {
  const ref = installRef(item, provider);
  if (!ref || !canDownload(provider) || state.pull?.phase === 'active') return;
  const controller = new AbortController();
  const transfer = { item, provider, ref, controller, phase: 'active', label: 'Download wird vorbereitet …', progress: null };
  state.pull = transfer;
  renderModal();
  $('[data-action="stop-pull"]', modal)?.focus();
  if (state.page === 'uebersicht' || state.page === 'bibliothek') renderPage();
  const showing = () => modal.open && state.dialog?.type === 'install' && transferFor(state.dialog.item, state.dialog.provider) === transfer;
  try {
    await apiStream('pull', { model: ref, provider, quantization: item.quantization }, controller.signal, event => {
      if (event.status) transfer.label = pullLabel(event.status);
      transfer.progress = event.total && Number.isFinite(event.completed) ? Math.floor(event.completed * 100 / event.total) : null;
      updatePullProgress(transfer);
    });
    await refreshModels();
    transfer.phase = 'success';
    notify(`${item.name} ist in ${providerName(provider)} verfügbar.`, 'success');
  } catch (error) {
    transfer.phase = controller.signal.aborted ? 'cancelled' : 'error';
    transfer.label = error.message || 'Der Download ist fehlgeschlagen.';
    if (!showing()) notify(transfer.phase === 'cancelled' ? (provider === 'lmstudio' ? 'Download-Anzeige beendet.' : 'Download abgebrochen.') : transfer.label, transfer.phase === 'error' ? 'error' : 'info');
  } finally {
    if (state.page === 'uebersicht' || state.page === 'bibliothek') renderPage();
    if (showing()) {
      renderModal();
      $('[data-action="close-modal"]', modal)?.focus();
    }
  }
}


let paletteEntries = [];
function refreshPalette(reset = false) {
  const query = $('#palette-query', palette).value.trim();
  const views = Object.entries(pages).map(([id, view]) => ({ id, type: 'Seite', ...view, keywords: id }));
  const installed = state.models.map(model => ({ id: installedKey(model), type: 'Lokal', title: model.name || model.id, icon: 'cpu', keywords: `${model.id} ${providerName(model.provider)}` }));
  const library = catalog.map(item => ({ id: item.id, type: 'Bibliothek', title: item.name, icon: 'download', keywords: catalogKeywords(item) }));
  paletteEntries = [...views, ...installed, ...library].filter(entry => matches(`${entry.title} ${entry.keywords}`, query)).slice(0, 12);
  state.paletteIndex = reset ? 0 : Math.min(state.paletteIndex, Math.max(0, paletteEntries.length - 1));
  $('#palette-results', palette).innerHTML = paletteEntries.length ? paletteEntries.map((entry, index) =>
    `<button class="palette-result${index === state.paletteIndex ? ' active' : ''}" data-action="palette-result" data-index="${index}" role="option" id="palette-option-${index}" aria-selected="${index === state.paletteIndex}" tabindex="-1" type="button">${icon(entry.icon, 16)}<span>${esc(entry.title)}</span><small>${esc(entry.type)}</small></button>`).join('')
    : '<p class="palette-empty" role="status">Keine Treffer. Versuche es mit einem anderen Suchbegriff.</p>';
  setPaletteIndex(state.paletteIndex);
}
function setPaletteIndex(index, scroll = false) {
  state.paletteIndex = index;
  const input = $('#palette-query', palette);
  if (paletteEntries.length) input.setAttribute('aria-activedescendant', `palette-option-${index}`);
  else input.removeAttribute('aria-activedescendant');
  for (const item of palette.querySelectorAll('[data-action="palette-result"]')) {
    const selected = Number(item.dataset.index) === index;
    item.classList.toggle('active', selected);
    item.setAttribute('aria-selected', String(selected));
    if (selected && scroll) item.scrollIntoView({ block: 'nearest' });
  }
}
function openPalette() {
  if (modal.open) return;
  if (palette.open) return palette.close();
  palette.innerHTML = `<div class="palette-input">${icon('search', 19)}<input type="text" id="palette-query" role="combobox" aria-label="Seiten und Modelle suchen" aria-expanded="true" aria-controls="palette-results" aria-autocomplete="list" autocomplete="off" placeholder="Seiten und Modelle suchen …"><button type="button" class="palette-esc" data-action="close-palette" aria-label="Esc – Schnellsuche schließen">Esc</button></div>
    <div class="palette-results" id="palette-results" aria-label="Treffer" role="listbox"></div><div class="palette-hints"><span><kbd>↑</kbd><kbd>↓</kbd> Auswählen</span><span><kbd>Enter</kbd> Öffnen</span><span><kbd>Esc</kbd> Schließen</span></div>`;
  refreshPalette(true);
  palette.showModal();
  $('#palette-query', palette).focus();
}
function choosePalette(index) {
  const chosen = paletteEntries[index];
  if (!chosen) return;
  palette.close();
  if (chosen.type === 'Seite') navigate(chosen.id);
  else if (chosen.type === 'Lokal') selectChat(chosen.id);
  else {
    const item = catalog.find(item => item.id === chosen.id);
    const installed = item && installedFor(item);
    if (installed) selectChat(installedKey(installed));
    else openInstall(item);
  }
}

function setMenu(open, focus = true) {
  const toggle = $('.menu-button');
  document.body.classList.toggle('nav-open', open);
  $('.nav-scrim').hidden = !open;
  $('.workspace').inert = open;
  toggle.setAttribute('aria-expanded', String(open));
  toggle.setAttribute('aria-label', open ? 'Navigation schließen' : 'Navigation öffnen');
  if (focus && open) $('.nav-link[aria-current="page"]')?.focus();
  if (focus && !open) toggle.focus();
}
function showGuide() {
  const guide = $('#startanleitung');
  if (!guide) return;
  guide.scrollIntoView({ block: 'nearest' });
  guide.focus({ preventScroll: true });
}

for (const element of document.querySelectorAll('[data-icon]')) element.innerHTML = icon(element.dataset.icon);
if (/Mac|iPhone|iPad/.test(navigator.platform)) $('#quick-key').textContent = '⌘ K';
$('.nav-scrim').tabIndex = -1;
$('.skip-link').addEventListener('click', event => {
  event.preventDefault();
  app.focus();
  app.scrollIntoView({ block: 'start' });
});

window.addEventListener('hashchange', () => {
  if (document.body.classList.contains('nav-open')) setMenu(false, false);
  syncRoute({ focus: true });
});
mobile.addEventListener('change', event => {
  if (!event.matches) setMenu(false, false);
});
modal.addEventListener('close', () => { if (!modal.open) state.dialog = null; });
for (const dialog of [modal, palette]) dialog.addEventListener('click', event => {
  if (event.target !== dialog) return;
  const { left, top, right, bottom } = dialog.getBoundingClientRect();
  if (event.clientX < left || event.clientX >= right || event.clientY < top || event.clientY >= bottom) dialog.close();
});

document.addEventListener('click', event => {
  const link = event.target.closest('a[href^="#"]');
  if (link && !event.metaKey && !event.ctrlKey && !event.shiftKey && !event.altKey) {
    if (modal.open && modal.contains(link)) modal.close();
    if (document.body.classList.contains('nav-open')) {
      setMenu(false, false);
      if (link.hash === location.hash || (!location.hash && link.hash === '#uebersicht')) app.focus();
    }
  }
  const control = event.target.closest('[data-action]');
  if (!control || control.disabled) return;
  const { action, id, key, value, category, index } = control.dataset;
  switch (action) {
    case 'menu': setMenu(!document.body.classList.contains('nav-open')); break;
    case 'menu-close': setMenu(false); break;
    case 'palette': openPalette(); break;
    case 'close-palette': palette.close(); break;
    case 'palette-result': choosePalette(Number(index)); break;
    case 'refresh': void refreshModels({ announce: true }); break;
    case 'filter': state.libraryFilter = category; refreshLibrary(); break;
    case 'reset-library': {
      state.libraryFilter = 'Alle';
      state.libraryFamily = '';
      state.libraryQuery = '';
      $('#library-family').value = '';
      $('#library-query').value = '';
      refreshLibrary();
      $('#library-query').focus();
      break;
    }
    case 'install': openInstall(catalog.find(item => item.id === id)); break;
    case 'custom': showModal({ type: 'custom', provider: preferredInstaller() }); break;
    case 'custom-lmstudio': showModal({ type: 'custom', provider: 'lmstudio' }); break;
    case 'install-provider': setInstallProvider(id); break;
    case 'add-runtime': showModal({ type: 'provider', id: runtimePresets[0].id, choose: true }); break;
    case 'remove-runtime': void saveRuntime($('#runtime-form', modal), { id, reset: true }); break;
    case 'provider': showModal({ type: 'provider', id }); break;
    case 'guide': showGuide(); break;
    case 'provider-guide': modal.close(); showGuide(); break;
    case 'close-modal': modal.close(); break;
    case 'show-pull': openInstall(state.pull?.item, state.pull?.provider); break;
    case 'pull': if (state.dialog?.type === 'install') void startPull(state.dialog); break;
    case 'stop-pull': state.pull?.controller.abort(); break;
    case 'copy': void copyText(value, control); break;
    case 'open-chat': if (modal.open) modal.close(); selectChat(key); break;
    case 'suggestion': {
      const input = $('#chat-input');
      input.value = value;
      updateDraft(input);
      input.focus();
      break;
    }
    case 'stop-chat': state.generating?.abort(); break;
    case 'new-chat': state.chats.delete(state.selection); state.draft = ''; renderPage(); $('#chat-input')?.focus(); break;
    case 'copy-message': {
      const message = chatHistory()[Number(index)];
      if (message?.content) void copyText(message.content, control);
      break;
    }
  }
});

document.addEventListener('input', event => {
  const input = event.target;
  if (input.id === 'library-query') { state.libraryQuery = input.value; refreshLibrary(); }
  else if (input.id === 'inventory-query') { state.inventoryQuery = input.value; $('#inventory-results').innerHTML = inventoryResults(); }
  else if (input.id === 'palette-query') refreshPalette(true);
  else if (input.id === 'chat-input') updateDraft(input);
  else if (input.id === 'custom-model' || input.id === 'custom-quant') {
    $('#custom-model', modal)?.setCustomValidity('');
    $('#custom-quant', modal)?.setCustomValidity('');
  }
});
app.addEventListener('change', event => {
  if (event.target.id === 'chat-model') selectChat(event.target.value);
  else if (event.target.id === 'library-family') { state.libraryFamily = event.target.value; refreshLibrary(); }
});
modal.addEventListener('change', event => {
  if (event.target.id === 'runtime-preset' && state.dialog?.choose) {
    state.dialog.id = event.target.value;
    renderModal();
    $('#runtime-preset', modal)?.focus();
  }
});
document.addEventListener('submit', event => {
  if (event.target.id === 'composer') { event.preventDefault(); void sendChat(); }
  else if (event.target.id === 'runtime-form') {
    event.preventDefault();
    const form = event.target;
    const fields = new FormData(form);
    const key = String(fields.get('key') || '').trim();
    const data = { id: form.dataset.id, base: String(fields.get('base')).trim() };
    if (fields.has('clearKey')) data.apiKey = '';
    else if (key) data.apiKey = key;
    void saveRuntime(form, data);
  } else if (event.target.id === 'custom-form') {
    event.preventDefault();
    const provider = state.dialog.provider;
    const input = $('#custom-model', modal);
    const id = input.value.trim();
    if (provider === 'lmstudio') {
      const quant = $('#custom-quant', modal);
      const quantization = quant.value.trim();
      if (!validLMStudioModel(id)) {
        input.setCustomValidity('Gib eine Katalog-ID oder eine vollständige Hugging-Face-Modell-URL ein.');
        input.reportValidity();
        return;
      }
      if (quantization && (!isHuggingFaceRepo(id) || !validLMStudioQuantization(quantization))) {
        quant.setCustomValidity('Die Quantisierung ist nur mit einer Hugging-Face-URL möglich, z. B. Q4_K_M.');
        quant.reportValidity();
        return;
      }
      const known = catalog.find(item => item.lmstudio?.toLowerCase() === id.toLowerCase());
      openInstall({ ...known, id: known?.id ?? id, name: known?.name ?? id, lmstudio: id, quantization: quantization || undefined, target: provider });
    } else {
      if (!validOllamaName(id) || isCloudOllamaName(id)) {
        input.setCustomValidity(validOllamaName(id) ? 'Wähle eine lokale Variante, kein Cloud-Modell.' : 'Gib einen gültigen Ollama-Namen ein, zum Beispiel llama3.2:1b.');
        input.reportValidity();
        return;
      }
      const known = catalog.find(item => refersTo(item, id));
      openInstall({ ...known, id, name: known?.name ?? id, target: provider });
    }
    $('[data-action="close-modal"]', modal)?.focus();
  }
});

document.addEventListener('keydown', event => {
  if (event.isComposing) return;
  if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k') {
    event.preventDefault();
    openPalette();
  } else if (palette.open && event.target.id === 'palette-query' && ['ArrowDown', 'ArrowUp', 'Enter'].includes(event.key)) {
    event.preventDefault();
    if (event.key === 'Enter') choosePalette(state.paletteIndex);
    else if (paletteEntries.length) setPaletteIndex((state.paletteIndex + paletteEntries.length + (event.key === 'ArrowDown' ? 1 : -1)) % paletteEntries.length, true);
  } else if (event.target.id === 'chat-input' && event.key === 'Enter' && !event.shiftKey) {
    event.preventDefault();
    if (!state.generating && state.draft.trim()) $('#composer').requestSubmit();
  } else if (event.key === 'Escape' && !modal.open && !palette.open && document.body.classList.contains('nav-open')) setMenu(false);
});

syncRoute();
updateSidebar();
void refreshModels();
