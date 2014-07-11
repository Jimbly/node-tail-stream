node-tail-stream
================

Continuous file tail as a stream.  Handles file truncation, but not yet file
rollover (old file being deleted/moved and a new file with the same name
replacing it).

Differences from [https://github.com/juul/tail-stream](tail-stream)
============================
Somehow, despite searching, I failed to find this existing module before
authoring my own.  The only key difference is that this new module handles
broken pipes slightly more elegantly, with some automatic cleanup and a manual
close to prevent leaking of FSWatchers.

Usage
=====
Use `tail_stream.createReadStream` just like `fs.createReadStream` except the
stream will not end but continue emitting data as the backing file grows.

Example
=======

```javascript
// Pipe the tail stream to stdout
var tail_stream = require('tail-stream');
var stream = tail_stream.createReadStream('example.txt', {interval: 100});
stream.pipe(process.stdout);
```

For an example of using this to tail stream a file to an http request, see the example under *Caveats*.

Caveats
=======
Due to the Streams API in node, we do not know if our Readable stream was piped
into something which has now been closed, and our TailStream will stay active
(leaving the program running and also with an active FSWatcher which may be
consuming significant CPU) unless explicitly closed.  We automatically recover
if the stream was not at the end of the file we're streaming or if the file
we're streaming continues to be modified, but a stale, unchanging file will
leave a FSWatcher (due to an outstanding Readable Stream ._read call) unless
explicitly closed.

Example:
```javascript
require('http').createServer(function (req, res) {
  var stream = require('tail-stream').createReadStream('example.txt');
  stream.pipe(res);
  res.on('end', function() {
    stream.close();
  });
}).listen(1337, '127.0.0.1');

```
