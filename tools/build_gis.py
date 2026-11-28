"""Build/validate the QGIS workspace; optionally refresh the existing web map asset.

Run with QGIS's python-qgis-ltr.bat (not a regular Python installation).
No geocoding, coordinate interpolation, or changes to the landing-page structure.
"""
import argparse
import collections
import hashlib
import json
import os
import re
import zipfile
from pathlib import Path

os.environ.setdefault('QT_QPA_PLATFORM', 'offscreen')
from qgis.core import (
    Qgis, QgsApplication, QgsCategorizedSymbolRenderer, QgsCoordinateReferenceSystem,
    QgsCoordinateTransform, QgsFeature, QgsFeatureRequest, QgsFillSymbol, QgsGeometry, QgsMapRendererParallelJob,
    QgsMapSettings, QgsMarkerSymbol, QgsPointXY, QgsProject, QgsReferencedRectangle,
    QgsRendererCategory, QgsVectorFileWriter, QgsVectorLayer, QgsWkbTypes,
)
from qgis.PyQt.QtCore import QSize
from qgis.PyQt.QtGui import QColor

ROOT = Path(__file__).resolve().parents[1]
COLORS = {'xpoint': '#f26322', 'maadiran': '#25282b', 'kanon': '#25282b', 'xvision': '#2474d2'}
LABELS = {'xpoint': 'X.point', 'maadiran': 'Maadiran', 'kanon': 'Kanon', 'xvision': 'X.Vision Shop'}


def dump(path, value, compact=False):
    path.write_text(json.dumps(value, ensure_ascii=False, indent=None if compact else 2,
                               separators=(',', ':') if compact else None) + '\n', encoding='utf-8')


def sha(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--write-web', action='store_true', help='Replace only assets/provinces.json after validation')
    parser.add_argument('--preview', type=Path, help='Optional QA image, not part of the website')
    args = parser.parse_args()
    qgs = QgsApplication([], False)
    qgs.initQgis()
    project = QgsProject.instance()
    out = ROOT / 'gis'
    out.mkdir(exist_ok=True)
    source_path = out / 'provinces-source.geojson'
    web_path = ROOT / 'assets/provinces.json'
    if not source_path.exists():
        source_path.write_bytes(web_path.read_bytes())
    branch_path = ROOT / 'branches.json'
    branch_hash = sha(branch_path)
    original = json.loads(source_path.read_text(encoding='utf-8'))
    records = json.loads(branch_path.read_text(encoding='utf-8'))['branches']
    source = QgsVectorLayer(str(source_path), 'Province source', 'ogr')
    if not source.isValid() or source.featureCount() != 31:
        raise ValueError('Expected 31 readable province polygons')
    if source.crs().authid() != 'EPSG:4326':
        raise ValueError('Web boundaries must be longitude/latitude in EPSG:4326')
    clean = QgsVectorLayer('MultiPolygon?crs=EPSG:4326', 'Iran provinces', 'memory')
    clean.dataProvider().addAttributes(source.fields())
    clean.updateFields()
    repaired = []
    for feature in source.getFeatures():
        geometry = feature.geometry()
        if not geometry.isGeosValid():
            repaired.append(feature['name:fa'])
            geometry = geometry.makeValid()
        if geometry.isEmpty() or not geometry.isGeosValid():
            raise ValueError('Invalid province geometry after repair: ' + feature['name:fa'])
        if QgsWkbTypes.geometryType(geometry.wkbType()) != QgsWkbTypes.PolygonGeometry:
            raise ValueError('Repair did not produce a polygon: ' + feature['name:fa'])
        geometry.convertToMultiType()
        new_feature = QgsFeature(clean.fields())
        new_feature.setAttributes(feature.attributes())
        new_feature.setGeometry(geometry)
        if not clean.dataProvider().addFeatures([new_feature])[0]:
            raise ValueError('Could not add repaired province')
    clean.updateExtents()
    options = QgsVectorFileWriter.SaveVectorOptions()
    options.driverName = 'GeoJSON'
    options.fileEncoding = 'UTF-8'
    options.layerOptions = ['RFC7946=YES', 'COORDINATE_PRECISION=8']
    province_file = out / 'provinces.geojson'
    result = QgsVectorFileWriter.writeAsVectorFormatV3(clean, str(province_file), project.transformContext(), options)
    if result[0] != QgsVectorFileWriter.NoError:
        raise ValueError('QGIS province export failed: ' + str(result))
    provinces = QgsVectorLayer(str(province_file), 'Iran provinces', 'ogr')
    province_data = json.loads(province_file.read_text(encoding='utf-8'))
    original_names = {f['properties']['name:fa'] for f in original['features']}
    if {f['properties']['name:fa'] for f in province_data['features']} != original_names:
        raise ValueError('Province names changed during export')
    by_name = {f['name:fa']: f.geometry() for f in provinces.getFeatures()}
    point_features = []
    missing = []
    outside = []
    seen = set()
    for branch in records:
        if branch['id'] in seen:
            raise ValueError('Duplicate branch id: ' + branch['id'])
        seen.add(branch['id'])
        if branch['province'] not in by_name or branch['category'] not in COLORS:
            raise ValueError('Unknown province/category: ' + branch['id'])
        lon, lat = branch.get('longitude'), branch.get('latitude')
        geometry = None
        if lon is None and lat is None:
            missing.append({'id': branch['id'], 'name': branch['name'], 'province': branch['province'],
                            'hasNeshanLink': bool(branch.get('neshanUrl'))})
        elif (not isinstance(lon, (float, int)) or isinstance(lon, bool)
              or not isinstance(lat, (float, int)) or isinstance(lat, bool)
              or not 44 <= lon <= 64 or not 24 <= lat <= 40):
            raise ValueError('Invalid coordinate: ' + branch['id'])
        else:
            geometry = {'type': 'Point', 'coordinates': [lon, lat]}
            point = QgsGeometry.fromPointXY(QgsPointXY(lon, lat))
            if not by_name[branch['province']].intersects(point):
                outside.append(branch['id'])
        properties = {key: branch.get(key, '') for key in
                      ('id', 'name', 'category', 'status', 'province', 'city', 'address', 'phone', 'hours', 'neshanUrl')}
        properties['location_status'] = 'exact_source_coordinate' if geometry else 'missing_exact_coordinate'
        point_features.append({'type': 'Feature', 'id': branch['id'], 'properties': properties, 'geometry': geometry})
    if outside:
        raise ValueError('Branches outside their declared province: ' + ', '.join(outside))
    point_file = out / 'branches.geojson'
    dump(point_file, {'type': 'FeatureCollection', 'features': point_features})
    points = QgsVectorLayer(str(point_file), 'Branches (all records; missing points retained)', 'ogr')
    if not points.isValid() or points.featureCount() != len(records):
        raise ValueError('QGIS did not retain every branch record')
    actual = {f['id']: f for f in points.getFeatures()}
    for branch in records:
        feature = actual[branch['id']]
        if branch.get('latitude') is None:
            if feature.hasGeometry():
                raise ValueError('Invented a point for ' + branch['id'])
        else:
            point = feature.geometry().asPoint()
            if abs(point.x() - branch['longitude']) > 1e-10 or abs(point.y() - branch['latitude']) > 1e-10:
                raise ValueError('Coordinate changed during QGIS round trip: ' + branch['id'])
    provinces.renderer().setSymbol(QgsFillSymbol.createSimple({
        'color': '#e5e8eb', 'outline_color': '#ffffff', 'outline_width': '0.25'}))
    categories = [QgsRendererCategory(category, QgsMarkerSymbol.createSimple({
        'name': 'circle', 'color': color, 'outline_color': '#ffffff', 'outline_width': '0.3',
        'size': '2.5'}), LABELS[category]) for category, color in COLORS.items()]
    renderer = QgsCategorizedSymbolRenderer('category', categories)
    renderer.setOrderBy(QgsFeatureRequest.OrderBy([
        QgsFeatureRequest.OrderByClause("CASE WHEN \"category\" = 'xpoint' THEN 1 ELSE 0 END", True)]))
    renderer.setOrderByEnabled(True)
    points.setRenderer(renderer)
    points.setDisplayExpression('"name"')
    project.setTitle('X.point | Iran Branch Network')
    project.setCrs(QgsCoordinateReferenceSystem('EPSG:3857'))
    project.setFilePathStorage(Qgis.FilePathType.Relative)
    project.addMapLayer(provinces)
    project.addMapLayer(points)
    extent = QgsCoordinateTransform(provinces.crs(), project.crs(), project).transformBoundingBox(provinces.extent())
    extent.scale(1.06)
    project.viewSettings().setDefaultViewExtent(QgsReferencedRectangle(extent, project.crs()))
    project_file = out / 'xpoint-branches.qgz'
    project.setFileName(str(project_file))
    if not project.write():
        raise ValueError('Could not save QGIS project')
    report = {
        'engine': 'QGIS ' + Qgis.QGIS_VERSION,
        'sourceBranchSHA256': branch_hash,
        'sourceProvinceSHA256': sha(source_path),
        'outputProvinceSHA256': sha(province_file),
        'branchCount': len(records), 'provinceCount': provinces.featureCount(),
        'validProvinceCount': provinces.featureCount(),
        'sourceCRS': 'EPSG:4326', 'projectCRS': project.crs().authid(),
        'pointCount': len(records) - len(missing), 'missingCoordinateCount': len(missing),
        'categoryCounts': dict(collections.Counter(b['category'] for b in records)),
        'repairedProvinces': repaired, 'branchesOutsideDeclaredProvince': outside,
        'pointCoordinatesPreserved': True, 'missingCoordinates': missing,
        'webAssetUpdated': args.write_web,
    }
    if args.write_web:
        dump(web_path, province_data, compact=True)
        check = QgsVectorLayer(str(web_path), 'Web asset validation', 'ogr')
        if check.featureCount() != 31 or any(not f.geometry().isGeosValid() for f in check.getFeatures()):
            raise ValueError('Final web map is not valid')
        report['webProvinceSHA256'] = sha(web_path)
    if args.preview:
        settings = QgsMapSettings()
        settings.setLayers([points, provinces])
        settings.setDestinationCrs(project.crs())
        settings.setExtent(extent)
        settings.setOutputSize(QSize(1200, 1000))
        settings.setBackgroundColor(QColor('#ffffff'))
        job = QgsMapRendererParallelJob(settings)
        job.start()
        job.waitForFinished()
        args.preview.parent.mkdir(parents=True, exist_ok=True)
        if not job.renderedImage().save(str(args.preview)):
            raise ValueError('QGIS preview save failed')
    # Reopen the actual saved project to check relative paths and layer providers.
    project.clear()
    with zipfile.ZipFile(project_file) as archive:
        contents = {name: archive.read(name) for name in archive.namelist()}
    for name in contents:
        if name.endswith('.qgs'):
            xml = contents[name].decode('utf-8')
            xml = re.sub(r' saveUser(?:Full)?="[^"]*"', '', xml)
            contents[name] = xml.encode('utf-8')
    with zipfile.ZipFile(project_file, 'w', zipfile.ZIP_DEFLATED) as archive:
        for name, content in contents.items():
            archive.writestr(name, content)
    if not project.read(str(project_file)) or any(not layer.isValid() for layer in project.mapLayers().values()):
        raise ValueError('Saved QGIS project could not reopen with valid layers')
    if len(project.mapLayers()) != 2 or sha(branch_path) != branch_hash:
        raise ValueError('Unexpected project layers or branch source mutation')
    report['savedProjectReopened'] = True
    dump(out / 'qa-report.json', report)
    with zipfile.ZipFile(out / 'xpoint-qgis.zip', 'w', zipfile.ZIP_DEFLATED) as archive:
        for name in ['xpoint-branches.qgz', 'branches.geojson', 'provinces.geojson', 'qa-report.json']:
            archive.write(out / name, 'xpoint-qgis/' + name)
        archive.write(ROOT / 'assets/MAP-LICENSE.txt', 'xpoint-qgis/MAP-LICENSE.txt')
        archive.writestr('xpoint-qgis/OPEN-ME.txt',
            'Extract the whole ZIP, then open xpoint-branches.qgz in QGIS 3.44 or later.\n'
            'Keep branches.geojson and provinces.geojson beside the project file.\n'
            '81 branch locations are source coordinates; 13 records have no point and remain in the attribute table.\n'
            'Map data: OpenStreetMap contributors, ODbL: https://www.openstreetmap.org/copyright\n'
            'Province source: https://github.com/hosseinhabibi2004/iran-geojson (GPL-3.0).\n')
    print(json.dumps({key: value for key, value in report.items() if key != 'missingCoordinates'}, ensure_ascii=True))
    project.clear()
    # Exit normally; Windows QGIS provider DLLs are released by the interpreter.


if __name__ == '__main__':
    main()
