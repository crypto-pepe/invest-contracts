export const PERCENT_FACTOR = 1000000000000;

export const newStakingRates = (
  last_rate_: number,
  reward_: number,
  reward_height_: number,
  asset_amount_: number
) => {
  const curr_rate = Math.floor(reward_ * PERCENT_FACTOR / (asset_amount_ * reward_height_));
  return {
    last_rate: last_rate_,
    current_rate: curr_rate
  };
};

export const continuousStakingRates = (
  last_rate_: number,
  curr_rate_: number,
  blocks: {
    prev_start_block: number,
    prev_finish_block: number,
    last_block: number
  },
  reward_: number,
  reward_height_: number,
  asset_amount_: number
) => {
  const last_rate = last_rate_ + curr_rate_ * (blocks.last_block - blocks.prev_start_block);
  const continuousReward = curr_rate_ * (blocks.prev_finish_block - blocks.last_block);
  const curr_rate = Math.floor((continuousReward + reward_ * PERCENT_FACTOR) / (asset_amount_ * reward_height_));
  return {
    last_rate: last_rate,
    current_rate: curr_rate
  };
};

export const commitStakingRates = (
  last_rate_: number,
  curr_rate_: number,
  prev_reward_height_: number,
  reward_: number,
  reward_height_: number,
  asset_amount_: number
) => {
  const last_rate = last_rate_ + curr_rate_ * prev_reward_height_;
  const curr_rate = Math.floor(reward_ * PERCENT_FACTOR / (asset_amount_ * reward_height_));
  return {
    last_rate: last_rate,
    current_rate: curr_rate
  };
};

export const depositRates = (
  last_rate_: number,
  curr_rate_: number,
  deposit: number,
  blocks: {
    prev_start_block: number,
    prev_finish_block: number,
    last_block: number
  },
  assetQty: number
) => {
  const last_block = Math.min(blocks.last_block, blocks.prev_finish_block);
  const last_rate = last_rate_ + curr_rate_ * (last_block - blocks.prev_start_block);
  const sw_depo = Math.floor(deposit * PERCENT_FACTOR / last_rate);
  const curr_rate = Math.floor(curr_rate_ * assetQty / (assetQty + sw_depo));
  return {
    last_rate: last_rate,
    current_rate: curr_rate,
    sw_deposit: sw_depo
  };
};
 
export const withdrawRates = (
  last_rate_: number,
  curr_rate_: number,
  withdraw_: number,
  blocks: {
    prev_start_block: number,
    prev_finish_block: number,
    last_block: number
  },
  assetQty: number
) => {
  const last_block = Math.min(blocks.last_block, blocks.prev_finish_block);
  const last_rate = last_rate_ + curr_rate_ * (last_block - blocks.prev_start_block);
  const withdraw = Math.floor(withdraw_ * last_rate / PERCENT_FACTOR);
  const curr_rate = Math.floor(curr_rate_ * assetQty / (assetQty - withdraw_));
  return {
    last_rate: last_rate,
    current_rate: curr_rate,
    withdraw: withdraw
  };
};
