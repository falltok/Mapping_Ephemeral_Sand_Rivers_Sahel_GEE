// Charger le shapefile des points représentant les types de sols
var points = ee.FeatureCollection('projects/ee-axelbelemtougri/assets/Train_points_new_bis1');

// Charger la région d'intérêt
var region = ee.FeatureCollection("projects/ee-axelbelemtougri/assets/Cdo_eph_aoi_1000km2_buf_Simp");

// Fonction pour masquer les nuages et les ombres
function maskClouds(image) {
  var qa = image.select('QA60');
  var cloudMask = qa.bitwiseAnd(1 << 10).eq(0)
                    .and(qa.bitwiseAnd(1 << 11).eq(0));
  return image.updateMask(cloudMask)
              .select(['B2', 'B3', 'B4', 'B5', 'B6', 'B7', 'B8', 'B8A', 'B11', 'B12'])
              .divide(10000)
              .copyProperties(image, ['system:time_start']);
}

// Définir les périodes d'intérêt
var startDate = '2020-02-01';
var endDate = '2024-05-31';
var startDate1 = '2020-06-01';
var endDate1 = '2024-09-30';
var startDate2 = '2020-10-01';
var endDate2 = '2024-01-31';

// Filtrer et traiter les collections Sentinel-2
var s2 = ee.ImageCollection('COPERNICUS/S2_SR_HARMONIZED')
          .filterDate(startDate, endDate)
          .filterBounds(region)
          .filter(ee.Filter.calendarRange(2, 5, 'month'))
          .map(maskClouds)
          .median()
          .clip(region);

var s2bis = ee.ImageCollection('COPERNICUS/S2_SR_HARMONIZED')
          .filterDate(startDate1, endDate1)
          .filterBounds(region)
          .filter(ee.Filter.calendarRange(6, 9, 'month'))
          .map(maskClouds)
          .median()
          .clip(region);

var s2tri = ee.ImageCollection('COPERNICUS/S2_SR_HARMONIZED')
          .filterDate(startDate2, endDate2)
          .filterBounds(region)
          .filter(ee.Filter.or(
              ee.Filter.calendarRange(10, 12, 'month'),
              ee.Filter.calendarRange(1, 1, 'month')))
          .map(maskClouds)
          .median()
          .clip(region);

// Combiner les images en une seule avec des noms de bandes uniques
var s3 = s2.rename(['B2_FebMay', 'B3_FebMay', 'B4_FebMay', 'B5_FebMay', 'B6_FebMay', 
                    'B7_FebMay', 'B8_FebMay', 'B8A_FebMay', 'B11_FebMay', 'B12_FebMay'])
           .addBands(s2bis.rename(['B2_JunSep', 'B3_JunSep', 'B4_JunSep', 'B5_JunSep', 'B6_JunSep', 
                                   'B7_JunSep', 'B8_JunSep', 'B8A_JunSep', 'B11_JunSep', 'B12_JunSep']))
           .addBands(s2tri.rename(['B2_OctJan', 'B3_OctJan', 'B4_OctJan', 'B5_OctJan', 'B6_OctJan', 
                                   'B7_OctJan', 'B8_OctJan', 'B8A_OctJan', 'B11_OctJan', 'B12_OctJan']));

// Définir les bandes pour la classification
var bands = s3.bandNames();

// Extraire les valeurs spectrales pour chaque point
var spectralValues = s3.reduceRegions({
  collection: points,
  reducer: ee.Reducer.mean(),
  scale: 10
});

// Exporter les résultats au format CSV
Export.table.toDrive({
  collection: spectralValues,
  description: 'Spectral_Signature_multi',
  folder: 'EarthEngineExports',
  fileFormat: 'CSV'
});
