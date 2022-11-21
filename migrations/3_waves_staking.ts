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
  const leaseNodeContract = keyPair(
    seedWithNonce(deployerSeed, appliedNonce + 1)
  );
  const leaseNodeContractAddress = address(
    { publicKey: leaseNodeContract.publicKey },
    network.chainID
  );
  console.log('LeaseNode contract address =', leaseNodeContractAddress);

  const adapterContract = keyPair(
    seedWithNonce(deployerSeed, appliedNonce + 2)
  );
  const adapterContractAddress = address(
    { publicKey: adapterContract.publicKey },
    network.chainID
  );
  console.log('Waves adapter contract address =', adapterContractAddress);

  const stakingContract = keyPair(
    seedWithNonce(deployerSeed, appliedNonce + 3)
  );
  const stakingContractAddress = address(
    { publicKey: stakingContract.publicKey },
    network.chainID
  );
  console.log('Waves staking contract address =', stakingContractAddress);

  const multisigAddress = address(
    { publicKey: keyPair(seedWithNonce(deployerSeed, 1)).publicKey },
    network.chainID
  );

  // Deploy leaseNodeContract
  await transfer(
    {
      amount: network.setScriptFee + network.invokeFee,
      recipient: leaseNodeContractAddress,
    },
    deployerPrivateKey,
    network,
    proofsGenerator
  ).catch((e) => {
    throw e;
  });

  await deployScript(
    path.resolve(process.cwd(), './ride/leasing_node.ride'),
    leaseNodeContract.privateKey,
    network,
    proofsGenerator
  ).catch((e) => {
    throw e;
  });

  // func init(multisig_: String, claimer_: String)
  await invoke(
    {
      dApp: leaseNodeContractAddress,
      call: {
        function: 'init',
        args: [
          {
            type: 'string',
            value: multisigAddress, // multisig_
          },
          {
            type: 'string',
            value: adapterContractAddress, // claimer_
          },
        ],
      },
    },
    deployerPrivateKey,
    network,
    undefined
  ).catch((e) => {
    throw e;
  });

  // Deploy adapterContract
  await transfer(
    {
      amount: network.setScriptFee + network.invokeFee,
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

  // func init(multisig_: String, target_: String, adaptee_: String, manager_: String, feeRate_: Int)
  await invoke(
    {
      dApp: adapterContractAddress,
      call: {
        function: 'init',
        args: [
          {
            type: 'string',
            value: multisigAddress, // multisig_
          },
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
    deployerPrivateKey,
    network,
    undefined
  ).catch((e) => {
    throw e;
  });

  // Deploy stakingContract
  await transfer(
    {
      amount: network.setScriptFee + network.invokeFee + 100000000,
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

  // func init(multisig_: String, tokenName_: String, tokenDescr_: String, baseAsset_: String, stakingAdapter_: String) = {
  await invoke(
    {
      dApp: stakingContractAddress,
      call: {
        function: 'init',
        args: [
          {
            type: 'string',
            value: multisigAddress, // multisig_
          },
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
      payment: [{ assetId: null, amount: 100000000 }],
      fee: 100500000,
    },
    deployerPrivateKey,
    network,
    undefined
  ).catch((e) => {
    throw e;
  });

  // Check for deposit
  await invoke(
    {
      dApp: stakingContractAddress,
      call: {
        function: 'deposit',
      },
      payment: [{ assetId: null, amount: 1000000000 }],
    },
    deployerPrivateKey,
    network,
    undefined
  ).catch((e) => {
    throw e;
  });

  return appliedNonce + 3;
}
