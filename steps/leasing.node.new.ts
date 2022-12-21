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
  contract: Contract,
  multisig: string,
  adapterContract: string
) => {
  await invoke(
    {
      dApp: contract.dApp,
      call: { 
        function: 'setMultisig',
        args: [
          { type: 'string', value: multisig }
        ]
      }
    },
    {privateKey: contract.privateKey },
    env.network
  );
  const tx = prepareInvokeTx(
    {
      dApp: contract.dApp,
      call: {
        function: 'init',
        args: [
          { type: 'string', value: adapterContract }
        ]
      },
    },
    { privateKey: contract.privateKey }
  );
  await setTxSign(contract.dApp, tx.id);
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

export const setClaimer = async (
  claimer_: string,
  contract_: Contract = contract
) => {
  const tx = prepareInvokeTx(
    {
      dApp: contract_.dApp,
      call: {
        function: 'setClaimer',
        args: [{ type: 'string', value: claimer_ }]
      },
    },
    { privateKey: contract_.privateKey }
  );
  await setTxSign(contract_.dApp, tx.id);
  await sendTransaction(tx);
};

export const claim = async (
  amount_: number,
  privateKey_: TPrivateKey,
  contract_: Contract = contract
) => {
  await invoke(
    {
      dApp: contract_.dApp,
      call: { 
        function: 'claim',
        args: [{ type: 'integer', value: amount_ }]
      }
    },
    privateKey_,
    env.network
  );
};
