var JSONStream = require('JSONStream'),
    mongojs = require('mongojs'),
    request = require('request'),
    util = require('util'),
    format = util.format,
    colors = require('colors'),
    events = require('events'),
    npm = require('npm');


var Npmt = function (mip, mport, bip, bport) {
  events.EventEmitter.call(this);
  var self = this;

  self.mdb = mongojs(format("%s:%s/nodechecker?w=1&poolSize=5", mip, mport));

  self.mdb.runCommand({ping:1}, function(err, res) {
    if (err) throw err;
    self.emit('ready');
  });
};

util.inherits(Npmt, events.EventEmitter);


Npmt.prototype.dispatch = function(module, cb) {
  var self = this,
  collection = self.mdb.collection('runs');

  if (!module.time) return cb();

  collection.find({module: module.name}, {time: 1, _id: 0})
  .sort({time: -1})
  .limit(1)
  .toArray(function (err, doc) {
    if(err) return cb(err);

    // don't exist || new time and must update the module
    if (!doc.length || (doc.length && new Date(module.time.modified).getTime() > doc[0].time))
      return self.save(module, cb);

    // nothing return cb
    cb();
  });
};


Npmt.prototype.save = function(module, cb) {
  var self = this;
  var collection = self.mdb.collection('modules');

  delete module.users;
  delete module.maintainers;
  delete module['dist-tags'];
  delete module._id;
  delete module.readmeFilename;
  delete module.versions;

  npm.load({loglevel: 'silent'}, function (er) {
    npm.commands.info([module.name], function (er, data) {
      module.status = null;
      module.dependencies = [];

      if(!er) {
        var vers = Object.keys(data);
        if(data[vers[vers.length -1]].dependencies) {
          var deps = Object.keys(data[vers[vers.length -1]].dependencies);
          for(var i = 0; i< deps.length; i++) {
            module.dependencies.push(deps[i].split('.').join('\uff0E'));
          }
        }
      }

      collection.update({name: module.name}, {$set: module}, {upsert: true}, cb);
    });
  });
};


Npmt.prototype.run = function () {
  console.log('Starting a new run.'.green);
  var self = this;

  var parser = JSONStream.parse();
  request('http://registry.npmjs.org/-/all').pipe(parser);

  var modules_data = [];

  // way to handle with async
  function handler (module) {
    // using setTimeout with 1 mls to prevent Maximum call stack size exceeded
    setTimeout(function () {
      if (!module) process.exit(0);

      self.dispatch(module, function (err, res) {
        if (err) throw err;

        // some output
        if (res) console.log('Saving - ' + module.name + ' - ' + res.ok);
        // more output
        process.stdout.write(modules_data.length.toString() + '\r');

        handler(modules_data.shift());
      });
    }, 1);
  }


  parser.on('root', function (obj) {
    if(Object.keys(obj).length < 1) {
      process.exit(1);
    }

    for(var prop in obj) {
      if(obj[prop].name) {
        modules_data.push(obj[prop]);
      }
    }

    handler(modules_data.shift());
  });
};


module.exports = Npmt;
