#!/usr/bin/env node
const cmdName = 'git-ssh-mock-server'
const target = require.resolve('./ssh-server.js')
require('./daemon.js')(cmdName, target)
