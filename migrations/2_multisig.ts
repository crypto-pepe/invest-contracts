import path = require('path');
import { deployScript, ProofsGenerator } from '../utils/script';
import { transfer, data, invoke } from '../utils/transaction';
import {
  WavesInvokeFee,
  WavesNetwork,
  WavesNetworkMainnet,
  WavesSetScriptFee,
} from '../utils/network';
import { address, seedWithNonce, keyPair } from '@waves/ts-lib-crypto';

export default async function (
  deployerSeed: string,
  appliedNonce: number,
  network: WavesNetwork,
  proofsGenerator: ProofsGenerator
) {
  const deployerPrivateKey = keyPair(deployerSeed).privateKey;
  const contract = keyPair(seedWithNonce(deployerSeed, appliedNonce + 1));
  const contractAddress = address(
    { publicKey: contract.publicKey },
    network.chaidID
  );

  await transfer(
    {
      amount: WavesSetScriptFee + WavesInvokeFee,
      recipient: contractAddress,
    },
    deployerPrivateKey,
    network,
    proofsGenerator
  ).catch((e) => {
    throw e;
  });

  let defaultQuorum = 0;
  switch (network) {
    case WavesNetworkMainnet:
      defaultQuorum = 3;
      break;
    default:
      defaultQuorum = 2;
  }

  await deployScript(
    path.resolve(process.cwd(), './ride/multisig.ride'),
    contract.privateKey,
    network,
    proofsGenerator
  ).catch((e) => {
    throw e;
  });

  await invoke(
    {
      dApp: contractAddress,
      call: {
        function: 'init',
        args: [
          {
            type: 'list',
            value: [
              {
                type: 'string',
                value: 'yMQKms5WvLvobErygwGjByEuNuebLMGXHndfVDsjMVD',
              },
              {
                type: 'string',
                value: 'BN9meJdnaezqtUK7iGhWC9a6TvgU51ESc69wT8x7AnN8',
              },
              {
                type: 'string',
                value: 'ENV5mvh5GsDNHhqwYt1BzxfZew1M3rRRzXub5vaGxY3C',
              },
              {
                type: 'string',
                value: 'nobcGCfJ1ZG1J6g8T9dRLoUnBCgQ6DM5H8Hy78sAmSN',
              },
              {
                type: 'string',
                value: 'Hv2T217jAFbgjXiqrz2CKQkbFH9CJc9dFAgwcQmi3Q83',
              },
            ],
          },
          {
            type: 'integer',
            value: defaultQuorum,
          },
        ],
      },
      fee: 100500000,
    },
    deployerPrivateKey,
    network,
    undefined
  ).catch((e) => {
    throw e;
  });

  return appliedNonce + 1;
}
