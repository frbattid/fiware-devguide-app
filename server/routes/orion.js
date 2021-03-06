/*
 * Orion-V2 REST API
 */

// jshint node: true

'use strict';

var authRequest = require('../authrequest');
var utils = require('../utils');
var geocoder = require('node-geocoder')('google', 'http');
var async = require('async');
var auth = require('../auth');

// Restaurants

exports.createRestaurant = function(req, res) {
  var elementToOrion = req.body;
  var address = elementToOrion.address.streetAddress + ' ' +
      elementToOrion.address.addressLocality;
  geocoder.geocode(address)
    .then(function(geoRes) {
      if (geoRes !== '[]') {
        elementToOrion = utils.restaurantToOrion(elementToOrion, geoRes[0]);
      }
      utils.sendRequest('POST', elementToOrion)
        .then(function(data) {
          res.headers = data.headers;
          res.location('/api/orion/restaurant/' + elementToOrion.id);
          res.statusCode = data.statusCode;
          res.end();
        })
        .catch(function(err) {
          res.statusCode = err.statusCode;
          res.end();
        });
    })
    .catch(function(err) {
      console.log('Geo-location could not be processed. Error: ' + err);
      utils.sendRequest('POST', elementToOrion)
        .then(function(data) {
          res.statusCode = data.statusCode;
          res.end();
        })
        .catch(function(err) {
          res.statusCode = err.statusCode;
          res.end();
        });
    });
};

exports.readRestaurant = function(req, res) {
  utils.getListByType('Restaurant', req.params.id)
    .then(function(data) {
      res.statusCode = data.statusCode;
      res.json(utils.dataToSchema(data.body));
    })
    .catch(function(err) {
      res.statusCode = err.statusCode;
      res.json(err.error);
    });
};

exports.updateRestaurant = function(req, res) {
  utils.sendRequest('PATCH', req.body, req.params.id)
    .then(function(data) {
      res.statusCode = data.statusCode;
      res.end();
    })
    .catch(function(err) {
      res.statusCode = err.statusCode;
      res.json(err.error);
    });
};

exports.deleteRestaurant = function(req, res) {
  utils.sendRequest('DELETE', null, req.params.id)
    .then(function(data) {
      res.statusCode = data.statusCode;
      res.end();
    })
    .catch(function(err) {
      res.statusCode = err.statusCode;
      res.json(err.error);
    });
};

// -- TODO: handle pagination over the whole set of restaurants

exports.getRestaurants = function(req, res) {
  utils.getListByType('Restaurant')
    .then(function(data) {
      res.statusCode = data.statusCode;
      res.json(utils.dataToSchema(data.body));
    })
    .catch(function(err) {
      res.statusCode = err.statusCode;
      res.end();
    });
};

exports.getOrganizationRestaurants = function(req, res) {
  var organizationRestaurants = [];
  utils.getListByType('Restaurant')
  .then(function(data) {
    organizationRestaurants = utils.getOrgRestaurants(
      req.params.org,
      data.body);
    res.statusCode = data.statusCode;
    res.json(utils.dataToSchema(organizationRestaurants));
  })
  .catch(function(err) {
    res.statusCode = err.statusCode;
    res.end();
  });
};

// Reviews

exports.createReview = function(req, res) {
  var elementToOrion = req.body;
  var restaurantName = elementToOrion.itemReviewed.name;
  var restaurantReviews;
  var aggregateRatings;
  // -- We first get information regarding the restaurant
  utils.getListByType('Restaurant', restaurantName)
    .then(function(data) {
      auth.getUserDataPromise(req)
        .then(function(data) {
          elementToOrion = utils.reviewToOrion(data, elementToOrion);
          console.log(elementToOrion);
          utils.sendRequest('POST', elementToOrion)
            .then(function(data) {
              utils.getListByType('Review')
                .then(function(data) {
                  restaurantReviews = utils.getRestaurantReviews(
                    restaurantName,
                    data.body);
                  aggregateRatings = utils.getAggregateRating(
                    restaurantReviews);
                  utils.sendRequest('PATCH', aggregateRatings,
                      restaurantName)
                    .then(function(data) {
                      res.end();
                    })
                    .catch(function(err) {
                      res.statusCode = err.statusCode;
                      res.json(err.error);
                    });
                })
                .catch(function(err) {
                  res.statusCode = err.statusCode;
                  res.json(err.error);
                });
              res.headers = data.headers;
              res.location('/api/orion/review/' + elementToOrion.id);
              res.statusCode = data.statusCode;
              res.end();
            })
            .catch(function(err) {
              res.statusCode = err.statusCode;
              res.end();
            });
        })
        .catch(function(err) {
          res.statusCode = err.statusCode;
          res.json(JSON.parse(err.data));
        });
    })
    .catch(function(err) {
      res.statusCode = err.statusCode;
      res.json(err.error);
    });
};

exports.readReview = function(req, res) {
  utils.getListByType('Review', req.params.id)
    .then(function(data) {
      res.statusCode = data.statusCode;
      res.json(utils.dataToSchema(data.body));
    })
    .catch(function(err) {
      res.statusCode = err.statusCode;
      res.json(err.error);
    });
};

exports.updateReview = function(req, res) {
  var restaurantReviews;
  var aggregateRatings;
  var restaurantName;
  var userId;
  utils.getListByType('Review', req.params.id)
    .then(function(data) {
      restaurantName = data.body.itemReviewed.name;
      userId = data.body.author.name;
      auth.getUserDataPromise(req)
        .then(function(data) {
          if (userId !== data.id) {
            res.statusCode = 403;
            res.json({
              error: {
                message: 'The resource you are trying to access is forbidden',
                code: 403,
                title: 'Forbidden'
              }
            });
          } else {
            utils.sendRequest('PATCH', req.body, req.params.id)
              .then(function(data) {
                utils.getListByType('Review')
                  .then(function(data) {
                    restaurantReviews = utils.getRestaurantReviews(
                      restaurantName,
                      data.body);
                    aggregateRatings = utils.getAggregateRating(
                      restaurantReviews);
                    utils.sendRequest('PATCH', aggregateRatings,
                        restaurantName)
                      .then(function(data) {
                        res.end();
                      })
                      .catch(function(err) {
                        res.statusCode = err.statusCode;
                        res.json(err.error);
                      });
                  })
                  .catch(function(err) {
                    res.statusCode = err.statusCode;
                    res.json(err.error);
                  });
                res.statusCode = data.statusCode;
                res.end();
              })
              .catch(function(err) {
                res.statusCode = err.statusCode;
                res.json(err.error);
              });
          }
        })
        .catch(function(err) {
          res.statusCode = err.statusCode;
          res.json(JSON.parse(err.data));
        });
    })
    .catch(function(err) {
      res.statusCode = err.statusCode;
      res.json(err.error);
    });
};

exports.deleteReview = function(req, res) {
  var restaurantReviews;
  var aggregateRatings;
  var restaurantName;
  utils.getListByType('Review', req.params.id)
  .then(function(data) {
    restaurantName = data.body.itemReviewed.name;
    utils.sendRequest('DELETE', null, req.params.id)
    .then(function(data) {
      utils.getListByType('Review')
      .then(function(data) {
        restaurantReviews = utils.getRestaurantReviews(
          restaurantName,
          data.body);
        aggregateRatings = utils.getAggregateRating(
          restaurantReviews);
        utils.sendRequest('PATCH', aggregateRatings, restaurantName)
        .then(function(data) {
          res.end();
        })
        .catch(function(err) {
          res.statusCode = err.statusCode;
          res.json(err.error);
        });
      })
      .catch(function(err) {
        res.statusCode = err.statusCode;
        res.json(err.error);
      });
      res.statusCode = data.statusCode;
      res.end();
    })
    .catch(function(err) {
      res.statusCode = err.statusCode;
      res.json(err.error);
    });
  })
  .catch(function(err) {
    res.statusCode = err.statusCode;
    res.json(err.error);
  });
};

exports.getReviews = function(req, res) {
  utils.getListByType('Review')
    .then(function(data) {
      res.statusCode = data.statusCode;
      res.json(utils.dataToSchema(data.body));
    })
    .catch(function(err) {
      res.statusCode = err.statusCode;
      res.end();
    });
};

exports.getUserReviews = function(req, res) {
  var userReviews = [];
  utils.getListByType('Review')
  .then(function(data) {
    userReviews = utils.getUserReviews(req.params.user, data.body);
    res.statusCode = data.statusCode;
    res.json(utils.dataToSchema(userReviews));
  })
  .catch(function(err) {
    res.statusCode = err.statusCode;
    res.end();
  });
};

exports.getRestaurantReviews = function(req, res) {
  var restaurantReviews = [];
  utils.getListByType('Review')
  .then(function(data) {
    restaurantReviews = utils.getRestaurantReviews(
      req.params.restaurant,
      data.body);
    res.statusCode = data.statusCode;
    res.json(utils.dataToSchema(restaurantReviews));
  })
  .catch(function(err) {
    res.statusCode = err.statusCode;
    res.end();
  });
};

exports.getOrganizationReviews = function(req, res) {
  var organizationReviews = [];
  utils.getListByType('Review')
  .then(function(reviews) {
    utils.getListByType('Restaurant')
    .then(function(restaurants) {
      organizationReviews = utils.getOrgReviews(
        req.params.org,
        restaurants.body,
        reviews.body);
      res.statusCode = restaurants.statusCode;
      res.json(utils.dataToSchema(organizationReviews));
    })
    .catch(function(err) {
      res.statusCode = err.statusCode;
      res.end();
    });
  })
  .catch(function(err) {
    res.statusCode = err.statusCode;
    res.end();
  });
};

// Reservations

exports.createReservation = function(req, res) {
  var elementToOrion;
  // -- We first get information regarding the restaurant
  utils.getListByType('Restaurant', req.body.reservationFor.name)
  .then(function(data) {
    elementToOrion = req.body;
    elementToOrion.reservationFor.address = data.body.address;
    auth.getUserDataPromise(req)
    .then(function(data) {
      elementToOrion = utils.reservationToOrion(data, elementToOrion);
      utils.sendRequest('POST', elementToOrion)
      .then(function(data) {
        res.headers = data.headers;
        res.location('/api/orion/reservation/' + elementToOrion.id);
        res.statusCode = data.statusCode;
        res.end();
      })
      .catch(function(err) {
        res.statusCode = err.statusCode;
        res.end();
      });
    })
    .catch(function(err) {
      res.statusCode = err.statusCode;
      res.json(JSON.parse(err.data));
    });
  })
  .catch(function(err) {
    res.statusCode = err.statusCode;
    res.json(err.error);
  });
};

exports.readReservation = function(req, res) {
  utils.getListByType('FoodEstablishmentReservation', req.params.id)
    .then(function(data) {
      res.statusCode = data.statusCode;
      res.json(utils.dataToSchema(data.body));
    })
    .catch(function(err) {
      res.statusCode = err.statusCode;
      res.json(err.error);
    });
};

exports.updateReservation = function(req, res) {
  var restaurantName;
  var userId;
  utils.getListByType('FoodEstablishmentReservation', req.params.id)
  .then(function(data) {
    userId = data.body.underName.name;
    auth.getUserDataPromise(req)
    .then(function(data) {
      if (userId !== data.id) {
        res.statusCode = 403;
        res.json({
          error: {
            message: 'The resource you are trying to access is forbidden',
            code: 403,
            title: 'Forbidden'
          }
        });
      } else {
        utils.sendRequest('PATCH', req.body, req.params.id)
        .then(function(data) {
          res.statusCode = data.statusCode;
          res.end();
        })
        .catch(function(err) {
          res.statusCode = err.statusCode;
          res.json(err.error);
        });
      }
    })
    .catch(function(err) {
      res.statusCode = err.statusCode;
      res.json(JSON.parse(err.data));
    });
  })
  .catch(function(err) {
    res.statusCode = err.statusCode;
    res.json(err.error);
  });
};

exports.deleteReservation = function(req, res) {
  utils.sendRequest('DELETE', null, req.params.id)
    .then(function(data) {
      res.statusCode = data.statusCode;
      res.end();
    })
    .catch(function(err) {
      res.statusCode = err.statusCode;
      res.json(err.error);
    });
};
exports.getReservations = function(req, res) {
  utils.getListByType('FoodEstablishmentReservation')
    .then(function(data) {
      res.statusCode = data.statusCode;
      res.json(utils.dataToSchema(data.body));
    })
    .catch(function(err) {
      res.statusCode = err.statusCode;
      res.end();
    });
};

exports.getUserReservations = function(req, res) {
  var userReservations = [];
  utils.getListByType('FoodEstablishmentReservation')
  .then(function(data) {
    userReservations = utils.getUserReservations(
      req.params.user,
      data.body);
    res.statusCode = data.statusCode;
    res.json(utils.dataToSchema(userReservations));
  })
  .catch(function(err) {
    res.statusCode = err.statusCode;
    res.end();
  });
};

exports.getRestaurantReservations = function(req, res) {
  var restaurantReservations = [];
  utils.getListByType('FoodEstablishmentReservation')
  .then(function(data) {
    restaurantReservations = utils.getRestaurantReservations(
      req.params.restaurant,
      data.body);
    res.statusCode = data.statusCode;
    res.json(utils.dataToSchema(restaurantReservations));
  })
  .catch(function(err) {
    res.statusCode = err.statusCode;
    res.end();
  });
};

exports.getOrganizationReservations = function(req, res) {
  var organizationsReservations = [];
  utils.getListByType('FoodEstablishmentReservation')
  .then(function(reservations) {
    utils.getListByType('Restaurant')
    .then(function(restaurants) {
      organizationsReservations = utils.getOrgReservations(
        req.params.org,
        restaurants.body,
        reservations.body);
      res.statusCode = restaurants.statusCode;
      res.json(utils.dataToSchema(organizationsReservations));
    })
    .catch(function(err) {
      res.statusCode = err.statusCode;
      res.end();
    });
  })
  .catch(function(err) {
    res.statusCode = err.statusCode;
    res.end();
  });
};

// Sensors
exports.updateSensors = function(req, res) {
  var data = req.body;
  console.log('Sensor notification received:',
              data.contextResponses.length, 'notifications');

  function processNotification(elem, callback) {

    var item = elem.contextElement;
    var restaurant = {};

    restaurant.Pattern = /^SENSOR_(?:TEMP|HUM)_(.*)_(Kitchen|Dining)$/;

    if (item.id.search(restaurant.Pattern) == -1) {
      // not a restaurant sensor
      console.log('Ignored notification:', item.id);
      return callback(null);
    }

    restaurant.Name = restaurant.Pattern.exec(item.id)[1];
    restaurant.Room = restaurant.Pattern.exec(item.id)[2];

    console.log('Restaurant:', restaurant.Name);

    // get the restaurant info
    authRequest(
      '/v2/entities/' + restaurant.Name,
      'GET',
      {'type': 'Restaurant'})
      .then(
        function(data) {
          // restaurant exists
          var newProperty = restaurant.Room + '_' + item.attributes[0].name;
          var schema = {};
          schema[newProperty] = {
            '@type': 'PropertyValue',
            'additionalType': item.attributes[0].name,
            'propertyID': item.id,
            'name': restaurant.Room,
            'value': item.attributes[0].value
          };
          // update restaurant
          return authRequest(
            '/v2/entities/' + restaurant.Name,
            'POST',
            schema)
            .then(
              function(data) {
                // restaurant updated
                callback(null);
              })
            .catch(
              function(err) {
                // error updating restaurant
                console.log('ERROR:', err.message);
                callback(err);
              }
            );
        })
      .catch(
        function(err) {
          // restaurant does not exist
          console.log(err);
          callback(err);
        }
      );
  }

  function processEnd(err) {
    if (err) {
      console.log(err);
      res.statusCode = 500;
      res.end();
    } else {
      console.log('done');
      res.statusCode = 200;
      res.end();
    }
  }

  async.eachSeries(
    data.contextResponses,
    processNotification,
    processEnd
  );
};
