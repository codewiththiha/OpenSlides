import { Plus, ChevronDown } from "lucide-react";
import { Button } from "../ui/button";
import { SearchInput } from "../ui/search-input";
import { modKeyLabel } from "@/lib/platform";
import type { Slide } from "@/types";

interface SlidesPanelHeaderProps {
  ordered: Slide[];
  filteredOrdered: Slide[];
  rawSearchQuery: string;
  searchQuery: string;
  onSearchChange: (value: string) => void;
  onClearSearch: () => void;
  onSearchKeyDown: React.KeyboardEventHandler<HTMLInputElement>;
  searchInputRef: React.Ref<HTMLInputElement>;
  onAdd: () => void;
  addPending: boolean;
  onToggleCollapse: () => void;
}

export function SlidesPanelHeader({
  ordered,
  filteredOrdered,
  rawSearchQuery,
  searchQuery,
  onSearchChange,
  onClearSearch,
  onSearchKeyDown,
  searchInputRef,
  onAdd,
  addPending,
  onToggleCollapse,
}: SlidesPanelHeaderProps) {
  return (
    <div className="flex shrink-0 items-center gap-2 px-3 py-1">
      <span
        className="min-w-0 shrink-0 truncate text-[11px] font-medium uppercase tracking-wide text-muted-foreground"
        title="Slides"
      >
        Slides ({ordered.length}
        {searchQuery ? ` · ${filteredOrdered.length} filtered` : ""})
      </span>
      <SearchInput
        value={rawSearchQuery}
        onChange={onSearchChange}
        onClear={onClearSearch}
        placeholder="Search by name or code…"
        title={`Search slides (${modKeyLabel()}⇧F or /)`}
        className="relative flex-1 mx-2"
        onKeyDown={onSearchKeyDown}
        inputRef={searchInputRef}
      />
      <div className="flex shrink-0 items-center gap-1">
        <Button
          variant="ghost"
          size="sm"
          className="h-6 gap-1 text-xs"
          onClick={onAdd}
          disabled={addPending}
        >
          <Plus className="h-3.5 w-3.5" />
          <span className="hidden sm:inline">Add</span>
        </Button>
        <Button variant="ghost" size="icon" className="h-6 w-6" onClick={onToggleCollapse}>
          <ChevronDown className="h-3.5 w-3.5" />
        </Button>
      </div>
    </div>
  );
}
