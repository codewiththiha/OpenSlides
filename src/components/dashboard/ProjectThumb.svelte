<script lang="ts">
  import { FileCode } from "lucide-svelte";
  import { useSlideThumbnail } from "@/hooks/useSlideThumbnail.svelte";
  import { type ProjectSummary } from "@/types";
  import CodeThumbnail from "../ui/CodeThumbnail.svelte";
  import { cn } from "@/lib/utils";

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

  const thumb = useSlideThumbnail(() => ({
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
