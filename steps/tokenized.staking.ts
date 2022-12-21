import { getTechUser, prepareInvokeTx, sendTransaction, setTxSign } from './common';
import {
  Contract,
  invoke,
} from '@pepe-team/waves-sc-test-utils';
import { getEnvironment } from 'relax-env-json';
import {
  base58Encode,
  TPrivateKey
} from '@waves/ts-lib-crypto';
import { fetchEvaluate } from '@waves/node-api-js/cjs/api-node/utils';
const env = getEnvironment();

let contract: Contract;

export const setContract = (contract_: Contract) => { contract = contract_; };

export const init = async (
  multisig_: Contract,
  name_: string,
  description_: string,
  baseToken_: string,
  adapter_: string,
  contract_: Contract = contract,
) => {
  await invoke(
    {
      dApp: contract_.dApp,
      call: { 
        function: 'setMultisig',
        args: [
          { type: 'string', value: base58Encode(multisig_.dApp) }
        ],
      }
    },
    {privateKey: contract_.privateKey },
    env.network
  );
  const tx = prepareInvokeTx(
    {
      dApp: contract_.dApp,
      call: {
        function: 'init',
        args: [

          { type: 'string', value: name_ },
          { type: 'string', value: description_ },
          { type: 'string', value: baseToken_ },
          { type: 'string', value: adapter_ },
        ]
      },
      fee: 100500000
    },
    { privateKey: contract_.privateKey }
  );
  await setTxSign(contract_.dApp, tx.id);
  await sendTransaction(tx);
  await deposit(
    15000000000,
    getTechUser().privateKey
  );
};

export const deposit = async (
  amount_: number,
  privateKey_: TPrivateKey,
  assetId_: string | null = null,
  contract_: Contract = contract,
) => {
  await invoke(
    {
      dApp: contract_.dApp,
      call: { 
        function: 'deposit'
      },
      payment: [
        { assetId: assetId_, amount: amount_ }
      ]
    },
    privateKey_,
    env.network
  );
};

export const checkpoint = async (
  privateKey_: TPrivateKey,
  contract_: Contract = contract
) => {
  await invoke(
    {
      dApp: contract_.dApp,
      call: { 
        function: 'checkpoint'
      }
    },
    privateKey_,
    env.network
  );
};

export const withdraw = async (
  amount_: number,
  assetId_: string | null,
  privateKey_: TPrivateKey,
  contract_: Contract = contract
) => {
  await invoke(
    {
      dApp: contract_.dApp,
      call: { 
        function: 'withdraw'
      },
      payment: [{ assetId: assetId_, amount: amount_ }]
    },
    privateKey_,
    env.network
  );
};

export const getRate = async (
  address_: string
): Promise<number> => {
  const result: any = await fetchEvaluate(env.network.nodeAPI, address_, 'getRate()');
  return Number(result.result.value['_2'].value);
};

export const stake = async (
  amount_: number,
  claimHeight_: number,
  contract_: Contract = contract
) => {
  const tx = prepareInvokeTx({
    dApp: contract_.dApp,
    call: {
      function: 'stake',
      args: [
        { type: 'integer', value: amount_ },
        { type: 'integer', value: claimHeight_ }
      ]
    }
  },
  { privateKey: contract_.privateKey });
  await setTxSign(contract_.dApp,tx.id);
  await sendTransaction(tx);
};

export const setSponsorshipManager = async (
  managerAddress_: string,
  contract_: Contract = contract
) => {
  const tx = prepareInvokeTx({
    dApp: contract.dApp,
    call: { 
      function: 'setSponsorshipManager',
      args: [
        { type: 'string', value: managerAddress_ }
      ]
    }
  },
  { privateKey: contract_.privateKey });
  await setTxSign(contract_.dApp,tx.id);
  await sendTransaction(tx);
};

export const updateSponsorship = async (
  minFee_: number,
  minWavesAmt_: number,
  privateKey_: TPrivateKey,
  contract_: Contract = contract
) => {
  await invoke(
    {
      dApp: contract_.dApp,
      call: { 
        function: 'updateSponsorship',
        args: [
          { type: 'integer', value: minFee_ },
          { type: 'integer', value: minWavesAmt_ }
        ]
      }
    },
    privateKey_,
    env.network
  );
};
