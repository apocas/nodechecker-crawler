var JSONStream = require('JSONStream'),
  mongojs = require('mongojs'),
  request = require('request'),
  util = require('util'),
  format = util.format,
  colors = require('colors'),
  events = require('events'),
  npm = require('npm'),
  async = require('async');


var Npmt = function(mip, mport, bip, bport) {
  events.EventEmitter.call(this);
  var self = this;

  self.mdb = mongojs(format("%s:%s/nodechecker?w=1&poolSize=5", mip, mport));

  self.mdb.runCommand({
    ping: 1
  }, function(err, res) {
    if (err) throw err;
    self.emit('ready');
  });
};

util.inherits(Npmt, events.EventEmitter);


Npmt.prototype.dispatch = function(module, cb) {
  var self = this,
    collection = self.mdb.collection('runs');

  if (!module.time) return cb();

  collection.find({
      module: module.name
    }, {
      output: 0
    })
    .sort({
      time: -1
    })
    .limit(1)
    .toArray(function(err, doc) {
      if (err) return cb(err);
      console.log(module);
      cb();
      if ((module['dist-tags'] && module['dist-tags'].latest) && (!doc.length || module['dist-tags'].latest != doc[0].version)) {
        var v;
        if (doc.length > 0 && doc[0].version) {
          v = doc[0].version;
        }
        console.log('Version missmatch - ' + module.name + ' - ' + module['dist-tags'].latest + ' - ' + v);
        return self.save(module, cb);
      } else {
        console.log('Skipping ' + module.name);
      }

      // nothing return cb
      cb();
    });
};


Npmt.prototype.save = function(module, cb, status) {
  var self = this;
  var collection = self.mdb.collection('modules');

  var version = module['dist-tags'].latest;

  delete module.users;
  delete module.maintainers;
  delete module['dist-tags'];
  delete module._id;
  delete module.readmeFilename;
  delete module.versions;

  module.status = null || status;
  module.dependencies = [];
  module.version = version;

  collection.update({
    name: module.name
  }, {
    $set: module
  }, {
    upsert: true
  }, cb);
};


Npmt.prototype.run = function() {
  console.log('Starting a new run.'.green);

  var self = this;
  var modules_data = [];
  var count = 0;

  var parser = JSONStream.parse();

  var options = {
    url: 'http://registry.npmjs.org/-/all',
    headers: {
      'Cookie': '__qca=P0-794283095-1395428393360;'
    }
  };

  request(options).pipe(parser);

  function handler(module, callback) {
    self.dispatch(module, function(err, res) {
      if (err) return callback(err);

      if (res) console.log('Saving - ' + module.name + ' - ' + res.ok);
      count--;
      //console.log(count);

      callback();
    });
  }

  parser.on('root', function(obj) {
    if (Object.keys(obj).length < 1) {
      process.exit(1);
    }

    for (var prop in obj) {
      if (obj[prop].name) {
        modules_data.push(obj[prop]);
      }
    }

    count = modules_data.length;

    async.mapLimit(modules_data, 1, handler, function(err, results) {
      if (err) throw err;
      console.log('FINISHED!!');
      process.exit(0);
    });
  });
};


module.exports = Npmt;
