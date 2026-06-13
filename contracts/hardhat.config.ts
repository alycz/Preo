import { HardhatUserConfig } from "hardhat/config";
import "@nomicfoundation/hardhat-toolbox";

const settlementChainId = process.env.SETTLEMENT_CHAIN_ID ? Number(process.env.SETTLEMENT_CHAIN_ID) : 84532;
const settlementRpcUrl = process.env.SETTLEMENT_RPC_URL;
const deployerPrivateKey = process.env.DEPLOYER_PRIVATE_KEY ?? process.env.DYNAMIC_AGENT_PRIVATE_KEY;
const networks: HardhatUserConfig["networks"] = {};

if (settlementRpcUrl && deployerPrivateKey) {
  networks.settlement = {
    url: settlementRpcUrl,
    chainId: settlementChainId,
    accounts: [deployerPrivateKey]
  };
}

const config: HardhatUserConfig = {
  solidity: {
    version: "0.8.24",
    settings: {
      optimizer: {
        enabled: true,
        runs: 200
      }
    }
  },
  networks
};

export default config;
