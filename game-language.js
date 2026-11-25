'use strict';

// Both the game and the layout preview use the same UTF-8 catalog as Godot.
const GameLanguage = (() => {
  const byKey = new Map();
  const bySource = new Map();

  function load(csv) {
    const rows = [];
    let row = [], field = '', quoted = false;
    const input = csv.replace(/^\uFEFF/, '').replace(/\r\n?/g, '\n');
    for (let i = 0; i < input.length; i++) {
      const ch = input[i];
      if (ch === '"') {
        if (quoted && input[i + 1] === '"') { field += '"'; i++; }
        else quoted = !quoted;
      } else if (!quoted && (ch === ',' || ch === '\n')) {
        row.push(field);
        field = '';
        if (ch === '\n') { rows.push(row); row = []; }
      } else field += ch;
    }
    if (field || row.length) rows.push([...row, field]);
    const columns = rows.shift();
    for (const cells of rows) {
      if (!cells[0]) continue;
      const entry = Object.fromEntries(columns.map((name, i) => [name, cells[i]]));
      byKey.set(cells[0], entry);
      // An explicit key can disambiguate identical Korean labels in different contexts.
      if (!bySource.has(entry.ko)) bySource.set(entry.ko, entry);
    }
  }

  function format(template, values) {
    let i = 0;
    return template.replace(/%s/g, match => i < values.length ? String(values[i++]) : match);
  }
  function text(locale, key, ...values) {
    const row = byKey.get(key);
    return format(row?.[locale] || row?.en || '', values);
  }
  function localize(locale, source, ...values) {
    const row = bySource.get(source) || byKey.get(source);
    return format(row?.[locale] || String(source), values);
  }
  const ready = fetch('godot/phase4/title_art/menu.csv').then(response => {
    if (!response.ok) throw new Error('Translation CSV: ' + response.status);
    return response.text();
  }).then(load);
  return { ready, text, localize };
})();
