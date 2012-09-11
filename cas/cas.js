var request = require('request');
var jquery = require('jquery').create;
var jsdom = require('jsdom').jsdom;
var async = require('async');

// # CAS
// * `options` *object*
//   * `url` *string* URL of the CAS server
//   * `service` *string* URL of the service we're requesting access for
//
// Interface to the Central Authentication Service
function CAS (options) {
  var self = this;
  
  self.url = options.url;
  self.service = options.service;
}

// ## getKey
// Gets a CAS request key 
CAS.prototype.getKey = function (callback) {
  var self = this;

  var url = self.url + "/login?service=" + self.service;
  request(url, function (error, response, body) {
    if (error) return callback(error);

    var window = jsdom(body).createWindow();
    var $ = jquery(window);

    var el = $('input[type="hidden"]')[0];
    var key = $(el).val();

    self.key = key;
    callback(null, key);
  });
};

// ## getTicket
// Gets a CAS ticket
CAS.prototype.getTicket = function (username, password, callback) {
  var self = this;

  var data = {
    _currentStateId: "",
    _eventId: "submit",
    authenticationType: "Kerberos",
    lt: self.key,
    username: username,
    password: password
  };

  var url = self.url + "/login?service=" + self.service;

  request.post(url, {form: data}, function (error, res, body) {
    if (error) return callback(error);

    if (res.statusCode === 302) {
      self.loc = res.headers.location;
      self.ticket = self.loc.split('ticket=')[1];
    } else
      return callback(new Error("Invalid response from CAS, got " + res.statusCode));

    callback(null, self.ticket);
  });
};

// ## auth
// Runs a full CAS authentication and returns the URL to make reqs against
CAS.prototype.auth = function (username, password, callback) {
  var self = this;

  self.getKey(function (error) {
    if (error) return callback(error);
    self.getTicket(username, password, function (error) {
      if (error) return callback(error);
      callback(null, self.loc);
    });
  });
};

module.exports = CAS;
