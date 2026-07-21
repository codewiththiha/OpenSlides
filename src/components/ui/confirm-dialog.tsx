import { useEffect, useRef } from "react";
import { Overlay, OVERLAY_Z } from "./overlay";
import { Button } from "./button";

interface ConfirmDialogProps {
  open: boolean;
  title: string;
  description?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  destructive?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export function ConfirmDialog({
  open,
  title,
  description,
  confirmLabel = "Delete",
  cancelLabel = "Cancel",
  destructive = true,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  const confirmRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (open) {
      // Auto-focus confirm button on open
      requestAnimationFrame(() => {
        confirmRef.current?.focus();
      });
    }
  }, [open]);

  if (!open) return null;

  return (
    <Overlay
      onClose={onCancel}
      z={OVERLAY_Z.command}
      placement="center"
      closeOnEsc
    >
      <div className="w-full max-w-sm rounded-xl border bg-card p-5 shadow-2xl">
        <h3 className="text-sm font-semibold">{title}</h3>
        {description && (
          <p className="mt-2 text-xs text-muted-foreground">{description}</p>
        )}
        <div className="mt-4 flex justify-end gap-2">
          <Button variant="outline" size="sm" onClick={onCancel}>
            {cancelLabel}
          </Button>
          <Button
            ref={confirmRef}
            variant={destructive ? "destructive" : "default"}
            size="sm"
            onClick={onConfirm}
          >
            {confirmLabel}
          </Button>
        </div>
      </div>
    </Overlay>
  );
}
