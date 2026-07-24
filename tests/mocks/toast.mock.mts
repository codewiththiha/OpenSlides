/** Mock of $lib/lib/toast — keeps the notify surface without the toast UI layer. */
export const toastCalls: Array<{
  kind: string;
  msg: string;
  description?: string;
  action?: { label: string; onClick: () => void };
  id?: string | number;
}> = [];

function record(
  kind: string,
  msg: string,
  opts?: {
    description?: string;
    action?: { label: string; onClick: () => void };
    id?: string | number;
  },
) {
  toastCalls.push({ kind, msg, ...opts });
}

export const notify = {
  message: (
    msg: string,
    opts?: {
      description?: string;
      action?: { label: string; onClick: () => void };
      id?: string | number;
    },
  ) => {
    record("message", msg, opts);
  },
  success: (
    msg: string,
    opts?: {
      description?: string;
      action?: { label: string; onClick: () => void };
      id?: string | number;
    },
  ) => {
    record("success", msg, opts);
  },
  error: (
    msg: string,
    opts?: {
      description?: string;
      action?: { label: string; onClick: () => void };
      id?: string | number;
    },
  ) => {
    record("error", msg, opts);
  },
  dismiss: (id?: string | number) => {
    if (id === undefined) {
      toastCalls.length = 0;
      return;
    }
    const index = toastCalls.findIndex((call) => call.id === id);
    if (index >= 0) toastCalls.splice(index, 1);
  },
};
