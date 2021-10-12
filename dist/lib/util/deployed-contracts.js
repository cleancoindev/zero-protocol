"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ZeroUnderwriterImpl = exports.ZeroUniswapFactory = exports.ZeroCurveFactory = exports.ZeroController = exports.WrapNative = exports.UnwrapNative = exports.TrivialUnderwriter = exports.Swap = exports.DummyVault = exports.BTCVault = void 0;
const { Contract, Wallet, providers } = require("ethers");
const BTCVaultJson = require("../../deployments/matic/BTCVault.json");
const DummyVaultJson = require("../../deployments/matic/DummyVault.json");
const StrategyRenVMJson = require("../../deployments/matic/StrategyRenVM.json");
const SwapJson = require("../../deployments/matic/Swap.json");
const TrivialUnderwriterJson = require("../../deployments/matic/TrivialUnderwriter.json");
const UnwrapNativeJson = require("../../deployments/matic/UnwrapNative.json");
const WrapNativeJson = require("../../deployments/matic/WrapNative.json");
const ZeroControllerJson = require("../../deployments/matic/ZeroController.json");
const ZeroCurveFactoryJson = require("../../deployments/matic/ZeroCurveFactory.json");
const ZeroUniswapFactoryJson = require("../../deployments/matic/ZeroUniswapFactory.json");
const url = "https://polygon-mainnet.g.alchemy.com/v2/8_zmSL_WeJCxMIWGNugMkRgphmOCftMm";
const provider = new providers.JsonRpcProvider(url);
const privateKey = process.env.WALLET;
var signer = new Wallet(privateKey, provider);
signer.provider.getGasPrice = require('ethers-polygongastracker').createGetGasPrice('rapid');
exports.BTCVault = new Contract(BTCVaultJson.address, BTCVaultJson.abi, signer);
exports.DummyVault = new Contract(DummyVaultJson.address, DummyVaultJson.abi, signer);
exports.Swap = new Contract(SwapJson.address, SwapJson.abi, signer);
exports.TrivialUnderwriter = new Contract(TrivialUnderwriterJson.address, TrivialUnderwriterJson.abi, signer);
exports.UnwrapNative = new Contract(UnwrapNativeJson.address, UnwrapNativeJson.abi, signer);
exports.WrapNative = new Contract(WrapNativeJson.address, WrapNativeJson.abi, signer);
exports.ZeroController = new Contract(ZeroControllerJson.address, ZeroControllerJson.abi, signer);
exports.ZeroCurveFactory = new Contract(ZeroCurveFactoryJson.address, ZeroCurveFactoryJson.abi, signer);
exports.ZeroUniswapFactory = new Contract(ZeroUniswapFactoryJson.address, ZeroUniswapFactoryJson.abi, signer);
exports.ZeroUnderwriterImpl = new Contract(TrivialUnderwriterJson.address, ZeroControllerJson.abi, signer);
//# sourceMappingURL=deployed-contracts.js.map