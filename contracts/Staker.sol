// SPDX-License-Identifier: MIT
pragma solidity ^0.8.4;

import "hardhat/console.sol";
import "./External.sol";

contract Staker {
    External public externalContract;

    // Balances of the user's stacked funds
    mapping(address => uint256) public balances;

    // Staking threshold
    uint256 public constant threshold = 1 ether;

    uint256 public deadline = block.timestamp + 30 seconds;

    // Events
    event Stake(address indexed sender, uint256 amount);

    modifier deadlineReached(bool reached) {
        uint256 timeRemaining = timeLeft();
        if (reached) {
            require(timeRemaining == 0, "Deadline is not yet reached");
        } else {
            require(timeRemaining > 0, "Deadline is already reached");
        }
        _;
    }

    modifier stakeNotCompleted() {
        bool completed = externalContract.completed();
        require(!completed, "staking process already completed");
        _;
    }

    constructor(address externalContractAddress) {
        externalContract = External(externalContractAddress);
    }

    function timeLeft() public view returns (uint256 timeleft) {
        if (block.timestamp >= deadline) {
            return 0;
        } else {
            return deadline - block.timestamp;
        }
    }

    function execute() public stakeNotCompleted deadlineReached(false) {
        uint256 contractBalance = address(this).balance;

        require(contractBalance >= threshold, "Must stake at least 1 ETH");

        (bool sent, ) = address(externalContract).call{value: contractBalance}(
            abi.encodeWithSignature("complete()")
        );
        require(sent, "complete failed");
    }

    function stake() public payable deadlineReached(false) stakeNotCompleted {
        // update user's balance
        balances[msg.sender] += msg.value;

        // notify the blockchain that we've correctly staked some funds
        emit Stake(msg.sender, msg.value);
    }

    function withdraw() public deadlineReached(true) stakeNotCompleted {
        uint256 userBalance = balances[msg.sender];

        require(userBalance > 0, "You don't have balance to withdraw");

        balances[msg.sender] = 0;

        (bool sent, ) = msg.sender.call{value: userBalance}("");
        require(sent, "Failed to send balance");
    }
}
