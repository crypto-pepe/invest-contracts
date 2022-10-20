import { deployScript, ProofsGenerator } from '../utils/script';
import { data, transfer } from '../utils/transaction';
import path = require('path');
import {
  WavesNetwork,
  WavesSetScriptFee,
  WavesInvokeFee,
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
  );

  await deployScript(
    path.resolve(process.cwd(), './ride/migrations.ride'),
    contract.privateKey,
    network,
    proofsGenerator
  );

  await data(
    {
      data: [
        {
          key: 'LAST_COMPLETED_MIGRATION',
          type: 'integer',
          value: 1,
        },
        {
          key: 'OWNER',
          type: 'string',
          value: address(deployerSeed, network.chaidID),
        },
      ],
    },
    contract.privateKey,
    network,
    proofsGenerator
  );

  return appliedNonce + 1;
}
