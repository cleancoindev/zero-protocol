import { EventEmitter } from 'events';
import { utils } from 'ethers';
import { Duplex } from 'stream';

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
	constructor(remotePeer) {
		super();
	}
}

const channel = new MockZeroPubSub();

export class MockZeroConnection extends EventEmitter {
	peerId: string;
	pubsub: any;
	channel: MockZeroPubSub;
	subscribed: string[];
	constructor(channel: MockZeroPubSub) {
		super();
		this.peerId = utils.randomBytes(8).toString();
		this.channel = channel;
		this.pubsub = {};
		this.pubsub.subscribe = (_channel: string) => {
			this.subscribed.push(_channel);
			this.channel.on(_channel, this.emit);
		};
		this.pubsub.unsubscribe = (_channel: string) => {
			this.subscribed = this.subscribed.filter((d) => d !== _channel);
			this.channel.removeAllListeners(_channel);
		};
	}
	start() {
		this.channel.on(
			this.peerId,
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
				remotePeer: this.peerId,
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
	return new MockZeroConnection(channel);
}
