/** @constructor */
let Map = function() {

  /** @private */
  this.mapboxMap_;
};

Map.MAPBOX_TOKEN = 'pk.eyJ1IjoiaGVhbHRobWFwIiwiYSI6ImNrOGl1NGNldTAyYXYzZnBqcnBmN3RjanAifQ.H377pe4LPPcymeZkUBiBtg';


/**
 * Takes an array of features, and bundles them in a way that the map API
 * can ingest.
 */
Map.formatFeatureSet = function(features) {
  return {'type': 'FeatureCollection', 'features': features};
};


/** Tweaks the given object to make it ingestable as a feature by the map API. */
Map.formatFeature = function(feature) {
  feature.type = 'Feature';
  if (!feature['properties']) {
    // This feature is missing key data, add a placeholder.
    feature['properties'] = {'geoid': '0|0'};
  }
  // If the 'new' property is absent, assume 0.
  if (isNaN(feature['properties']['new'])) {
    feature['properties']['new'] = 0;
  }
  let coords = feature['properties']['geoid'].split('|');
  // Flip latitude and longitude.
  feature['geometry'] = {'type': 'Point', 'coordinates': [coords[1], coords[0]]};
  return feature;
};


Map.prototype.showDataAtLatestDate = function() {
  if (!dates.length) {
    console.log('No data to show');
    return;
  }
  const latestDate = dates[dates.length - 1];
  this.showDataAtDate(latestDate);
}

Map.prototype.showDataAtDate = function(isodate) {
  if (currentIsoDate != isodate) {
    currentIsoDate = isodate;
  }
  let featuresToShow = atomicFeaturesByDay[isodate];

  // If the map is ready, show the data. Otherwise it will be shown when
  // the map is finished loading.
  let source = this.mapboxMap_.getSource('counts');
  if (!!source) {
    source.setData(Map.formatFeatureSet(featuresToShow));
  }
};


Map.prototype.init = function(callback) {
  mapboxgl.accessToken = Map.MAPBOX_TOKEN;
  this.mapboxMap_ = new mapboxgl.Map({
    'container': 'map',
    'style': 'mapbox://styles/healthmap/ck7o47dgs1tmb1ilh5b1ro1vn',
    'center': [10, 0],
    'zoom': 1,
  }).addControl(new mapboxgl.NavigationControl());
  popup = new mapboxgl.Popup({
    'closeButton': false,
    'closeOnClick': false
  });

  let self = this;
  timeControl.addEventListener('input', function() {
    setTimeControlLabel(timeControl.value);
    self.showDataAtDate(dates[timeControl.value]);
  });

  this.mapboxMap_.on('load', function () {
    self.mapboxMap_.addSource('counts', {
      'type': 'geojson',
      'data': Map.formatFeatureSet([])
    });
    let circleColorForTotals = ['step', ['get', 'total']];
    // Don't use the last color here (for new cases).
    for (let i = 0; i < COLOR_MAP.length - 1; i++) {
      let color = COLOR_MAP[i];
      circleColorForTotals.push(color[0]);
      if (color.length > 2) {
        circleColorForTotals.push(color[2]);
      }
    }

    self.addLayer(map, 'totals', 'total', circleColorForTotals);
    self.addLayer(map, 'daily', 'new', 'cornflowerblue');

    // If we're not showing any data yet, let's fix that.
    self.showDataAtLatestDate();

    self.mapboxMap_.on('mouseenter', 'totals', function (e) {
      // Change the cursor style as a UI indicator.
      this.getCanvas().style.cursor = 'pointer';
      showPopupForEvent(e);
    });

    self.mapboxMap_.on('mouseleave', 'totals', function () {
      this.getCanvas().style.cursor = '';
      popup.remove();
    });
  });
  showLegend();
};


Map.prototype.addPopup = function(popup) {
  popup.addTo(this.mapboxMap_);
};


Map.prototype.addLayer = function(map, id, featureProperty, circleColor) {
  this.mapboxMap_.addLayer({
    'id': id,
    'type': 'circle',
    'source': 'counts',
    'paint': {
      'circle-radius': [
        'case', [
          '<',
          0, [
            'number', [
              'get',
              featureProperty
            ]
          ]
        ], [
          '*', [
            'log10', [
              'sqrt', [
                'get',
                featureProperty
              ]
            ]
          ],
          10
        ],
        0
      ],
      'circle-color': circleColor,
      'circle-opacity': 0.6,
    }
  });
};


Map.prototype.flyToCountry = function(event) {
  let target = event.target;
  while (!target.getAttribute('country')) {
    target = target.parentNode;
  }
  const country = countries[target.getAttribute('country')];
  const dest = country.getMainBoundingBox();
  this.mapboxMap_.fitBounds([[dest[0], dest[1]], [dest[2], dest[3]]]);
};
