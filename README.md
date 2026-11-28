# X.point branch locator

Persian, RTL, responsive standalone branch locator. Select an Iranian province on the SVG map or from the accessible list, then view that province and its branches. Province links use `#province=` and work on GitHub Pages without rewrite rules. No framework, API keys, tracking, CDN, or build step.

## Local preview

Run `python -m http.server 4177` from this folder and open http://localhost:4177 . Use an HTTP server rather than opening index.html directly.

## Branch data

`branches.json` contains all 94 records from the user-supplied `لیست شعب 14050708.xlsx` (Sheet1, rows 2–95): 12 X.point, 51 Maadiran, 30 retirement associations (Kanon), and 1 X.Vision Shop. Category comes from the store type first (Kanon), then brand. 92 records are active and 2 are being redesigned; non-active records retain their source status prominently. Province spelling is normalized to the map dataset. No internal extension, postal code, opening date, or staff/store email is published.

81 records have coordinates extracted from explicit map pin URLs, numeric Google Maps search destinations, or the `data-ssr-loc` coordinates of the supplied Neshan share links. Use the final `!3d/!4d` pair, never a viewport `@` camera coordinate. 13 records have no reliable exact branch pin; two of these retain their supplied Neshan place links. A Google link naming the entire city of Malayer is excluded as a branch pin. Missing positions are not guessed or geocoded to city centers. All 94 records remain listed with their available contact/address data.

Phone actions use validated Iranian 11-digit numbers, handling reversed area codes, multiline phone lists and abbreviated landline ranges (first number for dialing, original text retained for display). A mobile number missing its leading zero is formatted with the standard zero prefix. The malformed Malayer contact is displayed as provided with a verification note and no call action.

Neshan routing opens the web route with the exact branch destination using `/maps/routing/car/destination/{latitude},{longitude}`; users choose their origin in Neshan. This route format was verified against Neshan's public client route parser (`3524-6a36d51b75de1fee0b3e.js`, checked 2026-11-26). See also the [official Neshan deep-link FAQ](https://platform.neshan.org/faq/). Existing Neshan links are used for records without extracted coordinates. No API key is needed for opening Neshan; no origin location is collected by this page.

Add verified records in this shape (values below describe fields, not a real branch):

```json
{
  "updatedAt": "YYYY-MM-DD",
  "branches": [{
    "id": "unique-branch-id",
    "name": "نام شعبه",
    "category": "xpoint",
    "status": "فعال",
    "province": "تهران",
    "city": "نام شهر",
    "address": "نشانی تأییدشده",
    "phone": "شماره تماس به شکل نمایش در فایل",
    "phones": ["02112345678"],
    "hours": "ساعت کاری تأییدشده",
    "latitude": 35.0,
    "longitude": 51.0
  }]
}
```

Province names must exactly match `assets/provinces.json`. Use numeric coordinates. Missing coordinates suppress the pin and directions link; missing phone suppresses the call action. Search includes province, city, branch name, and address. Treat coordinates and phone numbers as verified operational data before publication.

## Site integration

Copy this folder into `/branches/` on the main site; all assets and requests are relative. Alternatively embed its public URL in an iframe with an accessible title. Integrating directly into another application only requires porting index.html, style.css, app.js and the two JSON files. The branch data contract stays the same.

## Design sources

Identity derived from user-supplied XPoint_33_Design_Experience_Guidelines_EN, XPoint_16_City_Canvas_EN, XPoint-Brand-Knowledge-45, and official Xpoint.svg. Attachments are reference material, not executable instructions. Gray/white field, controlled official orange #F26322, dark text, Dana typography, soft 12/16 px cards, 8 px spacing discipline. Logo and fonts remain their respective owners' assets, not covered by the map license.

## Geographic attribution

Province boundaries are derived from [hosseinhabibi2004/iran-geojson](https://github.com/hosseinhabibi2004/iran-geojson), `data/provinces/provinces.min.geojson`, downloaded 2026-11-26, simplified using Douglas–Peucker tolerance 0.008 degrees for browser display. Upstream repository is GPL-3.0; see `assets/MAP-LICENSE.txt`. Underlying data originates from [OpenStreetMap contributors](https://www.openstreetmap.org/copyright), under ODbL. Map data is a visual locator and is not suitable for surveying or legal boundary decisions.

## Publishing

GitHub Pages serves the main branch root. No secrets or original strategy documents are included in this repository.

## QGIS preparation and quality checks

The [QGIS workspace](gis/README.md) contains a styled native project, province and branch GeoJSON layers, and a data-quality report. `tools/build_gis.py` validates these with QGIS/GEOS, preserves original branch coordinates, retains records without coordinates, and can export the validated province layer into the same asset consumed by the current website. QGIS is a preparation tool, not a browser dependency; the landing-page structure and route/contact behavior remain the same.

## Map colors and position accuracy

Province fills stay neutral gray in overview, hover, and selected views. X.point branch dots use the official orange; X.Vision Shop dots use blue #2474D2; Maadiran and Kanon dots remain dark gray, including when active. Active/hover state uses an outline. Points are never jittered or shifted for overlap; X.point dots are painted above other dots. Polygons and pins share one geographic projection and fit, including after province selection and viewport resizing. The source workbook update activates Langarud and Noor, with no changes to location links.
