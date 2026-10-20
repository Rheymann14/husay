// Turns a briefer document (see briefer-document.ts) into an A4 PDF in the
// browser and downloads it. The PDF libraries load only when this runs.

const PAGE_W_MM = 210;
const PAGE_H_MM = 297;
const MARGIN_MM = 15;
const FOOTER_MM = 8;
const CONTENT_W_MM = PAGE_W_MM - 2 * MARGIN_MM;
const CONTENT_H_MM = PAGE_H_MM - 2 * MARGIN_MM - FOOTER_MM;
const SCALE = 2;

/** Where a page may end: below a row, paragraph or list item, so text isn't cut. */
const BREAK_AFTER = "header, h1, .meta, tr, p, li, h2, footer";
const ROW_END_PX = 24;
const JPEG_QUALITY = 0.9;

function pageSlices(breaks: number[], total: number, pageHeight: number) {
  const slices: [number, number][] = [];
  let top = 0;
  while (top < total - 1) {
    let bottom = Math.min(top + pageHeight, total);
    if (bottom < total) {
      // Take the lowest break that fits; a block taller than a page is cut.
      const fits = breaks.filter((b) => b > top + 1 && b <= bottom);
      if (fits.length) bottom = Math.max(...fits);
    }
    slices.push([top, bottom]);
    top = bottom;
  }
  return slices;
}

export async function downloadBrieferPdf(html: string, fileName: string, title: string) {
  const [{ default: html2canvas }, { jsPDF }] = await Promise.all([
    import("html2canvas-pro"),
    import("jspdf"),
  ]);

  // Lay the briefer out off screen at a fixed width, apart from the preview.
  const frame = document.createElement("iframe");
  frame.setAttribute("aria-hidden", "true");
  frame.tabIndex = -1;
  Object.assign(frame.style, {
    position: "fixed",
    top: "0",
    left: "-10000px",
    width: "900px",
    height: "1200px",
    border: "0",
  });
  const loaded = new Promise((resolve) => frame.addEventListener("load", resolve, { once: true }));
  frame.srcdoc = html;
  document.body.appendChild(frame);

  try {
    await loaded;
    const doc = frame.contentDocument!;
    doc.documentElement.classList.add("pdf");
    await doc.fonts.ready;
    // Tall enough to hold the whole briefer, so nothing is clipped.
    frame.style.height = `${doc.documentElement.scrollHeight}px`;

    const page = doc.querySelector<HTMLElement>(".page")!;
    const pageTop = page.getBoundingClientRect().top;
    const total = page.offsetHeight;
    const pxPerMm = page.offsetWidth / CONTENT_W_MM;
    const breaks = [...page.querySelectorAll(BREAK_AFTER)].flatMap((el) => {
      const bottom = el.getBoundingClientRect().bottom;
      // Not after the last line of a cell: the row's padding and border would
      // spill onto the next page. Break before the row instead.
      const row = el.tagName === "TR" ? null : el.closest("tr");
      if (row && row.getBoundingClientRect().bottom - bottom < ROW_END_PX) return [];
      return [bottom - pageTop];
    });

    const canvas = await html2canvas(page, { scale: SCALE, backgroundColor: "#ffffff" });
    const slices = pageSlices(breaks, total, CONTENT_H_MM * pxPerMm);

    const pdf = new jsPDF({ unit: "mm", format: "a4" });
    pdf.setProperties({ title });
    slices.forEach(([top, bottom], i) => {
      if (i > 0) pdf.addPage();
      const sy = Math.round(top * SCALE);
      const sh = Math.min(Math.round(bottom * SCALE), canvas.height) - sy;
      const slice = document.createElement("canvas");
      slice.width = canvas.width;
      slice.height = sh;
      slice.getContext("2d")!.drawImage(canvas, 0, sy, canvas.width, sh, 0, 0, canvas.width, sh);
      pdf.addImage(
        slice.toDataURL("image/jpeg", JPEG_QUALITY),
        "JPEG",
        MARGIN_MM,
        MARGIN_MM,
        CONTENT_W_MM,
        sh / SCALE / pxPerMm,
      );

      pdf.setFontSize(8);
      pdf.setTextColor(100, 116, 139);
      const y = PAGE_H_MM - MARGIN_MM + 2;
      pdf.text(pdf.splitTextToSize(title, CONTENT_W_MM - 30)[0], MARGIN_MM, y);
      pdf.text(`Page ${i + 1} of ${slices.length}`, PAGE_W_MM - MARGIN_MM, y, { align: "right" });
    });
    saveFile(pdf.output("blob"), fileName);
  } finally {
    frame.remove();
  }
}

// In place of pdf.save(), which can fall back to opening a new tab. The link
// goes in the open modal dialog, as the page behind it is inert.
function saveFile(blob: Blob, fileName: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName;
  link.hidden = true;
  (document.querySelector("dialog[open]") ?? document.body).appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
}
