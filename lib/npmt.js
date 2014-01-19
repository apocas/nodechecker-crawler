var JSONStream = require('JSONStream'),
    Dispatcher = require('./dispatcher'),
    MongoClient = require('mongodb').MongoClient,
    request = require('request'),
    format = require('util').format;


var Npmt = function(mip, mport, bip, bport) {
  var self = this;

  MongoClient.connect(format("mongodb://%s:%s/nodechecker", mip, mport), function(err, db) {
    if(err) throw err;

    self.mdb = db;

    self.dispatcher = new Dispatcher(self.mdb, bip, bport);

    self.dispatcher.on('finished', function() {
      console.log('Finished this run.');
      process.exit(0);
    });
  });
};


Npmt.prototype.run = function () {
  console.log('Starting a new run.');
  var self = this;

  var parser = JSONStream.parse();
  request('http://registry.npmjs.org/-/all').pipe(parser);

  parser.on('root', function (obj) {
    if(Object.keys(obj).length < 1) {
      process.exit(1);
    }

    for(var prop in obj) {
      if(obj[prop].name) {
        self.dispatcher.dispatch(obj[prop]);
      }
    }
  });
};


module.exports = Npmt;