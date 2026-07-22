import { useEffect, useRef } from "react";
import { Search } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { Z_INDEX } from "../ui/overlay";
import { modKeyLabel } from "@/lib/platform";

export type SearchScope = "slides" | "code";

interface SlideSearchDialogProps {
  open: boolean;
  query: string;
  scope: SearchScope;
  onQueryChange: (value: string) => void;
  onScopeChange: (scope: SearchScope) => void;
  onSubmitCodeSearch: () => void;
  onClose: () => void;
}

/** Centered find control that leaves the workspace visible behind it. */
export function SlideSearchDialog({
  open,
  query,
  scope,
  onQueryChange,
  onScopeChange,
  onSubmitCodeSearch,
  onClose,
}: SlideSearchDialogProps) {
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open) return;
    requestAnimationFrame(() => inputRef.current?.focus());
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
      if (event.key === "Enter" && scope === "code") onSubmitCodeSearch();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onClose, onSubmitCodeSearch, open, scope]);

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 flex items-center justify-center p-4"
          style={{ zIndex: Z_INDEX.command }}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
        >
          <button
            type="button"
            className="absolute inset-0 cursor-default"
            aria-label="Close search"
            onClick={onClose}
          />
          <motion.div
            className="relative w-full max-w-lg overflow-hidden rounded-xl border bg-card shadow-2xl"
            initial={{ opacity: 0, y: 8, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 8, scale: 0.98 }}
            transition={{ duration: 0.15 }}
          >
            <div className="flex items-center gap-2 border-b px-4 py-3">
              <Search className="h-4 w-4 text-muted-foreground" />
              <input
                ref={inputRef}
                value={query}
                onChange={(event) => onQueryChange(event.target.value)}
                placeholder={scope === "slides" ? "Find slides by name or code…" : "Find in the current editor…"}
                className="min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
              />
              <span className="text-[10px] text-muted-foreground">{modKeyLabel()}F</span>
            </div>
            <div className="flex items-center gap-2 px-4 py-3 text-xs">
              <span className="mr-1 text-muted-foreground">Search</span>
              <label className="flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 hover:bg-muted">
                <input type="radio" name="search-scope" checked={scope === "slides"} onChange={() => onScopeChange("slides")} />
                Slides
              </label>
              <label className="flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 hover:bg-muted">
                <input type="radio" name="search-scope" checked={scope === "code"} onChange={() => onScopeChange("code")} />
                Code editor
              </label>
              <span className="ml-auto text-[10px] text-muted-foreground">
                {scope === "code" ? "Enter to find" : "Results update below"}
              </span>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
