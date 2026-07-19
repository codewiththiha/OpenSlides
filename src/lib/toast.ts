import { toast } from "sonner";
const DUR = { default: 4000, success: 3200, error: 5200, warning: 4500, info: 4000 } as const;
const SHELL = "group toast-openslides toast-fixed relative flex items-center gap-3 rounded-xl border bg-card text-card-foreground shadow-lg";
type Opts = { description?: string; duration?: number; glow?: boolean; action?: { label: string; onClick: () => void }; id?: string | number; tone?: keyof typeof DUR };
function show(t: keyof typeof DUR, title: string, o: Opts = {}) {
  const glow = o.glow ?? t !== "default";
  const desc = o.description?.trim() ? o.description : "\u00a0";
  const toneCls = glow && t !== "default" ? `toast-tone-${t} toast-glow` : "toast-tone-default";
  const noAct = !o.action ? " toast-no-action" : "";
  return toast(title, {
    id: o.id, description: desc, duration: o.duration ?? DUR[t],
    className: `${SHELL} ${toneCls}${noAct}`, unstyled: true,
    action: o.action ?? { label: "\u00a0\u00a0\u00a0\u00a0", onClick: () => {} },
  });
}
export const notify = {
  message: (t: string, o?: Opts) => show("default", t, o),
  success: (t: string, o?: Opts) => show("success", t, o),
  error: (t: string, o?: Opts) => show("error", t, o),
  warning: (t: string, o?: Opts) => show("warning", t, o),
  info: (t: string, o?: Opts) => show("info", t, o),
  custom: (t: string, o: Opts = {}) => { const { tone = "default", ...r } = o; return show(tone, t, r); },
  dismiss: (id?: string | number) => toast.dismiss(id),
};
