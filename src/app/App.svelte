<script lang="ts">
  /**
   * App shell — hash router + global toast viewport.
   *
   * The TanStack Query client needs no provider here: every query/mutation
   * factory receives the singleton `queryClient` explicitly (see
   * src/shared/queries).
   */
  import Router from "svelte-spa-router";
  import AppToaster from "$lib/ui/AppToaster.svelte";
  import { routes } from "./routes";
</script>

<Router {routes} />
<AppToaster />
