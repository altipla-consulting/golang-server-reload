
# golang-server-reload

> **DEPRECATED:** We recommend using https://github.com/skelterjohn/rerun instead

Reloads a Go server when the code changes. Compatible with Gulp tasks and LiveReload.


### Install

Use npm:

```shell
npm install --save-dev golang-server-reload
```


### Usage

You can use this library inside a Gulp task. For example:

```js
var gulp = require('gulp'),
    Server = require('golang-server-reload');

gulp.task('serve', function() {
  // First argument is the package to build.
  // Second argument is the folder where the Go sources are located
  //   (it can be relative to the current gulpfile)
  // Third argument is the server binary to run.
  var server = new Server('github.com/example/mypackage', '/gopath/src/github.com/example/mypackage', '/gopath/bin/mypackage');

  // Optional: File to touch when the serve is ready to reload the page
  // using LiveReload or something similar.
  server.setTouchFile('/tmp/touch');

  // Optional: Additional custom env variables.
  server.setEnvFunction(function() {
    return {
      DATABASE_FOO: 'foo',
      BAR: 'baz',
    };
  });

  // 12345 is the port where the app is going to listen when it's started.
  // 8080 is the proxy port of the server that recompiles it (the one you have
  // to access in your browser).
  server.serve(12345, 8080);
});
```


### Contributing

You can make pull requests or create issues in GitHub.


### License

[MIT License](LICENSE)
