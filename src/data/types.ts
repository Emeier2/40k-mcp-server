export interface UnitStats {
  M: string;
  T: number;
  Sv: string;
  W: number;
  Ld: string;
  OC: number;
}

export interface Weapon {
  name: string;
  range: string;
  A: string | number;
  BS?: string;
  WS?: string;
  S: number;
  AP: string;
  D: string | number;
  keywords: string[];
}

export interface Ability {
  name: string;
  description: string;
}

export interface PointsCost {
  models: number;
  points: number;
}

export interface DegradingProfile {
  remainingWounds: string;
  stats: Partial<UnitStats>;
}

export interface Unit {
  name: string;
  faction: string;
  keywords: string[];
  factionKeywords: string[];
  stats: UnitStats;
  invulnerableSave: string | null;
  rangedWeapons: Weapon[];
  meleeWeapons: Weapon[];
  abilities: {
    faction: string[];
    core: string[];
    unit: Ability[];
  };
  composition: {
    min: number;
    max: number;
    description: string;
  };
  points: PointsCost[];
  leader: Ability | null;
  leaderAttachableTo: string[] | null;
  unitCategory: string;
  degradingProfiles?: DegradingProfile[];
}

export interface Stratagem {
  name: string;
  detachment: string;
  cpCost: number;
  type: string;
  when: string;
  target: string;
  effect: string;
  restrictions: string | null;
}

export interface Enhancement {
  name: string;
  detachment: string;
  pointsCost: number;
  restrictions: string;
  effect: string;
}

export interface Detachment {
  name: string;
  ruleName: string;
  ruleText: string;
}

export interface FactionRule {
  name: string;
  text: string;
}

export interface GameData {
  units: Unit[];
  stratagems: Stratagem[];
  enhancements: Enhancement[];
  detachments: Detachment[];
  factionRules: FactionRule[];
}
