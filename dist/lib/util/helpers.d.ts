import { Buffer } from 'safe-buffer';
import { DarknodeSignatureInput, GHashInput, NHashInput, PHashInput } from '../types';
export declare const stripHexPrefix: (s: string) => string;
export declare const addHexPrefix: (s: string) => string;
export declare const toBase64: (input: string) => string;
export declare const fromBase64: (input: string) => Buffer;
export declare const toHex: (input: string) => string;
export declare const fetchData: <T>(request: () => Promise<Response>) => Promise<T>;
export declare const computePHash: (input: PHashInput) => string;
export declare const computePHashFromP: (p: string) => string;
export declare const computeP: (to: string, nonce: string, module: string, data: string) => string;
export declare const maybeCoerceToGHash: (input: GHashInput | string) => string;
export declare const encodeInitializationActions: (input: any, InitializationActionsABI: any) => string;
export declare const computeShiftInTxHash: ({ renContract, utxo, g }: any) => string;
export declare const computeNHash: (input: NHashInput) => any;
export declare const computeHashForDarknodeSignature: (input: DarknodeSignatureInput) => string;
//# sourceMappingURL=helpers.d.ts.map