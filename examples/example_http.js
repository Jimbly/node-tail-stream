// Populate a file with some data
var fs = require('fs');
var fout = fs.createWriteStream('example.txt');
setInterval(function () {
  fout.write(new Date().toUTCString() + ' ' + new Array(1024).join('...') + '\n');
}, 10);


var tail_stream = require('../');
var http = require('http');

http.createServer(function (req, res) {
  // Pipe the tail stream to the response
  tail_stream.createReadStream('example.txt').pipe(res, { highWaterMark: 256 });
}).listen(1337, '127.0.0.1');
console.log('Server running at http://127.0.0.1:1337/');

