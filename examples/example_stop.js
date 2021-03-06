// Populate a file with some data
var fs = require('fs');
var fout = fs.createWriteStream('example.txt');
var write_interval = setInterval(function () {
  fout.write(new Date().toUTCString() + ' ' + Math.random() + '\n');
}, 10);

// Pipe the tail stream to stdout
var tail_stream = require('../');
var stream = tail_stream.createReadStream('example.txt', {highWaterMark: 256});
var bytes = 0;
function onReadable() {
  var chunk;
  while (null !== (chunk = stream.read())) {
    console.log('got %d bytes of data', chunk.length);
    bytes += chunk.length;
  }
  if (bytes > 10000) {
    console.log('read ' + bytes + ' bytes, stopping listening');
    setTimeout(function () {
      clearInterval(write_interval);
    }, 2000);
    // In this case, can either remove the listener (e.g. broken pipe) or explicitly close
    stream.removeListener('readable', onReadable);
    //stream.close();
  }
}
stream.on('readable', onReadable);

console.log('This should exit naturally in a moment if everything is getting cleaned up right.');
