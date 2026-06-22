"""
T2 head-to-head, graphify side: can graphify's graph bridge the strategy dispatch
that LSP resolved (dispatcher -> interface -> concrete getDecision impls)?

Reads the raw AST extract (.graphify_extract.json), whose node schema is
{id,label,type,file,line,lang}. (The networkx graph.json export renames these,
which caused an earlier false negative — read the raw extract here.)

Run AFTER _build_graph.py.
"""
import json
from pathlib import Path

raw = json.loads((Path.cwd() / "graphify-out" / ".graphify_extract.json").read_text())
nodes = raw["nodes"]
edges = raw["edges"]

INTERFACE = "ExtractionEligibilityStrategy"
DISPATCHER = "analyzeEligibility_analyzeEligibility"

implements = [e for e in edges if e.get("relation") == "implements" and e.get("target") == INTERFACE]
dispatcher_refs_iface = [
    e for e in edges
    if e.get("source") == DISPATCHER and e.get("target") == INTERFACE
]
dispatcher_calls_getdecision = [
    e for e in edges
    if e.get("source") == DISPATCHER and e.get("target") == "getDecision" and e.get("relation") == "calls"
]

print("=== graphify T2 bridge evidence ===")
print(f"concrete --implements--> {INTERFACE}: {len(implements)}")
for e in implements:
    print(f"  {e['source']} --implements--> {e['target']}")
print(f"\ndispatcher --references--> interface: {len(dispatcher_refs_iface)}")
print(f"dispatcher --calls--> getDecision:   {len(dispatcher_calls_getdecision)}")

bridges = bool(implements) and (bool(dispatcher_refs_iface) or bool(dispatcher_calls_getdecision))
print("\nVERDICT:", "graphify BRIDGES dispatch (via interface node)" if bridges
      else "graphify does NOT bridge dispatch")
print("NOTE: LSP also bridges this dispatch, more precisely and without the node-id")
print("      collisions / duplicate-edge noise visible in graphify's output.")
