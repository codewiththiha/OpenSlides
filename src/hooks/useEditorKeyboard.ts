/**
 * useEditorKeyboard — isolated keyboard handling for Editor.
 *
 * BEFORE: handleKeyDown lived in Editor.tsx with 14 deps, recreated on every
 * store change → entailed re-adding the window listener each render, and any
 * keystroke (localCode / saveStatus) caused a new callback & re-render of
 * the entire workspace.
 *
 * AFTER: this hook reads latest UI state via `getState()` inside the handler
 * (not via closure deps). Only `goNext`, `goPrev`, `exitPresent` are deps —
 * all three are stable (useHighlightNav uses refs, exitPresent is memoized).
 * The listener is registered once.
 */
import { useCallback, useEffect } from "react";
import { useUiStore } from "@/store/useUiStore";
import { isModKey, isTypingTarget } from "@/lib/keyboard";

interface UseEditorKeyboardArgs {
  goNext: () => boolean;
  goPrev: () => boolean;
  exitPresent: () => void | Promise<void>;
}

export function useEditorKeyboard({
  goNext,
  goPrev,
  exitPresent,
}: UseEditorKeyboardArgs) {
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      // Read fresh state on each keypress — no need to list 10 flags as deps
      const {
        isPresenting,
        isZenMode,
        isSettingsOpen,
        isCommandOpen,
        isShortcutsOpen,
        setIsShortcutsOpen,
        toggleShortcutsOpen,
        toggleZenMode,
        setIsAutoPlaying,
        toggleAutoPlaying,
      } = useUiStore.getState();

      // Present mode: arrows / space / esc / p
      if (isPresenting) {
        if (e.key === "Escape") {
          e.preventDefault();
          void exitPresent();
        } else if (e.key === "ArrowRight" || e.key === " ") {
          e.preventDefault();
          setIsAutoPlaying(false);
          goNext();
        } else if (e.key === "ArrowLeft") {
          e.preventDefault();
          setIsAutoPlaying(false);
          goPrev();
        } else if (e.key.toLowerCase() === "p" && !isModKey(e)) {
          e.preventDefault();
          toggleAutoPlaying();
        }
        return;
      }

      // Zen / dialogs: Esc handling
      if (e.key === "Escape") {
        if (isShortcutsOpen) {
          e.preventDefault();
          setIsShortcutsOpen(false);
          return;
        }
        if (isZenMode) {
          e.preventDefault();
          toggleZenMode();
        }
      }

      // Mod+B → Zen
      if (isModKey(e) && e.key.toLowerCase() === "b") {
        e.preventDefault();
        toggleZenMode();
      }

      // "?" → shortcuts help (Shift+/), ignore when typing
      if (
        e.key === "?" &&
        !isModKey(e) &&
        !e.altKey &&
        !isTypingTarget(e.target) &&
        !isCommandOpen
      ) {
        e.preventDefault();
        toggleShortcutsOpen();
        return;
      }

      // Arrow nav in normal/zen when not typing
      if (
        (e.key === "ArrowRight" || e.key === "ArrowLeft") &&
        !isTypingTarget(e.target) &&
        !isModKey(e) &&
        !e.altKey &&
        !isSettingsOpen &&
        !isCommandOpen &&
        !isShortcutsOpen
      ) {
        e.preventDefault();
        setIsAutoPlaying(false);
        if (e.key === "ArrowRight") goNext();
        else goPrev();
      }
    },
    [goNext, goPrev, exitPresent]
  );

  useEffect(() => {
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [handleKeyDown]);
}
