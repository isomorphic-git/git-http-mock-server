var spawn = require('child_process').spawn
var fs = require('fs')
var path = require('path')
var url = require('url')

var auth = require('basic-auth')
var chalk = require('chalk')
var fixturez = require('fixturez')
var backend = require('git-http-backend')
var htpasswd = require('htpasswd-js')

function factory (config) {
  if (!config.root) throw new Error('Missing required "gitHttpServer.root" config option')
  if (!config.route) throw new Error('Missing required "gitHttpServer.route" config option')
  if (!config.route.startsWith('/')) throw new Error('"gitHttpServer.route" must start with a "/"')
  // TODO: Make this configurable in karma.conf.js
  var f = fixturez(config.root, {root: process.cwd(), glob: config.glob})

  function getGitDir (req) {
    var u = url.parse(req.url)
    if (u.pathname.startsWith(config.route)) {
      if (req.method === 'GET' && u.pathname.endsWith('/info/refs')) {
        let gitdir = u.pathname.replace(config.route, '').replace(/\/info\/refs$/, '').replace(/^\//, '')
        let fixtureName = path.posix.basename(gitdir)
        return f.find(fixtureName)
      }
      if (req.method === 'POST' && req.headers['content-type'] === 'application/x-git-upload-pack-request') {
        let gitdir = u.pathname.replace(config.route, '').replace(/\/git-upload-pack$/, '').replace(/^\//, '')
        let fixtureName = path.posix.basename(gitdir)
        return f.find(fixtureName)
      }
      if (req.method === 'POST' && req.headers['content-type'] === 'application/x-git-receive-pack-request') {
        let gitdir = u.pathname.replace(config.route, '').replace(/\/git-receive-pack$/, '').replace(/^\//, '')
        let fixtureName = path.posix.basename(gitdir)
        return f.copy(fixtureName)
      }
    }
    return null
  }

  return async function middleware (req, res, next) {
    if (!next) next = () => void(0)
    try {
      var gitdir = getGitDir(req)
    } catch (err) {
      res.statusCode = 404
      res.end(err.message + '\n')
      console.log(chalk.red('[git-http-server] 404 ' + req.url))
      return
    }
    if (gitdir == null) return next()

    // Check for a .htaccess file
    let data = null
    try {
      data = fs.readFileSync(path.join(gitdir, '.htpasswd'), 'utf8')
    } catch (err) {
      // no .htaccess file, proceed without authentication
    }
    if (data) {
      // The previous line would have failed if there wasn't an .htaccess file, so
      // we must treat this as protected.
      let cred = auth.parse(req.headers['authorization'])
      if (cred === undefined) {
        res.statusCode = 401
        res.setHeader('WWW-Authenticate', 'Basic')
        res.end('Unauthorized' + '\n')
        console.log(chalk.red('[git-http-server] 401 ' + req.url))
        return
      }
      let valid = await htpasswd.authenticate({
        username: cred.name,
        password: cred.pass,
        data
      })
      if (!valid) {
        res.statusCode = 401
        res.setHeader('WWW-Authenticate', 'Basic')
        res.end('Bad credentials' + '\n')
        console.log(chalk.red('[git-http-server] 401 ' + req.url))
        return
      }
    }

    req.pipe(backend(req.url, function (err, service) {
      if (err) {
        res.statusCode = 500
        res.end(err + '\n')
        console.log(chalk.red('[git-http-server] 500 ' + req.url))
        return
      }

      res.setHeader('content-type', service.type)
      console.log(chalk.green('[git-http-server] 200 ' + req.url))
      // console.log('[git-http-server] ' + service.cmd + ' ' + service.args.concat(gitdir).join(' '))
      var ps = spawn(service.cmd, service.args.concat(gitdir))
      ps.stdout.pipe(service.createStream()).pipe(ps.stdin)
    })).pipe(res)
  }
}

factory.$inject = ['config.gitHttpServer']

module.exports = factory
