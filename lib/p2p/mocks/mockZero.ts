import { EventEmitter } from 'events';
import { utils } from 'ethers';
import { Duplex, Readable, Writable } from 'stream';
import PeerId from 'peer-id';

export class MockZeroPubSub extends EventEmitter {
	publish(channel: string, data: any) {
		this.emit(channel, data);
	}
	subscribe(_channel: string) {
		//noop
		return;
	}
	unsubscribe(_channel: string) {
		return;
	}
}

export class MockZeroStream extends Duplex {
	sink: this = this;
	source: this = this;
	constructor(remotePeer) {
		super();
	}
}

const channel = new MockZeroPubSub();

export class MockZeroConnection extends EventEmitter {
	peerId: PeerId;
	pubsub: any;
	channel: MockZeroPubSub;
	subscribed: string[];
	constructor(peerId: PeerId) {
		super();
		this.peerId = peerId;
		this.subscribed = [];
		this.pubsub = this.channel;
		this.pubsub.subscribe = (_channel: string) => {
			this.subscribed.push(_channel);
			this.channel.on(_channel, this.emit);
		};
		this.pubsub.unsubscribe = (_channel: string) => {
			this.subscribed = this.subscribed.filter((d) => d !== _channel);
			this.channel.removeAllListeners(_channel);
		};
		this.pubsub.publish = async (_channel: string, data: any) => {
			this.channel.emit(_channel, { data, from: this.peerId.toB58String() });
			return;
		};
	}
	start() {
		this.channel.on(
			this.peerId.toB58String(),
			({
				stream,
				target,
				connection,
			}: {
				stream: MockZeroStream;
				target: string;
				connection: { remotePeer: string };
			}) => {
				this.emit(target, { stream, connection });
			},
		);
	}
	dialProtocol(to: string, target: string) {
		console.log(to, target);
		const stream = new MockZeroStream(to);
		this.channel.emit(to, { stream, target, connection: { remotePeer: this.peerId.toB58String() } });
		return {
			stream,
			connection: {
				remotePeer: this.peerId.toB58String(),
			},
		};
	}
	handle(channel: string, handler: Function) {
		this.on(channel, ({ stream, connection }: { stream: MockZeroStream; connection: { remotePeer: string } }) => {
			handler({ stream, connection });
		});
	}
}

export async function createMockZeroConnection() {
	MockZeroConnection.prototype.channel = channel;
	return new MockZeroConnection(
		await PeerId.create({
			bits: 1024,
		}),
	);
}
