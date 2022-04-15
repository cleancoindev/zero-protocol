import { EventEmitter } from 'events';
import { utils } from 'ethers';
import { Duplex, Readable, Writable } from 'stream';

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
	peerId: any;
	pubsub: any;
	channel: MockZeroPubSub;
	subscribed: string[];
	constructor(channel: MockZeroPubSub) {
		super();
		this.peerId = {};
		this.peerId.value = utils.hexlify(utils.randomBytes(8)).toString();
		this.peerId.toB58String = () => this.peerId.value;
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
			this.channel.emit(_channel, { data, from: this.peerId.value });
			return;
		};
	}
	start() {
		this.channel.on(
			this.peerId.value,
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
		const stream = new MockZeroStream(to);
		this.channel.emit(to, { stream, target, connection: { remotePeer: this.peerId } });
		return {
			stream,
			connection: {
				remotePeer: this.peerId.value,
			},
		};
	}
	async handle(channel: string, handler: Function) {
		const { stream, connection }: { stream: MockZeroStream; connection: { remotePeer: string } } =
			await new Promise((resolve) => {
				this.on(channel, (data: any) => {
					resolve(data);
				});
			});
		handler({ stream, connection });
	}
}

export function createMockZeroConnection() {
	MockZeroConnection.prototype.channel = channel;
	return new MockZeroConnection(channel);
}
