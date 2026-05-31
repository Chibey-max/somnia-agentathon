import { ETHAgent } from 'eth-agent-kit'
import * as dotenv from 'dotenv'

dotenv.config()

const agent = new ETHAgent({
  contractAddress: process.env.AGENT_CONTRACT_ADDRESS as `0x${string}`,
  privateKey: process.env.AGENT_PRIVATE_KEY as `0x${string}`,
  rpcUrl: process.env.RPC_URL ?? process.env.ALCHEMY_RPC_URL ?? 'https://rpc.ankr.com/eth_sepolia',
  groqApiKey: process.env.GROQ_API_KEY,
  openRouterApiKey: process.env.OPENROUTER_API_KEY,
  googleApiKey: process.env.GOOGLE_API_KEY,
  chainId: process.env.CHAIN_ID ? Number(process.env.CHAIN_ID) : 11155111,
  guardianAddress: process.env.GUARDIAN_ADDRESS
})

void agent.startMCPServer()
