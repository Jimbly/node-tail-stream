/*global doRead*/
var assert = require('assert');
var fs = require('fs');
var Readable = require('stream').Readable;
var util = require('util');

//var debug = console.log.bind(console);
var debug = function(){};

function startWatch(ts) {
  if (!ts.watcher) {
    debug('creating watcher');
    ts.watcher = fs.watch(ts.filename, function (/*event*/) {
      if (ts.closed) {
        return;
      }
      //debug('event is: ' + event); // probably 'change', pump regardless to be safe
      // Give it a kick
      if (ts.had_no_data && ts.read_pending) {
        ts.had_no_data = false;
        doRead(ts);
      } else if (ts.read_pending) {
        // either a read is in flight right now, or we're still waiting on an fd
        assert.ok(ts.read_in_progress || ts.get_fd_in_progress);
        // We're going to want to try a read again immediately if the one in flight got no data
        ts.needs_reread = true;
      } else {
        // we do not have a read pending, whoever is reading us must be stopped,
        // do nothing with this notification.
      }
    });
  }
}

function stopWatch(ts) {
  if (ts.watcher) {
    ts.watcher.close();
    ts.watcher = null;
  }
}

function checkIdle(ts) {
  assert.ok(ts.check_idle_timeout);
  ts.check_idle_timeout = null;
  assert.ok(!ts.read_in_progress && !ts.get_fd_in_progress);
  // If we get here, we're not reading anything, and haven't been asked to,
  // stop watching
  stopWatch(ts);
  debug('timeout expired, closing watcher');
}

function doRead(ts) {
  assert.ok(ts.fd);
  assert.ok(ts.read_pending);
  ts.had_no_data = false;
  assert.ok(!ts.read_in_progress);
  ts.read_in_progress = true;
  ts.needs_reread = false;
  fs.fstat(ts.fd, function(err, stat) {
    if (ts.closed) {
      return;
    }
    assert.ok(ts.read_in_progress);

    if (err) {
      ts.read_in_progress = false;
      // TODO: retry later, need to verify .fd is valid, check if .ino changed
      debug('error statting', err);
      ts.emit('error', err);
      return;
    }

    var start = ts.offset;
    var end = stat.size;

    if (end < start) {
      // file was truncated
      start = 0;
    }

    assert.ok(ts.read_pending);
    var size = Math.min(ts.read_pending, end - start);
    if (size === 0) {
      // no data, try again later
      debug('no data to read');
      ts.had_no_data = true;
      ts.read_in_progress = false;
      startWatch(ts); // ensure we're watching the file
      // if a watch event came in while doing this read, need to read again
      if (ts.needs_reread) {
        doRead(ts);
      }
      return;
    }

    var buffer = new Buffer(size);

    fs.read(ts.fd, buffer, 0, size, start, function(err, bytesRead, buff) {
      if (ts.closed) {
        return;
      }
      assert.ok(ts.read_in_progress);
      ts.read_in_progress = false;
      if (err) {
        // Error, stop reading
        debug('error reading', err);
        return ts.emit('error', err);
      }

      if (bytesRead === 0) {
        // no data, try again later
        debug('no data read');
        ts.had_no_data = true;
        startWatch(ts); // ensure we're watching the file
        // if a watch event came in while doing this read, need to read again
        if (ts.needs_reread) {
          doRead(ts);
        }
        return;
      }

      debug('read ' + bytesRead + ' bytes');
      ts.read_pending = 0;
      ts.offset = start + bytesRead;
      // stream will call ._read again later (or immediately) to pump us for more data

      // Make sure if we do not get a ._read call again later, we clean ourselves up
      assert.ok(!ts.check_idle_timeout);
      if (ts.watcher) {
        ts.check_idle_timeout = setTimeout(checkIdle.bind(null, ts), 1000);
      }

      // Must be very last, might recursively call into us!
      ts.push(buff);
    });
  });

}

function getFd(ts) {
  assert.ok(!ts.fd);
  assert.ok(!ts.get_fd_in_progress);
  ts.get_fd_in_progress = true;
  fs.open(ts.filename, 'r', function (err, fd) {
    if (ts.closed) {
      return;
    }
    assert.ok(ts.get_fd_in_progress);
    ts.get_fd_in_progress = false;
    if (err) {
      // file doesn't exist (yet), try later
      if (ts.read_pending) {
        // and we're inside of a _read call already, start a watcher to be notified
        // when it exists
        setTimeout(function () {
          if (ts.closed) {
            return;
          }
          getFd(ts);
        }, 1000);
      }
    } else {
      ts.fd = fd;
      if (ts.read_pending) {
        doRead(ts);
      }
    }
  });
}

function TailStream(filename, options) {
  Readable.call(this, options);

  var ts = this;
  //options = options || {};
  ts.offset = 0;
  ts.closed = false;
  ts.filename = filename;
  ts.had_no_data = false;
  ts.read_in_progress = false;
  ts.needs_reread = false;
  ts.get_fd_in_progress = false;
  ts.check_idle_timeout = null;
  ts.watcher = null;

  ts.read_pending = 0;
  getFd(ts);
}
util.inherits(TailStream, Readable);

TailStream.prototype._read = function(size) {
  var ts = this;
  assert.ok(!ts.closed);
  assert.ok(!ts.read_pending);
  assert.ok(size);
  if (ts.check_idle_timeout) {
    clearTimeout(ts.check_idle_timeout);
    ts.check_idle_timeout = null;
  }
  debug('read_pending = ' + size);
  ts.read_pending = size;
  if (!ts.fd) {
    if (ts.get_fd_in_progress) {
      debug('waiting on fd');
      // Read will trigger read when getFd finishes
    } else {
      // last getFd must have failed, try again!
      getFd(ts);
    }
    return;
  }
  doRead(ts);
};

assert.ok(!TailStream.prototype.close); // if Readable has this added, we may need to change logic!
TailStream.prototype.close = function () {
  var ts = this;
  stopWatch(ts);
  ts.closed = true;
  ts.push(null);
};

function createReadStream(path, options) {
  return new TailStream(path, options);
}

exports.createReadStream = createReadStream;
