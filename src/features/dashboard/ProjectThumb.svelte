<script lang="ts">
  import { FileCode } from "@lucide/svelte";
  import { createSlideThumbnail } from "$lib/shiki/slide-thumbnail.svelte";
  import { type ProjectSummary } from "$lib/types";
  import CodeThumbnail from "$lib/ui/CodeThumbnail.svelte";
  import { cn } from "$lib/lib/utils";

  let {
    project,
    class: className,
    codeClassName,
    fontSize = 5.5,
  }: {
    project: ProjectSummary;
    class?: string;
    codeClassName?: string;
    fontSize?: number;
  } = $props();

  const thumb = createSlideThumbnail(() => ({
    slideId: project.firstSlideId || project.id,
    code: project.firstSlideCode,
    theme: project.theme,
    language: project.language,
    initialHtml: project.firstSlideThumbnail || undefined,
  }));
</script>

<CodeThumbnail
  bind:ref={thumb.el}
  html={thumb.html}
  theme={project.theme}
  {fontSize}
  lineHeight={1.3}
  class={cn("relative w-full overflow-hidden", className)}
  {codeClassName}
>
  {#snippet fallback()}
    <FileCode class="h-5 w-5 text-primary" />
  {/snippet}
</CodeThumbnail>
