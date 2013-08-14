var JSONStream = require('JSONStream'),
    Dispatcher = require('./dispatcher'),
    redis = require("redis"),
    request = require('request');


var Npmt = function(ip, port) {
  var self = this;

	this.redis_client = redis.createClient(port, ip);
  this.dispatcher = new Dispatcher(this.redis_client);

  this.dispatcher.on('finished', function() {
    console.log('Finished this run.');
    process.exit(0);
  });
};


Npmt.prototype.run = function () {
  var self = this;
  this.dispatcher.start(function() {
    self.init();
  });
};


Npmt.prototype.init = function () {
  console.log('Starting a new run.');
  var self = this;
  self.redis_client.del('running');

  var parser = JSONStream.parse();
  request('http://registry.npmjs.org/-/all').pipe(parser);

  parser.on('root', function (obj) {
    if(Object.keys(obj).length < 1) {
      process.exit(1);
    }

    self.redis_client.hkeys('times', function(err, members) {
      for (var i = 0; i < members.length; i++) {
        if(obj[members[i]] === undefined)  {
          self.removeOld(members[i]);
        }
      }
    });

    for(var prop in obj) {
      if(obj[prop].name) {
        self.dispatcher.dispatch(obj[prop]);
      }
    }
  });
};


Npmt.prototype.removeOld = function(mname) {
  this.redis_client.multi()
    .srem('failed', mname)
    .srem('rfailed', mname)
    .srem('inexistent', mname)
    .srem('ok', mname)
    .srem('nok', mname)
    .hdel('times', mname)
    .exec(function (err, replies) {
      if(err) throw err;

      console.log('REMOVED: ' + mname);
    });
};

module.exports = Npmt;