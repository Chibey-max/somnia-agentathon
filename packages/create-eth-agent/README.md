# create-somnia-agent

Create a Somnia AI agent project in seconds.

## Usage

```bash
npx create-somnia-agent@latest my-project
```

## What it scaffolds

- TypeScript MCP server project wired to `somnia-agent-kit`
- `.env.example` with required environment variables
- `npm run build` and `npm run setup` scripts
- IDE MCP configuration helper (`scripts/setup.ts`)

## After scaffold

```bash
cd my-project
cp .env.example .env
# fill in .env
npm run build
npm run setup
```

Then restart your IDE and prompt your assistant (for example: "What is my STT balance?").

## Troubleshooting

If `npm run build` fails with TypeScript errors from `node_modules/ox/...`, ensure your scaffold contains:

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "lib": ["ES2022", "DOM"]
  }
}
```

This fix is included in `create-somnia-agent@0.1.1+`.
