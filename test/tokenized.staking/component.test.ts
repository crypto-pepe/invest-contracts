import {
  Asset,
  getAccountByName,
  getAssetBalance,
  getBalance,
  getBlockHeight,
  getContractByName,
  getDataValue,
  invoke,
  transfer
} from '@pepe-team/waves-sc-test-utils';
import {
  step,
  stepIgnoreErrorByMessage
} from 'relax-steps-allure';
import {
  getAssetInfo,
  setInt,
  setSignedContext,
  setTCClaim,
  signedTransfer
} from '../../steps/common';
import {
  getRate,
  checkpoint,
  deposit,
  stake,
  withdraw,
  setSponsorshipManager,
  updateSponsorship
} from '../../steps/tokenized.staking';
import { getEnvironment } from 'relax-env-json';
import { expect } from 'chai';
import {
  commitStakingRates,
  continuousStakingRates,
  depositRates,
  newStakingRates,
  withdrawRates
} from '../../steps/waves.staking.math';
import { base58Encode } from '@waves/ts-lib-crypto';
const env = getEnvironment();

// TODO: CHECK fee payments with sWAVES in e2e
describe('tokenized staking', function() {
  describe('getRate tests', function() {
    it('check rate with nulled CURRENT_RATE', async () => {
      const contract = getContractByName('tokenized_staking', this.parent?.ctx);
      const techContract = getContractByName('technical', this.parent?.ctx);
      const techUser = getAccountByName('tech_acc', this.parent?.ctx);
      const lastRate = 1366000000000;
      const currRate = 0;
      await step('set state', async () => {
        await setInt(techContract, techUser, lastRate);
        const lastRate_ = String(await getDataValue(techContract, 'BINARY_INT', env.network));
        await setInt(techContract, techUser, currRate);
        const currRate_ = String(await getDataValue(techContract, 'BINARY_INT', env.network));
        await setSignedContext(
          contract,
          {
            data: [
              { key: 'LAST_RATE', type: 'binary', value: lastRate_ },
              { key: 'CURRENT_RATE', type: 'binary', value: currRate_ }
            ]
          }
        );
      });
      let result: number;
      await step('evaluate getRate', async () => {
        result = await getRate(contract.dApp);
      });
      await step('check calculates', async () => {
        expect(result).to.be.equal(lastRate);
      });
    });

    it('check rate with CURRENT_RATE', async () => {
      const contract = getContractByName('tokenized_staking', this.parent?.ctx);
      const techContract = getContractByName('technical', this.parent?.ctx);
      const techUser = getAccountByName('tech_acc', this.parent?.ctx);
      const lastRate = 1366000000000;
      const currRate = 123456789012;
      const delta = 13;
      await step('set state', async () => {
        await setInt(techContract, techUser, lastRate);
        const lastRate_ = String(await getDataValue(techContract, 'BINARY_INT', env.network));
        await setInt(techContract, techUser, currRate);
        const currRate_ = String(await getDataValue(techContract, 'BINARY_INT', env.network));
        const currHeight = await getBlockHeight(0, env.network);
        await setSignedContext(
          contract,
          {
            data: [
              { key: 'LAST_RATE', type: 'binary', value: lastRate_ },
              { key: 'CURRENT_RATE', type: 'binary', value: currRate_ },
              { key: 'LAST_HEIGHT', type: 'integer', value: currHeight - delta - 1 },
              { key: 'TARGET_HEIGHT', type: 'integer', value: currHeight - 1 }
            ]
          }
        );
      });
      let result: number;
      await step('evaluate getRate', async () => {
        result = await getRate(contract.dApp);
      });
      await step('check calculates', async () => {
        expect(result).to.be.equal(lastRate + currRate * delta);
      });
    });

    it('check rate with nulled interval', async () => {
      const contract = getContractByName('tokenized_staking', this.parent?.ctx);
      const techContract = getContractByName('technical', this.parent?.ctx);
      const techUser = getAccountByName('tech_acc', this.parent?.ctx);
      const lastRate = 1366000000000;
      const currRate = 123456789012;
      await step('set state', async () => {
        await setInt(techContract, techUser, lastRate);
        const lastRate_ = String(await getDataValue(techContract, 'BINARY_INT', env.network));
        await setInt(techContract, techUser, currRate);
        const currRate_ = String(await getDataValue(techContract, 'BINARY_INT', env.network));
        const currHeight = await getBlockHeight(0, env.network);
        await setSignedContext(
          contract,
          {
            data: [
              { key: 'LAST_RATE', type: 'binary', value: lastRate_ },
              { key: 'CURRENT_RATE', type: 'binary', value: currRate_ },
              { key: 'LAST_HEIGHT', type: 'integer', value: currHeight },
              { key: 'TARGET_HEIGHT', type: 'integer', value: currHeight + 1440 }
            ]
          }
        );
      });
      let result: number;
      await step('evaluate getRate', async () => {
        result = await getRate(contract.dApp);
      });
      await step('check calculates', async () => {
        expect(result).to.be.equal(lastRate);
      });
    });
  });

  describe('checkpoint tests', function() {
    it('invoke checkpoint with reward', async () => {
      const contract = getContractByName('tokenized_staking', this.parent?.ctx);
      const techContract = getContractByName('technical', this.parent?.ctx);
      const techUser = getAccountByName('tech_acc', this.parent?.ctx);
      const user = getAccountByName('neo', this.parent?.ctx);
      const admin = getAccountByName('manager', this.parent?.ctx);
      const lastRate = 1366000000000;
      const currRate = 123456789012;
      const clear_reward = 1366000000;
      const compensation = env.network.invokeFee;
      const adminFee = 270000000;
      await step('set rates', async () => {
        await setInt(techContract, techUser, lastRate);
        const lastRate_ = String(await getDataValue(techContract, 'BINARY_INT', env.network));
        await setInt(techContract, techUser, currRate);
        const currRate_ = String(await getDataValue(techContract, 'BINARY_INT', env.network));
        await setSignedContext(
          contract,
          {
            data: [
              { key: 'LAST_RATE', type: 'binary', value: lastRate_ },
              { key: 'CURRENT_RATE', type: 'binary', value: currRate_ },
              { key: 'LAST_HEIGHT', type: 'integer', value: 1 },
              { key: 'TARGET_HEIGHT', type: 'integer', value: 1 }
            ]
          }
        );
      });
      await step('set adapter mock', async () => {
        await setTCClaim(
          techContract,
          true,
          clear_reward,
          compensation,
          adminFee,
          base58Encode(admin.address)
        );
      });
      const startUserBalance = await getBalance(user.address, env.network);
      const startAdminBalance = await getBalance(admin.address, env.network);
      const startMockBalance = await getBalance(techContract.dApp, env.network);
      const startTSBalance = await getBalance(contract.dApp, env.network);
      const assetData = await getAssetInfo(String(await getDataValue(contract, 'ASSET', env.network)));
      const assetDataQty = parseInt(assetData.quantity.toString());
      await step('invoke checkpoint', async () => {
        await checkpoint(user.privateKey, contract);
      });
      const rates = commitStakingRates(
        lastRate,
        currRate,
        0,
        clear_reward,
        1440,
        assetDataQty
      );
      await step('check balances', async () => {
        expect(
          await getBalance(user.address, env.network)
        ).to.be.equal(startUserBalance);
        expect(
          await getBalance(admin.address, env.network)
        ).to.be.equal(startAdminBalance + adminFee);
        expect(
          await getBalance(contract.dApp, env.network)
        ).to.be.equal(startTSBalance);
        expect(
          await getBalance(techContract.dApp, env.network)
        ).to.be.equal(startMockBalance - compensation - adminFee);
      });
      await step('check state', async () => {
        await setInt(techContract, techUser, rates.last_rate);
        expect(
          await getDataValue(contract, 'LAST_RATE', env.network)
        ).to.be.equal(
          await getDataValue(techContract, 'BINARY_INT', env.network)
        );
        await setInt(techContract, techUser, rates.current_rate);
        expect(
          await getDataValue(contract, 'CURRENT_RATE', env.network)
        ).to.be.equal(
          await getDataValue(techContract, 'BINARY_INT', env.network)
        );
      });
    });

    it('should throw when no reward', async () => {
      const contract = getContractByName('tokenized_staking', this.parent?.ctx);
      const techContract = getContractByName('technical', this.parent?.ctx);
      const user = getAccountByName('neo', this.parent?.ctx);
      const admin = getAccountByName('manager', this.parent?.ctx);
      const clear_reward = 0;
      const compensation = env.network.invokeFee;
      const adminFee = 270000000;
      await step('set adapter mock', async () => {
        await setTCClaim(
          techContract,
          true,
          clear_reward,
          compensation,
          adminFee,
          base58Encode(admin.address)
        );
      });
      const startUserBalance = await getBalance(user.address, env.network);
      const startAdminBalance = await getBalance(admin.address, env.network);
      const startMockBalance = await getBalance(techContract.dApp, env.network);
      const startTSBalance = await getBalance(contract.dApp, env.network);
      await stepIgnoreErrorByMessage(
        'try to invoke checkpoint',
        'Error while executing dApp: checkpoint: no reward',
        async () => {
          await checkpoint(user.privateKey, contract);
        }
      );
      await step('check balances', async () => {
        expect(
          await getBalance(user.address, env.network)
        ).to.be.equal(startUserBalance);
        expect(
          await getBalance(admin.address, env.network)
        ).to.be.equal(startAdminBalance);
        expect(
          await getBalance(contract.dApp, env.network)
        ).to.be.equal(startTSBalance);
        expect(
          await getBalance(techContract.dApp, env.network)
        ).to.be.equal(startMockBalance);
      });
    });

    it('should nothing when compensation = 0', async () => {
      const contract = getContractByName('tokenized_staking', this.parent?.ctx);
      const techContract = getContractByName('technical', this.parent?.ctx);
      const techUser = getAccountByName('tech_acc', this.parent?.ctx);
      const user = getAccountByName('neo', this.parent?.ctx);
      const admin = getAccountByName('manager', this.parent?.ctx);
      const lastRate = 1366000000000;
      const currRate = 123456789012;
      const clear_reward = 1366000000;
      const compensation = 0;
      const adminFee = 270000000;
      await step('set rates', async () => {
        await setInt(techContract, techUser, lastRate);
        const lastRate_ = String(await getDataValue(techContract, 'BINARY_INT', env.network));
        await setInt(techContract, techUser, currRate);
        const currRate_ = String(await getDataValue(techContract, 'BINARY_INT', env.network));
        await setSignedContext(
          contract,
          {
            data: [
              { key: 'LAST_RATE', type: 'binary', value: lastRate_ },
              { key: 'CURRENT_RATE', type: 'binary', value: currRate_ },
              { key: 'LAST_HEIGHT', type: 'integer', value: 1 },
              { key: 'TARGET_HEIGHT', type: 'integer', value: 1 }
            ]
          }
        );
      });
      await step('set adapter mock', async () => {
        await setTCClaim(
          techContract,
          true,
          clear_reward,
          compensation,
          adminFee,
          base58Encode(admin.address)
        );
      });
      const startUserBalance = await getBalance(user.address, env.network);
      const startAdminBalance = await getBalance(admin.address, env.network);
      const startMockBalance = await getBalance(techContract.dApp, env.network);
      const startTSBalance = await getBalance(contract.dApp, env.network);
      const assetData = await getAssetInfo(String(await getDataValue(contract, 'ASSET', env.network)));
      const assetDataQty = parseInt(assetData.quantity.toString());
      await step('invoke checkpoint', async () => {
        await checkpoint(user.privateKey, contract);
      });
      const rates = commitStakingRates(
        lastRate,
        currRate,
        0,
        clear_reward,
        1440,
        assetDataQty
      );
      await step('check balances', async () => {
        expect(
          await getBalance(user.address, env.network)
        ).to.be.equal(startUserBalance - env.network.invokeFee);
        expect(
          await getBalance(admin.address, env.network)
        ).to.be.equal(startAdminBalance + adminFee);
        expect(
          await getBalance(contract.dApp, env.network)
        ).to.be.equal(startTSBalance);
        expect(
          await getBalance(techContract.dApp, env.network)
        ).to.be.equal(startMockBalance - adminFee);
      });
      await step('check state', async () => {
        await setInt(techContract, techUser, rates.last_rate);
        expect(
          await getDataValue(contract, 'LAST_RATE', env.network)
        ).to.be.equal(
          await getDataValue(techContract, 'BINARY_INT', env.network)
        );
        await setInt(techContract, techUser, rates.current_rate);
        expect(
          await getDataValue(contract, 'CURRENT_RATE', env.network)
        ).to.be.equal(
          await getDataValue(techContract, 'BINARY_INT', env.network)
        );
      });
    });

    it('should throw when wrong lease node address', async () => {
      const contract = getContractByName('tokenized_staking', this.parent?.ctx);
      const techContract = getContractByName('technical', this.parent?.ctx);
      const user = getAccountByName('neo', this.parent?.ctx);
      const admin = getAccountByName('manager', this.parent?.ctx);
      const clear_reward = 0;
      const compensation = env.network.invokeFee;
      const adminFee = 270000000;
      await step('set wrong adapter address', async () => {
        await setSignedContext(
          contract,
          {
            data: [
              { key: 'STAKING_ADAPTER', type: 'string', value: 'ololo' }
            ]
          }
        );
      });
      await step('set adapter mock', async () => {
        await setTCClaim(
          techContract,
          true,
          clear_reward,
          compensation,
          adminFee,
          base58Encode(admin.address)
        );
      });
      await stepIgnoreErrorByMessage(
        'try to invoke checkpoint',
        'Error while executing dApp: value() called on unit value on function \'addressFromString\' call',
        async () => {
          await checkpoint(user.privateKey, contract);
        }
      );
      await step('revert tokenized staking contract settings', async () => {
        await setSignedContext(
          contract,
          {
            data: [
              { key: 'STAKING_ADAPTER', type: 'string', value: techContract.dApp }
            ]
          }
        );
      });
    });
  });

  describe('deposit tests', function() {
    it('simple positive (without reward staking)', async () => {
      const contract = getContractByName('tokenized_staking', this.parent?.ctx);
      const techContract = getContractByName('technical', this.parent?.ctx);
      const techUser = getAccountByName('tech_acc', this.parent?.ctx);
      const user = getAccountByName('morpheus', this.parent?.ctx);
      const admin = getAccountByName('manager', this.parent?.ctx);
      const lastRate = 1366000000000;
      const currRate = 123456789012;
      const clear_reward = 0;
      const compensation = env.network.invokeFee;
      const adminFee = 270000000;
      const depoAmt = 6613000000;
      const delta = 13;
      const sWaves: Asset = {
        name: 'sWaves',
        description: '',
        quantity: 1,
        decimals: 8,
        assetId: String(await getDataValue(contract, 'ASSET', env.network))
      };
      await step('reset claim reward', async () => {
        await setTCClaim(
          techContract,
          true,
          clear_reward,
          compensation,
          adminFee,
          base58Encode(admin.address)
        );
      });
      await step('set rates and heights', async () => {
        await setInt(techContract, techUser, lastRate);
        const lastRate_ = String(await getDataValue(techContract, 'BINARY_INT', env.network));
        await setInt(techContract, techUser, currRate);
        const currRate_ = String(await getDataValue(techContract, 'BINARY_INT', env.network));
        await setSignedContext(
          contract,
          {
            data: [
              { key: 'LAST_RATE', type: 'binary', value: lastRate_ },
              { key: 'CURRENT_RATE', type: 'binary', value: currRate_ },
              { key: 'LAST_HEIGHT', type: 'integer', value: 1 },
              { key: 'TARGET_HEIGHT', type: 'integer', value: 1 + delta }
            ]
          }
        );
      });
      const startUserBalance = await getBalance(user.address, env.network);
      const startUserSWBalance = await getAssetBalance(sWaves, user, env.network);
      const startAdminBalance = await getBalance(admin.address, env.network);
      const startMockBalance = await getBalance(techContract.dApp, env.network);
      const startTSBalance = await getBalance(contract.dApp, env.network);
      const assetData = await getAssetInfo(sWaves.assetId);
      const assetDataQty = parseInt(assetData.quantity.toString());
      await step('invoke deposit', async () => {
        await deposit(depoAmt, user.privateKey);
      });
      const rates = depositRates(
        lastRate,
        currRate,
        depoAmt,
        {
          prev_start_block: 1,
          prev_finish_block: 1 + delta,
          last_block: 2 + delta
        },
        assetDataQty
      );
      await step('check balances', async () => {
        expect(
          await getBalance(user.address, env.network)
        ).to.be.equal(startUserBalance - depoAmt - env.network.invokeFee);
        expect(
          await getAssetBalance(sWaves, user, env.network)
        ).to.be.equal(startUserSWBalance + rates.sw_deposit);
        expect(
          await getBalance(admin.address, env.network)
        ).to.be.equal(startAdminBalance);
        expect(
          await getBalance(contract.dApp, env.network)
        ).to.be.equal(startTSBalance);
        expect(
          await getBalance(techContract.dApp, env.network)
        ).to.be.equal(startMockBalance + depoAmt);
      });
      await step('check state', async () => {
        await setInt(techContract, techUser, rates.last_rate);
        expect(
          await getDataValue(contract, 'LAST_RATE', env.network)
        ).to.be.equal(
          await getDataValue(techContract, 'BINARY_INT', env.network)
        );
        await setInt(techContract, techUser, rates.current_rate);
        expect(
          await getDataValue(contract, 'CURRENT_RATE', env.network)
        ).to.be.equal(
          await getDataValue(techContract, 'BINARY_INT', env.network)
        );
        expect(
          await getDataValue(contract, 'TARGET_HEIGHT', env.network)
        ).to.be.equal(
          await getDataValue(contract, 'LAST_HEIGHT', env.network)
        );
      });
    });

    it('deposit with reward staking', async () => {
      const contract = getContractByName('tokenized_staking', this.parent?.ctx);
      const techContract = getContractByName('technical', this.parent?.ctx);
      const techUser = getAccountByName('tech_acc', this.parent?.ctx);
      const user = getAccountByName('morpheus', this.parent?.ctx);
      const admin = getAccountByName('manager', this.parent?.ctx);
      const lastRate = 1366000000000;
      const currRate = 123456789012;
      const clear_reward = 1366000000;
      const compensation = env.network.invokeFee;
      const adminFee = 270000000;
      const depoAmt = 6613000000;
      const sWaves: Asset = {
        name: 'sWaves',
        description: '',
        quantity: 1,
        decimals: 8,
        assetId: String(await getDataValue(contract, 'ASSET', env.network))
      };
      await step('reset claim reward', async () => {
        await setTCClaim(
          techContract,
          true,
          clear_reward,
          compensation,
          adminFee,
          base58Encode(admin.address)
        );
      });
      await step('set rates and heights', async () => {
        await setInt(techContract, techUser, lastRate);
        const lastRate_ = String(await getDataValue(techContract, 'BINARY_INT', env.network));
        await setInt(techContract, techUser, currRate);
        const currRate_ = String(await getDataValue(techContract, 'BINARY_INT', env.network));
        await setSignedContext(
          contract,
          {
            data: [
              { key: 'LAST_RATE', type: 'binary', value: lastRate_ },
              { key: 'CURRENT_RATE', type: 'binary', value: currRate_ },
              { key: 'LAST_HEIGHT', type: 'integer', value: 1 },
              { key: 'TARGET_HEIGHT', type: 'integer', value: 1 }
            ]
          }
        );
      });
      const startUserBalance = await getBalance(user.address, env.network);
      const startUserSWBalance = await getAssetBalance(sWaves, user, env.network);
      const startAdminBalance = await getBalance(admin.address, env.network);
      const startMockBalance = await getBalance(techContract.dApp, env.network);
      const startTSBalance = await getBalance(contract.dApp, env.network);
      const assetData = await getAssetInfo(sWaves.assetId);
      const assetDataQty = parseInt(assetData.quantity.toString());
      await step('invoke deposit', async () => {
        await deposit(depoAmt, user.privateKey);
      });
      const firstStakeRates = commitStakingRates(
        lastRate,
        currRate,
        0,
        clear_reward + compensation,
        1440,
        assetDataQty
      );
      const currHeight = Number(await getDataValue(contract, 'LAST_HEIGHT', env.network));
      const targetHeight = Number(await getDataValue(contract, 'TARGET_HEIGHT', env.network));
      const lastHeight = targetHeight - 1440;
      const rates = depositRates(
        firstStakeRates.last_rate,
        firstStakeRates.current_rate,
        depoAmt,
        {
          prev_start_block: lastHeight,
          prev_finish_block: targetHeight,
          last_block: currHeight
        },
        assetDataQty
      );
      await step('check balances', async () => {
        expect(
          await getBalance(user.address, env.network)
        ).to.be.equal(startUserBalance - depoAmt - env.network.invokeFee);
        expect(
          await getAssetBalance(sWaves, user, env.network)
        ).to.be.equal(startUserSWBalance + rates.sw_deposit);
        expect(
          await getBalance(admin.address, env.network)
        ).to.be.equal(startAdminBalance + adminFee);
        expect(
          await getBalance(contract.dApp, env.network)
        ).to.be.equal(startTSBalance);
        expect(
          await getBalance(techContract.dApp, env.network)
        ).to.be.equal(startMockBalance + depoAmt - adminFee);
      });
      await step('check state', async () => {
        await setInt(techContract, techUser, rates.last_rate);
        expect(
          await getDataValue(contract, 'LAST_RATE', env.network)
        ).to.be.equal(
          await getDataValue(techContract, 'BINARY_INT', env.network)
        );
        await setInt(techContract, techUser, rates.current_rate);
        expect(
          await getDataValue(contract, 'CURRENT_RATE', env.network)
        ).to.be.equal(
          await getDataValue(techContract, 'BINARY_INT', env.network)
        );
        expect(
          Number(await getDataValue(contract, 'TARGET_HEIGHT', env.network))
        ).to.be.equal(
          Number(await getDataValue(contract, 'LAST_HEIGHT', env.network)) + 1440
        );
      });
    });

    it('should throw when no payments', async () => {
      const contract = getContractByName('tokenized_staking', this.parent?.ctx);
      const user = getAccountByName('morpheus', this.parent?.ctx);
      await stepIgnoreErrorByMessage(
        'try to invoke deposit',
        'Error while executing dApp: deposit: no payments',
        async () => {
          await invoke(
            {
              dApp: contract.dApp,
              call: { 
                function: 'deposit'
              },
            },
            user.privateKey,
            env.network
          );
        }
      );
    });

    it('should throw when token is not WAVES', async () => {
      const contract = getContractByName('tokenized_staking', this.parent?.ctx);
      const user = getAccountByName('morpheus', this.parent?.ctx);
      const depoAmt = 1366000000;
      const sDepoAmt = 100000000;
      await step('get sWaves through deposit', async () => {
        await deposit(depoAmt, user.privateKey);
      });
      await stepIgnoreErrorByMessage(
        'try to invoke deposit',
        'Error while executing dApp: deposit: payment is not in base asset',
        async () => {
          await deposit(sDepoAmt, user.privateKey, String(await getDataValue(contract, 'ASSET', env.network)));
        }
      );
    });

    it('should throw when amount = 0', async () => {
      const user = getAccountByName('morpheus', this.parent?.ctx);
      await stepIgnoreErrorByMessage(
        'try to invoke deposit',
        // MEMO: why need check amount?
        // 'Error while executing dApp: deposit: invalid payment amount',
        'non-positive amount: 0 of Waves',
        async () => {
          await deposit(0, user.privateKey);
        }
      );
    });
  });

  describe('stake tests', function() {
    it('should throw when not self-invoke', async () => {
      const contract = getContractByName('tokenized_staking', this.parent?.ctx);
      const user = getAccountByName('trinity', this.parent?.ctx);
      await stepIgnoreErrorByMessage(
        'try to invoke with other user',
        'Error while executing dApp: stake: only this contract',
        async () => {
          await invoke(
            {
              dApp: contract.dApp,
              call: { 
                function: 'stake',
                args: [
                  { type: 'integer', value: 1366000000 },
                  { type: 'integer', value: 1440 }
                ]
              }
            },
            user.privateKey,
            env.network
          );
        }
      );
    });

    it('should throw when amount <= 0', async () => {
      const stakeAmt = 0;
      const claimHeight = 1440;
      await stepIgnoreErrorByMessage(
        'try to invoke stake',
        'Error while executing dApp: stake: invalid stake amount',
        async () => {
          await stake(stakeAmt, claimHeight);
        }
      );
    });

    it('should throw when have no balance on contract', async () => {
      const techContract = getContractByName('technical', this.parent?.ctx);
      const techUser = getAccountByName('tech_acc', this.parent?.ctx);
      const stakeAmt = 1366000000;
      const claimHeight = 1440;
      const startTechBalance = await getBalance(techContract.dApp, env.network);
      await step('reset balance on tokenized contract', async () => {
        await signedTransfer(
          {
            address: techContract.dApp,
            publicKey: techContract.publicKey,
            privateKey: techContract.privateKey
          },
          techUser.address,
          startTechBalance - stakeAmt
        );
      });
      await stepIgnoreErrorByMessage(
        'try to invoke stake',
        'Error while executing dApp: stake: insufficient stake amount',
        async () => {
          await stake(stakeAmt, claimHeight);
        }
      );
      await step('return balance ats tokenized contract', async () => {
        await transfer(
          {
            recipient: techContract.dApp,
            amount: startTechBalance - stakeAmt
          },
          techUser.privateKey,
          env.network
        );
      });
    });

    it('should throw when have no deposits (and sWAVESes)', async () => {
      const contract = getContractByName('tokenized_staking', this.parent?.ctx);
      const techContract = getContractByName('technical', this.parent?.ctx);
      const techUser = getAccountByName('tech_acc', this.parent?.ctx);
      const trueAsset = String(await getDataValue(contract, 'ASSET', env.network));
      const stakeAmt = 1366000000;
      const claimHeight = 1440;
      await step('create test asset and set it for tokenized contract', async () => {
        await invoke(
          {
            dApp: techContract.dApp,
            call: { 
              function: 'setTestAsset',
              args: [
                { type: 'string', value: 'testWaves' },
                { type: 'string', value: 'new test token' }
              ]
            },
            fee: 100500000
          },
          techUser.privateKey,
          env.network
        );
        const testAsset = String(await getDataValue(techContract, 'ASSET', env.network));
        await setSignedContext(
          contract,
          {
            data: [
              { key: 'ASSET', type: 'string', value: testAsset }
            ]
          }
        );
      });
      await stepIgnoreErrorByMessage(
        'try to invoke stake',
        'Error while executing dApp: stake: no deposits to stake for',
        async () => {
          await stake(stakeAmt, claimHeight);
        }
      );
      await step('revert asset settings', async () => {
        await setSignedContext(
          contract,
          {
            data: [
              { key: 'ASSET', type: 'string', value: trueAsset }
            ]
          }
        );
      });
    });

    it('new staking', async () => {
      const contract = getContractByName('tokenized_staking', this.parent?.ctx);
      const techContract = getContractByName('technical', this.parent?.ctx);
      const techUser = getAccountByName('tech_acc', this.parent?.ctx);
      const lastRate = 1000000000000;
      const currRate = 0;
      const stakeAmt = 1345678901;
      await step('reset rates and heights', async () => {
        await setInt(techContract, techUser, lastRate);
        const lastRate_ = String(await getDataValue(techContract, 'BINARY_INT', env.network));
        await setInt(techContract, techUser, currRate);
        const currRate_ = String(await getDataValue(techContract, 'BINARY_INT', env.network));
        await setSignedContext(
          contract,
          {
            data: [
              { key: 'LAST_RATE', type: 'binary', value: lastRate_ },
              { key: 'CURRENT_RATE', type: 'binary', value: currRate_ },
              { key: 'LAST_HEIGHT', type: 'integer', value: 0 },
              { key: 'TARGET_HEIGHT', type: 'integer', value: 0 }
            ]
          }
        );
      });
      const assetData = await getAssetInfo(String(await getDataValue(contract, 'ASSET', env.network)));
      const assetDataQty = parseInt(assetData.quantity.toString());
      const startMockBalance = await getBalance(techContract.dApp, env.network);
      const startTSBalance = await getBalance(contract.dApp, env.network);
      await step('invoke stake', async () => {
        await stake(stakeAmt, 1440);
      });
      const rates = newStakingRates(lastRate, stakeAmt, 1440, assetDataQty);
      await step('check balances', async () => {
        expect(
          await getBalance(contract.dApp, env.network)
        ).to.be.equal(startTSBalance - stakeAmt - env.network.invokeFee);
        // WHY??? balance added invoke fee???
        expect(
          await getBalance(techContract.dApp, env.network)
        ).to.be.equal(startMockBalance + stakeAmt);
      });
      await step('check state', async () => {
        await setInt(techContract, techUser, rates.last_rate);
        expect(
          await getDataValue(contract, 'LAST_RATE', env.network)
        ).to.be.equal(
          await getDataValue(techContract, 'BINARY_INT', env.network)
        );
        await setInt(techContract, techUser, rates.current_rate);
        expect(
          await getDataValue(contract, 'CURRENT_RATE', env.network)
        ).to.be.equal(
          await getDataValue(techContract, 'BINARY_INT', env.network)
        );
      });
    });

    it('stake with uncommitted old reward (current rate > 0)', async () => {
      const contract = getContractByName('tokenized_staking', this.parent?.ctx);
      const techContract = getContractByName('technical', this.parent?.ctx);
      const techUser = getAccountByName('tech_acc', this.parent?.ctx);
      const lastRate = 1366000000000;
      const currRate = 98765432109;
      const stakeAmt = 1345678901;
      const delta = 15;
      await step('reset rates and heights', async () => {
        await setInt(techContract, techUser, lastRate);
        const lastRate_ = String(await getDataValue(techContract, 'BINARY_INT', env.network));
        await setInt(techContract, techUser, currRate);
        const currRate_ = String(await getDataValue(techContract, 'BINARY_INT', env.network));
        const currHeight = await getBlockHeight(0, env.network);
        await setSignedContext(
          contract,
          {
            data: [
              { key: 'LAST_RATE', type: 'binary', value: lastRate_ },
              { key: 'CURRENT_RATE', type: 'binary', value: currRate_ },
              { key: 'LAST_HEIGHT', type: 'integer', value: currHeight - 3 - delta },
              { key: 'TARGET_HEIGHT', type: 'integer', value: currHeight - 3 }
            ]
          }
        );
      });
      const assetData = await getAssetInfo(String(await getDataValue(contract, 'ASSET', env.network)));
      const assetDataQty = parseInt(assetData.quantity.toString());
      const startMockBalance = await getBalance(techContract.dApp, env.network);
      const startTSBalance = await getBalance(contract.dApp, env.network);
      await step('invoke stake', async () => {
        await stake(stakeAmt, 1440);
      });
      const rates = commitStakingRates(
        lastRate,
        currRate,
        delta,
        stakeAmt,
        1440,
        assetDataQty
      );
      await step('check balances', async () => {
        expect(
          await getBalance(contract.dApp, env.network)
        ).to.be.equal(startTSBalance - stakeAmt - env.network.invokeFee);
        // WHY??? balance added invoke fee???
        expect(
          await getBalance(techContract.dApp, env.network)
        ).to.be.equal(startMockBalance + stakeAmt);
      });
      await step('check state', async () => {
        await setInt(techContract, techUser, rates.last_rate);
        expect(
          await getDataValue(contract, 'LAST_RATE', env.network)
        ).to.be.equal(
          await getDataValue(techContract, 'BINARY_INT', env.network)
        );
        await setInt(techContract, techUser, rates.current_rate);
        expect(
          await getDataValue(contract, 'CURRENT_RATE', env.network)
        ).to.be.equal(
          await getDataValue(techContract, 'BINARY_INT', env.network)
        );
      });
    });

    it('stake in reward period', async () => {
      const contract = getContractByName('tokenized_staking', this.parent?.ctx);
      const techContract = getContractByName('technical', this.parent?.ctx);
      const techUser = getAccountByName('tech_acc', this.parent?.ctx);
      const lastRate = 1366000000000;
      const currRate = 98765432109;
      const stakeAmt = 1345678901;
      const delta = 7;
      const currHeight = await getBlockHeight(0, env.network);
      await step('reset rates and heights', async () => {
        await setInt(techContract, techUser, lastRate);
        const lastRate_ = String(await getDataValue(techContract, 'BINARY_INT', env.network));
        await setInt(techContract, techUser, currRate);
        const currRate_ = String(await getDataValue(techContract, 'BINARY_INT', env.network));
        await setSignedContext(
          contract,
          {
            data: [
              { key: 'LAST_RATE', type: 'binary', value: lastRate_ },
              { key: 'CURRENT_RATE', type: 'binary', value: currRate_ },
              { key: 'LAST_HEIGHT', type: 'integer', value: currHeight - delta },
              { key: 'TARGET_HEIGHT', type: 'integer', value: currHeight + delta }
            ]
          }
        );
      });
      const assetData = await getAssetInfo(String(await getDataValue(contract, 'ASSET', env.network)));
      const assetDataQty = parseInt(assetData.quantity.toString());
      const startMockBalance = await getBalance(techContract.dApp, env.network);
      const startTSBalance = await getBalance(contract.dApp, env.network);
      await step('invoke stake', async () => {
        await stake(stakeAmt, 1440);
      });
      const rates = continuousStakingRates(
        lastRate,
        currRate,
        {
          prev_start_block: currHeight - delta,
          prev_finish_block: currHeight + delta,
          last_block: Number(await getDataValue(contract, 'LAST_HEIGHT', env.network))
        },
        stakeAmt,
        1440,
        assetDataQty
      );
      await step('check balances', async () => {
        expect(
          await getBalance(contract.dApp, env.network)
        ).to.be.equal(startTSBalance - stakeAmt - env.network.invokeFee);
        // WHY??? balance added invoke fee???
        expect(
          await getBalance(techContract.dApp, env.network)
        ).to.be.equal(startMockBalance + stakeAmt);
      });
      await step('check state', async () => {
        await setInt(techContract, techUser, rates.last_rate);
        expect(
          await getDataValue(contract, 'LAST_RATE', env.network)
        ).to.be.equal(
          await getDataValue(techContract, 'BINARY_INT', env.network)
        );
        await setInt(techContract, techUser, rates.current_rate);
        expect(
          await getDataValue(contract, 'CURRENT_RATE', env.network)
        ).to.be.equal(
          await getDataValue(techContract, 'BINARY_INT', env.network)
        );
      });
    });
  });

  describe('withdraw tests', function() {
    it('should throw when no payments', async () => {
      const contract = getContractByName('tokenized_staking', this.parent?.ctx);
      const user = getAccountByName('jack', this.parent?.ctx);
      await stepIgnoreErrorByMessage(
        'try to invoke withdraw',
        'Error while executing dApp: withdraw: no payments',
        async () => {
          await invoke(
            {
              dApp: contract.dApp,
              call: { 
                function: 'withdraw'
              },
            },
            user.privateKey,
            env.network
          );
        }
      );
    });

    it('should throw when wrong asset', async () => {
      const user = getAccountByName('jack', this.parent?.ctx);
      const depoAmt = 1366000000;
      await stepIgnoreErrorByMessage(
        'try to invoke withdraw',
        'Error while executing dApp: withdraw: payment is not in correct asset',
        async () => {
          await withdraw(depoAmt, null, user.privateKey);
        }
      );
    });

    it('should throw when amount <= 0', async () => {
      const contract = getContractByName('tokenized_staking', this.parent?.ctx);
      const user = getAccountByName('jack', this.parent?.ctx);
      const assetId = String(await getDataValue(contract, 'ASSET', env.network));
      await stepIgnoreErrorByMessage(
        'try to invoke withdraw',
        // MEMO: why need check amount?
        // 'Error while executing dApp: deposit: invalid payment amount',
        `non-positive amount: 0 of ${assetId}`,
        async () => {
          await withdraw(0, assetId, user.privateKey);
        }
      );
    });

    it('simple positive (without claim reward)', async () => {
      const contract = getContractByName('tokenized_staking', this.parent?.ctx);
      const techContract = getContractByName('technical', this.parent?.ctx);
      const techUser = getAccountByName('tech_acc', this.parent?.ctx);
      const user = getAccountByName('morpheus', this.parent?.ctx);
      const admin = getAccountByName('manager', this.parent?.ctx);
      const lastRate = 1366000000000;
      const currRate = 123456789012;
      const clear_reward = 0;
      const compensation = env.network.invokeFee;
      const adminFee = 270000000;
      const depoAmt = 6613000000;
      const sWaves: Asset = {
        name: 'sWaves',
        description: '',
        quantity: 1,
        decimals: 8,
        assetId: String(await getDataValue(contract, 'ASSET', env.network))
      };
      await step('reset claim reward', async () => {
        await setTCClaim(
          techContract,
          true,
          clear_reward,
          compensation,
          adminFee,
          base58Encode(admin.address)
        );
      });
      const startUserSWBalance = await getAssetBalance(sWaves, user, env.network);
      await step('deposit WAVESes', async () => {
        await deposit(depoAmt, user.privateKey);
      });
      await step('set rates and heights', async () => {
        await setInt(techContract, techUser, lastRate);
        const lastRate_ = String(await getDataValue(techContract, 'BINARY_INT', env.network));
        await setInt(techContract, techUser, currRate);
        const currRate_ = String(await getDataValue(techContract, 'BINARY_INT', env.network));
        await setSignedContext(
          contract,
          {
            data: [
              { key: 'LAST_RATE', type: 'binary', value: lastRate_ },
              { key: 'CURRENT_RATE', type: 'binary', value: currRate_ },
              { key: 'LAST_HEIGHT', type: 'integer', value: 0 },
              { key: 'TARGET_HEIGHT', type: 'integer', value: 0 }
            ]
          }
        );
      });
      const assetData = await getAssetInfo(sWaves.assetId);
      const assetDataQty = parseInt(assetData.quantity.toString());
      const withdrawAmt = await getAssetBalance(sWaves, user, env.network) - startUserSWBalance;
      const startUserBalance = await getBalance(user.address, env.network);
      const startMockBalance = await getBalance(techContract.dApp, env.network);
      const startTSBalance = await getBalance(contract.dApp, env.network);
      await step('withdraw funds', async () => {
        await withdraw(withdrawAmt, sWaves.assetId, user.privateKey);
      });
      const rates = withdrawRates(
        lastRate,
        currRate,
        withdrawAmt,
        {
          prev_start_block: 0,
          prev_finish_block: 0,
          last_block: 1
        },
        assetDataQty
      );
      await step('check balances', async () => {
        expect(
          await getBalance(user.address, env.network)
        ).to.be.equal(startUserBalance - env.network.invokeFee + rates.withdraw);
        expect(
          await getAssetBalance(sWaves, user, env.network)
        ).to.be.equal(startUserSWBalance);
        expect(
          await getBalance(contract.dApp, env.network)
        ).to.be.equal(startTSBalance);
        expect(
          await getBalance(techContract.dApp, env.network)
        ).to.be.equal(startMockBalance - rates.withdraw);
      });
      await step('check state', async () => {
        await setInt(techContract, techUser, rates.last_rate);
        expect(
          await getDataValue(contract, 'LAST_RATE', env.network)
        ).to.be.equal(
          await getDataValue(techContract, 'BINARY_INT', env.network)
        );
        await setInt(techContract, techUser, rates.current_rate);
        expect(
          await getDataValue(contract, 'CURRENT_RATE', env.network)
        ).to.be.equal(
          await getDataValue(techContract, 'BINARY_INT', env.network)
        );
        expect(
          await getDataValue(contract, 'TARGET_HEIGHT', env.network)
        ).to.be.equal(
          await getDataValue(contract, 'LAST_HEIGHT', env.network)
        );
      });
    });

    it('withdraw part of deposit', async () => {
      const contract = getContractByName('tokenized_staking', this.parent?.ctx);
      const techContract = getContractByName('technical', this.parent?.ctx);
      const techUser = getAccountByName('tech_acc', this.parent?.ctx);
      const user = getAccountByName('morpheus', this.parent?.ctx);
      const admin = getAccountByName('manager', this.parent?.ctx);
      const lastRate = 1366000000000;
      const currRate = 123456789012;
      const clear_reward = 0;
      const compensation = env.network.invokeFee;
      const adminFee = 270000000;
      const depoAmt = 6613000000;
      const coef = 0.6;
      const sWaves: Asset = {
        name: 'sWaves',
        description: '',
        quantity: 1,
        decimals: 8,
        assetId: String(await getDataValue(contract, 'ASSET', env.network))
      };
      await step('reset claim reward', async () => {
        await setTCClaim(
          techContract,
          true,
          clear_reward,
          compensation,
          adminFee,
          base58Encode(admin.address)
        );
      });
      const startUserSWBalance = await getAssetBalance(sWaves, user, env.network);
      await step('deposit WAVESes', async () => {
        await deposit(depoAmt, user.privateKey);
      });
      await step('set rates and heights', async () => {
        await setInt(techContract, techUser, lastRate);
        const lastRate_ = String(await getDataValue(techContract, 'BINARY_INT', env.network));
        await setInt(techContract, techUser, currRate);
        const currRate_ = String(await getDataValue(techContract, 'BINARY_INT', env.network));
        await setSignedContext(
          contract,
          {
            data: [
              { key: 'LAST_RATE', type: 'binary', value: lastRate_ },
              { key: 'CURRENT_RATE', type: 'binary', value: currRate_ },
              { key: 'LAST_HEIGHT', type: 'integer', value: 0 },
              { key: 'TARGET_HEIGHT', type: 'integer', value: 0 }
            ]
          }
        );
      });
      const assetData = await getAssetInfo(sWaves.assetId);
      const assetDataQty = parseInt(assetData.quantity.toString());
      const fullWithdrawAmt = await getAssetBalance(sWaves, user, env.network) - startUserSWBalance;
      const withdrawAmt = Math.floor(coef * fullWithdrawAmt);
      const startUserBalance = await getBalance(user.address, env.network);
      const startMockBalance = await getBalance(techContract.dApp, env.network);
      const startTSBalance = await getBalance(contract.dApp, env.network);
      await step('withdraw part of funds', async () => {
        await withdraw(withdrawAmt, sWaves.assetId, user.privateKey);
      });
      const rates = withdrawRates(
        lastRate,
        currRate,
        withdrawAmt,
        {
          prev_start_block: 0,
          prev_finish_block: 0,
          last_block: 1
        },
        assetDataQty
      );
      await step('check balances', async () => {
        expect(
          await getBalance(user.address, env.network)
        ).to.be.equal(startUserBalance - env.network.invokeFee + rates.withdraw);
        expect(
          await getAssetBalance(sWaves, user, env.network)
        ).to.be.equal(startUserSWBalance + fullWithdrawAmt - withdrawAmt);
        expect(
          await getBalance(contract.dApp, env.network)
        ).to.be.equal(startTSBalance);
        expect(
          await getBalance(techContract.dApp, env.network)
        ).to.be.equal(startMockBalance - rates.withdraw);
      });
      await step('check state', async () => {
        await setInt(techContract, techUser, rates.last_rate);
        expect(
          await getDataValue(contract, 'LAST_RATE', env.network)
        ).to.be.equal(
          await getDataValue(techContract, 'BINARY_INT', env.network)
        );
        await setInt(techContract, techUser, rates.current_rate);
        expect(
          await getDataValue(contract, 'CURRENT_RATE', env.network)
        ).to.be.equal(
          await getDataValue(techContract, 'BINARY_INT', env.network)
        );
        expect(
          await getDataValue(contract, 'TARGET_HEIGHT', env.network)
        ).to.be.equal(
          await getDataValue(contract, 'LAST_HEIGHT', env.network)
        );
      });
    });

    it('withdraw with claim reward', async () => {
      const contract = getContractByName('tokenized_staking', this.parent?.ctx);
      const techContract = getContractByName('technical', this.parent?.ctx);
      const techUser = getAccountByName('tech_acc', this.parent?.ctx);
      const user = getAccountByName('morpheus', this.parent?.ctx);
      const admin = getAccountByName('manager', this.parent?.ctx);
      const lastRate = 1366000000000;
      const currRate = 123456789012;
      const clear_reward = 1366000000;
      const compensation = env.network.invokeFee;
      const adminFee = 270000000;
      const depoAmt = 6613000000;
      const delta = 9;
      const sWaves: Asset = {
        name: 'sWaves',
        description: '',
        quantity: 1,
        decimals: 8,
        assetId: String(await getDataValue(contract, 'ASSET', env.network))
      };
      await step('reset claim reward', async () => {
        await setTCClaim(
          techContract,
          true,
          0,
          compensation,
          adminFee,
          base58Encode(admin.address)
        );
      });
      const startUserSWBalance = await getAssetBalance(sWaves, user, env.network);
      await step('deposit WAVESes', async () => {
        await deposit(depoAmt, user.privateKey);
      });
      await step('set claim reward', async () => {
        await setTCClaim(
          techContract,
          true,
          clear_reward,
          compensation,
          adminFee,
          base58Encode(admin.address)
        );
      });
      await step('set rates and heights', async () => {
        await setInt(techContract, techUser, lastRate);
        const lastRate_ = String(await getDataValue(techContract, 'BINARY_INT', env.network));
        await setInt(techContract, techUser, currRate);
        const currRate_ = String(await getDataValue(techContract, 'BINARY_INT', env.network));
        const currHeight = await getBlockHeight(0, env.network);
        await setSignedContext(
          contract,
          {
            data: [
              { key: 'LAST_RATE', type: 'binary', value: lastRate_ },
              { key: 'CURRENT_RATE', type: 'binary', value: currRate_ },
              { key: 'LAST_HEIGHT', type: 'integer', value: currHeight - 1 - delta },
              { key: 'TARGET_HEIGHT', type: 'integer', value: currHeight - 1 }
            ]
          }
        );
      });
      const assetData = await getAssetInfo(sWaves.assetId);
      const assetDataQty = parseInt(assetData.quantity.toString());
      const withdrawAmt = await getAssetBalance(sWaves, user, env.network) - startUserSWBalance;
      const startUserBalance = await getBalance(user.address, env.network);
      const startMockBalance = await getBalance(techContract.dApp, env.network);
      const startTSBalance = await getBalance(contract.dApp, env.network);
      const startAdminBalance = await getBalance(admin.address, env.network);
      await step('withdraw funds', async () => {
        await withdraw(withdrawAmt, sWaves.assetId, user.privateKey);
      });
      const firstStakeRates = commitStakingRates(
        lastRate,
        currRate,
        delta,
        clear_reward + compensation,
        1440,
        assetDataQty
      );
      const currHeight = Number(await getDataValue(contract, 'LAST_HEIGHT', env.network));
      const targetHeight = Number(await getDataValue(contract, 'TARGET_HEIGHT', env.network));
      const lastHeight = targetHeight - 1440;
      const rates = withdrawRates(
        firstStakeRates.last_rate,
        firstStakeRates.current_rate,
        withdrawAmt,
        {
          prev_start_block: lastHeight,
          prev_finish_block: targetHeight,
          last_block: currHeight
        },
        assetDataQty
      );
      await step('check balances', async () => {
        expect(
          await getBalance(user.address, env.network)
        ).to.be.equal(startUserBalance - env.network.invokeFee + rates.withdraw);
        expect(
          await getAssetBalance(sWaves, user, env.network)
        ).to.be.equal(startUserSWBalance);
        expect(
          await getBalance(admin.address, env.network)
        ).to.be.equal(startAdminBalance + adminFee);
        expect(
          await getBalance(contract.dApp, env.network)
        ).to.be.equal(startTSBalance);
        expect(
          await getBalance(techContract.dApp, env.network)
        ).to.be.equal(startMockBalance - adminFee - rates.withdraw);
      });
      await step('check state', async () => {
        await setInt(techContract, techUser, rates.last_rate);
        expect(
          await getDataValue(contract, 'LAST_RATE', env.network)
        ).to.be.equal(
          await getDataValue(techContract, 'BINARY_INT', env.network)
        );
        await setInt(techContract, techUser, rates.current_rate);
        expect(
          await getDataValue(contract, 'CURRENT_RATE', env.network)
        ).to.be.equal(
          await getDataValue(techContract, 'BINARY_INT', env.network)
        );
        expect(
          Number(await getDataValue(contract, 'TARGET_HEIGHT', env.network))
        ).to.be.equal(
          Number(await getDataValue(contract, 'LAST_HEIGHT', env.network)) + 1440
        );
      });
    });
  });

  describe('setSponsorshipManager tests', function() {
    it('should throw when no self-call', async () => {
      const contract = getContractByName('tokenized_staking', this.parent?.ctx);
      const manager = getAccountByName('manager', this.parent?.ctx);
      await step('reset SPONSORSHIP_MANAGER', async () => {
        await setSignedContext(
          contract,
          {
            data: [{ key: 'SPONSORSHIP_MANAGER', type: 'string', value: ''}]
          }
        );
      });
      await stepIgnoreErrorByMessage(
        'try to invoke with other user',
        'Error while executing dApp: setSponsorshipManager: permission denied',
        async () => {
          await invoke(
            {
              dApp: contract.dApp,
              call: { 
                function: 'setSponsorshipManager',
                args: [
                  { type: 'string', value: manager.address }
                ]
              }
            },
            manager.privateKey,
            env.network
          );
        }
      );
      await step('check state', async () => {
        expect(
          await getDataValue(contract, 'SPONSORSHIP_MANAGER', env.network)
        ).to.be.equal('');
      });
    });

    it('should throw when wrong manager address', async () => {
      const contract = getContractByName('tokenized_staking', this.parent?.ctx);
      await step('reset SPONSORSHIP_MANAGER', async () => {
        await setSignedContext(
          contract,
          {
            data: [{ key: 'SPONSORSHIP_MANAGER', type: 'string', value: ''}]
          }
        );
      });
      await stepIgnoreErrorByMessage(
        'try to invoke setSponsorshipManager',
        'Error while executing dApp: setSponsorshipManager: invalid manager address',
        async () => {
          await setSponsorshipManager(base58Encode('bca482'));
        }
      );
      await step('check state', async () => {
        expect(
          await getDataValue(contract, 'SPONSORSHIP_MANAGER', env.network)
        ).to.be.equal('');
      });
    });

    it('simple positive', async () => {
      const contract = getContractByName('tokenized_staking', this.parent?.ctx);
      const manager = getAccountByName('manager', this.parent?.ctx);
      await step('reset SPONSORSHIP_MANAGER', async () => {
        await setSignedContext(
          contract,
          {
            data: [{ key: 'SPONSORSHIP_MANAGER', type: 'string', value: ''}]
          }
        );
      });
      await step('invoke setSponsorshipManager', async () => {
        await setSponsorshipManager(base58Encode(manager.address));
      });
      await step('check state', async () => {
        expect(
          await getDataValue(contract, 'SPONSORSHIP_MANAGER', env.network)
        ).to.be.equal(base58Encode(manager.address));
      });
    });
  });

  describe('updateSponsorship tests', function () {
    it('should throw when called with not manager', async () => {
      const techContract = getContractByName('technical', this.parent?.ctx);
      const contract = getContractByName('tokenized_staking', this.parent?.ctx);
      const manager = getAccountByName('manager', this.parent?.ctx);
      await step('reset state', async () => {
        await setSignedContext(
          contract,
          {
            data: [{ key: 'SPONSORSHIP_MANAGER', type: 'string', value: base58Encode(techContract.dApp) }]
          }
        );
      });
      await stepIgnoreErrorByMessage(
        'try to invoke',
        'Error while executing dApp: updateSponsorship: permission denied',
        async () => {
          await updateSponsorship(
            500000,
            100000000,
            manager.privateKey
          );
        }
      );
    });

    it('should throw when min fee < 0', async () => {
      const techContract = getContractByName('technical', this.parent?.ctx);
      const contract = getContractByName('tokenized_staking', this.parent?.ctx);
      await step('reset state', async () => {
        await setSignedContext(
          contract,
          {
            data: [{ key: 'SPONSORSHIP_MANAGER', type: 'string', value: base58Encode(techContract.dApp) }]
          }
        );
      });
      await stepIgnoreErrorByMessage(
        'try to invoke',
        'Error while executing dApp: updateSponsorship: invalid sponsorship fee',
        async () => {
          await updateSponsorship(
            -1,
            100000000,
            { privateKey: techContract.privateKey }
          );
        }
      );
    });

    it('should throw when WAVES required amount < 0', async () => {
      const techContract = getContractByName('technical', this.parent?.ctx);
      const contract = getContractByName('tokenized_staking', this.parent?.ctx);
      await step('reset state', async () => {
        await setSignedContext(
          contract,
          {
            data: [{ key: 'SPONSORSHIP_MANAGER', type: 'string', value: base58Encode(techContract.dApp) }]
          }
        );
      });
      await stepIgnoreErrorByMessage(
        'try to invoke',
        'Error while executing dApp: updateSponsorship: invalid waves required amount',
        async () => {
          await updateSponsorship(
            500000,
            -1,
            { privateKey: techContract.privateKey }
          );
        }
      );
    });

    it('simple positive', async () => {
      const techContract = getContractByName('technical', this.parent?.ctx);
      const contract = getContractByName('tokenized_staking', this.parent?.ctx);
      await step('reset state', async () => {
        await setSignedContext(
          contract,
          {
            data: [{ key: 'SPONSORSHIP_MANAGER', type: 'string', value: base58Encode(techContract.dApp) }]
          }
        );
      });
      const startContractBalance = await getBalance(contract.dApp, env.network);
      const startSponsorBalance = await getBalance(techContract.dApp, env.network);
      await step('invoke updateSponsorship',async () => {
        await updateSponsorship(
          500000,
          await getBalance(contract.dApp, env.network),
          { privateKey: techContract.privateKey }
        );
      });
      await step('check balances', async () => {
        expect(await getBalance(contract.dApp, env.network)).to.be.equal(startContractBalance);
        expect(await getBalance(techContract.dApp, env.network)).to.be.equal(startSponsorBalance - env.network.invokeFee);
      });
    });

    it('update sponsorship with WAVES refund', async () => {
      const techContract = getContractByName('technical', this.parent?.ctx);
      const contract = getContractByName('tokenized_staking', this.parent?.ctx);
      const delta = 100000000;
      await step('reset state', async () => {
        await setSignedContext(
          contract,
          {
            data: [{ key: 'SPONSORSHIP_MANAGER', type: 'string', value: base58Encode(techContract.dApp) }]
          }
        );
      });
      const startContractBalance = await getBalance(contract.dApp, env.network);
      const startSponsorBalance = await getBalance(techContract.dApp, env.network);
      await step('invoke updateSponsorship',async () => {
        await updateSponsorship(
          500000,
          await getBalance(contract.dApp, env.network) - delta,
          { privateKey: techContract.privateKey }
        );
      });
      await step('check balances', async () => {
        expect(await getBalance(contract.dApp, env.network)).to.be.equal(startContractBalance - delta);
        expect(await getBalance(techContract.dApp, env.network))
          .to.be.equal(startSponsorBalance + delta - env.network.invokeFee);
      });
    });

    it('update sponsorship with WAVES full refund and zero fee', async () => {
      const techContract = getContractByName('technical', this.parent?.ctx);
      const contract = getContractByName('tokenized_staking', this.parent?.ctx);
      await step('reset state', async () => {
        await setSignedContext(
          contract,
          {
            data: [{ key: 'SPONSORSHIP_MANAGER', type: 'string', value: base58Encode(techContract.dApp) }]
          }
        );
      });
      const startContractBalance = await getBalance(contract.dApp, env.network);
      const startSponsorBalance = await getBalance(techContract.dApp, env.network);
      await step('invoke updateSponsorship',async () => {
        await updateSponsorship(
          500000,
          0,
          { privateKey: techContract.privateKey }
        );
      });
      await step('check balances', async () => {
        expect(await getBalance(contract.dApp, env.network)).to.be.equal(0);
        expect(await getBalance(techContract.dApp, env.network))
          .to.be.equal(startSponsorBalance + startContractBalance - env.network.invokeFee);
      });
    });
  });
});
