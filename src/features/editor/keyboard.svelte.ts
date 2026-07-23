/**
 * createEditorKeyboard — isolated keyboard handling for Editor.
 *
 * Reads latest UI state imperatively inside the handler (no closure deps),
 * and reads the nav callbacks through an accessor so the listener is
 * registered exactly once.
 *
 * Number keys 1-9 jump directly to highlight steps via goToHighlight.
 */
import {
  ui,
  setIsAutoPlaying,
  setIsGoToSlideOpen,
  toggleAutoPlaying,
  toggleShortcutsOpen,
  toggleZenMode,
} from "$lib/stores/ui-state.svelte";
import { isModKey, isTypingTarget } from "$lib/lib/keyboard";
import { emitOpenSearch } from "$lib/lib/app-events";

interface UseEditorKeyboardArgs {
  goNext: () => boolean;
  goPrev: () => boolean;
  goToHighlight: (index: number) => boolean;
  exitPresent: () => void | Promise<void>;
}

export function createEditorKeyboard(args: () => UseEditorKeyboardArgs) {
  $effect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const { goNext, goPrev, goToHighlight, exitPresent } = args();
      // Read fresh state on each keypress — no need to track flags
      const {
        isPresenting,
        isZenMode,
        isSettingsOpen,
        isCommandOpen,
        isGoToSlideOpen,
        isShortcutsOpen,
      } = ui;

      // Number keys 1-9 → jump to highlight step (both present and normal/focus mode)
      // 0 → clean slide (-1)
      if (
        !isModKey(e) &&
        !e.altKey &&
        !isTypingTarget(e.target) &&
        !isCommandOpen &&
        !isShortcutsOpen &&
        !isSettingsOpen &&
        !isGoToSlideOpen
      ) {
        if (e.key >= "1" && e.key <= "9") {
          const idx = parseInt(e.key, 10) - 1;
          e.preventDefault();
          setIsAutoPlaying(false);
          goToHighlight(idx);
          return;
        }
        if (e.key === "0") {
          e.preventDefault();
          setIsAutoPlaying(false);
          goToHighlight(-1);
          return;
        }
      }

      // Cmd/Ctrl+G → go-to-slide dialog.
      if (
        isModKey(e) &&
        !e.shiftKey &&
        e.key.toLowerCase() === "g" &&
        !isPresenting &&
        !isCommandOpen &&
        !isShortcutsOpen &&
        !isGoToSlideOpen
      ) {
        e.preventDefault();
        setIsGoToSlideOpen(true);
        return;
      }

      // Cmd/Ctrl+F opens the centered finder. Slide search is its default scope.
      if (
        isModKey(e) &&
        !e.shiftKey &&
        e.key.toLowerCase() === "f" &&
        !isPresenting &&
        !isZenMode &&
        !isSettingsOpen &&
        !isCommandOpen &&
        !isShortcutsOpen &&
        !isGoToSlideOpen
      ) {
        e.preventDefault();
        emitOpenSearch();
        return;
      }

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

      // Focus mode / dialogs: Esc handling
      if (e.key === "Escape" && isZenMode) {
        e.preventDefault();
        toggleZenMode();
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

      // Arrow nav in normal/focus mode when not typing
      if (
        (e.key === "ArrowRight" || e.key === "ArrowLeft") &&
        !isTypingTarget(e.target) &&
        !isModKey(e) &&
        !e.altKey &&
        !isSettingsOpen &&
        !isCommandOpen &&
        !isShortcutsOpen &&
        !isGoToSlideOpen
      ) {
        e.preventDefault();
        setIsAutoPlaying(false);
        if (e.key === "ArrowRight") goNext();
        else goPrev();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  });
}
