import {
  Contract,
  invoke,
} from '@pepe-team/waves-sc-test-utils';
import { getEnvironment } from 'relax-env-json';
import { getTechUser } from './common';
const env = getEnvironment();

export const init = async (
  contract: Contract,
  multisig: string,
  adapterContract: string
) => {
  await invoke(
    {
      dApp: contract.dApp,
      call: { 
        function: 'init',
        args: [
          { type: 'string', value: multisig },
          { type: 'string', value: adapterContract },
        ]
      }
    },
    getTechUser().privateKey,
    env.network
  );
};