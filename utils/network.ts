export const WavesTransferFee = 100000;
export const WavesInvokeFee = 500000;
export const WavesSetScriptFee = 1400000;

export type WavesNetwork = {
  nodeAPI: string;
  nodeTimeout: number;
  chaidID: string;
};

export const WavesNetworkCustom: WavesNetwork = {
  nodeAPI: 'http://localhost:6869',
  nodeTimeout: 10000,
  chaidID: 'R',
};

export const WavesNetworkTestnet: WavesNetwork = {
  nodeAPI: 'https://nodes-testnet.wavesnodes.com',
  nodeTimeout: 120000,
  chaidID: 'T',
};

export const WavesNetworkMainnet: WavesNetwork = {
  nodeAPI: 'https://nodes.wavesnodes.com',
  nodeTimeout: 120000,
  chaidID: 'W',
};
