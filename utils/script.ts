import { compile, ICompilationError } from '@waves/ride-js';
import {
  broadcast,
  setScript,
  waitForTx,
  makeTx,
  signTx,
  protoSerialize,
} from '@waves/waves-transactions';
import { publicKey, TPrivateKey } from '@waves/ts-lib-crypto';
import { readFile } from 'fs/promises';
import { WavesNetwork, WavesSetScriptFee } from './network';
import {
  SetScriptTransaction,
  SetScriptTransactionV2,
  TransactionType,
} from '@waves/ts-types';
import { LONG } from './transaction';

export type CompilationResult = {
  result: {
    base64: string;
    globalVariableComplexities: Record<string, number>;
    callableComplexities: Record<string, number>;
    // ast: object;
    // bytes: Uint8Array;
    // size: number;
    // complexity: number;
    // verifierComplexity?: number;
    // callableComplexities?: Record<string, number>;
    // userFunctionsComplexity?: Record<string, number>;
    // stateCallsComplexities?: Record<string, number>;
  };
};

export type ProofsGenerator = (tx: Uint8Array) => Promise<string[]>;

export const compileScript = async (
  pathToScript: string,
  needCompaction = false,
  removeUnusedCode = false
) => {
  const rawScript = await readFile(pathToScript, 'utf8');
  const compiledScript = compile(
    rawScript,
    undefined,
    needCompaction,
    removeUnusedCode
  ) as CompilationResult | ICompilationError;

  const isICompilationError = (
    x: CompilationResult | ICompilationError
  ): x is ICompilationError => {
    return 'error' in x;
  };

  if (isICompilationError(compiledScript)) {
    throw new Error(compiledScript.error);
  }

  return {
    script: compiledScript.result.base64,
  };
};

export const deployScript = async (
  path: string,
  deployerPrivateKey: string,
  network: WavesNetwork,
  proofsGenerator: ((tx: Uint8Array) => Promise<string[]>) | undefined
) => {
  const compiledScript = await compileScript(path);
  const privateKey: TPrivateKey = { privateKey: deployerPrivateKey };

  const rawTx = setScript({
    script: compiledScript.script,
    chainId: network.chaidID,
    fee: WavesSetScriptFee,
    senderPublicKey: publicKey(privateKey),
  });

  const signedTx = signTx(rawTx, privateKey);

  if (proofsGenerator !== undefined) {
    const proofs = await proofsGenerator(protoSerialize.txToProtoBytes(rawTx));
    signedTx.proofs.push(...proofs);
  }

  await broadcast(signedTx, network.nodeAPI);
  const txStatus = await waitForTx(rawTx.id, {
    apiBase: network.nodeAPI,
    timeout: network.nodeTimeout,
  });

  if (txStatus.applicationStatus != 'succeeded') {
    throw new Error('Tx ' + rawTx.id + 'is not succeeded');
  }

  return rawTx;
};
