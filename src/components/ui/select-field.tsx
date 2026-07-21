import { forwardRef } from "react";
import { cn } from "@/lib/utils";

interface SelectFieldProps
  extends React.SelectHTMLAttributes<HTMLSelectElement> {
  options: ReadonlyArray<{ value: string; label: string }>;
  selectSize?: "sm" | "md";
}

export const SelectField = forwardRef<HTMLSelectElement, SelectFieldProps>(
  function SelectField({ options, selectSize = "sm", className, ...props }, ref) {
    return (
      <select
        ref={ref}
        className={cn(
          selectSize === "sm" &&
            "h-7 max-w-[9rem] truncate rounded-md border border-input bg-background px-2 text-xs",
          selectSize === "md" &&
            "h-9 w-full rounded-md border border-input bg-background px-3 text-sm",
          className,
        )}
        {...props}
      >
        {options.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>
    );
  },
);
