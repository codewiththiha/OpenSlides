import { useUiStore } from "@/store/useUiStore";
import { SliderField } from "../ui/slider-field";
import { ToggleField } from "../ui/toggle-field";
import type { Highlight } from "@/types";

export function HighlightSettingsForm({ highlight, onUpdate }: { highlight: Highlight; onUpdate: (id: string, patch: Partial<Highlight>) => void }) {
  const setPreview = useUiStore((s) => s.setPreviewHighlightSetting);
  useUiStore((s) => s.previewHighlightsRevision);
  const preview = useUiStore.getState().previewHighlights.get(highlight.id);
  const eff = preview ? { ...highlight, ...preview } : highlight;
  const id = highlight.id;
  return <div className="space-y-2"><SliderField label="Dim" labelClassName="text-[9px]" value={eff.dimAmount} min={0} max={100} step={5} format={(v) => `${v}%`} onPreview={(v) => setPreview(id, { dimAmount: v })} onCommit={(v) => onUpdate(id, { dimAmount: v })} /><ToggleField label="Size Up" labelClassName="text-[9px]" checked={eff.sizeUpEnabled} onChange={(v) => onUpdate(id, { sizeUpEnabled: v })} />{eff.sizeUpEnabled && <SliderField label="Size Up Amount" labelClassName="text-[9px]" value={eff.sizeUpAmount} min={105} max={250} step={5} format={(v) => `${v}%`} onPreview={(v) => setPreview(id, { sizeUpAmount: v })} onCommit={(v) => onUpdate(id, { sizeUpAmount: v })} />}<ToggleField label="Custom Animations" labelClassName="text-[9px]" checked={eff.useCustomTransition} onChange={(v) => onUpdate(id, { useCustomTransition: v })} />{eff.useCustomTransition && <><SliderField label="Dim Transition" labelClassName="text-[9px]" value={eff.dimTransition} min={100} max={2000} step={50} format={(v) => `${v}ms`} onPreview={(v) => setPreview(id, { dimTransition: v })} onCommit={(v) => onUpdate(id, { dimTransition: v })} />{eff.sizeUpEnabled && <SliderField label="Size Up Transition" labelClassName="text-[9px]" value={eff.sizeUpTransition} min={100} max={2000} step={50} format={(v) => `${v}ms`} onPreview={(v) => setPreview(id, { sizeUpTransition: v })} onCommit={(v) => onUpdate(id, { sizeUpTransition: v })} />}</>}</div>;
}
