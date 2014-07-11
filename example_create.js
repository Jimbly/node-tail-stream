var fs = require('fs');
if (fs.existsSync('example.txt')) {
  fs.unlinkSync('example.txt');
}
setTimeout(function () {
  // Populate a file with some data after a bit
  var fout = fs.createWriteStream('example.txt');
  setInterval(function () {
    fout.write(new Date().toUTCString() + ' ' + Math.random() + '\n');
  }, 1000);
}, 1000);

// Pipe the tail stream to stdout
var tail_stream = require('./');
var stream = tail_stream.createReadStream('example.txt', {interval: 100});
stream.pipe(process.stdout);
