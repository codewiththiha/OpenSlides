<script lang="ts" module>
  export const ITEM_WIDTH = 152;
  export const ITEM_HEIGHT = 132;
</script>

<script lang="ts">
  import { cn } from "$lib/lib/utils";
  import { slideDisplayName, type Slide } from "$lib/types";
  import { createCodeCardTheme } from "$lib/ui/code-card/code-card-theme.svelte";
  import { createSlideThumbnail } from "$lib/shiki/slide-thumbnail.svelte";
  import { ui, setCurrentSlideId } from "$lib/stores/ui-state.svelte";
  import { effectiveSlideCode } from "$lib/stores/slide-code.svelte";
  import SearchSnippet from "./SearchSnippet.svelte";
  import CodeThumbnail from "$lib/ui/CodeThumbnail.svelte";
  import SlideCardHeader from "./SlideCardHeader.svelte";
  import SlideCardActions from "./SlideCardActions.svelte";
  import SlideCardMeta from "./SlideCardMeta.svelte";
  import SlideCardHoverPreview from "./SlideCardHoverPreview.svelte";
  import { createSlideCardHoverPreview } from "./slide-card-preview.svelte";

  import { consumeSlideCardActions } from "./slide-card-actions.svelte";
  import { handleSlideCardKeyDown } from "./slide-card-keyboard";

  let {
    slide,
    index,
    highlightProgress = -1,
    cardRefs,
    navigationIds = [],
    isTabStop = false,
    isMultiSelectMode = false,
    isMultiSelected = false,
    theme,
    language,
    searchQuery = "",
    enableHoverPreview = false,
  }: {
    slide: Slide;
    index: number;
    highlightProgress?: number;
    cardRefs?: Map<string, HTMLDivElement>;
    navigationIds?: string[];
    isTabStop?: boolean;
    isMultiSelectMode?: boolean;
    isMultiSelected?: boolean;
    theme: string;
    language: string;
    searchQuery?: string;
    enableHoverPreview?: boolean;
  } = $props();

  const cardActions = consumeSlideCardActions();

  const isRenaming = $derived(cardActions.renamingId === slide.id);
  const renameValue = $derived(isRenaming ? cardActions.renameValue : "");

  // Fine-grained $derived keeps list updates cheap: this card only updates
  // when ITS slide id / localCode key flips, not on every keystroke.
  const isSelected = $derived(ui.currentSlideId === slide.id);
  const thumbnailCode = $derived(effectiveSlideCode(slide));
  const preview = $derived(
    thumbnailCode.split("\n")[0]?.slice(0, 28) || "Empty",
  );

  let cardRootEl = $state<HTMLDivElement | null>(null);

  const thumbnail = createSlideThumbnail(() => ({
    slideId: slide.id,
    code: thumbnailCode,
    theme,
    language,
    initialHtml: slide.thumbnailHtml,
  }));
  const hover = createSlideCardHoverPreview({
    isOverlay: false,
    enableHoverPreview: () => enableHoverPreview,
    cardRoot: () => cardRootEl,
  });
  const hoverThumbnail = createSlideThumbnail(() => ({
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
  const cardTheme = createCodeCardTheme(() => theme);

  /** Registers this card's root in the panel-wide ref map (roving focus). */
  function registerCardNode(node: HTMLElement) {
    cardActions.registerCardRef(slide.id, node as HTMLDivElement);
    return {
      destroy() {
        cardActions.registerCardRef(slide.id, null);
      },
    };
  }

  const onCardKeyDown = (
    e: KeyboardEvent & { currentTarget: HTMLDivElement },
  ) =>
    handleSlideCardKeyDown(e, {
      slideId: slide.id,
      title,
      isRenaming,
      isMultiSelectMode,
      navigationIds,
      cardRefs,
      actions: cardActions,
    });
</script>

<div
  bind:this={cardRootEl}
  use:registerCardNode
  data-slide-id={slide.id}
  role="option"
  aria-selected={isSelected}
  tabindex={isTabStop ? 0 : -1}
  onkeydown={onCardKeyDown}
  class={cn(
    "group relative flex h-[118px] min-w-0 shrink-0 cursor-pointer flex-col gap-1 self-center overflow-hidden rounded-md border p-2 will-change-transform select-none focus-visible:ring-2 focus-visible:ring-primary/50 focus-visible:outline-none",
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
      cardActions.toggleMultiSelect(slide.id, {
        x: event.clientX,
        y: event.clientY,
      });
      return;
    }
    setCurrentSlideId(slide.id);
  }}
  oncontextmenu={(e) => {
    e.preventDefault();
    e.stopPropagation();
    cardActions.openContextMenu(e, slide, title);
  }}
>
  <CodeThumbnail
    bind:ref={thumbnail.el}
    html={thumbnail.html}
    {theme}
    fontSize={5.5}
    class={cn(
      "absolute inset-0 h-full w-full rounded-none border-0",
      isSelected && "ring-1 ring-primary/30",
    )}
    codeClassName="p-2 pt-9"
  >
    {#snippet fallback()}
      <span
        class="block truncate p-2 pt-9 font-mono text-[10px] leading-tight text-muted-foreground/80"
      >
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
    class="pointer-events-none absolute inset-x-0 top-0 z-10 px-2 pt-2 pb-8"
    style="background: {cardTheme.topGradient};"
  >
    <div class="pointer-events-auto pr-14 text-white mix-blend-difference">
      <SlideCardHeader {isRenaming} {renameValue} {title} slideId={slide.id} />
    </div>
  </div>

  <div class="absolute top-1.5 right-2 z-20">
    <SlideCardActions {isRenaming} {title} slideId={slide.id} />
  </div>

  {#if searchQuery}
    <div class="absolute inset-x-2 bottom-7 z-10">
      <SearchSnippet code={`${title}\n${thumbnailCode}`} query={searchQuery} />
    </div>
  {/if}

  <div
    class="absolute inset-x-0 bottom-0 z-10 px-2 pt-7 pb-1.5"
    style="background: {cardTheme.bottomGradient};"
  >
    <div class="text-white mix-blend-difference">
      <SlideCardMeta {language} {hlCount} {progress} {isSelected} />
    </div>
  </div>
</div>
