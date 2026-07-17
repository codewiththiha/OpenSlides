import type { Project } from "../../types";

export const projectKeys = {
  all: ["projects"] as const,
  detail: (id: string) => ["project", id] as const,
};

export type { Project };
