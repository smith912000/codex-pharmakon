#!/usr/bin/env python3
"""Sync completed Book of Substances manuscript entries into the live Codex site.

Run from the codex-pharmakon repo root, then commit + push to `main`.
GitHub Pages (legacy build, main/root) auto-rebuilds within ~30-60s.

Source of truth: the manuscript canonical_index.csv.
- Every 'done' substance with an entry_file is copied to entries/<CPU-id>_<slug>.md.
- codex_index.json is REGENERATED from the FULL canonical_index (all rows, done+todo),
  so newly-promoted substances (post-reconciliation) are wired automatically.

Entries are members-only, so they are written ENCRYPTED (entries/<id>_<slug>.md.wv).
Plain text never enters the repo. Needs Node and the content key for the quarter in
vault.json, in the environment as WILD_VAULT_KEY (get it from the n8n workflow
"WILD - content key", path "Admin: get keys"; never commit or paste it anywhere).
"""
import csv, json, os, shutil, re, subprocess, sys, tempfile

BOS = os.environ.get("BOS_DIR", r"G:/My Drive/Claude Control/Book Of Substances")
# entries live in three volume folders (plant/fungal-algal I, mineral II, animal III)
MSRCS = [BOS + "/Volume_I_Plant_Based/entries", BOS + "/Volume_II_Mineral_Alchemical/entries",
         BOS + "/Volume_III_Animal_Derived/entries"]
CSV  = BOS + "/canonical_index.csv"
IDX  = "codex_index.json"

def main():
    if not re.fullmatch(r"[0-9a-fA-F]{64}", os.environ.get("WILD_VAULT_KEY", "").strip()):
        sys.exit("WILD_VAULT_KEY is not set: entries must be encrypted. See the note at the top.")
    vault = json.load(open("vault.json", encoding="utf-8"))
    plain = tempfile.mkdtemp(prefix="codex-plain-")  # outside the repo, deleted below
    rows = list(csv.DictReader(open(CSV, encoding="utf-8")))
    subs, synced, missing, dups = [], 0, [], 0
    # Retired rows ("CPU-X ... retired into this row") keep old #materia/CPU-X links working.
    aliases = {}
    for r in rows:
        done = r["status"].strip().lower() == "done" and r["entry_file"].strip()
        entry = None
        if done:
            src = next((os.path.join(d, r["entry_file"].strip()) for d in MSRCS
                        if os.path.exists(os.path.join(d, r["entry_file"].strip()))), "")
            slug = re.sub(r"^(?:I|II|III)_\d+_", "", r["entry_file"].strip())
            name = f"{r['id']}_{slug}"
            if os.path.exists(src):
                shutil.copyfile(src, os.path.join(plain, name)); entry = f"entries/{name}.wv"; synced += 1
            else:
                missing.append(r["id"]); done = False
        # Rows flagged "DUP of CPU-XXXXX" in notes are taxonomic synonyms/duplicates of an
        # entry written under another name. They are NOT outstanding work: mark them
        # 'duplicate' and point at the canonical id so they stop reading as gaps.
        dup_of = None
        m = re.search(r"DUP of (CPU-\d+)", r.get("notes", "") or "")
        if m and not entry:
            dup_of = m.group(1); dups += 1
        notes = r.get("notes", "") or ""
        for old in re.findall(r"(CPU-\d+)[^|]*?retired into this row", notes):
            aliases[old] = r["id"]
        aka = re.search(r"Also known as: ([^|]+)", notes)
        subs.append({
            "id": r["id"], "name": r["canonical_name"], "botanical": r["botanical"],
            "class": r["class"], "volume": r["volume"],
            "sources": [s for s in re.split(r"[;,]", r["sources_attested"]) if s.strip()],
            "uncertain": False,
            "status": "done" if entry else ("duplicate" if dup_of else "todo"),
            "duplicate_of": dup_of, "entry": entry,
            "aka": aka.group(1).strip() if aka else ""})
    try:
        subprocess.run(["node", "tools/wild-vault.mjs", "encrypt", plain, "entries",
                        "--app", vault["app"], "--epoch", vault["epoch"]], check=True)
    finally:
        shutil.rmtree(plain, ignore_errors=True)
    leftovers = [f for f in os.listdir("entries") if not f.endswith(".wv")]
    if leftovers:
        sys.exit(f"Plain files found in entries/ ({leftovers[:3]}...). Remove them before committing.")
    outstanding = sum(1 for s in subs if s["status"] == "todo")
    json.dump({"updated": "reconciled", "count": len(subs), "aliases": aliases, "substances": subs},
              open(IDX, "w", encoding="utf-8"), ensure_ascii=False)
    print(f"index: {len(subs)} substances; synced {synced} entries; "
          f"duplicates {dups}; outstanding {outstanding}; missing source {len(missing)}: {missing[:5]}")
    print("then: git add -A && git commit -m 'sync site' && git push origin main")

if __name__ == "__main__":
    main()
