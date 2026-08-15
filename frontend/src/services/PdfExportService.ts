export type PdfHistoryRow = {
  title: string;
  details?: Array<string | null | undefined>;
};

export type PdfHistorySection = {
  title: string;
  rows: PdfHistoryRow[];
  summary?: Array<string | null | undefined>;
};

export type PdfHistoryDocument = {
  filename: string;
  title: string;
  subtitle?: string;
  identity?: Array<string | null | undefined>;
  sections: PdfHistorySection[];
};

type PdfLine = {
  text: string;
  size: number;
  bold?: boolean;
  gapAfter?: number;
};

const PAGE_WIDTH = 595;
const PAGE_HEIGHT = 842;
const LEFT = 48;
const TOP = 794;
const BOTTOM = 48;
const BODY_SIZE = 9.5;
const BODY_LEADING = 13;
const MAX_CHARS = 94;

function ascii(value: unknown) {
  return String(value ?? "")
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[–—]/g, "-")
    .replace(/[•·]/g, "-")
    .replace(/[➜←→↗]/g, "->")
    .replace(/[^\x20-\x7E]/g, "?")
    .replace(/\s+/g, " ")
    .trim();
}

function wrap(text: string, width = MAX_CHARS) {
  const clean = ascii(text);
  if (!clean) return [""];
  const words = clean.split(" ");
  const lines: string[] = [];
  let current = "";
  for (const word of words) {
    if (!current) {
      current = word;
      continue;
    }
    if (`${current} ${word}`.length <= width) {
      current += ` ${word}`;
    } else {
      lines.push(current);
      current = word;
    }
  }
  if (current) lines.push(current);
  return lines;
}

function escapePdfText(value: string) {
  return value.replace(/\\/g, "\\\\").replace(/\(/g, "\\(").replace(/\)/g, "\\)");
}

function buildLines(document: PdfHistoryDocument): PdfLine[] {
  const lines: PdfLine[] = [
    { text: "DEVARENA", size: 11, bold: true, gapAfter: 8 },
    { text: document.title, size: 20, bold: true, gapAfter: 7 },
  ];

  if (document.subtitle) {
    for (const line of wrap(document.subtitle, 78)) lines.push({ text: line, size: 10, gapAfter: 1 });
    lines.push({ text: "", size: BODY_SIZE, gapAfter: 6 });
  }

  for (const entry of document.identity ?? []) {
    if (entry) lines.push({ text: ascii(entry), size: BODY_SIZE, gapAfter: 1 });
  }
  lines.push({ text: `Exported: ${new Date().toLocaleString("en-IN")}`, size: BODY_SIZE, gapAfter: 8 });

  for (const section of document.sections) {
    lines.push({ text: section.title.toUpperCase(), size: 13, bold: true, gapAfter: 4 });
    for (const summary of section.summary ?? []) {
      if (!summary) continue;
      for (const line of wrap(summary)) lines.push({ text: line, size: BODY_SIZE, gapAfter: 1 });
    }

    if (section.rows.length === 0) {
      lines.push({ text: "No records available", size: BODY_SIZE, gapAfter: 8 });
      continue;
    }

    section.rows.forEach((row, index) => {
      for (const line of wrap(`${index + 1}. ${row.title}`, 88)) {
        lines.push({ text: line, size: 10.5, bold: true, gapAfter: 1 });
      }
      for (const detail of row.details ?? []) {
        if (!detail) continue;
        for (const line of wrap(`   ${detail}`, 90)) lines.push({ text: line, size: BODY_SIZE, gapAfter: 1 });
      }
      lines.push({ text: "", size: BODY_SIZE, gapAfter: 4 });
    });
  }

  return lines;
}

function paginate(lines: PdfLine[]) {
  const pages: PdfLine[][] = [];
  let page: PdfLine[] = [];
  let y = TOP;

  for (const line of lines) {
    const leading = Math.max(BODY_LEADING, line.size + 3) + (line.gapAfter ?? 0);
    if (y - leading < BOTTOM && page.length) {
      pages.push(page);
      page = [];
      y = TOP;
    }
    page.push(line);
    y -= leading;
  }
  if (page.length) pages.push(page);
  return pages;
}

function buildPdf(document: PdfHistoryDocument) {
  const pages = paginate(buildLines(document));
  const objects: string[] = [];
  const pageObjectIds: number[] = [];
  const contentObjectIds: number[] = [];

  // 1 catalog, 2 pages, 3 regular font, 4 bold font.
  let nextId = 5;
  for (let index = 0; index < pages.length; index += 1) {
    pageObjectIds.push(nextId++);
    contentObjectIds.push(nextId++);
  }

  objects[1] = "<< /Type /Catalog /Pages 2 0 R >>";
  objects[2] = `<< /Type /Pages /Kids [${pageObjectIds.map((id) => `${id} 0 R`).join(" ")}] /Count ${pages.length} >>`;
  objects[3] = "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>";
  objects[4] = "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >>";

  pages.forEach((page, pageIndex) => {
    let y = TOP;
    const commands: string[] = [];
    for (const line of page) {
      const font = line.bold ? "F2" : "F1";
      commands.push(`BT /${font} ${line.size.toFixed(1)} Tf ${LEFT} ${y.toFixed(1)} Td (${escapePdfText(ascii(line.text))}) Tj ET`);
      y -= Math.max(BODY_LEADING, line.size + 3) + (line.gapAfter ?? 0);
    }
    commands.push(`BT /F1 8 Tf ${PAGE_WIDTH - 86} 26 Td (Page ${pageIndex + 1} of ${pages.length}) Tj ET`);
    const stream = commands.join("\n");
    const pageId = pageObjectIds[pageIndex];
    const contentId = contentObjectIds[pageIndex];
    objects[pageId] = `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${PAGE_WIDTH} ${PAGE_HEIGHT}] /Resources << /Font << /F1 3 0 R /F2 4 0 R >> >> /Contents ${contentId} 0 R >>`;
    objects[contentId] = `<< /Length ${stream.length} >>\nstream\n${stream}\nendstream`;
  });

  let pdf = "%PDF-1.4\n%DevArena\n";
  const offsets: number[] = [0];
  for (let id = 1; id < objects.length; id += 1) {
    offsets[id] = pdf.length;
    pdf += `${id} 0 obj\n${objects[id]}\nendobj\n`;
  }
  const xref = pdf.length;
  pdf += `xref\n0 ${objects.length}\n0000000000 65535 f \n`;
  for (let id = 1; id < objects.length; id += 1) {
    pdf += `${String(offsets[id]).padStart(10, "0")} 00000 n \n`;
  }
  pdf += `trailer\n<< /Size ${objects.length} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`;
  return new Blob([pdf], { type: "application/pdf" });
}

export async function downloadHistoryPdf(document: PdfHistoryDocument) {
  await new Promise<void>((resolve) => window.setTimeout(resolve, 80));
  const blob = buildPdf(document);
  const url = URL.createObjectURL(blob);
  const anchor = window.document.createElement("a");
  anchor.href = url;
  anchor.download = document.filename;
  window.document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}
