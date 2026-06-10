// Minimal CSV parse/serialize. Quote-aware state machine — handles quoted
// fields, doubled quotes, embedded commas and newlines. No dependencies.

export function parseCsv(text) {
  // Excel exports often lead with a UTF-8 BOM; strip it so the first header
  // cell compares clean.
  if (text.charCodeAt(0) === 0xfeff) text = text.slice(1);
  const rows = [];
  let cur = [];
  let field = '';
  let inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (inQuotes) {
      if (ch === '"') {
        if (text[i + 1] === '"') { field += '"'; i++; continue; }
        inQuotes = false;
        continue;
      }
      field += ch;
      continue;
    }
    if (ch === '"') { inQuotes = true; continue; }
    if (ch === ',') { cur.push(field); field = ''; continue; }
    if (ch === '\r') continue;
    if (ch === '\n') { cur.push(field); rows.push(cur); cur = []; field = ''; continue; }
    field += ch;
  }
  if (field.length > 0 || cur.length > 0) { cur.push(field); rows.push(cur); }
  return rows;
}

export function serializeCsv(rows) {
  const cell = (value) => {
    const s = value == null ? '' : String(value);
    return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  return rows.map((row) => row.map(cell).join(',')).join('\n') + '\n';
}
