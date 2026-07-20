import { Label } from "./label";
import { Switch } from "./switch";
import { cn } from "@/lib/utils";

export function ToggleField({ label, description, checked, onChange, disabled, labelClassName }: { label: string; description?: string; checked: boolean; onChange: (value: boolean) => void; disabled?: boolean; labelClassName?: string }) {
  return <div className="flex items-center justify-between gap-3"><div className="min-w-0"><Label className={cn("text-sm", labelClassName)}>{label}</Label>{description && <p className="text-[11px] text-muted-foreground">{description}</p>}</div><Switch checked={checked} onCheckedChange={onChange} disabled={disabled} /></div>;
}
