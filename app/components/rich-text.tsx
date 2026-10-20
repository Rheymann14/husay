import { toHtml } from "~/lib/rich-text";

// Stored HTML is sanitized when saved (see sanitize-html.server.ts), and
// legacy plain text is escaped while converting, so it is safe to inject.
export function RichText({ text }: { text: string }) {
  if (!text.trim()) return <p className="text-slate-400">—</p>;
  return (
    <div
      className="rich-text"
      dangerouslySetInnerHTML={{ __html: toHtml(text) }}
    />
  );
}
