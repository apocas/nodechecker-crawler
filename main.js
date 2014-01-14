var Npmt = require('./lib/npmt');

var redis_ip = process.env.REDIS_HOST || '127.0.0.1';
var redis_port = process.env.REDIS_PORT || 6379;
var balancer_ip = process.env.BALANCER_HOST || '127.0.0.1';
var balancer_port = process.env.BALANCER_PORT || 5000;

var npmt = new Npmt(redis_ip, redis_port, balancer_ip, balancer_port);
npmt.run();
