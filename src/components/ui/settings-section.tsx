import { cn } from "@/lib/utils";

interface SettingsSectionProps {
  title: string;
  description?: string;
  children: React.ReactNode;
  className?: string;
  /** Adds a top border + padding to separate this section from the one above */
  borderTop?: boolean;
}

export function SettingsSection({
  title,
  description,
  children,
  className,
  borderTop = false,
}: SettingsSectionProps) {
  return (
    <section
      className={cn(
        "space-y-3",
        borderTop && "border-t pt-4",
        className,
      )}
    >
      <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        {title}
      </h3>
      {description && (
        <p className="text-[11px] text-muted-foreground">{description}</p>
      )}
      {children}
    </section>
  );
}
