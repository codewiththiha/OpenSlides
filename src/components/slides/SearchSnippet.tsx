import { useMemo } from "react";

/** Match-context preview shown under a filtered slide card. */
export function SearchSnippet({ code, query }: { code: string; query: string }) {
  const q = query.trim();
  const lines = useMemo(() => code.split("\n"), [code]);
  const lineStarts = useMemo(() => {
    const starts = [0];
    for (let i = 0; i < lines.length - 1; i++) {
      starts.push(starts[i] + lines[i].length + 1);
    }
    return starts;
  }, [lines]);
  const match = useMemo(() => code.toLowerCase().indexOf(q.toLowerCase()), [code, q]);
  if (!q || match < 0) return null;
  const lineIndex = lineStarts.findIndex((start, index) =>
    match < start + lines[index].length + 1,
  );
  const visible = lines.slice(Math.max(0, lineIndex - 2), lineIndex + 3);
  const firstVisible = Math.max(0, lineIndex - 2);
  return (
    <pre className="mt-1 max-h-8 overflow-hidden whitespace-pre-wrap break-words text-[9px] leading-tight text-muted-foreground" aria-label="Search match">
      {firstVisible > 0 && "…\n"}
      {visible.map((line, index) => {
        const absolute = firstVisible + index;
        if (absolute !== lineIndex) return <span key={absolute}>{line}{index < visible.length - 1 ? "\n" : ""}</span>;
        const lineStart = lineStarts[absolute] ?? 0;
        const from = Math.max(0, match - lineStart);
        const to = Math.min(line.length, from + q.length);
        return <span key={absolute}>{line.slice(0, from)}<mark className="rounded bg-primary/30 text-foreground">{line.slice(from, to)}</mark>{line.slice(to)}{index < visible.length - 1 ? "\n" : ""}</span>;
      })}
      {firstVisible + visible.length < lines.length && "\n…"}
    </pre>
  );
}