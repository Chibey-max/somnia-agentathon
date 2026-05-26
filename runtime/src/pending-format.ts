export function describeSelector(selector: `0x${string}`): string {
  switch (selector.toLowerCase()) {
    case "0x00000000":
      return "native ETH transfer / empty calldata"
    case "0xa9059cbb":
      return "ERC20 transfer(address,uint256)"
    case "0x095ea7b3":
      return "ERC20 approve(address,uint256)"
    case "0x23b872dd":
      return "ERC20 transferFrom(address,address,uint256)"
    default:
      return "unknown selector"
  }
}

export function formatUnlockTime(unlockTime: bigint): string[] {
  if (unlockTime === 0n) return ["unlockTime is 0, so no real unlock date is set"]

  const unlockDate = new Date(Number(unlockTime) * 1000)
  const nowSeconds = BigInt(Math.floor(Date.now() / 1000))
  const secondsRemaining = unlockTime > nowSeconds ? unlockTime - nowSeconds : 0n

  return [
    `Unix unlockTime: ${unlockTime.toString()}`,
    `Local unlock time: ${unlockDate.toLocaleString()} (${Intl.DateTimeFormat().resolvedOptions().timeZone})`,
    `UTC unlock time: ${unlockDate.toISOString()}`,
    `Seconds remaining: ${secondsRemaining.toString()}`
  ]
}
