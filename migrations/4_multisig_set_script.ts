import path = require('path');
import {
  NetworkConfig,
  deployScript,
  ProofsGenerator,
  invoke,
  transfer,
} from '@pepe-team/waves-sc-test-utils';
import { address, seedWithNonce, keyPair } from '@waves/ts-lib-crypto';

export default async function (
  deployerSeed: string,
  appliedNonce: number,
  network: NetworkConfig,
  proofsGenerator: ProofsGenerator
) {
  const deployerPrivateKey = keyPair(deployerSeed).privateKey;

  const multisigContract = keyPair(seedWithNonce(deployerSeed, 2));
  const multisigContractAddress = address(
    { publicKey: multisigContract.publicKey },
    network.chainID
  );
  console.log('Multisig contract address =', multisigContractAddress);

  // Redeploy multisig contract
  await transfer(
    {
      amount: network.setScriptFee,
      recipient: multisigContractAddress,
    },
    deployerPrivateKey,
    network,
    proofsGenerator
  ).catch((e) => {
    throw e;
  });

  await deployScript(
    path.resolve(process.cwd(), './ride/multisig.ride'),
    multisigContract.privateKey,
    network,
    proofsGenerator
  ).catch((e) => {
    throw e;
  });

  return appliedNonce;
}
