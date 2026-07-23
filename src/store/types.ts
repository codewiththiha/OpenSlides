/** Shared store types — imported by the rune store and consumers. */

export type PreviewProjectSettings = {
  theme?: string;
  useBlackCodeBackground?: boolean;
  fontSize?: number;
  lineHeight?: number;
  editorFontSize?: number;
  globalTransitionDuration?: number;
  globalStagger?: number;
};

export type PreviewSlideSettings = {
  transitionDuration?: number;
  stagger?: number;
  duration?: number;
};

export type SaveStatus = "idle" | "saving" | "saved" | "error";
