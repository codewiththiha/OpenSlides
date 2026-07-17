/**
 * Project dashboard — lists SQLite-backed projects via TanStack Query.
 */
import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Plus,
  FolderOpen,
  Trash2,
  FileCode,
  ArrowRight,
  Loader2,
  Download,
  Command as CommandIcon,
} from "lucide-react";
import { Button } from "./ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "./ui/card";
import { Input } from "./ui/input";
import { TitleBar } from "./TitleBar";
import { CommandPalette } from "./CommandPalette";
import {
  useProjects,
  useCreateProject,
  useDeleteProject,
  useExportProject,
} from "@/hooks/useProjectQueries";
import { formatRelative } from "@/lib/utils";
import { useUiStore } from "@/store/useUiStore";
import { useAppMenu } from "@/hooks/useAppMenu";
import { modKeyLabel } from "@/lib/platform";
import { getCurrentWindow } from "@tauri-apps/api/window";

export function Dashboard() {
  const navigate = useNavigate();
  const { data: projects = [], isLoading, isError, error } = useProjects();
  const createMutation = useCreateProject();
  const deleteMutation = useDeleteProject();
  const exportMutation = useExportProject();
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState("Untitled Deck");
  const { setIsCommandOpen, isDarkUi, setIsDarkUi } = useUiStore();

  useEffect(() => {
    document.title = "OpenSlides — Projects";
    getCurrentWindow()
      .setTitle("OpenSlides — Projects")
      .catch(() => undefined);
  }, []);

  const handleCreate = async (name?: string) => {
    try {
      const project = await createMutation.mutateAsync(
        (name ?? newName).trim() || "Untitled Deck",
      );
      setCreating(false);
      setNewName("Untitled Deck");
      navigate(`/editor/${project.id}`);
    } catch {
      /* toast handled in mutation */
    }
  };

  const toggleTheme = useCallback(() => {
    const next = !isDarkUi;
    setIsDarkUi(next);
    document.documentElement.classList.toggle("dark", next);
    document.documentElement.classList.toggle("light", !next);
  }, [isDarkUi, setIsDarkUi]);

  const menuHandlers = useMemo(
    () => ({
      "menu://new-project": () => setCreating(true),
      "menu://open-dashboard": () => navigate("/"),
      "menu://command-palette": () => setIsCommandOpen(true),
      "menu://toggle-theme": () => toggleTheme(),
      "menu://export": () => {
        if (projects[0]) exportMutation.mutate(projects[0].id);
      },
    }),
    [navigate, setIsCommandOpen, toggleTheme, projects, exportMutation],
  );
  useAppMenu(menuHandlers);

  const mod = modKeyLabel();

  return (
    <div className="flex h-full flex-col bg-background">
      <TitleBar
        leading={
          <div className="flex items-center gap-2">
            <div className="flex h-6 w-6 items-center justify-center rounded-md bg-primary/15 text-[10px] font-bold text-primary">
              OS
            </div>
            <span className="text-sm font-semibold">OpenSlides</span>
          </div>
        }
        trailing={
          <>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              title={`Command palette (${mod}K)`}
              onClick={() => setIsCommandOpen(true)}
            >
              <CommandIcon className="h-3.5 w-3.5" />
            </Button>
            <Button onClick={() => setCreating(true)} className="gap-2" size="sm">
              <Plus className="h-4 w-4" />
              New Project
            </Button>
          </>
        }
      />

      <div className="flex-1 overflow-auto">
        <div className="mx-auto max-w-7xl px-6 py-8 pb-12">
          <div className="mb-8 flex items-end justify-between gap-4">
            <div>
              <h1 className="text-3xl font-bold tracking-tight">Your Decks</h1>
              <p className="mt-1 text-sm text-muted-foreground">
                Offline-first code presentations · stored in SQLite
              </p>
            </div>
          </div>

          {creating && (
            <Card className="mb-6 border-primary/30">
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Create project</CardTitle>
                <CardDescription>Give your deck a name to get started.</CardDescription>
              </CardHeader>
              <CardContent className="flex flex-col gap-3 sm:flex-row">
                <Input
                  autoFocus
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") void handleCreate();
                    if (e.key === "Escape") setCreating(false);
                  }}
                  placeholder="Untitled Deck"
                />
                <div className="flex gap-2">
                  <Button onClick={() => void handleCreate()} disabled={createMutation.isPending}>
                    {createMutation.isPending ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      "Create"
                    )}
                  </Button>
                  <Button variant="ghost" onClick={() => setCreating(false)}>
                    Cancel
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}

          {isLoading && (
            <div className="flex items-center justify-center py-24 text-muted-foreground">
              <Loader2 className="mr-2 h-5 w-5 animate-spin" />
              Loading projects…
            </div>
          )}

          {isError && (
            <div className="rounded-xl border border-destructive/40 bg-destructive/10 p-6 text-sm text-destructive">
              Failed to load projects: {(error as Error).message}
            </div>
          )}

          {!isLoading && !isError && projects.length === 0 && (
            <div className="flex flex-col items-center justify-center rounded-2xl border-2 border-dashed border-muted bg-muted/20 py-24 text-center">
              <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-muted">
                <FolderOpen className="h-8 w-8 text-muted-foreground" />
              </div>
              <h2 className="mb-2 text-xl font-semibold">No projects yet</h2>
              <p className="mb-5 max-w-sm text-muted-foreground">
                Create your first presentation. Everything is saved offline in a local SQLite
                database managed by Rust.
              </p>
              <Button onClick={() => setCreating(true)} className="gap-2">
                <Plus className="h-4 w-4" />
                Create Project
              </Button>
            </div>
          )}

          {!isLoading && projects.length > 0 && (
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
              {projects.map((project) => (
                <Card
                  key={project.id}
                  className="group cursor-pointer transition-all duration-200 hover:-translate-y-0.5 hover:border-primary/50 hover:shadow-lg"
                  onClick={() => navigate(`/editor/${project.id}`)}
                >
                  <CardHeader className="pb-3">
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-2.5">
                        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10">
                          <FileCode className="h-4 w-4 text-primary" />
                        </div>
                        <div>
                          <CardTitle className="text-base font-semibold">
                            {project.name}
                          </CardTitle>
                          <CardDescription className="text-xs">
                            {project.slideCount} slide
                            {project.slideCount !== 1 ? "s" : ""}
                          </CardDescription>
                        </div>
                      </div>
                      <div className="flex gap-1 opacity-0 transition-opacity group-hover:opacity-100">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8"
                          title="Export JSON"
                          onClick={(e) => {
                            e.stopPropagation();
                            exportMutation.mutate(project.id);
                          }}
                        >
                          <Download className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 hover:bg-destructive/10 hover:text-destructive"
                          onClick={(e) => {
                            e.stopPropagation();
                            if (
                              confirm(
                                `Delete “${project.name}”? This cannot be undone.`,
                              )
                            ) {
                              deleteMutation.mutate(project.id);
                            }
                          }}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="pb-3">
                    <span className="rounded-md bg-muted px-2 py-1 text-xs font-medium text-foreground/70">
                      {project.theme}
                    </span>
                  </CardContent>
                  <CardFooter className="flex items-center justify-between pt-0">
                    <span className="text-xs text-muted-foreground">
                      Updated {formatRelative(project.updatedAt)}
                    </span>
                    <ArrowRight className="h-4 w-4 text-muted-foreground transition-transform group-hover:translate-x-1" />
                  </CardFooter>
                </Card>
              ))}
            </div>
          )}
        </div>
      </div>

      <CommandPalette />
    </div>
  );
}
