#!/usr/bin/env node
const cmdName = 'git-http-mock-server'
const target = require.resolve('./http-server.js')
require('./daemon.js')(cmdName, target)
