var JSONStream = require('JSONStream'),
    MongoClient = require('mongodb').MongoClient,
    request = require('request'),
    format = require('util').format,
    colors = require('colors'),
    events = require('events'),
    sys = require('sys');


var Npmt = function(mip, mport, bip, bport) {
  var self = this;

  MongoClient.connect(format("mongodb://%s:%s/nodechecker?w=1", mip, mport), function(err, db) {
    if(err) throw err;

    self.mdb = db;
    self.emit('ready');
  });
};

sys.inherits(Npmt, events.EventEmitter);

Npmt.prototype.dispatch = function(module) {
  var self = this,
    collection = this.mdb.collection('runs');

  collection.find({module: module.name}).sort({_id : -1}).limit(1).toArray(function(err, docs) {
    if(err) throw err;

    //console.log(docs);

    var doc;
    if(docs.length > 0) doc = docs[0];
    //console.log(doc);

    if(!doc || (doc && module.time && new Date(module.time.modified).getTime() > doc.time)) {
      self.save(module);
    }
  });
};


Npmt.prototype.save = function(module) {
  console.log('Saving ' + module.name);
  var collection = this.mdb.collection('modules');

  delete module.users;
  delete module.maintainers;
  delete module.versions;
  delete module['dist-tags'];
  delete module._id;
  delete module.readmeFilename;
  
  module.status = null;

  collection.update({name: module.name}, {$set: module}, {upsert: true}, function(err, doc) {
    console.log('SAVED ' + module.name);
    if(err) {
      console.log(err);
      console.log(module);
    }
  });
  
};


Npmt.prototype.run = function () {
  console.log('Starting a new run.'.green);
  var self = this;

  var parser = JSONStream.parse();
  request('http://registry.npmjs.org/-/all').pipe(parser);

  parser.on('root', function (obj) {
    if(Object.keys(obj).length < 1) {
      process.exit(1);
    }

    for(var prop in obj) {
      if(obj[prop].name) {
        self.dispatch(obj[prop]);
      }
    }
  });
};


module.exports = Npmt;