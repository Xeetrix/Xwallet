/**
 * Minimal RFC 4180-ish CSV serializer — no dependency needed for the
 * handful of columns these exports use. Any value containing a comma,
 * quote, or newline is wrapped in quotes with internal quotes doubled;
 * everything else is left bare for readability when opened in a text
 * editor, matching how most real-world CSV writers behave.
 */
export function toCsv(headers: string[], rows: (string | number)[][]): string {
  const escapeCell = (cell: string | number): string => {
    const str = String(cell);
    if (/[",\n]/.test(str)) {
      return `"${str.replace(/"/g, '""')}"`;
    }
    return str;
  };

  const lines = [headers.map(escapeCell).join(",")];
  for (const row of rows) {
    lines.push(row.map(escapeCell).join(","));
  }
  return lines.join("\r\n");
}
