<script lang="ts">
  import { cn } from "@/lib/utils";

  let {
    duration,
    resetKey,
    class: className,
    style,
  }: {
    duration: number;
    resetKey: string;
    class?: string;
    style?: string;
  } = $props();
</script>

<div class={cn("overflow-hidden", className)} {style}>
  {#key resetKey}
    <div
      class="openslides-progress-anim h-full w-full origin-left bg-primary"
      style="animation: openslides-present-progress {duration}ms linear forwards;"
    ></div>
  {/key}
</div>
