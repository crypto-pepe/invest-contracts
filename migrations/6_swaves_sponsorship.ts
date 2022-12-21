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
  const deployerAddress = address(
    { publicKey: keyPair(deployerSeed).publicKey },
    network.chainID
  );

  const multisigAddress = address(
    { publicKey: keyPair(seedWithNonce(deployerSeed, 2)).publicKey },
    network.chainID
  );
  console.log('Multisig contract address =', multisigAddress);

  const wavesStakingContract = keyPair(seedWithNonce(deployerSeed, 4));
  const wavesStakingContractAddress = address(
    { publicKey: wavesStakingContract.publicKey },
    network.chainID
  );
  console.log('Waves staking contract address =', wavesStakingContractAddress);

  const sponsorshipContract = keyPair(seedWithNonce(deployerSeed, 5));
  const sponsorshipContractAddress = address(
    { publicKey: sponsorshipContract.publicKey },
    network.chainID
  );
  console.log('Sponsorship contract address =', sponsorshipContractAddress);

  // Deploy sponsorship_manager contract
  await transfer(
    {
      amount: network.setScriptFee + 2 * network.invokeFee,
      recipient: sponsorshipContractAddress,
    },
    deployerPrivateKey,
    network,
    proofsGenerator
  ).catch((e) => {
    throw e;
  });

  await deployScript(
    path.resolve(process.cwd(), './ride/sponsorship_manager.ride'),
    sponsorshipContract.privateKey,
    network,
    proofsGenerator
  ).catch((e) => {
    throw e;
  });

  // sponsorshipContract setMultisig()
  await invoke(
    {
      dApp: sponsorshipContractAddress,
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
    sponsorshipContract.privateKey,
    network,
    proofsGenerator
  ).catch((e) => {
    throw e;
  });

  // Update tokenized_staking
  await transfer(
    {
      amount: network.setScriptFee + network.invokeFee,
      recipient: wavesStakingContractAddress,
    },
    deployerPrivateKey,
    network,
    proofsGenerator
  ).catch((e) => {
    throw e;
  });

  await deployScript(
    path.resolve(process.cwd(), './ride/tokenized_staking.ride'),
    wavesStakingContract.privateKey,
    network,
    proofsGenerator
  ).catch((e) => {
    throw e;
  });

  // setSponsorshipManager
  await invoke(
    {
      dApp: wavesStakingContractAddress,
      call: {
        function: 'setSponsorshipManager',
        args: [
          {
            type: 'string',
            value: sponsorshipContractAddress, // manager_
          },
        ],
      },
    },
    wavesStakingContract.privateKey,
    network,
    proofsGenerator
  ).catch((e) => {
    throw e;
  });

  let beneficiaryAddress = '';
  switch (network.name) {
    case 'mainnet':
      beneficiaryAddress = '3PDETXtiaErZncMduS8h9G6aopcjT7wheqj';
      break;
    case 'testnet':
      beneficiaryAddress = '3MwgDbpnUQcr7MiFVQ1NcNgTBvkRytdGd2R';
      break;
    case 'custom':
      beneficiaryAddress = deployerAddress;
      break;
  }

  // sponsorshipContract setupSponsorship()
  await invoke(
    {
      dApp: sponsorshipContractAddress,
      call: {
        function: 'setupSponsorship',
        args: [
          {
            type: 'string',
            value: wavesStakingContractAddress, // tokenContract_
          },
          {
            type: 'integer',
            value: 100000, // minSponsoredAssetFee_
          },
          {
            type: 'integer',
            value: 10000000000, // sponsoredWaves_
          },
          {
            type: 'integer',
            value: 2000000000, // thresholdWaves_
          },
          {
            type: 'string',
            value: beneficiaryAddress, // beneficiaryAddress_
          },
        ],
      },
    },
    sponsorshipContract.privateKey,
    network,
    proofsGenerator
  ).catch((e) => {
    throw e;
  });

  return appliedNonce + 1;
}
