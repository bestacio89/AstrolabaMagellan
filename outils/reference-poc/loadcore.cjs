// Charge le moteur du POC (xlsx-lite + core) dans Node, avec une date du jour figée.
const fs = require('fs'), vm = require('vm');
const FIXED = process.env.TODAY || '2026-10-06';
const RealDate = Date;
class FixedDate extends RealDate {
  constructor(...a) { if (a.length === 0) super(FIXED + 'T10:00:00'); else super(...a); }
  static now() { return new RealDate(FIXED + 'T10:00:00').getTime(); }
}
const ctx = { console, Date: FixedDate, Intl, TextDecoder, TextEncoder, DecompressionStream, Blob, Response, Uint8Array, DataView, Map, Set, Math, JSON, Number, String, Object, Array, parseFloat, isFinite, RegExp, Error, Promise };
vm.createContext(ctx);
const dir = __dirname + '/poc/';
vm.runInContext(fs.readFileSync(dir + 'xlsx-lite.js', 'utf8') + '\n;globalThis.XlsxLite = XlsxLite;', ctx);
vm.runInContext(fs.readFileSync(dir + 'core.js', 'utf8') + '\n;globalThis.Core = Core;', ctx);
module.exports = { Core: ctx.Core, XlsxLite: ctx.XlsxLite };
