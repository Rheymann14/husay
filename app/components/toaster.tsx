import { useEffect } from "react";
import { Toaster as Sonner, toast } from "sonner";

export type ToastMessage = {
  type: "success" | "error" | "info" | "warning";
  message: string;
  /** Lets a toast that is shown twice (e.g. on hydration) appear only once. */
  id?: string;
};

export function showToast({ type, message, id }: ToastMessage) {
  toast[type](message, { id });
}

/** Top-right toasts with rich colors and a close (×) button on the right. */
export function Toaster() {
  return (
    <Sonner
      position="top-right"
      richColors
      closeButton
      duration={5000}
      style={
        {
          "--toast-close-button-start": "unset",
          "--toast-close-button-end": "0",
          "--toast-close-button-transform": "translate(35%, -35%)",
        } as React.CSSProperties
      }
    />
  );
}

/** Result shape returned by actions that report back to the user. */
export type ActionResult =
  | { ok: true; message?: string }
  | { ok: false; error: string };

const shown = new WeakSet<object>();

/** Shows a success or error toast each time an action returns a new result. */
export function useResultToast(result: ActionResult | null | undefined) {
  useEffect(() => {
    if (!result || shown.has(result)) return;
    shown.add(result);
    if (!result.ok) showToast({ type: "error", message: result.error });
    else if (result.message) showToast({ type: "success", message: result.message });
  }, [result]);
}
