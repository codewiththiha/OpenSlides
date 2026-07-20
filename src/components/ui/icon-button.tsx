import * as React from "react";
import type { LucideIcon } from "lucide-react";
import { Button } from "./button";
import { Tooltip, TooltipContent, TooltipTrigger } from "./tooltip";
import { cn } from "@/lib/utils";

type IconButtonSize = "xxs" | "xs" | "sm" | "md";
const SIZES: Record<IconButtonSize, string> = { xxs: "h-5 w-5 [&_svg]:size-3", xs: "h-6 w-6 [&_svg]:size-3", sm: "h-7 w-7 [&_svg]:size-3.5", md: "h-8 w-8 [&_svg]:size-4" };

export function IconButton({ icon: Icon, label, shortcut, onClick, disabled, active, danger, size = "md", side = "top", className, children }: { icon: LucideIcon; label: string; shortcut?: string; onClick?: (event: React.MouseEvent<HTMLButtonElement>) => void; disabled?: boolean; active?: boolean; danger?: boolean; size?: IconButtonSize; side?: "top" | "bottom" | "left" | "right"; className?: string; children?: React.ReactNode; title?: never }) {
  return <Tooltip><TooltipTrigger asChild><Button type="button" variant="ghost" size="icon" disabled={disabled} onClick={onClick} aria-label={label} className={cn("relative", SIZES[size], active && "bg-primary/15 text-primary", danger && "hover:bg-destructive/10 hover:text-destructive", className)}><Icon />{children}</Button></TooltipTrigger><TooltipContent side={side}>{label}{shortcut && <span className="ml-2 opacity-70">{shortcut}</span>}</TooltipContent></Tooltip>;
}
