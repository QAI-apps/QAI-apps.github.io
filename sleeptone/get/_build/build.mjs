#!/usr/bin/env node
// Generates per-language /sleeptone/get/{lang}/index.html files from
// template.html + translations.json. Run from anywhere:
//   node _build/build.mjs
// or:
//   cd _build && node build.mjs

import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const pageRoot = resolve(here, '..');

const template = readFileSync(resolve(here, 'template.html'), 'utf8');
const dict = JSON.parse(readFileSync(resolve(here, 'translations.json'), 'utf8'));

const langs = dict._meta.supported;
const defaultLang = dict._meta.default;

// Single source of truth for paths. If the page moves, update only these two.
const origin = 'https://qai-apps.github.io';
const basePath = '/sleeptone/get';
const baseUrl = `${origin}${basePath}`;

// Per-language config: BCP-47 keys (matching translations.json) → metadata.
// Adding a language: extend translations.json + add an entry here.
const LANG_CONFIG = {
  en:      { hreflang: 'en',      og: 'en_US' },
  ja:      { hreflang: 'ja',      og: 'ja_JP' },
  zh:      { hreflang: 'zh-Hans', og: 'zh_CN' },
  'zh-TW': { hreflang: 'zh-Hant', og: 'zh_TW' },
  ko:      { hreflang: 'ko',      og: 'ko_KR' },
};

function pathFor(lang) {
  return lang === defaultLang ? `${basePath}/` : `${basePath}/${lang}/`;
}

function urlFor(lang) {
  return `${origin}${pathFor(lang)}`;
}

// Map of switcher-value → URL, embedded into every page's switcher handler.
const LANG_PATHS_JS = JSON.stringify(
  Object.fromEntries(langs.map((l) => [l, pathFor(l)]))
);

// hreflang <link> block. Same on every page; generated once.
const HREFLANG_LINKS = [
  ...langs.map(
    (l) => `<link rel="alternate" hreflang="${LANG_CONFIG[l].hreflang}" href="${urlFor(l)}">`
  ),
  `<link rel="alternate" hreflang="x-default" href="${urlFor(defaultLang)}">`,
].join('\n');

// Smart-redirect script, injected only into the default-lang root page.
// Runs in <head> before render to avoid flash. Respects user choice stored
// in localStorage. Matches navigator.languages against the supported set.
const REDIRECT_SCRIPT = `<script>
(function() {
  var p = location.pathname;
  if (p !== '${basePath}/' && p !== '${basePath}/index.html') return;
  var stored;
  try { stored = localStorage.getItem('sleeptone-lang'); } catch (_) {}
  if (stored === '${defaultLang}') return;
  if (stored === 'ja' || stored === 'zh' || stored === 'zh-TW' || stored === 'ko') {
    location.replace('${basePath}/' + stored + '/');
    return;
  }
  var langs = navigator.languages || [navigator.language || ''];
  for (var i = 0; i < langs.length; i++) {
    var l = (langs[i] || '').toLowerCase();
    if (l.indexOf('zh-tw') === 0 || l.indexOf('zh-hant') === 0 || l.indexOf('zh-hk') === 0 || l.indexOf('zh-mo') === 0) {
      location.replace('${basePath}/zh-TW/'); return;
    }
    if (l.indexOf('zh') === 0) {
      location.replace('${basePath}/zh/'); return;
    }
    if (l.indexOf('ja') === 0) {
      location.replace('${basePath}/ja/'); return;
    }
    if (l.indexOf('ko') === 0) {
      location.replace('${basePath}/ko/'); return;
    }
    if (l.indexOf('en') === 0) return;
  }
})();
</script>`;

function outputPathFor(lang) {
  return lang === defaultLang
    ? resolve(pageRoot, 'index.html')
    : resolve(pageRoot, lang, 'index.html');
}

function assetPrefixFor(lang) {
  // Relative path back to /sleeptone/get/assets from the generated file.
  return lang === defaultLang ? 'assets' : '../assets';
}

function selectedAttrFor(currentLang) {
  // Returns { en_selected, ja_selected, ... } strings (each is ' selected' or '')
  // replaceAll covers future codes like 'zh-Hant-HK' that have multiple hyphens.
  const out = {};
  for (const l of langs) {
    const key = `${l.replaceAll('-', '_')}_selected`;
    out[key] = l === currentLang ? ' selected' : '';
  }
  return out;
}

function render(lang) {
  const t = dict[lang];
  if (!t) throw new Error(`Missing translations for "${lang}"`);
  if (!LANG_CONFIG[lang]) throw new Error(`Missing LANG_CONFIG for "${lang}"`);

  const subs = {
    ...t,
    canonical_url: urlFor(lang),
    og_locale: LANG_CONFIG[lang].og,
    hreflang_links: HREFLANG_LINKS,
    lang_paths_js: LANG_PATHS_JS,
    redirect_script: lang === defaultLang ? REDIRECT_SCRIPT : '',
    ...selectedAttrFor(lang),
  };

  let html = template;
  for (const [key, value] of Object.entries(subs)) {
    html = html.replaceAll(`{{${key}}}`, value);
  }
  html = html.replaceAll('__ASSETS__', assetPrefixFor(lang));

  // Sanity check: nothing left untemplated
  const remaining = html.match(/\{\{[^}]+\}\}/g);
  if (remaining) {
    throw new Error(`Unfilled placeholders in ${lang}: ${remaining.join(', ')}`);
  }

  return html;
}

let count = 0;
for (const lang of langs) {
  const out = outputPathFor(lang);
  mkdirSync(dirname(out), { recursive: true });
  writeFileSync(out, render(lang), 'utf8');
  console.log(`  ✓ ${lang.padEnd(6)} → ${out.replace(pageRoot + '/', '')}`);
  count++;
}

console.log(`\nGenerated ${count} page${count === 1 ? '' : 's'}.`);
