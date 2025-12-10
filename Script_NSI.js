// Import the shapefile region (upload the shapefile before running the script)
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

// Définir la période et les mois d'intérêt pour s2
var startDate = '2020-02-01';
var endDate = '2024-05-31';

// Filtrer et traiter la collection Sentinel-2 pour novembre-avril
var s2 = ee.ImageCollection('COPERNICUS/S2_SR_HARMONIZED')
          .filterDate(startDate, endDate)
          .filterBounds(region)
          .filter(ee.Filter.calendarRange(2, 5, 'month'))
          .map(maskClouds);

// Fonction pour calculer le NSI en ramenant la réflectance entre 0 et 1
var calculateNSI = function(image) {
  // Mise à l’échelle des bandes
  var G = image.select('B3').divide(10000);   // Bande verte
  var R = image.select('B4').divide(10000);   // Bande rouge
  var SWIR1 = image.select('B11').divide(10000); // Bande SWIR1

  // Calcul du NSI
  var nsi = G.add(R).divide(SWIR1.log());

  return image.addBands(nsi.rename('NSI')); // Ajouter le NSI à l'image
};

// Appliquer la fonction NSI à la collection
var nsiCollection = s2.map(calculateNSI);

// Image moyenne du NSI
var nsiImage = nsiCollection.select('NSI').median().clip(region);


// Export GeoTIFF
Export.image.toDrive({
  image: nsiImage,
  description: 'NSI_median',
  folder: 'EarthEngineExports',
  fileNamePrefix: 'NSI_median',
  region: region.geometry().bounds(),   // conversion en geometry
  scale: 10,
  crs: 'EPSG:4326',
  maxPixels: 1e13
});
