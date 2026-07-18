/** Mock of src/lib/toast — the real one pulls in sonner/React components. */
export const toastCalls: Array<{ kind: string; msg: string }> = [];
export const notify = {
  success: (msg: string) => {
    toastCalls.push({ kind: "success", msg });
  },
  error: (msg: string) => {
    toastCalls.push({ kind: "error", msg });
  },
};
