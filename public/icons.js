const paths = {
  layout: '<rect x="3" y="3" width="7" height="7" rx="1.1"/><rect x="14" y="3" width="7" height="7" rx="1.1"/><rect x="3" y="14" width="7" height="7" rx="1.1"/><rect x="14" y="14" width="7" height="7" rx="1.1"/>',
  message: '<path d="M21 11.5a8.4 8.4 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.4 8.4 0 0 1-3.8-.9L3 21l1.9-5.7a8.4 8.4 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.4 8.4 0 0 1 3.8-.9h.5a8.5 8.5 0 0 1 8 8z"/>',
  layers: '<path d="m12 3 9 5-9 5-9-5 9-5Zm-9 9 9 5 9-5M3 16l9 5 9-5"/>',
  library: '<rect x="3" y="4" width="4" height="16" rx=".8"/><rect x="9" y="4" width="4" height="16" rx=".8"/><path d="m15.2 5.2 3.7-1 3.6 15-3.7 1z"/>',
  plug: '<path d="M9 3v5m6-5v5m-9 0h12v3a6 6 0 0 1-6 6v4m0-4a6 6 0 0 1-6-6V8Z"/>',
  cpu: '<rect x="5" y="5" width="14" height="14" rx="2"/><rect x="9" y="9" width="6" height="6" rx=".7"/><path d="M9 2v3m6-3v3M9 19v3m6-3v3M2 9h3m-3 6h3m14-6h3m-3 6h3"/>',
  panel: '<rect x="3" y="4" width="18" height="16" rx="2"/><path d="M9 4v16"/>',
  chevronRight: '<path d="m9 6 6 6-6 6"/>',
  arrowRight: '<path d="M4.5 12h14.8m-6-6 6 6-6 6"/>',
  arrowUpRight: '<path d="M7 17 17 7M7 7h10v10"/>',
  search: '<circle cx="11" cy="11" r="6.4"/><path d="m16 16 4 4"/>',
  shield: '<path d="M12 22s7-3.2 7-9V5l-7-3-7 3v8c0 5.8 7 9 7 9Z"/><path d="m9 12 2 2 4-4"/>',
  lock: '<rect x="5" y="10" width="14" height="11" rx="2"/><path d="M8 10V7a4 4 0 1 1 8 0v3m-4 4v3"/>',
  sparkle: '<path d="M11.5 3a9 9 0 0 0 8.5 8.5A9 9 0 0 0 11.5 20 9 9 0 0 0 3 11.5 9 9 0 0 0 11.5 3ZM19 2v5m-2.5-2.5h5"/>',
  refresh: '<path d="M20 7.5V3m0 4.5h-4.5M4 16.5V21m0-4.5h4.5m11-9a8 8 0 0 0-13.8-2L4 7.5m16 9-1.7 2A8 8 0 0 1 4.5 16.5"/>',
  download: '<path d="M12 3v12m-4-4 4 4 4-4M4 16v3a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-3"/>',
  drive: '<rect x="3" y="12" width="18" height="7" rx="2"/><path d="m3.4 13 2.4-7a1.5 1.5 0 0 1 1.4-1h9.6a1.5 1.5 0 0 1 1.4 1l2.4 7M7 15.5h.01m3 0h.01"/>',
  plus: '<path d="M12 5v14m-7-7h14"/>',
  x: '<path d="m6 6 12 12M18 6 6 18"/>',
  menu: '<path d="M4 6h16M4 12h16M4 18h16"/>',
  check: '<path d="m5 12 4 4L19 6"/>',
  checkCircle: '<circle cx="12" cy="12" r="9"/><path d="m8 12 2.5 2.5L16 9"/>',
  info: '<circle cx="12" cy="12" r="9"/><path d="M12 11v5m0-8h.01"/>',
  terminal: '<rect x="3" y="4" width="18" height="16" rx="2"/><path d="m7 9 3 3-3 3m6 0h4"/>',
  copy: '<rect x="8" y="8" width="12" height="12" rx="2"/><path d="M16 8V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h2"/>',
  send: '<path d="M12 19V5m-6 6 6-6 6 6"/>',
  stop: '<rect x="6" y="6" width="12" height="12" rx="1.6" fill="currentColor" stroke="none"/>',
  user: '<circle cx="12" cy="8" r="3.4"/><path d="M5 20v-1.5a5 5 0 0 1 5-5h4a5 5 0 0 1 5 5V20"/>',
  box: '<path d="m12 3 8 4.5v9L12 21l-8-4.5v-9L12 3Zm-8 4.5 8 4.5 8-4.5M12 12v9m-4-15.7 8 4.5"/>',
  filter: '<path d="M4 6h16M7 12h10m-7 6h4"/>',
  command: '<path d="M9 7V6a2 2 0 1 0-2 2h10a2 2 0 1 0-2-2v12a2 2 0 1 0 2-2H7a2 2 0 1 0 2 2V7Z"/>',
  github: '<path fill="currentColor" stroke="none" d="M12 2a10 10 0 0 0-3.16 19.49c.5.09.68-.22.68-.48v-1.86c-2.78.6-3.37-1.18-3.37-1.18-.45-1.15-1.11-1.46-1.11-1.46-.91-.62.07-.6.07-.6 1 .07 1.53 1.02 1.53 1.02.89 1.52 2.34 1.08 2.91.83.09-.64.35-1.08.64-1.33-2.22-.25-4.55-1.11-4.55-4.95 0-1.09.39-1.99 1.03-2.68-.1-.25-.45-1.27.1-2.64 0 0 .84-.27 2.75 1.02a9.6 9.6 0 0 1 5.01 0c1.91-1.29 2.75-1.02 2.75-1.02.55 1.37.2 2.39.1 2.64.64.69 1.03 1.59 1.03 2.68 0 3.85-2.34 4.69-4.57 4.94.36.31.68.92.68 1.85v2.74c0 .26.18.57.69.47A10 10 0 0 0 12 2Z"/>',
};

export const icon = (name, size = 18) => `<svg aria-hidden="true" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.65" stroke-linecap="round" stroke-linejoin="round" focusable="false">${paths[name] ?? paths.box}</svg>`;

const brands = {
  meta: '<path d="M3 15.1c0-4 2-7.8 4.7-7.8 1.6 0 3 .9 4.7 3.5l2.1 3.4c1.1 1.8 1.8 2.7 3 2.7 1.1 0 1.6-.9 1.6-2.5 0-3.2-1.3-5.5-3.1-5.5-1.6 0-2.8 1.6-4 3.5l-1.8 3c-1.7 2.8-2.7 3.4-4 3.4-2 0-3.2-1.4-3.2-3.7Z" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"/>',
  qwen: '<path d="m12 2.8 4.3 3.3 4.8 1.8-.6 4.9.6 4.1-4.8 1.5-4.3 2.8-3.8-3.5-5-1.2.7-4.4-.7-4.4 4.7-1.2L12 2.8Z" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"/><path d="m12 6.6 4.5 2.7v5.4L12 17.5l-4.5-2.8V9.3L12 6.6Z" stroke="currentColor" stroke-width="1.45" stroke-linejoin="round"/><path d="m12 6.6 4.5 8.1h-9L12 6.6Z" fill="currentColor" opacity=".63"/>',
  gemma: '<path d="M12 2.5c.8 5.9 3.7 8.7 9.5 9.5-5.8.8-8.7 3.7-9.5 9.5-.8-5.8-3.7-8.7-9.5-9.5 5.8-.8 8.7-3.6 9.5-9.5Z" fill="currentColor"/><path d="M18.5 3v4m-2-2h4" stroke="currentColor" stroke-width="1.25" stroke-linecap="round" opacity=".7"/>',
  mistral: '<path fill="currentColor" d="M3 6h4v3h3v3h4V9h3V6h4v13h-4v-6h-3v3h-4v-3H7v6H3z"/>',
  deepseek: '<path fill="currentColor" d="M21.8 6.6c-1.5.1-2.4.9-2.8 1.9-.9-.1-2.5-.6-3.9-1.6C10.9 4.2 6.4 5 4 8c-1.9 2.4-1.2 5.5.4 7.5 2.2 2.8 6.4 3.6 9.7 2.4 3.3-1.1 5.1-3.3 5.5-6.9 1.8-.7 2.8-2.3 2.2-4.4Zm-7.1 7c-1.2 2-4.2 2.7-6.1 1.2-.9-.7-1.1-1.9-.8-2.8 1.8 1.1 4.3 1.3 6.2-.1.5-.3.9.8.7 1.7Z"/>',
  phi: '<rect x="3.5" y="3.5" width="7.5" height="7.5" rx="1" fill="currentColor"/><rect x="13" y="3.5" width="7.5" height="7.5" rx="1" fill="currentColor" opacity=".7"/><rect x="3.5" y="13" width="7.5" height="7.5" rx="1" fill="currentColor" opacity=".7"/><rect x="13" y="13" width="7.5" height="7.5" rx="1" fill="currentColor" opacity=".45"/>',
};

export function modelIcon(brand = 'generic', size = 24) {
  return Object.hasOwn(brands, brand)
    ? `<svg aria-hidden="true" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" focusable="false">${brands[brand]}</svg>`
    : icon('box', size);
}
