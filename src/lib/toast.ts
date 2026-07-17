/**
 * Modular toast API for OpenSlides.
 *
 * All UI feedback goes through `notify.*` so every toast shares the same
 * fixed footprint (width + height), layout, and optional glow tone.
 */
import { toast as sonnerToast, type ExternalToast } from "sonner";

export type ToastTone = "default" | "success" | "error" | "warning" | "info";

export interface NotifyOptions {
  /** Secondary line under the title (always reserved for layout consistency) */
  description?: string;
  /** How long to keep the toast (ms). Defaults depend on tone. */
  duration?: number;
  /**
   * Show accent border + glow. Defaults:
   * - success/error/warning/info → true
   * - default / message → false (neutral card)
   */
  glow?: boolean;
  /** Primary action button (e.g. Undo) — always at the trailing edge */
  action?: {
    label: string;
    onClick: () => void;
  };
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

/** Shared shell classes — every toast must use these for fixed size. */
const SHELL =
  "group toast-openslides toast-fixed relative flex items-center gap-3 rounded-xl border bg-card text-card-foreground shadow-lg";

function toneClass(tone: ToastTone, glow: boolean): string {
  if (!glow || tone === "default") return "toast-tone-default";
  return `toast-tone-${tone} toast-glow`;
}

function buildOptions(
  tone: ToastTone,
  opts: NotifyOptions = {},
): ExternalToast {
  const glow = opts.glow ?? tone !== "default";
  // Always reserve a description line (nbsp if empty) so 1-line and 2-line
  // toasts keep the same content-column height inside the fixed shell.
  const description =
    opts.description && opts.description.trim().length > 0
      ? opts.description
      : "\u00a0";

  const className = [SHELL, toneClass(tone, glow)].join(" ");

  const options: ExternalToast = {
    id: opts.id,
    description,
    duration: opts.duration ?? DEFAULT_DURATION[tone],
    className,
    unstyled: true,
  };

  if (opts.action) {
    options.action = {
      label: opts.action.label,
      onClick: opts.action.onClick,
    };
  } else {
    // Invisible spacer keeps the action column width for single-line toasts
    // so success/restored match delete+undo width layout.
    options.action = {
      label: "\u00a0\u00a0\u00a0\u00a0",
      onClick: () => undefined,
    };
    options.className = `${className} toast-no-action`;
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
  // Prefer generic toast() so Sonner doesn't inject different icon chrome
  // that would change layout between success/error/message.
  return sonnerToast(title, options);
}

/**
 * Primary notification API.
 */
export const notify = {
  message: (title: string, opts?: NotifyOptions) => show("default", title, opts),

  success: (title: string, opts?: NotifyOptions) =>
    show("success", title, { ...opts, glow: opts?.glow ?? true }),

  error: (title: string, opts?: NotifyOptions) =>
    show("error", title, { ...opts, glow: opts?.glow ?? true }),

  warning: (title: string, opts?: NotifyOptions) =>
    show("warning", title, { ...opts, glow: opts?.glow ?? true }),

  info: (title: string, opts?: NotifyOptions) =>
    show("info", title, { ...opts, glow: opts?.glow ?? true }),

  custom: (
    title: string,
    opts: NotifyOptions & { tone?: ToastTone } = {},
  ) => {
    const { tone = "default", ...rest } = opts;
    return show(tone, title, rest);
  },

  dismiss: (id?: string | number) => sonnerToast.dismiss(id),
};

/** @deprecated Prefer `notify` */
export const toast = notify;
