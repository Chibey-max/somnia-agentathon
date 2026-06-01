# eth-agent-kit

Ethereum AI agent framework. Connect an AI assistant to an
`AgentWallet` smart contract with enforced spending limits.

## Install

```bash
npm install eth-agent-kit
```

## Features

- On-chain policy-enforced ETH/token execution via `AgentWallet`
- AI provider fallback support (Groq, OpenRouter, Google)
- Direct SDK calls (`run`, `transferETH`, `getState`, `preflight`)
- MCP server startup for IDE integration (`startMCPServer`)

## Usage

```ts
import { ETHAgent } from 'eth-agent-kit'

const agent = new ETHAgent({
  contractAddress: '0x...',
  privateKey: '0x...',
  rpcUrl: 'https://rpc.ankr.com/eth_sepolia',
  groqApiKey: 'gsk_...'
})

// Ask the agent anything
const result = await agent.run('What is my ETH balance?')

// Stream events
await agent.run('Send 0.01 ETH to 0x...', (event) => {
  if (event.type === 'tool_call') console.log('Calling:', event.name)
  if (event.type === 'done') console.log('Result:', event.content)
})

// Direct transfer
const tx = await agent.transferETH('0x...', '0.01')
console.log('Sent:', tx.etherscanUrl)

// Read contract state
const state = await agent.getState()
console.log('Balance:', state.balance, 'ETH')

// Start as MCP server for IDE
agent.startMCPServer()
```
