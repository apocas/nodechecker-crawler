require('colors');

var sys = require('sys'),
  events = require('events'),
  DuplexEmitter = require('duplex-emitter'),
  reconnect     = require('reconnect');

var Dispatcher = function (redis, hostname, port) {
  var self = this;
  this.redis = redis;

  reconnect(function (socket) {
    console.log('Connected to dispatcher'.green);
    self.socket = socket;
    self.remote = DuplexEmitter(socket);

    self.remote.on('done', function(data) {
      self.done(data);
    });
  }).connect(port, hostname);
};

sys.inherits(Dispatcher, events.EventEmitter);

Dispatcher.prototype.dispatch = function(module) {
  var self = this,
    repo;

  if(module.repository && module.repository.type == 'git' && module.repository.url && module.repository.url.length > 0) {
    repo = module.repository.url;
  }

  this.redis.multi()
    .hget('times', module.name)
    .sismember(['ok', module.name])
    .sismember(['nok', module.name])
    .sismember(['failed', module.name])
    .sismember(['rfailed', module.name])
    .sismember(['inexistent', module.name])
    .hget(['codes', module.name])
    .exec(function (err, replies) {
      var expired = (replies[0] === null || (new Date().getTime()) - replies[0] > (60000 * 60 * 24 * 30));
      if(module.time && module.time.modified) {
        expired = (new Date(module.time.modified).getTime() > replies[0]);
      } else {
        console.log('Without modified field: ' + module.name);
      }

      if(replies[0] === null || (expired === true && (replies[1] == 1 || replies[2] == 1 || replies[3] == 1 || replies[5] == 1 || replies[4] == 1))) {
        self.redis.sadd('running', module.name);
        self.remote.emit('test', {'type': 'module', 'module': module.name, 'repository': repo});
      } else {
        self.done({'module': module.name});
      }
    });
};


Dispatcher.prototype.done = function (data) {
  if(data.job.result !== undefined && data.job.result !== null) {

    if(data.result.output !== undefined && data.result.output !== null) {
      this.redis.hset('output', data.job.module, data.result.output);
    }

    this.redis.hset('codes', data.job.module, data.result.code);
    this.redis.hset('times', data.job.module, new Date().getTime());

    this.redis.srem('failed', data.job.module);
    this.redis.srem('rfailed', data.job.module);
    this.redis.srem('inexistent', data.job.module);
    this.redis.srem('ok', data.job.module);
    this.redis.srem('nok', data.job.module);

    switch(data.result.result) {
      case 'ok':
        this.redis.sadd('ok', data.job.module);
        break;
      case 'nottested':
        this.redis.sadd('inexistent', data.job.module);
        break;
      case 'nok':
        this.redis.sadd('nok', data.job.module);
        break;
      case 'timedout':
        console.log('TIMEDOUT! ' + data.job.module);
        this.redis.sadd('failed', data.job.module);
        this.redis.hset('times', data.job.module, new Date().getTime());
        break;
      case 'tarball':
        console.log('TARBALL INVALID! ' + data.module);
        this.redis.sadd('rfailed', data.job.module);
        this.redis.hset('times', data.job.module, new Date().getTime());
        break;
    }

    console.log('DONE! ' + data.job.module + ' with code ' + data.result.result + '(' + data.result.code + ')');
  } else {
    console.log('DONE! ' + data.job.module + ' STAY AS IS!');
  }
};

module.exports = Dispatcher;