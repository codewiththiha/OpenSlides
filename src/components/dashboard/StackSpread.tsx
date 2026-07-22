import { useEffect, useState, useCallback } from "react";
import { createPortal } from "react-dom";
import { motion } from "framer-motion";
import { Ungroup, X } from "lucide-react";
import { useDraggable } from "@dnd-kit/core";
import { type ProjectSummary } from "@/types";
import { type GroupChunk } from "@/lib/grouping";
import { computeFanLayout } from "@/lib/stacking";
import { ProjectCard } from "./ProjectCard";
import { Z_INDEX } from "../ui/overlay";

export interface StackSpreadProps {
  chunk: GroupChunk<ProjectSummary>;
  deckElement: HTMLElement | null;
  onClose: () => void;
  isRenaming: (id: string) => boolean;
  renameValue: string;
  onRenameValueChange: (value: string) => void;
  onCommitRename: () => void;
  onCancelRename: () => void;
  onStartRename: (id: string, name: string) => void;
  onOpen: (id: string) => void;
  onDuplicate: (id: string) => void;
  onExport: (id: string) => void;
  onDelete: (id: string, name: string) => void;
  duplicateBusy: boolean;
  commitBusy: boolean;
  onUngroup: (ids: string[]) => void;
}

interface FannedItemProps {
  project: ProjectSummary;
  index: number;
  total: number;
  fanCenterX: number;
  fanCenterY: number;
  deckRect: DOMRect | null;
  isClosing: boolean;
  groupId?: string;
  isRenaming: boolean;
  renameValue: string;
  onRenameValueChange: (value: string) => void;
  onCommitRename: () => void;
  onCancelRename: () => void;
  onStartRename: (id: string, name: string) => void;
  onOpen: (id: string) => void;
  onDuplicate: (id: string) => void;
  onExport: (id: string) => void;
  onDelete: (id: string, name: string) => void;
  duplicateBusy: boolean;
  commitBusy: boolean;
}

function FannedItem({
  project,
  index,
  total,
  fanCenterX,
  fanCenterY,
  deckRect,
  isClosing,
  groupId,
  isRenaming,
  renameValue,
  onRenameValueChange,
  onCommitRename,
  onCancelRename,
  onStartRename,
  onOpen,
  onDuplicate,
  onExport,
  onDelete,
  duplicateBusy,
  commitBusy,
}: FannedItemProps) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: `fan-${project.id}`,
    data: {
      kind: "fan-item",
      project,
      groupId,
      fanCenter: { x: fanCenterX, y: fanCenterY },
    },
  });

  const { rotate: fanAngle, x: fanX, y: fanY } = computeFanLayout(total, index);

  const cardWidth = 220;
  const cardHeight = 180;

  const originLeft = (deckRect?.left ?? fanCenterX - cardWidth / 2) + (deckRect?.width ?? cardWidth) / 2 - cardWidth / 2;
  const originTop = (deckRect?.top ?? fanCenterY - cardHeight / 2) + (deckRect?.height ?? cardHeight) / 2 - cardHeight / 2;

  const targetLeft = fanCenterX - cardWidth / 2 + fanX;
  const targetTop = fanCenterY - cardHeight / 2 + fanY;

  return (
    <motion.div
      ref={setNodeRef}
      {...attributes}
      {...listeners}
      className="absolute"
      style={{
        width: `${cardWidth}px`,
        transformOrigin: "center 180%",
        zIndex: isDragging ? 60 : 30 + index,
      }}
      initial={{
        left: originLeft,
        top: originTop,
        scale: 0.5,
        opacity: 0,
        rotate: 0,
      }}
      animate={
        isClosing
          ? {
              left: originLeft,
              top: originTop,
              scale: 0.5,
              opacity: 0,
              rotate: 0,
            }
          : {
              left: targetLeft,
              top: targetTop,
              scale: 1,
              opacity: isDragging ? 0.3 : 1,
              rotate: fanAngle,
            }
      }
      transition={{
        type: "spring",
        stiffness: 260,
        damping: 20,
        mass: 0.8,
        delay: Math.abs(index - (total - 1) / 2) * 0.05,
      }}
    >
      <div className="rounded-xl bg-background shadow-2xl ring-1 ring-border/80">
        <ProjectCard
          project={project}
          isRenaming={isRenaming}
          renameValue={renameValue}
          onRenameValueChange={onRenameValueChange}
          onCommitRename={onCommitRename}
          onCancelRename={onCancelRename}
          onStartRename={onStartRename}
          onOpen={onOpen}
          onDuplicate={onDuplicate}
          onExport={onExport}
          onDelete={onDelete}
          duplicateBusy={duplicateBusy}
          commitBusy={commitBusy}
        />
      </div>
    </motion.div>
  );
}

export function StackSpread({
  chunk,
  deckElement,
  onClose,
  isRenaming,
  renameValue,
  onRenameValueChange,
  onCommitRename,
  onCancelRename,
  onStartRename,
  onOpen,
  onDuplicate,
  onExport,
  onDelete,
  duplicateBusy,
  commitBusy,
  onUngroup,
}: StackSpreadProps) {
  const [isClosing, setIsClosing] = useState(false);
  const [currentDeckRect, setCurrentDeckRect] = useState<DOMRect | null>(() =>
    deckElement?.getBoundingClientRect() ?? null
  );

  const triggerClose = useCallback(() => {
    if (isClosing) return;
    if (deckElement) {
      setCurrentDeckRect(deckElement.getBoundingClientRect());
    }
    setIsClosing(true);
    setTimeout(() => {
      onClose();
    }, 220);
  }, [isClosing, deckElement, onClose]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        e.stopPropagation();
        triggerClose();
      }
    };
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [triggerClose]);

  const projects = chunk.items;
  const total = projects.length;

  const fanCenterX = Math.max(
    240,
    Math.min(
      window.innerWidth - 240,
      (currentDeckRect?.left ?? window.innerWidth / 2) + (currentDeckRect?.width ?? 220) / 2
    )
  );
  const fanCenterY = Math.max(
    180,
    Math.min(
      window.innerHeight - 200,
      (currentDeckRect?.top ?? window.innerHeight / 2) + (currentDeckRect?.height ?? 150) / 2
    )
  );

  const cardWidth = 220;
  const cardHeight = 180;
  const spreadWidth = cardWidth + (total - 1) * 85 + 80;
  const spreadHeight = cardHeight + Math.abs((total - 1) / 2) * 12 + 80;

  return createPortal(
    <div
      className="fixed inset-0 select-none overflow-hidden"
      style={{ zIndex: Z_INDEX.hoverPreview || 200 }}
    >
      {/* Transparent catcher backdrop */}
      <motion.div
        className="absolute inset-0 bg-black/40 backdrop-blur-[2px]"
        initial={{ opacity: 0 }}
        animate={{ opacity: isClosing ? 0 : 1 }}
        transition={{ duration: 0.2 }}
        onClick={triggerClose}
      />

      {/* Highlight wrapper around the spread */}
      <motion.div
        className="absolute rounded-2xl border-2 border-primary/25 bg-primary/[0.04] shadow-[0_0_40px_rgba(0,0,0,0.3)]"
        style={{
          left: fanCenterX - spreadWidth / 2,
          top: fanCenterY - spreadHeight / 2,
          width: spreadWidth,
          height: spreadHeight,
        }}
        initial={{ opacity: 0, scale: 0.85 }}
        animate={
          isClosing
            ? { opacity: 0, scale: 0.85 }
            : { opacity: 1, scale: 1 }
        }
        transition={{ type: "spring", stiffness: 300, damping: 25 }}
      />

      {/* Mini floating controls — top-right of the highlight wrapper */}
      <motion.div
        className="absolute z-50 flex items-center gap-1.5"
        style={{
          left: fanCenterX + spreadWidth / 2 - 4,
          top: fanCenterY - spreadHeight / 2 - 4,
        }}
        initial={{ opacity: 0, scale: 0.5 }}
        animate={
          isClosing
            ? { opacity: 0, scale: 0.5 }
            : { opacity: 1, scale: 1 }
        }
        transition={{ type: "spring", stiffness: 350, damping: 22, delay: 0.15 }}
      >
        <button
          type="button"
          title="Ungroup all"
          onClick={() => {
            triggerClose();
            onUngroup(projects.map((p) => p.id));
          }}
          className="flex h-7 w-7 items-center justify-center rounded-full border border-border bg-card text-muted-foreground shadow-lg transition-colors hover:bg-destructive/10 hover:text-destructive"
        >
          <Ungroup className="h-3.5 w-3.5" />
        </button>
        <button
          type="button"
          title="Close spread"
          onClick={triggerClose}
          className="flex h-7 w-7 items-center justify-center rounded-full border border-border bg-card text-muted-foreground shadow-lg transition-colors hover:bg-muted hover:text-foreground"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </motion.div>

      {/* Fanned Cards */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="pointer-events-auto">
          {projects.map((project, index) => (
            <FannedItem
              key={project.id}
              project={project}
              index={index}
              total={total}
              fanCenterX={fanCenterX}
              fanCenterY={fanCenterY}
              deckRect={currentDeckRect}
              isClosing={isClosing}
              groupId={chunk.groupId}
              isRenaming={isRenaming(project.id)}
              renameValue={renameValue}
              onRenameValueChange={onRenameValueChange}
              onCommitRename={onCommitRename}
              onCancelRename={onCancelRename}
              onStartRename={onStartRename}
              onOpen={(id) => {
                triggerClose();
                onOpen(id);
              }}
              onDuplicate={onDuplicate}
              onExport={onExport}
              onDelete={onDelete}
              duplicateBusy={duplicateBusy}
              commitBusy={commitBusy}
            />
          ))}
        </div>
      </div>
    </div>,
    document.body
  );
}
