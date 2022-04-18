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

export class MockZeroStream {
	store: any[] = [];
	source: any;
	sink: any;
	open: boolean;
	common: EventEmitter;
	constructor(common: EventEmitter) {
		this.common = common;
		this.source = async function* () {
			const data: { done: boolean; value?: any } = await new Promise((resolve) => {
				console.log('iterating');
				if (this.store.length > 0) {
					let done = false;
					const value = this.store[this.store.length - 1].pop();
					if (this.store[this.store.length - 1].length == 0) {
						this.store.pop();
						done = true;
					}
					resolve({ value, done });
				}
				common.on('common.piped.end', () => resolve({ done: true }));
				common.on('common.piped.data', (value: any) => {
					console.log(value);
					resolve({ done: false, value });
				});
			});
			console.log(data);
			yield data.value;
		}.bind(this);

		this.common.on('common.piped.data', (data: any) => {
			if (this.store.length == 0) {
				this.store.push([]);
			}
			this.store[this.store.length - 1].push(data);
		});
		this.common.on('common.piped.end', () => {
			this.store.push([]);
		});
		this.sink = async (stream: any) => {
			for await (const data of stream) {
				this.common.emit('common.piped.data', data);
			}
			console.log('emitting data');
			this.common.emit('common.piped.end', 'end');
		};
	}
	//gets piped here
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
		const stream = new MockZeroStream(this.channel);
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
			handler({ stream, connection });
			for (const d of stream.source) {
				console.log(d.then(console.log));
			}
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
