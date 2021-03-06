/*
 * sensorsupdater.js
 * Copyright(c) 2015 Bitergia
 * Author: David Muriel <dmuriel@bitergia.com>,
 * MIT Licensed

  Generates sensors for all the restaurants.

  First it creates a new service.
  Then registers the sensors for each restaurant.

*/

// jshint node: true

'use strict';

var async = require('async');
var authRequest = require('../authrequest');
var idas = require('../idas/ul20');

var apiRestSimtasks = 10;
var restaurantsData;
var sensorsUpdated = 0;

/* There will be 4 sensors for each restaurant:
 * - Temperature of the Kitchen
 * - Temperature of the Dinner
 * - Humidity of the Kitchen
 * - Humidity of the Dinner
 */

var sensorsPerRestaurant = 4;
var sensorTypes = ['SENSOR_TEMP', 'SENSOR_HUM'];
var sensorPlaces = ['Kitchen', 'Dining'];

var feedIDASSensors = function() {

  var totalSensors = restaurantsData.length * sensorsPerRestaurant;

  var cbShowProgress = function() {
    console.log('Total Sensors:', totalSensors,
                ', Updated:', sensorsUpdated
               );
  };

  console.log('Registering sensors on IDAS.');
  console.log('Number of restaurants: ' + restaurantsData.length);

  // Limit the number of calls to be done in parallel
  var q = async.queue(function(task, callback) {
    idas.updateSensor(task.name, task.type, task.value)
      .delay(1000) // This is to avoid clogging iotagent with requests.
      .then(
        function(response) {
          sensorsUpdated++;
        },
        function(error) {
          console.log('updateSensor Error:', error);
        })
      .done(
        function(response) {
          callback();
        });
  }, apiRestSimtasks);

  // Display totals when queue is empty
  q.drain = function() {
    console.log('Total sensors updated:', sensorsUpdated,
                '/', totalSensors);
  };

  // For each restaurant, generate a new temperature sensor
  Object.keys(restaurantsData).forEach(function(element, pos) {
    // generate sensor base name
    var sensorBaseName = restaurantsData[pos].id;
    sensorPlaces.forEach(function(place) {
      sensorTypes.forEach(function(type) {
        var newValue = generateRandomValue(
          getOldValue(restaurantsData[pos], place, type),0,100
        );
        q.push({
          'name': sensorBaseName + '_' + place,
          'type': type,
          'value': newValue
        }, cbShowProgress);
      });
    });
  });
};

function generateRandomValue(oldValue, min, max) {
  // generate a new value using the old value as base
  var sign = Date.now() % 2;
  var variance = Date.now() % 3;
  var newValue;
  if (sign === 0) {
    newValue = parseInt(oldValue) + variance;
    newValue = newValue > max ? max : newValue;
  } else {
    newValue = parseInt(oldValue) - variance;
    newValue = newValue < min ? min : newValue;
  }
  return newValue;
}

function getOldValue(data, place, type) {

  var attr;

  switch (type) {
  case 'SENSOR_TEMP':
    attr = place + '_temperature';
    break;
  case 'SENSOR_HUM':
    attr = place + '_humidity';
    break;
  default:
    console.log('Unsupported sensor type:', type);
    return undefined;
  }
  var val = 10;
  if (typeof data[attr] !== 'undefined') {
    val = data[attr].value;
  }
  return val;
}

// Load restaurant data from Orion
var loadRestaurantData = function() {

  // Generate the sensors once we have all restaurant data
  var processRestaurants = function(data) {
    restaurantsData = JSON.parse(JSON.stringify(data.body));
    feedIDASSensors();
  };

  authRequest(
    '/v2/entities',
    'GET',
    {'type': 'Restaurant','limit': '1000'})
  .then(processRestaurants)
  .catch(function(err) {
    console.log(err);
  });
};

console.log('Updating restaurant sensors...');

loadRestaurantData();
