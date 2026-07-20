interface InlineRenameInputProps {
  value: string;
  onChange: (value: string) => void;
  onCommit: () => void;
  onCancel: () => void;
  className?: string;
}

export function InlineRenameInput({
  value,
  onChange,
  onCommit,
  onCancel,
  className,
}: InlineRenameInputProps) {
  return (
    <input
      autoFocus
      className={className}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      onClick={(e) => e.stopPropagation()}
      onBlur={onCommit}
      onKeyDown={(e) => {
        e.stopPropagation();
        if (e.key === "Enter") onCommit();
        if (e.key === "Escape") onCancel();
      }}
    />
  );
}
