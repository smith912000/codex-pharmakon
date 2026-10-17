# Launch safety rules (every change, every page)

These rules come from Master Principles rule 23 (web launch legal checks, 15 Oct 2026). Treat a change that breaks one as broken.

1. **No third-party requests on page load.** Fonts, scripts and styles are served from our own GitHub Pages site. Never link `fonts.googleapis.com`, `fonts.gstatic.com` or a CDN (jsDelivr, unpkg, cdnjs). For fonts, use the stylesheets in `https://smith912000.github.io/wild-programme/assets/fonts/`. For a library, vendor it into the repo. Payment and sign-in providers (Whop, PayPal) are fine only on the page or click that actually uses them.
2. **No tracking or session replay before consent.** No Google Analytics, Meta/TikTok pixels, Hotjar, Clarity, FullStory, LogRocket or PostHog replay unless it loads only after the visitor accepts in `consent.js`, and the privacy page says so. Never record keystrokes in forms.
3. **18+ on every signup and checkout.** Every form that takes an email has a required `<input type="checkbox" data-age-ok>` tick ("I am 18 or over and happy to get WILD emails. Unsubscribe any time. Privacy"). Every Whop checkout link goes through `assets/checkout-terms.js`, which `founders-door.js` and `wild-nav.js` load automatically. A new plan gets a line in its PLANS list.
4. **Renewal terms next to every buy button.** State the price, how often it renews, that it renews automatically until cancelled, and how to cancel.
5. **Every email** (Kit) carries the trading name, a postal address and an unsubscribe link. Only email people who opted in.
6. **User uploads** stay on Discord or Whop. If our own site ever hosts uploads, register a DMCA agent at copyright.gov first.
7. When any of the above changes, update the legal page ("02 - Landing Pages/legal.html" in wild-programme) in the same PR.

# Members-only content is encrypted (17 Oct 2026)

- `entries/` and `pages/` hold `.wv` files: AES-256-GCM, decrypted in the browser by `wild-vault.js` with a key from the n8n workflow "WILD - content key". `vault.json` names the quarter (epoch) they were encrypted for.
- Never commit plain `.md` content to this public repo (`.gitignore` blocks it). To edit: get the key from n8n ("Admin: get keys"), put it in `WILD_VAULT_KEY`, run `node tools/wild-vault.mjs decrypt pages /tmp/plain --app codex --epoch <epoch>`, edit, then `encrypt` back. Never paste or commit the key.
- `sync_from_manuscript.py` writes entries already encrypted.
- Each new quarter: `node tools/wild-vault.mjs rotate entries ...` and `rotate pages ...` with `WILD_VAULT_OLD_KEY` and `WILD_VAULT_KEY`, then update `vault.json`.
