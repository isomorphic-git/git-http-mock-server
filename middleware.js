var spawn = require('child_process').spawn;
var path = require('path').posix;
var url = require('url');
var backend = require('git-http-backend');
var fixturez = require('fixturez');

function factory (config) {
  if (!config.root) throw new Error('Missing required "gitHttpServer.root" config option')
  if (!config.route) throw new Error('Missing required "gitHttpServer.route" config option')
  if (!config.route.startsWith('/')) throw new Error('"gitHttpServer.route" must start with a "/"')
  // TODO: Make this configurable in karma.conf.js
  var f = fixturez(config.root, {root: process.cwd()})

  function getGitDir (req) {
    var u = url.parse(req.url)
    if (u.pathname.startsWith(config.route)) {
      if (req.method === 'GET' && u.pathname.endsWith('/info/refs')) {
        let gitdir = u.pathname.replace(config.route, '').replace(/\/info\/refs$/, '').replace(/^\//, '')
        let fixtureName = path.basename(gitdir)
        return f.find(fixtureName)
      }
      if (req.method === 'POST' && req.headers['content-type'] === 'application/x-git-upload-pack-request') {
        let gitdir = u.pathname.replace(config.route, '').replace(/\/git-upload-pack$/, '').replace(/^\//, '')
        let fixtureName = path.basename(gitdir)
        return f.find(fixtureName)
      }
      if (req.method === 'POST' && req.headers['content-type'] === 'application/x-git-receive-pack-request') {
        let gitdir = u.pathname.replace(config.route, '').replace(/\/git-receive-pack$/, '').replace(/^\//, '')
        let fixtureName = path.basename(gitdir)
        return f.copy(fixtureName)
      }
    }
    return null
  }

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

factory.$inject = ['config.gitHttpServer']

module.exports = factory