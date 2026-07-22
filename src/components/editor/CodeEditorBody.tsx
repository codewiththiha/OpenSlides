interface CodeEditorBodyProps {
  editorShowLineNumbers: boolean;
  gutterWidth: number;
  editorFontSize: number;
  lineHeight: number;
  lineNumbersText: string;
  highlightedHtml: string | null;
  defaultFg: string;
  code: string;
  onChange: (e: React.ChangeEvent<HTMLTextAreaElement>) => void;
  onKeyDown: (e: React.KeyboardEvent<HTMLTextAreaElement>) => void;
  onKeyUp: (e: React.KeyboardEvent<HTMLTextAreaElement>) => void;
  onSelect: (e: React.SyntheticEvent<HTMLTextAreaElement>) => void;
  onMouseUp: (e: React.MouseEvent<HTMLTextAreaElement>) => void;
  onBlur: () => void;
  onScroll: () => void;
  onContextMenu: (e: React.MouseEvent<HTMLTextAreaElement>) => void;
  gutterRef: React.Ref<HTMLDivElement>;
  preRef: React.Ref<HTMLPreElement>;
  textareaRef: React.Ref<HTMLTextAreaElement>;
}

export function CodeEditorBody({
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
  gutterRef,
  preRef,
  textareaRef,
}: CodeEditorBodyProps) {
  return (
    <div className="relative flex min-h-0 flex-1 overflow-hidden">
      {editorShowLineNumbers && (
        <div
          ref={gutterRef}
          aria-hidden
          className="shrink-0 overflow-hidden border-r border-border/50 bg-muted/30 py-4 text-right font-mono text-muted-foreground/70 select-none"
          style={{
            width: `${gutterWidth}rem`,
            fontSize: editorFontSize,
            lineHeight,
            paddingRight: "0.5rem",
          }}
        >
          <pre
            className="m-0 whitespace-pre text-right"
            style={{
              fontSize: editorFontSize,
              lineHeight,
              margin: 0,
              padding: 0,
              background: "transparent",
            }}
          >
            {lineNumbersText}
          </pre>
        </div>
      )}

      <div className="relative min-w-0 flex-1 overflow-hidden">
        <pre
          ref={preRef}
          aria-hidden
          className="editor-highlight pointer-events-none absolute inset-0 overflow-auto py-4 pl-3 pr-4 font-mono"
          style={{ fontSize: editorFontSize, lineHeight, whiteSpace: "pre" }}
        >
          {highlightedHtml ? (
            <code
              dangerouslySetInnerHTML={{
                __html: highlightedHtml + "\n",
              }}
            />
          ) : (
            <code style={{ color: defaultFg }}>{code + "\n"}</code>
          )}
        </pre>
        <textarea
          ref={textareaRef}
          data-openslides-editor
          defaultValue={code}
          onChange={onChange}
          onKeyDown={onKeyDown}
          onKeyUp={onKeyUp}
          onSelect={onSelect}
          onMouseUp={onMouseUp}
          onBlur={onBlur}
          onScroll={onScroll}
          onContextMenu={onContextMenu}
          spellCheck={false}
          autoCorrect="off"
          autoComplete="off"
          autoCapitalize="off"
          autoSave="off"
          data-gramm="false"
          data-gramm_editor="false"
          data-enable-grammarly="false"
          data-ms-editor="false"
          data-lt-active="false"
          data-spellcheck="false"
          lang="en"
          inputMode="text"
          enterKeyHint="enter"
          className="absolute inset-0 h-full w-full resize-none overflow-auto bg-transparent py-4 pl-3 pr-4 font-mono text-transparent caret-foreground outline-none"
          wrap="off"
          style={
            {
              fontSize: editorFontSize,
              lineHeight,
              tabSize: 2,
              whiteSpace: "pre",
              WebkitTextSizeAdjust: "100%",
            } as React.CSSProperties
          }
        />
      </div>
    </div>
  );
}
