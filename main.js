var Npmt = require('./lib/npmt');

var mongo_ip = process.env.MONGODB_HOST || '127.0.0.1';
var mongo_port = process.env.MONGODB_PORT || 27017;
var balancer_ip = process.env.BALANCER_HOST || '127.0.0.1';
var balancer_port = process.env.BALANCER_PORT || 5000;

var npmt = new Npmt(mongo_ip, mongo_port, balancer_ip, balancer_port);
npmt.on('ready', function() {
  npmt.run();
});
