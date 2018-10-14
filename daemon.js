#!/usr/bin/env node
const fs = require('fs')
const path = require('path')
const {spawn} = require('child_process')
const kill = require('tree-kill')
const minimisted = require('minimisted')

const cmdName = 'git-http-mock-server'
const target = require.resolve('./bin.js')
const args = [
  target
]

async function main({_: [cmd]}) {
  switch (cmd) {
    case 'start': {
      require('daemonize-process')()
      let server = spawn(
        'node', args,
        {
          stdio: 'inherit',
          windowsHide: true,
        }
      )
      fs.writeFileSync(
        path.join(process.cwd(), `${cmdName}.pid`),
        String(process.pid),
        'utf8'
      )
      process.on('exit', server.kill)
      return
    }
    case 'stop': {
      let pid
      try {
        pid = fs.readFileSync(
          path.join(process.cwd(), `${cmdName}.pid`),
          'utf8'
        );
      } catch (err) {
        console.log(`No ${cmdName}.pid file`)
        return
      }
      pid = parseInt(pid)
      console.log('killing', pid)
      kill(pid, (err) => {
        if (err) {
          console.log(err)
        } else {
          fs.unlinkSync(path.join(process.cwd(), `${cmdName}.pid`))
        }
      })
      return
    }
    default: {
      require(target)
    }
  }
}

minimisted(main)