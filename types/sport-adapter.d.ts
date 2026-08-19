export type ScoreModel = 'cumulative' | 'period';

export interface ScoreAction {
  label: string;
  value: number;
}

export interface SportPosition {
  code: string;
  name: string;
  group: string;
  /** Playing-surface coordinate from 0–100. */
  x: number;
  /** Playing-surface coordinate from 0–100. */
  y: number;
}

export interface SportLayoutSlot {
  /** Unique assignment key within one layout. */
  key: string;
  /** Registered roster/development position represented by this slot. */
  roleCode: string;
  label: string;
  x: number;
  y: number;
}

export interface SportLayout {
  key: string;
  label: string;
  slots: SportLayoutSlot[];
}

export interface SportUnit {
  key: string;
  label: string;
  positions: SportPosition[];
  layouts: SportLayout[];
  defaultLayoutKey: string;
}

export interface SportCapabilities {
  roster: true;
  availability: true;
  schedule: true;
  weather: true;
  practice: true;
  development: true;
  learning: true;
  lineupSurface: true;
  rotationPlanning: true;
  gameDay: true;
  attendance: true;
  score: true;
  substitutions: true;
  documents: boolean;
  messaging: boolean;
  forms: boolean;
  sequenceOrder: boolean;
  pitchTracking: boolean;
  multiUnit: boolean;
}

export interface SportDrill {
  id: string;
  title: string;
  minutes: number;
  category: string;
  focus: string;
  equipment: string;
  steps: string[];
}

export interface SportLesson {
  title: string;
  where: string;
  responsibilities: string[];
  skills: string[];
  tip: string;
}

export interface SportAdapter {
  readonly adapterVersion: 2;
  readonly key: string;
  readonly name: string;
  readonly emoji: string;
  readonly surface: 'diamond' | 'pitch' | 'court' | 'gridiron' | 'volleyball';
  readonly defaultPeriods: number;
  readonly period: { singular: string; plural: string };
  readonly sides: string[];
  readonly scoreModel: ScoreModel;
  readonly scoreActions: ScoreAction[];
  readonly units: SportUnit[];
  readonly defaultUnitKey: string;
  readonly restrictedRotationPositions: string[];
  readonly positionAliases: Record<string, string[]>;
  readonly capabilities: SportCapabilities;
  readonly sequence: null | { label: string; verb: string };
  readonly developmentSkills: Array<[string, string]>;
  readonly lessons: Record<string, SportLesson>;
  readonly drills: SportDrill[];
  readonly skillDrillMap?: Record<string, string[]>;
  readonly learningTracks: string[];
  readonly ruleSets: string[];
  readonly practiceTemplate: Array<[string, number, string]>;
}
