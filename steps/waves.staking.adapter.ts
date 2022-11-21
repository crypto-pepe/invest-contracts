import {
  Contract,
  invoke,
} from '@pepe-team/waves-sc-test-utils';
import { TPrivateKey } from '@waves/ts-lib-crypto';
import { getEnvironment } from 'relax-env-json';
import { getTechUser, prepareInvokeTx, sendTransaction, setTxSign } from './common';
const env = getEnvironment();

let contract: Contract;

export const setContract = (contract_: Contract) => { contract = contract_; }

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
        function: 'init',
        args: [
          { type: 'string', value: multisig_ },
          { type: 'string', value: stakingContract_ },
          { type: 'string', value: leasingNode_ },
          { type: 'string', value: manager_ },
          { type: 'integer', value: feeRate_ },
        ]
      }
    },
    getTechUser().privateKey,
    env.network
  );
};

/**
 * DEPRECATED 
 */
export const claimFee = async (
  address_: string,
  privateKey_: TPrivateKey,
  contract_: Contract = contract
) => {
  const tx = prepareInvokeTx(
    {
      dApp: contract_.dApp,
      call: { 
        function: 'claimFee',
        args: [
          { type: 'string', value: address_ }
        ]
      }
    },
    privateKey_
  );
  await setTxSign(contract_.dApp, tx.id);
  await sendTransaction(tx);
};
