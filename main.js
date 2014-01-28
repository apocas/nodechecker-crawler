var Npmt = require('./lib/npmt');

var mongo_ip = process.env.MONGODB_HOST || '127.0.0.1';
var mongo_port = process.env.MONGODB_PORT || 27017;
var balancer_ip = process.env.BALANCER_HOST || '127.0.0.1';
var balancer_port = process.env.BALANCER_PORT || 5000;


function roundToMB (bytes) {
  return (Math.round((bytes / 1024.0 / 1024) * 1000) / 1000) + 'MB';
}

function formatTime (nanoseconds) {
  var seconds = nanoseconds / 1000000000;
  var h = Math.floor(seconds / 3600);
  var m = Math.floor(seconds / 60) % 60;
  var s = seconds % 60;

  if (h < 10) h = '0' + h;
  if (m < 10) m = '0' + m;
  if (s < 10) s = '0' + s;
  return h + ':' + m + ':' + s;
}


function getMemory () {
  function print () {
    var memory = process.memoryUsage();

    console.log('Memory - rss: ' + roundToMB(memory.rss) + 
    ' heapTotal: ' + roundToMB(memory.heapTotal) + 
    ' heapUsed: ' + roundToMB(memory.heapUsed) + '\n');
  }

  print();

  setTimeout(function () {
    getMemory();
  }, 15000);
}

// get times
var start = process.hrtime();
var end = 0;

// print memory usage
getMemory();

// start crawler
var npmt = new Npmt(mongo_ip, mongo_port, balancer_ip, balancer_port);
npmt.on('ready', function() {
  npmt.run();
});


process.on('exit', function(code) {
  end = process.hrtime(start);
  console.log('Time - ' + formatTime(end[0] * 1e9 + end[1]));
});
