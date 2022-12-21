import {
  Contract,
  invoke,
} from '@pepe-team/waves-sc-test-utils';
import { TPrivateKey } from '@waves/ts-lib-crypto';
import { getEnvironment } from 'relax-env-json';
import { prepareInvokeTx, sendTransaction, setTxSign } from './common';
const env = getEnvironment();

let contract: Contract;

export const setContract = (contract_: Contract) => { contract = contract_; };

export const init = async (
  multisig_: string,
  stakingContract_: string,
  leasingNode_: string,
  manager_: string,
  feeRate_: number,
  contract_: Contract = contract
) => {
  await invoke(
    {
      dApp: contract_.dApp,
      call: { 
        function: 'setMultisig',
        args: [
          { type: 'string', value: multisig_ }
        ]
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
          { type: 'string', value: stakingContract_ },
          { type: 'string', value: leasingNode_ },
          { type: 'string', value: manager_ },
          { type: 'integer', value: feeRate_ },
        ]
      },
    },
    { privateKey: contract_.privateKey }
  );
  await setTxSign(contract_.dApp, tx.id);
  await sendTransaction(tx);
};

export const stake = async (
  payments_: any[],
  privateKey_: TPrivateKey,
  contract_ = contract
) => {
  const tx = prepareInvokeTx({
    dApp: contract_.dApp,
    call: {
      function: 'stake'
    },
    payment: payments_
  },
  privateKey_);
  await setTxSign(contract_.dApp,tx.id);
  await sendTransaction(tx);
};

export const unstake = async (
  args_: any[],
  privateKey_: TPrivateKey,
  contract_ = contract
) => {
  const tx = prepareInvokeTx({
    dApp: contract_.dApp,
    call: {
      function: 'unstake',
      args: args_
    }
  },
  privateKey_);
  await setTxSign(contract_.dApp,tx.id);
  await sendTransaction(tx);
};

export const claimReward = async (
  privateKey_: TPrivateKey,
  contract_ = contract
) => {
  const tx = prepareInvokeTx({
    dApp: contract_.dApp,
    call: {
      function: 'claimReward'
    }
  },
  privateKey_);
  await setTxSign(contract_.dApp,tx.id);
  await sendTransaction(tx);
};

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

export const setTarget = async (
  target_: string,
  contract_: Contract = contract
) => {
  const tx = prepareInvokeTx(
    {
      dApp: contract_.dApp,
      call: {
        function: 'setTarget',
        args: [{ type: 'string', value: target_ }]
      },
    },
    { privateKey: contract_.privateKey }
  );
  await setTxSign(contract_.dApp, tx.id);
  await sendTransaction(tx);
};

export const setAdaptee = async (
  adaptee_: string,
  contract_: Contract = contract
) => {
  const tx = prepareInvokeTx(
    {
      dApp: contract_.dApp,
      call: {
        function: 'setAdaptee',
        args: [{ type: 'string', value: adaptee_ }]
      },
    },
    { privateKey: contract_.privateKey }
  );
  await setTxSign(contract_.dApp, tx.id);
  await sendTransaction(tx);
};

export const setManager = async (
  manager_: string,
  contract_: Contract = contract
) => {
  const tx = prepareInvokeTx(
    {
      dApp: contract_.dApp,
      call: {
        function: 'setManager',
        args: [{ type: 'string', value: manager_ }]
      },
    },
    { privateKey: contract_.privateKey }
  );
  await setTxSign(contract_.dApp, tx.id);
  await sendTransaction(tx);
};

export const setFeeRate = async (
  feeRate_: number,
  contract_: Contract = contract
) => {
  const tx = prepareInvokeTx(
    {
      dApp: contract_.dApp,
      call: {
        function: 'setFeeRate',
        args: [{ type: 'integer', value: feeRate_ }]
      },
    },
    { privateKey: contract_.privateKey }
  );
  await setTxSign(contract_.dApp, tx.id);
  await sendTransaction(tx);
};
