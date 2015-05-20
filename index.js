'use strict';

var childProcess = require('child_process'),
    exec = childProcess.exec,
    spawn = childProcess.spawn,
    httpProxy = require('http-proxy'),
    http = require('http'),
    chalk = require('chalk'),
    watch = require('gulp-watch'),
    dateformat = require('dateformat');


// Log function from gulp-util
var log = function() {
  var time = '[' + chalk.grey(dateformat(new Date(), 'HH:MM:ss')) + ']';
  var args = Array.prototype.slice.call(arguments);
  args.unshift(time);
  console.log.apply(console, args);
};


var Server = function(packageName, sourcesPath) {
  this.packageName_ = packageName;
  this.sourcesPath_ = sourcesPath;

  var parts = packageName.split('.');
  this.serverName_ = parts[parts.length - 1];

  this.envFn_ = function() { };
  this.touchFile_ = null;

  this.filesChanged_ = false;
  this.building_ = true;
  this.buildError_ = null;
  this.runOnExit_ = null;
  this.runningProccess_;
};


Server.prototype.setTouchFile = function(touchFile) {
  this.touchFile_ = touchFile;
};


Server.prototype.setEnvFunction = function(envFn) {
  this.envFn_ = envFn;
};


Server.prototype.serve = function(realPort, listenPort) {
  var that = this;

  // Watch for changes in the source files
  var sources = [
    this.sourcesPath_ + '/**/*.go',
  ];
  watch(sources, function() {
    if (!that.building_) {
      that.building_ = true;
      that.build_();
      return;
    }

    that.filesChanged_ = true;
  });

  // Close child process if it's running while we exit
  process.on('exit', function() {
    if (that.runningProccess_) {
      that.runningProccess_.kill('SIGKILL');
    }
  });

  var proxy = httpProxy.createProxyServer();

  proxy.on('error', function(err) {
    log(chalk.red(err));
  });

  var server = http.createServer(function(req, res) {
    if (that.building_) {
      res.writeHead(500, {'Content-Type': 'text/plain'});
      res.end('still building...\n');
      return;
    }

    if (that.buildError_) {
      res.writeHead(500, {'Content-Type': 'text/plain'});
      res.end(that.buildError_ + '\n');
      return;
    }

    // All correct, proxy the request
    proxy.web(req, res, {target: 'http://localhost:' + realPort});
  });

  server.listen(listenPort);

  this.building_ = true;
  setTimeout(function() {
    that.build_();
  }, 3000);
};


Server.prototype.runProcess_ = function() {
  var that = this;

  if (this.runningProccess_) {
    // Try a soft kill of the process first
    this.runningProccess_.kill('SIGINT');
    this.runOnExit_ = function() {
      this.runOnExit_ = null;
      this.runProcess_();
    };

    // If the process does not exits in 3 seconds, kill it
    setTimeout(function() {
      if (that.runOnExit_) {
        that.runningProccess_.kill('SIGKILL');
        that.runOnExit_();
      }
    }, 3000);

    return;
  }

  if (this.filesChanged_) {
    setImmediate(function() {
      that.build_();
    });
    return;
  }

  log(chalk.green('Build successful. Spawn server...'));

  this.runningProccess_ = spawn(process.env.GOPATH + '/bin/' + this.serverName_, [], {
    env: this.envFn_(),
  });

  // Pipe the streams of the process to the console
  this.runningProccess_.stdout.pipe(process.stdout);
  this.runningProccess_.stderr.pipe(process.stderr);

  // When exited clean the process and call hooks if needed
  this.runningProccess_.once('exit', function() {
    that.runningProccess_ = null;
    if (that.runOnExit_) {
      that.runOnExit_();
    }
  });

  // Catch any spawning error
  this.runningProccess_.once('error', function(err) {
    throw err;
  });

  // Let the process some time to initialize itself
  setTimeout(function() {
    if (that.filesChanged_) {
      setImmediate(function() {
        that.build_();
      });
      return;
    }

    that.building_ = false;
    if (that.touchFile_) {
      exec('touch ' + that.touchFile_);
    }
  }, 1000);
};


Server.prototype.build_ = function() {
  var that = this;

  log(chalk.yellow('Compile go application...'));
  exec('go install ' + this.packageName_, function(err, stdout, stderr) {
    that.buildError_ = null;

    // If there's a compilation error debug it and save it for later requests
    if (err && (err.code === 1 || err.code === 2)) {
      that.building_ = false;

      log(chalk.red('Build failed'));
      console.log(stderr + '\n');

      that.buildError_ = stderr;

      if (that.filesChanged_) {
        that.filesChanged_ = false;
        setImmediate(function() {
          that.build_();
        });
        return;
      }

      if (that.touchFile_) {
        exec('touch ' + that.touchFile_);
      }

      return;
    }

    if (err) {
      log(chalk.red('Exit code: ' + err.code));
      throw err;
    }

    if (that.filesChanged_) {
      that.filesChanged_ = false;
      setImmediate(function() {
        that.build_();
      });
      return;
    }

    that.runProcess_();
  });
};


module.exports = Server;
