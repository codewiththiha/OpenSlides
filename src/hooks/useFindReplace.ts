import { useCallback, useEffect, useMemo, useState } from "react";

interface Args {
  code: string;
  textareaRef: React.RefObject<HTMLTextAreaElement | null>;
  applyCode: (value: string) => void;
  saveCaret: () => void;
  editorFontSize: number;
  lineHeight: number;
}

export function useFindReplace({ code, textareaRef, applyCode, saveCaret, editorFontSize, lineHeight }: Args) {
  const [open, setOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [replaceTerm, setReplaceTerm] = useState("");
  const [matchCase, setMatchCase] = useState(false);
  const [currentMatchIndex, setCurrentMatchIndex] = useState(0);
  const matches = useMemo(() => {
    if (!searchTerm) return [];
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
  }, [code, searchTerm, matchCase]);
  const selectMatch = useCallback((index: number) => {
    const el = textareaRef.current;
    const match = matches[index];
    if (!el || !match) return;
    el.focus();
    el.selectionStart = match.start;
    el.selectionEnd = match.end;
    saveCaret();
    const line = code.slice(0, match.start).split("\n").length;
    el.scrollTop = Math.max(0, line * editorFontSize * lineHeight - el.clientHeight / 2);
  }, [matches, code, editorFontSize, lineHeight, saveCaret, textareaRef]);
  const goNext = useCallback(() => {
    if (!matches.length) return;
    const next = (currentMatchIndex + 1) % matches.length;
    setCurrentMatchIndex(next);
    selectMatch(next);
  }, [matches, currentMatchIndex, selectMatch]);
  const goPrev = useCallback(() => {
    if (!matches.length) return;
    const previous = (currentMatchIndex - 1 + matches.length) % matches.length;
    setCurrentMatchIndex(previous);
    selectMatch(previous);
  }, [matches, currentMatchIndex, selectMatch]);
  const replaceCurrent = useCallback(() => {
    const match = matches[currentMatchIndex];
    if (!match) return;
    applyCode(code.slice(0, match.start) + replaceTerm + code.slice(match.end));
  }, [matches, currentMatchIndex, code, replaceTerm, applyCode]);
  const replaceAll = useCallback(() => {
    if (!searchTerm || !matches.length) return;
    const next = matchCase
      ? code.split(searchTerm).join(replaceTerm)
      : code.replace(new RegExp(searchTerm.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "gi"), replaceTerm);
    applyCode(next);
  }, [searchTerm, matches.length, matchCase, code, replaceTerm, applyCode]);
  useEffect(() => {
    setCurrentMatchIndex(0);
    if (open && matches.length) requestAnimationFrame(() => selectMatch(0));
  }, [open, matches.length, searchTerm, selectMatch]);
  const openFind = useCallback((prefill?: string) => {
    setOpen(true);
    if (prefill && prefill.length < 100) setSearchTerm(prefill);
  }, []);
  const close = useCallback(() => setOpen(false), []);
  return { open, openFind, close, searchTerm, setSearchTerm, replaceTerm, setReplaceTerm, matchCase, setMatchCase, matches, currentMatchIndex, goNext, goPrev, replaceCurrent, replaceAll };
}
export type FindReplaceApi = ReturnType<typeof useFindReplace>;
