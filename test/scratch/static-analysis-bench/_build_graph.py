"""
Build a graphify CODE graph for src/ deterministically (AST/tree-sitter, no LLM).

graphify's parallel extractor crashes under Python 3.14 (BrokenProcessPool), so we
extract each .ts file SERIALLY and merge. This is the deterministic-core build used
to settle the open T2 question: does graphify bridge the strategy dispatch
(analyzeEligibility call site -> concrete strategies) that LSP resolved?
"""
import json
from pathlib import Path
from graphify.extract import extract
from graphify.build import build_from_json
from graphify.cluster import cluster
from graphify.export import to_json

repo = Path.cwd()
src = repo / "src"
out = repo / "graphify-out"
out.mkdir(exist_ok=True)

code_files = sorted(src.rglob("*.ts"))
print(f"code files: {len(code_files)}")

all_nodes, all_edges = [], []
seen_ids = set()
errors = 0
for f in code_files:
    try:
        r = extract([f], cache_root=repo)  # single-file path proven to work
    except Exception as ex:
        errors += 1
        print(f"  ERR {f.relative_to(repo)}: {type(ex).__name__}")
        continue
    for n in r.get("nodes", []):
        nid = n.get("id")
        if nid not in seen_ids:
            seen_ids.add(nid)
            all_nodes.append(n)
    all_edges.extend(r.get("edges", []))

print(f"merged: {len(all_nodes)} nodes, {len(all_edges)} edges, {errors} file errors")

merged = {"nodes": all_nodes, "edges": all_edges, "input_tokens": 0, "output_tokens": 0}
(out / ".graphify_extract.json").write_text(json.dumps(merged, indent=2))

G = build_from_json(merged)
communities = cluster(G)
to_json(G, communities, str(out / "graph.json"))
print(f"graph.json written: {G.number_of_nodes()} nodes, {G.number_of_edges()} edges")
