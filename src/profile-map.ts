// The LIMBO profile's 31 checks (id, name, layer, kind, policy), generated from the framework's games/limbo/profile.public.json
// (profileVersion 1.0.4-public, framework 1.1, sha256 c5a7be5e09e5c94846e19e7c9b6619e358d005c5c0614bdacdc697e59abbb530). Regenerate rather than edit.
export type Policy = 'HARD_FAIL' | 'FLAG' | 'INFORMATIONAL' | 'GRADED' | 'RELEASE_GATE';
export interface ProfileCheck { id: string; name: string; layer: string; kind: 'verifier-step' | 'package-check'; policy: Policy }
export const PROFILE_SHA256 = 'c5a7be5e09e5c94846e19e7c9b6619e358d005c5c0614bdacdc697e59abbb530';
export const PROFILE_VERSION = "1.0.4-public";
export const PROFILE: readonly ProfileCheck[] = [
  { id: "LIMBO-01", name: "Seed hash integrity", layer: "S1", kind: "verifier-step", policy: "HARD_FAIL" },
  { id: "LIMBO-02", name: "Forward commitment chain", layer: "S1", kind: "verifier-step", policy: "HARD_FAIL" },
  { id: "LIMBO-03", name: "Hash consistency within epoch", layer: "S1", kind: "verifier-step", policy: "HARD_FAIL" },
  { id: "LIMBO-04", name: "Nonce continuity", layer: "S1", kind: "verifier-step", policy: "HARD_FAIL" },
  { id: "LIMBO-05", name: "Population & epoch size (G-BIND)", layer: "S1", kind: "verifier-step", policy: "HARD_FAIL" },
  { id: "LIMBO-06", name: "Client-seed influence & Phase D recomputation", layer: "S1", kind: "verifier-step", policy: "HARD_FAIL" },
  { id: "LIMBO-07", name: "Result recomputation", layer: "S2", kind: "verifier-step", policy: "HARD_FAIL" },
  { id: "LIMBO-08", name: "Draw bias bound", layer: "S2", kind: "verifier-step", policy: "HARD_FAIL" },
  { id: "LIMBO-09", name: "RNG reference vectors", layer: "S2", kind: "package-check", policy: "GRADED" },
  { id: "LIMBO-10", name: "Result range & win rule", layer: "S2", kind: "verifier-step", policy: "HARD_FAIL" },
  { id: "LIMBO-11", name: "Payout arithmetic", layer: "S3", kind: "verifier-step", policy: "HARD_FAIL" },
  { id: "LIMBO-12", name: "Bet-size invariance (Phase C)", layer: "S3", kind: "verifier-step", policy: "HARD_FAIL" },
  { id: "LIMBO-13", name: "Payout multiplier & edge placement provenance", layer: "S3", kind: "verifier-step", policy: "HARD_FAIL" },
  { id: "LIMBO-14", name: "Target bounds & maximum payout", layer: "S3", kind: "verifier-step", policy: "FLAG" },
  { id: "LIMBO-15", name: "Target coverage", layer: "S3", kind: "verifier-step", policy: "FLAG" },
  { id: "LIMBO-16", name: "Wallet / balance reconciliation", layer: "S3", kind: "verifier-step", policy: "FLAG" },
  { id: "LIMBO-17", name: "Boundary semantics: tie, result floor & cap", layer: "S3", kind: "verifier-step", policy: "HARD_FAIL" },
  { id: "LIMBO-18", name: "Anti-circularity (win probability)", layer: "S4", kind: "verifier-step", policy: "HARD_FAIL" },
  { id: "LIMBO-19", name: "Effective edge across the legal target grid vs claim", layer: "S4", kind: "verifier-step", policy: "FLAG" },
  { id: "LIMBO-20", name: "Simulation Pass 1 (fresh seeds)", layer: "S4", kind: "verifier-step", policy: "HARD_FAIL" },
  { id: "LIMBO-21", name: "Simulation Pass 2 (cherry-pick)", layer: "S4", kind: "verifier-step", policy: "HARD_FAIL" },
  { id: "LIMBO-22", name: "Live-sample fit", layer: "S4", kind: "verifier-step", policy: "INFORMATIONAL" },
  { id: "LIMBO-23", name: "S5 fairness-integrity matrix", layer: "S5", kind: "package-check", policy: "GRADED" },
  { id: "LIMBO-24", name: "Player-verifier parity", layer: "S6", kind: "package-check", policy: "GRADED" },
  { id: "LIMBO-25", name: "Player check path documented", layer: "S6", kind: "package-check", policy: "GRADED" },
  { id: "LIMBO-26", name: "Dataset & config pins", layer: "S7", kind: "verifier-step", policy: "HARD_FAIL" },
  { id: "LIMBO-27", name: "Artifacts of record", layer: "S7", kind: "verifier-step", policy: "HARD_FAIL" },
  { id: "LIMBO-28", name: "Fresh-clone reproduction", layer: "S7", kind: "package-check", policy: "RELEASE_GATE" },
  { id: "LIMBO-29", name: "Mutation battery", layer: "S7", kind: "package-check", policy: "GRADED" },
  { id: "LIMBO-30", name: "Disclosure register & evidence appendix", layer: "S7", kind: "package-check", policy: "GRADED" },
  { id: "LIMBO-31", name: "Scaling edge (stake- or exposure-dependent edge)", layer: "S3", kind: "verifier-step", policy: "HARD_FAIL" },
];
