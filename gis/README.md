# QGIS map workspace

Open `xpoint-branches.qgz` in QGIS 3.44 or newer. It has two relative-path layers:

For an offline copy, download `xpoint-qgis.zip`, extract all files together, and open the `.qgz` inside. No site installation or API key is needed.

- `provinces.geojson`: all 31 provinces, EPSG:4326, checked with QGIS/GEOS and repaired only when invalid.
- `branches.geojson`: all 94 source records. Valid source coordinates are point geometries; branches without verified coordinates keep a null geometry and remain visible in the attribute table.

The project displays in EPSG:3857, matching the website's Mercator projection. Province polygons are gray; X.point markers are orange, X.Vision Shop markers are blue, and Maadiran/Kanon markers are dark gray. No points are shifted to separate overlapping markers.

`qa-report.json` records engine version, source hashes, repair results, province membership checks, coordinate preservation, and missing-location records. It does not claim to independently survey branch addresses. Source locations still need operational confirmation when missing or ambiguous.

`provinces-source.geojson` preserves the original input boundaries, including the invalid Lorestan geometry that QGIS repairs during generation. This source is not rendered by the website or the QGIS project; retaining it makes the export/repair reproducible.

## Regenerate

From a QGIS/OSGeo4W Python environment, run:

```powershell
python tools/build_gis.py --write-web
```

With a standard Windows QGIS LTR installation, use its bundled `python-qgis-ltr.bat` in place of `python`. QGIS must be able to load its core/provider DLLs; a regular pip Python environment is insufficient.

Without `--write-web`, the script rebuilds the QGIS workspace and QA report without replacing the website boundary asset. With it, the validated GeoJSON is exported to the same `assets/provinces.json` URL used by the landing page. Branch coordinates and the website's `branches.json` are never changed by this command.

The browser does not load QGIS or these workspace files. There is no new framework, server, API key, interface change, or extra download for visitors. The website's existing SVG rendering, filters, selection flow, marker colors, contact cards and Neshan destinations continue to use the existing contracts.

After editing locations in QGIS, do not replace website data blindly: confirm the coordinates, update the corresponding stable ID in `branches.json`, and regenerate/validate the workspace. Unverified missing points must not be placed at city centers.

## Attribution

The province layer retains the source and licensing documented in the repository root README and `assets/MAP-LICENSE.txt`. The branch data comes from the user-supplied workbook; no internal extensions or email addresses are included.
