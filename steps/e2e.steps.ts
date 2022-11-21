export { setSteps } from './common';
import { invoke } from '@pepe-team/waves-sc-test-utils';
import { getMultisigContract, getTechUser } from './common';
import { getEnvironment } from 'relax-env-json';
const env = getEnvironment();

export const setDefaultClaimData = async function() {
  await setClaimData('', 0, 0, 0, 0);
};

export const setClaimData = async function (
  claimer: string,
  lastClaim: number,
  reward: number,
  lastRewardBlock: number,
  claimInterval: number
) {
  await invoke(
    {
      dApp: getMultisigContract().dApp,
      call: { 
        function: 'setClaimer',
        args: [
          { type: 'string', value: claimer },
          { type: 'integer', value: lastClaim },
          { type: 'integer', value: reward },
          { type: 'integer', value: lastRewardBlock },
          { type: 'integer', value: claimInterval }
        ]
      },
      payment: [
        { assetId: null, amount: env.network.invokeFee }
      ]
    },
    getTechUser().privateKey,
    env.network
  );
};
