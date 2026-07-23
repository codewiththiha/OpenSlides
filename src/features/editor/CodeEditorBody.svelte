<script lang="ts">
  /**
   * Editor body: line-number gutter + Shiki highlight overlay + transparent
   * textarea. The textarea is deliberately UNCONTROLLED — its value and
   * caret are managed imperatively by createCaretSync (React's
   * defaultValue pattern), so typing never fights a state round-trip.
   */
  let {
    editorShowLineNumbers,
    gutterWidth,
    editorFontSize,
    lineHeight,
    lineNumbersText,
    highlightedHtml,
    defaultFg,
    code,
    onChange,
    onKeyDown,
    onKeyUp,
    onSelect,
    onMouseUp,
    onBlur,
    onScroll,
    onContextMenu,
    gutterEl = $bindable(null),
    preEl = $bindable(null),
    textareaEl = $bindable(null),
  }: {
    editorShowLineNumbers: boolean;
    gutterWidth: number;
    editorFontSize: number;
    lineHeight: number;
    lineNumbersText: string;
    highlightedHtml: string | null;
    defaultFg: string;
    code: string;
    onChange: (value: string) => void;
    onKeyDown: (e: KeyboardEvent & { currentTarget: HTMLTextAreaElement }) => void;
    onKeyUp: (e: KeyboardEvent & { currentTarget: HTMLTextAreaElement }) => void;
    onSelect: (e: Event & { currentTarget: HTMLTextAreaElement }) => void;
    onMouseUp: (e: MouseEvent & { currentTarget: HTMLTextAreaElement }) => void;
    onBlur: () => void;
    onScroll: () => void;
    onContextMenu: (e: MouseEvent & { currentTarget: HTMLTextAreaElement }) => void;
    gutterEl?: HTMLDivElement | null;
    preEl?: HTMLPreElement | null;
    textareaEl?: HTMLTextAreaElement | null;
  } = $props();
</script>

<div class="relative flex min-h-0 flex-1 overflow-hidden">
  {#if editorShowLineNumbers}
    <div
      bind:this={gutterEl}
      aria-hidden="true"
      class="shrink-0 select-none overflow-hidden border-r border-border/50 bg-muted/30 py-4 text-right font-mono text-muted-foreground/70"
      style="width: {gutterWidth}rem; font-size: {editorFontSize}px; line-height: {lineHeight}; padding-right: 0.5rem;"
    >
      <pre
        class="m-0 whitespace-pre text-right"
        style="font-size: {editorFontSize}px; line-height: {lineHeight}; margin: 0; padding: 0; background: transparent;"
      >{lineNumbersText}</pre>
    </div>
  {/if}

  <div class="relative min-w-0 flex-1 overflow-hidden">
    <pre
      bind:this={preEl}
      aria-hidden="true"
      class="editor-highlight pointer-events-none absolute inset-0 overflow-auto py-4 pl-3 pr-4 font-mono"
      style="font-size: {editorFontSize}px; line-height: {lineHeight}; white-space: pre;"
    >{#if highlightedHtml}<code>{@html highlightedHtml + "\n"}</code>{:else}<code style="color: {defaultFg};">{code + "\n"}</code>{/if}</pre>
    <textarea
      bind:this={textareaEl}
      data-openslides-editor
      oninput={(e) => onChange(e.currentTarget.value)}
      onkeydown={onKeyDown}
      onkeyup={onKeyUp}
      onselect={onSelect}
      onmouseup={onMouseUp}
      onblur={onBlur}
      onscroll={onScroll}
      oncontextmenu={onContextMenu}
      spellcheck="false"
      {...{ autocorrect: "off" }}
      autocomplete="off"
      autocapitalize="off"
      autosave="off"
      data-gramm="false"
      data-gramm_editor="false"
      data-enable-grammarly="false"
      data-ms-editor="false"
      data-lt-active="false"
      data-spellcheck="false"
      lang="en"
      inputmode="text"
      enterkeyhint="enter"
      class="absolute inset-0 h-full w-full resize-none overflow-auto bg-transparent py-4 pl-3 pr-4 font-mono text-transparent caret-foreground outline-none"
      wrap="off"
      style="font-size: {editorFontSize}px; line-height: {lineHeight}; tab-size: 2; white-space: pre; -webkit-text-size-adjust: 100%;"
    ></textarea>
  </div>
</div>
