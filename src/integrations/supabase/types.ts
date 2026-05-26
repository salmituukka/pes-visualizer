export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      at_bat_participants: {
        Row: {
          at_bat_in_inning: number
          bat_turn: number
          batter_id: number
          end_base: number | null
          got_out: boolean | null
          got_wounded: boolean | null
          had_error_advance: boolean | null
          had_hit_advance: boolean | null
          had_steal: boolean | null
          had_walk: boolean | null
          inning: number
          match_id: number
          period: number
          player_id: number
          role_at_start: string
          start_base: number | null
          team_id: number
        }
        Insert: {
          at_bat_in_inning: number
          bat_turn: number
          batter_id: number
          end_base?: number | null
          got_out?: boolean | null
          got_wounded?: boolean | null
          had_error_advance?: boolean | null
          had_hit_advance?: boolean | null
          had_steal?: boolean | null
          had_walk?: boolean | null
          inning: number
          match_id: number
          period: number
          player_id: number
          role_at_start: string
          start_base?: number | null
          team_id: number
        }
        Update: {
          at_bat_in_inning?: number
          bat_turn?: number
          batter_id?: number
          end_base?: number | null
          got_out?: boolean | null
          got_wounded?: boolean | null
          had_error_advance?: boolean | null
          had_hit_advance?: boolean | null
          had_steal?: boolean | null
          had_walk?: boolean | null
          inning?: number
          match_id?: number
          period?: number
          player_id?: number
          role_at_start?: string
          start_base?: number | null
          team_id?: number
        }
        Relationships: [
          {
            foreignKeyName: "at_bat_participants_batter_id_fkey"
            columns: ["batter_id"]
            isOneToOne: false
            referencedRelation: "players"
            referencedColumns: ["player_id"]
          },
          {
            foreignKeyName: "at_bat_participants_match_id_period_inning_bat_turn_at_bat_fkey"
            columns: [
              "match_id",
              "period",
              "inning",
              "bat_turn",
              "at_bat_in_inning",
            ]
            isOneToOne: false
            referencedRelation: "at_bats"
            referencedColumns: [
              "match_id",
              "period",
              "inning",
              "bat_turn",
              "at_bat_in_inning",
            ]
          },
          {
            foreignKeyName: "at_bat_participants_player_id_fkey"
            columns: ["player_id"]
            isOneToOne: false
            referencedRelation: "players"
            referencedColumns: ["player_id"]
          },
          {
            foreignKeyName: "at_bat_participants_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["team_id"]
          },
        ]
      }
      at_bats: {
        Row: {
          any_out: boolean | null
          at_bat_in_inning: number
          bat_turn: number
          batter_id: number
          effective_start_runner_1b: number | null
          effective_start_runner_2b: number | null
          effective_start_runner_3b: number | null
          inning: number
          match_id: number
          num_pitches: number | null
          original_lead_disqualified: boolean | null
          original_lead_player: number | null
          period: number
          raw_start_runner_1b: number | null
          raw_start_runner_2b: number | null
          raw_start_runner_3b: number | null
          team_id: number
        }
        Insert: {
          any_out?: boolean | null
          at_bat_in_inning: number
          bat_turn: number
          batter_id: number
          effective_start_runner_1b?: number | null
          effective_start_runner_2b?: number | null
          effective_start_runner_3b?: number | null
          inning: number
          match_id: number
          num_pitches?: number | null
          original_lead_disqualified?: boolean | null
          original_lead_player?: number | null
          period: number
          raw_start_runner_1b?: number | null
          raw_start_runner_2b?: number | null
          raw_start_runner_3b?: number | null
          team_id: number
        }
        Update: {
          any_out?: boolean | null
          at_bat_in_inning?: number
          bat_turn?: number
          batter_id?: number
          effective_start_runner_1b?: number | null
          effective_start_runner_2b?: number | null
          effective_start_runner_3b?: number | null
          inning?: number
          match_id?: number
          num_pitches?: number | null
          original_lead_disqualified?: boolean | null
          original_lead_player?: number | null
          period?: number
          raw_start_runner_1b?: number | null
          raw_start_runner_2b?: number | null
          raw_start_runner_3b?: number | null
          team_id?: number
        }
        Relationships: [
          {
            foreignKeyName: "at_bats_batter_id_fkey"
            columns: ["batter_id"]
            isOneToOne: false
            referencedRelation: "players"
            referencedColumns: ["player_id"]
          },
          {
            foreignKeyName: "at_bats_effective_start_runner_1b_fkey"
            columns: ["effective_start_runner_1b"]
            isOneToOne: false
            referencedRelation: "players"
            referencedColumns: ["player_id"]
          },
          {
            foreignKeyName: "at_bats_effective_start_runner_2b_fkey"
            columns: ["effective_start_runner_2b"]
            isOneToOne: false
            referencedRelation: "players"
            referencedColumns: ["player_id"]
          },
          {
            foreignKeyName: "at_bats_effective_start_runner_3b_fkey"
            columns: ["effective_start_runner_3b"]
            isOneToOne: false
            referencedRelation: "players"
            referencedColumns: ["player_id"]
          },
          {
            foreignKeyName: "at_bats_match_id_fkey"
            columns: ["match_id"]
            isOneToOne: false
            referencedRelation: "matches"
            referencedColumns: ["match_id"]
          },
          {
            foreignKeyName: "at_bats_original_lead_player_fkey"
            columns: ["original_lead_player"]
            isOneToOne: false
            referencedRelation: "players"
            referencedColumns: ["player_id"]
          },
          {
            foreignKeyName: "at_bats_raw_start_runner_1b_fkey"
            columns: ["raw_start_runner_1b"]
            isOneToOne: false
            referencedRelation: "players"
            referencedColumns: ["player_id"]
          },
          {
            foreignKeyName: "at_bats_raw_start_runner_2b_fkey"
            columns: ["raw_start_runner_2b"]
            isOneToOne: false
            referencedRelation: "players"
            referencedColumns: ["player_id"]
          },
          {
            foreignKeyName: "at_bats_raw_start_runner_3b_fkey"
            columns: ["raw_start_runner_3b"]
            isOneToOne: false
            referencedRelation: "players"
            referencedColumns: ["player_id"]
          },
          {
            foreignKeyName: "at_bats_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["team_id"]
          },
        ]
      }
      matches: {
        Row: {
          away_runs: number | null
          away_team_id: number | null
          events_available: boolean | null
          events_fetched_at: string | null
          has_pitch_detail: boolean | null
          home_runs: number | null
          home_team_id: number | null
          match_date: string | null
          match_id: number
          season_series_id: number | null
        }
        Insert: {
          away_runs?: number | null
          away_team_id?: number | null
          events_available?: boolean | null
          events_fetched_at?: string | null
          has_pitch_detail?: boolean | null
          home_runs?: number | null
          home_team_id?: number | null
          match_date?: string | null
          match_id: number
          season_series_id?: number | null
        }
        Update: {
          away_runs?: number | null
          away_team_id?: number | null
          events_available?: boolean | null
          events_fetched_at?: string | null
          has_pitch_detail?: boolean | null
          home_runs?: number | null
          home_team_id?: number | null
          match_date?: string | null
          match_id?: number
          season_series_id?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "matches_away_team_id_fkey"
            columns: ["away_team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["team_id"]
          },
          {
            foreignKeyName: "matches_home_team_id_fkey"
            columns: ["home_team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["team_id"]
          },
          {
            foreignKeyName: "matches_season_series_id_fkey"
            columns: ["season_series_id"]
            isOneToOne: false
            referencedRelation: "series"
            referencedColumns: ["season_series_id"]
          },
        ]
      }
      pitch_participants: {
        Row: {
          at_bat_in_inning: number
          bat_turn: number
          batter_id: number
          end_base: number | null
          got_out: boolean | null
          got_wounded: boolean | null
          had_hit_advance: boolean | null
          hit_number: number
          inning: number
          match_id: number
          period: number
          player_id: number
          role_at_start: string
          start_base: number | null
          team_id: number
        }
        Insert: {
          at_bat_in_inning: number
          bat_turn: number
          batter_id: number
          end_base?: number | null
          got_out?: boolean | null
          got_wounded?: boolean | null
          had_hit_advance?: boolean | null
          hit_number: number
          inning: number
          match_id: number
          period: number
          player_id: number
          role_at_start: string
          start_base?: number | null
          team_id: number
        }
        Update: {
          at_bat_in_inning?: number
          bat_turn?: number
          batter_id?: number
          end_base?: number | null
          got_out?: boolean | null
          got_wounded?: boolean | null
          had_hit_advance?: boolean | null
          hit_number?: number
          inning?: number
          match_id?: number
          period?: number
          player_id?: number
          role_at_start?: string
          start_base?: number | null
          team_id?: number
        }
        Relationships: [
          {
            foreignKeyName: "pitch_participants_batter_id_fkey"
            columns: ["batter_id"]
            isOneToOne: false
            referencedRelation: "players"
            referencedColumns: ["player_id"]
          },
          {
            foreignKeyName: "pitch_participants_match_id_period_inning_bat_turn_at_bat__fkey"
            columns: [
              "match_id",
              "period",
              "inning",
              "bat_turn",
              "at_bat_in_inning",
              "hit_number",
            ]
            isOneToOne: false
            referencedRelation: "pitches"
            referencedColumns: [
              "match_id",
              "period",
              "inning",
              "bat_turn",
              "at_bat_in_inning",
              "hit_number",
            ]
          },
          {
            foreignKeyName: "pitch_participants_player_id_fkey"
            columns: ["player_id"]
            isOneToOne: false
            referencedRelation: "players"
            referencedColumns: ["player_id"]
          },
          {
            foreignKeyName: "pitch_participants_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["team_id"]
          },
        ]
      }
      pitches: {
        Row: {
          any_out: boolean | null
          at_bat_in_inning: number
          bat_turn: number
          batter_id: number
          caught: boolean | null
          hit_id: number | null
          hit_number: number
          hit_x: string | null
          hit_y: string | null
          illegal: boolean | null
          inning: number
          match_id: number
          period: number
          pitch_lead_disqualified: boolean | null
          pitch_lead_player: number | null
          start_runner_1b: number | null
          start_runner_2b: number | null
          start_runner_3b: number | null
          team_id: number
        }
        Insert: {
          any_out?: boolean | null
          at_bat_in_inning: number
          bat_turn: number
          batter_id: number
          caught?: boolean | null
          hit_id?: number | null
          hit_number: number
          hit_x?: string | null
          hit_y?: string | null
          illegal?: boolean | null
          inning: number
          match_id: number
          period: number
          pitch_lead_disqualified?: boolean | null
          pitch_lead_player?: number | null
          start_runner_1b?: number | null
          start_runner_2b?: number | null
          start_runner_3b?: number | null
          team_id: number
        }
        Update: {
          any_out?: boolean | null
          at_bat_in_inning?: number
          bat_turn?: number
          batter_id?: number
          caught?: boolean | null
          hit_id?: number | null
          hit_number?: number
          hit_x?: string | null
          hit_y?: string | null
          illegal?: boolean | null
          inning?: number
          match_id?: number
          period?: number
          pitch_lead_disqualified?: boolean | null
          pitch_lead_player?: number | null
          start_runner_1b?: number | null
          start_runner_2b?: number | null
          start_runner_3b?: number | null
          team_id?: number
        }
        Relationships: [
          {
            foreignKeyName: "pitches_batter_id_fkey"
            columns: ["batter_id"]
            isOneToOne: false
            referencedRelation: "players"
            referencedColumns: ["player_id"]
          },
          {
            foreignKeyName: "pitches_match_id_period_inning_bat_turn_at_bat_in_inning_fkey"
            columns: [
              "match_id",
              "period",
              "inning",
              "bat_turn",
              "at_bat_in_inning",
            ]
            isOneToOne: false
            referencedRelation: "at_bats"
            referencedColumns: [
              "match_id",
              "period",
              "inning",
              "bat_turn",
              "at_bat_in_inning",
            ]
          },
          {
            foreignKeyName: "pitches_pitch_lead_player_fkey"
            columns: ["pitch_lead_player"]
            isOneToOne: false
            referencedRelation: "players"
            referencedColumns: ["player_id"]
          },
          {
            foreignKeyName: "pitches_start_runner_1b_fkey"
            columns: ["start_runner_1b"]
            isOneToOne: false
            referencedRelation: "players"
            referencedColumns: ["player_id"]
          },
          {
            foreignKeyName: "pitches_start_runner_2b_fkey"
            columns: ["start_runner_2b"]
            isOneToOne: false
            referencedRelation: "players"
            referencedColumns: ["player_id"]
          },
          {
            foreignKeyName: "pitches_start_runner_3b_fkey"
            columns: ["start_runner_3b"]
            isOneToOne: false
            referencedRelation: "players"
            referencedColumns: ["player_id"]
          },
          {
            foreignKeyName: "pitches_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["team_id"]
          },
        ]
      }
      players: {
        Row: {
          first_name: string | null
          full_name: string | null
          image_url: string | null
          last_name: string | null
          last_seen_at: string | null
          player_id: number
        }
        Insert: {
          first_name?: string | null
          full_name?: string | null
          image_url?: string | null
          last_name?: string | null
          last_seen_at?: string | null
          player_id: number
        }
        Update: {
          first_name?: string | null
          full_name?: string | null
          image_url?: string | null
          last_name?: string | null
          last_seen_at?: string | null
          player_id?: number
        }
        Relationships: []
      }
      seasons: {
        Row: {
          season_id: number
          year: number
        }
        Insert: {
          season_id: number
          year: number
        }
        Update: {
          season_id?: number
          year?: number
        }
        Relationships: []
      }
      segments: {
        Row: {
          at_bat_in_inning: number
          bat_turn: number
          batter_id: number
          event_text: string | null
          from_base: number | null
          hit_number: number | null
          inning: number
          is_pre_hit: boolean | null
          match_id: number
          period: number
          player_id: number
          reason: string
          sequence: number
          to_base: number | null
        }
        Insert: {
          at_bat_in_inning: number
          bat_turn: number
          batter_id: number
          event_text?: string | null
          from_base?: number | null
          hit_number?: number | null
          inning: number
          is_pre_hit?: boolean | null
          match_id: number
          period: number
          player_id: number
          reason: string
          sequence: number
          to_base?: number | null
        }
        Update: {
          at_bat_in_inning?: number
          bat_turn?: number
          batter_id?: number
          event_text?: string | null
          from_base?: number | null
          hit_number?: number | null
          inning?: number
          is_pre_hit?: boolean | null
          match_id?: number
          period?: number
          player_id?: number
          reason?: string
          sequence?: number
          to_base?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "segments_batter_id_fkey"
            columns: ["batter_id"]
            isOneToOne: false
            referencedRelation: "players"
            referencedColumns: ["player_id"]
          },
          {
            foreignKeyName: "segments_match_id_period_inning_bat_turn_at_bat_in_inning_fkey"
            columns: [
              "match_id",
              "period",
              "inning",
              "bat_turn",
              "at_bat_in_inning",
            ]
            isOneToOne: false
            referencedRelation: "at_bats"
            referencedColumns: [
              "match_id",
              "period",
              "inning",
              "bat_turn",
              "at_bat_in_inning",
            ]
          },
          {
            foreignKeyName: "segments_player_id_fkey"
            columns: ["player_id"]
            isOneToOne: false
            referencedRelation: "players"
            referencedColumns: ["player_id"]
          },
        ]
      }
      series: {
        Row: {
          level_id: number
          level_name: string | null
          name: string
          organizer_id: number
          organizer_name: string | null
          pesistv: boolean | null
          season_id: number
          season_series_id: number
          series_id: number
          series_name: string | null
          slug: string | null
        }
        Insert: {
          level_id: number
          level_name?: string | null
          name: string
          organizer_id: number
          organizer_name?: string | null
          pesistv?: boolean | null
          season_id: number
          season_series_id: number
          series_id: number
          series_name?: string | null
          slug?: string | null
        }
        Update: {
          level_id?: number
          level_name?: string | null
          name?: string
          organizer_id?: number
          organizer_name?: string | null
          pesistv?: boolean | null
          season_id?: number
          season_series_id?: number
          series_id?: number
          series_name?: string | null
          slug?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "series_season_id_fkey"
            columns: ["season_id"]
            isOneToOne: false
            referencedRelation: "seasons"
            referencedColumns: ["season_id"]
          },
        ]
      }
      series_groups: {
        Row: {
          group_id: number
          is_playoff: boolean | null
          name: string
          phase_id: number | null
          season_series_id: number
        }
        Insert: {
          group_id: number
          is_playoff?: boolean | null
          name: string
          phase_id?: number | null
          season_series_id: number
        }
        Update: {
          group_id?: number
          is_playoff?: boolean | null
          name?: string
          phase_id?: number | null
          season_series_id?: number
        }
        Relationships: [
          {
            foreignKeyName: "series_groups_season_series_id_fkey"
            columns: ["season_series_id"]
            isOneToOne: false
            referencedRelation: "series"
            referencedColumns: ["season_series_id"]
          },
        ]
      }
      sport_clubs: {
        Row: {
          city: string | null
          icon_url: string | null
          logo_url: string | null
          name: string
          shorthand: string | null
          sport_club_id: number
          square_url: string | null
          three_letters: string | null
        }
        Insert: {
          city?: string | null
          icon_url?: string | null
          logo_url?: string | null
          name: string
          shorthand?: string | null
          sport_club_id: number
          square_url?: string | null
          three_letters?: string | null
        }
        Update: {
          city?: string | null
          icon_url?: string | null
          logo_url?: string | null
          name?: string
          shorthand?: string | null
          sport_club_id?: number
          square_url?: string | null
          three_letters?: string | null
        }
        Relationships: []
      }
      system_meta: {
        Row: {
          key: string
          updated_at: string | null
          value: string | null
        }
        Insert: {
          key: string
          updated_at?: string | null
          value?: string | null
        }
        Update: {
          key?: string
          updated_at?: string | null
          value?: string | null
        }
        Relationships: []
      }
      team_in_series_group: {
        Row: {
          group_id: number
          season_series_id: number
          team_id: number
        }
        Insert: {
          group_id: number
          season_series_id: number
          team_id: number
        }
        Update: {
          group_id?: number
          season_series_id?: number
          team_id?: number
        }
        Relationships: [
          {
            foreignKeyName: "team_in_series_group_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "series_groups"
            referencedColumns: ["group_id"]
          },
          {
            foreignKeyName: "team_in_series_group_season_series_id_fkey"
            columns: ["season_series_id"]
            isOneToOne: false
            referencedRelation: "series"
            referencedColumns: ["season_series_id"]
          },
          {
            foreignKeyName: "team_in_series_group_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["team_id"]
          },
        ]
      }
      teams: {
        Row: {
          last_player_sync: string | null
          logo_url: string | null
          name: string
          shorthand: string | null
          sport_club_id: number | null
          team_id: number
          three_letters: string | null
        }
        Insert: {
          last_player_sync?: string | null
          logo_url?: string | null
          name: string
          shorthand?: string | null
          sport_club_id?: number | null
          team_id: number
          three_letters?: string | null
        }
        Update: {
          last_player_sync?: string | null
          logo_url?: string | null
          name?: string
          shorthand?: string | null
          sport_club_id?: number | null
          team_id?: number
          three_letters?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "teams_sport_club_id_fkey"
            columns: ["sport_club_id"]
            isOneToOne: false
            referencedRelation: "sport_clubs"
            referencedColumns: ["sport_club_id"]
          },
        ]
      }
    }
    Views: {
      v_at_bat_participants_with_goals: {
        Row: {
          at_bat_in_inning: number | null
          atbat_any_out: boolean | null
          bat_turn: number | null
          batter_id: number | null
          effective_start_runner_1b: number | null
          effective_start_runner_2b: number | null
          effective_start_runner_3b: number | null
          end_base: number | null
          goal_lead_advance: string | null
          goal_no_outs: string | null
          goal_tail_advance_batter: string | null
          goal_tail_advance_runner: string | null
          got_out: boolean | null
          got_wounded: boolean | null
          had_error_advance: boolean | null
          had_hit_advance: boolean | null
          had_steal: boolean | null
          had_walk: boolean | null
          has_pitch_detail: boolean | null
          inning: number | null
          match_date: string | null
          match_id: number | null
          original_lead_disqualified: boolean | null
          period: number | null
          player_id: number | null
          role_at_start: string | null
          season_series_id: number | null
          start_base: number | null
          team_id: number | null
        }
        Relationships: [
          {
            foreignKeyName: "at_bat_participants_batter_id_fkey"
            columns: ["batter_id"]
            isOneToOne: false
            referencedRelation: "players"
            referencedColumns: ["player_id"]
          },
          {
            foreignKeyName: "at_bat_participants_match_id_period_inning_bat_turn_at_bat_fkey"
            columns: [
              "match_id",
              "period",
              "inning",
              "bat_turn",
              "at_bat_in_inning",
            ]
            isOneToOne: false
            referencedRelation: "at_bats"
            referencedColumns: [
              "match_id",
              "period",
              "inning",
              "bat_turn",
              "at_bat_in_inning",
            ]
          },
          {
            foreignKeyName: "at_bat_participants_player_id_fkey"
            columns: ["player_id"]
            isOneToOne: false
            referencedRelation: "players"
            referencedColumns: ["player_id"]
          },
          {
            foreignKeyName: "at_bat_participants_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["team_id"]
          },
          {
            foreignKeyName: "at_bats_effective_start_runner_1b_fkey"
            columns: ["effective_start_runner_1b"]
            isOneToOne: false
            referencedRelation: "players"
            referencedColumns: ["player_id"]
          },
          {
            foreignKeyName: "at_bats_effective_start_runner_2b_fkey"
            columns: ["effective_start_runner_2b"]
            isOneToOne: false
            referencedRelation: "players"
            referencedColumns: ["player_id"]
          },
          {
            foreignKeyName: "at_bats_effective_start_runner_3b_fkey"
            columns: ["effective_start_runner_3b"]
            isOneToOne: false
            referencedRelation: "players"
            referencedColumns: ["player_id"]
          },
          {
            foreignKeyName: "matches_season_series_id_fkey"
            columns: ["season_series_id"]
            isOneToOne: false
            referencedRelation: "series"
            referencedColumns: ["season_series_id"]
          },
        ]
      }
      v_pitch_participants_with_goals: {
        Row: {
          at_bat_in_inning: number | null
          bat_turn: number | null
          batter_id: number | null
          end_base: number | null
          goal_lead_advance: string | null
          goal_no_outs: string | null
          goal_tail_advance_batter: string | null
          goal_tail_advance_runner: string | null
          got_out: boolean | null
          got_wounded: boolean | null
          had_hit_advance: boolean | null
          has_pitch_detail: boolean | null
          hit_number: number | null
          inning: number | null
          match_date: string | null
          match_id: number | null
          period: number | null
          pitch_any_out: boolean | null
          pitch_caught: boolean | null
          pitch_illegal: boolean | null
          pitch_lead_disqualified: boolean | null
          player_id: number | null
          role_at_start: string | null
          season_series_id: number | null
          start_base: number | null
          start_runner_1b: number | null
          start_runner_2b: number | null
          start_runner_3b: number | null
          team_id: number | null
        }
        Relationships: [
          {
            foreignKeyName: "matches_season_series_id_fkey"
            columns: ["season_series_id"]
            isOneToOne: false
            referencedRelation: "series"
            referencedColumns: ["season_series_id"]
          },
          {
            foreignKeyName: "pitch_participants_batter_id_fkey"
            columns: ["batter_id"]
            isOneToOne: false
            referencedRelation: "players"
            referencedColumns: ["player_id"]
          },
          {
            foreignKeyName: "pitch_participants_match_id_period_inning_bat_turn_at_bat__fkey"
            columns: [
              "match_id",
              "period",
              "inning",
              "bat_turn",
              "at_bat_in_inning",
              "hit_number",
            ]
            isOneToOne: false
            referencedRelation: "pitches"
            referencedColumns: [
              "match_id",
              "period",
              "inning",
              "bat_turn",
              "at_bat_in_inning",
              "hit_number",
            ]
          },
          {
            foreignKeyName: "pitch_participants_player_id_fkey"
            columns: ["player_id"]
            isOneToOne: false
            referencedRelation: "players"
            referencedColumns: ["player_id"]
          },
          {
            foreignKeyName: "pitch_participants_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["team_id"]
          },
          {
            foreignKeyName: "pitches_start_runner_1b_fkey"
            columns: ["start_runner_1b"]
            isOneToOne: false
            referencedRelation: "players"
            referencedColumns: ["player_id"]
          },
          {
            foreignKeyName: "pitches_start_runner_2b_fkey"
            columns: ["start_runner_2b"]
            isOneToOne: false
            referencedRelation: "players"
            referencedColumns: ["player_id"]
          },
          {
            foreignKeyName: "pitches_start_runner_3b_fkey"
            columns: ["start_runner_3b"]
            isOneToOne: false
            referencedRelation: "players"
            referencedColumns: ["player_id"]
          },
        ]
      }
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {},
  },
} as const
