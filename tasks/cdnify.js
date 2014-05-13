'use strict';

var path = require('path');
var googlecdn = require('google-cdn');
var bowerConfig = require('bower').config;

module.exports = function (grunt) {

  grunt.registerMultiTask('cdnify', 'replace scripts with refs to the Google CDN', function () {
    // collect files
    var files = grunt.file.expand({ filter: 'isFile' }, this.data.html);
    var compJson = grunt.file.readJSON('bower.json');
    var options = this.options({
      cdn: 'google'
    });

    // Strip the leading path segment off, e.g. `app/bower_components` ->
    // `bower_components`
    var bowerDirBits = bowerConfig.directory.split(path.sep);
    bowerDirBits.shift();
    var componentsPath = bowerDirBits.join(path.sep);

    grunt.log
      .writeln('Going through ' + grunt.log.wordlist(files) + ' to update script refs');

    files = files.map(function (filepath) {
      return {
        path: filepath,
        body: grunt.file.read(filepath)
      };
    });

    grunt.util.async.forEach(files, function (file, cbInner) {
      var content = file.body;

      content = googlecdn(content, compJson, {
        componentsPath: componentsPath,
        cdn: options.cdn
      }, function (err, content) {
        if (err) {
          return cbInner(err);
        }

        var cdnScriptRe = /<script\s+src\s*=\s*['"](?:[a-zA-Z]+:)?\/\/[^<]+<\/script>\r?\n?/;

        var lines = content.split('\n'),
            moveLineIndexes = [];

        lines.forEach(function (line, i) {
          if (line.search(cdnScriptRe) !== -1) {
            moveLineIndexes.push(i);
          }
        });

        try {
          content = hoistLines({
            lines: lines,
            markerRegex: /<!--\s+build:js/,
            moveLineIndexes: moveLineIndexes
          });
          grunt.log.writeln('Hoisted CDN <script> tags in ' + file.path);
        } catch(e) {}

        grunt.file.write(file.path, content);
        cbInner();
      });
    }, this.async());
  });
};

function hoistLines(args) {
  var lines = args.lines,
      moveLineIndexes = args.moveLineIndexes,
      markerRegex = args.markerRegex;

  // pull all the lines out
  var hoistLines = [];
  while (moveLineIndexes.length > 0) {
    hoistLines.unshift(lines.splice(moveLineIndexes.pop(), 1)[0]);
  }

  // find the marker line
  var markerLineIndex;
  var i;
  for (i = 0; i < lines.length; i++) {
    if (lines[i].search(markerRegex) !== -1) {
      markerLineIndex = i;
      break;
    }
  }
  if (typeof markerLineIndex !== 'number') {
    throw new Error('Marker not found');
  }

  // put all the lines back in
  Array.prototype.splice.apply(lines, [markerLineIndex, 0].concat(hoistLines));

  return lines.join('\n');
};
