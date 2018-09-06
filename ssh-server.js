#!/usr/bin/env node
const { spawn, spawnSync } = require('child_process')
var crypto = require('crypto')
var fs = require('fs')
var path = require('path')
var inspect = require('util').inspect

var buffersEqual = require('buffer-equal-constant-time')
var fixturez = require('fixturez')
var ssh2 = require('ssh2')

var config = {
  root: path.resolve(process.cwd(), process.env.GIT_SSH_MOCK_SERVER_ROOT || '.'),
  glob: '*',
  route: process.env.GIT_SSH_MOCK_SERVER_ROUTE || '/'
}

new Promise((resolve, reject) => {
  try {
    let key = fs.readFileSync(path.join(__dirname, 'id_rsa'))
    let pubKey = fs.readFileSync(path.join(__dirname, 'id_rsa.pub'))
    return resolve({key, pubKey})
  } catch (err) {
    let proc = spawnSync('ssh-keygen', ['-C', '"git-ssh-mock-server@localhost"', '-N', '""', '-f', 'id_rsa'], {
      cwd: __dirname,
      shell: true
    })
    console.log(proc.stdout.toString('utf8'))
    let key = fs.readFileSync(path.join(__dirname, 'id_rsa'))
    let pubKey = fs.readFileSync(path.join(__dirname, 'id_rsa.pub'))
    return resolve({key, pubKey})
  }
})
.then(keypair => {
  var pubKey = ssh2.utils.genPublicKey(ssh2.utils.parseKey(keypair.pubKey))
  var f = fixturez(config.root, {root: process.cwd(), glob: config.glob})

  new ssh2.Server({ hostKeys: [keypair.key] }, function (client) {
    console.log('client connected')

    client
      .on('authentication', function (ctx) {
        if (
          ctx.method === 'password' &&
          // Note: Don't do this in production code, see
          // https://www.brendanlong.com/timing-attacks-and-usernames.html
          // In node v6.0.0+, you can use `crypto.timingSafeEqual()` to safely
          // compare two values.
          ctx.username === 'foo' &&
          ctx.password === 'bar'
        ) { ctx.accept() } else if (
          ctx.method === 'publickey' &&
          ctx.key.algo === pubKey.fulltype &&
          buffersEqual(ctx.key.data, pubKey.public)
        ) {
          if (ctx.signature) {
            var verifier = crypto.createVerify(ctx.sigAlgo)
            verifier.update(ctx.blob)
            if (verifier.verify(pubKey.publicOrig, ctx.signature)) ctx.accept()
            else ctx.reject()
          } else {
            // if no signature present, that means the client is just checking
            // the validity of the given public key
            ctx.accept()
          }
        } else ctx.reject()
      })
      .on('ready', function () {
        console.log('client authenticated')

        client.on('session', function (accept, reject) {
          var session = accept()
          session.once('exec', function (accept, reject, info) {
            console.log(info.command)
            let [_, command, gitdir] = info.command.match(/^([a-z-]+) '(.*)'/)
            // Only allow these two commands to be executed
            if (command !== 'git-upload-pack' && command !== 'git-receive-pack') {
              return reject()
            }
            if (gitdir !== path.posix.normalize(gitdir)) {
              // something fishy about this filepath
              console.log('suspicious file path:', gitdir)
              return reject()
            }

            // Do copy-on-write trick for git push
            let fixtureName = path.posix.basename(gitdir)
            let fulldir
            if (command === 'git-upload-pack') {
              fulldir = f.find(fixtureName)
            } else if (command === 'git-receive-pack') {
              fulldir = f.copy(fixtureName)
            }

            try {
              fs.accessSync(fulldir)
            } catch (err) {
              console.log(fulldir + ' does not exist.')
              return reject()
            }

            var stream = accept()
            console.log('exec:', command, gitdir)
            console.log('actual:', command, fulldir)
            let proc = spawn(command, [fulldir])
            stream.exit(0) // always set a successful exit code
            stream.pipe(proc.stdin)
            proc.stdout.pipe(stream)
            proc.stderr.pipe(stream.stderr)
          })
        })
      })
      .on('end', function () {
        console.log('Client disconnected')
      })
    }
  ).listen(process.env.GIT_SSH_MOCK_SERVER_PORT || 2222, '127.0.0.1', function () {
    console.log('Listening on port ' + this.address().port)
  })

})