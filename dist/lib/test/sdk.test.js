"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const zero_1 = __importDefault(require("../zero"));
const ethers_1 = require("ethers");
const helpers_1 = require("../util/helpers");
const chai_1 = require("chai");
const bitcoin_address_validation_1 = require("bitcoin-address-validation");
require("mocha");
describe('computeP unit test', () => {
    it('has a correct return for computeP', () => {
        const expected = '0x00000000000000000000000000000000000000000000000000000000000000010000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000006000000000000000000000000000000000000000000000000000000000000000010000000000000000000000000000000000000000000000000000000000000000';
        const pReturn = (0, helpers_1.computeP)('1', ethers_1.constants.AddressZero, '0x00');
        (0, chai_1.expect)(pReturn).to.be.eq(expected);
    });
    it('has a correct return for computePHashFromP', () => {
        const p = '0x00000000000000000000000000000000000000000000000000000000000000010000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000006000000000000000000000000000000000000000000000000000000000000000010000000000000000000000000000000000000000000000000000000000000000';
        const expected = '0xabaf29967fbafb35d97cab780a1333c0583f2ce39b1eaf0c7da0260baf57650d';
        const pHash = (0, helpers_1.computePHashFromP)(p);
        (0, chai_1.expect)(pHash).to.be.eq(expected);
    });
    it('has a correct return from computePHash', () => {
        const expected = '0xabaf29967fbafb35d97cab780a1333c0583f2ce39b1eaf0c7da0260baf57650d';
        const pHash = (0, helpers_1.computePHash)({ nonce: '1', module: ethers_1.constants.AddressZero, data: '0x00' });
        (0, chai_1.expect)(pHash).to.be.eq(expected);
    });
    it('converts an object to a ghash', () => {
        const expected = '0x1802dfcb2df77afef24f20ce516bd6ec50cec35aa1ed6359a81fd6d950006902';
        const p = '0x00000000000000000000000000000000000000000000000000000000000000010000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000006000000000000000000000000000000000000000000000000000000000000000010000000000000000000000000000000000000000000000000000000000000000';
        const gHash = (0, helpers_1.maybeCoerceToGHash)({
            to: ethers_1.constants.AddressZero,
            tokenAddress: ethers_1.constants.AddressZero,
            p: p,
            nonce: ethers_1.utils.formatBytes32String('1'),
        });
        (0, chai_1.expect)(gHash).to.be.eq(expected);
    });
    it("doesn't modify a ghash passed through", () => {
        const expected = '0x1802dfcb2df77afef24f20ce516bd6ec50cec35aa1ed6359a81fd6d950006902';
        const gHash = (0, helpers_1.maybeCoerceToGHash)(expected);
        (0, chai_1.expect)(gHash).to.be.eq(expected);
    });
    it('creates a correct NHash', () => {
        const nHash = (0, helpers_1.computeNHash)({
            nonce: ethers_1.utils.formatBytes32String('1'),
            txHash: ethers_1.utils.formatBytes32String('1'),
            vOut: 1,
        });
    });
    it('creates a correct TransferRequest', () => {
        const transferRequest = new zero_1.default({
            asset: ethers_1.constants.AddressZero,
            module: ethers_1.constants.AddressZero,
            to: ethers_1.constants.AddressZero,
            underwriter: ethers_1.constants.AddressZero,
            amount: '1',
            data: '0x00',
            contractAddress: ethers_1.constants.AddressZero,
            chainId: 1
        });
        (0, chai_1.expect)(transferRequest).to.be.instanceof(zero_1.default);
    });
    it('creates a valid gateway address', async () => {
        const transferRequest = new zero_1.default({
            asset: ethers_1.constants.AddressZero,
            module: ethers_1.constants.AddressZero,
            to: ethers_1.constants.AddressZero,
            underwriter: ethers_1.constants.AddressZero,
            amount: '1',
            data: '0x00',
            contractAddress: ethers_1.constants.AddressZero,
            chainId: 1
        });
        const gatewayAddress = await transferRequest.toGatewayAddress({
            isTest: true
        });
        const isValidAddress = (0, bitcoin_address_validation_1.validate)(gatewayAddress);
        (0, chai_1.expect)(isValidAddress).to.be.true;
    });
    it('creates a valid EIP721 response', () => {
        const expected = {
            types: {
                EIP712Domain: [
                    {
                        name: 'name',
                        type: 'string',
                    },
                    {
                        name: 'version',
                        type: 'string',
                    },
                    {
                        name: 'chainId',
                        type: 'uint256',
                    },
                    {
                        name: 'verifyingContract',
                        type: 'address',
                    },
                ],
                TransferRequest: [
                    {
                        name: 'asset',
                        type: 'address',
                    },
                    {
                        name: 'amount',
                        type: 'uint256',
                    },
                    {
                        name: 'underwriter',
                        type: 'address',
                    },
                    {
                        name: 'module',
                        type: 'address',
                    },
                    {
                        name: 'nonce',
                        type: 'uint256',
                    },
                    {
                        name: 'data',
                        type: 'bytes',
                    },
                ],
            },
            domain: {
                name: 'ZeroController',
                version: '1',
                chainId: '1',
                verifyingContract: '0x0000000000000000000000000000000000000000',
            },
            message: {
                module: '0x0000000000000000000000000000000000000000',
                asset: '0x0000000000000000000000000000000000000000',
                amount: '1',
                data: '0x00',
                underwriter: '0x0000000000000000000000000000000000000000',
                nonce: '0x3100000000000000000000000000000000000000000000000000000000000000',
            },
            primaryType: 'TransferRequest',
        };
        const transferRequest = new zero_1.default({
            asset: ethers_1.constants.AddressZero,
            module: ethers_1.constants.AddressZero,
            to: ethers_1.constants.AddressZero,
            underwriter: ethers_1.constants.AddressZero,
            amount: '1',
            data: '0x00',
            contractAddress: ethers_1.constants.AddressZero,
            chainId: 1
        });
        const EIP712 = transferRequest.toEIP712(ethers_1.constants.AddressZero, 1);
        (0, chai_1.expect)(EIP712).to.be.deep.eq(expected);
    });
});
//# sourceMappingURL=sdk.test.js.map