var path = require('path');
var fs = require('fs');
var factory = require('./middleware')

module.exports = {
  'middleware:git-http-server': ['factory', factory]
};