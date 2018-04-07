# karma-git-http-server-middleware 

A karma middleware for '[git-http-backend](https://github.com/substack/git-http-backend)',
originally inspired by '[git-http-server](https://github.com/bahamas10/node-git-http-server)'

## How to use

```sh
npm install --save-dev karma-git-http-server-middleware
```

In your `karma.config.js`, add:

```
    beforeMiddleware: ['git-http-server'],
    gitHttpServer: {
      root: '__tests__/__fixtures__',
      route: 'git-server'
    },
```

Then in your JS code, you can reference git repos on disk via `http://localhost:9876/git-server/name-of-repo.git`.

This is useful for testing `isomorphic-git` and applications built using it.

## Examples

See <https://github.com/isomorphic-git/isomorphic-git/tree/master/__tests__>

## Dependencies

- [fixturez](https://github.com/thejameskyle/fixturez): Easily create and maintain test fixtures in the file system
- [git-http-backend](https://github.com/substack/git-http-backend): serve a git repository over http

## License

MIT

## Changelog

1.0.0 - Initial release

2.0.0 - Copy repo on push (so repo stays untouched)
