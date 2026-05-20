# SleepTone landing page build

Generates the multilingual landing pages under `/sleeptone/get/{lang}/` from a
single source.

## Files

- `template.html` — HTML source with `{{key}}` placeholders and `__ASSETS__`
  asset-prefix markers.
- `translations.json` — strings for every supported language. `_meta.supported`
  lists the languages; `_meta.default` is the root (English).
- `build.mjs` — Node script that combines them.

## Rebuild after editing source

From `/sleeptone/get/`:

```bash
node _build/build.mjs
```

Output: overwrites `index.html` (English, with smart-redirect script) and
`{lang}/index.html` for each non-default language.

## Add a new language

1. Add the language code to `_meta.supported` in `translations.json`.
2. Add a full block of strings under that key (copy English as a starting point).
3. If the BCP-47 code is new, add an `OG_LOCALES` entry in `build.mjs`.
4. Add a `<option>` for it in `template.html` (inside the `.lang-switch` `<select>`).
5. Update the smart-redirect script in `build.mjs` (`REDIRECT_SCRIPT`) to map
   browser language strings to the new path.
6. Re-run `node _build/build.mjs`.

## Notes

- The `_build/` directory is Jekyll-ignored (leading underscore), so GitHub
  Pages will not publish it.
- Asset paths use `__ASSETS__` so the build script can resolve the correct
  relative prefix per output depth.
- The smart-redirect script is injected only into the default-lang root
  (`/sleeptone/get/index.html`). Subdir pages are direct landing targets.
- Users can override auto-detection via the language switcher; their choice is
  saved in `localStorage` under the `sleeptone-lang` key.
