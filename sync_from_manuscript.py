#!/usr/bin/env python3
"""Sync completed Book of Substances manuscript entries into the live Codex site.

Run from the codex-pharmakon repo root, then commit + push to `main`.
GitHub Pages (legacy build, main/root) auto-rebuilds within ~30-60s.

Source of truth: the manuscript canonical_index.csv.
- Every 'done' substance with an entry_file is copied to entries/<CPU-id>_<slug>.md.
- codex_index.json is REGENERATED from the FULL canonical_index (all rows, done+todo),
  so newly-promoted substances (post-reconciliation) are wired automatically.
"""
import csv, json, os, shutil, re

MSRC = r"G:/My Drive/Book Of Substances/Volume_I_Plant_Based/entries"
CSV  = r"G:/My Drive/Book Of Substances/canonical_index.csv"
IDX  = "codex_index.json"

def main():
    rows = list(csv.DictReader(open(CSV, encoding="utf-8")))
    subs, synced, missing = [], 0, []
    for r in rows:
        done = r["status"].strip().lower() == "done" and r["entry_file"].strip()
        entry = None
        if done:
            src = os.path.join(MSRC, r["entry_file"].strip())
            slug = re.sub(r"^I_\d+_", "", r["entry_file"].strip())
            dest = f"entries/{r['id']}_{slug}"
            if os.path.exists(src):
                shutil.copyfile(src, dest); entry = dest; synced += 1
            else:
                missing.append(r["id"]); done = False
        subs.append({
            "id": r["id"], "name": r["canonical_name"], "botanical": r["botanical"],
            "class": r["class"], "volume": r["volume"],
            "sources": [s for s in re.split(r"[;,]", r["sources_attested"]) if s.strip()],
            "uncertain": False, "status": "done" if entry else "todo", "entry": entry})
    json.dump({"updated": "reconciled", "count": len(subs), "substances": subs},
              open(IDX, "w", encoding="utf-8"), ensure_ascii=False)
    print(f"index: {len(subs)} substances; synced {synced} entries; missing source {len(missing)}: {missing[:5]}")
    print("then: git add -A && git commit -m 'sync site' && git push origin main")

if __name__ == "__main__":
    main()
