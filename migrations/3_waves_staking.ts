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
  const feeRate = 250;
  const tokenName = 'sWAVES';
  const tokenDescription =
    'sWAVES is the tokenized form of staked WAVES powered by PepeTeam. See details at https://swaves.pepe.team';

  const deployerPrivateKey = keyPair(deployerSeed).privateKey;
  const deployerAddress = address(deployerSeed, network.chainID);

  let leaseNodeContractAddress = '';
  switch (network.name) {
    case 'mainnet':
      leaseNodeContractAddress = '3PDETXtiaErZncMduS8h9G6aopcjT7wheqj';
      break;
    case 'testnet':
      leaseNodeContractAddress = '3MwgDbpnUQcr7MiFVQ1NcNgTBvkRytdGd2R';
      break;
    case 'custom':
      leaseNodeContractAddress = deployerAddress;
      break;
    default:
      throw 'Unknown network';
  }
  console.log('Lease node contract address =', leaseNodeContractAddress);

  const multisigAddress = address(
    { publicKey: keyPair(seedWithNonce(deployerSeed, 2)).publicKey },
    network.chainID
  );
  console.log('Multisig contract address =', multisigAddress);

  const adapterContract = keyPair(
    seedWithNonce(deployerSeed, appliedNonce + 1)
  );
  const adapterContractAddress = address(
    { publicKey: adapterContract.publicKey },
    network.chainID
  );
  console.log('Waves adapter contract address =', adapterContractAddress);

  const stakingContract = keyPair(
    seedWithNonce(deployerSeed, appliedNonce + 2)
  );
  const stakingContractAddress = address(
    { publicKey: stakingContract.publicKey },
    network.chainID
  );
  console.log('Waves staking contract address =', stakingContractAddress);

  // IMPORTANT
  // throw 'wait for leasing_node.ride contract to be ready';

  // Deploy adapterContract
  await transfer(
    {
      amount: network.setScriptFee + 2 * network.invokeFee,
      recipient: adapterContractAddress,
    },
    deployerPrivateKey,
    network,
    proofsGenerator
  ).catch((e) => {
    throw e;
  });

  await deployScript(
    path.resolve(process.cwd(), './ride/waves_staking_adapter.ride'),
    adapterContract.privateKey,
    network,
    proofsGenerator
  ).catch((e) => {
    throw e;
  });

  await invoke(
    {
      dApp: adapterContractAddress,
      call: {
        function: 'setMultisig',
        args: [
          {
            type: 'string',
            value: multisigAddress,
          },
        ],
      },
    },
    adapterContract.privateKey,
    network,
    proofsGenerator
  ).catch((e) => {
    throw e;
  });

  await invoke(
    {
      dApp: adapterContractAddress,
      call: {
        function: 'init',
        args: [
          {
            type: 'string',
            value: stakingContractAddress, // target_
          },
          {
            type: 'string',
            value: leaseNodeContractAddress, // adaptee_
          },
          {
            type: 'string',
            value: multisigAddress, // manager_
          },
          {
            type: 'integer',
            value: feeRate, // feeRate_
          },
        ],
      },
    },
    adapterContract.privateKey,
    network,
    proofsGenerator
  ).catch((e) => {
    throw e;
  });

  // Deploy stakingContract
  await transfer(
    {
      amount: network.setScriptFee + 2 * network.invokeFee + 200000000,
      recipient: stakingContractAddress,
    },
    deployerPrivateKey,
    network,
    proofsGenerator
  ).catch((e) => {
    throw e;
  });

  await deployScript(
    path.resolve(process.cwd(), './ride/tokenized_staking.ride'),
    stakingContract.privateKey,
    network,
    proofsGenerator
  ).catch((e) => {
    throw e;
  });

  await invoke(
    {
      dApp: stakingContractAddress,
      call: {
        function: 'setMultisig',
        args: [
          {
            type: 'string',
            value: multisigAddress,
          },
        ],
      },
    },
    stakingContract.privateKey,
    network,
    proofsGenerator
  ).catch((e) => {
    throw e;
  });

  await invoke(
    {
      dApp: stakingContractAddress,
      call: {
        function: 'init',
        args: [
          {
            type: 'string',
            value: tokenName, // tokenName_
          },
          {
            type: 'string',
            value: tokenDescription, // tokenDescr_
          },
          {
            type: 'string',
            value: 'WAVES', // baseAsset_
          },
          {
            type: 'string',
            value: adapterContractAddress, // stakingAdapter_
          },
        ],
      },
      fee: 100500000,
    },
    stakingContract.privateKey,
    network,
    proofsGenerator
  ).catch((e) => {
    throw e;
  });

  return appliedNonce + 2;
}
