// Program text fields hold HTML from the rich text editor. Older rows hold
// plain text with light formatting, which is converted on the fly:
//   - blank lines separate paragraphs
//   - lines starting with "- " (or "• ") become bullets
//   - indented bullet lines ("  - ") become sub-bullets

type Block =
  | { type: "p"; text: string }
  | { type: "ul"; items: { text: string; children: string[] }[] };

const BULLET = /^(\s*)[-•○*]\s+(.*)$/;

function parseLegacy(text: string): Block[] {
  const blocks: Block[] = [];
  let paragraph: string[] = [];

  const flushParagraph = () => {
    if (paragraph.length) blocks.push({ type: "p", text: paragraph.join(" ") });
    paragraph = [];
  };

  for (const line of text.replace(/\r\n/g, "\n").split("\n")) {
    const bullet = line.match(BULLET);
    if (bullet) {
      flushParagraph();
      const nested = bullet[1].length > 0;
      let list = blocks[blocks.length - 1];
      if (!list || list.type !== "ul") {
        list = { type: "ul", items: [] };
        blocks.push(list);
      }
      const last = list.items[list.items.length - 1];
      if (nested && last) last.children.push(bullet[2]);
      else list.items.push({ text: bullet[2], children: [] });
    } else if (line.trim() === "") {
      flushParagraph();
    } else {
      // Continuation of the previous bullet, or part of a paragraph.
      const list = blocks[blocks.length - 1];
      if (paragraph.length === 0 && list?.type === "ul" && /^\s+/.test(line)) {
        const last = list.items[list.items.length - 1];
        if (last.children.length)
          last.children[last.children.length - 1] += ` ${line.trim()}`;
        else last.text += ` ${line.trim()}`;
      } else {
        paragraph.push(line.trim());
      }
    }
  }
  flushParagraph();
  return blocks;
}

function escapeHtml(text: string) {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function legacyToHtml(text: string) {
  return parseLegacy(text)
    .map((block) => {
      if (block.type === "p") return `<p>${escapeHtml(block.text)}</p>`;
      const items = block.items.map((item) => {
        const children = item.children.length
          ? `<ul>${item.children.map((c) => `<li><p>${escapeHtml(c)}</p></li>`).join("")}</ul>`
          : "";
        return `<li><p>${escapeHtml(item.text)}</p>${children}</li>`;
      });
      return `<ul>${items.join("")}</ul>`;
    })
    .join("");
}

export function isHtml(text: string) {
  return /^\s*</.test(text);
}

/** HTML for a stored field, converting legacy plain text when needed. */
export function toHtml(text: string) {
  return isHtml(text) ? text : legacyToHtml(text);
}

/** Visible text only, e.g. for a meta description. */
export function toPlainText(text: string) {
  if (!isHtml(text)) return text.replace(/\s+/g, " ").trim();
  return text
    .replace(/<\/(p|li|h\d)>/gi, " ")
    .replace(/<[^>]*>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&amp;/g, "&")
    .replace(/\s+/g, " ")
    .trim();
}
