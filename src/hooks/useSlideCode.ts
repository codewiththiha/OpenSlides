import { useLocalCodeAtom } from "@/store/localCodeAtoms";

export function useSlideCode(
  slideId: string | undefined,
  fallbackCode = "",
): string {
  const override = useLocalCodeAtom(slideId);
  return override ?? fallbackCode;
}
