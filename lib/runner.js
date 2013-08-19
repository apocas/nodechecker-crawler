var sys = require('sys'),
  events = require('events');

var Runner = function(remote, mod, redis) {
  this.mod = mod;
  this.redis = redis;
  this.repo = null;
  this.remote = remote;

  if(this.mod.repository !== undefined && this.mod.repository.type == 'git' && this.mod.repository.url !== undefined && this.mod.repository.url.length > 0) {
    this.repo = this.mod.repository.url;
  }
};


sys.inherits(Runner, events.EventEmitter);


Runner.prototype.work = function() {
  var self = this;

  this.redis.sadd('running', this.mod.name);

  self.redis.multi()
    .hget('times', self.mod.name)
    .sismember(['ok', self.mod.name])
    .sismember(['nok', self.mod.name])
    .sismember(['failed', self.mod.name])
    .sismember(['rfailed', self.mod.name])
    .sismember(['inexistent', self.mod.name])
    .hget(['codes', self.mod.name])
    .exec(function (err, replies) {
      var expired = (replies[0] === null || (new Date().getTime()) - replies[0] > (60000 * 60 * 24 * 30));
      if(self.mod.time && self.mod.time.modified) {
        expired = (new Date(self.mod.time.modified).getTime() > replies[0]);
      } else {
        console.log('Without modified field: ' + require('util').inspect(self.mod));
      }

      if(replies[0] === null || (expired === true && (replies[1] == 1 || replies[2] == 1 || replies[3] == 1 || replies[5] == 1 || replies[4] == 1))) {
        //console.log('Sending request');
        self.remote.testModule(self.mod.name, self.repo, function (result) {
          self.done(result);
        });
      } else {
        self.done(null);
      }
    });
};


Runner.prototype.done = function (result) {
  var self = this;

  if(result !== undefined && result !== null) {

    if(result.output !== undefined && result.output !== null) {
      this.redis.hset('output', this.mod.name, result.output);
    }

    self.redis.hset('codes', this.mod.name, result.code);

    self.redis.hset('times', this.mod.name, new Date().getTime());

    self.redis.srem('failed', this.mod.name);
    self.redis.srem('rfailed', this.mod.name);
    self.redis.srem('inexistent', this.mod.name);
    self.redis.srem('ok', this.mod.name);
    self.redis.srem('nok', this.mod.name);

    switch(result.result) {
      case 'ok':
        self.redis.sadd('ok', this.mod.name);
        break;
      case 'nottested':
        self.redis.sadd('inexistent', this.mod.name);
        break;
      case 'nok':
        self.redis.sadd('nok', this.mod.name);
        break;
      case 'timedout':
        console.log('TIMEDOUT! ' + this.mod.name);
        self.redis.sadd('failed', this.mod.name);
        self.redis.hset('times', this.mod.name, new Date().getTime());
        break;
      case 'tarball':
        console.log('TARBALL INVALID! ' + this.mod.name);
        self.redis.sadd('rfailed', this.mod.name);
        self.redis.hset('times', this.mod.name, new Date().getTime());
        break;
    }

    console.log('DONE! ' + this.mod.name + ' with code ' + result.result);
  } else {
    console.log('DONE! ' + this.mod.name + ' STAY AS IS!');
  }

  this.emit('done');
};


module.exports = Runner;