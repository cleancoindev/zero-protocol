import hre from 'hardhat';
import { createTransferRequest } from '../lib/zero';
import { expect } from 'chai';
import { override } from '../lib/test/inject-mock';
import GatewayLogicV1 from '../artifacts/contracts/test/GatewayLogicV1.sol/GatewayLogicV1.json';
import BTCVault from '../artifacts/contracts/vaults/BTCVault.sol/BTCVault.json';
import { Signer } from '@ethersproject/abstract-signer';
import { Provider } from '@ethersproject/abstract-provider';
import { Wallet, Contract, providers, utils } from 'ethers';

// @ts-expect-error
const { ethers, deployments } = hre;
const gasnow = require('ethers-gasnow');

ethers.providers.BaseProvider.prototype.getGasPrice = gasnow.createGetGasPrice('rapid');
const BTCGATEWAY_MAINNET_ADDRESS = '0xe4b679400F0f267212D5D812B95f58C83243EE71';
const RENBTC_MAINNET_ADDRESS = '0xeb4c2781e4eba804ce9a9803c67d0893436bb27d';
const WETH_MAINNET_ADDRESS = '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2';
const USDC_MAINNET_ADDRESS = '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48';
const WBTC_MAINNET_ADDRESS = '0x2260FAC5E5542a773Aa44fBCfeDf7C193bc2C599';
const YVWBTC_MAINNET_ADDRESS = '0xA696a63cc78DfFa1a63E9E50587C197387FF6C7E';
const CURVE_SBTC_POOL = '0x7fC77b5c7614E1533320Ea6DDc2Eb61fa00A9714';
const CURVE_TRICRYPTOTWO_POOL = '0xD51a44d3FaE010294C616388b506AcdA1bfAAE46';

const toAddress = (contractOrAddress: any): string => contractOrAddress.address || contractOrAddress;
const mintRenBTC = async (amount: any, signer?: any) => {
	const abi = [
		'function mint(bytes32, uint256, bytes32, bytes) returns (uint256)',
		'function mintFee() view returns (uint256)',
	];
	if (!signer) signer = (await ethers.getSigners())[0];
	const btcGateway = new ethers.Contract(BTCGATEWAY_MAINNET_ADDRESS, abi, signer);
	await btcGateway.mint(ethers.utils.hexlify(ethers.utils.randomBytes(32)), amount, ethers.utils.hexlify(ethers.utils.randomBytes(32)), '0x');
};

const convert = async (controller: any, tokenIn: any, tokenOut: any, amount: any, signer?: any): Promise<any> => {
	const [tokenInAddress, tokenOutAddress] = [tokenIn, tokenOut].map((v) => toAddress(v));
	const swapAddress = await controller.converters(tokenInAddress, tokenOutAddress);
        const converterContract = new ethers.Contract(swapAddress, ['function convert(address) returns (uint256)'], signer || controller.signer || controller.provider);

	if (tokenIn === ethers.constants.AddressZero) {
		await controller.signer.sendTransaction({ value: amount, to: swapAddress });
		const tx = await converterContract.convert(ethers.constants.AddressZero);
		return tx
	} else {
		const tokenInContract = new ethers.Contract(tokenInAddress, ['function transfer(address, uint256) returns (bool)'], signer || controller.signer || controller.provider);
		await tokenInContract.transfer(swapAddress, amount);
		const tx = await converterContract.convert(ethers.constants.AddressZero);
		return tx
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

var underwriterAddress = "0x0"

const deployUnderwriter = async () => {
	const { signer, controller, renBTC, btcVault } = await getFixtures();
	const underwriterFactory = await ethers.getContractFactory('TrivialUnderwriter', signer);
	underwriterAddress = (await underwriterFactory.deploy(controller.address)).address;
	await renBTC.approve(btcVault.address, ethers.constants.MaxUint256); //let btcVault spend renBTC on behalf of signer
	await btcVault.approve(controller.address, ethers.constants.MaxUint256); //let controller spend btcVault tokens
}

const underwriterDeposit = async (amountOfRenBTC: string) => {
	const { btcVault, controller } = await getFixtures();
	await btcVault.deposit(amountOfRenBTC); //deposit renBTC into btcVault from signer
	console.log("Underwriter address is", underwriterAddress)
	const lock = (await controller.provider.getCode(await controller.lockFor(underwriterAddress)));
	console.log('getCode(lock)', lock);
	if (lock === '0x') await controller.mint(underwriterAddress, btcVault.address); //mint zeroBTC to signer
};

const getFixtures = async () => {
	const [signer] = await ethers.getSigners();
	const controller = await ethers.getContract('ZeroController', signer);
	const { abi: erc20abi } = await deployments.getArtifact('BTCVault');

	return {
		signer: signer,
		signerAddress: await signer.getAddress(),
		controller: controller,
		strategy: await ethers.getContract('StrategyRenVM', signer),
		btcVault: await ethers.getContract('BTCVault', signer),
		swapModule: await ethers.getContract('Swap', signer),
		uniswapFactory: await ethers.getContract('ZeroUniswapFactory', signer),
		curveFactory: await ethers.getContract('ZeroCurveFactory', signer),
		wrapper: await ethers.getContract('WrapNative', signer),
		unwrapper: await ethers.getContract('UnwrapNative', signer),
		gateway: new Contract(BTCGATEWAY_MAINNET_ADDRESS, GatewayLogicV1.abi, signer),
		renBTC: new Contract(RENBTC_MAINNET_ADDRESS, erc20abi, signer),
		wETH: new Contract(WETH_MAINNET_ADDRESS, erc20abi, signer),
		usdc: new Contract(USDC_MAINNET_ADDRESS, erc20abi, signer),
		wBTC: new Contract(WBTC_MAINNET_ADDRESS, erc20abi, signer),
		yvWBTC: new Contract(YVWBTC_MAINNET_ADDRESS, erc20abi, signer),
	};
};

const getBalances = async () => {
	const { swapModule, strategy, controller, btcVault, signerAddress, renBTC, wETH, usdc, wBTC, yvWBTC } =
		await getFixtures();
	const wallets: { [index: string]: string } = {
		Wallet: signerAddress,
		RenBTCVault: btcVault.address,
		Controller: controller.address,
		Strategy: strategy.address,
		'yvWBTC Vault': yvWBTC.address,
		'Swap Module': swapModule.address
	};
	const tokens: { [index: string]: any } = {
		renBTC,
		wETH,
		ETH: 0,
		usdc,
		wBTC,
		yvWBTC,
		zBTC: btcVault,
	};
	const getBalance = async (wallet: string, token: Contract) => {
		const decimals = await token.decimals();
		const balance = await token.balanceOf(wallet);
		return String((balance / 10 ** decimals).toFixed(2));
	};
	console.table(
		Object.fromEntries(
			await Promise.all(
				Object.keys(wallets).map(async (name) => {
					const wallet: string = wallets[name];
					return [
						name,
						Object.fromEntries(
							await Promise.all(
								Object.keys(tokens).map(async (token) => {
									if (token === 'ETH') {
										const balance = await wETH.provider.getBalance(wallet);
										return [token, String(Number(utils.formatEther(balance)).toFixed(2))];
									} else {
										const tokenContract = tokens[token];
										return [token, await getBalance(wallet, tokenContract)];
									}
								}),
							),
						),
					];
				}),
			),
		),
	);
};

const generateTransferRequest = async (amount: number) => {
	const { swapModule, signerAddress } = await getFixtures();
	const { underwriter } = await getUnderwriter();
	return createTransferRequest(
		swapModule.address,
		signerAddress,
		RENBTC_MAINNET_ADDRESS,
		underwriter.address,
		String(amount),
		'0x',
	);
};

const getUnderwriter = async () => {
	const { signer, controller } = await getFixtures();
	const underwriterFactory = await ethers.getContractFactory('TrivialUnderwriter', signer);
	return {
		underwriterFactory,
		underwriterAddress,
		underwriter: new Contract(underwriterAddress, underwriterFactory.interface, signer),
		underwriterImpl: new Contract(underwriterAddress, controller.interface, signer),
		lock: await controller.lockFor(underwriterAddress)
	};
}

const getWrapperContract = async (address: string) => {
	const { signer } = await getFixtures();
	const wrapperAbi = (await deployments.getArtifact('ZeroUniswapWrapper')).abi;
	return new Contract(address, wrapperAbi, signer);
};

describe('Zero', () => {
	var prop;
	before(async () => {
		await deployments.fixture();
		await deployUnderwriter();
		const artifact = await deployments.getArtifact('MockGatewayLogicV1');
		const implementationAddress = await getImplementation(BTCGATEWAY_MAINNET_ADDRESS);
		override(implementationAddress, artifact.deployedBytecode);
		const { gateway } = await getFixtures();
		await gateway.mint(utils.randomBytes(32), utils.parseUnits('50', 8), utils.randomBytes(32), '0x'); //mint renBTC to signer
	});

	beforeEach(async function () {
		console.log("\n");
		//@ts-ignore
		console.log("=".repeat(32), "Beginning Test", "=".repeat(32));
		console.log("Test:", this.currentTest.title, "\n");
		console.log("Initial Balances:");
		await getBalances();
	});

	afterEach(async () => {
		console.log("Final Balances:");
		await getBalances();
	});

	it('mock gateway should work', async () => {
		const abi = [
			'function mint(bytes32, uint256, bytes32, bytes) returns (uint256)',
			'function mintFee() view returns (uint256)',
		];
		const { abi: erc20Abi } = await deployments.getArtifact('BTCVault');
		const [signer] = await ethers.getSigners();
		const signerAddress = await signer.getAddress();
		const btcGateway = new ethers.Contract(BTCGATEWAY_MAINNET_ADDRESS, abi, signer);
		const renbtc = new ethers.Contract(RENBTC_MAINNET_ADDRESS, erc20Abi, signer);
		await btcGateway.mint(
			ethers.utils.solidityKeccak256(
				['bytes'],
				[ethers.utils.defaultAbiCoder.encode(['uint256', 'bytes'], [0, '0x'])],
			),
			ethers.utils.parseUnits('50', 8),
			ethers.utils.solidityKeccak256(['string'], ['random ninputs']),
			'0x',
		);
		expect(Number(ethers.utils.formatUnits(await renbtc.balanceOf(signerAddress), 8))).to.be.gt(0);
	});

	it('Swap ETH -> wETH -> ETH', async () => {
		const { wETH, controller, signer } = await getFixtures();
		const amount = ethers.utils.parseUnits('1', '18');
		const signerAddress = await signer.getAddress();
		const originalBalance = await signer.provider.getBalance(signerAddress);
		await convert(controller, ethers.constants.AddressZero, wETH, amount);
		console.log("Swapped ETH to wETH");
		await getBalances();
		await convert(controller, wETH, ethers.constants.AddressZero, amount);
		console.log("Swapped wETH to ETH");
		expect(originalBalance === await signer.provider.getBalance(signerAddress), 'balance before not same as balance after');
	});

	it('Swap renBTC -> wBTC -> renBTC', async () => {
		const { renBTC, wBTC, controller, signer } = await getFixtures();
		const amount = ethers.utils.parseUnits('5', '8');
		await convert(controller, renBTC, wBTC, amount);
		console.log("Converted renBTC to wBTC");
		await getBalances();
		const newAmount = Number(await wBTC.balanceOf(await signer.getAddress()));
		await convert(controller, wBTC, renBTC, newAmount);
		console.log("Converted wBTC to renBTC");
		expect(Number(await renBTC.balanceOf(await signer.getAddress())) > 0, 'The swap amounts dont add up');
	});

	it('should deposit funds then withdraw funds back from vault', async () => {
		const { renBTC, btcVault } = await getFixtures();

		const beforeBalance = (await renBTC.balanceOf(btcVault.address)).toNumber() / (await renBTC.decimals());
		const addedAmount = '5000000000';
		await underwriterDeposit(addedAmount)
		const afterBalance = (await renBTC.balanceOf(btcVault.address)).toNumber() / (await renBTC.decimals());
		console.log("Deposited funds into vault");
		await getBalances();

		await btcVault.withdrawAll();
		console.log("Withdrew funds from vault");

		expect(beforeBalance + Number(addedAmount) == afterBalance, 'Balances not adding up');
	});
	it('should transfer overflow funds to strategy vault', async () => {
		const { btcVault, renBTC } = await getFixtures();
		await underwriterDeposit('5000000000');
		console.log('deposited all renBTC into vault');
		await getBalances();
		await btcVault.earn();
		console.log("Called earn on vault")
	});

	it('should take out, make a swap with, then repay a small loan', async () => {
		const { signer, controller } = await getFixtures();
		const { underwriter, underwriterImpl } = await getUnderwriter();

		//@ts-ignore
		const transferRequest = await generateTransferRequest(100000000);

		console.log('\nInitial balances');
		await getBalances();

		transferRequest.setUnderwriter(underwriter.address);
		const signature = await transferRequest.sign(signer, controller.address);

		console.log('\nWriting loan');
		await underwriterImpl.loan(
			transferRequest.to,
			transferRequest.asset,
			transferRequest.amount,
			transferRequest.pNonce,
			transferRequest.module,
			transferRequest.data,
			signature,
		);
		await getBalances();

		console.log('\nRepaying loan...');
		const nHash = utils.hexlify(utils.randomBytes(32));
		const actualAmount = String(Number(transferRequest.amount) - 1000);
		const renVMSignature = '0x';
		await underwriterImpl.repay(
			underwriter.address, //underwriter
			transferRequest.to, //to
			transferRequest.asset, //asset
			transferRequest.amount, //amount
			actualAmount,
			transferRequest.pNonce, //nonce
			transferRequest.module, //module
			nHash,
			transferRequest.data,
			renVMSignature, //signature
		);
		await getBalances();
	});

	it('should take out, make a swap with, then repay a large loan', async () => {
		const { signer, controller } = await getFixtures();
		const { underwriter, underwriterImpl } = await getUnderwriter();

		//@ts-ignore
		const transferRequest = await generateTransferRequest(300000000);

		console.log('\nInitial balances');
		await getBalances();

		transferRequest.setUnderwriter(underwriter.address);
		const signature = await transferRequest.sign(signer, controller.address);

		console.log('\nCreating loan...');
		await underwriterImpl.loan(
			transferRequest.to,
			transferRequest.asset,
			transferRequest.amount,
			transferRequest.pNonce,
			transferRequest.module,
			transferRequest.data,
			signature,
		);
		await getBalances();

		console.log('\nRepaying loan...');
		await underwriterImpl.repay(
			underwriter.address, //underwriter
			transferRequest.to, //to
			transferRequest.asset, //asset
			transferRequest.amount, //amount
			String(Number(transferRequest.amount) - 1000), //actualAmount
			transferRequest.pNonce, //nonce
			transferRequest.module, //module
			utils.hexlify(utils.randomBytes(32)), //nHash
			transferRequest.data,
			signature, //signature
		);
		await getBalances();
	});

	it('should call fallback mint and return funds', async () => {
		const { signer, controller } = await getFixtures();
		const { underwriter, underwriterImpl } = await getUnderwriter();

		//@ts-ignore
		const transferRequest = await generateTransferRequest(100000000);

		console.log('\nInitial balances');
		await getBalances();

		transferRequest.setUnderwriter(underwriter.address);
		const signature = await transferRequest.sign(signer, controller.address);

		console.log('Calling fallbackMint...');
		await controller.fallbackMint(
			underwriter.address, //underwriter,
			transferRequest.to, //to
			transferRequest.asset, //asset
			transferRequest.amount, //amount
			String(Number(transferRequest.amount) - 1000), //actualAmount
			transferRequest.pNonce, //nonce
			transferRequest.module, //module
			utils.hexlify(utils.randomBytes(32)), //nHash
			transferRequest.data, //data
			signature,
		);
		await getBalances();
	});
});
