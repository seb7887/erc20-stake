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
    let user: any
    let ExternalFactory: any
    let StakerFactory: any
    let external: any
    let staker: any

    beforeEach(async () => {
        const addresses = await ethers.getSigners()
        user = addresses[0]

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
            console.log('ethers', ethers)

            const timeLeft = await staker.timeLeft()
            expect(timeLeft.value.toNumber()).to.equal(0)
        })
        it("should return correct timeLeft after 10 seconds", async () => {
            const elapsedSeconds = 10
            const timeLeftBefore = await staker.timeLeft()
            await increaseWorldTimeInSeconds(elapsedSeconds, true)

            const timeLeftAfter = await staker.timeLeft()
            expect(timeLeftAfter.value.toNumber()).to.equal(timeLeftBefore.value.sub(elapsedSeconds).toNumber())
        })
    })

    describe("stake()", () => {
        it("should emit Stake event", async () => {
            const amount = ethers.utils.parseEther("100")
            await expect(
                staker.connect(user).stake({ value: amount })
            ).to.emit(staker, "Stake").withArgs(user.address, amount)

            const balance = await ethers.provider.getBalance(staker.address)
            expect(balance).to.equal(amount)
        })
    })
})