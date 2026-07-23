<script lang="ts">
  import Overlay, { Z_INDEX } from "./Overlay.svelte";
  import Button from "./Button.svelte";

  let {
    open,
    title,
    description,
    confirmLabel = "Delete",
    cancelLabel = "Cancel",
    destructive = true,
    onConfirm,
    onCancel,
  }: {
    open: boolean;
    title: string;
    description?: string;
    confirmLabel?: string;
    cancelLabel?: string;
    destructive?: boolean;
    onConfirm: () => void;
    onCancel: () => void;
  } = $props();

  let confirmRef = $state<HTMLButtonElement | null>(null);

  // Auto-focus confirm button on open
  $effect(() => {
    if (open) {
      requestAnimationFrame(() => {
        confirmRef?.focus();
      });
    }
  });
</script>

{#if open}
  <Overlay onClose={onCancel} z={Z_INDEX.command} placement="center" closeOnEsc>
    <div class="w-full max-w-sm rounded-xl border bg-card p-5 shadow-2xl">
      <h3 class="text-sm font-semibold">{title}</h3>
      {#if description}
        <p class="mt-2 text-xs text-muted-foreground">{description}</p>
      {/if}
      <div class="mt-4 flex justify-end gap-2">
        <Button variant="outline" size="sm" onclick={onCancel}>
          {cancelLabel}
        </Button>
        <Button
          bind:ref={confirmRef}
          variant={destructive ? "destructive" : "default"}
          size="sm"
          onclick={onConfirm}
        >
          {confirmLabel}
        </Button>
      </div>
    </div>
  </Overlay>
{/if}
