import type { Highlight, Slide } from "./types";

export const NEW_PRESENTATION_CODE = `// Welcome to OpenSlides
// Feedback: @codewiththiha
function greet() {
  console.log("Hi, Mom!");
}`;

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

/** A connected, presentation-ready TypeScript story for a new deck. */
export const STARTER_PRESENTATION: readonly StarterSlide[] = [
  {
    name: "1. Start with an idea",
    code: `type Talk = {
  title: string;
  minutes: number;
};`,
    highlights: [],
  },
  {
    name: "2. Give the idea data",
    code: `type Talk = {
  title: string;
  minutes: number;
};

const talk: Talk = {
  title: "Make code memorable",
  minutes: 12,
};`,
    highlights: [],
  },
  {
    name: "3. Turn data into a message",
    code: `type Talk = {
  title: string;
  minutes: number;
};

const talk: Talk = {
  title: "Make code memorable",
  minutes: 12,
};

function formatTalk(talk: Talk) {
  return \`\${talk.title} · \${talk.minutes} min\`;
}`,
    highlights: [],
  },
  {
    name: "4. Make it personal",
    code: `type Talk = {
  title: string;
  minutes: number;
};

const talk: Talk = {
  title: "Make code memorable",
  minutes: 12,
};

function formatTalk(talk: Talk, audience = "creators") {
  return \`For \${audience}: \${talk.title} · \${talk.minutes} min\`;
}`,
    highlights: [],
  },
  {
    name: "5. Build the story",
    code: `type Talk = {
  title: string;
  minutes: number;
};

const talk: Talk = {
  title: "Make code memorable",
  minutes: 12,
};

function formatTalk(talk: Talk, audience = "creators") {
  const duration = \`\${talk.minutes} min\`;
  const message = \`For \${audience}: \${talk.title}\`;
  return \`\${message} (\${duration})\`;
}`,
    highlights: [
      focus("starter-5-duration", 11, 2, 42),
      focus("starter-5-message", 12, 2, 56),
    ],
  },
  {
    name: "6. Deliver the message",
    code: `type Talk = {
  title: string;
  minutes: number;
};

const talk: Talk = {
  title: "Make code memorable",
  minutes: 12,
};

function formatTalk(talk: Talk, audience = "creators") {
  const duration = \`\${talk.minutes} min\`;
  const message = \`For \${audience}: \${talk.title}\`;
  return \`\${message} (\${duration})\`;
}

console.log(formatTalk(talk));`,
    highlights: [
      focus("starter-6-return", 13, 2, 34),
      focus("starter-6-output", 16, 0, 29),
    ],
  },
] as const;

export type StarterSlideAction =
  | { kind: "replace"; slide: StarterSlide }
  | { kind: "append"; slide: StarterSlide };

/**
 * The first Add turns the untouched welcome slide into slide one. Each next
 * Add continues the story; ordinary slide creation resumes after slide six.
 */
export function nextStarterSlideAction(slides: readonly Slide[]): StarterSlideAction | null {
  if (slides.length === 1 && slides[0]?.code === NEW_PRESENTATION_CODE) {
    return { kind: "replace", slide: STARTER_PRESENTATION[0] };
  }

  const nextIndex = slides.length;
  const isStarterSequence =
    nextIndex > 0 &&
    nextIndex < STARTER_PRESENTATION.length &&
    slides.every((slide, index) => slide.name === STARTER_PRESENTATION[index]?.name);

  if (isStarterSequence) {
    return { kind: "append", slide: STARTER_PRESENTATION[nextIndex] };
  }

  return null;
}
