<script lang="ts">
  import { autofocus } from "$lib/actions/autofocus";
  import { Check, X } from "@lucide/svelte";
  import { cn } from "$lib/lib/utils";
  import Button from "./Button.svelte";

  let {
    value,
    onChange,
    onCommit,
    onCancel,
    withButtons = false,
    commitBusy = false,
    class: className,
    buttonSize = "md",
    stopPropagation = true,
    label = "Edit name",
  }: {
    value: string;
    onChange: (value: string) => void;
    onCommit: () => void;
    onCancel: () => void;
    /** ProjectCard style: show Check + X buttons next to the input */
    withButtons?: boolean;
    /** Disables the confirm button when withButtons is true */
    commitBusy?: boolean;
    /** Input classes */
    class?: string;
    /** Button sizing when withButtons is true */
    buttonSize?: "sm" | "md";
    /**
     * Whether click events on the rename area stop propagation.
     * Default true — rename clicks must not select the parent card.
     */
    stopPropagation?: boolean;
    /** Accessible name for the input (it renders no visible label). */
    label?: string;
  } = $props();

  // select-text overrides select-none ancestors (project cards became
  // unselectable so drag-to-stack can't highlight their labels).
  const inputClass =
    "select-text rounded-md border border-input bg-background px-2 text-sm outline-none focus:ring-1 focus:ring-ring";


</script>

{#snippet inputSnippet()}
  <input
    use:autofocus
    aria-label={label}
    class={cn(inputClass, withButtons ? "h-8 flex-1 min-w-0" : "h-7 w-full", className)}
    {value}
    oninput={(e) => onChange(e.currentTarget.value)}
    onclick={(e) => stopPropagation && e.stopPropagation()}
    onblur={onCommit}
    onkeydown={(e) => {
      if (stopPropagation) e.stopPropagation();
      if (e.key === "Enter") onCommit();
      if (e.key === "Escape") onCancel();
    }}
  />
{/snippet}

{#if withButtons}
  <div
    class="flex items-center gap-1"
    onclick={(e) => stopPropagation && e.stopPropagation()}
    role="presentation"
  >
    {@render inputSnippet()}
    <Button
      variant="ghost"
      size="icon"
      class={cn(
        "shrink-0",
        buttonSize === "sm" && "h-5 w-5 [&_svg]:size-3",
        buttonSize === "md" && "h-8 w-8",
      )}
      onmousedown={(event) => event.preventDefault()}
      onclick={onCommit}
      disabled={commitBusy}
    >
      <Check class="text-emerald-500" />
    </Button>
    <Button
      variant="ghost"
      size="icon"
      class={cn(
        "shrink-0",
        buttonSize === "sm" && "h-5 w-5 [&_svg]:size-3",
        buttonSize === "md" && "h-8 w-8",
      )}
      onmousedown={(event) => event.preventDefault()}
      onclick={onCancel}
    >
      <X />
    </Button>
  </div>
{:else}
  {@render inputSnippet()}
{/if}
