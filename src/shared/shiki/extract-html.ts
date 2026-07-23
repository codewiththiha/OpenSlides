/**
 * Shiki's codeToHtml wraps the tokens in <pre class="shiki"><code>…</code></pre>.
 * Callers in this app render their own <pre>, so both the worker path and the
 * no-worker fallback strip down to the inner <code> contents identically.
 */
export function extractShikiCodeHtml(html: string): string {
  const match = html.match(/<code[^>]*>([\s\S]*?)<\/code>/);
  return match?.[1] ?? html;
}
