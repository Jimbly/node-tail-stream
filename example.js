var fs = require('fs');
var TailStream = require('./index.js').TailStream;
var fout = fs.createWriteStream('./example.txt');

new TailStream('./example.txt').pipe(process.stdout);

setInterval(function () {
  fout.write(Math.random() + '\n');
}, 1000);
