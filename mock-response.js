module.exports = function () {
  return function (req, res, next) {
    for (let header in req.headers) {
      if (header.startsWith('x-mock-header-')) {
        res.setHeader(header.replace('x-mock-header-', ''), req.headers[header])
        next = null
      }
    }
    if (next) {
      return next()
    } else {
      res.statusCode = req.headers['x-mock-status-code']
      res.end(req.headers['x-mock-body'])
    }
  }
}