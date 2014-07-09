var Tail = require('always-tail');

function TailStream(filename, separator, options) {
  var tail = new Tail(filename, separator, options);

  tail.on('line', function(data) {
    console.log("got line:", data);
  });

  tail.on('error', function(data) {
    console.log("error:", data);
  });

  tail.watch();
}

exports.TailStream = TailStream;
