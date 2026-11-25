const reducedMotion = matchMedia("(prefers-reduced-motion: reduce)");
const duration = 210;
const easing = "cubic-bezier(0.22, 1, 0.36, 1)";
let activeTransition;
let fallbackEntrance;

export function changePage(content, update, animate) {
  activeTransition?.skipTransition();
  fallbackEntrance?.cancel();

  if (!animate || reducedMotion.matches) {
    update();
    return;
  }

  if (
    typeof document.startViewTransition === "function" &&
    CSS.supports("view-transition-name", "page-content")
  ) {
    const transition = document.startViewTransition(update);
    activeTransition = transition;
    // A skipped transition still runs its update callback.
    transition.ready.catch(() => {});
    transition.finished.catch(console.error).finally(() => {
      if (activeTransition === transition) activeTransition = undefined;
    });
    return;
  }

  if (update()) {
    fallbackEntrance = content.animate?.(
      [
        { opacity: 0.76, transform: "translateY(6px)" },
        { opacity: 1, transform: "none" },
      ],
      { duration, easing },
    );
  }
}

const regionAnimations = new WeakMap();
export function revealUpdate(region) {
  if (reducedMotion.matches) return;
  regionAnimations.get(region)?.cancel();
  const animation = region.animate?.([{ opacity: 0.82 }, { opacity: 1 }], {
    duration: 120,
    easing,
  });
  if (animation) regionAnimations.set(region, animation);
}
