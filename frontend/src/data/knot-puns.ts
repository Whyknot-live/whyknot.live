/* WhyKnot Principles & Maxims.
   A blend of tactile knot craft, human curiosity, and cinematic architectural discipline.
   Sentences avoid em-dashes to maintain clean, direct phrasing. */

export const KNOT_PUNS = [
    "Every thread counts when you build under tension.",
    "Friction holds what intention creates.",
    "A clean knot holds without ceremony.",
    "Tied by hand, inspected by machine, verified by humans.",
    "Noise is cheap. Signal requires discipline.",
    "You cannot fake a tight knot under load.",
    "The web was built by curious hands. Keep the weave tight.",
    "Precision under tension: craft is what withstands the load.",
    "A single loose thread compromises the whole rig.",
    "Structure endures when execution meets intention.",
    "Gravity pulls downward. Good design pulls back.",
    "Pull the thread gently. Sound work never unravels.",
    "Four metrics, one verdict, zero shortcuts.",
    "Curiosity untangles what certainty leaves locked."
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
    "%cWhyKnot 🪢",
    "You opened the developer console. Our kind of curious.",
    "Try typing \"knot\" anywhere on the page, then pull gently.",
    "Tied together by the WhyKnot crew (humans, mostly untangled)."
].join("\n");
