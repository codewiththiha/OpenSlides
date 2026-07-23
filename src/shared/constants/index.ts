import type { Highlight, Slide } from "$lib/types";

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
export const NEW_PRESENTATION_CODE = STARTER_PRESENTATION[0].code;

export type StarterSlideAction = { kind: "append"; slide: StarterSlide };

/** Continue the starter story through slide six, then return to normal Add behavior. */
export function nextStarterSlideAction(slides: readonly Slide[]): StarterSlideAction | null {
  const nextIndex = slides.length;
  const isStarterSequence =
    nextIndex > 0 &&
    nextIndex < STARTER_PRESENTATION.length &&
    slides.every((slide, index) => slide.name === STARTER_PRESENTATION[index]?.name);

  return isStarterSequence
    ? { kind: "append", slide: STARTER_PRESENTATION[nextIndex] }
    : null;
}
