/* ============================================================
   XLSX-LITE — lecture / écriture Excel sans aucune librairie.
   Un fichier .xlsx / .xlsm est un ZIP contenant des fichiers XML.
   - lecture : on dézippe (DecompressionStream, natif navigateur),
     puis on lit les valeurs des cellules (valeurs calculées
     mémorisées par Excel, les formules ne sont pas réévaluées).
   - écriture : on produit un ZIP "stocké" (sans compression)
     avec le XML minimal attendu par Excel.
   ============================================================ */
const XlsxLite = (() => {
  // ---------- ZIP : lecture ----------
  async function inflateRaw(bytes) {
    const ds = new DecompressionStream('deflate-raw');
    const stream = new Blob([bytes]).stream().pipeThrough(ds);
    return new Uint8Array(await new Response(stream).arrayBuffer());
  }

  async function unzip(buffer) {
    const u8 = new Uint8Array(buffer);
    const dv = new DataView(u8.buffer, u8.byteOffset, u8.byteLength);
    // Recherche de la fin du répertoire central (signature 0x06054b50)
    let eocd = -1;
    for (let i = u8.length - 22; i >= Math.max(0, u8.length - 70000); i--) {
      if (dv.getUint32(i, true) === 0x06054b50) { eocd = i; break; }
    }
    if (eocd < 0) throw new Error("Ce fichier n'est pas un classeur Excel valide (.xlsx / .xlsm).");
    const count = dv.getUint16(eocd + 10, true);
    let p = dv.getUint32(eocd + 16, true);
    const files = {};
    const dec = new TextDecoder();
    for (let n = 0; n < count; n++) {
      if (dv.getUint32(p, true) !== 0x02014b50) break;
      const method = dv.getUint16(p + 10, true);
      const csize = dv.getUint32(p + 20, true);
      const nameLen = dv.getUint16(p + 28, true);
      const extraLen = dv.getUint16(p + 30, true);
      const commentLen = dv.getUint16(p + 32, true);
      const localOff = dv.getUint32(p + 42, true);
      const name = dec.decode(u8.subarray(p + 46, p + 46 + nameLen));
      files[name] = { method, csize, localOff };
      p += 46 + nameLen + extraLen + commentLen;
    }
    return {
      names: Object.keys(files),
      async text(name) {
        const f = files[name];
        if (!f) return null;
        const lnl = dv.getUint16(f.localOff + 26, true);
        const lel = dv.getUint16(f.localOff + 28, true);
        const start = f.localOff + 30 + lnl + lel;
        const raw = u8.subarray(start, start + f.csize);
        const data = f.method === 0 ? raw : await inflateRaw(raw);
        return dec.decode(data);
      },
    };
  }

  // ---------- XML utilitaires ----------
  function decodeXml(s) {
    return s.replace(/&(#x[0-9a-fA-F]+|#\d+|amp|lt|gt|quot|apos);/g, (m, e) => {
      if (e === 'amp') return '&'; if (e === 'lt') return '<'; if (e === 'gt') return '>';
      if (e === 'quot') return '"'; if (e === 'apos') return "'";
      if (e[1] === 'x') return String.fromCodePoint(parseInt(e.slice(2), 16));
      return String.fromCodePoint(parseInt(e.slice(1), 10));
    });
  }
  function attr(attrs, name) {
    const m = new RegExp('(?:^|\\s)' + name + '="([^"]*)"').exec(attrs);
    return m ? decodeXml(m[1]) : null;
  }
  function textOfRuns(xml) {
    // concatène les <t> en ignorant les annotations phonétiques <rPh>
    const clean = xml.replace(/<rPh\b[\s\S]*?<\/rPh>/g, '');
    let out = '';
    clean.replace(/<t\b[^>]*>([\s\S]*?)<\/t>/g, (_, t) => { out += decodeXml(t); return ''; });
    return out;
  }
  function colToIndex(letters) {
    let n = 0;
    for (const ch of letters) n = n * 26 + (ch.charCodeAt(0) - 64);
    return n - 1;
  }
  function indexToCol(i) {
    let s = ''; i++;
    while (i > 0) { const m = (i - 1) % 26; s = String.fromCharCode(65 + m) + s; i = Math.floor((i - 1) / 26); }
    return s;
  }

  // ---------- Lecture d'un classeur ----------
  async function read(buffer) {
    const zip = await unzip(buffer);
    const wbXml = await zip.text('xl/workbook.xml');
    if (!wbXml) throw new Error("Classeur Excel illisible : workbook.xml absent.");
    const relsXml = (await zip.text('xl/_rels/workbook.xml.rels')) || '';
    const rels = {};
    relsXml.replace(/<Relationship\b([^>]*)\/?>/g, (_, a) => { rels[attr(a, 'Id')] = attr(a, 'Target'); return ''; });
    const ssXml = await zip.text('xl/sharedStrings.xml');
    const shared = [];
    if (ssXml) ssXml.replace(/<si\b[^>]*>([\s\S]*?)<\/si>/g, (_, inner) => { shared.push(textOfRuns(inner)); return ''; });

    const sheets = {};
    const order = [];
    const re = /<sheet\b([^>]*)\/?>/g;
    let m;
    while ((m = re.exec(wbXml))) {
      const name = attr(m[1], 'name');
      const rid = attr(m[1], 'r:id');
      let target = rels[rid] || '';
      target = target.replace(/^\/?xl\//, '').replace(/^\//, '');
      order.push(name);
      sheets[name] = { path: 'xl/' + target, cells: null };
    }

    async function load(name) {
      const sh = sheets[name];
      if (sh.cells) return sh.cells;
      const xml = (await zip.text(sh.path)) || '';
      const cells = new Map();
      const cre = /<c\b([^>]*?)(?:\/>|>([\s\S]*?)<\/c>)/g;
      let c;
      while ((c = cre.exec(xml))) {
        const a = c[1], inner = c[2] || '';
        const ref = attr(a, 'r');
        if (!ref) continue;
        const t = attr(a, 't');
        let v = null;
        if (t === 'inlineStr') {
          v = textOfRuns(inner);
        } else {
          const vm = /<v>([\s\S]*?)<\/v>/.exec(inner);
          if (!vm) continue;
          const raw = decodeXml(vm[1]);
          if (t === 's') v = shared[+raw] ?? '';
          else if (t === 'str') v = raw;
          else if (t === 'b') v = raw === '1';
          else if (t === 'e') v = { error: raw };
          else v = raw === '' ? null : Number(raw);
        }
        const mm = /^([A-Z]+)(\d+)$/.exec(ref);
        cells.set((+mm[2] - 1) * 20000 + colToIndex(mm[1]), v);
      }
      sh.cells = cells;
      return cells;
    }

    return {
      sheetNames: order,
      /** Retourne un accès g(ligne, colonne) 0-indexé à la feuille, ou null. */
      async sheet(wanted) {
        const norm = (s) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').trim().toUpperCase();
        const name = order.find((n) => norm(n) === norm(wanted));
        if (!name) return null;
        const cells = await load(name);
        let maxR = 0, maxC = 0;
        for (const k of cells.keys()) { const r = Math.floor(k / 20000), cc = k % 20000; if (r > maxR) maxR = r; if (cc > maxC) maxC = cc; }
        return { name, maxRow: maxR, maxCol: maxC, g: (r, cc) => { const v = cells.get(r * 20000 + cc); return v === undefined ? null : v; } };
      },
    };
  }

  // ---------- ZIP : écriture (stockage sans compression) ----------
  const CRC_TABLE = (() => {
    const t = new Uint32Array(256);
    for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; }
    return t;
  })();
  function crc32(u8) { let c = 0xffffffff; for (let i = 0; i < u8.length; i++) c = CRC_TABLE[(c ^ u8[i]) & 0xff] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; }

  function zip(files) {
    const enc = new TextEncoder();
    const parts = [], central = [];
    let offset = 0;
    for (const [name, content] of files) {
      const nameB = enc.encode(name);
      const data = typeof content === 'string' ? enc.encode(content) : content;
      const crc = crc32(data);
      const lh = new DataView(new ArrayBuffer(30));
      lh.setUint32(0, 0x04034b50, true); lh.setUint16(4, 20, true); lh.setUint16(6, 0x0800, true);
      lh.setUint16(8, 0, true); lh.setUint32(14, crc, true); lh.setUint32(18, data.length, true); lh.setUint32(22, data.length, true);
      lh.setUint16(26, nameB.length, true);
      parts.push(new Uint8Array(lh.buffer), nameB, data);
      const ch = new DataView(new ArrayBuffer(46));
      ch.setUint32(0, 0x02014b50, true); ch.setUint16(4, 20, true); ch.setUint16(6, 20, true); ch.setUint16(8, 0x0800, true);
      ch.setUint32(16, crc, true); ch.setUint32(20, data.length, true); ch.setUint32(24, data.length, true);
      ch.setUint16(28, nameB.length, true); ch.setUint32(42, offset, true);
      central.push(new Uint8Array(ch.buffer), nameB);
      offset += 30 + nameB.length + data.length;
    }
    const cSize = central.reduce((s, a) => s + a.length, 0);
    const end = new DataView(new ArrayBuffer(22));
    end.setUint32(0, 0x06054b50, true); end.setUint16(8, files.length, true); end.setUint16(10, files.length, true);
    end.setUint32(12, cSize, true); end.setUint32(16, offset, true);
    const all = [...parts, ...central, new Uint8Array(end.buffer)];
    const out = new Uint8Array(all.reduce((s, a) => s + a.length, 0));
    let p = 0; for (const a of all) { out.set(a, p); p += a.length; }
    return out;
  }

  // ---------- Écriture d'un classeur ----------
  // sheets: [{name, rows: [[cell]], cols: [largeurs]}]
  // cell: null | nombre | texte | {v, s:'pct'|'eur'|'jh'|'date'|'int', b:true(gras), h:true(en-tête), t:'title', f:'SUM(A1:A3)' (formule, avec sa valeur v)}
  const STYLE = { plain: 0, h: 1, title: 2, pct: 3, eur: 4, jh: 5, date: 6, bpct: 7, beur: 8, bjh: 9, section: 10, eurc: 11, beurc: 12, wrap: 13 };
  function esc(s) { return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, ''); }

  function write(sheets) {
    const sheetXml = sheets.map((sh) => {
      const rowsXml = sh.rows.map((row, r) => {
        if (!row) return '';
        const cells = row.map((cell, c) => {
          if (cell == null || cell === '') return '';
          const o = typeof cell === 'object' ? cell : { v: cell };
          if (o.v == null || o.v === '') {
            if (o.h || o.t) return `<c r="${indexToCol(c)}${r + 1}" s="${o.h ? STYLE.h : STYLE.title}"/>`;
            return '';
          }
          let s = STYLE.plain;
          if (o.t === 'title') s = STYLE.title;
          else if (o.t === 'section') s = STYLE.section;
          else if (o.h) s = STYLE.h;
          else if (o.s) s = STYLE[(o.b ? 'b' : '') + o.s] ?? STYLE[o.s] ?? 0;
          else if (o.b) s = STYLE.h;
          const ref = indexToCol(c) + (r + 1);
          // formule (o.f) : écrite avec sa valeur calculée, qu'Excel affiche à l'ouverture et que la relecture retrouve
          if (typeof o.v === 'number' && isFinite(o.v)) return `<c r="${ref}" s="${s}">${o.f ? `<f>${esc(o.f)}</f>` : ''}<v>${o.v}</v></c>`;
          // texte plus long que sa colonne : retour à la ligne si c'est une colonne de texte (largeur ≥ 30)
          // ou si la cellule voisine est remplie (le texte ne peut pas déborder dessus, il serait coupé)
          const w = sh.cols?.[c] || 10, nxt = row[c + 1], plein = nxt != null && nxt !== '' && !(typeof nxt === 'object' && (nxt.v == null || nxt.v === ''));
          if (s === STYLE.plain && ((String(o.v).length > w && (w >= 30 || plein)) || String(o.v).includes('\n'))) s = STYLE.wrap; // un texte saisi sur plusieurs lignes garde ses retours à la ligne
          return `<c r="${ref}" s="${s}" t="inlineStr"><is><t xml:space="preserve">${esc(o.v)}</t></is></c>`;
        }).join('');
        return `<row r="${r + 1}">${cells}</row>`;
      }).join('');
      const cols = (sh.cols || []).map((w, i) => `<col min="${i + 1}" max="${i + 1}" width="${w}" customWidth="1"/>`).join('');
      return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetPr><pageSetUpPr fitToPage="1"/></sheetPr><sheetViews><sheetView workbookViewId="0" showGridLines="0"/></sheetViews>${cols ? `<cols>${cols}</cols>` : ''}<sheetData>${rowsXml}</sheetData><pageMargins left="0.4" right="0.4" top="0.5" bottom="0.5" header="0.3" footer="0.3"/><pageSetup paperSize="9" orientation="landscape" fitToWidth="1" fitToHeight="0"/></worksheet>`;
    });
    const styles = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
<numFmts count="4"><numFmt numFmtId="164" formatCode="#,##0 &quot;€&quot;"/><numFmt numFmtId="167" formatCode="#,##0.00 &quot;€&quot;"/><numFmt numFmtId="165" formatCode="#,##0.00"/><numFmt numFmtId="166" formatCode="dd/mm/yyyy"/></numFmts>
<fonts count="4"><font><sz val="10"/><name val="Calibri"/></font><font><b/><sz val="10"/><color rgb="FFFFFFFF"/><name val="Calibri"/></font><font><b/><sz val="14"/><color rgb="FF1F3A5F"/><name val="Calibri"/></font><font><b/><sz val="10"/><name val="Calibri"/></font></fonts>
<fills count="4"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill><fill><patternFill patternType="solid"><fgColor rgb="FF1F3A5F"/></patternFill></fill><fill><patternFill patternType="solid"><fgColor rgb="FFE3E9F2"/></patternFill></fill></fills>
<borders count="2"><border/><border><bottom style="thin"><color rgb="FFC9D2DE"/></bottom></border></borders>
<cellStyleXfs count="1"><xf/></cellStyleXfs>
<cellXfs count="14">
<xf fontId="0" borderId="1" applyBorder="1"/>
<xf fontId="1" fillId="2" applyFont="1" applyFill="1"><alignment wrapText="1" vertical="center"/></xf>
<xf fontId="2" applyFont="1"/>
<xf numFmtId="10" fontId="0" borderId="1" applyNumberFormat="1" applyBorder="1"/>
<xf numFmtId="164" fontId="0" borderId="1" applyNumberFormat="1" applyBorder="1"/>
<xf numFmtId="165" fontId="0" borderId="1" applyNumberFormat="1" applyBorder="1"/>
<xf numFmtId="166" fontId="0" borderId="1" applyNumberFormat="1" applyBorder="1"/>
<xf numFmtId="10" fontId="3" borderId="1" applyNumberFormat="1" applyFont="1" applyBorder="1"/>
<xf numFmtId="164" fontId="3" borderId="1" applyNumberFormat="1" applyFont="1" applyBorder="1"/>
<xf numFmtId="165" fontId="3" borderId="1" applyNumberFormat="1" applyFont="1" applyBorder="1"/>
<xf fontId="3" fillId="3" applyFont="1" applyFill="1"/>
<xf numFmtId="167" fontId="0" borderId="1" applyNumberFormat="1" applyBorder="1"/>
<xf numFmtId="167" fontId="3" borderId="1" applyNumberFormat="1" applyFont="1" applyBorder="1"/>
<xf fontId="0" borderId="1" applyBorder="1" applyAlignment="1"><alignment wrapText="1" vertical="top"/></xf>
</cellXfs><cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles></styleSheet>`;
    const wb = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets>${sheets.map((s, i) => `<sheet name="${esc(s.name.slice(0, 31))}" sheetId="${i + 1}" r:id="rId${i + 1}"/>`).join('')}</sheets></workbook>`;
    const wbRels = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${sheets.map((s, i) => `<Relationship Id="rId${i + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet${i + 1}.xml"/>`).join('')}<Relationship Id="rId${sheets.length + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>`;
    const ct = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>${sheets.map((s, i) => `<Override PartName="/xl/worksheets/sheet${i + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`).join('')}</Types>`;
    const rootRels = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>`;
    const files = [
      ['[Content_Types].xml', ct], ['_rels/.rels', rootRels], ['xl/workbook.xml', wb],
      ['xl/_rels/workbook.xml.rels', wbRels], ['xl/styles.xml', styles],
      ...sheetXml.map((x, i) => [`xl/worksheets/sheet${i + 1}.xml`, x]),
    ];
    return zip(files);
  }

  return { read, write, indexToCol };
})();


