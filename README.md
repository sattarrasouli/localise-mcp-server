# localise-mcp-server

MCP server for [Localise.biz](https://localise.biz) — manage translations directly from Claude, Cursor, or any MCP client.

## Setup

```bash
npx localise-mcp-server
```

Requires a `LOCALISE_API_KEY` environment variable. Get yours from [Localise.biz API Keys](https://localise.biz/account/developer/keys).

### Claude Desktop

Add to your `claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "localise-biz": {
      "command": "npx",
      "args": ["-y", "localise-mcp-server"],
      "env": {
        "LOCALISE_API_KEY": "your-api-key"
      }
    }
  }
}
```

### Claude Code (CLI)

```bash
claude mcp add localise-biz -- npx -y localise-mcp-server
```

Then set your API key in your environment:

```bash
export LOCALISE_API_KEY="your-api-key"
```

### Cursor

Add to `.cursor/mcp.json` in your project:

```json
{
  "mcpServers": {
    "localise-biz": {
      "command": "npx",
      "args": ["-y", "localise-mcp-server"],
      "env": {
        "LOCALISE_API_KEY": "your-api-key"
      }
    }
  }
}
```

## Tools

| Tool | Description |
|------|-------------|
| `list_locales` | List all locales in the project |
| `list_assets` | List translation keys, with optional filter |
| `create_asset` | Create a new translation key |
| `translate` | Add or update a translation for a key + locale |
| `get_translations` | Get all translations for a key across locales |
| `export_locale` | Export a locale (json, xml, csv, xliff, po) |
| `batch_translate` | Create a key and add multiple translations at once |

## Examples

> "List all locales in my project"

> "Create a key `buttons.submit` with translations: English 'Submit', French 'Soumettre', German 'Einreichen'"

> "Export all French translations as JSON"

> "What's the translation for `home.title` across all locales?"

## License

MIT
