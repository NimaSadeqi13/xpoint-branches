# X.point branch locator

Persian, RTL, responsive standalone branch locator. Select an Iranian province on the SVG map or from the accessible list, then view that province and its branches. Province links use `#province=` and work on GitHub Pages without rewrite rules. No framework, API keys, tracking, CDN, or build step.

## Local preview

Run `python -m http.server 4177` from this folder and open http://localhost:4177 . Use an HTTP server rather than opening index.html directly.

## Branch data

`branches.json` is intentionally empty: the supplied workbook contained campaign planning, not verified branch records. Do not interpret an empty list as absence of X.point coverage in a province.

Add verified records in this shape (values below describe fields, not a real branch):

```json
{
  "updatedAt": "YYYY-MM-DD",
  "branches": [{
    "id": "unique-branch-id",
    "name": "نام شعبه",
    "province": "تهران",
    "city": "نام شهر",
    "address": "نشانی تأییدشده",
    "phone": "+98...",
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
