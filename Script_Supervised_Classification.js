// Charger la région et les points
var region = ee.FeatureCollection('projects/ee-axelbelemtougri/assets/Cdo_eph_aoi_1000km2_buf_Simp');
var points = ee.FeatureCollection('projects/ee-axelbelemtougri/assets/Train_points');

// Masque nuages
function maskClouds(image) {
  var qa = image.select('QA60');
  var m = qa.bitwiseAnd(1 << 10).eq(0)
           .and(qa.bitwiseAnd(1 << 11).eq(0));
  return image.updateMask(m)
    .select(['B2','B3','B4','B5','B6','B7','B8','B8A','B11','B12'])
    .divide(10000)
    .copyProperties(image, ['system:time_start']);
}

// Périodes
var periods = [
  {start: '2020-02-01', end: '2024-05-31', months: [2,5]},
  {start: '2020-06-01', end: '2024-09-30', months: [6,9]},
  {start: '2020-10-01', end: '2024-01-31', months: [10,12,1]}
];

// Médianes
function getMedianImage(p) {
  return ee.ImageCollection('COPERNICUS/S2_SR_HARMONIZED')
    .filterDate(p.start, p.end)
    .filterBounds(region)
    .filter(ee.Filter.calendarRange(p.months[0], p.months[p.months.length - 1], 'month'))
    .map(maskClouds)
    .median()
    .clip(region);
}

var images = periods.map(getMedianImage);

var s5 = ee.Image.cat(images).rename([
 'B1','B2','B3','B4','B5','B6','B7','B8','B9','B10',
 'B11','B12','B13','B14','B15','B16','B17','B18','B19','B20',
 'B21','B22','B23','B24','B25','B26','B27','B28','B29','B30'
]);

// Training
var training = s5.sampleRegions({
  collection: points.select('class'),
  properties: ['class'],
  scale: 10,
}).randomColumn('rand');

// 10-Fold CV
var folds = 10;

var accuracies = ee.List.sequence(0, folds - 1).map(function(f) {
  f = ee.Number(f);
  var trainFold = training.filter(ee.Filter.neq('rand', f.divide(folds)));
  var testFold  = training.filter(ee.Filter.gte('rand', f.divide(folds)))
                         .filter(ee.Filter.lt('rand', f.add(1).divide(folds)));

  var classifier = ee.Classifier.smileRandomForest(300).train({
    features: trainFold,
    classProperty: 'class',
    inputProperties: s5.bandNames()
  });

  var classified = testFold.classify(classifier);
  return classified.errorMatrix('class', 'classification').accuracy();
});

// Moyenne
var overallMean = ee.Number(accuracies.reduce(ee.Reducer.mean()));
print('Overall accuracy (10-fold CV):', overallMean);

// Classif finale
var finalClassifier = ee.Classifier.smileRandomForest(500).train({
  features: training,
  classProperty: 'class',
  inputProperties: s5.bandNames()
});

var classifiedImage = s5.classify(finalClassifier).clip(region);

// Export
Export.image.toDrive({
  image: classifiedImage,
  description: 'RF_4classes_3P',
  scale: 10,
  region: region.geometry().bounds(),
  folder: 'EarthEngineExports',
  fileFormat: 'GeoTIFF',
  crs: 'EPSG:4326',
  maxPixels: 1e13
});
