import {
  Contract,
  invoke,
} from '@pepe-team/waves-sc-test-utils';
import { TPrivateKey } from '@waves/ts-lib-crypto';
import { getEnvironment } from 'relax-env-json';
import { getTechUser, prepareInvokeTx, sendTransaction, setTxSign } from './common';
const env = getEnvironment();

let contract: Contract;

export const setContract = (contract_: Contract) => { contract = contract_; };

export const setMultisig = async (
  multisig_: string,
  contract_: Contract = contract
) => {
  const tx = prepareInvokeTx(
    {
      dApp: contract_.dApp,
      call: {
        function: 'setMultisig',
        args: [{ type: 'string', value: multisig_ }]
      },
    },
    { privateKey: contract_.privateKey }
  );
  await setTxSign(contract_.dApp, tx.id);
  await sendTransaction(tx);
};

export const setupSponsorship = async (
  tokenContract_: string,
  minAssetFee_: number,
  sponsoredWaves_: number,
  tresholdWaves_: number,
  beneficiaryAddress_: string,
  contract_: Contract = contract
) => {
  const tx = prepareInvokeTx(
    {
      dApp: contract_.dApp,
      call: {
        function: 'setupSponsorship',
        args: [
          { type: 'string', value: tokenContract_ },
          { type: 'integer', value: minAssetFee_ },
          { type: 'integer', value: sponsoredWaves_ },
          { type: 'integer', value: tresholdWaves_ },
          { type: 'string', value: beneficiaryAddress_ },
        ]
      },
    },
    { privateKey: contract_.privateKey }
  );
  await setTxSign(contract_.dApp, tx.id);
  await sendTransaction(tx);
};

export const updateSponsorshipMock = async (
  mock_: Contract,
  withoutError_: boolean,
  toExchange_ = 0
) => {
  await invoke(
    {
      dApp: mock_.dApp,
      call: {
        function: 'setUpdateSponsorship',
        args: [
          { type: 'boolean', value: withoutError_ },
          { type: 'integer', value: toExchange_ }
        ]
      }
    },
    getTechUser().privateKey,
    env.network
  );
};

export const updateWithdrawMock = async (
  mock_: Contract,
  isOk_: boolean,
  amount_ = 0
) => {
  await invoke(
    {
      dApp: mock_.dApp,
      call: {
        function: 'setWithdraw',
        args: [
          { type: 'boolean', value: isOk_ },
          { type: 'integer', value: amount_ }
        ]
      }
    },
    getTechUser().privateKey,
    env.network
  );
};

export const setMockAsset = async (
  mock_: Contract,
  name_: string,
  description_: string
) => {
  await invoke(
    {
      dApp: mock_.dApp,
      call: {
        function: 'setTestAsset',
        args: [
          { type: 'string', value: name_ },
          { type: 'string', value: description_ }
        ]
      },
      fee: 100500000
    },
    getTechUser().privateKey,
    env.network
  );
};

export const setMockPayeer = async (
  mock_: Contract,
  address_: string,
) => {
  await invoke(
    {
      dApp: mock_.dApp,
      call: {
        function: 'setPayeer',
        args: [
          { type: 'string', value: address_ }
        ]
      }
    },
    getTechUser().privateKey,
    env.network
  );
};

export const checkpointSponsorship = async (
  tokenContractAddress_: string,
  privateKey_: TPrivateKey,
  contract_: Contract = contract
) => {
  await invoke(
    {
      dApp: contract_.dApp,
      call: { 
        function: 'checkpointSponsorship',
        args: [
          { type: 'string', value: tokenContractAddress_ }
        ]
      }
    },
    privateKey_,
    env.network
  );
};

export const mintTestAsset = async (
  mock_: Contract,
  address_: string,
  amount_: number
) => {
  await invoke(
    {
      dApp: mock_.dApp,
      call: {
        function: 'mintTestAssetTo',
        args: [
          { type: 'string', value: address_ },
          { type: 'integer', value: amount_ }
        ]
      },
      fee: 100500000
    },
    getTechUser().privateKey,
    env.network
  );
};
