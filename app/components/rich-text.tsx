// Renders plain text with light formatting:
//   - blank lines separate paragraphs
//   - lines starting with "- " (or "• ") become bullets
//   - indented bullet lines ("  - ") become sub-bullets

type Block =
  | { type: "p"; text: string }
  | { type: "ul"; items: { text: string; children: string[] }[] };

const BULLET = /^(\s*)[-•○*]\s+(.*)$/;

function parse(text: string): Block[] {
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

export function RichText({ text }: { text: string }) {
  const blocks = parse(text);
  if (blocks.length === 0) return <p className="text-slate-400">—</p>;
  return (
    <div className="space-y-3">
      {blocks.map((block, i) =>
        block.type === "p" ? (
          <p key={i}>{block.text}</p>
        ) : (
          <ul key={i} className="list-disc space-y-1.5 pl-5">
            {block.items.map((item, j) => (
              <li key={j}>
                {item.text}
                {item.children.length > 0 && (
                  <ul className="mt-1 list-[circle] space-y-1 pl-5">
                    {item.children.map((child, k) => (
                      <li key={k}>{child}</li>
                    ))}
                  </ul>
                )}
              </li>
            ))}
          </ul>
        ),
      )}
    </div>
  );
}
