/* WhyKnot Principles & Puns.
   Tactile knot craft, human curiosity, and healthy sarcasm about modern web bloat. */

export const KNOT_PUNS = [
    "Why knot? Because the web is already tangled enough.",
    "Untangling the web, one clean site at a time.",
    "No strings attached. Well, maybe just this one.",
    "Knot another generic AI wrapper directory.",
    "Tied with care. (Unlike that DNS record you set at 2 AM).",
    "Fewer 40MB hero videos, more actual craft.",
    "If you can't tie a good knot, at least write clean HTML.",
    "A tight knot holds better than a pitch deck.",
    "Curiosity untangles what certainty leaves locked.",
    "Built by humans who still remember when the web was fun.",
    "Zero sponsored score boosts. Knot on our watch.",
    "Tied by hand, inspected by machine, verified by humans."
] as const;

export type KnotPun = (typeof KNOT_PUNS)[number];

/** Deterministic pick so SSR and hydration agree; pass any seed string. */
export function knotPun(seed = "whyknot"): KnotPun {
    let hash = 0;
    for (let i = 0; i < seed.length; i += 1) {
        hash = (hash * 31 + seed.charCodeAt(i)) >>> 0;
    }
    return KNOT_PUNS[hash % KNOT_PUNS.length];
}

/** Console signature, celebrating human curiosity without em-dashes. */
export const KNOT_CONSOLE_EGG = [
    "%cWhyKnot",
    "You opened the developer console. Our kind of curious.",
    "Try typing \"knot\" anywhere on the page, then pull gently.",
    "Tied together by the WhyKnot crew (humans, mostly untangled)."
].join("\n");
