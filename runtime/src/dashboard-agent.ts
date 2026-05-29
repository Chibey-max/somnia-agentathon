import { runAgent } from "./bridge"

const goal = process.argv.slice(2).join(" ").trim()

if (!goal) {
  console.log(JSON.stringify({ type: "error", content: "Missing goal" }))
  process.exit(1)
}

runAgent(goal, (chunk) => {
  console.log(JSON.stringify(chunk))
}).catch((error) => {
  const content = error instanceof Error ? error.message : String(error)
  console.log(JSON.stringify({ type: "error", content }))
  process.exit(1)
})
