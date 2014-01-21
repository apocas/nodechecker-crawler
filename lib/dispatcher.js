require('colors');

var sys = require('sys'),
  events = require('events'),
  DuplexEmitter = require('duplex-emitter'),
  reconnect     = require('reconnect');

var Dispatcher = function (mdb, hostname, port) {
  var self = this;
  this.mdb = mdb;

  reconnect(function (socket) {
    console.log('Connected to dispatcher'.green);
    self.socket = socket;
    self.remote = DuplexEmitter(socket);

    self.remote.on('done', function(data) {
      self.saveStatus(data.job.module, data.result.result);
      self.done(data);
    });
  }).connect(port, hostname);
};

sys.inherits(Dispatcher, events.EventEmitter);

Dispatcher.prototype.dispatch = function(module) {
  var self = this,
    repo,
    collection = this.mdb.collection('runs');


  if(module.repository && module.repository.type == 'git' && module.repository.url && module.repository.url.length > 0) {
    repo = module.repository.url;
  }

  collection.find({module: module.name}).sort({_id : -1}).limit(1).toArray(function(err, docs) {
    if(err) throw err;

    //console.log(docs);

    var doc;
    if(docs.length > 0) doc = docs[0];
    //console.log(doc);

    if(!doc || (doc && module.time && new Date(module.time.modified).getTime() > doc.time)) {
      //console.log('Testing ' + module.name);
      self.remote.emit('test', {'type': 'module', 'module': module.name, 'repository': repo});
      self.save(module);
    }
  });
};


Dispatcher.prototype.save = function(module) {
  var collection = this.mdb.collection('modules');

  delete module.users;
  delete module.maintainers;
  delete module.versions;
  delete module['dist-tags'];
  
  collection.update({name: module.name}, {$set: module}, {upsert: true, safe: true}, function(err, docs) {
    if(err) {
      console.log(err);
      console.log(module);
    }
  });
};


Dispatcher.prototype.saveStatus = function(modulen, status) {
  var collection = this.mdb.collection('modules');
  collection.update({name: modulen}, {$set: {status: status}}, {safe: true}, function(err, docs) {
    if(err) {
      console.log(err);
      console.log(modulen);
    }
  });
};


Dispatcher.prototype.done = function (data) {
  var collection = this.mdb.collection('runs');

  var dinsert = {
    module: data.job.module,
    time: new Date().getTime(),
    status: data.result.result,
    output: data.result.output,
    code: data.result.code
  };

  //console.log(dinsert);

  collection.insert(dinsert, {safe: true, w: 1}, function(err, docs) {
    if(err) console.log(err);

    console.log('DONE! ' + data.job.module + ' with code ' + data.result.result + '(' + data.result.code + ')');
  });
};

module.exports = Dispatcher;