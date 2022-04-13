import { BigNumber } from '@ethersproject/bignumber';
import { TransferRequest } from '../../TransferRequest';

const wait = async (ms: number): Promise<void> => await new Promise((r) => setTimeout(r, ms));
const transferRequest: TransferRequest = new TransferRequest({
	amount: BigNumber.from('10').toString(),
	asset: 'BTC',
	data: 'test',
	module: 'any',
	nonce: 1,
	pNonce: 2,
	to: 'test',
	underwriter: 'foo',
});

export { wait, transferRequest };
