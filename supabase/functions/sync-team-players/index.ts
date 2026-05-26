import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';
import { syncTeamPlayers } from '../_shared/syncTeamPlayers.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

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
    const team_id = Number(body?.team_id);
    const season_series_id = Number(body?.season_series_id);

    if (!Number.isFinite(team_id) || !Number.isFinite(season_series_id)) {
      return new Response(
        JSON.stringify({
          status: 'error',
          error: 'team_id and season_series_id (numbers) are required',
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    const supabase = createClient(supabaseUrl, serviceKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    const result = await syncTeamPlayers(supabase, team_id, season_series_id, apiKey);
    const status = result.status === 'error' ? 500 : 200;

    return new Response(JSON.stringify(result), {
      status,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (err) {
    console.error('[sync-team-players] Unhandled error:', err);
    return new Response(
      JSON.stringify({ status: 'error', error: String(err) }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  }
});
