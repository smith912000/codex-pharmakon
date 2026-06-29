#!/usr/bin/env python3
"""Sync completed Book of Substances manuscript entries into the live Codex site.

Run from the codex-pharmakon repo root, then commit + push to `main`.
GitHub Pages (legacy build, main/root) auto-rebuilds within ~30-60s and the
live page at https://smith912000.github.io/codex-pharmakon/ updates.

Source of truth: the manuscript canonical_index.csv (status==done + entry_file).
Each done substance is copied into entries/<CPU-id>_<slug>.md and wired into
codex_index.json (entry path + status). Substances not yet done are left as-is.
"""
import csv, json, os, shutil, re

MSRC = r"G:/My Drive/Book Of Substances/Volume_I_Plant_Based/entries"
CSV  = r"G:/My Drive/Book Of Substances/canonical_index.csv"
IDX  = "codex_index.json"

def main():
    rows = list(csv.DictReader(open(CSV, encoding="utf-8")))
    idx  = json.load(open(IDX, encoding="utf-8"))
    by_id = {s["id"]: s for s in idx["substances"]}
    synced, missing = 0, []
    for r in rows:
        if r["status"] != "done" or not r["entry_file"]:
            continue
        src = os.path.join(MSRC, r["entry_file"])
        if not os.path.exists(src):
            missing.append(r["id"]); continue
        slug = re.sub(r'^I_\d+_', '', r["entry_file"])
        dest = f"entries/{r['id']}_{slug}"
        shutil.copyfile(src, dest)
        if r["id"] in by_id:
            by_id[r["id"]]["entry"] = dest
            by_id[r["id"]]["status"] = "done"
            synced += 1
    json.dump(idx, open(IDX, "w", encoding="utf-8"), ensure_ascii=False)
    print(f"synced {synced} entries; missing source {len(missing)}: {missing[:5]}")
    print("then: git add -A && git commit -m 'sync site' && git push origin main")

if __name__ == "__main__":
    main()
