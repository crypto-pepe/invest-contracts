import {
  transfer as wavesTransfer,
  invokeScript,
  data as wavesData,
  broadcast,
  waitForTx,
  ITransferParams,
  IInvokeScriptParams,
  IDataParams,
  signTx,
  protoSerialize,
} from '@waves/waves-transactions';
import { create as API } from '@waves/node-api-js';
import {
  TransferTransaction,
  InvokeScriptTransaction,
  DataTransaction,
} from '@waves/ts-types';
import { publicKey, TPrivateKey } from '@waves/ts-lib-crypto';
import { WavesNetwork, WavesTransferFee, WavesInvokeFee } from './network';
import { TLong } from '@waves/node-api-js/cjs/interface';
import { IScriptInfo } from '@waves/node-api-js/cjs/api-node/addresses';

export type LONG = string | number;
export type TransferParams = ITransferParams;
export type InvokeParams = IInvokeScriptParams<LONG>;

export const transfer = async (
  params: TransferParams,
  senderPrivateKey: string,
  network: WavesNetwork,
  proofsGenerator: ((tx: Uint8Array) => Promise<string[]>) | undefined
) => {
  const privateKey: TPrivateKey = { privateKey: senderPrivateKey };

  const rawTx = wavesTransfer({
    recipient: params.recipient,
    amount: params.amount,
    assetId: params.assetId || null,
    fee: params.fee || WavesTransferFee,
    feeAssetId: params.feeAssetId || null,
    additionalFee: params.additionalFee,
    chainId: network.chaidID || params.chainId,
    senderPublicKey: publicKey(privateKey),
  });

  const signedTx = signTx(rawTx, privateKey);

  if (proofsGenerator !== undefined) {
    const proofs = await proofsGenerator(protoSerialize.txToProtoBytes(rawTx));
    signedTx.proofs.push(...proofs);
  }

  await broadcast(signedTx, network.nodeAPI);
  const txMined = await waitForTx(rawTx.id, {
    apiBase: network.nodeAPI,
    timeout: network.nodeTimeout,
  });

  return txMined.applicationStatus === 'succeeded'
    ? (txMined as TransferTransaction)
    : undefined;
};

export const invoke = async (
  params: InvokeParams,
  senderPrivateKey: string,
  network: WavesNetwork,
  proofsGenerator: ((tx: Uint8Array) => Promise<string[]>) | undefined
) => {
  const privateKey: TPrivateKey = { privateKey: senderPrivateKey };

  const rawTx = invokeScript({
    dApp: params.dApp,
    feeAssetId: null,
    call: params.call,
    payment: params.payment,
    fee: params.fee || WavesInvokeFee,
    additionalFee: params.additionalFee,
    senderPublicKey: publicKey(privateKey),
    chainId: params.chainId || network.chaidID,
  });

  const signedTx = signTx(rawTx, privateKey);

  if (proofsGenerator !== undefined) {
    const proofs = await proofsGenerator(protoSerialize.txToProtoBytes(rawTx));
    signedTx.proofs.push(...proofs);
  }

  await broadcast(signedTx, network.nodeAPI);
  const txMined = await waitForTx(rawTx.id, {
    apiBase: network.nodeAPI,
    timeout: network.nodeTimeout,
  });

  return txMined.applicationStatus === 'succeeded'
    ? (txMined as InvokeScriptTransaction)
    : undefined;
};

export const data = async (
  params: IDataParams,
  senderPrivateKey: string,
  network: WavesNetwork,
  proofsGenerator: ((tx: Uint8Array) => Promise<string[]>) | undefined
) => {
  const privateKey: TPrivateKey = { privateKey: senderPrivateKey };

  const rawTx = wavesData({
    data: params.data,
    fee: params.fee || WavesInvokeFee,
    additionalFee: params.additionalFee,
    senderPublicKey: publicKey(privateKey),
    chainId: params.chainId || network.chaidID,
  });

  const signedTx = signTx(rawTx, privateKey);

  if (proofsGenerator !== undefined) {
    const proofs = await proofsGenerator(protoSerialize.txToProtoBytes(rawTx));
    signedTx.proofs.push(...proofs);
  }

  await broadcast(signedTx, network.nodeAPI);
  const txMined = await waitForTx(rawTx.id, {
    apiBase: network.nodeAPI,
    timeout: network.nodeTimeout,
  });

  return txMined.applicationStatus === 'succeeded'
    ? (txMined as DataTransaction)
    : undefined;
};

const getValue = async <T extends TLong>(
  dApp: string,
  key: string,
  network: WavesNetwork
): Promise<T> => {
  const { value } = await API(network.nodeAPI).addresses.fetchDataKey(
    dApp,
    key
  );

  return value as T;
};

export const getScript = async (dApp: string, network: WavesNetwork) => {
  const result = await API(network.nodeAPI).addresses.fetchScriptInfo(dApp);

  return (result as IScriptInfo) || null;
};

export const getIntegerValue = async (
  dApp: string,
  key: string,
  network: WavesNetwork
): Promise<number> => getValue<number>(dApp, key, network);

export const getStringValue = async (
  dApp: string,
  key: string,
  network: WavesNetwork
): Promise<string> => getValue<string>(dApp, key, network);
