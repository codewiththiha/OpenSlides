import { FileCode } from "lucide-react";
import { useSlideThumbnail } from "@/hooks/useSlideThumbnail";
import { type ProjectSummary } from "@/types";
import { CodeThumbnail } from "../ui/code-thumbnail";

export function ProjectThumb({ project }: { project: ProjectSummary }) {
  const thumb = useSlideThumbnail({
    slideId: project.firstSlideId || project.id,
    code: project.firstSlideCode,
    theme: project.theme,
    language: project.language,
    initialHtml: project.firstSlideThumbnail || undefined,
  });
  return (
    <CodeThumbnail
      containerRef={thumb.ref}
      html={thumb.html}
      theme={project.theme}
      fontSize={3.5}
      lineHeight={1.3}
      className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-border/60"
      fallback={<FileCode className="h-4 w-4 text-primary" />}
    />
  );
}
