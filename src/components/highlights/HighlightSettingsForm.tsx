import { useUiStore } from "@/store/useUiStore";
import { usePreviewHighlightSettings } from "@/hooks/usePreviewSettings";
import { SliderField } from "../ui/slider-field";
import { ToggleField } from "../ui/toggle-field";
import type { Highlight } from "@/types";

export function HighlightSettingsForm({ highlight, onUpdate }: { highlight: Highlight; onUpdate: (id: string, patch: Partial<Highlight>) => void }) {
  const setPreview = useUiStore((s) => s.setPreviewHighlightSetting);
  const preview = usePreviewHighlightSettings(highlight.id);
  const eff = preview ? { ...highlight, ...preview } : highlight;
  const id = highlight.id;
  return <div className="space-y-2"><SliderField label="Dim amount" labelClassName="text-[9px]" value={eff.dimAmount} min={0} max={100} step={5} format={(v) => `${v}%`} onPreview={(v) => setPreview(id, { dimAmount: v })} onCommit={(v) => onUpdate(id, { dimAmount: v })} /><ToggleField label="Enlarge selection" labelClassName="text-[9px]" checked={eff.sizeUpEnabled} onChange={(v) => onUpdate(id, { sizeUpEnabled: v })} />{eff.sizeUpEnabled && <SliderField label="Enlarge amount" labelClassName="text-[9px]" value={eff.sizeUpAmount} min={105} max={250} step={5} format={(v) => `${v}%`} onPreview={(v) => setPreview(id, { sizeUpAmount: v })} onCommit={(v) => onUpdate(id, { sizeUpAmount: v })} />}<ToggleField label="Custom timings" labelClassName="text-[9px]" checked={eff.useCustomTransition} onChange={(v) => onUpdate(id, { useCustomTransition: v })} />{eff.useCustomTransition && <><SliderField label="Dim duration" labelClassName="text-[9px]" value={eff.dimTransition} min={100} max={2000} step={50} format={(v) => `${v}ms`} onPreview={(v) => setPreview(id, { dimTransition: v })} onCommit={(v) => onUpdate(id, { dimTransition: v })} />{eff.sizeUpEnabled && <SliderField label="Enlarge duration" labelClassName="text-[9px]" value={eff.sizeUpTransition} min={100} max={2000} step={50} format={(v) => `${v}ms`} onPreview={(v) => setPreview(id, { sizeUpTransition: v })} onCommit={(v) => onUpdate(id, { sizeUpTransition: v })} />}</>}</div>;
}
