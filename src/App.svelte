<script lang="ts">
  /**
   * App shell — hash router + global toast viewport.
   *
   * svelte-spa-router is hash-based (it drives `location.hash`), so the app's
   * URLs are identical to the old React HashRouter ones (/#/, /#/editor/:id).
   *
   * The TanStack Query client needs no provider here: every query/mutation
   * factory receives the singleton `queryClient` explicitly (see src/queries).
   */
  import Router from "svelte-spa-router";
  import Dashboard from "./components/Dashboard.svelte";
  import Editor from "./components/Editor.svelte";
  import Redirect from "./components/Redirect.svelte";
  import AppToaster from "./components/ui/AppToaster.svelte";

  const routes = {
    "/": Dashboard,
    "/editor/:projectId": Editor,
    "*": Redirect,
  };
</script>

<Router {routes} />
<AppToaster />
