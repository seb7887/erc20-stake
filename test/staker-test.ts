import { ethers } from "hardhat"
import { expect, use } from "chai"
import { solidity } from "ethereum-waffle"

use(solidity)

// This function simulates blockchain native behaviour
const increaseWorldTimeInSeconds = async (seconds: number, mine = false) => {
    await ethers.provider.send("evm_increaseTime", [seconds])
    if (mine) {
        await ethers.provider.send("evm_mine", [])
    }
}

describe("Staker", () => {
    let owner: any
    let addr1: any
    let addrs: any
    let ExternalFactory: any
    let StakerFactory: any
    let external: any
    let staker: any

    beforeEach(async () => {
        [owner, addr1, ...addrs] = await ethers.getSigners()

        ExternalFactory = await ethers.getContractFactory("External")
        external = await ExternalFactory.deploy()

        await external.deployed()

        StakerFactory = await ethers.getContractFactory("Staker")
        staker = await StakerFactory.deploy(external.address)

        await staker.deployed()
    })

    describe("timeLeft()", () => {
        it("should return 0 after deadline", async () => {
            await increaseWorldTimeInSeconds(180, true)

            const timeLeft = await staker.timeLeft()
            expect(timeLeft).to.equal(0)
        })
        it("should return correct timeLeft after 10 seconds", async () => {
            const elapsedSeconds = 10
            const timeLeftBefore = await staker.timeLeft()
            await increaseWorldTimeInSeconds(elapsedSeconds, true)

            const timeLeftAfter = await staker.timeLeft()
            expect(timeLeftAfter).to.equal(timeLeftBefore.sub(elapsedSeconds))
        })
    })

    describe("stake()", () => {
        it("should emit Stake event", async () => {
            const amount = ethers.utils.parseEther("0.5")
            await expect(
                staker.connect(addr1).stake({ value: amount })
            ).to.emit(staker, "Stake").withArgs(addr1.address, amount)

            const balance = await ethers.provider.getBalance(staker.address)
            expect(balance).to.equal(amount)

            const addr1Balance = await staker.balances(addr1.address)
            expect(addr1Balance).to.equal(amount)
        })
        it("should revert if deadline is reached", async () => {
            await increaseWorldTimeInSeconds(100, true)

            const amount = ethers.utils.parseEther("0.5")
            await expect(
                staker.connect(addr1).stake({ value: amount })
            ).to.be.revertedWith("Deadline is already reached")
        })
        it("should revert if trx is completed", async () => {
            const amount = ethers.utils.parseEther("1")
            const txStake = await staker.connect(addr1).stake({
                value: amount,
            })
            await txStake.wait()

            const execute = await staker.connect(addr1).execute()
            await execute.wait()

            await expect(
                staker.connect(addr1).stake({ value: amount })
            ).to.be.revertedWith("staking process already completed")
        })
    })

    describe("execute()", () => {
        it("should revert if stake amount not reach threshold", async () => {
            const amount = ethers.utils.parseEther("1")
            await staker.connect(addr1).stake({ value: amount })
            await staker.connect(addr1).execute()

            await expect(staker.connect(addr1).execute()).to.be.revertedWith("staking process already completed")
        })
        it("should revert if deadline is reached", async () => {
            await increaseWorldTimeInSeconds(100, true)

            await expect(staker.connect(addr1).execute()).to.be.revertedWith("Deadline is already reached")
        })
        it("should complete external contract", async () => {
            const amount = ethers.utils.parseEther("1")
            await staker.connect(addr1).stake({ value: amount })
            await staker.connect(addr1).execute()

            const completed = await external.completed()
            expect(completed).to.equal(true)

            const externalBalance = await ethers.provider.getBalance(external.address)
            expect(externalBalance).to.equal(amount)

            const stakeBalance = await ethers.provider.getBalance(staker.address)
            expect(stakeBalance).to.equal(0)
        })
    })

    describe("withdraw()", () => {
        it("should revert if deadline is not reached", async () => {
            await expect(
                staker.connect(addr1).withdraw()
            ).to.be.revertedWith("Deadline is not yet reached")
        })
        it("should revert if stake is already completed", async () => {
            const amount = ethers.utils.parseEther("1")
            const stake = await staker.connect(addr1).stake({ value: amount })
            await stake.wait()

            const execute = await staker.connect(addr1).execute()
            await execute.wait()

            await increaseWorldTimeInSeconds(100, true)

            await expect(
                staker.connect(addr1).withdraw()
            ).to.be.revertedWith("staking process already completed")
        })
        it("should revert if user has no funds", async () => {
            await increaseWorldTimeInSeconds(100, true)

            await expect(
                staker.connect(addr1).withdraw()
            ).to.be.revertedWith("You don't have balance to withdraw")
        })
        it("happy path", async () => {
            const amount = ethers.utils.parseEther("1")
            const stake = await staker.connect(addr1).stake({ value: amount })
            await stake.wait()

            await increaseWorldTimeInSeconds(100, true)

            const withdraw = await staker.connect(addr1).withdraw()
            await withdraw.wait()

            const stakeBalance = await ethers.provider.getBalance(staker.address)
            expect(stakeBalance).to.equal(0)

            await expect(withdraw).to.changeEtherBalance(addr1, amount)
        })
    })
})