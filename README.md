# mcp-twitch

Twitch MCP — wraps the Twitch Helix API (read-only)

Part of [Pipeworx](https://pipeworx.io) — an MCP gateway connecting AI agents to 1394+ live data sources.

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

Or connect to the full Pipeworx gateway for access to all 1394+ data sources:

```json
{
  "mcpServers": {
    "pipeworx": {
      "url": "https://gateway.pipeworx.io/mcp"
    }
  }
}
```

## Using with ask_pipeworx

Instead of calling tools directly, you can ask questions in plain English:

```
ask_pipeworx({ question: "your question about Twitch data" })
```

The gateway picks the right tool and fills the arguments automatically.

## More

- [Docs and guides](https://pipeworx.io/docs)
- [pipeworx.io](https://pipeworx.io)

## License

MIT
