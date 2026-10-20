import { useEffect, useState } from "react";
import { useFetchers, useNavigation } from "react-router";

/** Quick visits finish before the bar shows, so they don't flash it. */
const DELAY = 250;

/**
 * Thin bar along the top of the page while a visit or form post is loading,
 * like Inertia's progress indicator. It creeps toward the end until the
 * request finishes, then fills and fades out.
 */
export function ProgressBar() {
  const navigation = useNavigation();
  const fetchers = useFetchers();
  const busy =
    navigation.state !== "idle" || fetchers.some((f) => f.state !== "idle");
  const [visible, setVisible] = useState(false);
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    if (!busy) return;
    let trickle: ReturnType<typeof setInterval> | undefined;
    const start = setTimeout(() => {
      setVisible(true);
      setProgress(0.1);
      // Each step covers a tenth of what's left, so it never quite gets there.
      trickle = setInterval(
        () => setProgress((p) => p + (0.95 - p) * 0.1),
        200,
      );
    }, DELAY);
    return () => {
      clearTimeout(start);
      clearInterval(trickle);
    };
  }, [busy]);

  useEffect(() => {
    if (busy || !visible) return;
    setProgress(1);
    const hide = setTimeout(() => {
      setVisible(false);
      setProgress(0);
    }, 400);
    return () => clearTimeout(hide);
  }, [busy, visible]);

  return (
    <div
      aria-hidden
      className={`pointer-events-none fixed inset-x-0 top-0 z-[100] h-[3px] transition-opacity duration-300 ${
        visible ? "opacity-100" : "opacity-0"
      }`}
    >
      <div
        className="h-full origin-left bg-gold-500 shadow-[0_0_8px_var(--color-gold-400)] transition-transform duration-200 ease-out motion-reduce:transition-none"
        style={{ transform: `scaleX(${progress})` }}
      />
    </div>
  );
}
