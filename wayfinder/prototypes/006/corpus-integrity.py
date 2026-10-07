#!/usr/bin/env python3
"""Suite B - corpus integrity. Cross-checks every regulatory citation appearing
in any corpus document against the section/part it names. Exit 1 on any dangling
citation. Run after every reconversion, before serving answers.

Usage: python3 corpus-integrity.py <corpus-md-dir>
"""
import re, sys, glob, os

ROMAN = ['I','II','III','IV','V','VI','VII','VIII','IX','X','XI','XII','XIII','XIV']

def main(d):
    p130 = open(os.path.join(d,'part-130-cannabis-laboratories.md')).read()
    sections = set(re.findall(r'130\.(\d+)', p130))
    lqss = open(os.path.join(d,'laboratory-quality-system-standards-2-9-26.md')).read()
    parts = set(re.findall(r'^([IVXL]{1,5})\.\s+[A-Z]', lqss, re.M))

    print(f"Part 130 sections : 130.1-130.{max(int(x) for x in sections)}")
    print(f"LQSS parts        : {' '.join(sorted(parts, key=lambda r: ROMAN.index(r) if r in ROMAN else 99))}")
    missing = [r for r in ROMAN[:max(ROMAN.index(p) for p in parts if p in ROMAN)+1] if r not in parts]
    if missing:
        print(f"NOTE: LQSS has no Part {', '.join(missing)} (gap in source numbering)")
    print()

    bad = []
    for f in sorted(glob.glob(os.path.join(d,'*.md'))):
        base = os.path.basename(f)
        if base == 'part-130-cannabis-laboratories.md':
            continue
        t = open(f).read()
        for m in re.finditer(r'130\.(\d+)', t):
            if m.group(1) not in sections:
                bad.append((base, t[:m.start()].count('\n')+1, f"130.{m.group(1)}"))
        for m in re.finditer(r'LQSS,?\s*([IVXL]{1,5})\b', t):
            if m.group(1) not in parts:
                bad.append((base, t[:m.start()].count('\n')+1, f"LQSS {m.group(1)}"))

    if not bad:
        print("PASS - no dangling citations")
        return 0
    print(f"FAIL - {len(bad)} dangling citation(s):\n")
    for f, ln, c in sorted(set(bad)):
        print(f"  {c:12} cited in {f} (line {ln}) - target does not exist")
    return 1

if __name__ == '__main__':
    sys.exit(main(sys.argv[1] if len(sys.argv) > 1 else '.'))
