(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.fol = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  var DELIMITER = 0x7c;
  var ENCODER = new TextEncoder();
  var DECODER = new TextDecoder();

  function toUint8(value) {
    if (value instanceof Uint8Array) return value;
    if (value instanceof ArrayBuffer) return new Uint8Array(value);
    if (ArrayBuffer.isView(value)) {
      return new Uint8Array(value.buffer, value.byteOffset, value.byteLength);
    }
    throw new TypeError('Expected Uint8Array, ArrayBuffer, or ArrayBufferView');
  }

  function parse(data) {
    var idx = data.indexOf(DELIMITER);
    var attempts = 0;
    while (idx !== -1 && attempts++ < 64) {
      try {
        var manifest = JSON.parse(DECODER.decode(data.subarray(0, idx)));
        if (Array.isArray(manifest)) return { manifest: manifest, dataStart: idx + 1 };
      } catch (e) {}
      idx = data.indexOf(DELIMITER, idx + 1);
    }
    throw new Error('Not a valid .fol file');
  }

  function pack(entries) {
    var manifest = [];
    var chunks = [];
    var cursor = 0;
    for (var i = 0; i < entries.length; i++) {
      if (!entries[i] || typeof entries[i].path !== 'string') {
        throw new TypeError('entry.path must be a string');
      }
      var data = toUint8(entries[i].data);
      manifest.push({ p: entries[i].path, s: data.byteLength, o: cursor });
      chunks.push(data);
      cursor += data.byteLength;
    }
    var header = ENCODER.encode(JSON.stringify(manifest) + '|');
    var out = new Uint8Array(header.byteLength + cursor);
    out.set(header, 0);
    var offset = header.byteLength;
    for (var j = 0; j < chunks.length; j++) {
      out.set(chunks[j], offset);
      offset += chunks[j].byteLength;
    }
    return out;
  }

  function unpack(archive) {
    var data = toUint8(archive);
    var parsed = parse(data);
    return parsed.manifest.map(function (item) {
      if (!item ||
          typeof item.p !== 'string' ||
          !Number.isInteger(item.o) || !Number.isInteger(item.s) ||
          item.o < 0 || item.s < 0) {
        throw new Error('Invalid manifest entry');
      }
      var from = parsed.dataStart + item.o;
      var to = from + item.s;
      if (to > data.byteLength) {
        throw new Error('Manifest entry out of range: ' + item.p);
      }
      return { path: item.p, data: data.slice(from, to) };
    });
  }

  return { pack: pack, unpack: unpack };
});