/** Mock of src/lib/shiki-instance — bundling real shiki breaks the suite's
 *  weight budget; CodeEditor tolerates null (plain-escape path). */
export function getHighlighter(): Promise<null> {
  return Promise.resolve(null);
}
