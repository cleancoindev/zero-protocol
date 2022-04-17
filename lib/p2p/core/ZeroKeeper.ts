'use strict';
import createLogger, { Logger } from '../../logger';
//import { MockZeroConnection } from './mocks';
import { fromJSONtoBuffer } from '../util';
import pipe from 'it-pipe';
import lp from 'it-length-prefixed';
import { ConnectionTypes } from '../types';
import { PersistenceAdapter, InMemoryPersistenceAdapter } from '../../persistence';

export class ZeroKeeper {
	storage: PersistenceAdapter<any, any>;
	conn: ConnectionTypes;
	dispatches: any[];
	log: Logger;
	active: NodeJS.Timeout;

	constructor(connection: ConnectionTypes, persistence?: PersistenceAdapter<any, any>) {
		this.conn = connection;
		this.conn.on('peer:discovery', () => console.log('discovered from keeper!'));
		this.dispatches = [];
		this.log = createLogger('zero.keeper');
		this.storage = persistence ?? new InMemoryPersistenceAdapter();
	}

	setPersistence(adapter: any) {
		this.storage = adapter;
	}
	async advertiseAsKeeper(address: string) {
		this.active = setInterval(async () => {
			try {
				await this.conn.pubsub.publish(
					'zero.keepers',
					fromJSONtoBuffer({
						address,
					}),
				);
				this.log.debug(`Made presence known ${this.conn.peerId.toB58String()}`);
			} catch (e: any) {
				console.debug(e);
				this.log.info('Could not make presence known. Retrying in 1s');
				this.log.debug(e.message);
			}
		}, 1000);
		this.log.info('Started to listen for tx dispatch requests');
	}

	makeReplyDispatcher(remotePeer: any) {
		const replyDispatcher = async (target: string, data: Object) => {
			const { stream } = await this.conn.dialProtocol(remotePeer, target);
			pipe(JSON.stringify(data), lp.encode(), stream.sink);
		};
		return replyDispatcher;
	}
	async setTxDispatcher(callback: Function) {
		const handler = async (duplex: any) => {
			const stream: any = duplex.stream;
			pipe(stream.source, lp.decode(), async (rawData: any) => {
				// TODO: match handle and dialProtocol spec
				/*if (process?.env.NODE_ENV === 'test') {
					callback(fromBufferToJSON(stream.source));
					return;
				}*/
				let string = [];
				for await (const msg of rawData) {
					console.log(msg);
					string.push(msg.toString());
				}
				const transferRequest = JSON.parse(string.join(''));
				await (
					this.storage || {
						async set() {
							return 0;
						},
					}
				).set(transferRequest);
				callback(transferRequest, this.makeReplyDispatcher(duplex.connection.remotePeer));
			});
		};
		await this.conn.handle('/zero/keeper/dispatch', handler);
		this.log.info('Set the tx dispatcher');
	}

	destroy() {
		clearTimeout(this.active);
	}
}

export class MockZeroKeeper extends ZeroKeeper {
	async advertiseAsKeeper(address: string) {
		await super.advertiseAsKeeper(address);
		try {
			await this.conn.pubsub.publish(
				'zero.keepers',
				fromJSONtoBuffer({
					address,
				}),
			);
			this.log.debug(`Made presence known ${this.conn.peerId.toB58String()}`);
		} catch (e: any) {
			console.debug(e);
			this.log.info('Could not make presence known. Retrying in 1s');
			this.log.debug(e.message);
		}
	}
}
