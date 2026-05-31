import type {
  ParsedMatch,
  ParsedAtBat,
  ParsedPitch,
  ParsedSegment,
  ParsedAtBatParticipant,
} from './types.ts';
import { findLeadRunner, determineRole } from './parseMatch.ts';

// ============================================================================
// SQL-rivien tyypit (mappautuvat suoraan kannan tauluihin)
// ============================================================================

export interface PlayerRow {
  player_id: number;
  last_seen_at: string; // ISO timestamp
}

export interface MatchUpdateRow {
  match_id: number;
  events_fetched_at: string;
  events_available: boolean;
  has_pitch_detail: boolean;
}

export interface AtBatRow {
  // Luonnollinen avain: (match_id, period, inning, bat_turn, at_bat_in_inning)
  // at_bat_in_inning kasvaa 0,1,2,... saman inningin sisällä koska sama lyöjä
  // voi olla useamman kerran lyömässä jos joukkue ei pala.
  match_id: number;
  team_id: number;
  period: number;
  inning: number;
  bat_turn: number;
  at_bat_in_inning: number;
  batter_id: number;
  raw_start_runner_1b: number | null;
  raw_start_runner_2b: number | null;
  raw_start_runner_3b: number | null;
  effective_start_runner_1b: number | null;
  effective_start_runner_2b: number | null;
  effective_start_runner_3b: number | null;
  original_lead_player: number | null;
  original_lead_disqualified: boolean;
  any_out: boolean;
  num_pitches: number;
}

export interface AtBatParticipantRow {
  // Luonnollinen avain: (match_id, period, inning, bat_turn, at_bat_in_inning, player_id)
  match_id: number;
  period: number;
  inning: number;
  bat_turn: number;
  at_bat_in_inning: number;
  batter_id: number;
  player_id: number;
  team_id: number;
  role_at_start: string;
  start_base: number | null;
  end_base: number | null;
  had_hit_advance: boolean;
  had_error_advance: boolean;
  had_steal: boolean;
  had_walk: boolean;
  got_out: boolean;
  got_wounded: boolean;
}

export interface PitchRow {
  // Luonnollinen avain: (match_id, period, inning, bat_turn, at_bat_in_inning, hit_number)
  match_id: number;
  team_id: number;
  period: number;
  inning: number;
  bat_turn: number;
  at_bat_in_inning: number;
  batter_id: number;
  hit_number: number;
  hit_id: number | null;
  hit_x: string | null;
  hit_y: string | null;
  caught: boolean;
  illegal: boolean;
  start_runner_1b: number | null;
  start_runner_2b: number | null;
  start_runner_3b: number | null;
  pitch_lead_player: number | null;
  pitch_lead_disqualified: boolean;
  any_out: boolean;
}

export interface PitchParticipantRow {
  // Luonnollinen avain: (match_id, period, inning, bat_turn, at_bat_in_inning, hit_number, player_id)
  match_id: number;
  period: number;
  inning: number;
  bat_turn: number;
  at_bat_in_inning: number;
  batter_id: number;
  hit_number: number;
  player_id: number;
  team_id: number;
  role_at_start: string;
  start_base: number | null;
  end_base: number | null;
  had_hit_advance: boolean;
  got_out: boolean;
  got_wounded: boolean;
}

export interface SegmentRow {
  // Luonnollinen avain: (match_id, period, inning, bat_turn, at_bat_in_inning, sequence)
  match_id: number;
  period: number;
  inning: number;
  bat_turn: number;
  at_bat_in_inning: number;
  batter_id: number;
  sequence: number;
  hit_number: number | null; // null = pre-hit, muutoin pitchin hit_number
  player_id: number;
  from_base: number | null;
  to_base: number | null;
  reason: string;
  event_text: string;
  is_pre_hit: boolean;
}

/** Kaikki riveinä SQL-tauluille. */
export interface MatchDatabaseRows {
  match_update: MatchUpdateRow;
  player_upserts: PlayerRow[];
  at_bats: AtBatRow[];
  at_bat_participants: AtBatParticipantRow[];
  pitches: PitchRow[];
  pitch_participants: PitchParticipantRow[];
  segments: SegmentRow[];
}

// ============================================================================
// PÄÄFUNKTIO
// ============================================================================

export function buildDatabaseRows(parsed: ParsedMatch): MatchDatabaseRows {
  const now = new Date().toISOString();
  
  const rows: MatchDatabaseRows = {
    match_update: {
      match_id: parsed.match_id,
      events_fetched_at: now,
      events_available: parsed.events_available,
      has_pitch_detail: parsed.has_pitch_detail,
    },
    player_upserts: [],
    at_bats: [],
    at_bat_participants: [],
    pitches: [],
    pitch_participants: [],
    segments: [],
  };
  
  // Players
  for (const pid of parsed.players_seen) {
    rows.player_upserts.push({
      player_id: pid,
      last_seen_at: now,
    });
  }
  
  // At-batit, osallistujat, lyönnit, segmentit
  // at_bat_in_inning -laskuri per (period, inning, bat_turn)
  const inningCounters = new Map<string, number>();
  
  for (const ab of parsed.at_bats) {
    const inningKey = `${ab.period}-${ab.inning}-${ab.batTurn}`;
    const at_bat_in_inning = inningCounters.get(inningKey) ?? 0;
    inningCounters.set(inningKey, at_bat_in_inning + 1);
    
    addAtBatRows(parsed.match_id, ab, at_bat_in_inning, parsed.has_pitch_detail, rows);
  }
  
  return rows;
}

function addAtBatRows(
  match_id: number,
  ab: ParsedAtBat,
  at_bat_in_inning: number,
  has_pitch_detail: boolean,
  rows: MatchDatabaseRows
): void {
  // 1. AtBat-rivi
  rows.at_bats.push({
    match_id,
    team_id: ab.team_id,
    period: ab.period,
    inning: ab.inning,
    bat_turn: ab.batTurn,
    at_bat_in_inning,
    batter_id: ab.batter_id,
    raw_start_runner_1b: ab.raw_start_bases[1] ?? null,
    raw_start_runner_2b: ab.raw_start_bases[2] ?? null,
    raw_start_runner_3b: ab.raw_start_bases[3] ?? null,
    effective_start_runner_1b: ab.effective_start_bases[1] ?? null,
    effective_start_runner_2b: ab.effective_start_bases[2] ?? null,
    effective_start_runner_3b: ab.effective_start_bases[3] ?? null,
    original_lead_player: ab.original_lead_player,
    original_lead_disqualified: ab.original_lead_disqualified,
    any_out: ab.any_out,
    num_pitches: ab.pitches.length,
  });
  
  // 2. Osallistujat
  for (const p of ab.participants) {
    rows.at_bat_participants.push({
      match_id,
      period: ab.period,
      inning: ab.inning,
      bat_turn: ab.batTurn,
      at_bat_in_inning,
      batter_id: ab.batter_id,
      player_id: p.player_id,
      team_id: ab.team_id,
      role_at_start: p.role_at_start,
      start_base: p.start_base,
      end_base: p.end_base,
      had_hit_advance: p.had_hit_advance,
      had_error_advance: p.had_error_advance,
      had_steal: p.had_steal,
      had_walk: p.had_walk,
      got_out: p.got_out,
      got_wounded: p.got_wounded,
    });
  }
  
  // 3. Segmentit (sequence-numeroidaan)
  let sequence = 0;
  
  // Ensin pre-hit-segmentit (hyvälaatuiselle) tai kaikki at-bat-segmentit (huonolaatuiselle)
  for (const seg of ab.pre_hit_segments) {
    if (seg.player_id == null) continue;
    rows.segments.push({
      match_id,
      period: ab.period,
      inning: ab.inning,
      bat_turn: ab.batTurn,
      at_bat_in_inning,
      batter_id: ab.batter_id,
      sequence: sequence++,
      hit_number: null,
      player_id: seg.player_id,
      from_base: seg.from_base,
      to_base: seg.to_base,
      reason: seg.reason,
      event_text: seg.event_text,
      is_pre_hit: !has_pitch_detail ? false : seg.is_pre_hit,
    });
  }
  
  // 4. Pitchit (vain hyvälaatuiselle)
  if (has_pitch_detail) {
    for (const pitch of ab.pitches) {
      sequence = addPitchRows(match_id, ab, at_bat_in_inning, pitch, rows, sequence);
    }
  }
}

function addPitchRows(
  match_id: number,
  ab: ParsedAtBat,
  at_bat_in_inning: number,
  pitch: ParsedPitch,
  rows: MatchDatabaseRows,
  start_sequence: number
): number {
  // Pitch-tason aggregaatit
  const pitch_lead = findLeadRunner(pitch.start_bases, ab.batter_id);
  
  // pitch_lead_disqualified: lyönnin kärki paloi tässä lyönnissä (vain palo, ei haavoittuminen)
  const pitch_lead_disqualified = pitch_lead !== null && pitch.segments.some(
    s => s.player_id === pitch_lead && s.reason === 'hit_out'
  );
  
  // any_out lyöntitasolla: hit_out tässä lyönnissä (ei non_pitch_out koska lyönti-konteksti)
  const pitch_any_out = pitch.segments.some(s => s.reason === 'hit_out');
  
  // Pitch-rivi
  rows.pitches.push({
    match_id,
    team_id: ab.team_id,
    period: ab.period,
    inning: ab.inning,
    bat_turn: ab.batTurn,
    at_bat_in_inning,
    batter_id: ab.batter_id,
    hit_number: pitch.hit_number,
    hit_id: pitch.pitch_record?.hit_id ?? null,
    hit_x: pitch.pitch_record?.x ?? null,
    hit_y: pitch.pitch_record?.y ?? null,
    caught: pitch.pitch_record?.caught ?? false,
    illegal: pitch.pitch_record?.illegal ?? false,
    start_runner_1b: pitch.start_bases[1] ?? null,
    start_runner_2b: pitch.start_bases[2] ?? null,
    start_runner_3b: pitch.start_bases[3] ?? null,
    pitch_lead_player: pitch_lead,
    pitch_lead_disqualified,
    any_out: pitch_any_out,
  });
  
  // Pitch-osallistujat
  const pitch_participants = buildPitchParticipants(pitch, ab.batter_id);
  for (const pp of pitch_participants) {
    rows.pitch_participants.push({
      match_id,
      period: ab.period,
      inning: ab.inning,
      bat_turn: ab.batTurn,
      at_bat_in_inning,
      batter_id: ab.batter_id,
      hit_number: pitch.hit_number,
      player_id: pp.player_id,
      team_id: ab.team_id,
      role_at_start: pp.role_at_start,
      start_base: pp.start_base,
      end_base: pp.end_base,
      had_hit_advance: pp.had_hit_advance,
      got_out: pp.got_out,
      got_wounded: pp.got_wounded,
    });
  }
  
  // Pitch-segmentit
  let seq = start_sequence;
  for (const seg of pitch.segments) {
    rows.segments.push({
      match_id,
      period: ab.period,
      inning: ab.inning,
      bat_turn: ab.batTurn,
      at_bat_in_inning,
      batter_id: ab.batter_id,
      sequence: seq++,
      hit_number: pitch.hit_number,
      player_id: seg.player_id,
      from_base: seg.from_base,
      to_base: seg.to_base,
      reason: seg.reason,
      event_text: seg.event_text,
      is_pre_hit: false,
    });
  }
  
  return seq;
}

interface BuiltPitchParticipant {
  player_id: number;
  role_at_start: string;
  start_base: number | null;
  end_base: number | null;
  had_hit_advance: boolean;
  got_out: boolean;
  got_wounded: boolean;
}

function buildPitchParticipants(
  pitch: ParsedPitch,
  batter_id: number
): BuiltPitchParticipant[] {
  const ids = new Set<number>();
  for (let i = 0; i < 4; i++) {
    if (pitch.start_bases[i]) ids.add(pitch.start_bases[i]!);
  }
  for (const s of pitch.segments) {
    if (s.player_id) ids.add(s.player_id);
  }
  
  const result: BuiltPitchParticipant[] = [];
  
  for (const pid of ids) {
    const role = determineRole(pid, pitch.start_bases, batter_id);
    if (role === null) continue;
    
    let start_base: number | null = null;
    for (let i = 0; i < 4; i++) {
      if (pitch.start_bases[i] === pid) {
        start_base = i;
        break;
      }
    }
    
    const psegs = pitch.segments.filter(s => s.player_id === pid);
    
    result.push({
      player_id: pid,
      role_at_start: role,
      start_base,
      end_base: psegs.length > 0 ? psegs[psegs.length - 1].to_base : start_base,
      had_hit_advance: psegs.some(
        s => s.reason === 'hit_advance' || s.reason === 'hit_homerun'
      ),
      got_out: psegs.some(s => s.reason === 'hit_out'),
      got_wounded: psegs.some(s => s.reason === 'hit_wounded'),
    });
  }
  
  return result;
}
