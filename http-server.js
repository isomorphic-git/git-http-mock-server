#!/usr/bin/env node
// Standalone server for use without karma!
var fs = require('fs')
var http = require('http')
var path = require('path')
var stack = require('stack')
var static = require('serve-static')

var cors = require('./cors')
var logger = require('./logger')
var mock = require('./mock-response')
var factory = require('./middleware')

var config = {
  root: path.resolve(process.cwd(), process.env.GIT_HTTP_MOCK_SERVER_ROOT || '.'),
  glob: '*',
  route: process.env.GIT_HTTP_MOCK_SERVER_ROUTE || '/'
}

var server = http.createServer(
  cors(
    stack(
      logger.log(),
      logger.handler('x-mock-response'),
      mock(),
      logger.handler('git-http-server'),
      factory(config),
      logger.handler('serve-static'),
      static(config.root)
    )
  )
)
server.listen(process.env.GIT_HTTP_MOCK_SERVER_PORT || 8174)
