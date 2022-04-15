import { EventEmitter } from 'events';
import { utils } from 'ethers';
import { Duplex, Readable, Writable } from 'stream';
import toIterable from 'stream-to-it';
import PeerId from 'peer-id';
import { any } from 'bluebird';

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
	sink: any;
	source: any;
	constructor(remotePeer) {
		super();
		this.sink = toIterable.sink(this);
		this.source = toIterable.source(this);
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
	dialProtocol(to: PeerId, target: string) {
		const stream = new MockZeroStream(to);
		this.channel.emit(to.toB58String(), { stream, target, connection: { remotePeer: this.peerId.toB58String() } });
		return {
			stream,
			connection: {
				remotePeer: this.peerId.toB58String(),
			},
		};
	}
	handle(channel: string, handler: Function) {
		this.on(channel, ({ stream, connection }: { stream: MockZeroStream; connection: { remotePeer: string } }) => {
			console.log('handling', channel);
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
