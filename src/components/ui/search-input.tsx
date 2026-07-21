import { Search, X } from "lucide-react";
import { cn } from "@/lib/utils";

interface SearchInputProps {
  value: string;
  onChange: (value: string) => void;
  onClear: () => void;
  placeholder?: string;
  title?: string;
  className?: string;
  inputClassName?: string;
  onKeyDown?: React.KeyboardEventHandler<HTMLInputElement>;
  inputRef?: React.Ref<HTMLInputElement>;
}

export function SearchInput({
  value,
  onChange,
  onClear,
  placeholder,
  title,
  className,
  inputClassName,
  onKeyDown,
  inputRef,
}: SearchInputProps) {
  return (
    <div className={cn("relative flex-1", className)}>
      <Search className="absolute left-1.5 top-1/2 h-3 w-3 -translate-y-1/2 text-muted-foreground" />
      <input
        ref={inputRef}
        className={cn(
          "h-6 w-full rounded-md border border-input bg-background pl-6 pr-6 text-xs outline-none focus:ring-1 focus:ring-ring",
          inputClassName,
        )}
        placeholder={placeholder}
        title={title}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={onKeyDown}
      />
      {value && (
        <button
          className="absolute right-1 top-1/2 -translate-y-1/2 rounded p-0.5 hover:bg-muted"
          onClick={onClear}
        >
          <X className="h-3 w-3" />
        </button>
      )}
    </div>
  );
}
