// Define the region of interest
var region = ee.FeatureCollection("projects/ee-axelbelemtougri/assets/Cdo_eph_aoi_1000km2_buf_Simp");

// Define the period and months of interest
var startDate = '2020-02-01';
var endDate = '2024-05-31';

// Function to mask clouds and shadows
function maskClouds(image) {
  var qa = image.select('QA60');
  var cloudMask = qa.bitwiseAnd(1 << 10).eq(0)
                    .and(qa.bitwiseAnd(1 << 11).eq(0));
  return image.updateMask(cloudMask)
              .select(['B2', 'B3', 'B4', 'B5', 'B6', 'B7', 'B8', 'B8A', 'B11', 'B12'])
              .divide(10000)
              .copyProperties(image, ['system:time_start']);
}


// Resampling B11 to 10 m
function resampleBands(image) {
  return image.addBands(
    image.select('B11').resample('bilinear').reproject({
      crs: image.select('B3').projection(), 
      scale: 10
    }),
    null,
    true
  );
}

// Calculation of the MNDWI (Modified Normalized Difference Water Index)
function calculateMNDWI(image) {
  return image.expression(
    '(GREEN - SWIR) / (GREEN + SWIR)', {
      'GREEN': image.select('B3'), // Bande verte
      'SWIR': image.select('B11')  // Shortwave Infrared
    }
  ).rename('MNDWI').copyProperties(image, ['system:time_start']);
}

// Apply the clip (cropping) to each image
function clipToRegion(image) {
  return image.clip(region);
}

var s2 = ee.ImageCollection('COPERNICUS/S2_SR_HARMONIZED')
          .filterDate(startDate, endDate)
          .filterBounds(region)
          .filter(ee.Filter.calendarRange(2, 5, 'month'))
          .map(maskClouds)
          .map(resampleBands) // Resampling before the calculation
          .map(calculateMNDWI)
          .map(clipToRegion); // Apply the clip here


// Compute the median image for the MNDWI
var mndwiMedian = s2.select('MNDWI').median();

// Export the image as a GeoTIFF
Export.image.toDrive({
  image: mndwiMedian,
  description: 'MNDWI_Median',
  folder: 'EarthEngineExports',
  fileNamePrefix: 'MNDWI_Median',
  region: region.geometry().bounds(),
  scale: 10,
  crs: 'EPSG:4326',
  maxPixels: 1e13
});
