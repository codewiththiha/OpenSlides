import { FileCode } from "lucide-react";
import { useSlideThumbnail } from "@/hooks/useSlideThumbnail";
import { type ProjectSummary } from "@/types";
import { CodeThumbnail } from "../ui/code-thumbnail";
import { cn } from "@/lib/utils";

export function ProjectThumb({
  project,
  className,
  codeClassName,
  fontSize = 5.5,
}: {
  project: ProjectSummary;
  className?: string;
  codeClassName?: string;
  fontSize?: number;
}) {
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
      fontSize={fontSize}
      lineHeight={1.3}
      className={cn("relative w-full overflow-hidden", className)}
      codeClassName={codeClassName}
      fallback={<FileCode className="h-5 w-5 text-primary" />}
    />
  );
}
