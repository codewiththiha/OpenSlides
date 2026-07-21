import React, { useRef, useState, useCallback } from "react";
import { cn } from "@/lib/utils";
import { StackLayers } from "./StackLayers";
import { StackBadge } from "./StackBadge";

export interface StackDeckProps extends React.HTMLAttributes<HTMLDivElement> {
  count?: number;
  onExpand?: () => void;
  onOpenTop?: () => void;
  children: React.ReactNode;
  className?: string;
  badgeTitle?: string;
  badgeClassName?: string;
  variant?: "project" | "slide";
  onClick?: (e: React.MouseEvent<HTMLDivElement>) => void;
  onDoubleClick?: (e: React.MouseEvent<HTMLDivElement>) => void;
  ariaLabel?: string;
}

export const StackDeck = React.forwardRef<HTMLDivElement, StackDeckProps>(function StackDeck(
  {
    count = 1,
    onExpand,
    onOpenTop,
    children,
    className,
    badgeTitle,
    badgeClassName,
    variant = "project",
    onClick,
    onDoubleClick,
    ariaLabel,
    ...rest
  },
  forwardedRef
) {
  const [hovered, setHovered] = useState(false);
  const clickTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearClickTimeout = useCallback(() => {
    if (clickTimeoutRef.current !== null) {
      clearTimeout(clickTimeoutRef.current);
      clickTimeoutRef.current = null;
    }
  }, []);

  const isInteractiveTarget = (target: EventTarget | null) => {
    if (!target || !(target instanceof HTMLElement)) return false;
    return Boolean(
      target.closest("button") ||
      target.closest("input") ||
      target.closest("a") ||
      target.closest(".hover-actions") ||
      target.closest("[data-no-stack-click]")
    );
  };

  const handleClickCapture = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      if (count <= 1) return;
      if (isInteractiveTarget(e.target)) return;

      // Stop propagation to child card (e.g. ProjectCard/SlideCard's own onClick)
      e.stopPropagation();
      e.preventDefault();

      if (e.detail > 1) {
        clearClickTimeout();
        return;
      }

      clearClickTimeout();
      clickTimeoutRef.current = setTimeout(() => {
        clickTimeoutRef.current = null;
        if (onExpand) {
          onExpand();
        } else if (onClick) {
          onClick(e);
        }
      }, 200);
    },
    [count, onExpand, onClick, clearClickTimeout]
  );

  const handleDoubleClickCapture = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      if (count <= 1) return;
      if (isInteractiveTarget(e.target)) return;

      e.stopPropagation();
      e.preventDefault();
      clearClickTimeout();

      if (onOpenTop) {
        onOpenTop();
      } else if (onDoubleClick) {
        onDoubleClick(e);
      }
    },
    [count, onOpenTop, onDoubleClick, clearClickTimeout]
  );

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLDivElement>) => {
      if (count > 1 && (e.key === "Enter" || e.key === " ")) {
        e.preventDefault();
        onExpand?.();
      }
    },
    [count, onExpand]
  );

  return (
    <div
      ref={forwardedRef}
      className={cn("relative isolate", count > 1 && "cursor-pointer", className)}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => {
        setHovered(false);
        clearClickTimeout();
      }}
      onClickCapture={handleClickCapture}
      onDoubleClickCapture={handleDoubleClickCapture}
      onClick={(e) => {
        if (count <= 1 && onClick) onClick(e);
      }}
      onDoubleClick={(e) => {
        if (count <= 1 && onDoubleClick) onDoubleClick(e);
      }}
      onKeyDown={handleKeyDown}
      tabIndex={count > 1 ? 0 : undefined}
      aria-label={
        ariaLabel ||
        (count > 1
          ? `Stack of ${count}, press Enter to expand`
          : undefined)
      }
      {...rest}
    >
      <StackLayers count={count} hovered={hovered} variant={variant} />
      {children}
      <StackBadge
        count={count}
        className={badgeClassName}
        title={
          badgeTitle ||
          (count > 1
            ? `${count} ${variant === "slide" ? "slides" : "presentations"} — click to fan`
            : undefined)
        }
      />
    </div>
  );
});
