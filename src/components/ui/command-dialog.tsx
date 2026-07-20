import { Command } from "cmdk";
import { Overlay, OVERLAY_Z } from "./overlay";

interface CommandDialogProps {
  open: boolean;
  onClose: () => void;
  label: string;
  placeholder?: string;
  search: string;
  onSearchChange: (value: string) => void;
  listClassName?: string;
  emptyText?: string;
  footer?: React.ReactNode;
  className?: string;
  children: React.ReactNode;
}

export function CommandDialog({
  open,
  onClose,
  label,
  placeholder,
  search,
  onSearchChange,
  listClassName = "max-h-80 overflow-y-auto p-2",
  emptyText = "No results.",
  footer,
  className,
  children,
}: CommandDialogProps) {
  if (!open) return null;

  return (
    <Overlay onClose={onClose} z={OVERLAY_Z.command} placement="top" closeOnEsc className={className}>
      <Command label={label} className="w-full overflow-hidden rounded-xl border bg-card shadow-2xl">
        <Command.Input
          autoFocus
          value={search}
          onValueChange={onSearchChange}
          placeholder={placeholder}
          className="w-full border-b bg-transparent px-4 py-3 text-sm outline-none placeholder:text-muted-foreground"
        />
        <Command.List className={listClassName}>
          <Command.Empty className="px-3 py-6 text-center text-sm text-muted-foreground">
            {emptyText}
          </Command.Empty>
          {children}
        </Command.List>
        {footer}
      </Command>
    </Overlay>
  );
}
