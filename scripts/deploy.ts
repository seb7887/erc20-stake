import { ethers } from "hardhat"

async function main() {
    const External = await ethers.getContractFactory("External")
    const external = await External.deploy()

    await external.deployed()

    const Staker = await ethers.getContractFactory("Staker")
    const staker = await Staker.deploy(external.address)

    await staker.deployed()

    console.log("External deployed at:", external.address)
    console.log("Staker deployed at:", staker.address)
}

main()
    .then(() => process.exit(0))
    .catch(err => {
        console.error(err)
        process.exit(1)
    })