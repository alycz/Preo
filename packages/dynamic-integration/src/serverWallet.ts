import {
  createPublicClient,
  createWalletClient,
  encodeFunctionData,
  http,
  parseEther,
  parseUnits,
  type Chain,
  type Hex
} from "viem";
import { privateKeyToAccount } from "viem/accounts";

export interface PreoAgentWallet {
  getAddress(): Promise<`0x${string}`>;
  sendUsdc(to: `0x${string}`, amountUnits: bigint): Promise<{ txHash: string; simulated: boolean }>;
  sendNative(to: `0x${string}`, amountWei: bigint): Promise<{ txHash: string; simulated: boolean }>;
  signMessage(message: string): Promise<string>;
}

export type AgentWalletConfig = {
  environmentId?: string;
  authToken?: string;
  password?: string;
  address?: `0x${string}`;
  privateKey?: Hex;
  walletMetadataJson?: string;
  keySharesJson?: string;
  backupToDynamic?: boolean;
  chainId?: number;
  rpcUrl?: string;
  tokenAddress?: `0x${string}`;
  demoMode?: boolean;
};

const erc20Abi = [
  {
    type: "function",
    name: "transfer",
    stateMutability: "nonpayable",
    inputs: [
      { name: "to", type: "address" },
      { name: "amount", type: "uint256" }
    ],
    outputs: [{ name: "", type: "bool" }]
  }
] as const;

export function createSettlementChain(chainId = 84532): Chain {
  return {
    id: chainId,
    name: chainId === 84532 ? "Base Sepolia" : `Settlement ${chainId}`,
    nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 },
    rpcUrls: {
      default: { http: [] },
      public: { http: [] }
    }
  };
}

export class DemoAgentWallet implements PreoAgentWallet {
  constructor(private readonly address: `0x${string}` = "0x0000000000000000000000000000000000000000") {}

  async getAddress() {
    return this.address;
  }

  async sendUsdc(_to: `0x${string}`, _amountUnits: bigint) {
    return { txHash: this.demoTxHash("usdc"), simulated: true };
  }

  async sendNative(_to: `0x${string}`, _amountWei: bigint) {
    return { txHash: this.demoTxHash("native"), simulated: true };
  }

  async signMessage(message: string) {
    return `demo-signature:${Buffer.from(message).toString("hex")}`;
  }

  private demoTxHash(label: string) {
    const raw = `preo-dynamic-${label}-${Date.now()}-${Math.random().toString(16).slice(2)}`;
    return `0x${Buffer.from(raw).toString("hex").padEnd(64, "0").slice(0, 64)}`;
  }
}

export class DynamicBackedAgentWallet implements PreoAgentWallet {
  constructor(private readonly config: AgentWalletConfig) {}

  async getAddress(): Promise<`0x${string}`> {
    if (this.config.address) {
      return this.config.address;
    }

    if (this.config.privateKey) {
      return privateKeyToAccount(this.config.privateKey).address;
    }

    const dynamicWallet = await this.getDynamicWallet();
    return dynamicWallet.walletClient.account.address;
  }

  async sendUsdc(to: `0x${string}`, amountUnits: bigint): Promise<{ txHash: string; simulated: boolean }> {
    if (!this.config.tokenAddress) {
      throw new Error("TESTNET_USDC_ADDRESS is required for USDC transfers");
    }

    if (this.config.privateKey) {
      const walletClient = this.createLocalWalletClient();
      const txHash = await walletClient.sendTransaction({
        to: this.config.tokenAddress,
        data: encodeFunctionData({ abi: erc20Abi, functionName: "transfer", args: [to, amountUnits] })
      });
      return { txHash, simulated: false };
    }

    const dynamicWallet = await this.getDynamicWallet();
    const txHash = await dynamicWallet.walletClient.writeContract({
      address: this.config.tokenAddress,
      abi: erc20Abi,
      functionName: "transfer",
      args: [to, amountUnits]
    });
    return { txHash, simulated: false };
  }

  async sendNative(to: `0x${string}`, amountWei: bigint): Promise<{ txHash: string; simulated: boolean }> {
    if (this.config.privateKey) {
      const walletClient = this.createLocalWalletClient();
      const txHash = await walletClient.sendTransaction({ to, value: amountWei });
      return { txHash, simulated: false };
    }

    const dynamicWallet = await this.getDynamicWallet();
    const txHash = await dynamicWallet.walletClient.sendTransaction({ to, value: amountWei });
    return { txHash, simulated: false };
  }

  async signMessage(message: string): Promise<string> {
    if (this.config.privateKey) {
      return privateKeyToAccount(this.config.privateKey).signMessage({ message });
    }

    const dynamicWallet = await this.getDynamicWallet();
    return dynamicWallet.dynamicClient.signMessage({
      message,
      walletMetadata: dynamicWallet.walletMetadata,
      password: this.config.password,
      externalServerKeyShares: dynamicWallet.externalServerKeyShares
    });
  }

  private createLocalWalletClient() {
    if (!this.config.privateKey) {
      throw new Error("DYNAMIC_AGENT_PRIVATE_KEY is not configured");
    }
    if (!this.config.rpcUrl) {
      throw new Error("SETTLEMENT_RPC_URL is required for live wallet transactions");
    }
    const account = privateKeyToAccount(this.config.privateKey);
    return createWalletClient({
      account,
      chain: createSettlementChain(this.config.chainId),
      transport: http(this.config.rpcUrl)
    });
  }

  private async getDynamicWallet() {
    if (!this.config.environmentId) {
      throw new Error("DYNAMIC_ENVIRONMENT_ID is required for Dynamic server wallet");
    }
    if (!this.config.rpcUrl) {
      throw new Error("SETTLEMENT_RPC_URL is required for Dynamic server wallet transactions");
    }

    const importRuntime = new Function("specifier", "return import(specifier)") as (
      specifier: string
    ) => Promise<{ DynamicEvmWalletClient: new (config: { environmentId: string }) => any }>;
    const { DynamicEvmWalletClient } = await importRuntime("@dynamic-labs-wallet/node-evm");
    const dynamicClient = new DynamicEvmWalletClient({
      environmentId: this.config.environmentId
    });

    const chain = createSettlementChain(this.config.chainId);
    const walletMetadata = this.config.walletMetadataJson ? JSON.parse(this.config.walletMetadataJson) : undefined;
    const externalServerKeyShares = this.config.keySharesJson ? JSON.parse(this.config.keySharesJson) : undefined;
    const imported =
      walletMetadata ??
      (this.config.privateKey
        ? await dynamicClient.importPrivateKey({
            privateKey: this.config.privateKey,
            chainName: "EVM",
            thresholdSignatureScheme: "TWO_OF_TWO",
            password: this.config.password,
            backUpToDynamic: this.config.backupToDynamic
          })
        : undefined);

    if (!imported) {
      throw new Error("DYNAMIC_AGENT_WALLET_METADATA_JSON or DYNAMIC_AGENT_PRIVATE_KEY is required for live Dynamic wallet use");
    }

    const resolvedWalletMetadata = "walletMetadata" in imported ? imported.walletMetadata : imported;
    const resolvedExternalServerKeyShares =
      externalServerKeyShares ?? ("externalServerKeyShares" in imported ? imported.externalServerKeyShares : undefined);
    const walletClient = await dynamicClient.getWalletClient({
      walletMetadata: resolvedWalletMetadata,
      password: this.config.password,
      externalServerKeyShares: resolvedExternalServerKeyShares,
      chain,
      chainId: this.config.chainId,
      rpcUrl: this.config.rpcUrl
    });
    const publicClient = createPublicClient({ chain, transport: http(this.config.rpcUrl) });

    return { dynamicClient, walletClient, publicClient, walletMetadata: resolvedWalletMetadata, externalServerKeyShares: resolvedExternalServerKeyShares };
  }
}

export function createAgentWalletFromEnv(env: NodeJS.ProcessEnv = process.env): PreoAgentWallet {
  const config: AgentWalletConfig = {
    environmentId: env.DYNAMIC_ENVIRONMENT_ID,
    authToken: env.DYNAMIC_AUTH_TOKEN,
    password: env.DYNAMIC_AGENT_WALLET_PASSWORD,
    address: env.DYNAMIC_AGENT_WALLET_ADDRESS as `0x${string}` | undefined,
    privateKey: env.DYNAMIC_AGENT_PRIVATE_KEY as Hex | undefined,
    walletMetadataJson: env.DYNAMIC_AGENT_WALLET_METADATA_JSON,
    keySharesJson: env.DYNAMIC_AGENT_KEY_SHARES_JSON,
    backupToDynamic: env.DYNAMIC_WALLET_BACKUP_TO_DYNAMIC === "true",
    chainId: env.SETTLEMENT_CHAIN_ID ? Number(env.SETTLEMENT_CHAIN_ID) : 84532,
    rpcUrl: env.SETTLEMENT_RPC_URL,
    tokenAddress: env.TESTNET_USDC_ADDRESS as `0x${string}` | undefined,
    demoMode: env.DEMO_MODE === "true"
  };

  if (config.demoMode || (!config.privateKey && !config.walletMetadataJson)) {
    return new DemoAgentWallet(config.address);
  }

  return new DynamicBackedAgentWallet(config);
}

export function parseAssetUnits(amount: string, asset: string) {
  return asset.toUpperCase() === "ETH" ? parseEther(amount) : parseUnits(amount, 6);
}
