import type { Highlight, Slide } from "$lib/types";

// ── App-wide defaults (mirrors src-tauri/src/models.rs) ──────────────
/** Default slide duration in milliseconds. */
export const DEFAULT_SLIDE_DURATION_MS = 3000;
/** Default slide transition duration in milliseconds. */
export const DEFAULT_SLIDE_TRANSITION_MS = 750;
/** Default slide stagger count. */
export const DEFAULT_SLIDE_STAGGER = 5;

// ── Default language / theme ─────────────────────────────────────────
export const DEFAULT_LANGUAGE = "typescript";
export const DEFAULT_THEME = "dark-plus";
export const DEFAULT_IMPORT_PROJECT_NAME = "Imported Presentation";

// ── Project settings defaults (mirror Rust serde defaults) ───────────
export const DEFAULT_FONT_SIZE = 16;
export const DEFAULT_LINE_HEIGHT = 1.5;
export const DEFAULT_EDITOR_FONT_SIZE = 14;
export const DEFAULT_GLOBAL_TRANSITION_DURATION = 700;
export const DEFAULT_GLOBAL_STAGGER = 3;

// ── Highlight defaults ───────────────────────────────────────────────
export const DEFAULT_HIGHLIGHT_DIM_AMOUNT = 75;
export const DEFAULT_GLOBAL_DIM_AMOUNT = 80;
export const DEFAULT_GLOBAL_SIZE_UP_AMOUNT = 105;
export const DEFAULT_HIGHLIGHT_DIM_TRANSITION = 500;
export const DEFAULT_HIGHLIGHT_SIZE_UP_TRANSITION = 600;

// ── Editor ───────────────────────────────────────────────────────────
/** Editor-specific line height (differs from project setting default). */
export const EDITOR_LINE_HEIGHT = 1.55;

// ── Shiki debounce ───────────────────────────────────────────────────
export const SHIKI_DEBOUNCE_MS = 80;

// ── Panel constraints ────────────────────────────────────────────────
export const PANEL_CODE_MIN = 18;
export const PANEL_CODE_MAX = 70;
export const PANEL_SLIDES_MIN = 14;
export const PANEL_SLIDES_MAX = 28;
export const PANEL_CODE_COLLAPSED_SIZE = 3.5;
export const PANEL_SLIDES_COLLAPSED_SIZE = 6;

// ── Slider constraints ───────────────────────────────────────────────
export const SLIDER_TRANSITION = { min: 100, max: 2000, step: 50 } as const;
export const SLIDER_DURATION = { min: 500, max: 10000, step: 100 } as const;
export const SLIDER_STAGGER = { min: 0, max: 50, step: 1 } as const;
export const SLIDER_SIZE_UP_AMOUNT = { min: 100, max: 250, step: 5 } as const;
export const SLIDER_DIM_AMOUNT = { min: 0, max: 100, step: 5 } as const;

type StarterSlide = {
  name: string;
  code: string;
  highlights: Highlight[];
};

const focus = (
  id: string,
  line: number,
  startChar: number,
  endChar: number,
): Highlight => ({
  id,
  startLine: line,
  startChar,
  endLine: line,
  endChar,
  dimAmount: 72,
  sizeUpEnabled: true,
  sizeUpAmount: 130,
  useCustomTransition: false,
  dimTransition: 500,
  sizeUpTransition: 600,
});

/**
 * An original six-slide TypeScript story. Each slide reshapes the same idea
 * so Magic Move has meaningful changes to animate instead of simple additions.
 */
const STARTER_PRESENTATION: readonly StarterSlide[] = [
  {
    name: "1. Open with an idea",
    code: `// Every presentation starts with one clear idea.
const opening = "Make code memorable";

console.log(opening);`,
    highlights: [],
  },
  {
    name: "2. Make the idea reusable",
    code: `// Turn the idea into something we can reuse.
const makeOpening = (topic: string) => {
  return \`Make ${"${topic}"} memorable\`;
};

console.log(makeOpening("code"));`,
    highlights: [],
  },
  {
    name: "3. Grow it into a sequence",
    code: `// One idea becomes a sequence for the audience.
const makeOpening = (topic: string) => \`Make ${"${topic}"} memorable\`;
const topics = ["code", "ideas", "talks"];

const openings = topics.map(makeOpening);
console.log(openings);`,
    highlights: [],
  },
  {
    name: "4. Bring in live content",
    code: `type Topic = { name: string };

const loadTopics = async (): Promise<Topic[]> => {
  const response = await Promise.resolve([
    { name: "code" },
    { name: "ideas" },
    { name: "talks" },
  ]);

  return response;
};`,
    highlights: [],
  },
  {
    name: "5. Shape the deck",
    code: `type Topic = { name: string };

const loadTopics = async (): Promise<Topic[]> => {
  return [{ name: "code" }, { name: "ideas" }, { name: "talks" }];
};

const createDeck = async () => {
  const topics = await loadTopics();
  const slides = topics.map(({ name }) => \`Make ${"${name}"} memorable\`);

  return slides;
};`,
    highlights: [
      focus("starter-5-topics", 7, 2, 36),
      focus("starter-5-slides", 8, 2, 68),
    ],
  },
  {
    name: "6. Present the result",
    code: `type Topic = { name: string };

const loadTopics = async (): Promise<Topic[]> => {
  return [{ name: "code" }, { name: "ideas" }, { name: "talks" }];
};

const createDeck = async () => {
  const topics = await loadTopics();
  return topics.map(({ name }) => \`Make ${"${name}"} memorable\`);
};

const present = async () => {
  const slides = await createDeck();
  console.table(slides);
};

void present();`,
    highlights: [
      focus("starter-6-deck", 12, 2, 36),
      focus("starter-6-output", 13, 2, 23),
    ],
  },
] as const;

/** The first starter slide is created with every new presentation. */
export const NEW_PRESENTATION_CODE = STARTER_PRESENTATION[0]!.code;

export type StarterSlideAction = { kind: "append"; slide: StarterSlide };

/** Continue the starter story through slide six, then return to normal Add behavior. */
export function nextStarterSlideAction(
  slides: readonly Slide[],
): StarterSlideAction | null {
  const nextIndex = slides.length;
  const isStarterSequence =
    nextIndex > 0 &&
    nextIndex < STARTER_PRESENTATION.length &&
    slides.every(
      (slide, index) => slide.name === STARTER_PRESENTATION[index]?.name,
    );

  return isStarterSequence
    ? { kind: "append", slide: STARTER_PRESENTATION[nextIndex]! }
    : null;
}
