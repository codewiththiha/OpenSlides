import { ChevronDown, ChevronUp, Search, X } from "lucide-react";
import { Button } from "../ui/button";
import type { FindReplaceApi } from "@/hooks/useFindReplace";

export function FindReplaceBar({ fr, onClose }: { fr: FindReplaceApi; onClose: () => void }) {
  return (
    <div className="flex shrink-0 flex-wrap items-center gap-2 border-b bg-muted/30 px-2 py-1.5">
      <div className="flex items-center gap-1">
        <Search className="h-3 w-3 text-muted-foreground" />
        <input className="h-6 w-32 rounded border border-input bg-background px-2 text-xs outline-none focus:ring-1 focus:ring-ring sm:w-48" placeholder="Find" value={fr.searchTerm} onChange={(e) => fr.setSearchTerm(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); e.shiftKey ? fr.goPrev() : fr.goNext(); } if (e.key === "Escape") onClose(); }} autoFocus />
        <span className="text-[10px] text-muted-foreground">{fr.matches.length ? `${fr.currentMatchIndex + 1}/${fr.matches.length}` : "0/0"}</span>
        <Button variant="ghost" size="icon" className="h-6 w-6" onClick={fr.goPrev} title="Previous (Shift+Enter)"><ChevronUp className="h-3 w-3" /></Button>
        <Button variant="ghost" size="icon" className="h-6 w-6" onClick={fr.goNext} title="Next (Enter)"><ChevronDown className="h-3 w-3" /></Button>
      </div>
      <div className="flex items-center gap-1">
        <input className="h-6 w-32 rounded border border-input bg-background px-2 text-xs outline-none focus:ring-1 focus:ring-ring sm:w-48" placeholder="Replace" value={fr.replaceTerm} onChange={(e) => fr.setReplaceTerm(e.target.value)} />
        <Button variant="ghost" size="sm" className="h-6 text-xs" onClick={fr.replaceCurrent} disabled={!fr.matches.length}>Replace</Button>
        <Button variant="ghost" size="sm" className="h-6 text-xs" onClick={fr.replaceAll} disabled={!fr.matches.length}>Replace All</Button>
        <label className="flex items-center gap-1 text-[10px] text-muted-foreground"><input type="checkbox" checked={fr.matchCase} onChange={(e) => fr.setMatchCase(e.target.checked)} className="h-3 w-3" />Aa</label>
      </div>
      <Button variant="ghost" size="icon" className="ml-auto h-6 w-6" onClick={onClose}><X className="h-3 w-3" /></Button>
    </div>
  );
}
