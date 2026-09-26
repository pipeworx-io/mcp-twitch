# mcp-twitch

Twitch MCP — wraps the Twitch Helix API (read-only)

Part of [Pipeworx](https://pipeworx.io) — an MCP gateway connecting AI agents to 1684+ live data sources.

## Tools

| Tool | Description |
|------|-------------|
| `top_games` | Get the top games currently being streamed on Twitch, ranked by number of viewers. Returns game id, name, and box art. Example: top_games({ first: 20 }) |
| `get_streams` | Get live Twitch streams, optionally filtered by game name and/or language. Returns streamer name, title, current viewer count, and thumbnail for each live stream. Omit `game` for the overall top live streams across Twitch. Example: get_streams({ game: "Just Chatting", first: 20, language: "en" }) |
| `search_channels` | Search Twitch channels/streamers by name or keyword. Returns matching channels with display name, the game they stream, whether they are live now, title, and thumbnail. Example: search_channels({ query: "ninja", live_only: true }) |
| `get_user` | Look up a Twitch user/channel by login (username). Returns profile info: id, display name, description, view count, broadcaster type, account creation date, and profile image. Example: get_user({ login: "ninja" }) |

## Quick Start

Add to your MCP client (Claude Desktop, Cursor, Windsurf, etc.):

```json
{
  "mcpServers": {
    "twitch": {
      "url": "https://gateway.pipeworx.io/twitch/mcp"
    }
  }
}
```

### What this endpoint actually serves

`tools/list` at `https://gateway.pipeworx.io/twitch/mcp` returns the tools in the table
above **plus the shared Pipeworx meta-tools** — `ask_pipeworx`,
`discover_tools`, `search_within`, `remember`/`recall` and the rest of the
gateway-wide set. So the tool count you see is larger than this table: a
single-pack endpoint currently lists roughly 30 shared tools alongside the
pack's own. The connection's `initialize` response states its exact scope, and
is the authoritative answer for a given day.

This is deliberate, not multiplexing by accident. The meta-tools are what let a
scoped connection answer a question this pack does not cover — via
`ask_pipeworx`, which routes across the whole catalog — without you adding a
second MCP server. There is currently no way to mount a pack endpoint without
them; if the extra schemas cost you more context than the routing is worth,
connect to the full gateway once rather than to several pack endpoints.

Or connect to the full Pipeworx gateway to get every pack's tools listed
directly, instead of just this one's:

```json
{
  "mcpServers": {
    "pipeworx": {
      "url": "https://gateway.pipeworx.io/mcp"
    }
  }
}
```

Both URLs reach the same gateway and the same 1684+ data sources. The
only difference is which pack's tools are listed **directly**; `ask_pipeworx`
reaches all of them from either one.

## No MCP client? Call it over HTTP

```bash
curl -X POST https://gateway.pipeworx.io/v1/tools/top_games \
  -H 'Content-Type: application/json' \
  -d '{"first":20}'
```

No account needed for the first calls. Inspect any tool: `GET https://gateway.pipeworx.io/v1/tools/top_games`. Find one: `POST https://gateway.pipeworx.io/v1/tools/search_packs` with `{"query":"..."}`.

## Standalone (no gateway account)

This package also runs as a local stdio MCP server — no Pipeworx account, no
gateway round-trip:

```json
{
  "mcpServers": {
    "twitch": {
      "command": "npx",
      "args": ["-y", "@pipeworx/mcp-twitch"]
    }
  }
}
```

Or run it directly to confirm it starts:

```bash
npx -y @pipeworx/mcp-twitch
```

It speaks MCP over stdin/stdout and answers `initialize`/`tools/list`/`tools/call`
for **only** this pack's tools — none of the shared meta-tools the gateway
connection above adds. Same source, same tools, no ask_pipeworx routing.

## Using with ask_pipeworx

Instead of calling tools directly, you can ask questions in plain English —
this works on the pack endpoint above as well as on the full gateway:

```
ask_pipeworx({ question: "your question about Twitch data" })
```

The gateway picks the right tool and fills the arguments automatically.

## More

- [Docs and guides](https://pipeworx.io/docs)
- [pipeworx.io](https://pipeworx.io)

## License

MIT
