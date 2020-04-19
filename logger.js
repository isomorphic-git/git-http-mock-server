var chalk = require('chalk')
var onFinished = require('on-finished')

function padHandler (str) {
  return (str + '                         ').slice(0, 18)
}

function padMethod (str) {
  return (str + '    ').slice(0, 7)
}

function log () {
  return function (req, res, next) {
    onFinished(res, function () {
      var color = (res.statusCode === 401 || res.statusCode < 400) ? chalk.green : chalk.red
      console.log(color(padHandler('[' + res.handler + '] ') + res.statusCode + ' ' + padMethod(req.method) + ' ' + req.url))
    })
    next()
  }
}

function handler (label) {
  return function (req, res, next) {
    res.handler = label
    next()
  }
}

module.exports = {
  log: log,
  handler: handler
}
