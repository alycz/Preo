import fs from "node:fs";
import path from "node:path";
import { ethers, network } from "hardhat";

async function main() {
  const [deployer] = await ethers.getSigners();
  const deployMock =
    process.env.DEPLOY_MOCK_USDC === "true" || !process.env.TESTNET_USDC_ADDRESS;

  let tokenAddress = process.env.TESTNET_USDC_ADDRESS;
  if (deployMock) {
    const MockUSDC = await ethers.getContractFactory("MockUSDC");
    const mock = await MockUSDC.deploy(deployer.address);
    await mock.waitForDeployment();
    tokenAddress = await mock.getAddress();
  }

  if (!tokenAddress) {
    throw new Error("TESTNET_USDC_ADDRESS is required when DEPLOY_MOCK_USDC is not true");
  }

  const PreoFundingVault = await ethers.getContractFactory("PreoFundingVault");
  const vault = await PreoFundingVault.deploy(deployer.address);
  await vault.waitForDeployment();

  const vaultAddress = await vault.getAddress();
  await (await vault.setSupportedToken(tokenAddress, true)).wait();

  const agentAddress = process.env.DYNAMIC_AGENT_WALLET_ADDRESS;
  if (agentAddress) {
    await (await vault.setAuthorizedAgent(agentAddress, true)).wait();
  }

  const artifact = {
    chainId: network.config.chainId ?? Number(process.env.SETTLEMENT_CHAIN_ID ?? 31337),
    chainName: network.name === "hardhat" ? "Hardhat" : network.name,
    PreoFundingVault: vaultAddress,
    TestnetUSDC: tokenAddress,
    deployer: deployer.address,
    agent: agentAddress ?? null,
    deployedAt: new Date().toISOString()
  };

  const outputPath = path.join(__dirname, "..", "deployments", "preo-funding-vault.json");
  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  fs.writeFileSync(outputPath, `${JSON.stringify(artifact, null, 2)}\n`);
  console.log(JSON.stringify(artifact, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
