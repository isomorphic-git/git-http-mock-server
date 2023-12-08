var spawn = require('child_process').spawn
var fs = require('fs')
var path = require('path')
var url = require('url')

var auth = require('basic-auth')
var chalk = require('chalk')
var fixturez = require('fixturez')
var htpasswd = require('htpasswd-js')

function pad (str) {
  return (str + '    ').slice(0, 7)
}


function matchInfo (req) {
  var u = url.parse(req.url)
  if (req.method === 'GET' && u.pathname.endsWith('/info/refs')) {
    return true
  } else {
    return false
  }
}

function matchService (req) {
  var u = url.parse(req.url, true)
  if (req.method === 'GET' && u.pathname.endsWith('/info/refs')) {
    return u.query.service
  }
  if (req.method === 'POST' && req.headers['content-type'] === 'application/x-git-upload-pack-request') {
    return 'git-upload-pack'
  }
  if (req.method === 'POST' && req.headers['content-type'] === 'application/x-git-receive-pack-request') {
    return 'git-receive-pack'
  }
}

function factory (config) {
  if (!config.root) throw new Error('Missing required "gitHttpServer.root" config option')
  if (!config.route) throw new Error('Missing required "gitHttpServer.route" config option')
  if (!config.route.startsWith('/')) throw new Error('"gitHttpServer.route" must start with a "/"')
  // TODO: Make this configurable in karma.conf.js
  var f = fixturez(config.root, {root: process.cwd(), glob: config.glob})

  function getGitDir (req) {
    var u = url.parse(req.url)
    if (u.pathname.startsWith(config.route)) {
      const info = matchInfo(req)
      if (info) {
        let gitdir = u.pathname.replace(config.route, '').replace(/\/info\/refs$/, '').replace(/^\//, '')
        let fixtureName = path.posix.basename(gitdir)
        return f.find(fixtureName)
      }
      const service = matchService(req)
      if (service === 'git-upload-pack') {
        let gitdir = u.pathname.replace(config.route, '').replace(/\/git-upload-pack$/, '').replace(/^\//, '')
        let fixtureName = path.posix.basename(gitdir)
        return f.find(fixtureName)
      }
      if (service === 'git-receive-pack') {
        let gitdir = u.pathname.replace(config.route, '').replace(/\/git-receive-pack$/, '').replace(/^\//, '')
        let fixtureName = path.posix.basename(gitdir)
        return config.persistChanges ? f.find(fixtureName) :f.copy(fixtureName)
      }
    }
    return null
  }

  return async function middleware (req, res, next) {
    try {
      // handle pre-flight OPTIONS
      if (req.method === 'OPTIONS') {
        res.statusCode = 204
        res.end('')
        console.log(chalk.green('[git-http-server] 204 ' + pad(req.method) + ' ' + req.url))
        return
      }
      if (!next) next = () => void(0)
      try {
        var gitdir = getGitDir(req)
      } catch (err) {
        res.statusCode = 404
        res.end(err.message + '\n')
        console.log(chalk.red('[git-http-server] 404 ' + pad(req.method) + ' ' + req.url))
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
          // The default reason phrase used in Node is "Unauthorized", but
          // we will use "Authorization Required" to match what Github uses.
          res.statusMessage = 'Authorization Required'
          res.setHeader('WWW-Authenticate', 'Basic')
          res.end('Unauthorized' + '\n')
          console.log(chalk.green('[git-http-server] 401 ' + pad(req.method) + ' ' + req.url))
          return
        }
        let valid = await htpasswd.authenticate({
          username: cred.name,
          password: cred.pass,
          data
        })
        if (!valid) {
          res.statusCode = 401
          // The default reason phrase used in Node is "Unauthorized", but
          // we will use "Authorization Required" to match what Github uses.
          res.statusMessage = 'Authorization Required'
          res.setHeader('WWW-Authenticate', 'Basic')
          res.end('Bad credentials' + '\n')
          console.log(chalk.green('[git-http-server] 401 ' + pad(req.method) + ' ' + req.url))
          return
        }
      }

      const info = matchInfo(req)
      const service = matchService(req)
      const env = req.headers['git-protocol'] ? { GIT_PROTOCOL: req.headers['git-protocol'] } : {}

      const args = ['--stateless-rpc' ];
      if (info) args.push('--advertise-refs')
      args.push(gitdir)

      if (info) {
        res.setHeader('content-type', `application/x-${service}-advertisement`)
        function pack (s) {
            var n = (4 + s.length).toString(16);
            return Array(4 - n.length + 1).join('0') + n + s;
        }
        res.write(pack('# service=' + service + '\n') + '0000');
      } else {
        res.setHeader('content-type', `application/x-${service}-result`)
      }

      const ps = spawn(service, args, { env })
      req.pipe(ps.stdin)
      ps.stdout.pipe(res)
      console.log(chalk.green('[git-http-server] 200 ' + pad(req.method) + ' ' + req.url))
    } catch (err) {
      res.statusCode = 500
      res.end(err + '\n')
      console.log(chalk.red('[git-http-server] 500 ' + pad(req.method) + ' ' + req.url))
    }
  }
}

factory.$inject = ['config.gitHttpServer']

module.exports = factory
