type T3nIdentity = {
  client: unknown;
  address: string;
};

type T3nSdk = {
  T3nClient: new (options: {
    wasmComponent: unknown;
    handlers: { EthSign: unknown };
  }) => {
    handshake(): Promise<unknown>;
    authenticate(input: unknown): Promise<unknown>;
    getUsage(): Promise<{ balance: { available: unknown } }>;
  };
  loadWasmComponent(): Promise<unknown>;
  setEnvironment(environment: string): void;
  createEthAuthInput(address: string): unknown;
  eth_get_address(apiKey: string): string;
  metamask_sign(address: string, provider: undefined, apiKey: string): unknown;
};

async function loadT3NSdk(): Promise<T3nSdk> {
  return await import("@terminal3/t3n-sdk") as unknown as T3nSdk;
}

export async function initT3NIdentity(): Promise<T3nIdentity | null> {
  const apiKey = process.env.T3N_API_KEY!;
  if (!apiKey) {
    console.warn("⚠️  T3N_API_KEY not set — skipping T3N identity init");
    return null;
  }

  try {
    const {
      T3nClient,
      loadWasmComponent,
      setEnvironment,
      createEthAuthInput,
      eth_get_address,
      metamask_sign,
    } = await loadT3NSdk();

    setEnvironment("testnet");

    const address = eth_get_address(apiKey);

    const client = new T3nClient({
      wasmComponent: await loadWasmComponent(),
      handlers: {
        EthSign: metamask_sign(address, undefined, apiKey),
      },
    });

    await client.handshake();
    await client.authenticate(createEthAuthInput(address));

    const { balance } = await client.getUsage();
    console.log(`✅ T3N Identity active`);
    console.log(`   Address : ${address}`);
    console.log(`   Credits : ${balance.available}`);

    return { client, address };
  } catch (err) {
    console.warn("⚠️  T3N identity init failed:", err);
    return null;
  }
}

export async function registerAgentDID(walletAddress: string, did: string) {
  const apiKey = process.env.T3N_API_KEY!;
  if (!apiKey) return;

  const res = await fetch("https://staging.terminal3.io/v1/did/register", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-token": apiKey,
    },
    body: JSON.stringify({
      did,
      wallet_address: walletAddress,
    }),
  });

  const data = await res.json();
  console.log("📋 DID registered:", data);
  return data;
}
