// Keeps only the markup the rich text editor produces, so a crafted form
// post cannot store scripts or event handlers that the public page renders.

const ALLOWED_TAGS = new Set([
  "p", "br", "strong", "b", "em", "i", "u", "s", "ul", "ol", "li", "a",
]);

// Removed together with everything inside them.
const DROPPED_TAGS = new Set([
  "script", "style", "iframe", "object", "embed", "template", "noscript",
  "textarea", "title", "svg", "math", "select", "head",
]);

const SAFE_URL = /^(https?:|mailto:)/i;

export async function sanitizeHtml(html: string): Promise<string> {
  if (!html.trim()) return "";

  const rewriter = new HTMLRewriter()
    .on("*", {
      element(el) {
        const tag = el.tagName.toLowerCase();
        if (DROPPED_TAGS.has(tag)) {
          el.remove();
          return;
        }
        if (!ALLOWED_TAGS.has(tag)) {
          el.removeAndKeepContent();
          return;
        }

        // HTMLRewriter yields [name, value] pairs; the DOM lib types disagree.
        const attrs = Array.from(
          el.attributes as unknown as Iterable<[string, string]>,
          ([name, value]) => ({ name, value }),
        );
        for (const { name } of attrs) el.removeAttribute(name);

        if (tag === "a") {
          const href = attrs.find((a) => a.name === "href")?.value.trim() ?? "";
          if (!SAFE_URL.test(href)) {
            el.removeAndKeepContent();
            return;
          }
          el.setAttribute("href", href);
          el.setAttribute("target", "_blank");
          el.setAttribute("rel", "noopener noreferrer");
        }
        if (tag === "ol") {
          const start = attrs.find((a) => a.name === "start")?.value;
          if (start && /^\d{1,4}$/.test(start) && start !== "1")
            el.setAttribute("start", start);
        }
      },
      comments(comment) {
        comment.remove();
      },
    });

  const clean = await rewriter
    .transform(new Response(html, { headers: { "content-type": "text/html" } }))
    .text();

  // An empty editor still submits "<p></p>".
  const visible = clean.replace(/<[^>]*>/g, "").replace(/&nbsp;|\s/g, "");
  return visible ? clean.trim() : "";
}
