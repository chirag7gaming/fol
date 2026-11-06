'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');
const { pack, unpack } = require('./lib/fol');

function walk(dir, base = dir) {
  const out = [];
  for (const name of fs.readdirSync(dir)) {
    const full = path.join(dir, name);
    if (fs.statSync(full).isDirectory()) out.push(...walk(full, base));
    else out.push({
      path: path.relative(base, full).split(path.sep).join('/'),
      data: new Uint8Array(fs.readFileSync(full))
    });
  }
  return out;
}

function main() {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'fol-demo-'));
  const src = path.join(tmp, 'src');
  fs.mkdirSync(src, { recursive: true });

  fs.writeFileSync(path.join(src, 'hello.txt'), 'hello from .fol\n');
  fs.writeFileSync(path.join(src, 'config.json'), JSON.stringify({ ok: true }, null, 2));
  fs.writeFileSync(path.join(src, 'data.bin'), Buffer.from([0, 1, 2, 3, 0x7c, 0xff]));

  const entries = walk(src);
  console.log('packing ' + entries.length + ' entries');

  const archive = pack(entries);
  console.log('archive size: ' + archive.byteLength + ' bytes');

  const archivePath = path.join(tmp, 'demo.fol');
  fs.writeFileSync(archivePath, archive);

  const back = unpack(new Uint8Array(fs.readFileSync(archivePath)));
  console.log('unpacked ' + back.length + ' entries:');
  for (const entry of back) {
    console.log('  ' + entry.path + ' (' + entry.data.byteLength + ' B)');
  }

  const outDir = path.join(tmp, 'out');
  for (const entry of back) {
    const target = path.join(outDir, entry.path);
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.writeFileSync(target, Buffer.from(entry.data));
  }
  console.log('extracted to ' + outDir);
}

main();