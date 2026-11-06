# fol

A tiny, archive format and toolkit by
[Fish Gang Co.](https://fish-gang.netlify.app/Company).

`.fol` is a JSON manifest, a `|` separator, then the raw concatenated file
bytes. No compression, no build step, no runtime dependencies.

## Format

```

[JSON manifest] | [concatenated file bytes]

```

Manifest entries are `{ p, s, o }`:

- `p` — path (string)
- `s` — size in bytes (integer)
- `o` — offset from the start of the data section (integer)

The parser tries each `|` in turn until a valid manifest is parsed, so a `|` inside a path or payload can't corrupt the archive.

## Layout

```

lib/fol.js               Library (UMD: Node + browser)
index.html               Reference browser editor
css/theme.css            Design tokens + shared header/button chrome
js/theme-toggle.js       Applies saved theme, exposes window.toggleTheme()
js/perf-tier.js          Sets data-perf-tier on <html> from device hints
server.js                Local server: static files + POST /api/archive-fol
demo.js                  CLI pack/unpack round-trip demo

```

## Library

```js
const { pack, unpack } = require('./lib/fol');

const archive = pack([
  { path: 'hello.txt', data: new TextEncoder().encode('hi') },
  { path: 'data.bin',  data: new Uint8Array([1, 2, 3]) }
]);

const entries = unpack(archive);
// [{ path: 'hello.txt', data: Uint8Array }, ...]
```

In the browser, lib/fol.js assigns window.fol:

```html
<script src="/lib/fol.js"></script>
<script>
  const archive = fol.pack([{ path: 'a.txt', data: new Uint8Array([1, 2, 3]) }]);
</script>
```

## HTTP API

POST /api/archive-fol — JSON body, Access-Control-Allow-Origin: *.

- Pack:

```json
{ "action": "pack",
  "files": [{ "path": "a.txt", "contentBase64": "..." }] }
```

→

```json
{ "fileBase64": "..." }
```

- Unpack:

```json
{ "action": "unpack", "fileBase64": "..." }
```

→

```json
{ "files": [{ "path": "a.txt", "contentBase64": "...", "size": 3 }] }
```

Max payload is 8 MB. The body shape is the contract — the server.js handler and downstream serverless adapters share it.

## Running

```bash
npm start      # http://localhost:3000 — editor + API
npm run demo   # pack/unpack round-trip demo in a temp dir
```

## Downstream forks

The hosted Archive-Editor and the deployed serverless handler at https://fish-gang.netlify.app/Archive-Editor are forks of index.html and server.js from this repo. Forks are welcome — the only contract is the .fol wire format and the `{ action, files, fileBase64 }` request shape.