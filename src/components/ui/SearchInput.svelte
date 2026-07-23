<script lang="ts">
  import { Search, X } from "@lucide/svelte";
  import { cn } from "@/lib/utils";

  let {
    value,
    onChange,
    onClear,
    placeholder,
    title,
    class: className,
    inputClassName,
    onKeyDown,
    ref = $bindable(null),
  }: {
    value: string;
    onChange: (value: string) => void;
    onClear: () => void;
    placeholder?: string;
    title?: string;
    class?: string;
    inputClassName?: string;
    onKeyDown?: (e: KeyboardEvent) => void;
    ref?: HTMLInputElement | null;
  } = $props();
</script>

<div class={cn("relative flex-1", className)}>
  <Search class="absolute left-1.5 top-1/2 h-3 w-3 -translate-y-1/2 text-muted-foreground" />
  <input
    bind:this={ref}
    class={cn(
      "h-6 w-full rounded-md border border-input bg-background pl-6 pr-6 text-xs outline-none focus:ring-1 focus:ring-ring",
      inputClassName,
    )}
    {placeholder}
    {title}
    {value}
    oninput={(e) => onChange(e.currentTarget.value)}
    onkeydown={onKeyDown}
  />
  {#if value}
    <button
      class="absolute right-1 top-1/2 -translate-y-1/2 rounded p-0.5 hover:bg-muted"
      onclick={onClear}
    >
      <X class="h-3 w-3" />
    </button>
  {/if}
</div>
