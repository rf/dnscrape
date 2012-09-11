var nock = require('nock');
var CAS = require('./cas');
var assert = require('assert');

  //var url = "https://cas.rutgers.edu/login?service=https://dn.rutgers.edu/Default.aspx";
suite('getCASData', function () {
  test('gets key, mocked data', function (done) {
    var context = nock('https://cas.rutgers.edu')
      .get('/login?service=https://dn.rutgers.edu/Default.aspx')
      .replyWithFile(200, __dirname + "/fixtures/cas_key.html");

    var cas = new CAS({
      url: "https://cas.rutgers.edu", service: "https://dn.rutgers.edu/Default.aspx"
    });

    cas.getKey(function (error, key) {
      try {
        assert(error === null);
        assert(typeof key === 'string', 'key is string');
        assert(key === 'foobar');
        context.done();
        done();
      } catch (e) { done(e); }
    });
  });
});

suite('getTicket', function () {
  test('gets ticket, mocked data', function (done) {
    var data = "_currentStateId=&_eventId=submit&authenticationType=Kerberos&lt=sdf&username=foo&password=bar";

    var context = nock('https://cas.rutgers.edu')
      .post('/login?service=https://dn.rutgers.edu/Default.aspx', data)
      .reply(302, "moved", {location: "service/?ticket=foo bar"});

    var cas = new CAS({
      url: "https://cas.rutgers.edu", service: "https://dn.rutgers.edu/Default.aspx"
    });

    cas.key = "sdf";

    cas.getTicket("foo", "bar", function (error, ticket) {
      try {
        assert(error === null, "no error");
        assert(ticket === "foo bar", "correct ticket");
        context.done();
        done();
      } catch (e) { done(e); }
    });
  });
});

suite('auth', function () {
  test('full mocked', function (done) {
    var data = "_currentStateId=&_eventId=submit&authenticationType=Kerberos&lt=foobar&username=foo&password=bar";

    var context = nock('https://cas.rutgers.edu')
      .get('/login?service=https://dn.rutgers.edu/Default.aspx')
      .replyWithFile(200, __dirname + "/fixtures/cas_key.html")
      .post('/login?service=https://dn.rutgers.edu/Default.aspx', data)
      .reply(302, "moved", {location: "service/?ticket=foo bar"});

    var cas = new CAS({
      url: "https://cas.rutgers.edu", service: "https://dn.rutgers.edu/Default.aspx"
    });

    cas.auth("foo", "bar", function (error, location) {
      try {
        assert(error === null, "no error");
        assert(location === "service/?ticket=foo bar");
        assert(cas.key === "foobar");
        assert(cas.ticket === "foo bar");
        context.done();
        done();
      } catch (e) { done(e); }
    });

  });

});
