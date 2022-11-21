import { base58Encode, TPrivateKey } from "@waves/ts-lib-crypto";
import {
  Account,
  Contract,
  invoke,
  LONG
} from "@pepe-team/waves-sc-test-utils";
import { getEnvironment } from 'relax-env-json';
import {
  broadcast,
  IDataParams,
  waitForTx,
  data as wavesData,
  IInvokeScriptParams,
  invokeScript,
  transfer,
  updateAssetInfo,
} from "@waves/waves-transactions";
import { fetchDetails } from '@waves/node-api-js/cjs/api-node/assets';
const env = getEnvironment();

let multisigContract: Contract;
let techUser: Account;

export const setSteps = function (
  contract: Contract,
  user: Account
) {
  multisigContract = contract;
  techUser = user;
};

export const getMultisigContract = function(): Contract {
  return multisigContract;
};

export const getTechUser = function(): Account {
  return techUser;
};

export const setTxSign = async function (
  contractAddress: string,
  txid: string,
  value: boolean = true
) {
  let invokeData: IInvokeScriptParams<LONG>;
  switch (multisigContract.name) {
    case 'multisig':
      invokeData = {
        dApp: multisigContract.dApp,
        call: {
          function: 'confirmTransaction',
          args: [
            { type: 'string', value: contractAddress },
            { type: 'string', value: base58Encode(txid) },
          ]
        },
        payment: [{ assetId: null, amount: env.network.invokeFee }]
      };
      break;
    default:
      invokeData = {
        dApp: multisigContract.dApp,
        call: {
          function: 'setMultisigParams',
          args: [
            { type: 'string', value: contractAddress },
            { type: 'string', value: base58Encode(txid) },
            { type: 'boolean', value: value }
          ]
        },
        payment: [{ assetId: null, amount: env.network.invokeFee }]
      };
  }
  await invoke(
    invokeData,
    techUser.privateKey,
    env.network
  );
};

export const sendTransaction = async function (tx: any) {
  await broadcast(tx, env.network.nodeAPI);
  const txMined = await waitForTx(tx.id, {
    apiBase: env.network.nodeAPI,
    timeout: env.network.nodeTimeout,
  });
  if(txMined.applicationStatus !== 'succeeded') {
    throw new Error('Transaction failed!');
  }
};

export const prepareDataTx = async function(contract: Contract, data: IDataParams) {
  return wavesData(
    {
      data: data.data,
      fee: env.network.invokeFee,
      additionalFee: env.network.additionalFee,
      senderPublicKey: contract.publicKey,
      chainId: env.network.chainID,
    },
    contract.privateKey
  );
};

export const prepareInvokeTx = function (
  params: IInvokeScriptParams<LONG>,
  privateKey: TPrivateKey
) {
  return invokeScript(
    {
      dApp: params.dApp,
      feeAssetId: null,
      call: params.call,
      payment: params.payment,
      fee: params.fee || env.network.invokeFee,
      additionalFee: params.additionalFee,
      chainId: params.chainId || env.network.chainID,
    },
    privateKey
  );
};

export const setSignedContext = async function (
  contract: Contract,
  data: IDataParams
) {
  const tx = await prepareDataTx(contract, data);
  await setTxSign(contract.dApp, tx.id);
  await sendTransaction(tx);
};

export type Sender = {
  address: string,
  publicKey: string,
  privateKey: string
};

export const signedTransfer = async function (
  sender: Sender,
  recpAddress: string,
  amount: number
) {
  const tx = transfer({
    recipient: recpAddress,
    amount: amount,
    assetId: null,
    fee: env.network.transferFee,
    feeAssetId: null,
    chainId: env.network.chainID,
    senderPublicKey: sender.publicKey
  },
  { privateKey: sender.privateKey });
  await setTxSign(sender.address, tx.id);
  await sendTransaction(tx);
};

export const setInt = async function (
  contract: Contract,
  user: Account,
  value: LONG
) {
  const params: IInvokeScriptParams<LONG> = {
    dApp: contract.dApp,
    call: {
      function: 'bigintToBinary',
      args: [
        { type: 'integer', value: value }
      ]
    },
    payment: [
      { assetId: null, amount: env.network.invokeFee }
    ]
  };
  return await invoke(params, user.privateKey, env.network);
};

/**
 * MOVE TO UTILS!!!
 */
export const getAssetInfo = async function (assetId_: string) {
  return await fetchDetails(env.network.nodeAPI, assetId_);
};
