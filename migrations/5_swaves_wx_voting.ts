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

  const wavesStakingContract = keyPair(seedWithNonce(deployerSeed, 4));
  const wavesStakingContractAddress = address(
    { publicKey: wavesStakingContract.publicKey },
    network.chainID
  );
  console.log('waves staking contract address =', wavesStakingContractAddress);

  const assetImage =
    '<svg width="700" height="700" viewBox="0 0 700 700" fill="none" xmlns="http://www.w3.org/2000/svg"> \
  <g clip-path="url(#clip0_1165_39153)"> \
  <circle cx="350" cy="350" r="350" fill="white"/>  \
  <path d="M349.992 71.0077L70.9924 350.008L163.866 442.881L257.239 536.09L349.992 629.008L628.992 350.008L536.156 257.172L442.866 163.881L349.992 71.0077Z" fill="#1F5AF6"/>  \
  <rect x="443.164" y="164.164" width="88.7772" height="258.679" transform="rotate(45 443.164 164.164)" fill="url(#paint0_linear_1165_39153)"/>  \
  <rect width="88.7772" height="265.305" transform="matrix(0.707107 0.707107 0.707107 -0.707107 257.157 536.172)" fill="url(#paint1_linear_1165_39153)"/>  \
  <rect width="131.703" height="291.446" transform="matrix(-0.707107 -0.707107 -0.707107 0.707107 443.003 164.253)" fill="url(#paint2_linear_1165_39153)"/>  \
  <rect x="257.157" y="536.172" width="262.569" height="301.871" transform="rotate(-135 257.157 536.172)" fill="url(#paint3_linear_1165_39153)"/>  \
  </g>  \
  <defs>  \
  <linearGradient id="paint0_linear_1165_39153" x1="443.164" y1="199.256" x2="507.282" y2="217.675" gradientUnits="userSpaceOnUse">  \
  <stop stop-color="#1B49C1"/>  \
  <stop offset="1" stop-color="#1F5AF6" stop-opacity="0"/>  \
  </linearGradient>  \
  <linearGradient id="paint1_linear_1165_39153" x1="7.45554e-07" y1="35.9906" x2="67.599" y2="60.628" gradientUnits="userSpaceOnUse">  \
  <stop stop-color="#1B49C1"/>  \
  <stop offset="1" stop-color="#1F5AF6" stop-opacity="0"/>  \
  </linearGradient>  \
  <linearGradient id="paint2_linear_1165_39153" x1="0.242253" y1="12.9314" x2="132.83" y2="152.839" gradientUnits="userSpaceOnUse">  \
  <stop stop-color="#5F8BFF"/>  \
  <stop offset="1" stop-color="#1F5AF6" stop-opacity="0"/>  \
  </linearGradient>  \
  <linearGradient id="paint3_linear_1165_39153" x1="269.41" y1="555.274" x2="400.263" y2="750.159" gradientUnits="userSpaceOnUse">  \
  <stop stop-color="#5F8BFF"/>  \
  <stop offset="1" stop-color="#1F5AF6" stop-opacity="0"/>  \
  </linearGradient>  \
  <clipPath id="clip0_1165_39153">  \
  <rect width="700" height="700" fill="white"/>  \
  </clipPath>  \
  </defs>  \
  </svg>';

  // Invoke wxVotingSuggest only for mainnet and testnet
  switch (network.name) {
    case 'mainnet':
      await transfer(
        {
          amount: network.invokeFee,
          recipient: wavesStakingContractAddress,
        },
        deployerPrivateKey,
        network,
        proofsGenerator
      ).catch((e) => {
        throw e;
      });

      await invoke(
        {
          dApp: '3P5VWBCpqEWcnEuyt3qVqJsrmEF5nE22Zy1',
          call: {
            function: 'suggest',
            args: [
              {
                type: 'string',
                value: 'YiNbofFzC17jEHHCMwrRcpy9MrrjabMMLZxg8g5xmf7', // assetId
              },
              {
                type: 'string',
                value: assetImage, // assetImage
              },
            ],
          },
          payment: [
            {
              assetId: 'Atqv59EYzjFGuitKVnMRk6H8FukjoV3ktPorbEys25on',
              amount: 10000000000,
            },
          ],
        },
        wavesStakingContract.privateKey,
        network,
        proofsGenerator
      ).catch((e) => {
        throw e;
      });
      break;

    case 'testnet':
      await transfer(
        {
          amount: network.invokeFee,
          recipient: wavesStakingContractAddress,
        },
        deployerPrivateKey,
        network,
        proofsGenerator
      ).catch((e) => {
        throw e;
      });

      await invoke(
        {
          dApp: '3N9yMmmL5cJ7LJxr8o6GFbKFUbGz4XcAjeg',
          call: {
            function: 'suggest',
            args: [
              {
                type: 'string',
                value: 'FXiFxedP76Cmg1v4XGNDYJpNE9gTGPRG1zjfkmUsGhFm', // assetId
              },
              {
                type: 'string',
                value: assetImage, // assetImage
              },
            ],
          },
          payment: [
            {
              assetId: 'EMAMLxDnv3xiz8RXg8Btj33jcEw3wLczL3JKYYmuubpc',
              amount: 1000000000,
            },
          ],
        },
        wavesStakingContract.privateKey,
        network,
        proofsGenerator
      ).catch((e) => {
        throw e;
      });
      break;
  }

  return appliedNonce;
}
