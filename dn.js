var request = require('request');
var jquery = require('jquery').create;
var jsdom = require('jsdom').jsdom;
var async = require('async');
var util = require('util');
var prompt = require('prompt');
var EventEmitter = require('events').EventEmitter;

var CAS = require('./cas');

// # DN
//
// Degree Navigator Scraper
function DN (options) {
  EventEmitter.apply(this);
  var self = this;

  self.cas = new CAS({
    url: "https://cas.rutgers.edu", 
    service: "https://dn.rutgers.edu/Default.aspx"
  });
}

util.inherits(DN, EventEmitter);

// ## setupWindow
// Sets up the window with jQuery and pulls out the viewstate.
DN.prototype.setupWindow = function (body) {
  var self = this;

  var window = jsdom(body).createWindow();
  var $ = jquery(window);

  var el = $('input[name="__VIEWSTATE"]');
  self.viewState = $(el).val();

  return $;
};

// ## login
// Login to Degree Navigator
DN.prototype.login = function (username, password, callback) {
  var self = this;
  self.cas.auth(username, password, function (error, location) {
    if (error) return callback(error);

    self.location = location;
    request(location, function (error, res, body) {
      if (error) return callback(error);
      
      self.setupWindow(body);
      callback();
    });
  });
};

function getCourseSearchContent ($, destination) {
  var els = $('#_ctl6__Template__ctl1 tr[class!="DeAcDataGridListPager"][class!="DeAcDataGridListHeader"] a');
  $.each(els, function (num, item) {
    var el = $(item);
    destination[el.text()] = el.attr('href');
  });
}

// ## searchPrograms
// Searches programs of study for your query.
DN.prototype.searchPrograms = function (query, callback) {
  var self = this;
  var url = "https://dn.rutgers.edu/Default.aspx?pageid=degreeSearch";
  var data = {
    "_ctl6:_Template:txtKeyword": query,
    "_ctl6:_Template:btnSearch": "Search",
    "_ctl6:_Template:ddlPageSize": 100,
    "__VIEWSTATE": self.viewState,
    "__EVENTARGUMENT": "",
    "__EVENTTARGET": ""
  };
  var output = {};

  request.post(url, {form: data}, function (error, res, body) {
    if (error) return callback(error);

    var $ = self.setupWindow(body);
    getCourseSearchContent($, output);

    // Gets the pager links
    var pages = $("tr.DeAcDataGridListPager td a");
    var i = 2;

    async.forEachSeries(pages, function (item, callback) {
      var el = $(item);
      var target = el.attr('href').match("\'([^,]*)\'")[1].split('$').join(':');
      data.__VIEWSTATE = self.viewState;
      data.__EVENTTARGET = target;
      delete data['_ctl6:_Template:btnSearch'];
      self.emit('debug', "Requesting page " + i);
      i += 1;

      request.post(url, {form: data}, function (error, res, body) {
        if (error) return callback(error);

        var $ = self.setupWindow(body);
        getCourseSearchContent($, output);

        callback();
      });
    }, function (error) {
      callback(error, output);
    });
  });
};

// ## listAllPrograms
// Attempts to list all programs by running a search for each letter of the
// alphabet.
DN.prototype.listAllPrograms = function (callback) {
  var self = this;
  var alphabet = "abcdefghijklmnopqrstuvwxyz".split('');

  async.reduce(alphabet, {}, function (memo, item, callback) {
    self.emit('debug', "searching for " + item);
    self.searchPrograms(item, function (error, data) {
      if (error) return callback(data);

      for (var i in data) memo[i] = data[i];
      callback(null, memo);
    });
  }, function (error, programs) {
    self.programs = programs;
    callback(error, programs);
  });
};

// ## getDegree
// * `degree` *string* url of degree from a degree query
// * `needVersions` *boolean* whether or not we need to find different degree
//   versions
// * `callback` *function (error, data)* callback function
//
// Scrapes a degree page. Returns an object like
// { requirements: [[course id, category], [course id], ...],
//   categories: [{name: name, popup: url}, ...],
//   versions: {name: url, ...} }
DN.prototype.getDegree = function (url, needVersions, callback) {
  var self = this;
  var output = {};
  request("https://dn.rutgers.edu" + url, function (error, res, body) {
    if (error) return callback(error);
    var $ = self.setupWindow(body);

    // Parse out different versions of the degree
    if (needVersions) {
      var opts = $("#_ctl6__Template_ddlDegreeVersion").children();
      output.versions = opts.map(function (item) { 
        var urlBase = url.split('_');
        urlBase[urlBase.length - 2] = item.value;
        return urlBase.join('_');
      });
    }

  });
};

var test = new DN();
prompt.start();

var schema = {
  properties: {
    name: {
      pattern: /^[a-zA-Z\s\-]+$/,
      message: 'Name must be only letters, spaces, or dashes',
      required: true
    },
    password: {
      hidden: true
    }
  }
};

prompt.get(schema, function (error, data) {
  test.login(data.name, data.password, function (error) {
    test.listAllPrograms(function (error, programs) {
      if (error) console.log("ERROR: " + error);
      else console.dir(programs);
    });
  });
});

test.on('debug', console.log);

