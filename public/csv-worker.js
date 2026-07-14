self.onmessage = (event) => {
  const { text, id } = event.data;
  try {
    const first = text.split(/\r?\n/, 1)[0] || "";
    const count = (line, char) => {
      let n = 0, quoted = false;
      for (let i = 0; i < line.length; i++) {
        if (line[i] === '"') quoted = !quoted;
        else if (line[i] === char && !quoted) n++;
      }
      return n;
    };
    const delimiter = count(first, ";") > count(first, ",") ? ";" : ",";
    const rows = [];
    let row = [], value = "", quoted = false;
    for (let i = 0; i < text.length; i++) {
      const ch = text[i];
      if (ch === '"') {
        if (quoted && text[i + 1] === '"') { value += '"'; i++; }
        else quoted = !quoted;
      } else if (ch === delimiter && !quoted) { row.push(value); value = ""; }
      else if ((ch === "\n" || ch === "\r") && !quoted) {
        if (ch === "\r" && text[i + 1] === "\n") i++;
        row.push(value); value = "";
        if (row.some((cell) => cell.trim())) rows.push(row);
        row = [];
      } else value += ch;
    }
    row.push(value);
    if (row.some((cell) => cell.trim())) rows.push(row);
    if (!rows.length) throw new Error("El archivo está vacío.");
    const headers = rows[0].map((h, i) => h.replace(/^\uFEFF/, "").trim() || `Columna ${i + 1}`);
    const data = rows.slice(1).map((cells) => Object.fromEntries(headers.map((h, i) => [h, (cells[i] || "").trim()])));
    self.postMessage({ id, headers, rows: data, delimiter });
  } catch (error) {
    self.postMessage({ id, error: error instanceof Error ? error.message : "No pudimos leer el CSV." });
  }
};
