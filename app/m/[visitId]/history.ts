// ---------------------------------------------------------------------------
// Where the customer is lives in the URL (?v=menu the whole menu, ?d= dish,
// ?o= order, ?i= Design B's index), pushed with history.pushState so the phone's Back button
// closes a sheet or goes back home instead of leaving the menu.
// `pushed` counts the entries this page added, so a close button knows
// whether Back is safe or would leave the page.
let pushed = 0;

/** The phone's Back took one of ours off. */
export function notePop() {
  pushed = Math.max(0, pushed - 1);
}

export function setParams(mutate: (p: URLSearchParams) => void, mode: "push" | "replace") {
  const p = new URLSearchParams(window.location.search);
  mutate(p);
  const qs = p.toString();
  const url = window.location.pathname + (qs ? `?${qs}` : "");
  if (mode === "push") {
    pushed++;
    window.history.pushState(null, "", url);
  } else {
    window.history.replaceState(null, "", url);
  }
}

/** Undo the last thing opened: Back if we added it, otherwise drop the param. */
export function closeParam(key: string) {
  if (pushed > 0) window.history.back();
  else setParams((p) => p.delete(key), "replace");
}
