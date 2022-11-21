export const PERCENT_FACTOR = 10000;

export const baseRewardCalculate = (
  infraFeeRate: number,
  infraAmount: number
) => {
  return Math.ceil(infraAmount * PERCENT_FACTOR / infraFeeRate);
};

export const infraFeeCalculate = (
  waveses: number,
  infraFeeRate: number
) => {
    return Math.floor(waveses * infraFeeRate / PERCENT_FACTOR);
};

export const wavesCalculate = (
  reward: number,
  infraFeeRate: number
) => {
  return Math.floor(reward * (PERCENT_FACTOR * PERCENT_FACTOR + infraFeeRate * PERCENT_FACTOR + infraFeeRate * infraFeeRate) / (PERCENT_FACTOR * PERCENT_FACTOR));
};
