var spawn = require('child_process').spawn;
var path = require('path').posix;
var url = require('url');
var backend = require('git-http-backend');

function getGitDir (req) {
  var u = url.parse(req.url)
  if (req.method === 'GET' && u.pathname.endsWith('/info/refs')) {
    return u.pathname.replace(/\/info\/refs$/, '').replace(/^\//, '')
  }
  if (req.method === 'POST' && req.headers['content-type'] === 'application/x-git-upload-pack-request') {
    return u.pathname.replace(/\/git-upload-pack$/, '').replace(/^\//, '')
  }
  if (req.method === 'POST' && req.headers['content-type'] === 'application/x-git-receive-pack-request') {
    return u.pathname.replace(/\/git-receive-pack$/, '').replace(/^\//, '')
  }
  return null
}

module.exports = function factory() {
  return function middleware (req, res, next) {
    var gitdir = getGitDir(req);
    if (gitdir == null) return next();

    req.pipe(backend(req.url, function (err, service) {
      if (err) {
        res.statusCode = 500;
        res.end(err + '\n');
        return;
      }

      res.setHeader('content-type', service.type);
      console.log('[git-http-server] ' + service.cmd + ' ' + service.args.concat(gitdir).join(' '))
      var ps = spawn(service.cmd, service.args.concat(gitdir));
      ps.stdout.pipe(service.createStream()).pipe(ps.stdin);
    })).pipe(res);
  }
}
