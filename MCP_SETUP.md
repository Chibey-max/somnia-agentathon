# somnia-agent MCP integration

This repo is configured so MCP works after cloning without hardcoded local paths.

## Project-level command

From the repo root:

```bash
npm run -s mcp
```

The root `package.json` proxies this to:

```bash
npm --prefix runtime run -s mcp
```

The `-s`/silent flag is important for MCP stdio clients because npm's normal banner output can pollute the JSON-RPC stdio stream.

So users can clone the repo anywhere and still run the MCP server from the project root.

If you open the `runtime/` folder directly instead of the repo root, `npm run -s mcp` also works because `runtime/package.json` has its own `mcp` script.

## Available tools

- `read_eth_balance`
- `transfer_eth`
- `transfer_token`
- `get_tx_status`
- `get_agent_info`

> Safety: `transfer_eth` and `transfer_token` can submit real Somnia Testnet transactions. Keep this MCP server available only to trusted agentic clients.

## Cursor

Project config is present at:

```text
.cursor/mcp.json
```

It uses:

```json
{
  "mcpServers": {
    "somnia-agent": {
      "command": "npm",
      "args": ["run", "-s", "mcp"]
    }
  }
}
```

## Kiro

Project config is present at:

```text
.kiro/mcp.json
```

It uses the same portable `npm run -s mcp` command.

## VS Code MCP-compatible clients

Project config is present at:

```text
.vscode/mcp.json
```

It uses the same portable `npm run -s mcp` command.

## Zed

Project config is present at:

```text
.zed/settings.json
```

It uses the same portable `npm run -s mcp` command.

## Claude Desktop or other global MCP clients

Global MCP configs usually live outside the repo, so they cannot reliably use project-relative paths unless the client supports `cwd`.

After cloning, set `cwd` to your local clone path:

```json
{
  "mcpServers": {
    "somnia-agent": {
      "command": "npm",
      "args": ["run", "-s", "mcp"],
      "cwd": "/path/to/your/somnia-agent-kit"
    }
  }
}
```

If your global client ignores `cwd`, use an absolute `--prefix` path for that local machine:

```json
{
  "mcpServers": {
    "somnia-agent": {
      "command": "npm",
      "args": ["--prefix", "/path/to/your/somnia-agent-kit/runtime", "run", "-s", "mcp"]
    }
  }
}
```

## Manual start test

From the repo root:

```bash
npm run -s mcp
```

Expected stderr output:

```text
somnia-agent MCP server running on stdio
```

Stop it with `Ctrl+C`. In normal use, your MCP client launches it automatically.
