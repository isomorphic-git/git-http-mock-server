#!/usr/bin/env node
const { spawn, spawnSync } = require('child_process')
var crypto = require('crypto')
var fs = require('fs')
var path = require('path')

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
    try {
      // Note: PEM is to workaround https://github.com/mscdex/ssh2/issues/746
      let proc = spawnSync('ssh-keygen', ['-m', 'PEM', '-C', '"git-ssh-mock-server@localhost"', '-N', '""', '-f', 'id_rsa'], {
        cwd: __dirname,
        shell: true
      })
      console.log(proc.stdout.toString('utf8'))
      let key = fs.readFileSync(path.join(__dirname, 'id_rsa'))
      let pubKey = fs.readFileSync(path.join(__dirname, 'id_rsa.pub'))
      return resolve({key, pubKey})
    } catch (err) {
      reject(err)
    }
  }
})
.then(keypair => {
  if (process.argv[2] === 'exportKeys') {
    fs.writeFileSync(path.join(process.cwd(), 'id_rsa'), keypair.key, { mode: 0o600, flag: 'wx' })
    fs.writeFileSync(path.join(process.cwd(), 'id_rsa.pub'), keypair.pubKey, { mode: 0o600, flag: 'wx' })
    process.exit()
  }
  var pubKey = ssh2.utils.genPublicKey(ssh2.utils.parseKey(keypair.pubKey))
  var f = fixturez(config.root, {root: process.cwd(), glob: config.glob})

  const PASSWORD_BUFFER = Buffer.from(process.env.GIT_SSH_MOCK_SERVER_PASSWORD || '')

  new ssh2.Server({ hostKeys: [keypair.key] }, function (client) {
    console.log('client connected')
    client
      .on('authentication', function (ctx) {
        if (
            ctx.method === 'none' &&
            !process.env.GIT_SSH_MOCK_SERVER_PASSWORD &&
            !process.env.GIT_SSH_MOCK_SERVER_PUBKEY
          ) {
          ctx.accept()
        } else if (
            ctx.method === 'password' &&
            process.env.GIT_SSH_MOCK_SERVER_PASSWORD &&
            // After much thought... screw usernames.
            buffersEqual(Buffer.from(ctx.password || ''), PASSWORD_BUFFER)
          ) {
          ctx.accept()
        } else if (
            ctx.method === 'publickey' &&
            ctx.key.algo === pubKey.fulltype &&
            process.env.GIT_SSH_MOCK_SERVER_PUBKEY &&
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
        } else {
          ctx.reject()
        }
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
              console.log('invalid command:', command)
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
        console.log('client disconnected')
      })
    }
  ).listen(process.env.GIT_SSH_MOCK_SERVER_PORT || 2222, '127.0.0.1', function () {
    console.log('Listening on port ' + this.address().port)
  })
})
