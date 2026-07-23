import { getContext, setContext } from "svelte";

/**
 * Dashboard card actions, shared via context (§2.1): the Dashboard provides
 * one stable API object and ProjectCard consumers read it, instead of every
 * card receiving a dozen callback props through three levels of markup.
 *
 * Readonly fields are getter-backed, so consumers track the live values
 * (rename text, busy flags) without the context value itself being replaced.
 */
export type ProjectCardActions = {
  readonly renamingId: string | null;
  readonly renameValue: string;
  readonly duplicateBusy: boolean;
  readonly commitBusy: boolean;
  setRenameValue: (value: string) => void;
  commitRename: () => void;
  cancelRename: () => void;
  startRename: (id: string, name: string) => void;
  open: (id: string) => void;
  duplicate: (id: string) => void;
  exportProject: (id: string) => void;
  remove: (id: string, name: string) => void;
};

const KEY = Symbol("project-card-actions");

export function provideProjectCardActions(actions: ProjectCardActions): void {
  setContext(KEY, actions);
}

export function consumeProjectCardActions(): ProjectCardActions {
  return getContext<ProjectCardActions>(KEY);
}
