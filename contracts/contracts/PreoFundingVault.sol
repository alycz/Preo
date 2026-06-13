// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {Pausable} from "@openzeppelin/contracts/utils/Pausable.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

contract PreoFundingVault is Ownable, Pausable, ReentrancyGuard {
    using SafeERC20 for IERC20;

    event PreoDepositReceived(
        bytes32 indexed preoUserIdHash,
        address indexed sender,
        address indexed token,
        uint256 amount,
        bytes32 externalRef
    );

    event PayrollDepositRecorded(
        bytes32 indexed preoUserIdHash,
        address indexed token,
        uint256 amount,
        bytes32 payrollRef,
        address indexed recordedBy
    );

    event PreoWithdrawalExecuted(
        address indexed recipient,
        address indexed token,
        uint256 amount,
        bytes32 indexed actionRef
    );

    mapping(address => bool) public supportedTokens;
    mapping(address => bool) public authorizedAgents;

    error UnsupportedToken(address token);
    error UnauthorizedAgent(address caller);
    error InvalidAmount();
    error InvalidAddress();
    error InvalidUserHash();

    constructor(address initialOwner) Ownable(initialOwner) {}

    modifier onlyAuthorizedAgent() {
        if (msg.sender != owner() && !authorizedAgents[msg.sender]) {
            revert UnauthorizedAgent(msg.sender);
        }
        _;
    }

    function setSupportedToken(address token, bool supported) external onlyOwner {
        if (token == address(0)) {
            revert InvalidAddress();
        }
        supportedTokens[token] = supported;
    }

    function setAuthorizedAgent(address agent, bool authorized) external onlyOwner {
        if (agent == address(0)) {
            revert InvalidAddress();
        }
        authorizedAgents[agent] = authorized;
    }

    function pause() external onlyOwner {
        _pause();
    }

    function unpause() external onlyOwner {
        _unpause();
    }

    function depositFor(
        bytes32 preoUserIdHash,
        address token,
        uint256 amount,
        bytes32 externalRef
    ) external nonReentrant whenNotPaused {
        _validateFundingInput(preoUserIdHash, token, amount);
        IERC20(token).safeTransferFrom(msg.sender, address(this), amount);
        emit PreoDepositReceived(preoUserIdHash, msg.sender, token, amount, externalRef);
    }

    function recordPayrollDeposit(
        bytes32 preoUserIdHash,
        address token,
        uint256 amount,
        bytes32 payrollRef
    ) external nonReentrant whenNotPaused onlyAuthorizedAgent {
        _validateFundingInput(preoUserIdHash, token, amount);
        emit PayrollDepositRecorded(preoUserIdHash, token, amount, payrollRef, msg.sender);
    }

    function withdrawTo(
        address recipient,
        address token,
        uint256 amount,
        bytes32 actionRef
    ) external nonReentrant whenNotPaused onlyAuthorizedAgent {
        if (recipient == address(0)) {
            revert InvalidAddress();
        }
        if (!supportedTokens[token]) {
            revert UnsupportedToken(token);
        }
        if (amount == 0) {
            revert InvalidAmount();
        }

        IERC20(token).safeTransfer(recipient, amount);
        emit PreoWithdrawalExecuted(recipient, token, amount, actionRef);
    }

    function _validateFundingInput(bytes32 preoUserIdHash, address token, uint256 amount) private view {
        if (preoUserIdHash == bytes32(0)) {
            revert InvalidUserHash();
        }
        if (!supportedTokens[token]) {
            revert UnsupportedToken(token);
        }
        if (amount == 0) {
            revert InvalidAmount();
        }
    }
}
