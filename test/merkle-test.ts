import hre from 'hardhat';
import { expect } from 'chai'
import { override } from '../lib/test/inject-mock'
import { Contract, utils } from 'ethers'
import GatewayLogicV1 from '../artifacts/contracts/test/GatewayLogicV1.sol/GatewayLogicV1.json';
import MerkleTree from '../lib/merkle/merkle-tree'
import { Buffer } from 'buffer'
import BalanceTree from '../lib/merkle/balance-tree'

const deployParameters = require('../lib/fixtures')
const network = process.env.CHAIN || 'ETHEREUM'

// @ts-expect-error
const { ethers, deployments } = hre
import { BigNumber } from 'ethers'

// Step 1: validate deployment of all contracts
// Step 2: mint zBTC and test balance of all contracts
// Step 3: test adding address to merkle sdk and creating Merkle Contract
// Step 4: mint to all Merkle valid addresses
// Step 5: check balances of merkle valid addresses

const getContract = async (...args: any[]) => {
    try {
        return (await ethers.getContract(...args));
    } catch (e) {
        console.error(e)
        return new ethers.Contract(ethers.constants.AddressZero, [], (await ethers.getSigners())[0]);
    }
};

const getContractFactory = async (...args: any[]) => {
    try {
        return (await ethers.getContractFactory(...args))
    } catch (e) {
        return new ethers.ContractFactory('0x', [], (await ethers.getSigners())[0]);
    }
};

const getImplementation = async (proxyAddress: string) => {
    const [{ provider }] = await ethers.getSigners();
    return utils.getAddress(
        (
            await provider.getStorageAt(
                proxyAddress,
                '0x360894a13ba1a3210667c828492db98dca3e2076cc3735a920a3ca505d382bbc',
            )
        ).substr((await provider.getNetwork()).chainId === 1337 ? 0 : 26),
    );
};

const getFixtures = async () => {
    const [signer, treasury, add1, add2, add3] = await ethers.getSigners();
    const controller = await getContract('ZeroController', signer)

    return {
        owner: signer,
        treasury: treasury,
        adrresses: [add1, add2, add3],
        signerAddress: await signer.getAddress(),
        controller: controller,
        btcVault: await getContract('BTCVault', signer),
        zeroToken: await getContract('ZERO', signer),
        zeroDistributor: await getContractFactory('ZeroDistributor', signer),
        renBTC: new Contract(deployParameters[network]['renBTC'], GatewayLogicV1.abi, signer),
        //@ts-ignore
        gateway: new Contract(deployParameters[network]['btcGateway'], GatewayLogicV1.abi, signer)
    }
}

/**
 * Merkle Airdrop Client Functions
 */
function genLeaf(address, value) {
    console.log(typeof address, typeof value)
    console.log(ethers.utils.solidityKeccak256(['address', 'uint256'], [address, value]))
    return Buffer.from(
        ethers.utils
            .solidityKeccak256(['address', 'uint256'], [address, value])
            .slice(2),
        'hex'
    )
}

/**
 * Testing ZERO airdrop
 */
describe('ZERO', () => {
    const config = {
        decimals: 18,
        airdrop: {
            "0xe32d9D1F1484f57F8b5198f90bcdaBC914de0B5A": "100",
            "0x7f78Da15E8298e7afe6404c54D93cb5269D97570": "100",
            "0xdd2fd4581271e230360230f9337d5c0430bf44c0": "100"
        }
    };

    const config_2: { account: string, amount: BigNumber }[] = [
        { account: "0xe32d9D1F1484f57F8b5198f90bcdaBC914de0B5A", amount: ethers.utils.parseUnits("100", config.decimals) },
        { account: "0x7f78Da15E8298e7afe6404c54D93cb5269D97570", amount: ethers.utils.parseUnits("100", config.decimals) },
        { account: "0xdd2fd4581271e230360230f9337d5c0430bf44c0", amount: ethers.utils.parseUnits("100", config.decimals) }
    ]

    const merkleTree = new MerkleTree(
        Object.entries(config.airdrop).map(([address, tokens]) =>
            genLeaf(
                ethers.utils.getAddress(address),
                ethers.utils.parseUnits(tokens.toString(), config.decimals)
            )
        )
    );

    before(async () => {
        await deployments.fixture();
        const { treasury, zeroDistributor, zeroToken } = await getFixtures()
        const artifact = await deployments.getArtifact('MockGatewayLogicV1');
        // @ts-ignore
        const implementationAddress = await getImplementation(deployParameters[network]['btcGateway']);
        override(implementationAddress, artifact.deployedBytecode);

        // Create Merkle
        const tree = new BalanceTree(config_2);
        const hexRoot = tree.getHexRoot();

        // Mint and Deploy
        await zeroToken.mint(treasury.address, ethers.utils.parseUnits("88000000", 18))
        await zeroDistributor.deploy(zeroToken.address, treasury.address, hexRoot);
    });

    beforeEach(async function () {
        console.log('\n')
        const { zeroToken, treasury } = await getFixtures();
        //@ts-ignore
        console.log('='.repeat(32), 'Beginning Test', '='.repeat(32));
        console.log('Test:', this.currentTest.title);
        console.log("\nTreasury Balance:");
        console.log(ethers.utils.formatUnits(await zeroToken.balanceOf(treasury.address), 18));
        console.log("\nAccount Balances:");
        console.log("Account 1:", ethers.utils.formatUnits(await zeroToken.balanceOf("0xe32d9D1F1484f57F8b5198f90bcdaBC914de0B5A"), 18))
        console.log("Account 2:", ethers.utils.formatUnits(await zeroToken.balanceOf("0x7f78Da15E8298e7afe6404c54D93cb5269D97570"), 18))
        console.log("Account 3:", ethers.utils.formatUnits(await zeroToken.balanceOf("0xdd2fd4581271e230360230f9337d5c0430bf44c0"), 18))
    })

    it('should confirm the basic config', async () => {
        const [owner, treasury] = await ethers.getSigners();
        const { zeroDistributor, zeroToken } = await getFixtures();
        const distributor = await zeroDistributor.deploy(zeroToken.address, treasury.address, merkleTree.getHexRoot())
        expect(await zeroToken.owner()).to.equal(owner.address)
        expect(Number(ethers.utils.formatUnits(await zeroToken.balanceOf(treasury.address), 18))).to.equal(88000000)
        expect(await distributor.treasury(), "zero treasury is equal to the treasury").is.equal(treasury.address)
    })

    it('should get the merkle root and tree', async () => {
        console.log("\nMerkle Root:", merkleTree.getHexRoot())

        const tree = Object.entries(config.airdrop).map(([address, tokens]) =>
            genLeaf(
                ethers.utils.getAddress(address),
                ethers.utils.parseUnits(tokens.toString(), config.decimals).toString()
            )
        );

        console.log("\nTree:", tree);
    })

    it("should let a white listed address claim zero tokens", async () => {
        const [treasury] = await ethers.getSigners();
        const { zeroDistributor } = await getFixtures();
        const zeroToken = await ethers.getContract('ZERO', treasury);

        const tree = new BalanceTree(config_2);
        const hexRoot = tree.getHexRoot();
        const distributor = await zeroDistributor.deploy(zeroToken.address, treasury.address, hexRoot);

        await ethers.getSigner(treasury.address);
        await zeroToken.approve(distributor.address, await zeroToken.balanceOf(treasury.address));
        console.log("Allowance", ethers.utils.formatUnits(await zeroToken.allowance(treasury.address, distributor.address), 18));

        for (const key in config.airdrop) {
            console.log("Key: ", key);
            console.log("Value: ", config.airdrop[key]);
            console.log("check if claimed", await distributor.isClaimed(0))

            await zeroToken.approve(key, ethers.constants.MaxUint256)
        }

        const key = Object.keys(config.airdrop)[0]
        const value = Object.values(config.airdrop)[0].toString()


        console.log("check if claimed", await distributor.isClaimed(0))


        let leaf = genLeaf(ethers.utils.getAddress(key), ethers.utils.parseUnits(value, config.decimals))
        console.log("\nLeaf", leaf)
        let proof = tree.getProof(0, key, ethers.utils.parseUnits(value, config.decimals))
        console.log("\nProof", proof)

        await distributor.claim(0, key, ethers.utils.parseUnits(value, config.decimals).toString(), proof, { gasPrice: 197283674 })
        console.log(key, value)
    })

    it("should confirm the claim request", async () => {

    })
})