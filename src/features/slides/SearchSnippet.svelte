<script lang="ts">
  /** Match-context preview shown under a filtered slide card. */
  let { code, query }: { code: string; query: string } = $props();

  const q = $derived(query.trim());
  const lines = $derived(code.split("\n"));
  const lineStarts = $derived.by(() => {
    const starts = [0];
    for (let i = 0; i < lines.length - 1; i++) {
      starts.push(starts[i]! + lines[i]!.length + 1);
    }
    return starts;
  });
  const match = $derived(q ? code.toLowerCase().indexOf(q.toLowerCase()) : -1);
  const lineIndex = $derived(
    match < 0
      ? -1
      : lineStarts.findIndex((start, index) => match < start + lines[index]!.length + 1),
  );
  const firstVisible = $derived(Math.max(0, lineIndex - 2));
  const visible = $derived(lines.slice(firstVisible, lineIndex + 3));
</script>

{#if q && match >= 0 && lineIndex >= 0}
  <pre
    class="mt-1 max-h-8 overflow-hidden whitespace-pre-wrap break-words text-[9px] leading-tight text-muted-foreground"
    aria-label="Search match"
  >{#if firstVisible > 0}…{"\n"}{/if}{#each visible as line, index (firstVisible + index)}{@const absolute = firstVisible + index}{#if absolute !== lineIndex}{line}{#if index < visible.length - 1}{"\n"}{/if}{:else}{@const lineStart = lineStarts[absolute] ?? 0}{@const from = Math.max(0, match - lineStart)}{@const to = Math.min(line.length, from + q.length)}{line.slice(0, from)}<mark class="rounded bg-primary/30 text-foreground">{line.slice(from, to)}</mark>{line.slice(to)}{#if index < visible.length - 1}{"\n"}{/if}{/if}{/each}{#if firstVisible + visible.length < lines.length}{"\n"}…{/if}</pre>
{/if}
