import path = require('path');
import { deployScript, ProofsGenerator } from '../utils/script';
import { data, invoke, transfer } from '../utils/transaction';
import {
  WavesInvokeFee,
  WavesNetwork,
  WavesNetworkMainnet,
  WavesSetScriptFee,
} from '../utils/network';
import { address, seedWithNonce, keyPair } from '@waves/ts-lib-crypto';
import { lease } from '@waves/waves-transactions';

export default async function (
  deployerSeed: string,
  appliedNonce: number,
  network: WavesNetwork,
  proofsGenerator: ProofsGenerator
) {
  const deployerPrivateKey = keyPair(deployerSeed).privateKey;
  const deployerAddress = address(
    {
      publicKey: keyPair(deployerSeed).publicKey,
    },
    network.chaidID
  );
  const contract = keyPair(seedWithNonce(deployerSeed, appliedNonce + 1));
  const contractAddress = address(
    { publicKey: contract.publicKey },
    network.chaidID
  );

  const multisigPublicKey = keyPair(seedWithNonce(deployerSeed, 1)).publicKey;

  await transfer(
    {
      amount: WavesSetScriptFee + WavesInvokeFee + 100000000,
      recipient: contractAddress,
    },
    deployerPrivateKey,
    network,
    proofsGenerator
  ).catch((e) => {
    throw e;
  });

  // await data(
  //   {
  //     data: [{ key: 'MULTISIG', type: 'string', value: multisigPublicKey }],
  //   },
  //   contract.privateKey,
  //   network,
  //   proofsGenerator
  // ).catch((e) => {
  //   throw e;
  // });

  await deployScript(
    path.resolve(process.cwd(), './ride/waves_staking.ride'),
    contract.privateKey,
    network,
    proofsGenerator
  ).catch((e) => {
    throw e;
  });

  let leaseNodeAddress = '';
  switch (network) {
    case WavesNetworkMainnet:
      leaseNodeAddress = 'TODO: set lease address';
      break;
    default:
      leaseNodeAddress = deployerAddress;
  }

  await invoke(
    {
      dApp: contractAddress,
      call: {
        function: 'init',
        args: [
          {
            type: 'string',
            value: multisigPublicKey,
          },
          {
            type: 'string',
            value: leaseNodeAddress,
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

  await invoke(
    {
      dApp: contractAddress,
      call: {
        function: 'deposit',
      },
      payment: [{ assetId: null, amount: 100000000 }],
    },
    deployerPrivateKey,
    network,
    undefined
  ).catch((e) => {
    throw e;
  });

  return appliedNonce + 1;
}
