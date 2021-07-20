import { expect } from 'chai';
import sinon from 'sinon';
import { ZeroUser, ZeroKeeper, createNode } from '..';
import { transferRequest, wait } from './testUtils';
import 'mocha';

const connOptions = { multiaddr: '/dns4/localhost/tcp/9090/ws/p2p-webrtc-star/' };

describe.skip('E2E', () => {
	afterEach(() => {
		sinon.restore();
	});

	it('should subscribe to keeper broadcasts', async () => {
		const connectionOne = await createNode(connOptions);
		const connectionTwo = await createNode(connOptions);
		const zeroUser = new ZeroUser(connectionOne);
		const zeroKeeper = new ZeroKeeper(connectionTwo);
		await zeroKeeper.advertiseAsKeeper('0x1234');
		await wait(1000);
		await zeroUser.subscribeKeepers();
		await wait(1000);
		expect(zeroUser.keepers).to.be.an('array').of.length(1);
	});

	it('should publish a transfer request', async () => {
		const connectionOne = await createNode(connOptions);
		const connectionTwo = await createNode(connOptions);
		const zeroUser = new ZeroUser(connectionOne);
		const zeroKeeper = new ZeroKeeper(connectionTwo);
		await zeroKeeper.advertiseAsKeeper('0x1234');
		await wait(1000);
		await zeroUser.subscribeKeepers();
		await wait(1000);

		const spy = (foo: any) => expect(foo.foo).to.eql('bar');
		await zeroKeeper.setTxDispatcher(spy);
		await wait(1000);
		await zeroUser.publishTransferRequest(transferRequest);
		await wait(500);
	});
});