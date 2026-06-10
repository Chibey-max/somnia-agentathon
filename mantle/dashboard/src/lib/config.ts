export interface ContractAddresses {
  walletAddress: string;
  identityAddress: string;
  vaultAddress: string;
}

export function getContractAddresses(): ContractAddresses | null {
  if (typeof window === "undefined") return null;
  return {
    walletAddress: localStorage.getItem("AGENT_CONTRACT_ADDRESS") || "",
    identityAddress: localStorage.getItem("IDENTITY_CONTRACT_ADDRESS") || "",
    vaultAddress: localStorage.getItem("TRADING_VAULT_ADDRESS") || "",
  };
}

export function saveContractAddresses(addresses: ContractAddresses): void {
  localStorage.setItem("AGENT_CONTRACT_ADDRESS", addresses.walletAddress);
  localStorage.setItem("IDENTITY_CONTRACT_ADDRESS", addresses.identityAddress);
  localStorage.setItem("TRADING_VAULT_ADDRESS", addresses.vaultAddress);
}
