import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';
import { fetchAndParseMatch, fetchAndParseMatchBatch } from '../_shared/fetchAndParse.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

interface MatchInput {
  match_id: number;
  match_date_iso?: string | null;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const apiKey = Deno.env.get('PESISTULOKSET_API_KEY');
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

    if (!apiKey || !supabaseUrl || !serviceKey) {
      return new Response(
        JSON.stringify({ status: 'error', error: 'Missing env vars' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    const body = await req.json().catch(() => ({}));
    const supabase = createClient(supabaseUrl, serviceKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    // Tukee kahta muotoa:
    // 1) { match_id: 123, match_date_iso?: "..." }            → yksittäinen
    // 2) { matches: [{ match_id, match_date_iso? }, ...] }    → erä
    if (Array.isArray(body?.matches)) {
      const matches: MatchInput[] = body.matches
        .map((m: any) => ({
          match_id: Number(m?.match_id),
          match_date_iso: m?.match_date_iso ?? null,
        }))
        .filter((m: MatchInput) => Number.isFinite(m.match_id));

      if (matches.length === 0) {
        return new Response(
          JSON.stringify({ status: 'error', error: 'matches[] is empty or invalid' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
        );
      }

      const concurrency = Number(body?.concurrency) || 6;
      const results = await fetchAndParseMatchBatch(supabase, matches, apiKey, { concurrency });

      return new Response(
        JSON.stringify({ status: 'success', count: results.length, results }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    const match_id = Number(body?.match_id);
    if (!Number.isFinite(match_id)) {
      return new Response(
        JSON.stringify({
          status: 'error',
          error: 'match_id (number) or matches[] is required',
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    const match_date_iso: string | null = body?.match_date_iso ?? null;
    const result = await fetchAndParseMatch(supabase, match_id, match_date_iso, apiKey);
    const status = result.status === 'error' ? 500 : 200;

    return new Response(JSON.stringify(result), {
      status,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (err) {
    console.error('[fetch-and-parse-match] Unhandled error:', err);
    return new Response(
      JSON.stringify({ status: 'error', error: String(err) }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  }
});
