/**
 * Modular toast API for OpenSlides.
 *
 * All UI feedback should go through `notify.*` so styling (size, glow,
 * action placement, close alignment) stays consistent.
 */
import { toast as sonnerToast, type ExternalToast } from "sonner";

export type ToastTone = "default" | "success" | "error" | "warning" | "info";

export interface NotifyOptions {
  /** Secondary line under the title */
  description?: string;
  /** How long to keep the toast (ms). Defaults depend on tone. */
  duration?: number;
  /**
   * Show accent border + glow. Defaults:
   * - success/error/warning/info → true
   * - default / message → false (neutral card)
   */
  glow?: boolean;
  /** Primary action button (e.g. Undo) — always rendered at the trailing edge */
  action?: {
    label: string;
    onClick: () => void;
  };
  /** Optional cancel / secondary action */
  cancel?: {
    label: string;
    onClick?: () => void;
  };
  id?: string | number;
}

const DEFAULT_DURATION: Record<ToastTone, number> = {
  default: 4000,
  success: 3200,
  error: 5200,
  warning: 4500,
  info: 4000,
};

function toneClass(tone: ToastTone, glow: boolean): string {
  if (!glow || tone === "default") return "toast-tone-default";
  return `toast-tone-${tone} toast-glow`;
}

function buildOptions(
  tone: ToastTone,
  opts: NotifyOptions = {},
): ExternalToast {
  const glow = opts.glow ?? tone !== "default";
  const className = [
    "toast-openslides",
    "toast-size-md",
    toneClass(tone, glow),
  ].join(" ");

  const options: ExternalToast = {
    id: opts.id,
    description: opts.description,
    duration: opts.duration ?? DEFAULT_DURATION[tone],
    className,
    // Force unstyled path + our classes even if Toaster defaults change
    unstyled: true,
  };

  if (opts.action) {
    options.action = {
      label: opts.action.label,
      onClick: opts.action.onClick,
    };
  }
  if (opts.cancel) {
    options.cancel = {
      label: opts.cancel.label,
      onClick: opts.cancel.onClick ?? (() => undefined),
    };
  }

  return options;
}

function show(tone: ToastTone, title: string, opts?: NotifyOptions) {
  const options = buildOptions(tone, opts);
  switch (tone) {
    case "success":
      return sonnerToast.success(title, options);
    case "error":
      return sonnerToast.error(title, options);
    case "warning":
      return sonnerToast.warning(title, options);
    case "info":
      return sonnerToast.info(title, options);
    default:
      return sonnerToast(title, options);
  }
}

/**
 * Primary notification API.
 *
 * @example
 * notify.success("Project created");
 * notify.error("Save failed", { description: err.message, glow: true });
 * notify.message("Slide deleted", {
 *   description: "Slide 3",
 *   action: { label: "Undo", onClick: restore },
 * });
 */
export const notify = {
  /** Neutral card (no glow by default) — good for undo / soft messages */
  message: (title: string, opts?: NotifyOptions) => show("default", title, opts),

  success: (title: string, opts?: NotifyOptions) =>
    show("success", title, { glow: opts?.glow ?? true, ...opts }),

  error: (title: string, opts?: NotifyOptions) =>
    show("error", title, { glow: opts?.glow ?? true, ...opts }),

  warning: (title: string, opts?: NotifyOptions) =>
    show("warning", title, { glow: opts?.glow ?? true, ...opts }),

  info: (title: string, opts?: NotifyOptions) =>
    show("info", title, { glow: opts?.glow ?? true, ...opts }),

  /** Explicit control: pick tone + glow via params */
  custom: (
    title: string,
    opts: NotifyOptions & { tone?: ToastTone } = {},
  ) => {
    const { tone = "default", ...rest } = opts;
    return show(tone, title, rest);
  },

  dismiss: (id?: string | number) => sonnerToast.dismiss(id),
};

/** @deprecated Prefer `notify` — kept for gradual migration */
export const toast = notify;
