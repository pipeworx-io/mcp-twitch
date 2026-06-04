interface McpToolDefinition {
  name: string;
  description: string;
  inputSchema: {
    type: 'object';
    properties: Record<string, unknown>;
    required?: string[];
  };
}

interface McpToolExport {
  tools: McpToolDefinition[];
  callTool: (name: string, args: Record<string, unknown>) => Promise<unknown>;
  meter?: { credits: number };
  cost?: Record<string, unknown>;
  provider?: string;
}

/**
 * Twitch MCP — wraps the Twitch Helix API (read-only)
 *
 * Tools:
 * - top_games: the top games currently being streamed on Twitch
 * - get_streams: live streams, optionally filtered by game name / language
 * - search_channels: search Twitch channels/streamers by name
 * - get_user: look up a Twitch user/channel by login (username)
 *
 * SPECIAL AUTH — Twitch uses OAuth client-credentials. The credential is
 * passed as `_apiKey` in the form "CLIENT_ID:CLIENT_SECRET". We exchange it
 * for a short-lived app access token (https://id.twitch.tv/oauth2/token) on
 * every call — packs are stateless, so a fresh token per call is fine.
 *
 * _apiKey is OPTIONAL — omit it to use the shared Pipeworx Twitch credential.
 */


const HELIX = 'https://api.twitch.tv/helix';
const TOKEN_URL = 'https://id.twitch.tv/oauth2/token';

// Exchange a Client-ID + Client-Secret pair for a short-lived app access
// token via the OAuth2 client-credentials grant. Returns the access_token.
async function getAppToken(clientId: string, clientSecret: string): Promise<string> {
  const body = new URLSearchParams({
    client_id: clientId,
    client_secret: clientSecret,
    grant_type: 'client_credentials',
  });
  const res = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: body.toString(),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Twitch token exchange failed (${res.status}): ${text}`);
  }
  const data = (await res.json()) as { access_token?: string; expires_in?: number };
  if (!data.access_token) {
    throw new Error('Twitch token exchange returned no access_token.');
  }
  return data.access_token;
}

// Helix GET helper. Non-2xx → structured { error, message }.
async function helixGet(
  path: string,
  clientId: string,
  token: string,
): Promise<{ ok: true; json: any } | { ok: false; error: number; message: string }> {
  const res = await fetch(`${HELIX}${path}`, {
    headers: {
      'Client-Id': clientId,
      Authorization: `Bearer ${token}`,
    },
  });
  if (!res.ok) {
    const message = await res.text();
    return { ok: false, error: res.status, message };
  }
  return { ok: true, json: await res.json() };
}

const KEY_DESC =
  'Optional — your own Twitch credentials as CLIENT_ID:CLIENT_SECRET for higher limits; omit to use the shared Pipeworx key.';

const tools: McpToolExport['tools'] = [
  {
    name: 'top_games',
    description:
      'Get the top games currently being streamed on Twitch, ranked by number of viewers. Returns game id, name, and box art. Example: top_games({ first: 20 })',
    inputSchema: {
      type: 'object',
      properties: {
        first: {
          type: 'number',
          description: 'Number of games to return (default 20, max 100)',
        },
        _apiKey: { type: 'string', description: KEY_DESC },
      },
    },
  },
  {
    name: 'get_streams',
    description:
      'Get live Twitch streams, optionally filtered by game name and/or language. Returns streamer name, title, current viewer count, and thumbnail for each live stream. Omit `game` for the overall top live streams across Twitch. Example: get_streams({ game: "Just Chatting", first: 20, language: "en" })',
    inputSchema: {
      type: 'object',
      properties: {
        game: {
          type: 'string',
          description: 'Game NAME to filter by (e.g. "Fortnite", "Just Chatting"). Resolved to a game id automatically.',
        },
        first: {
          type: 'number',
          description: 'Number of streams to return (default 20, max 100)',
        },
        language: {
          type: 'string',
          description: 'Optional ISO-639-1 language code to filter by, e.g. "en", "es", "ja".',
        },
        _apiKey: { type: 'string', description: KEY_DESC },
      },
    },
  },
  {
    name: 'search_channels',
    description:
      'Search Twitch channels/streamers by name or keyword. Returns matching channels with display name, the game they stream, whether they are live now, title, and thumbnail. Example: search_channels({ query: "ninja", live_only: true })',
    inputSchema: {
      type: 'object',
      properties: {
        query: {
          type: 'string',
          description: 'Search query — channel/streamer name or keyword, e.g. "ninja", "valorant".',
        },
        first: {
          type: 'number',
          description: 'Number of channels to return (default 20, max 100)',
        },
        live_only: {
          type: 'boolean',
          description: 'If true, only return channels that are currently live.',
        },
        _apiKey: { type: 'string', description: KEY_DESC },
      },
      required: ['query'],
    },
  },
  {
    name: 'get_user',
    description:
      'Look up a Twitch user/channel by login (username). Returns profile info: id, display name, description, view count, broadcaster type, account creation date, and profile image. Example: get_user({ login: "ninja" })',
    inputSchema: {
      type: 'object',
      properties: {
        login: {
          type: 'string',
          description: 'Twitch username (login), e.g. "ninja", "pokimane".',
        },
        _apiKey: { type: 'string', description: KEY_DESC },
      },
      required: ['login'],
    },
  },
];

async function callTool(name: string, args: Record<string, unknown>): Promise<unknown> {
  const combined = args._apiKey as string | undefined;
  delete args._apiKey;

  const [clientId, clientSecret] = (combined || '').split(':');
  if (!clientId || !clientSecret) {
    return {
      error: 'api_key_required',
      message: 'No Twitch credentials available (need CLIENT_ID:CLIENT_SECRET).',
    };
  }

  const token = await getAppToken(clientId, clientSecret);

  switch (name) {
    case 'top_games':
      return topGames(args, clientId, token);
    case 'get_streams':
      return getStreams(args, clientId, token);
    case 'search_channels':
      return searchChannels(args, clientId, token);
    case 'get_user':
      return getUser(args, clientId, token);
    default:
      throw new Error(`Unknown tool: ${name}`);
  }
}

function clampFirst(value: unknown, fallback = 20): number {
  const n = Number(value);
  if (!Number.isFinite(n) || n <= 0) return fallback;
  return Math.min(100, Math.floor(n));
}

async function topGames(args: Record<string, unknown>, clientId: string, token: string) {
  const first = clampFirst(args.first);
  const r = await helixGet(`/games/top?first=${first}`, clientId, token);
  if (!r.ok) return { error: r.error, message: r.message };

  const data = (r.json.data ?? []) as Array<{ id: string; name: string; box_art_url: string }>;
  return {
    games: data.map((g) => ({ id: g.id, name: g.name, box_art: g.box_art_url })),
  };
}

async function getStreams(args: Record<string, unknown>, clientId: string, token: string) {
  const first = clampFirst(args.first);
  const game = args.game as string | undefined;
  const language = args.language as string | undefined;

  let path: string;
  if (game) {
    const gr = await helixGet(`/games?name=${encodeURIComponent(game)}`, clientId, token);
    if (!gr.ok) return { error: gr.error, message: gr.message };
    const gameId = gr.json.data?.[0]?.id as string | undefined;
    if (!gameId) {
      return { error: 'not_found', message: `No Twitch game found matching "${game}".` };
    }
    path = `/streams?game_id=${encodeURIComponent(gameId)}&first=${first}`;
  } else {
    path = `/streams?first=${first}`;
  }
  if (language) path += `&language=${encodeURIComponent(language)}`;

  const r = await helixGet(path, clientId, token);
  if (!r.ok) return { error: r.error, message: r.message };

  const data = (r.json.data ?? []) as Array<{
    id: string; user_name: string; game_name: string; title: string;
    viewer_count: number; language: string; started_at: string; thumbnail_url: string;
  }>;
  return {
    streams: data.map((s) => ({
      id: s.id,
      user_name: s.user_name,
      game_name: s.game_name,
      title: s.title,
      viewer_count: s.viewer_count,
      language: s.language,
      started_at: s.started_at,
      thumbnail: s.thumbnail_url,
    })),
  };
}

async function searchChannels(args: Record<string, unknown>, clientId: string, token: string) {
  const query = args.query as string | undefined;
  if (!query) {
    return { error: 'invalid_args', message: 'search_channels requires a `query`.' };
  }
  const first = clampFirst(args.first);
  let path = `/search/channels?query=${encodeURIComponent(query)}&first=${first}`;
  if (args.live_only) path += `&live_only=true`;

  const r = await helixGet(path, clientId, token);
  if (!r.ok) return { error: r.error, message: r.message };

  const data = (r.json.data ?? []) as Array<{
    id: string; display_name: string; game_name: string; is_live: boolean;
    title: string; started_at: string; thumbnail_url: string;
  }>;
  return {
    channels: data.map((c) => ({
      id: c.id,
      display_name: c.display_name,
      game_name: c.game_name,
      is_live: c.is_live,
      title: c.title,
      started_at: c.started_at,
      thumbnail: c.thumbnail_url,
    })),
  };
}

async function getUser(args: Record<string, unknown>, clientId: string, token: string) {
  const login = args.login as string | undefined;
  if (!login) {
    return { error: 'invalid_args', message: 'get_user requires a `login` (Twitch username).' };
  }
  const r = await helixGet(`/users?login=${encodeURIComponent(login)}`, clientId, token);
  if (!r.ok) return { error: r.error, message: r.message };

  const u = (r.json.data ?? [])[0] as
    | {
        id: string; login: string; display_name: string; description: string;
        view_count: number; broadcaster_type: string; created_at: string; profile_image_url: string;
      }
    | undefined;
  if (!u) {
    return { error: 'not_found', message: `No Twitch user found with login "${login}".` };
  }
  return {
    id: u.id,
    login: u.login,
    display_name: u.display_name,
    description: u.description,
    view_count: u.view_count,
    broadcaster_type: u.broadcaster_type,
    created_at: u.created_at,
    profile_image: u.profile_image_url,
  };
}

export default { tools, callTool, meter: { credits: 1 } } satisfies McpToolExport;
