import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import { tools, toMcpTools } from "./tools";
import { executeTool } from "./executor";

/**
 * Mantle Agent MCP Server
 * Exposes all 12 agent tools via Model Context Protocol over stdio transport
 */
const server = new Server(
  {
    name: "mantle-agent",
    version: "1.0.0",
  },
  {
    capabilities: {
      tools: {},
    },
  }
);

// ─── List Tools ────────────────────────────────────────────────────────────────
server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: toMcpTools(),
  };
});

// ─── Execute Tools ─────────────────────────────────────────────────────────────
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  if (!(name in tools)) {
    return {
      content: [
        {
          type: "text",
          text: JSON.stringify({ success: false, error: `Unknown tool: ${name}` }),
        },
      ],
      isError: true,
    };
  }

  console.error(`[mcp] Tool called: ${name}`, args);

  const result = await executeTool(name, (args || {}) as Record<string, unknown>);

  if (!result.success) {
    return {
      content: [
        {
          type: "text",
          text: JSON.stringify(result),
        },
      ],
      isError: true,
    };
  }

  return {
    content: [
      {
        type: "text",
        text: JSON.stringify(result.data, null, 2),
      },
    ],
  };
});

// ─── Start Server ──────────────────────────────────────────────────────────────
async function main(): Promise<void> {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("[mcp] Mantle Agent MCP Server running on stdio");
  console.error(`[mcp] Available tools: ${Object.keys(tools).join(", ")}`);
}

main().catch((err) => {
  console.error("[mcp] Fatal error:", err);
  process.exit(1);
});
