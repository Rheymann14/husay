import { Placeholder } from "@tiptap/extensions";
import {
  type Editor,
  EditorContent,
  useEditor,
  useEditorState,
} from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import {
  Bold,
  Italic,
  Link,
  List,
  ListIndentDecrease,
  ListIndentIncrease,
  ListOrdered,
  Maximize2,
  Minimize2,
  Redo2,
  Underline,
  Undo2,
  Unlink,
  X,
  type LucideIcon,
} from "lucide-react";
import { useEffect, useState } from "react";

import { Dialog } from "~/components/dialog";
import { toHtml } from "~/lib/rich-text";

type Props = {
  /** Form field name; the HTML is submitted through a hidden input. */
  name: string;
  defaultValue?: string;
  label: string;
  placeholder?: string;
};

/**
 * WYSIWYG editor for briefer text: bold, italic, underline, lists and links.
 * Drag the bottom-right corner to resize it, or expand it to full screen.
 */
export function RichTextEditor({ name, defaultValue = "", label, placeholder }: Props) {
  const [html, setHtml] = useState(() => toHtml(defaultValue));

  const editor = useEditor({
    // The editor only exists in the browser; the server renders an empty box.
    immediatelyRender: false,
    extensions: [
      StarterKit.configure({
        heading: false,
        blockquote: false,
        code: false,
        codeBlock: false,
        horizontalRule: false,
        strike: false,
        link: {
          openOnClick: false,
          autolink: true,
          defaultProtocol: "https",
          protocols: ["http", "https", "mailto"],
        },
      }),
      Placeholder.configure({ placeholder: placeholder ?? "" }),
    ],
    content: html,
    editorProps: {
      attributes: {
        class: "rich-text px-3 py-2 text-sm text-slate-900 focus:outline-none",
        "aria-label": label,
        "aria-multiline": "true",
        role: "textbox",
      },
    },
    onUpdate: ({ editor }) => setHtml(editor.isEmpty ? "" : editor.getHTML()),
  });

  const [expanded, setExpanded] = useState(false);

  // While full screen: Esc closes it and the page behind does not scroll.
  useEffect(() => {
    if (!expanded) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      // Esc in the link dialog closes only the dialog.
      if (document.querySelector("dialog[open]")) return;
      e.stopPropagation();
      setExpanded(false);
    };
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    document.addEventListener("keydown", onKeyDown, true);
    return () => {
      document.body.style.overflow = overflow;
      document.removeEventListener("keydown", onKeyDown, true);
    };
  }, [expanded]);

  const toggleExpanded = () => {
    setExpanded((v) => !v);
    editor?.commands.focus();
  };

  return (
    <>
      {expanded && (
        <div
          className="fixed inset-0 z-40 bg-slate-900/50"
          onClick={() => setExpanded(false)}
          aria-hidden
        />
      )}
      <div
        role={expanded ? "dialog" : undefined}
        aria-modal={expanded || undefined}
        aria-label={expanded ? label : undefined}
        className={`overflow-hidden rounded-md border border-slate-300 bg-white focus-within:border-navy-600 focus-within:ring-2 focus-within:ring-navy-100 ${
          expanded
            ? "fixed inset-3 z-50 mx-auto flex max-w-6xl flex-col shadow-2xl sm:inset-8"
            : "mt-1"
        }`}
      >
        {expanded && (
          <div className="flex items-center gap-3 border-b border-slate-200 px-3 py-2">
            <p className="min-w-0 flex-1 truncate text-sm font-semibold text-navy-900">
              {label}
            </p>
            <button
              type="button"
              onClick={() => setExpanded(false)}
              className="rounded-md p-1.5 text-slate-500 hover:bg-slate-100 hover:text-slate-900"
              aria-label="Exit full screen"
              data-tooltip="Exit full screen"
            >
              <X className="size-4" aria-hidden />
            </button>
          </div>
        )}
        <Toolbar editor={editor} expanded={expanded} onToggleExpanded={toggleExpanded} />
        {/* Grid rows stretch the editable area to fill the box, so clicking
            anywhere inside it places the cursor. */}
        <div
          className={
            expanded
              ? "grid min-h-0 flex-1 overflow-y-auto"
              : "grid min-h-28 resize-y overflow-y-auto"
          }
        >
          <EditorContent editor={editor} className={`grid ${expanded ? "[&_.rich-text]:px-5 [&_.rich-text]:py-4" : ""}`} />
        </div>
        <input type="hidden" name={name} value={html} />
      </div>
    </>
  );
}

function Toolbar({
  editor,
  expanded,
  onToggleExpanded,
}: {
  editor: Editor | null;
  expanded: boolean;
  onToggleExpanded: () => void;
}) {
  const state = useEditorState({
    editor,
    selector: ({ editor }) =>
      editor && {
        bold: editor.isActive("bold"),
        italic: editor.isActive("italic"),
        underline: editor.isActive("underline"),
        bulletList: editor.isActive("bulletList"),
        orderedList: editor.isActive("orderedList"),
        link: editor.isActive("link"),
        canSink: editor.can().sinkListItem("listItem"),
        canLift: editor.can().liftListItem("listItem"),
        canUndo: editor.can().undo(),
        canRedo: editor.can().redo(),
      },
  });

  const chain = () => editor!.chain().focus();

  const [linkOpen, setLinkOpen] = useState(false);
  const [linkHref, setLinkHref] = useState("");

  const openLinkDialog = () => {
    if (!editor) return;
    setLinkHref((editor.getAttributes("link").href as string | undefined) ?? "");
    setLinkOpen(true);
  };

  const closeLinkDialog = () => {
    setLinkOpen(false);
    editor?.commands.focus();
  };

  const applyLink = () => {
    if (!editor) return;
    setLinkOpen(false);
    const href = linkHref.trim();
    if (!href || href === "https://") {
      chain().extendMarkRange("link").unsetLink().run();
      return;
    }
    const withProtocol = /^(https?:|mailto:)/i.test(href) ? href : `https://${href}`;
    // With no text selected, the address itself becomes the link text.
    if (editor.state.selection.empty && !editor.isActive("link")) {
      chain()
        .insertContent({
          type: "text",
          text: href,
          marks: [{ type: "link", attrs: { href: withProtocol } }],
        })
        .run();
      return;
    }
    chain().extendMarkRange("link").setLink({ href: withProtocol }).run();
  };

  return (
    <div
      role="toolbar"
      aria-label="Formatting"
      className="flex flex-wrap items-center gap-0.5 border-b border-slate-200 bg-slate-50 px-1.5 py-1"
    >
      <ToolButton icon={Bold} label="Bold (Ctrl+B)" active={state?.bold} onClick={() => chain().toggleBold().run()} disabled={!editor} />
      <ToolButton icon={Italic} label="Italic (Ctrl+I)" active={state?.italic} onClick={() => chain().toggleItalic().run()} disabled={!editor} />
      <ToolButton icon={Underline} label="Underline (Ctrl+U)" active={state?.underline} onClick={() => chain().toggleUnderline().run()} disabled={!editor} />
      <Divider />
      <ToolButton icon={List} label="Bulleted list" active={state?.bulletList} onClick={() => chain().toggleBulletList().run()} disabled={!editor} />
      <ToolButton icon={ListOrdered} label="Numbered list" active={state?.orderedList} onClick={() => chain().toggleOrderedList().run()} disabled={!editor} />
      <ToolButton icon={ListIndentIncrease} label="Indent / sub-bullet (Tab)" onClick={() => chain().sinkListItem("listItem").run()} disabled={!state?.canSink} />
      <ToolButton icon={ListIndentDecrease} label="Outdent (Shift+Tab)" onClick={() => chain().liftListItem("listItem").run()} disabled={!state?.canLift} />
      <Divider />
      <ToolButton icon={Link} label="Add or edit link" active={state?.link} onClick={openLinkDialog} disabled={!editor} />
      <ToolButton icon={Unlink} label="Remove link" onClick={() => chain().extendMarkRange("link").unsetLink().run()} disabled={!state?.link} />
      <Divider />
      <ToolButton icon={Undo2} label="Undo (Ctrl+Z)" onClick={() => chain().undo().run()} disabled={!state?.canUndo} />
      <ToolButton icon={Redo2} label="Redo (Ctrl+Shift+Z)" onClick={() => chain().redo().run()} disabled={!state?.canRedo} />
      <span className="ml-auto" />
      <ToolButton
        icon={expanded ? Minimize2 : Maximize2}
        label={expanded ? "Exit full screen (Esc)" : "Expand to full screen"}
        onClick={onToggleExpanded}
      />
      {/* Not a <form>: the editor already sits inside the program form. */}
      <Dialog
        open={linkOpen}
        onClose={closeLinkDialog}
        title={state?.link ? "Edit link" : "Add link"}
        description="Leave the address empty to remove the link."
      >
        <label className="block">
          <span className="label">Link address</span>
          <input
            type="text"
            inputMode="url"
            value={linkHref}
            onChange={(e) => setLinkHref(e.target.value)}
            onKeyDown={(e) => {
              if (e.key !== "Enter") return;
              e.preventDefault();
              applyLink();
            }}
            placeholder="https://…"
            data-autofocus
            className="input mt-1"
          />
        </label>
        <div className="flex justify-end gap-2 pt-1">
          <button type="button" onClick={closeLinkDialog} className="btn-secondary">
            Cancel
          </button>
          <button type="button" onClick={applyLink} className="btn-primary">
            <Link className="size-4" aria-hidden />
            Save link
          </button>
        </div>
      </Dialog>
    </div>
  );
}

function ToolButton({
  icon: Icon,
  label,
  active,
  disabled = false,
  onClick,
}: {
  icon: LucideIcon;
  label: string;
  active?: boolean;
  disabled?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      data-tooltip={label}
      aria-label={label}
      aria-pressed={active}
      disabled={disabled}
      onMouseDown={(e) => e.preventDefault()}
      onClick={onClick}
      className={`rounded p-1.5 transition-colors disabled:opacity-35 ${
        active
          ? "bg-navy-100 text-navy-800"
          : "text-slate-600 enabled:hover:bg-slate-200 enabled:hover:text-slate-900"
      }`}
    >
      <Icon className="size-4" aria-hidden />
    </button>
  );
}

function Divider() {
  return <span className="mx-1 h-5 w-px bg-slate-300" aria-hidden />;
}
