<script lang="ts">
  /**
   * Redirect — catch-all fallback for unmatched routes. Renders nothing;
   * swaps the hash without touching history, which re-matches the `/`
   * route.
   */
  import { replace } from "svelte-spa-router";

  let { to }: { to?: string } = $props();

  $effect.pre(() => {
    void replace(to ?? "/");
  });
</script>
