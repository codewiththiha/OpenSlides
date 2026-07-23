/**
 * Route table for the hash router — svelte-spa-router drives
 * `location.hash`, so the app's URLs are /#/ and /#/editor/:projectId.
 */
import Dashboard from "@/features/dashboard/Dashboard.svelte";
import Editor from "@/features/editor/Editor.svelte";
import Redirect from "$lib/components/Redirect.svelte";

export const routes = {
  "/": Dashboard,
  "/editor/:projectId": Editor,
  "*": Redirect,
};
