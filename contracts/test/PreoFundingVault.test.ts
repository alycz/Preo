import { expect } from "chai";
import { ethers } from "hardhat";

describe("PreoFundingVault", () => {
  async function deployFixture() {
    const [owner, user, agent, recipient] = await ethers.getSigners();
    const MockUSDC = await ethers.getContractFactory("MockUSDC");
    const token = await MockUSDC.deploy(owner.address);
    const PreoFundingVault = await ethers.getContractFactory("PreoFundingVault");
    const vault = await PreoFundingVault.deploy(owner.address);
    await vault.setSupportedToken(await token.getAddress(), true);
    await token.mint(user.address, 1_000_000_000n);
    return { owner, user, agent, recipient, token, vault };
  }

  it("accepts ERC20 deposits and emits PreoDepositReceived", async () => {
    const { user, token, vault } = await deployFixture();
    const amount = 250_000_000n;
    const userHash = ethers.id("preo-user");
    const externalRef = ethers.id("blink-ref");

    await token.connect(user).approve(await vault.getAddress(), amount);

    await expect(vault.connect(user).depositFor(userHash, await token.getAddress(), amount, externalRef))
      .to.emit(vault, "PreoDepositReceived")
      .withArgs(userHash, user.address, await token.getAddress(), amount, externalRef);

    expect(await token.balanceOf(await vault.getAddress())).to.equal(amount);
  });

  it("rejects unsupported tokens, zero amounts, and paused deposits", async () => {
    const { owner, user, token, vault } = await deployFixture();
    const MockUSDC = await ethers.getContractFactory("MockUSDC");
    const unsupported = await MockUSDC.deploy(owner.address);
    const userHash = ethers.id("preo-user");
    const externalRef = ethers.id("ref");

    await expect(vault.connect(user).depositFor(userHash, await unsupported.getAddress(), 1n, externalRef))
      .to.be.revertedWithCustomError(vault, "UnsupportedToken");

    await expect(vault.connect(user).depositFor(userHash, await token.getAddress(), 0n, externalRef))
      .to.be.revertedWithCustomError(vault, "InvalidAmount");

    await vault.pause();
    await expect(vault.connect(user).depositFor(userHash, await token.getAddress(), 1n, externalRef))
      .to.be.revertedWithCustomError(vault, "EnforcedPause");
  });

  it("allows authorized agents to record payroll and withdraw", async () => {
    const { owner, user, agent, recipient, token, vault } = await deployFixture();
    const amount = 100_000_000n;
    const userHash = ethers.id("preo-user");
    const payrollRef = ethers.id("payroll");
    const actionRef = ethers.id("action");

    await token.connect(user).approve(await vault.getAddress(), amount);
    await vault.connect(user).depositFor(userHash, await token.getAddress(), amount, payrollRef);

    await expect(vault.connect(agent).recordPayrollDeposit(userHash, await token.getAddress(), amount, payrollRef))
      .to.be.revertedWithCustomError(vault, "UnauthorizedAgent");

    await vault.setAuthorizedAgent(agent.address, true);

    await expect(vault.connect(agent).recordPayrollDeposit(userHash, await token.getAddress(), amount, payrollRef))
      .to.emit(vault, "PayrollDepositRecorded")
      .withArgs(userHash, await token.getAddress(), amount, payrollRef, agent.address);

    await expect(vault.connect(agent).withdrawTo(recipient.address, await token.getAddress(), amount, actionRef))
      .to.emit(vault, "PreoWithdrawalExecuted")
      .withArgs(recipient.address, await token.getAddress(), amount, actionRef);

    expect(await token.balanceOf(recipient.address)).to.equal(amount);
    await expect(vault.connect(owner).withdrawTo(recipient.address, await token.getAddress(), 1n, actionRef))
      .to.be.reverted;
  });
});
