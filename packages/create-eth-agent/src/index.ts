#!/usr/bin/env node

import fs from 'node:fs'
import path from 'node:path'

import readline from 'node:readline/promises'
import { spawnSync } from 'node:child_process'

function copyDirRecursive(src: string, dest: string): void {
  fs.mkdirSync(dest, { recursive: true })
  for (const entry of fs.readdirSync(src, { withFileTypes: true })) {
    const s = path.join(src, entry.name)
    const d = path.join(dest, entry.name)
    if (entry.isDirectory()) copyDirRecursive(s, d)
    else fs.copyFileSync(s, d)
  }
}

async function ask(question: string): Promise<string> {
  const rl = readline.createInterface({ input: process.stdin, output: process.stderr })
  const answer = await rl.question(question)
  rl.close()
  return answer.trim()
}

async function main(): Promise<void> {
  process.stderr.write('🤖 ETH Agent Kit\n')
  process.stderr.write('Ethereum AI agent with on-chain policy enforcement\n\n')

  let projectName = process.argv[2]?.trim()
  if (!projectName) projectName = await ask('Project name: ')

  if (!projectName) {
    process.stderr.write('Project name is required.\n')
    process.exit(1)
  }

  const cwd = process.cwd()
  const targetDir = path.resolve(cwd, projectName)
  const templateDir = path.resolve(__dirname, '../templates/default')

  if (fs.existsSync(targetDir)) {
    const overwrite = (await ask(`Folder ${projectName} already exists. Overwrite? (y/N): `)).toLowerCase()
    if (overwrite !== 'y' && overwrite !== 'yes') {
      process.stderr.write('Aborted.\n')
      process.exit(1)
    }
    fs.rmSync(targetDir, { recursive: true, force: true })
  }

  copyDirRecursive(templateDir, targetDir)

  const pkgPath = path.join(targetDir, 'package.json')
  const pkg = fs
    .readFileSync(pkgPath, 'utf8')
    .replaceAll('{{PROJECT_NAME}}', projectName)
    .replaceAll('eth-agent-template', projectName)
  fs.writeFileSync(pkgPath, pkg)

  // Local workspace fallback so scaffolding works before npm publish.
  const localKitPath = path.resolve(cwd, 'packages/eth-agent-kit')
  if (fs.existsSync(localKitPath)) {
    const parsed = JSON.parse(fs.readFileSync(pkgPath, 'utf8')) as {
      dependencies?: Record<string, string>
    }
    parsed.dependencies = parsed.dependencies ?? {}
    parsed.dependencies['eth-agent-kit'] = `file:${path.relative(targetDir, localKitPath)}`
    fs.writeFileSync(pkgPath, JSON.stringify(parsed, null, 2))
  }

  process.stderr.write('Installing dependencies...\n')
  const install = spawnSync('npm', ['install'], { cwd: targetDir, stdio: 'inherit' })
  if (install.status !== 0) {
    process.stderr.write('npm install failed.\n')
    process.exit(1)
  }

  process.stderr.write(`\n✅ ${projectName} is ready!\n\n`)
  process.stderr.write(`cd ${projectName}\n\n`)
  process.stderr.write('Fill in .env:\n')
  process.stderr.write('  AGENT_CONTRACT_ADDRESS=   deployed AgentWallet address\n')
  process.stderr.write('  AGENT_PRIVATE_KEY=        agent role private key\n')
  process.stderr.write('  RPC_URL=                  https://rpc.ankr.com/eth_sepolia\n')
  process.stderr.write('  GROQ_API_KEY=             free at console.groq.com\n\n')
  process.stderr.write('Build and connect to your IDE:\n')
  process.stderr.write('  npm run build\n')
  process.stderr.write('  npm run setup\n\n')
  process.stderr.write('Then restart your IDE and try:\n')
  process.stderr.write('  "What is my ETH balance?"\n')
  process.stderr.write('  "What are my spending limits?"\n')
  process.stderr.write('  "Send 0.01 ETH to 0x..."\n\n')
  process.stderr.write('Docs: github.com/Chibey-max/eth-agent\n')
}

void main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error)
  process.stderr.write(`${message}\n`)
  process.exit(1)
})
