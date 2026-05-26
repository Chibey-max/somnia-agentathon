import { runAgent } from "./agent"
const goal = process.argv.slice(2).join(" ") || "Check my ETH balance"
runAgent(goal).catch(err => { console.error(err); process.exit(1) })