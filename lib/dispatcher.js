var sys = require('sys'),
  events = require('events'),
  Runner = require('./runner'),
  os = require('os'),
  dnode = require('dnode');

var Dispatcher = function (redis) {
  var self = this;

  this.buffer = [];
  this.working = 0;
  this.total = 0;
  this.done = 0;
  this.slimit = 4;
  this.redis = redis;
  this.d = dnode.connect(5004);
};

sys.inherits(Dispatcher, events.EventEmitter);

Dispatcher.prototype.dispatch = function(module) {
  var self = this;

  var runner = new Runner(self.remote, module, self.redis);

  runner.on('done', function() {
    self.done++;
    self.working--;
    self.redis.srem('running', this.mod.name);
    self.reload();

    if(self.done >= self.total) {
      self.emit('finished');
    }
  });

  this.total++;
  this.buffer.push(runner);

  if(this.working < this.slimit) {
    this.reload();
  }
};

Dispatcher.prototype.start = function (cb) {
  var self = this;

  this.d.on('remote', function (remote) {
    console.log('Dispatcher started!');
    self.remote = remote;
    cb();
  });
};

Dispatcher.prototype.reload = function() {
  if(this.working < this.slimit) {
    this.working++;
    var runner = this.buffer.splice(0,1)[0];
    if(runner !== undefined) {
      //console.log('WORKING - ' + this.working + ' ' + this.buffer.length);
      runner.work();
    }
  }
};

module.exports = Dispatcher;