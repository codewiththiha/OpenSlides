export const projectKeys = {
  all: ["projects"] as const,
  detail: (id: string) => ["project", id] as const,
};
