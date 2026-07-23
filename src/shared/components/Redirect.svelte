<script lang="ts">
  /**
   * Redirect — svelte-spa-router equivalent of react-router's
   * `<Navigate to="/" replace />` catch-all. Renders nothing; swaps the
   * hash without touching history, which re-matches the `/` route.
   */
  import { replace } from "svelte-spa-router";

  let { to }: { to?: string } = $props();

  $effect.pre(() => {
    void replace(to ?? "/");
  });
</script>
