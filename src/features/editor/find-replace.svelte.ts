interface Args {
  code: () => string;
  textarea: () => HTMLTextAreaElement | null;
  applyCode: (value: string) => void;
  saveCaret: () => void;
  editorFontSize: () => number;
  lineHeight: () => number;
}

export function createFindReplace(args: Args) {
  let open = $state(false);
  let searchTerm = $state("");
  let replaceTerm = $state("");
  let matchCase = $state(false);
  let currentMatchIndex = $state(0);

  const matches = $derived.by(() => {
    const code = args.code();
    if (!searchTerm) return [] as Array<{ start: number; end: number }>;
    const needle = matchCase ? searchTerm : searchTerm.toLowerCase();
    const haystack = matchCase ? code : code.toLowerCase();
    const result: Array<{ start: number; end: number }> = [];
    let pos = 0;
    while (result.length <= 1000) {
      const index = haystack.indexOf(needle, pos);
      if (index < 0) break;
      result.push({ start: index, end: index + needle.length });
      pos = index + Math.max(needle.length, 1);
    }
    return result;
  });

  function selectMatch(index: number) {
    const el = args.textarea();
    const match = matches[index];
    const code = args.code();
    if (!el || !match) return;
    el.focus();
    el.selectionStart = match.start;
    el.selectionEnd = match.end;
    args.saveCaret();
    const line = code.slice(0, match.start).split("\n").length;
    el.scrollTop = Math.max(
      0,
      line * args.editorFontSize() * args.lineHeight() - el.clientHeight / 2,
    );
  }

  function goNext() {
    if (!matches.length) return;
    const next = (currentMatchIndex + 1) % matches.length;
    currentMatchIndex = next;
    selectMatch(next);
  }

  function goPrev() {
    if (!matches.length) return;
    const previous = (currentMatchIndex - 1 + matches.length) % matches.length;
    currentMatchIndex = previous;
    selectMatch(previous);
  }

  function replaceCurrent() {
    const match = matches[currentMatchIndex];
    if (!match) return;
    const code = args.code();
    args.applyCode(code.slice(0, match.start) + replaceTerm + code.slice(match.end));
  }

  function replaceAll() {
    if (!searchTerm || !matches.length) return;
    const code = args.code();
    const next = matchCase
      ? code.split(searchTerm).join(replaceTerm)
      : code.replace(
          new RegExp(searchTerm.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "gi"),
          () => replaceTerm,
        );
    args.applyCode(next);
  }

  $effect(() => {
    // reset to first match when the match set / query changes
    matches.length;
    searchTerm;
    currentMatchIndex = 0;
    if (open && matches.length) requestAnimationFrame(() => selectMatch(0));
  });

  function openFind(prefill?: string) {
    open = true;
    if (prefill && prefill.length < 100) searchTerm = prefill;
  }

  function close() {
    open = false;
  }

  return {
    get open() {
      return open;
    },
    openFind,
    close,
    get searchTerm() {
      return searchTerm;
    },
    set searchTerm(v: string) {
      searchTerm = v;
    },
    get replaceTerm() {
      return replaceTerm;
    },
    set replaceTerm(v: string) {
      replaceTerm = v;
    },
    get matchCase() {
      return matchCase;
    },
    set matchCase(v: boolean) {
      matchCase = v;
    },
    get matches() {
      return matches;
    },
    get currentMatchIndex() {
      return currentMatchIndex;
    },
    goNext,
    goPrev,
    replaceCurrent,
    replaceAll,
  };
}

export type FindReplaceApi = ReturnType<typeof createFindReplace>;
