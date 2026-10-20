import { Download, LoaderCircle, Printer } from "lucide-react";
import { useMemo, useRef, useState } from "react";

import { Dialog } from "~/components/dialog";
import { showToast } from "~/components/toaster";
import {
  type BrieferProgram,
  brieferDocument,
  brieferFileName,
} from "~/lib/briefer-document";

/**
 * Preview of the printable briefer, with Print and Download PDF. Printing
 * uses the preview frame itself, so nothing opens in a new tab.
 */
export function BrieferPrintDialog({
  program,
  open,
  onClose,
}: {
  program: BrieferProgram;
  open: boolean;
  onClose: () => void;
}) {
  const frameRef = useRef<HTMLIFrameElement>(null);
  const [loadedHtml, setLoadedHtml] = useState<string | null>(null);
  const [downloading, setDownloading] = useState(false);

  // Built only while open: it needs the page origin, and the frame then loads the logos.
  const html = useMemo(
    () => (open ? brieferDocument(program, window.location.origin) : ""),
    [open, program],
  );
  const ready = open && loadedHtml === html;

  // Forget the loaded frame, so reopening waits for the new one to load.
  const close = () => {
    setLoadedHtml(null);
    onClose();
  };

  const print = () => {
    const win = frameRef.current?.contentWindow;
    if (!win) return;
    win.focus();
    win.print();
  };

  const download = async () => {
    setDownloading(true);
    try {
      const { downloadBrieferPdf } = await import("~/lib/briefer-pdf");
      await downloadBrieferPdf(html, brieferFileName(program.trackingNo), program.title);
    } catch (error) {
      console.error(error);
      showToast({ type: "error", message: "Couldn't create the PDF. Please try again." });
    } finally {
      setDownloading(false);
    }
  };

  return (
    <Dialog
      open={open}
      onClose={close}
      size="xl"
      title="Print briefer"
      description="Check the preview, then print it or save it as a PDF."
    >
      <div className="relative h-[min(65dvh,48rem)] overflow-hidden rounded-md border border-slate-200 bg-slate-200">
        {open && (
          <iframe
            ref={frameRef}
            srcDoc={html}
            title={`Printable briefer for ${program.title}`}
            onLoad={() => setLoadedHtml(html)}
            className="size-full"
          />
        )}
        {!ready && (
          <div className="absolute inset-0 flex items-center justify-center bg-slate-100 text-sm text-slate-500">
            <LoaderCircle className="mr-2 size-4 animate-spin" aria-hidden />
            Preparing preview…
          </div>
        )}
      </div>
      <div className="flex flex-wrap justify-end gap-2 pt-1">
        <button type="button" onClick={close} className="btn-secondary">
          Close
        </button>
        <button
          type="button"
          onClick={download}
          disabled={!ready || downloading}
          className="btn-secondary"
        >
          {downloading ? (
            <LoaderCircle className="size-4 animate-spin" aria-hidden />
          ) : (
            <Download className="size-4" aria-hidden />
          )}
          {downloading ? "Creating PDF…" : "Download PDF"}
        </button>
        <button
          type="button"
          onClick={print}
          disabled={!ready}
          className="btn-primary"
        >
          <Printer className="size-4" aria-hidden />
          Print
        </button>
      </div>
    </Dialog>
  );
}
