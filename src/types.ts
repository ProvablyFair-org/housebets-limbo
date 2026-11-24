// Shapes of the HouseBets new-engine limbo capture (schema housebets-limbo-capture-sp1, rig 12 Oct 2026).
// Only the fields the verifier reads are typed; the dataset carries more (raw answers under `_raw`).

export interface Setting {
  cls: string;
  target: number;     // the chosen target multiplier, 2 decimals
}

export interface Bet {
  idx: number;
  epoch: number;
  nonce: number;
  setting: Setting;
  request: { betNumber: number; amount: number };
  stake: number;
  outcome: number;            // the result multiplier the server answered (2 decimals)
  echoedTarget: number;       // the target the server's answer carries
  payoutMultiplier: number;   // the target on a win, 0 on a loss
  payout: number;
  roundStake: number;
  roundId: string;
  respClientSeed: string;
  respHashedSeed: string;
  fairnessVersion: string;
  _raw: { round?: { roundId: string; stake: string | number; payout: string | number }; game?: { winChance?: number; betNumber?: number; outcome?: number } };
}

export interface Seed {
  seedId: string;
  epoch: number | string;
  clientSeed: string;
  clientSeedSource?: string;
  hashedServerSeed: string;
  hashedNextServerSeed: string;
  revealedServerSeed: string;
  nonceStart: number | string;
  nonceEnd: number | string;
  serverNonceAtRotation: number | string;
}

export interface Dataset {
  meta: { epochSize: number; schema: string; split?: { part: string; epochs: [number, number] } };
  seeds: Seed[];
  bets: Bet[];
}
