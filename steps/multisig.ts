import {
    Contract,
    invoke,
  } from '@pepe-team/waves-sc-test-utils';
import { getEnvironment } from 'relax-env-json';
import { InvokeScriptCallStringArgument } from '@waves/ts-types/dist/src/parts';
import { getTechUser } from './common';
const env = getEnvironment();

export const init = async (
  contract: Contract,
  owners: string[],
  quorum: number
) => {
  const ownersList: InvokeScriptCallStringArgument[] = owners.map(o => { return { type: 'string', value: o }});
  await invoke(
    {
      dApp: contract.dApp,
      call: { 
        function: 'init',
        args: [
          { type: 'list', value: ownersList },
          { type: 'integer', value: quorum }
        ]
      }
    },
    getTechUser().privateKey,
    env.network
  );
};