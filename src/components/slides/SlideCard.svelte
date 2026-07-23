<script lang="ts" module>
  export const ITEM_WIDTH = 152;
  export const ITEM_HEIGHT = 132;
</script>

<script lang="ts">
  import { cn } from "@/lib/utils";
  import { slideDisplayName, themeBackground, type Slide } from "@/types";
  import { useSlideThumbnail } from "@/hooks/useSlideThumbnail.svelte";
  import { ui, setCurrentSlideId } from "@/store/ui-state.svelte";
  import { localCode } from "@/store/slide-code.svelte";
  import SearchSnippet from "./SearchSnippet.svelte";
  import CodeThumbnail from "../ui/CodeThumbnail.svelte";
  import SlideCardHeader from "./SlideCardHeader.svelte";
  import SlideCardActions from "./SlideCardActions.svelte";
  import SlideCardMeta from "./SlideCardMeta.svelte";
  import SlideCardHoverPreview from "./SlideCardHoverPreview.svelte";
  import { useSlideCardHoverPreview } from "./useSlideCardHoverPreview.svelte";

  let {
    slide,
    index,
    isRenaming = false,
    renameValue = "",
    highlightProgress = -1,
    onRenameValueChange,
    onCommitRename,
    onCancelRename,
    onRemove,
    onRename,
    onDuplicate,
    registerCardRef,
    cardRefs,
    navigationIds = [],
    isTabStop = false,
    isMultiSelectMode = false,
    isMultiSelected = false,
    onToggleMultiSelect,
    onOpenContextMenu,
    theme,
    language,
    searchQuery = "",
    enableHoverPreview = false,
  }: {
    slide: Slide;
    index: number;
    isRenaming?: boolean;
    renameValue?: string;
    highlightProgress?: number;
    onRenameValueChange?: (v: string) => void;
    onCommitRename?: () => void;
    onCancelRename?: () => void;
    onRemove?: (id: string) => void;
    onRename?: (id: string, current: string) => void;
    onDuplicate?: (id: string) => void;
    registerCardRef?: (id: string, node: HTMLDivElement | null) => void;
    cardRefs?: Map<string, HTMLDivElement>;
    navigationIds?: string[];
    isTabStop?: boolean;
    isMultiSelectMode?: boolean;
    isMultiSelected?: boolean;
    onToggleMultiSelect?: (id: string, position?: { x: number; y: number }) => void;
    onOpenContextMenu?: (event: MouseEvent, slide: Slide, title: string) => void;
    theme: string;
    language: string;
    searchQuery?: string;
    enableHoverPreview?: boolean;
  } = $props();

  // React needed a memo comparator + per-atom boolean selectors to avoid
  // re-rendering 20 cards per keystroke. Fine-grained $derived does the same:
  // this card only updates when ITS slide id / localCode key flips.
  const isSelected = $derived(ui.currentSlideId === slide.id);
  const thumbnailCode = $derived(localCode[slide.id] ?? slide.code);
  const preview = $derived(thumbnailCode.split("\n")[0]?.slice(0, 28) || "Empty");

  let cardRootEl = $state<HTMLDivElement | null>(null);

  const thumbnail = useSlideThumbnail(() => ({
    slideId: slide.id,
    code: thumbnailCode,
    theme,
    language,
    initialHtml: slide.thumbnailHtml,
  }));
  const hover = useSlideCardHoverPreview({
    isOverlay: false,
    enableHoverPreview: () => enableHoverPreview,
    cardRoot: () => cardRootEl,
  });
  const hoverThumbnail = useSlideThumbnail(() => ({
    slideId: slide.id,
    code: thumbnailCode,
    theme,
    language,
    maxLines: 10,
    maxChars: 1000,
    enabled: hover.showHoverPreview && enableHoverPreview,
    priority: "high",
    debounceMs: 80,
  }));

  const title = $derived(slideDisplayName(slide, index));
  const hlCount = $derived(slide.highlights?.length ?? 0);
  const progress = $derived(isSelected ? highlightProgress : -1);
  const codeBackground = $derived(themeBackground(theme));
  // Theme backgrounds are six-digit hex values; the alpha suffix keeps the
  // title and metadata fades visually connected to the code preview.
  const softCodeBackground = $derived(`${codeBackground}e0`);

  /** Registers this card's root in the panel-wide ref map (roving focus). */
  function registerCardNode(node: HTMLElement) {
    registerCardRef?.(slide.id, node as HTMLDivElement);
    return {
      destroy() {
        registerCardRef?.(slide.id, null);
      },
    };
  }

  function handleCardKeyDown(e: KeyboardEvent & { currentTarget: HTMLDivElement }) {
    if (e.target !== e.currentTarget || isRenaming) return;

    if (isMultiSelectMode && (e.key === "Enter" || e.key === " ")) {
      e.preventDefault();
      e.stopPropagation();
      onToggleMultiSelect?.(slide.id);
      return;
    }

    if (e.key === "ArrowRight" || e.key === "ArrowLeft" || e.key === "Home" || e.key === "End") {
      e.preventDefault();
      e.stopPropagation();
      if (!cardRefs || navigationIds.length === 0) return;
      const currentIndex = navigationIds.indexOf(slide.id);
      const nextIndex =
        e.key === "Home"
          ? 0
          : e.key === "End"
            ? navigationIds.length - 1
            : (currentIndex + (e.key === "ArrowRight" ? 1 : -1) + navigationIds.length) %
              navigationIds.length;
      const next = cardRefs.get(navigationIds[nextIndex]);
      next?.focus();
      next?.scrollIntoView({ inline: "nearest", block: "nearest" });
      return;
    }

    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      e.stopPropagation();
      setCurrentSlideId(slide.id);
      return;
    }

    if (e.key === "Delete" || e.key === "Backspace") {
      e.preventDefault();
      e.stopPropagation();
      onRemove?.(slide.id);
      return;
    }

    if (e.key === "F2") {
      e.preventDefault();
      e.stopPropagation();
      onRename?.(slide.id, title);
    }
  }
</script>

<div
  bind:this={cardRootEl}
  use:registerCardNode
  data-slide-id={slide.id}
  role="option"
  aria-selected={isSelected}
  tabindex={isTabStop ? 0 : -1}
  onkeydown={handleCardKeyDown}
  class={cn(
    "group relative flex h-[118px] min-w-0 shrink-0 cursor-pointer select-none flex-col gap-1 self-center overflow-hidden rounded-md border p-2 will-change-transform focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50",
    isSelected
      ? "border-primary/50 bg-muted ring-1 ring-primary/20"
      : "bg-background/60 hover:border-primary/30 hover:bg-muted/40",
    isMultiSelected && "border-primary bg-primary/10 ring-2 ring-primary/30",
  )}
  style="width: {ITEM_WIDTH}px; height: {ITEM_HEIGHT}px;"
  onmouseenter={hover.onMouseEnter}
  onmouseleave={hover.onMouseLeave}
  onclick={(event) => {
    if (isRenaming) return;
    if (isMultiSelectMode) {
      onToggleMultiSelect?.(slide.id, { x: event.clientX, y: event.clientY });
      return;
    }
    setCurrentSlideId(slide.id);
  }}
  oncontextmenu={(e) => {
    e.preventDefault();
    e.stopPropagation();
    onOpenContextMenu?.(e, slide, title);
  }}
>
  <CodeThumbnail
    bind:ref={thumbnail.el}
    html={thumbnail.html}
    {theme}
    fontSize={5.5}
    class={cn("absolute inset-0 h-full w-full rounded-none border-0", isSelected && "ring-1 ring-primary/30")}
    codeClassName="p-2 pt-9"
  >
    {#snippet fallback()}
      <span class="block truncate p-2 pt-9 font-mono text-[10px] leading-tight text-muted-foreground/80">
        {preview}
      </span>
    {/snippet}
  </CodeThumbnail>

  <SlideCardHoverPreview
    show={hover.showHoverPreview}
    html={hoverThumbnail.html}
    bind:containerEl={hoverThumbnail.el}
    {theme}
    left={hover.hoverPosition.left}
    top={hover.hoverPosition.top}
  />

  <!-- The title sits over the code with a soft fade rather than taking layout space. -->
  <div
    class="pointer-events-none absolute inset-x-0 top-0 z-10 px-2 pb-8 pt-2"
    style="background: linear-gradient(to bottom, {codeBackground} 0%, {softCodeBackground} 45%, transparent 100%);"
  >
    <div class="pointer-events-auto pr-14 text-white mix-blend-difference">
      <SlideCardHeader
        {isRenaming}
        {renameValue}
        {title}
        onRenameValueChange={(v) => onRenameValueChange?.(v)}
        onCommitRename={() => onCommitRename?.()}
        onCancelRename={() => onCancelRename?.()}
        {onRename}
        slideId={slide.id}
      />
    </div>
  </div>

  <div class="absolute right-2 top-1.5 z-20">
    <SlideCardActions {isRenaming} {title} slideId={slide.id} {onRename} {onDuplicate} {onRemove} />
  </div>

  {#if searchQuery}
    <div class="absolute inset-x-2 bottom-7 z-10">
      <SearchSnippet code={`${title}\n${thumbnailCode}`} query={searchQuery} />
    </div>
  {/if}

  <div
    class="absolute inset-x-0 bottom-0 z-10 px-2 pb-1.5 pt-7"
    style="background: linear-gradient(to top, {codeBackground} 0%, {softCodeBackground} 48%, transparent 100%);"
  >
    <div class="text-white mix-blend-difference">
      <SlideCardMeta {language} {hlCount} {progress} {isSelected} />
    </div>
  </div>
</div>
