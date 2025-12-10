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
  
// Function to calculate NDSI
var calculateNDSI = function(image) {
  var ndsi = image.normalizedDifference(['B4', 'B1']).rename('NDSI');
  return image.addBands(ndsi);
};

// Apply the NDSI calculation to the image collection
var ndsiCollection = s2.map(calculateNDSI);

// Get the median NDSI image
var ndsiImage = ndsiCollection.select('NDSI').median().clip(region);

// Export the result as a GeoTIFF
Export.image.toDrive({
  image: ndsiImage,
  description: 'NDSI_Median',
  folder: 'EarthEngineExports',
  fileNamePrefix: 'NDSI_Median',
  region: region,
  scale: 10,
  crs: 'EPSG:4326',
  maxPixels: 1e13
});

