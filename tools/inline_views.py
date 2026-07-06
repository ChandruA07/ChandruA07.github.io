#!/usr/bin/env python3
"""
inline_views.py — regenerate the INLINED VIEW PARTIALS block in index.html.

The dashboard runs in single-file mode: loader.js reads each view from an
inert <template data-partial="views/…"> element inlined in index.html, so no
web server is needed. If you edit any file under views/, run:

    python3 tools/inline_views.py

from the project root to refresh the inlined copies.
"""
import re, sys, os

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
IDX  = os.path.join(ROOT, 'index.html')

ORDER = [
 'views/login.html','views/modal-pov.html','views/modal-tov.html','views/modal-lov.html',
 'views/sidebar.html','views/topbar.html',
 'views/view-home.html','views/view-solar.html','views/view-itc.html',
 'views/view-wtg.html','views/view-zp.html','views/view-land.html','views/view-landwtg.html',
 'views/view-landsol.html','views/view-bop.html','views/view-bop-33kv.html',
 'views/view-bop-66kv.html','views/view-bop-pss.html','views/view-bop-gss.html',
 'views/view-pod.html','views/view-safety.html','views/view-manpower.html',
 'views/view-map.html','views/view-procurement.html','views/view-vendors.html','views/view-inventory.html','views/view-planning.html','views/view-documents.html','views/view-reports.html','views/view-audit.html','views/footer.html'
]

def main():
    idx = open(IDX, encoding='utf-8').read()
    for f in ORDER:
        html = open(os.path.join(ROOT, f), encoding='utf-8').read()
        if '</template>' in html:
            sys.exit(f'ERROR: {f} contains </template> — cannot inline.')
        block = f'<template data-partial="{f}">\n{html}\n</template>'
        pat = re.compile(r'<template data-partial="' + re.escape(f) + r'">.*?</template>', re.S)
        if pat.search(idx):
            idx = pat.sub(lambda m: block, idx, count=1)
        else:
            sys.exit(f'ERROR: no existing template for {f} in index.html — add one manually first.')
    open(IDX, 'w', encoding='utf-8').write(idx)
    print(f'Refreshed {len(ORDER)} inlined templates in index.html')

if __name__ == '__main__':
    main()
