/*
 * restaurantfeeder.js
 * Copyright(c) 2015 Bitergia
 * Author: Alvaro del Castillo <acs@bitergia.com>,
 * Alberto Martín <alberto.martin@bitergia.com>
 * MIT Licensed

  Feeds restaurants into Orion CB

  First it gets all restaurant information
  Then restaurant geocode is gathered using Google API in serial execution
  Then all restaurant data is added to Orion CB
*/

// jshint node: true

'use strict';

var utils = require('../utils');
var authRequest = require('../authrequest');
var fs = require('fs');
var async = require('async');
var geocoder = require('node-geocoder')('google', 'http');

var feedHost = 'opendata.euskadi.eus';
var feedPath = '/contenidos/ds_recursos_turisticos';
feedPath +=
  '/restaurantes_sidrerias_bodegas/opendata/restaurantes.json';
var cacheFile = '../data/restaurants.json';
var apiRestSimtasks = 1; // number of simultaneous calls to API REST
var restaurantsAdded = 0;
var geoWaitTimeMs = 200; // Wait ms between calls to Google API
var restaurantsData; // All data for the restaurants
var apiCount = 0; // 2500 requests per day, be careful

var getAddress = function(restaurant) {
  var address = restaurant.address.streetAddress + ' ';
  if (restaurant.address.addressLocality) {
    address += restaurant.address.addressLocality + ' ';
  }
  if (restaurant.address.addressRegion) {
    address += restaurant.address.addressRegion;
  }
  return address;
};

var feedOrionRestaurants = function() {
  var returnPost = function(restaurantIdentifier) {
    if (restaurantIdentifier) {
      console.log('The restaurant', restaurantIdentifier, 'exists');
    } else {
      restaurantsAdded++;
      console.log(restaurantsAdded + '/' + restaurantsData.length);
    }
  };

  //restaurantsData = restaurantsData.slice(0,5); // debug with few items

  console.log('Feeding restaurants info in orion.');
  console.log('Number of restaurants: ' + restaurantsData.length);

  // Limit the number of calls to be done in parallel to orion
  var q = async.queue(function(task, callback) {
    var attributes = task.attributes;
    utils.getListByType('Restaurant', attributes.id)
    .then(function(data) {
      callback(attributes.id);
    })
    .catch(function(err) {
      if (err.statusCode == '404') {
        var address = getAddress(attributes);
        setTimeout(function() {
         geocoder.geocode({address: address, country: 'Spain'})
         .then(function(geoRes) {
          attributes = utils.addGeolocation(attributes, geoRes[0]);
          attributes = utils.fixAddress(attributes, geoRes[0]);
          authRequest('/v2/entities', 'POST', attributes)
          .then(callback(null))
          .catch(function(err) {
            console.log(err);
          });
        })
         .catch(function(err) {
          console.log(err);
          authRequest('/v2/entities', 'POST', attributes)
          .then(callback(null))
          .catch(function(err) {
            console.log(err);
          });
        });
       }, geoWaitTimeMs);
      }
    });
  }, apiRestSimtasks);

  q.drain = function() {
    console.log('Total restaurants added: ' + restaurantsAdded);
  };

  var dictionary = {
    'id': 'name',
    'addressFax': 'faxNumber',
    'menu': 'priceRange',
    'phoneNumber': 'telephone',
    'turismDescription': 'description',
    'web': 'url'
  };

  var addressDictionary = {
    'address': 'streetAddress',
    'locality': 'addressLocality',
    'historicTerritory': 'addressRegion',
    'municipalityCode': 'postalCode'
  };

  Object.keys(restaurantsData).forEach(function(element, pos) {

    var rname = restaurantsData[pos].documentName;

    var organization = ['Franchise1', 'Franchise2',
    'Franchise3', 'Franchise4'
    ];

    var attr = {
      'type': 'Restaurant',
      'id': utils.fixedEncodeURIComponent(rname),
      'address': {
        'type': 'postalAddress'
      },
      'department': utils.randomElement(organization),
      'aggregateRating': {}
    };

    attr.aggregateRating.ratingValue = utils.randomIntInc(1, 5);
    attr.aggregateRating.reviewCount = utils.randomIntInc(1,
      100);

    Object.keys(restaurantsData[pos]).forEach(function(element) {

      var val = restaurantsData[pos][element];

      if (element in addressDictionary) {

        if (val !== 'undefined' && val !== '') {
          element = utils.replaceOnceUsingDictionary(
            addressDictionary, element,
            function(key, dictionary) {
              return dictionary[key];
            });
          attr.address[utils.fixedEncodeURIComponent(element)] =
          utils.fixedEncodeURIComponent(val);
        }

      } else {
        if (element in dictionary) {

          if (val !== 'undefined' && val !== '') {

            element = utils.replaceOnceUsingDictionary(
              dictionary, element,
              function(key, dictionary) {
                return dictionary[key];
              });
            if (element == 'priceRange') {
              attr[utils.fixedEncodeURIComponent(element)] =
              parseFloat(val);
            } else {
              attr[utils.fixedEncodeURIComponent(element)] =
              utils.fixedEncodeURIComponent(
              utils.convertHtmlToText(val));
            }
          }
        }
      }
    });
    q.push({'attributes': attr}, returnPost);
  });
};

// Load restaurant data in Orion
var loadRestaurantData = function() {
  var processGet = function(res, data) {
    fs.writeFileSync(cacheFile, data);
    restaurantsData = JSON.parse(data);
    feedOrionRestaurants();
  };

  try {
    var data = fs.readFileSync(cacheFile);
    console.log('Using cache file ' + cacheFile);
    restaurantsData = JSON.parse(data);
    feedOrionRestaurants();
  } catch (e) {
    if (e.code === 'ENOENT') {
      console.log('Downloading data ... be patient');

      var headers = {
        'Accept': 'application/json',
      };

      var options = {
        host: feedHost,
        path: feedPath,
        method: 'GET',
        headers: headers
      };
      utils.doGet(options, processGet);

    } else {
      throw e;
    }
  }
};

console.log('Loading restaurants info ...');

loadRestaurantData();
