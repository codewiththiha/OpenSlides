import { Loader2 } from "lucide-react";
import { Button } from "../ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../ui/card";
import { Input } from "../ui/input";

export function CreateProjectCard({ name, onNameChange, onCreate, onCancel, isPending }: { name: string; onNameChange: (value: string) => void; onCreate: () => void; onCancel: () => void; isPending: boolean }) {
  return <Card className="mb-6 border-primary/30"><CardHeader className="pb-3"><CardTitle className="text-base">New presentation</CardTitle><CardDescription>Give your presentation a name to get started.</CardDescription></CardHeader><CardContent className="flex flex-col gap-3 sm:flex-row"><Input autoFocus value={name} onChange={(e) => onNameChange(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") onCreate(); if (e.key === "Escape") onCancel(); }} placeholder="Untitled Presentation" /><div className="flex gap-2"><Button onClick={onCreate} disabled={isPending}>{isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Create"}</Button><Button variant="ghost" onClick={onCancel}>Cancel</Button></div></CardContent></Card>;
}
