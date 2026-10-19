import { useActionState } from 'react';

type Result = { error: string } | { ok: string } | null;

/** useActionState plus what to do once the action succeeds: close the sheet, clear the form. */
export function useFormAction<S extends Result>(
  action: (prev: S, fd: FormData) => Promise<S>,
  onOk: (fd: FormData) => void,
) {
  return useActionState<S, FormData>(async (prev, fd) => {
    const res = await action(prev, fd);
    if (res && 'ok' in res) onOk(fd);
    return res;
  }, null as Awaited<S>);
}
