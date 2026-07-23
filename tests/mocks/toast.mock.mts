/** Mock of $lib/lib/toast — keeps the notify surface without the toast UI layer. */
export const toastCalls: Array<{ kind: string; msg: string }> = [];
export const notify = {
  success: (msg: string) => {
    toastCalls.push({ kind: "success", msg });
  },
  error: (msg: string) => {
    toastCalls.push({ kind: "error", msg });
  },
};
