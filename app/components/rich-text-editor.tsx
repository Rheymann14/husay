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
  Redo2,
  Underline,
  Undo2,
  Unlink,
  type LucideIcon,
} from "lucide-react";
import { useState } from "react";

import { toHtml } from "~/lib/rich-text";

type Props = {
  /** Form field name; the HTML is submitted through a hidden input. */
  name: string;
  defaultValue?: string;
  label: string;
  placeholder?: string;
};

/** WYSIWYG editor for briefer text: bold, italic, underline, lists and links. */
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
        class: "rich-text min-h-28 px-3 py-2 text-sm text-slate-900 focus:outline-none",
        "aria-label": label,
        "aria-multiline": "true",
        role: "textbox",
      },
    },
    onUpdate: ({ editor }) => setHtml(editor.isEmpty ? "" : editor.getHTML()),
  });

  return (
    <div className="mt-1 overflow-hidden rounded-md border border-slate-300 bg-white focus-within:border-navy-600 focus-within:ring-2 focus-within:ring-navy-100">
      <Toolbar editor={editor} />
      <EditorContent editor={editor} />
      <input type="hidden" name={name} value={html} />
    </div>
  );
}

function Toolbar({ editor }: { editor: Editor | null }) {
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

  const setLink = () => {
    if (!editor) return;
    const current = editor.getAttributes("link").href as string | undefined;
    const input = window.prompt("Link address (https://…)", current ?? "https://");
    if (input == null) return;
    const href = input.trim();
    if (!href || href === "https://") {
      chain().extendMarkRange("link").unsetLink().run();
      return;
    }
    const withProtocol = /^(https?:|mailto:)/i.test(href) ? href : `https://${href}`;
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
      <ToolButton icon={Link} label="Add or edit link" active={state?.link} onClick={setLink} disabled={!editor} />
      <ToolButton icon={Unlink} label="Remove link" onClick={() => chain().extendMarkRange("link").unsetLink().run()} disabled={!state?.link} />
      <Divider />
      <ToolButton icon={Undo2} label="Undo (Ctrl+Z)" onClick={() => chain().undo().run()} disabled={!state?.canUndo} />
      <ToolButton icon={Redo2} label="Redo (Ctrl+Shift+Z)" onClick={() => chain().redo().run()} disabled={!state?.canRedo} />
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
      title={label}
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
