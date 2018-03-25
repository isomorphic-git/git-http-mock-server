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
```

Then in your JS code, you can reference git repos on disk via `http://localhost:9876/path/to/repo.git`.

This is useful for testing `isomorphic-git` and applications built using it.

## Examples

See <https://github.com/isomorphic-git/isomorphic-git/tree/master/__tests__>

## Dependencies

- [git-http-backend](https://github.com/substack/git-http-backend): serve a git repository over http

## License

MIT
