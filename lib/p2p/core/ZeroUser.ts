'use strict';
import createLogger, { Logger } from '../../logger';
//import { MockZeroConnection } from './mocks';
import { fromBufferToJSON } from '../util';
import pipe from 'it-pipe';
import lp from 'it-length-prefixed';
import { ConnectionTypes } from '../types';
import { PersistenceAdapter, InMemoryPersistenceAdapter } from '../../persistence';
import peerId = require('peer-id');
import { EventEmitter } from 'events';

const listeners = {
	burn: ['burn'],
	meta: ['meta'],
	transfer: ['repay', 'loan'],
};

export class ZeroUser extends EventEmitter {
	conn: ConnectionTypes;
	keepers: string[];
	log: Logger;
	storage: PersistenceAdapter<any, any>;

	constructor(connection: ConnectionTypes, persistence?: PersistenceAdapter<any, any>) {
		super();
		this.conn = connection;
		this.conn.on('peer:discovery', () => console.log('discovered!'));
		this.keepers = [];
		this.log = createLogger('zero.user');
		this.storage = persistence ?? new InMemoryPersistenceAdapter();
	}

	async subscribeKeepers() {
		this.conn.pubsub.on('zero.keepers', async (message: any) => {
			const { data, from } = message;
			const { address } = fromBufferToJSON(data);
			if (!this.keepers.includes(from)) {
				try {
					this.keepers.push(from);
					this.emit('keeper', from);
					this.log.debug(`Keeper Details: `, {
						from,
					});
					this.log.info(`Found keeper: ${from} with address ${address}`);
				} catch (e: any) {
					this.log.error(`Timed out finding keeper: ${from}`);
					this.log.debug(e.message);
				}
			}
		});
		this.conn.pubsub.subscribe('zero.keepers');
		this.log.info('Subscribed to keeper broadcasts');
	}

	async unsubscribeKeepers() {
		this.log.debug('Keepers before unsubscription', this.keepers);
		try {
			await this.conn.pubsub.unsubscribe('zero.keepers');
		} catch (e: any) {
			this.log.error('Could not unsubscribe to keeper broadcasts');
			this.log.debug(e.message);
		}
		this.log.info('Unsubscribed to keeper broadcasts');
		this.keepers = [];
	}

	handleConnection(callback: Function) {
		return ({ stream }: { stream: any }) => {
			pipe(stream.source, lp.decode(), async (rawData: any) => {
				let string = [];
				for await (const msg of rawData) {
					string.push(msg.toString());
				}
				callback(JSON.parse(string.join('')));
			});
		};
	}
	async publishRequest(request: any, requestTemplate?: string[], requestType: string = 'transfer') {
		const requestFromTemplate = requestTemplate
			? Object.fromEntries(Object.entries(request).filter(([k, v]) => requestTemplate.includes(k)))
			: request;

		console.log(request);

		let result = {
			meta: null,
			burn: null,
			loan: null,
			repay: null,
		};
		console.log('requestFromTemplate', requestFromTemplate);
		const key = await this.storage.set(requestFromTemplate);
		if (this.keepers.length === 0) {
			this.log.error(`Cannot publish ${requestType} request if no keepers are found`);
			return result;
		}
		try {
			let ackReceived = false;
			// should add handler for rejection
			listeners[requestType].map((d) => {
				result[d] = new Promise(async (resolve) => {
					this.conn.handle(`/zero/user/${d}Dispatch`, this.handleConnection(resolve));
				});
			});

			await this.conn.handle(
				'/zero/user/confirmation',
				this.handleConnection(async ({ txConfirmation }) => {
					await this.storage.setStatus(key, 'succeeded');
					ackReceived = true;
					this.log.info(`txDispatch confirmed: ${txConfirmation}`);
				}),
			);
			for (const keeper of this.keepers) {
				// Typescript error: This condition will always return 'true' since the types 'false' and 'true' have no overlap.
				// This is incorrect, because ackReceived is set to true in the handler of /zero/user/confirmation
				// @ts-expect-error
				if (ackReceived !== true) {
					try {
						const peer = await peerId.createFromB58String(keeper);
						const { stream } = await this.conn.dialProtocol(peer, '/zero/keeper/dispatch');
						pipe(JSON.stringify(requestFromTemplate), lp.encode(), stream.sink);
						this.log.info(`Published transfer request to ${keeper}. Waiting for keeper confirmation.`);
					} catch (e: any) {
						this.log.error(`Failed dialing keeper: ${keeper} for txDispatch`);
						this.log.error(e.stack);
					}
				} else {
					break;
				}
			}
		} catch (e: any) {
			this.log.error('Could not publish transfer request');
			this.log.debug(e.message);
			Object.keys(result).map((d) => {
				result[d] = null;
			});
			return result;
		}
		return result;
	}

	async publishBurnRequest(burnRequest: any) {
		return await this.publishRequest(
			burnRequest,
			[
				'asset',
				'chainId',
				'contractAddress',
				'data',
				'module',
				'nonce',
				'pNonce',
				'signature',
				'underwriter',
				'owner',
				'amount',
				'deadline',
				'destination',
				'requestType',
			],
			'burn',
		);
	}
	async publishMetaRequest(metaRequest: any) {
		return await this.publishRequest(
			metaRequest,
			[
				'asset',
				'chainId',
				'contractAddress',
				'data',
				'module',
				'nonce',
				'pNonce',
				'signature',
				'underwriter',
				'addressFrom',
				'requestType',
			],
			'meta',
		);
	}

	async publishTransferRequest(transferRequest: any) {
		return await this.publishRequest(transferRequest, [
			'amount',
			'asset',
			'chainId',
			'contractAddress',
			'data',
			'module',
			'nonce',
			'pNonce',
			'signature',
			'to',
			'underwriter',
			'requestType',
		]);
	}
}
