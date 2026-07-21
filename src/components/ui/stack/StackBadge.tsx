import { cn } from "@/lib/utils";

export interface StackBadgeProps {
  count: number;
  className?: string;
  title?: string;
}

export function StackBadge({ count, className, title }: StackBadgeProps) {
  if (count <= 1) return null;

  const defaultTitle = `${count} items — click to fan`;

  return (
    <div
      title={title || defaultTitle}
      className={cn(
        "absolute -top-2 -right-2 z-30 flex h-6 min-w-[1.5rem] items-center justify-center rounded-full bg-primary px-1.5 text-xs font-semibold text-primary-foreground shadow-md ring-2 ring-background transition-transform duration-200 hover:scale-105",
        className
      )}
    >
      {count}
    </div>
  );
}
