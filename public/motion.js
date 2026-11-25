const reducedMotion = matchMedia("(prefers-reduced-motion: reduce)");
const easing = "cubic-bezier(0.22, 1, 0.36, 1)";
let pageEntrance;

export function cancelPageEntrance() {
  pageEntrance?.cancel();
  pageEntrance = undefined;
}

export function playPageEntrance(content) {
  if (reducedMotion.matches) return;
  pageEntrance = content.animate?.(
    [
      { opacity: 0.9, transform: "translateY(4px)" },
      { opacity: 1, transform: "none" },
    ],
    { duration: 180, easing, fill: "backwards" },
  );
}

const regionAnimations = new WeakMap();
export function revealUpdate(region) {
  regionAnimations.get(region)?.cancel();
  if (
    reducedMotion.matches ||
    (pageEntrance?.playState === "running" &&
      pageEntrance.effect.target.contains(region))
  )
    return;
  const animation = region.animate?.([{ opacity: 0.82 }, { opacity: 1 }], {
    duration: 120,
    easing,
  });
  if (animation) regionAnimations.set(region, animation);
}
