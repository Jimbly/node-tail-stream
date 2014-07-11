// This doesn't seem to work, for some reason we get null back all the time after
// we've paused and resumed, even if our stream is definitely pushing data

// Populate a file with some data
var fs = require('fs');
var fout = fs.createWriteStream('example.txt');
var write_interval = setInterval(function () {
  fout.write(new Date().toUTCString() + ' ' + new Array(100).join('...') + '\n');
}, 10);

// Pipe the tail stream to stdout
var tail_stream = require('./');
var stream = tail_stream.createReadStream('example.txt', {highWaterMark: 256});
var bytes = 0;
var endc = 0;
function onReadable() {
  var chunk;
  console.log('onReadable');
  while (null !== (chunk = stream.read())) {
    console.log('got %d bytes of data', chunk.length);
    bytes += chunk.length;
  }
  if (bytes > 4000) {
    console.log('read ' + bytes + ' bytes, pausing');
    bytes = 0;

    ++endc;
    if (endc === 1) {
      stream.pause();
      stream.removeListener('readable', onReadable);
      setTimeout(function () {
        // start listening again
        console.log('listening again');
        stream.on('readable', onReadable);
        stream.resume();
      }, 1500);
    } else {
      stream.removeListener('readable', onReadable);
      stream.close();
      setTimeout(function () {
        console.log('stopping writing');
        clearInterval(write_interval);
      }, 2000);
    }
  }
}
stream.on('readable', onReadable);

console.log('This should exit naturally in a moment if everything is getting cleaned up right.');
