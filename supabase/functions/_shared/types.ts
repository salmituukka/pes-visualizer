// ============================================================================
// Raakadata Pesistulokset-API:sta
// /online/{match_id}/events
// ============================================================================

export interface RawEventsResponse {
  events: RawEvent[];
  finished: boolean;
  period: number | null;
  inning: number | null;
  team: number | null;
  bat_turn: number | null;
}

export interface RawEvent {
  id: number;
  groupType: 'o' | 'he' | 'm' | 'doc' | 't' | 'n' | 'is';
  period: number | null;
  inning: number | null;
  batTurn: number | null;
  team: number | null;
  hTeam: number | null;
  batter: number | null;
  pairIndex: number | null;
  hitNumber: number | null;
  hit: RawHit | null;
  timestamp: number | null;
  events: RawSubEvent[];
}

export interface RawHit {
  id: number;
  team_id: number;
  batter_player_id: number;
  x: string; // "46.63" tms.
  y: string;
  caught: boolean;
  out: boolean; // = laiton lyönti
  hit_number: number;
}

export interface RawSubEvent {
  runnersAtBases: (number | null)[]; // 5-alkion lista [lyöjä, 1b, 2b, 3b, koti]
  texts: Array<RawTextItem | string>;
}

export type RawTextItem =
  | { type: 'event'; text: string }
  | { type: 'player'; id: number; team?: number }
  | { type: 'hit'; hit: RawHit }
  | { type: 'hit-caught'; text?: string }
  | { type: 'hit-out'; text?: string }
  | { type: 'stat'; [k: string]: any }
  | { type: 'team'; [k: string]: any }
  | { type: 'substitution'; [k: string]: any };

// ============================================================================
// Parserin sisäinen rakenne
// ============================================================================

export type SegmentReason =
  | 'hit_advance'       // eteni lyönnin yhteydessä
  | 'hit_homerun'       // löi kunnarin
  | 'hit_wounded'       // haavoittui
  | 'hit_out'           // paloi lyönnin yhteydessä
  | 'walk'              // sai vapaataipaleen
  | 'walk_induced'      // shiftasi vapaataipaleen pakottamana
  | 'error_advance'     // eteni harhaheitolla
  | 'steal'             // karkasi
  | 'non_pitch_out'     // paloi ei-lyönti-kontekstissa
  | 'non_pitch_advance' // eteni ei-lyönti-kontekstissa
  | 'unknown';          // ei tunnistettu

export type PlayerRole = 'batter' | 'lead_runner' | 'tail_runner';

/** Yksi segmentti — yhden pelaajan tilamuutos yhden sub-eventin aikana. */
export interface ParsedSegment {
  player_id: number;
  event_text: string;
  from_base: number | null;     // 0=lyöjä, 1-3=pesät, null=ei lähtöä
  to_base: number | null;       // 1-3=pesät, 4=koti, -1=palo, -2=haav., null=ei tunnistettu
  reason: SegmentReason;
  is_pre_hit: boolean;
}

/** Itse lyönnin tiedot (caught/illegal/koordinaatit). */
export interface ParsedPitchRecord {
  hit_id: number;
  x: string;
  y: string;
  caught: boolean;
  illegal: boolean;
}

/** Yksi lyönti at-batin sisällä. */
export interface ParsedPitch {
  hit_number: number; // 1, 2 tai 3
  start_bases: (number | null)[];
  pitch_record: ParsedPitchRecord | null;
  segments: ParsedSegment[];
}

/** Yhden vuoron lyöjäosallistuja. */
export interface ParsedAtBatParticipant {
  player_id: number;
  role_at_start: PlayerRole;
  start_base: number | null;
  end_base: number | null;
  had_hit_advance: boolean;
  had_error_advance: boolean;
  had_steal: boolean;
  had_walk: boolean;
  got_out: boolean;
  got_wounded: boolean;
}

/** Yhden lyönnin osallistuja. */
export interface ParsedPitchParticipant {
  player_id: number;
  role_at_start: PlayerRole;
  start_base: number | null;
  end_base: number | null;
  had_hit_advance: boolean;
  got_out: boolean;
  got_wounded: boolean;
}

/** Yksi lyöntivuoro. */
export interface ParsedAtBat {
  // Tunnisteet
  period: number;
  inning: number;
  batTurn: number;
  batter_id: number;
  team_id: number;
  
  // Lähtötilat
  raw_start_bases: (number | null)[];
  effective_start_bases: (number | null)[];
  
  // Sisältö
  pre_hit_segments: ParsedSegment[];
  pitches: ParsedPitch[];
  
  // Aggregaatit
  original_lead_player: number | null;
  original_lead_disqualified: boolean;
  any_out: boolean;
  
  // Osallistujat
  participants: ParsedAtBatParticipant[];
}

/** Koko ottelun parsittu data. */
export interface ParsedMatch {
  match_id: number;
  has_pitch_detail: boolean;   // true = täysi parsinta, false = vain at_bat-taso, ei pitchejä
  events_available: boolean;   // false = API palautti tyhjän, true = onnistunut
  at_bats: ParsedAtBat[];
  players_seen: Set<number>;
}
