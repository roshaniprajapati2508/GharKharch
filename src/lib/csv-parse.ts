// Small hand-rolled CSV parser for the "Import expenses from CSV" flow
// (spec section 3: a bounded, well-specified format - the exact headers
// exportExpensesCsv already produces). Deliberately not a library: the
// format is small and fixed, and this never evals/execs anything from the
// file, just splits text into rows of strings per RFC 4180 quoting rules
// (a quoted field, "" as an escaped quote inside one, and commas/newlines
// allowed inside quotes).

/** Parses CSV text into rows of raw string cells (no header handling - the caller does that). */
export function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let inQuotes = false;
  // Normalize CRLF to LF up front so \r never leaks into a field's content.
  const src = text.replace(/\r\n/g, "\n").replace(/\r/g, "\n");

  for (let i = 0; i < src.length; i++) {
    const char = src[i];

    if (inQuotes) {
      if (char === '"') {
        if (src[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        field += char;
      }
      continue;
    }

    if (char === '"') {
      inQuotes = true;
    } else if (char === ",") {
      row.push(field);
      field = "";
    } else if (char === "\n") {
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
    } else {
      field += char;
    }
  }

  // Flush the last field/row if the file didn't end with a newline.
  if (field.length > 0 || row.length > 0) {
    row.push(field);
    rows.push(row);
  }

  return rows.filter((r) => !(r.length === 1 && r[0].trim() === ""));
}
