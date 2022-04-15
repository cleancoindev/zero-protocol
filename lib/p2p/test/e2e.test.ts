import { expect } from 'chai';
import sinon from 'sinon';
import { createMockZeroConnection, MockZeroConnection } from '../mocks/mockZero';
import { TransferRequest, createZeroUser } from '../../zero';
import { ZeroUser, MockZeroKeeper } from '../core';
import { utils } from 'ethers';
import { transferRequest, wait } from './testUtils';
import 'mocha';
import { ZeroConnection } from '../core';

const connOptions = { multiaddr: '/dns4/localhost/tcp/9090/ws/p2p-webrtc-star/' };

describe('E2E', () => {
	let connection: MockZeroConnection;
	afterEach(() => {
		sinon.restore();
	});
	before(async () => {
		connection = await createMockZeroConnection();
	});

	// it('should subscribe to keeper broadcasts', async () => {
	// 	const connectionOne = await createNode(connOptions);
	// 	const connectionTwo = await createNode(connOptions);
	// 	const zeroUser = new ZeroUser(connectionOne as ZeroConnection);
	// 	const zeroKeeper = new ZeroKeeper(connectionTwo as ZeroConnection);
	// 	await zeroKeeper.advertiseAsKeeper('0x1234');
	// 	await wait(1000);
	// 	await zeroUser.subscribeKeepers();
	// 	await wait(1000);
	// 	expect(zeroUser.keepers).to.be.an('array').of.length(1);
	// });

	// it('should publish a transfer request', async () => {
	// 	const connectionOne = await createNode(connOptions);
	// 	const connectionTwo = await createNode(connOptions);
	// 	const zeroUser = new ZeroUser(connectionOne);
	// 	const zeroKeeper = new ZeroKeeper(connectionTwo);
	// 	await zeroKeeper.advertiseAsKeeper('0x1234');
	// 	await wait(1000);
	// 	await zeroUser.subscribeKeepers();
	// 	await wait(1000);

	// 	const spy = (foo: any) => {
	// 		expect(foo.underwriter).to.eql('foo');
	// 	};
	// 	await zeroKeeper.setTxDispatcher(spy);
	// 	await wait(1000);
	// 	await zeroUser.publishTransferRequest(transferRequest);
	// 	await wait(500);
	// });
	it('should test out everything', async () => {
		//@ts-ignore
		const user = createZeroUser(connection);
		//@ts-ignore
		const keeper = new MockZeroKeeper(connection);
		user.conn.start();
		keeper.conn.start();
		user.subscribeKeepers();
		const wait = new Promise((resolve) => {
			connection.pubsub.on('zero.keepers', (id) => {
				resolve(id);
			});
		});
		await keeper.advertiseAsKeeper(connection.peerId.toB58String());
		keeper.setTxDispatcher((request) => {
			console.log(request);
		});
		await wait;
		console.log('publishing');
		await user.publishTransferRequest({
			amount: 123,
			signature: 1094510293409342,
		});
	});
});
