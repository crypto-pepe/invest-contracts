import { getTechUser } from './common';
import {
  Asset,
  Contract,
  invoke,
} from '@pepe-team/waves-sc-test-utils';
import { getEnvironment } from 'relax-env-json';
import { TPrivateKey } from '@waves/ts-lib-crypto';
const env = getEnvironment();

let contract: Contract;

export const setContract = (contract_: Contract) => { contract = contract_; }

export const init = async (
  multisig_: string,
  amount_: number,
  token_: Asset,
  adapter_: string,
  contract_: Contract = contract,
) => {
  await invoke(
    {
      dApp: contract_.dApp,
      call: { 
        function: 'init',
        args: [
          { type: 'string', value: multisig_ },
          { type: 'string', value: token_.name },
          { type: 'string', value: token_.description },
          { type: 'string', value: token_.assetId },
          { type: 'string', value: adapter_ },
        ]
      },
      payment: [
        { assetId: null, amount: amount_ }
      ],
      fee: 100500000
    },
    getTechUser().privateKey,
    env.network
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
  assetId_: string,
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
