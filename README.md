# git-http-mock-server

Clone and push to git repository test fixtures over HTTP.

## What it does

It is similar to [`git-http-server`](https://npm.im/git-http-server) but designed for test cases only.
It uses copy-on-write so that pushing to the repo doesn't actually alter the repo.

Run in a directory full of bare git repositories, `git-http-mock-server` will serve those repos using the
native `git-http-backend` process built into `git` (which needs to be installed on the machine).

You can then:
- run tests that clone or push to those git repositories (regardless of whether Github is down :wink:).
- run those tests in parallel without them interfering with each other.

Git hooks such as `hooks/update` and `hooks/post-receive` are automatically supported.

It also supports HTTP Basic Auth password protection of repos so you can test how your code handles 401 errors.

Using `isomorphic-git` and testing things from browsers? Fear not, `git-http-mock-server` includes appropriate CORS headers.

## How to use

```sh
npm install --save-dev git-http-mock-server
```

Now `cd` to a directory in which you have some bare git repos and run this server:

```sh
> cd __fixtures__
> ls
test-repo1.git    test-repo2.git   imaginatively-named-repo.git
> git-http-mock-server
```

Now in another shell, clone and push away...
```sh
> git clone http://localhost:8174/test-repo1.git
> git clone http://localhost:8174/test-repo2.git
> git clone http://localhost:8174/imaginatively-named-repo.git
```

## Run in the background

If you want to reuse the same shell (as part of a shell script, for example)
you can run the server as a daemon in the background:

```sh
> git-http-mock-server start
> # do stuff
> git-http-mock-server stop
```

Just be sure to run `start` and `stop` from the same working directory.
(The `start` command writes the PID of the server to `./git-http-mock-server.pid` so that the `stop` command knows what process to kill.)

### Environment Variables

- `GIT_HTTP_MOCK_SERVER_PORT` default is 8174 (to be compatible with [git-http-server](https://github.com/bahamas10/node-git-http-server))
- `GIT_HTTP_MOCK_SERVER_ROUTE` default is `/`
- `GIT_HTTP_MOCK_SERVER_ROOT` default is `process.cwd()`
- `GIT_HTTP_MOCK_SERVER_ALLOW_ORIGIN` default is `*` (used for CORS)

### .htpasswd support

You can place an Apache-style `.htpasswd` file in a bare repo to protect it with Basic Authentication.

```sh
> cd __fixtures__/test-repo1.git
> htpasswd -cb .htpasswd testuser testpassword
Adding password for user testuser.
> cat .htpasswd
testuser:$apr1$BRdvH4Mu$3HrpeyBrWiS88GcSPidgq/
```

If you don't have `htpasswd` on your machine, you can use [htpasswd](https://npm.im/htpasswd) which is
a cross-platform Node implementation of `htpasswd`.

## Dependencies

- [basic-auth](https://ghub.io/basic-auth): node.js basic auth parser
- [chalk](https://ghub.io/chalk): Terminal string styling done right
- [fixturez](https://ghub.io/fixturez): Easily create and maintain test fixtures in the file system
- [git-http-backend](https://ghub.io/git-http-backend): serve a git repository over http
- [htpasswd-js](https://ghub.io/htpasswd-js): Pure JS htpasswd authentication

originally inspired by '[git-http-server](https://github.com/bahamas10/node-git-http-server)'

## License

MIT

## Changelog

1.0.0 - Initial release