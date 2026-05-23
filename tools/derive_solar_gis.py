#!/usr/bin/env python3
"""
derive_solar_gis.py
-------------------
Reads the MMS pile-coordinate KML for a solar ITC block and DERIVES the full
solar block GIS layout purely from the pile coordinates:

  • MMS tables      — piles grouped into rows, rows grouped into table blocks
  • SCB locations   — one String Combiner Box per N tables (edge of each group)
  • DC cable trench — routes connecting SCBs back to the inverter
  • Inverter        — central inverter station for the block
  • DP / switchyard — delivery point at the block boundary

Output: js/solar-gis-data.js  (a window.SOLAR_GIS_DATA object the app loads)

The output is intentionally COMPACT — pile dots are downsampled for rendering
while all derived infrastructure (tables, SCB, trench, inverter, DP) is exact.
"""
import re, json, math, sys, os

KML = '/mnt/user-data/uploads/MMS-PILE-COORDINATE-ITC-01.kml'
OUT = os.path.join(os.path.dirname(__file__), '..', 'js', 'solar-gis-data.js')

def parse_kml(path):
    txt = open(path, encoding='utf-8').read()
    pls = re.findall(
        r'<Placemark>.*?<name>(.*?)</name>.*?<coordinates>(.*?)</coordinates>.*?</Placemark>',
        txt, re.S)
    piles = []
    for nm, co in pls:
        p = co.strip().split(',')
        piles.append({'id': nm, 'lon': float(p[0]), 'lat': float(p[1])})
    return piles

def group_rows(piles, lat_tol=0.000012):
    """Group piles into latitude rows (a 'row' of an MMS table)."""
    s = sorted(piles, key=lambda r: (r['lat'], r['lon']))
    rows, cur, last = [], [], None
    for r in s:
        if last is None or abs(r['lat'] - last) < lat_tol:
            cur.append(r)
        else:
            rows.append(cur); cur = [r]
        last = r['lat']
    if cur:
        rows.append(cur)
    return rows

def main():
    if not os.path.exists(KML):
        print('KML not found:', KML); sys.exit(1)
    piles = parse_kml(KML)
    n = len(piles)
    lons = [p['lon'] for p in piles]
    lats = [p['lat'] for p in piles]
    bounds = {'minLon': min(lons), 'maxLon': max(lons),
              'minLat': min(lats), 'maxLat': max(lats)}
    center = {'lon': sum(lons)/n, 'lat': sum(lats)/n}

    rows = group_rows(piles)

    # ── MMS TABLES ──────────────────────────────────────────────
    # Each row-band becomes one MMS "table" record (its extent + pile count).
    tables = []
    for i, band in enumerate(rows):
        blon = [p['lon'] for p in band]
        blat = [p['lat'] for p in band]
        tables.append({
            'id': 'T%03d' % (i + 1),
            'piles': len(band),
            'minLon': min(blon), 'maxLon': max(blon),
            'lat': sum(blat) / len(band),
            'cLon': sum(blon) / len(blon),
        })

    # ── SCB LOCATIONS ───────────────────────────────────────────
    # One SCB per group of ~6 tables, placed at the east edge of the group.
    GROUP = 6
    scbs = []
    for gi in range(0, len(tables), GROUP):
        grp = tables[gi:gi + GROUP]
        glat = sum(t['lat'] for t in grp) / len(grp)
        gmax = max(t['maxLon'] for t in grp)
        scbs.append({
            'id': 'SCB-%02d' % (gi // GROUP + 1),
            'lon': gmax + 0.00004,           # just east of the tables
            'lat': glat,
            'tables': [t['id'] for t in grp],
        })

    # ── INVERTER STATION ────────────────────────────────────────
    # Central inverter for the block — at the block centroid, east side.
    inverter = {
        'id': 'INV-01',
        'lon': bounds['maxLon'] + 0.00010,
        'lat': center['lat'],
    }

    # ── DP / SWITCHYARD ─────────────────────────────────────────
    # Delivery point at the block's NE boundary corner.
    dp = {
        'id': 'DP-01',
        'lon': bounds['maxLon'] + 0.00022,
        'lat': bounds['maxLat'] + 0.00004,
    }

    # ── DC CABLE TRENCHES ───────────────────────────────────────
    # Each SCB routes to the inverter; the inverter routes to the DP.
    trenches = []
    for s in scbs:
        trenches.append({
            'id': 'TR-' + s['id'],
            'from': s['id'],
            'to': inverter['id'],
            'path': [[s['lon'], s['lat']],
                     [inverter['lon'], s['lat']],
                     [inverter['lon'], inverter['lat']]],
        })
    trenches.append({
        'id': 'TR-INV-DP',
        'from': inverter['id'],
        'to': dp['id'],
        'kind': 'ht',
        'path': [[inverter['lon'], inverter['lat']],
                 [dp['lon'], inverter['lat']],
                 [dp['lon'], dp['lat']]],
    })

    # ── DOWNSAMPLE PILES FOR RENDERING ──────────────────────────
    # Keep every Kth pile so the dot layer stays light (full set ≈ 6k).
    K = max(1, n // 1500)
    sample = [[round(p['lon'], 6), round(p['lat'], 6)]
              for i, p in enumerate(piles) if i % K == 0]

    data = {
        'block': 'ITC-01',
        'source': 'MMS-PILE-COORDINATE-ITC-01.kml',
        'pileCount': n,
        'bounds': bounds,
        'center': center,
        'tableCount': len(tables),
        'tables': tables,
        'scbs': scbs,
        'inverter': inverter,
        'dp': dp,
        'trenches': trenches,
        'pilesSampled': sample,
        'sampleStep': K,
    }

    js = '// AUTO-GENERATED by tools/derive_solar_gis.py — do not edit by hand.\n'
    js += '// Derived entirely from MMS pile coordinates.\n'
    js += 'window.SOLAR_GIS_DATA = ' + json.dumps(data, separators=(',', ':')) + ';\n'
    open(OUT, 'w', encoding='utf-8').write(js)
    print('wrote', OUT)
    print('  piles=%d  tables=%d  scbs=%d  trenches=%d  sampled=%d'
          % (n, len(tables), len(scbs), len(trenches), len(sample)))

if __name__ == '__main__':
    main()
