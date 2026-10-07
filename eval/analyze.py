# Summarise a run-sample.mts results file.
# Usage: python3 eval/analyze.py [eval/results/results.jsonl]
import json,statistics,collections,sys,os
path=sys.argv[1] if len(sys.argv)>1 else os.path.join(os.path.dirname(os.path.abspath(__file__)),"results","results.jsonl")
rows=[json.loads(l) for l in open(path)]
n=len(rows); oc=collections.Counter(r["outcome"] for r in rows)
print("n",n,"outcomes",dict(oc))
ans=[r for r in rows if r["outcome"]=="answered"]
def pct(a,b): return f"{a}/{b} = {100*a/b:.1f}%" if b else "n/a"
print("harness quoteVerified (all n)", pct(sum(r["score"]["quoteVerified"] for r in rows),n))
print("harness anchorResolves (all n)", pct(sum(r["score"]["anchorResolves"] for r in rows),n))
print("harness citedExpectedDocument (all n, undefined=pass)", pct(sum(r["score"]["citedExpectedDocument"] for r in rows),n))
d=[r for r in rows if r["expect"].get("documentId")]
print("strict correct doc (defined expect, all outcomes)", pct(sum(r["score"]["citedExpectedDocument"] for r in d),len(d)))
da=[r for r in d if r["outcome"]=="answered"]
print("correct doc among answered w/ defined expect", pct(sum(r["score"]["citedExpectedDocument"] for r in da),len(da)))
s=[r for r in rows if r["expect"].get("silent")]
print("silence expected:", [(r["id"],r["outcome"],r.get("silence")) for r in s])
nons=[r for r in ans if not r["expect"].get("silent")]
print("false silence (declared silence on non-silent answered q)", pct(sum(1 for r in nons if r["silence"]),len(nons)))
re=[r for r in rows if len(r["attempts"])>1]
print("questions re-prompted", pct(len(re),n))
calls=sum(len(r["attempts"]) for r in rows); rej=sum(1 for r in rows for a in r["attempts"] if a.get("priorFailures"))
print("draft calls",calls,"rejected drafts (=re-prompts)",rej, "per-draft rejection", pct(rej + sum(1 for r in rows if r["outcome"]=="withheld"), calls))
reasons=collections.Counter(x for r in rows for a in r["attempts"] for x in set(a.get("priorFailures",[])))
print("re-prompt reasons",dict(reasons))
lat=[r["ms"]/1000 for r in rows]; la=[r["ms"]/1000 for r in ans]
print("median latency all %.1fs answered %.1fs p90 %.1fs"%(statistics.median(lat),statistics.median(la) if la else 0, sorted(lat)[int(.9*len(lat))-1]))
# anchor match: expected anchor token appears in any cited anchor (loose)
import re as R
def norm(a): return R.sub(r"[^0-9a-z.]","",a.lower().replace("section","").replace("lqss","").replace("§",""))
am=[r for r in da if r["expect"].get("anchor")]
hit=0
for r in am:
    e=norm(r["expect"]["anchor"]); 
    if any(e and (e in norm(c["anchor"]) or norm(c["anchor"]).startswith(e)) for c in r["cited"]): hit+=1
print("loose expected-anchor match", pct(hit,len(am)))
for r in rows:
    if r["outcome"]!="answered": print("NONANS",r["id"],r["outcome"],(r.get("message") or json.dumps(r.get("failures")))[:300])
for r in da:
    if not r["score"]["citedExpectedDocument"]: print("WRONGDOC",r["id"],r["expect"],[c["documentId"][:45]+" "+c["anchor"] for c in r["cited"]], "SIL" if r["silence"] else "")
