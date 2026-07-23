import { themeBackground } from "$lib/lib/themes";

/**
 * The gradient chrome shared by code cards (slide cards, project cards):
 * a solid theme-colored top/bottom band that fades out over the code
 * preview. Theme backgrounds are six-digit hex values; the alpha suffix
 * keeps the fades visually connected to the code preview.
 */
export function createCodeCardTheme(theme: () => string) {
  const background = $derived(themeBackground(theme()));
  const soft = $derived(`${background}e0`);
  const topGradient = $derived(
    `linear-gradient(to bottom, ${background} 0%, ${soft} 45%, transparent 100%)`,
  );
  const bottomGradient = $derived(
    `linear-gradient(to top, ${background} 0%, ${soft} 48%, transparent 100%)`,
  );

  return {
    get background() {
      return background;
    },
    get soft() {
      return soft;
    },
    get topGradient() {
      return topGradient;
    },
    get bottomGradient() {
      return bottomGradient;
    },
  };
}
