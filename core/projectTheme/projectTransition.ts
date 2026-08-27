interface ViewTransitionLike {
  skipTransition?: () => void;
  finished?: Promise<unknown>;
}

interface TransitionDocument {
  startViewTransition?: (callback: () => void) => ViewTransitionLike;
}

let activeTransition: ViewTransitionLike | null = null;

export function runProjectContextTransition(
  applyAuthoritativeSelection: () => void,
  options: { document?: Document; reducedMotion?: boolean } = {},
): void {
  const targetDocument = options.document ?? (typeof document === "undefined" ? undefined : document);
  const transitionDocument = targetDocument as unknown as TransitionDocument | undefined;

  try {
    activeTransition?.skipTransition?.();
  } catch {
    // A visual transition can fail; project selection must remain independent.
  }
  activeTransition = null;

  if (options.reducedMotion || !transitionDocument?.startViewTransition) {
    applyAuthoritativeSelection();
    return;
  }

  let selectionApplied = false;
  const applyOnce = () => {
    if (selectionApplied) return;
    selectionApplied = true;
    applyAuthoritativeSelection();
  };

  try {
    const transition = transitionDocument.startViewTransition(applyOnce);
    activeTransition = transition;
    void transition.finished
      ?.catch(() => undefined)
      .finally(() => {
        if (activeTransition === transition) activeTransition = null;
      });
  } catch {
    applyOnce();
  }
}
