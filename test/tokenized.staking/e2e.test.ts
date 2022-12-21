import {
  Asset,
  getDataValue,
  getAccountByName,
  getBlockHeight,
  getContractByName,
  getBalance,
  transfer,
  getAssetBalance,
  invoke
} from '@pepe-team/waves-sc-test-utils';
import waitHeight from '@waves/node-api-js/cjs/tools/blocks/waitHeight';
import { step, stepIgnoreErrorByMessage } from 'relax-steps-allure';
import { getEnvironment } from 'relax-env-json';
import { checkpoint, deposit, setSponsorshipManager, withdraw } from '../../steps/tokenized.staking';
import { getAssetContractBalance, getAssetInfo, getTechUser, prepareInvokeTx, setInt, setSignedContext, signedTransfer } from '../../steps/common';
import { expect } from 'chai';
import { commitStakingRates, depositRates, newStakingRates, withdrawRates } from '../../steps/waves.staking.math';
import { infraFeeCalculate } from '../../steps/leasing.node.math';
import { checkpointSponsorship, setupSponsorship } from '../../steps/sponsorship.manager';
import { base58Encode } from '@waves/ts-lib-crypto';
import { broadcast, waitForTx } from '@waves/waves-transactions';
const env = getEnvironment();

// eslint-disable-next-line @typescript-eslint/no-var-requires
const initData = require('./data/init.json');
const PERCENT_FACTOR = initData.percentFactor;

// TODO: check regular and available balances
describe('E2E main staking sceneries', function() {
  // currently skipped
  // stress test for correct math solves checking
  xit('revese calling depo + staking with varioust prev claiming', async () => {
    const node = getContractByName('leasing_node', this.parent?.ctx);
    const adapter = getContractByName('waves_staking_adapter', this.parent?.ctx);
    const tokenizedStake = getContractByName('tokenized_staking', this.parent?.ctx);
    const user = getAccountByName('neo', this.parent?.ctx);
    const techUser = getAccountByName('tech_acc', this.parent?.ctx);
    const techContract = getContractByName('technical', this.parent?.ctx);
    const depoAmount = 1366000000;
    const reward = 6613000000;
    const infraFee = infraFeeCalculate(reward, env.leasingNode.infraFee);
    const sWaves: Asset = {
      name: 'sWaves',
      description: '',
      quantity: 1,
      decimals: 8,
      assetId: String(await getDataValue(tokenizedStake, 'ASSET', env.network))
    };
    let startRates: any = {
      last_rate: PERCENT_FACTOR,
      current_rate: 0,
      depos: 0
    };
    let startSWDepo = 0;
    await step('reset states', async () => {
      await setSignedContext(
        adapter,
        {
          data: [
            { key: 'FEE', type: 'integer', value: 0 },
            { key: 'LAST_CLAIM', type: 'integer', value: await getBlockHeight(0, env.network) - 2 * initData.rewardHeight }
          ]
        }
      );
      await setSignedContext(
        tokenizedStake,
        {
          data: [
            { key: 'LAST_RATE', type: 'integer', value: PERCENT_FACTOR },
            { key: 'CURRENT_RATE', type: 'integer', value: 0 },
            { key: 'LAST_HEIGHT', type: 'integer', value: 0 },
            { key: 'TARGET_HEIGHT', type: 'integer', value: 0 },
          ]
        }
      );
    });
    await step('set empty leasing node balance', async () => {
      await signedTransfer({
        address: node.dApp,
        publicKey: node.publicKey,
        privateKey: node.privateKey
      },
      techUser.address,
      await getBalance(node.dApp, env.network) - env.network.transferFee
      );
      expect(
        await getBalance(node.dApp, env.network)
      ).to.be.equal(0);
    });
    const startAdapterBalance = await getBalance(adapter.dApp, env.network);
    const startTokenizedBalance = await getBalance(tokenizedStake.dApp, env.network);
    // const startUserBalance = await getBalance(user.address, env.network);
    let adapterCounter = 0;
    let tokenizedCounter = 0;
    const assetData = await getAssetInfo(sWaves.assetId);
    const assetDataQty = parseInt(assetData.quantity.toString());
    for(let i = 0; i < 32; i++) {
      if(Math.random() > 0.55) {
        const depos_ = startRates.depos;
        const lastHeight = await getBlockHeight(0, env.network) - 5;
        const targetHeight = lastHeight + 4;
        await step(`set adapter state like claim preiod ended, iter #${i}`, async () => {
          await setSignedContext(
            adapter,
            {
              data: [
                { key: 'LAST_CLAIM', type: 'integer', value: await getBlockHeight(0, env.network) - 2 * initData.rewardHeight }
              ]
            }
          );
          await setSignedContext(
            tokenizedStake,
            {
              data: [
                { key: 'LAST_HEIGHT', type: 'integer', value: lastHeight },
                { key: 'TARGET_HEIGHT', type: 'integer', value: targetHeight }
              ]
            }
          );
        });
        adapterCounter = adapterCounter + 1;
        tokenizedCounter = tokenizedCounter + 1;
        await step(`recharge leasing node balance for reward, iter #${i}`, async () => {
          await transfer(
            {
              recipient: node.dApp,
              assetId: null,
              amount: reward
            },
            techUser.privateKey,
            env.network
          );
          expect(
            await getBalance(node.dApp, env.network)
          ).to.be.equal(reward);
        });
        await step(`claim reward with checkpoint, iter #${i}`, async () => {
          await checkpoint(user.privateKey);
        });
        startRates = commitStakingRates(
          startRates.last_rate,
          startRates.current_rate,
          4,
          reward - infraFee - env.network.invokeFee,
          initData.rewardHeight,
          assetDataQty + depos_
        );
        startRates['depos'] = depos_;
        await step('wait 1 block', async () => {
          await waitHeight(env.network.nodeAPI, await getBlockHeight(1, env.network));
        });
      }
      await step(`recharge leasing node again, iter #${i}`, async () => {
        await transfer(
          {
            recipient: node.dApp,
            assetId: null,
            amount: reward
          },
          techUser.privateKey,
          env.network
        );
        expect(
          await getBalance(node.dApp, env.network)
        ).to.be.equal(reward);
      });
      const lastHeight = await getBlockHeight(0, env.network) - 5;
      const targetHeight = lastHeight + 4;
      await step(`set adapter state like claim preiod ended, iter #${i}`, async () => {
        await setSignedContext(
          adapter,
          {
            data: [
              { key: 'LAST_CLAIM', type: 'integer', value: await getBlockHeight(0, env.network) - 2 * initData.rewardHeight }
            ]
          }
        );
        await setSignedContext(
          tokenizedStake,
          {
            data: [
              { key: 'LAST_HEIGHT', type: 'integer', value: lastHeight },
              { key: 'TARGET_HEIGHT', type: 'integer', value: targetHeight }
            ]
          }
        );
      });
      adapterCounter = adapterCounter + 1;
      tokenizedCounter = tokenizedCounter + 1;
      startSWDepo = await getAssetBalance(sWaves, user, env.network);
      await step(`another deposit, iter #${i}`, async () => {
        await deposit(depoAmount, user.privateKey);
      });
      const depos_ = startRates.depos;
      const stakeDepo = commitStakingRates(
        startRates.last_rate,
        startRates.current_rate,
        4,
        reward - infraFee,
        initData.rewardHeight,
        assetDataQty + depos_
      );
      startRates = depositRates(
        stakeDepo.last_rate,
        stakeDepo.current_rate,
        depoAmount,
        {
          prev_start_block: 1,
          prev_finish_block: 1441,
          last_block: 1
        },
        assetDataQty + depos_
      );
      startRates['depos'] = depos_ + startRates.sw_deposit;
      console.info(`sWaves calculated: ${startRates.sw_deposit}, real: ${await getAssetBalance(sWaves, user, env.network) - startSWDepo}`);
      await step(`check rates, iter #${i}`, async () => {
        // eslint-disable-next-line prefer-const
        let lastRatesArr = [];
        // await setInt(techContract, techUser, startRates.last_rate - 2);
        // lastRatesArr.push(await getDataValue(techContract, 'BINARY_INT', env.network));
        await setInt(techContract, techUser, startRates.last_rate - 1);
        lastRatesArr.push(await getDataValue(techContract, 'BINARY_INT', env.network));
        await setInt(techContract, techUser, startRates.last_rate);
        lastRatesArr.push(await getDataValue(techContract, 'BINARY_INT', env.network));
        await setInt(techContract, techUser, startRates.last_rate + 1);
        lastRatesArr.push(await getDataValue(techContract, 'BINARY_INT', env.network));
        // await setInt(techContract, techUser, startRates.last_rate + 2);
        // lastRatesArr.push(await getDataValue(techContract, 'BINARY_INT', env.network));
        const lastRate = await getDataValue(tokenizedStake, 'LAST_RATE', env.network);
        if(lastRate == lastRatesArr[0]) {
          startRates.last_rate = startRates.last_rate - 1;
          startRates.sw_deposit = await getAssetBalance(sWaves, user, env.network) - startSWDepo;
          console.info('LAST_RATE DELTA -1');
        } else if (lastRate == lastRatesArr[2]) {
          startRates.last_rate = startRates.last_rate + 1;
          startRates.sw_deposit = await getAssetBalance(sWaves, user, env.network) - startSWDepo;
          console.info('LAST_RATE DELTA +1');
        } else if (lastRate != lastRatesArr[1]) {
          console.info('LAST_RATE FUCKUP!');
          console.info(`Calculated value: ${startRates.last_rate}`);
          console.info(lastRatesArr);
          console.info(`Real value: ${await getDataValue(tokenizedStake, 'LAST_RATE', env.network)}`);
          throw new Error('LAST_RATE fuckup');
        }
        // eslint-disable-next-line prefer-const
        let currRatesArr = [];
        // await setInt(techContract, techUser, startRates.current_rate - 2);
        // currRatesArr.push(await getDataValue(techContract, 'BINARY_INT', env.network));
        await setInt(techContract, techUser, startRates.current_rate - 1);
        currRatesArr.push(await getDataValue(techContract, 'BINARY_INT', env.network));
        await setInt(techContract, techUser, startRates.current_rate);
        currRatesArr.push(await getDataValue(techContract, 'BINARY_INT', env.network));
        await setInt(techContract, techUser, startRates.current_rate + 1);
        currRatesArr.push(await getDataValue(techContract, 'BINARY_INT', env.network));
        // await setInt(techContract, techUser, startRates.current_rate + 2);
        // currRatesArr.push(await getDataValue(techContract, 'BINARY_INT', env.network));
        const currRate = await getDataValue(tokenizedStake, 'CURRENT_RATE', env.network);
        if(currRate == currRatesArr[0]) {
          startRates.current_rate = startRates.current_rate - 1;
          startRates.sw_deposit = await getAssetBalance(sWaves, user, env.network) - startSWDepo;
          console.info('CURRENT_RATE DELTA -1');
        } else if (currRate == currRatesArr[2]) {
          startRates.current_rate = startRates.current_rate + 1;
          startRates.sw_deposit = await getAssetBalance(sWaves, user, env.network) - startSWDepo;
          console.info('CURRENT_RATE DELTA +1');
        } else if (currRate != currRatesArr[1]) {
          console.info('CURRENT_RATE FUCKUP!');
          console.info(`Calculated value: ${startRates.current_rate}`);
          console.info(currRatesArr);
          console.info(`Real value: ${await getDataValue(tokenizedStake, 'CURRENT_RATE', env.network)}`);
          throw new Error('CURRENT_RATE fuckup');
        }
      });
    }
    await step('withdraw all', async () => {
      await withdraw(
        await getAssetBalance(sWaves, user, env.network),
        sWaves.assetId,
        user.privateKey
      );
    });
    await step('check balances', async () => {
      expect(
        startAdapterBalance - adapterCounter * env.network.invokeFee
      ).is.lessThan(
        await getBalance(adapter.dApp, env.network)
      );
      expect(
        await getBalance(tokenizedStake.dApp, env.network)
      ).to.be.equal(
        startTokenizedBalance - tokenizedCounter * env.network.invokeFee
      );
    });
  });

  it('[SANITY] test for clean rates and reissue bug', async () => {
    const node = getContractByName('leasing_node', this.parent?.ctx);
    const adapter = getContractByName('waves_staking_adapter', this.parent?.ctx);
    const tokenizedStake = getContractByName('tokenized_staking', this.parent?.ctx);
    const user = getAccountByName('neo', this.parent?.ctx);
    const techUser = getAccountByName('tech_acc', this.parent?.ctx);
    const techContract = getContractByName('technical', this.parent?.ctx);
    const depoAmount = 1366000000;
    const reward = 6613000000;
    const infraFee = infraFeeCalculate(reward, env.leasingNode.infraFee);
    const sWaves: Asset = {
      name: 'sWaves',
      description: '',
      quantity: 1,
      decimals: 8,
      assetId: String(await getDataValue(tokenizedStake, 'ASSET', env.network))
    };
    await step('reset states', async () => {
      await setSignedContext(
        adapter,
        {
          data: [
            { key: 'FEE', type: 'integer', value: 0 },
            { key: 'LAST_CLAIM', type: 'integer', value: await getBlockHeight(0, env.network) - 2 * initData.rewardHeight }
          ]
        }
      );
      await setSignedContext(
        tokenizedStake,
        {
          data: [
            { key: 'LAST_RATE', type: 'integer', value: PERCENT_FACTOR },
            { key: 'CURRENT_RATE', type: 'integer', value: 0 },
            { key: 'LAST_HEIGHT', type: 'integer', value: 0 },
            { key: 'TARGET_HEIGHT', type: 'integer', value: 0 },
          ]
        }
      );
    });
    await step('set empty leasing node balance', async () => {
      const leasingBalance = await getBalance(node.dApp, env.network);
      if(leasingBalance > 0) {
        await signedTransfer(
          {
            address: node.dApp,
            publicKey: node.publicKey,
            privateKey: node.privateKey
          },
          techUser.address,
          leasingBalance - env.network.transferFee
        );
      }
      expect(
        await getBalance(node.dApp, env.network)
      ).to.be.equal(0);
    });
    console.info(`ASSET: ${await getDataValue(tokenizedStake, 'ASSET', env.network)}`);
    console.info(`SWAWES ASSET ID: ${sWaves.assetId}`);
    const assetData = await getAssetInfo(sWaves.assetId);
    const assetDataQty = parseInt(assetData.quantity.toString());
    await step('deposit WAVESes', async () => {
      await deposit(depoAmount, user.privateKey);
    });
    const depoRates = depositRates(
      PERCENT_FACTOR,
      0,
      depoAmount,
      {
        prev_start_block: 0,
        prev_finish_block: 0,
        last_block: 1
      },
      assetDataQty
    );
    await step('recharge leasing node', async () => {
      await transfer(
        {
          recipient: node.dApp,
          assetId: null,
          amount: reward
        },
        techUser.privateKey,
        env.network
      );
      expect(
        await getBalance(node.dApp, env.network)
      ).to.be.equal(reward);
    });
    await step('set adapter state like claim preiod ended', async () => {
      await setSignedContext(
        adapter,
        {
          data: [
            { key: 'LAST_CLAIM', type: 'integer', value: await getBlockHeight(0, env.network) - 2 * initData.rewardHeight }
          ]
        }
      );
    });
    await step('deposit (with lazy claim reward)', async () => {
      await deposit(depoAmount, user.privateKey);
    });
    const claimRates = commitStakingRates(
      depoRates.last_rate,
      depoRates.current_rate,
      0, // BECAUSE HAVE NO PREVIOUS STAKING! MORE IMPORTANT!!!
      reward - infraFee,
      initData.rewardHeight,
      assetDataQty + depoRates.sw_deposit
    );
    const anotherRepoRates = depositRates(
      claimRates.last_rate,
      claimRates.current_rate,
      depoAmount,
      {
        prev_start_block: 1,
        prev_finish_block: 1 + initData.rewardHeight,
        last_block: 1
      },
      assetDataQty + depoRates.sw_deposit
    );
    await step('check state', async () => {
      // tokenized: LAST_RATE, CURRENT_RATE
      await setInt(techContract, techUser, anotherRepoRates.last_rate);
      expect(
        await getDataValue(tokenizedStake, 'LAST_RATE', env.network)
      ).to.be.equal(
        await getDataValue(techContract, 'BINARY_INT', env.network)
      );
      await setInt(techContract, techUser, anotherRepoRates.current_rate);
      expect(
        await getDataValue(tokenizedStake, 'CURRENT_RATE', env.network)
      ).to.be.equal(
        await getDataValue(techContract, 'BINARY_INT', env.network)
      );
    });
  });

  it('[SANITY] staking and claim infraFee without depo first', async () => {
    const node = getContractByName('leasing_node', this.parent?.ctx);
    const adapter = getContractByName('waves_staking_adapter', this.parent?.ctx);
    const tokenizedStake = getContractByName('tokenized_staking', this.parent?.ctx);
    const techUser = getAccountByName('tech_acc', this.parent?.ctx);
    const techContract = getContractByName('technical', this.parent?.ctx);
    const user = getAccountByName('neo', this.parent?.ctx);
    const otherUser = getAccountByName('jack', this.parent?.ctx);
    const manager = getAccountByName('manager', this.parent?.ctx);
    const depoAmount = 1366000000;
    const oswCoef = 0.57;
    const reward = 6163000000;
    const infraFee = infraFeeCalculate(reward, env.leasingNode.infraFee);
    const sWaves: Asset = {
      name: 'sWaves',
      description: '',
      quantity: 1,
      decimals: 8,
      assetId: String(await getDataValue(tokenizedStake, 'ASSET', env.network))
    };
    await step('reset states', async () => {
      await setSignedContext(
        adapter,
        {
          data: [
            { key: 'FEE', type: 'integer', value: 0 },
            { key: 'LAST_CLAIM', type: 'integer', value: await getBlockHeight(0, env.network) - 2 * initData.rewardHeight }
          ]
        }
      );
      await setSignedContext(
        tokenizedStake,
        {
          data: [
            { key: 'LAST_RATE', type: 'integer', value: PERCENT_FACTOR },
            { key: 'CURRENT_RATE', type: 'integer', value: 0 },
            { key: 'LAST_HEIGHT', type: 'integer', value: 0 },
            { key: 'TARGET_HEIGHT', type: 'integer', value: 0 },
          ]
        }
      );
    });
    await step('set empty leasing node balance', async () => {
      const leasingBalance = await getBalance(node.dApp, env.network);
      if(leasingBalance > 0) {
        await signedTransfer({
          address: node.dApp,
          publicKey: node.publicKey,
          privateKey: node.privateKey
        },
        techUser.address,
        await getBalance(node.dApp, env.network) - env.network.transferFee
        );
      }
      expect(
        await getBalance(node.dApp, env.network)
      ).to.be.equal(0);
    });
    const assetData = await getAssetInfo(sWaves.assetId);
    const assetDataQty = parseInt(assetData.quantity.toString());
    const startUserBalance = await getBalance(user.address, env.network);
    const startUserBalanceSw = await getAssetBalance(sWaves, user, env.network);
    const startAdapterBalance = await getBalance(adapter.dApp, env.network);
    const startTokenizedBalance = await getBalance(tokenizedStake.dApp, env.network);
    const startManagerBalance = await getBalance(manager.address, env.network);        
    await step('recharge leasing node balance for reward', async () => {
      await transfer(
        {
          recipient: node.dApp,
          assetId: null,
          amount: reward
        },
        techUser.privateKey,
        env.network
      );
      expect(
        await getBalance(node.dApp, env.network)
      ).to.be.equal(reward);
    });
    await step('claim reward with checkpoint', async () => {
      await checkpoint(user.privateKey);
    });
    const rewardRates = newStakingRates(
      PERCENT_FACTOR,
      reward - infraFee - env.network.invokeFee,
      initData.rewardHeight,
      assetDataQty
    );
    await step('check mid state', async () => {
      // only CURRENT_RATE
      await setInt(techContract, techUser, rewardRates.current_rate);
      expect(
        await getDataValue(tokenizedStake, 'CURRENT_RATE', env.network)
      ).to.be.equal(
        await getDataValue(techContract, 'BINARY_INT', env.network)
      );
    });
    await step('recharge leasing node again', async () => {
      await transfer(
        {
          recipient: node.dApp,
          assetId: null,
          amount: reward
        },
        techUser.privateKey,
        env.network
      );
      expect(
        await getBalance(node.dApp, env.network)
      ).to.be.equal(reward);
    });
    await stepIgnoreErrorByMessage(
      'try to claim reward',
      'Error while executing dApp: checkpoint: no reward',
      async () => { await checkpoint(user.privateKey); }
    );
    const lastHeight = await getBlockHeight(0, env.network) - 5;
    const targetHeight = lastHeight + 4;
    await step('set adapter state like claim preiod ended', async () => {
      await setSignedContext(
        adapter,
        {
          data: [
            { key: 'LAST_CLAIM', type: 'integer', value: await getBlockHeight(0, env.network) - 2 * initData.rewardHeight }
          ]
        }
      );
      await setSignedContext(
        tokenizedStake,
        {
          data: [
            { key: 'LAST_HEIGHT', type: 'integer', value: lastHeight },
            { key: 'TARGET_HEIGHT', type: 'integer', value: targetHeight }
          ]
        }
      );
    });
    await step('another deposit', async () => {
      await deposit(depoAmount, user.privateKey);
    });
    const cr = commitStakingRates(
      rewardRates.last_rate,
      rewardRates.current_rate,
      4,
      reward - infraFee,
      initData.rewardHeight,
      assetDataQty
    );
    const dr = depositRates(
      cr.last_rate,
      cr.current_rate,
      depoAmount,
      {
        prev_start_block: 1,
        prev_finish_block: 1441,
        last_block: 1
      },
      assetDataQty
    );
    await step('check balances', async () => {
      expect(
        await getAssetBalance(sWaves, user, env.network)
      ).to.be.equal(startUserBalanceSw + dr.sw_deposit);
      expect(
        await getBalance(user.address, env.network)
      ).to.be.equal(startUserBalance - depoAmount - env.network.invokeFee);
      // manager acc = startBalance + 2 * infraFee
      expect(
        await getBalance(manager.address, env.network)
      ).to.be.equal(startManagerBalance + 2 * infraFee);
      // lease node = 0
      expect(
        await getBalance(node.dApp, env.network)
      ).to.be.equal(0);
      // adapter = startBalance + 2x reward - invokeFee + 2x deposit
      expect(
        await getBalance(adapter.dApp, env.network)
      ).to.be.equal(startAdapterBalance + depoAmount + (reward - env.network.invokeFee - infraFee) + (reward - infraFee) - env.network.invokeFee);
      // tokenized = startBalance - invokeFee
      expect(
        await getBalance(tokenizedStake.dApp, env.network)
      ).to.be.equal(startTokenizedBalance - env.network.invokeFee);
    });
    await step('check state', async () => {
      // tokenized: LAST_RATE, CURRENT_RATE
      await setInt(techContract, techUser, dr.last_rate);
      expect(
        await getDataValue(tokenizedStake, 'LAST_RATE', env.network)
      ).to.be.equal(
        await getDataValue(techContract, 'BINARY_INT', env.network)
      );
      await setInt(techContract, techUser, dr.current_rate);
      expect(
        await getDataValue(tokenizedStake, 'CURRENT_RATE', env.network)
      ).to.be.equal(
        await getDataValue(techContract, 'BINARY_INT', env.network)
      );
    });
  });

  it('staking and withdraw', async () => {
    const node = getContractByName('leasing_node', this.parent?.ctx);
    const adapter = getContractByName('waves_staking_adapter', this.parent?.ctx);
    const tokenizedStake = getContractByName('tokenized_staking', this.parent?.ctx);
    const user = getAccountByName('neo', this.parent?.ctx);
    const checkpointUser = getAccountByName('morpheus', this.parent?.ctx);
    const techUser = getAccountByName('tech_acc', this.parent?.ctx);
    const techContract = getContractByName('technical', this.parent?.ctx);
    const manager = getAccountByName('manager', this.parent?.ctx);
    const depoAmount = 1366000000;
    const reward = 6613000000;
    const infraFee = infraFeeCalculate(reward, env.leasingNode.infraFee);
    const sWaves: Asset = {
      name: 'sWaves',
      description: '',
      quantity: 1,
      decimals: 8,
      assetId: String(await getDataValue(tokenizedStake, 'ASSET', env.network))
    };
    await step('reset states', async () => {
      await setSignedContext(
        adapter,
        {
          data: [
            { key: 'FEE', type: 'integer', value: 0 },
            { key: 'LAST_CLAIM', type: 'integer', value: await getBlockHeight(0, env.network) - 2 * initData.rewardHeight }
          ]
        }
      );
      await setSignedContext(
        tokenizedStake,
        {
          data: [
            { key: 'LAST_RATE', type: 'integer', value: PERCENT_FACTOR },
            { key: 'CURRENT_RATE', type: 'integer', value: 0 },
            { key: 'LAST_HEIGHT', type: 'integer', value: 0 },
            { key: 'TARGET_HEIGHT', type: 'integer', value: 0 },
          ]
        }
      );
    });
    await step('set empty leasing node balance', async () => {
      const leasingBalance = await getBalance(node.dApp, env.network);
      if(leasingBalance > 0) {
        await signedTransfer({
          address: node.dApp,
          publicKey: node.publicKey,
          privateKey: node.privateKey
        },
        techUser.address,
        leasingBalance - env.network.transferFee
        );
      }
      expect(
        await getBalance(node.dApp, env.network)
      ).to.be.equal(0);
    });
    const assetData = await getAssetInfo(sWaves.assetId);
    const assetDataQty = parseInt(assetData.quantity.toString());
    const startUserBalance = await getBalance(user.address, env.network);
    const startUserSWBalance = await getAssetBalance(sWaves, user, env.network);
    const startManagerBalance = await getBalance(manager.address, env.network);
    const startCUBalance = await getBalance(checkpointUser.address, env.network);
    const startAdapterBalance = await getBalance(adapter.dApp, env.network);
    const startTokenizedBalance = await getBalance(tokenizedStake.dApp, env.network);
    await step('deposit WAVESes by user', async () => {
      await deposit(depoAmount, user.privateKey);
    });
    const depoRates = depositRates(
      PERCENT_FACTOR,
      0,
      depoAmount,
      {
        prev_start_block: 0,
        prev_finish_block: 0,
        last_block: 1
      },
      assetDataQty
    );
    await step('recharge leasing node balance for reward', async () => {
      await transfer(
        {
          recipient: node.dApp,
          assetId: null,
          amount: reward
        },
        techUser.privateKey,
        env.network
      );
      expect(
        await getBalance(node.dApp, env.network)
      ).to.be.equal(reward);
    });
    await step('claim reward with checkpoint', async () => {
      await checkpoint(checkpointUser.privateKey);
    });
    const rewardRates = commitStakingRates(
      depoRates.last_rate,
      depoRates.current_rate,
      0,
      reward - infraFee - env.network.invokeFee,
      initData.rewardHeight,
      assetDataQty + depoRates.sw_deposit
    );
    await step('check middle state', async () => {
      await setInt(techContract, techUser, rewardRates.last_rate);
      expect(
        await getDataValue(tokenizedStake, 'LAST_RATE', env.network)
      ).to.be.equal(
        await getDataValue(techContract, 'BINARY_INT', env.network)
      );
      await setInt(techContract, techUser, rewardRates.current_rate);
      expect(
        await getDataValue(tokenizedStake, 'CURRENT_RATE', env.network)
      ).to.be.equal(
        await getDataValue(techContract, 'BINARY_INT', env.network)
      );
    });
    await step('await some times (3 blocks, for example)', async () => {
      await waitHeight(env.network.nodeAPI, await getBlockHeight(3, env.network));
    });
    const lastBlock = Number(await getDataValue(tokenizedStake, 'LAST_HEIGHT', env.network));
    const targetBlock = Number(await getDataValue(tokenizedStake, 'TARGET_HEIGHT', env.network));
    await step('withdraw user\'s funds with sWAVESes', async () => {
      await withdraw(
        depoRates.sw_deposit,
        sWaves.assetId,
        user.privateKey
      );
    });
    const wdRates = withdrawRates(
      rewardRates.last_rate,
      rewardRates.current_rate,
      depoRates.sw_deposit,
      {
        prev_start_block: lastBlock,
        prev_finish_block: targetBlock,
        last_block: Number(await getDataValue(tokenizedStake, 'LAST_HEIGHT', env.network))
      },
      assetDataQty + depoRates.sw_deposit
    );
    await step('check state', async () => {
      // tokenized: LAST_RATE, CURRENT_RATE
      await setInt(techContract, techUser, wdRates.last_rate);
      expect(
        await getDataValue(tokenizedStake, 'LAST_RATE', env.network)
      ).to.be.equal(
        await getDataValue(techContract, 'BINARY_INT', env.network)
      );
      await setInt(techContract, techUser, wdRates.current_rate);
      expect(
        await getDataValue(tokenizedStake, 'CURRENT_RATE', env.network)
      ).to.be.equal(
        await getDataValue(techContract, 'BINARY_INT', env.network)
      );
    });
    await step('check balances', async () => {
      expect(
        await getBalance(user.address, env.network)
      ).to.be.equal(startUserBalance - depoAmount + wdRates.withdraw - 2 * env.network.invokeFee);
      expect(await getAssetBalance(sWaves, user, env.network)).to.be.equal(startUserSWBalance);
      // checkpointUser = startBalance + invokeFee
      expect(
        await getBalance(checkpointUser.address, env.network)
      ).to.be.equal(startCUBalance);
      // lease node = 0
      expect(
        await getBalance(node.dApp, env.network)
      ).to.be.equal(0);
      // adapter = startBalance + reward - invokeFee - infraFee + deposit - withdraw
      const currAdapterBalance = await getBalance(adapter.dApp, env.network);
      expect(currAdapterBalance).to.be.equal(startAdapterBalance + reward - infraFee - env.network.invokeFee + depoAmount - wdRates.withdraw);
      expect(startAdapterBalance).is.lessThan(currAdapterBalance);
      // manager = startBalance + infraFee
      expect(await getBalance(manager.address, env.network)).to.be.equal(startManagerBalance + infraFee);
      // tokenized = startBalance
      expect(
        await getBalance(tokenizedStake.dApp, env.network)
      ).to.be.equal(startTokenizedBalance);
    });
  });

  it('staking and claim infraFee', async () => {
    const node = getContractByName('leasing_node', this.parent?.ctx);
    const adapter = getContractByName('waves_staking_adapter', this.parent?.ctx);
    const tokenizedStake = getContractByName('tokenized_staking', this.parent?.ctx);
    const techUser = getAccountByName('tech_acc', this.parent?.ctx);
    const techContract = getContractByName('technical', this.parent?.ctx);
    const user = getAccountByName('neo', this.parent?.ctx);
    const otherUser = getAccountByName('jack', this.parent?.ctx);
    const manager = getAccountByName('manager', this.parent?.ctx);
    const depoAmount = 1366000000;
    const oswCoef = 0.57;
    const reward = 6163000000;
    const infraFee = infraFeeCalculate(reward, env.leasingNode.infraFee);
    const sWaves: Asset = {
      name: 'sWaves',
      description: '',
      quantity: 1,
      decimals: 8,
      assetId: String(await getDataValue(tokenizedStake, 'ASSET', env.network))
    };
    await step('reset states', async () => {
      await setSignedContext(
        adapter,
        {
          data: [
            { key: 'FEE', type: 'integer', value: 0 },
            { key: 'LAST_CLAIM', type: 'integer', value: await getBlockHeight(0, env.network) - 2 * initData.rewardHeight }
          ]
        }
      );
      await setSignedContext(
        tokenizedStake,
        {
          data: [
            { key: 'LAST_RATE', type: 'integer', value: PERCENT_FACTOR },
            { key: 'CURRENT_RATE', type: 'integer', value: 0 },
            { key: 'LAST_HEIGHT', type: 'integer', value: 0 },
            { key: 'TARGET_HEIGHT', type: 'integer', value: 0 },
          ]
        }
      );
    });
    await step('set empty leasing node balance', async () => {
      const leasingBalance = await getBalance(node.dApp, env.network);
      if(leasingBalance > 0) {
        await signedTransfer({
          address: node.dApp,
          publicKey: node.publicKey,
          privateKey: node.privateKey
        },
        techUser.address,
        await getBalance(node.dApp, env.network) - env.network.transferFee
        );
      }
      expect(
        await getBalance(node.dApp, env.network)
      ).to.be.equal(0);
    });
    const assetData = await getAssetInfo(sWaves.assetId);
    const assetDataQty = parseInt(assetData.quantity.toString());
    const startUserBalance = await getBalance(user.address, env.network);
    const startUserBalanceSw = await getAssetBalance(sWaves, user, env.network);
    const startAdapterBalance = await getBalance(adapter.dApp, env.network);
    const startTokenizedBalance = await getBalance(tokenizedStake.dApp, env.network);
    const startManagerBalance = await getBalance(manager.address, env.network);
    await step('deposit WAVESes', async () => {
      await deposit(depoAmount, user.privateKey);
    });
    const depoRates = depositRates(
      PERCENT_FACTOR,
      0,
      depoAmount,
      {
        prev_start_block: 0,
        prev_finish_block: 0,
        last_block: 1
      },
      assetDataQty
    );
    const otherSWaves = Math.floor(depoRates.sw_deposit * oswCoef);
    const otherStartBalance = await getAssetBalance(sWaves, otherUser, env.network);
    await step('send sWaves to other user', async () => {
      await transfer(
        {
          recipient: otherUser.address,
          assetId: sWaves.assetId,
          amount: otherSWaves
        },
        user.privateKey,
        env.network
      );
      expect(
        await getAssetBalance(sWaves, otherUser, env.network)
      ).to.be.equal(otherStartBalance + otherSWaves);
    });
    await stepIgnoreErrorByMessage(
      'try to deposit not-WAVESes with WAVES adapter',
      'Error while executing dApp: deposit: payment is not in base asset',
      async () => {
        await deposit(otherSWaves, otherUser.privateKey, sWaves.assetId);
      }
    );
    await step('recharge leasing node balance for reward', async () => {
      await transfer(
        {
          recipient: node.dApp,
          assetId: null,
          amount: reward
        },
        techUser.privateKey,
        env.network
      );
      expect(
        await getBalance(node.dApp, env.network)
      ).to.be.equal(reward);
    });
    await step('claim reward with checkpoint', async () => {
      await checkpoint(user.privateKey);
    });
    const rewardRates = commitStakingRates(
      depoRates.last_rate,
      depoRates.current_rate,
      0,
      reward - infraFee - env.network.invokeFee,
      initData.rewardHeight,
      assetDataQty + depoRates.sw_deposit
    );
    await step('check mid state', async () => {
      // tokenized: LAST_RATE, CURRENT_RATE
      await setInt(techContract, techUser, rewardRates.last_rate);
      expect(
        await getDataValue(tokenizedStake, 'LAST_RATE', env.network)
      ).to.be.equal(
        await getDataValue(techContract, 'BINARY_INT', env.network)
      );
      await setInt(techContract, techUser, rewardRates.current_rate);
      expect(
        await getDataValue(tokenizedStake, 'CURRENT_RATE', env.network)
      ).to.be.equal(
        await getDataValue(techContract, 'BINARY_INT', env.network)
      );
    });
    await step('recharge leasing node again', async () => {
      await transfer(
        {
          recipient: node.dApp,
          assetId: null,
          amount: reward
        },
        techUser.privateKey,
        env.network
      );
      expect(
        await getBalance(node.dApp, env.network)
      ).to.be.equal(reward);
    });
    await stepIgnoreErrorByMessage(
      'try to claim reward',
      'Error while executing dApp: checkpoint: no reward',
      async () => { await checkpoint(user.privateKey); }
    );
    const lastHeight = await getBlockHeight(0, env.network) - 5;
    const targetHeight = lastHeight + 4;
    await step('set adapter state like claim preiod ended', async () => {
      await setSignedContext(
        adapter,
        {
          data: [
            { key: 'LAST_CLAIM', type: 'integer', value: await getBlockHeight(0, env.network) - 2 * initData.rewardHeight }
          ]
        }
      );
      await setSignedContext(
        tokenizedStake,
        {
          data: [
            { key: 'LAST_HEIGHT', type: 'integer', value: lastHeight },
            { key: 'TARGET_HEIGHT', type: 'integer', value: targetHeight }
          ]
        }
      );
    });
    await step('another deposit', async () => {
      await deposit(depoAmount, user.privateKey);
    });
    const cr = commitStakingRates(
      rewardRates.last_rate,
      rewardRates.current_rate,
      4,
      reward - infraFee,
      initData.rewardHeight,
      assetDataQty + depoRates.sw_deposit
    );
    const dr = depositRates(
      cr.last_rate,
      cr.current_rate,
      depoAmount,
      {
        prev_start_block: 1,
        prev_finish_block: 1441,
        last_block: 1
      },
      assetDataQty + depoRates.sw_deposit
    );
    await step('check balances', async () => {
      // user1 = startBalance - 2x depoAmount - transferFee - 2x invokeFee
      expect(
        await getAssetBalance(sWaves, user, env.network)
      ).to.be.equal(startUserBalanceSw + depoRates.sw_deposit + dr.sw_deposit - otherSWaves);
      expect(
        await getBalance(user.address, env.network)
      ).to.be.equal(startUserBalance - 2 * depoAmount - 2 * env.network.invokeFee - env.network.transferFee);
      // manager acc = startBalance + 2 * infraFee
      expect(
        await getBalance(manager.address, env.network)
      ).to.be.equal(startManagerBalance + 2 * infraFee);
      // lease node = 0
      expect(
        await getBalance(node.dApp, env.network)
      ).to.be.equal(0);
      // adapter = startBalance + 2x reward - 2x invokeFee + 2x deposit
      expect(
        await getBalance(adapter.dApp, env.network)
      ).to.be.equal(startAdapterBalance + 2 * depoAmount + (reward - env.network.invokeFee - infraFee) + (reward - infraFee) - env.network.invokeFee);
      // tokenized = startBalance - invokeFee
      expect(
        await getBalance(tokenizedStake.dApp, env.network)
      ).to.be.equal(startTokenizedBalance - env.network.invokeFee);
    });
    await step('check state', async () => {
      // tokenized: LAST_RATE, CURRENT_RATE
      await setInt(techContract, techUser, dr.last_rate);
      expect(
        await getDataValue(tokenizedStake, 'LAST_RATE', env.network)
      ).to.be.equal(
        await getDataValue(techContract, 'BINARY_INT', env.network)
      );
      await setInt(techContract, techUser, dr.current_rate);
      expect(
        await getDataValue(tokenizedStake, 'CURRENT_RATE', env.network)
      ).to.be.equal(
        await getDataValue(techContract, 'BINARY_INT', env.network)
      );
    });
  });

  it('smoozy scenery with more deposits, withdraws and claim infraFee', async () => {
    const node = getContractByName('leasing_node', this.parent?.ctx);
    const adapter = getContractByName('waves_staking_adapter', this.parent?.ctx);
    const tokenizedStake = getContractByName('tokenized_staking', this.parent?.ctx);
    const techContract = getContractByName('technical', this.parent?.ctx);
    const techUser = getAccountByName('tech_acc', this.parent?.ctx);
    const user = getAccountByName('neo', this.parent?.ctx);
    const user2 = getAccountByName('morpheus', this.parent?.ctx);
    const user3 = getAccountByName('trinity', this.parent?.ctx);
    const manager = getAccountByName('manager', this.parent?.ctx);
    const depoAmount = 1366000000;
    const depoAmount2 = 1234560000;
    const depoAmount3 = 987654321;
    const reward = 6163000000;
    const infraFee = infraFeeCalculate(reward, env.leasingNode.infraFee);
    const sWaves: Asset = {
      name: 'sWaves',
      description: '',
      quantity: 1,
      decimals: 8,
      assetId: String(await getDataValue(tokenizedStake, 'ASSET', env.network))
    };
    await step('reset states', async () => {
      await setSignedContext(
        adapter,
        {
          data: [
            { key: 'FEE', type: 'integer', value: 0 },
            { key: 'LAST_CLAIM', type: 'integer', value: await getBlockHeight(0, env.network) - 2 * initData.rewardHeight }
          ]
        }
      );
      await setSignedContext(
        tokenizedStake,
        {
          data: [
            { key: 'LAST_RATE', type: 'integer', value: PERCENT_FACTOR },
            { key: 'CURRENT_RATE', type: 'integer', value: 0 },
            { key: 'LAST_HEIGHT', type: 'integer', value: 0 },
            { key: 'TARGET_HEIGHT', type: 'integer', value: 0 },
          ]
        }
      );
    });
    await step('set empty leasing node balance', async () => {
      const leasingBalance = await getBalance(node.dApp, env.network);
      if(leasingBalance > 0) {
        await signedTransfer({
          address: node.dApp,
          publicKey: node.publicKey,
          privateKey: node.privateKey
        },
        techUser.address,
        await getBalance(node.dApp, env.network) - env.network.transferFee
        );
      }
      expect(
        await getBalance(node.dApp, env.network)
      ).to.be.equal(0);
    });
    const assetData = await getAssetInfo(sWaves.assetId);
    const assetDataQty = parseInt(assetData.quantity.toString());
    const startUserBalance = await getBalance(user.address, env.network);
    const startUserSWBalance = await getAssetBalance(sWaves, user, env.network);
    const startUser2Balance = await getBalance(user2.address, env.network);
    const startUser2SWBalance = await getAssetBalance(sWaves, user2, env.network);
    const startUser3Balance = await getBalance(user3.address, env.network);
    const startUser3SWBalance = await getAssetBalance(sWaves, user3, env.network);
    const startManagerBalance = await getBalance(manager.address, env.network);
    const startAdapterBalance = await getBalance(adapter.dApp, env.network);
    const startTokenizedBalance = await getBalance(tokenizedStake.dApp, env.network);
    await step('deposit WAVESes by 1st user', async () => {
      await deposit(depoAmount, user.privateKey);
    });
    const depoRates = depositRates(
      PERCENT_FACTOR,
      0,
      depoAmount,
      {
        prev_start_block: 0,
        prev_finish_block: 0,
        last_block: 1
      },
      assetDataQty
    );
    await step('check intermediate state (first depo)', async () => {
      // tokenized: LAST_RATE, CURRENT_RATE
      await setInt(techContract, techUser, depoRates.last_rate);
      expect(
        await getDataValue(tokenizedStake, 'LAST_RATE', env.network)
      ).to.be.equal(
        await getDataValue(techContract, 'BINARY_INT', env.network)
      );
      await setInt(techContract, techUser, depoRates.current_rate);
      expect(
        await getDataValue(tokenizedStake, 'CURRENT_RATE', env.network)
      ).to.be.equal(
        await getDataValue(techContract, 'BINARY_INT', env.network)
      );
    });
    await step('recharge leasing node balance for reward', async () => {
      await transfer(
        {
          recipient: node.dApp,
          assetId: null,
          amount: reward
        },
        techUser.privateKey,
        env.network
      );
      expect(
        await getBalance(node.dApp, env.network)
      ).to.be.equal(reward);
    });
    await step('claim reward with checkpoint', async () => {
      await checkpoint(user2.privateKey);
    });
    const rewardRates = commitStakingRates(
      depoRates.last_rate,
      depoRates.current_rate,
      0,
      reward - infraFee - env.network.invokeFee,
      initData.rewardHeight,
      assetDataQty + depoRates.sw_deposit
    );
    await step('check intermediate state (checkpoint)', async () => {
      // tokenized: LAST_RATE, CURRENT_RATE
      await setInt(techContract, techUser, rewardRates.last_rate);
      expect(
        await getDataValue(tokenizedStake, 'LAST_RATE', env.network)
      ).to.be.equal(
        await getDataValue(techContract, 'BINARY_INT', env.network)
      );
      await setInt(techContract, techUser, rewardRates.current_rate);
      expect(
        await getDataValue(tokenizedStake, 'CURRENT_RATE', env.network)
      ).to.be.equal(
        await getDataValue(techContract, 'BINARY_INT', env.network)
      );
    });
    await step('wait 2 blocks', async () => {
      await waitHeight(env.network.nodeAPI, await getBlockHeight(2, env.network));
    });
    let lastBlock = Number(await getDataValue(tokenizedStake, 'LAST_HEIGHT', env.network));
    let targetBlock = Number(await getDataValue(tokenizedStake, 'TARGET_HEIGHT', env.network));
    await step('deposit WAVESes by 2nd user', async () => {
      await deposit(depoAmount2, user2.privateKey);
    });
    const depo2Rates = depositRates(
      rewardRates.last_rate,
      rewardRates.current_rate,
      depoAmount2,
      {
        prev_start_block: lastBlock,
        prev_finish_block: targetBlock,
        last_block: Number(await getDataValue(tokenizedStake, 'LAST_HEIGHT', env.network))
      },
      assetDataQty + depoRates.sw_deposit
    );
    await step('check intermediate state (depo2)', async () => {
      // tokenized: LAST_RATE, CURRENT_RATE
      await setInt(techContract, techUser, depo2Rates.last_rate);
      expect(
        await getDataValue(tokenizedStake, 'LAST_RATE', env.network)
      ).to.be.equal(
        await getDataValue(techContract, 'BINARY_INT', env.network)
      );
      await setInt(techContract, techUser, depo2Rates.current_rate);
      expect(
        await getDataValue(tokenizedStake, 'CURRENT_RATE', env.network)
      ).to.be.equal(
        await getDataValue(techContract, 'BINARY_INT', env.network)
      );
    });
    await step('await times for expire reward (2 blocks, for example)', async () => {
      await waitHeight(env.network.nodeAPI, await getBlockHeight(2, env.network));
    });
    await stepIgnoreErrorByMessage(
      'withdraw 1st user\'s funds with no-sWAVESes',
      'Error while executing dApp: withdraw: payment is not in correct asset',
      async () => {
        const USDN = this.parent?.ctx.assets.filter((a: Asset) => a.name == 'USDN')[0];
        await withdraw(
          await getAssetBalance(USDN, user, env.network),
          USDN.assetId,
          user.privateKey
        );
      }
    );
    await step('change balance on leasing node', async () => {
      await transfer(
        {
          recipient: node.dApp,
          assetId: null,
          amount: reward
        },
        techUser.privateKey,
        env.network
      );
      expect(
        await getBalance(node.dApp, env.network)
      ).to.be.equal(reward);
    });
    lastBlock = await getBlockHeight(0, env.network) - 10;
    targetBlock = lastBlock + 7;
    await step('set state for claiming', async () => {
      await setSignedContext(
        adapter,
        {
          data: [
            { key: 'LAST_CLAIM', type: 'integer', value: await getBlockHeight(0, env.network) - 2 * initData.rewardHeight }
          ]
        }
      );
      await setSignedContext(
        tokenizedStake,
        {
          data: [
            { key: 'LAST_HEIGHT', type: 'integer', value: lastBlock },
            { key: 'TARGET_HEIGHT', type: 'integer', value: targetBlock }
          ]
        }
      );
    });
    const wdAmount = depoRates.sw_deposit;
    await step('withdraw 1st user\'s funds with sWAVESes (with auto-claim)', async () => {
      await withdraw(
        wdAmount,
        sWaves.assetId,
        user.privateKey
      );
    });
    const stakeRates = commitStakingRates(
      depo2Rates.last_rate,
      depo2Rates.current_rate,
      targetBlock - lastBlock,
      reward - infraFee,
      initData.rewardHeight,
      assetDataQty + depoRates.sw_deposit + depo2Rates.sw_deposit
    );
    const wdRates = withdrawRates(
      stakeRates.last_rate,
      stakeRates.current_rate,
      wdAmount,
      {
        prev_start_block: 1,
        prev_finish_block: 1 + initData.rewardHeight,
        last_block: 1
      },
      assetDataQty + depoRates.sw_deposit + depo2Rates.sw_deposit
    );
    await step('check intermediate state (withdraw1)', async () => {
      // tokenized: LAST_RATE, CURRENT_RATE
      await setInt(techContract, techUser, wdRates.last_rate);
      expect(
        await getDataValue(tokenizedStake, 'LAST_RATE', env.network)
      ).to.be.equal(
        await getDataValue(techContract, 'BINARY_INT', env.network)
      );
      await setInt(techContract, techUser, wdRates.current_rate);
      expect(
        await getDataValue(tokenizedStake, 'CURRENT_RATE', env.network)
      ).to.be.equal(
        await getDataValue(techContract, 'BINARY_INT', env.network)
      );
    });
    await step('wait 1 block', async () => {
      await waitHeight(env.network.nodeAPI, await getBlockHeight(1, env.network));
    });
    lastBlock = Number(await getDataValue(tokenizedStake, 'LAST_HEIGHT', env.network));
    targetBlock = Number(await getDataValue(tokenizedStake, 'TARGET_HEIGHT', env.network));
    await step('deposit WAVESes by 3nd user', async () => {
      await deposit(depoAmount3, user3.privateKey);
    });
    const depo3Rates = depositRates(
      wdRates.last_rate,
      wdRates.current_rate,
      depoAmount3,
      {
        prev_start_block:lastBlock,
        prev_finish_block:targetBlock,
        last_block: Number(await getDataValue(tokenizedStake, 'LAST_HEIGHT', env.network))
      },
      assetDataQty + depoRates.sw_deposit + depo2Rates.sw_deposit - wdAmount
    );
    await step('check intermediate state (depo3)', async () => {
      // tokenized: LAST_RATE, CURRENT_RATE
      await setInt(techContract, techUser, depo3Rates.last_rate);
      expect(
        await getDataValue(tokenizedStake, 'LAST_RATE', env.network)
      ).to.be.equal(
        await getDataValue(techContract, 'BINARY_INT', env.network)
      );
      await setInt(techContract, techUser, depo3Rates.current_rate);
      expect(
        await getDataValue(tokenizedStake, 'CURRENT_RATE', env.network)
      ).to.be.equal(
        await getDataValue(techContract, 'BINARY_INT', env.network)
      );
    });
    await step('wait 2 blocks', async () => {
      await waitHeight(env.network.nodeAPI, await getBlockHeight(2, env.network));
    });
    const wdAmount2 = Math.floor(await getAssetBalance(sWaves, user2, env.network) * 0.8);
    lastBlock = Number(await getDataValue(tokenizedStake, 'LAST_HEIGHT', env.network));
    targetBlock = Number(await getDataValue(tokenizedStake, 'TARGET_HEIGHT', env.network));
    await step('withdraw 2st user\'s funds with sWAVESes', async () => {
      await withdraw(
        wdAmount2,
        sWaves.assetId,
        user2.privateKey
      );
    });
    const wd2Rates = withdrawRates(
      depo3Rates.last_rate,
      depo3Rates.current_rate,
      wdAmount2,
      {
        prev_start_block: lastBlock,
        prev_finish_block: targetBlock,
        last_block: Number(await getDataValue(tokenizedStake, 'LAST_HEIGHT', env.network))
      },
      assetDataQty + depoRates.sw_deposit + depo2Rates.sw_deposit - wdAmount + depo3Rates.sw_deposit
    );
    await step('check state', async () => {
      // tokenized: LAST_RATE, CURRENT_RATE
      await setInt(techContract, techUser, wd2Rates.last_rate);
      expect(
        await getDataValue(tokenizedStake, 'LAST_RATE', env.network)
      ).to.be.equal(
        await getDataValue(techContract, 'BINARY_INT', env.network)
      );
      await setInt(techContract, techUser, wd2Rates.current_rate);
      expect(
        await getDataValue(tokenizedStake, 'CURRENT_RATE', env.network)
      ).to.be.equal(
        await getDataValue(techContract, 'BINARY_INT', env.network)
      );
    });
    await step('check balances', async () => {
      // user1
      expect(
        await getBalance(user.address, env.network)
      ).to.be.equal(startUserBalance - depoAmount + wdRates.withdraw - 2 * env.network.invokeFee);
      expect(
        await getAssetBalance(sWaves, user, env.network)
      ).to.be.equal(startUserSWBalance);
      // user2
      expect(
        await getBalance(user2.address, env.network)
      ).to.be.equal(startUser2Balance - depoAmount2 + wd2Rates.withdraw - 2 * env.network.invokeFee);
      expect(
        await getAssetBalance(sWaves, user2, env.network)
      ).to.be.equal(startUser2SWBalance + depo2Rates.sw_deposit - wdAmount2);
      // user3
      expect(
        await getBalance(user3.address, env.network)
      ).to.be.equal(startUser3Balance - depoAmount3 - env.network.invokeFee);
      expect(
        await getAssetBalance(sWaves, user3, env.network)
      ).to.be.equal(startUser3SWBalance + depo3Rates.sw_deposit);
      // manager
      expect(
        await getBalance(manager.address, env.network)
      ).to.be.equal(startManagerBalance + 2 * infraFee);
      // leasing node
      expect(
        await getBalance(node.dApp, env.network)
      ).to.be.equal(0);
      // adapter
      expect(
        await getBalance(adapter.dApp, env.network)
      ).to.be.equal(startAdapterBalance + depoAmount + depoAmount2 + depoAmount3 + 2 * reward - 2 * infraFee - 2 * env.network.invokeFee - wdRates.withdraw - wd2Rates.withdraw);
      // tokenizer
      expect(
        await getBalance(tokenizedStake.dApp, env.network)
      ).to.be.equal(startTokenizedBalance - env.network.invokeFee);
    });
  });

  it('sponsorship checking', async () => {
    const sponsorshipMgr = getContractByName('sponsorship_manager', this.parent?.ctx);
    const tokenized = getContractByName('tokenized_staking', this.parent?.ctx);
    const manager = getAccountByName('manager', this.parent?.ctx);
    const user1 = getAccountByName('neo', this.parent?.ctx);
    const user2 = getAccountByName('morpheus', this.parent?.ctx);
    const techUser = getAccountByName('tech_acc', this.parent?.ctx);
    const depoAmt = 1366000000;
    const transferAmt = 66130000;
    const minAssetFee = 100000;
    const transferAssetFee = 500000;
    const initBalance = await getBalance(tokenized.dApp, env.network);
    await step('set sponsorship manager', async () => {
      await setSponsorshipManager(sponsorshipMgr.dApp);
    });
    await step('setup sponsorship', async () => {
      await setupSponsorship(
        base58Encode(tokenized.dApp),
        minAssetFee,
        initBalance,
        initBalance,
        base58Encode(manager.address)
      );
    });
    await step('deposit', async () => {
      await deposit(depoAmt, user1.privateKey);
    });
    const sWaves: Asset = {
      name: 'sWaves',
      description: '',
      quantity: 1,
      decimals: 8,
      assetId: String(await getDataValue(tokenized, 'ASSET', env.network))
    };
    let user1balance = await getBalance(user1.address, env.network);
    const user2balance = await getBalance(user2.address, env.network);
    let user1balanceSw = await getAssetBalance(sWaves, user1, env.network);
    const user2balanceSw = await getAssetBalance(sWaves, user2, env.network);
    let tokenizedBalance = await getBalance(tokenized.dApp, env.network);
    let tokenizedBalanceSw = await getAssetContractBalance(sWaves, tokenized, env.network);
    await step('transfer money between users', async () => {
      await transfer(
        {
          recipient: user2.address,
          amount: transferAmt,
          feeAssetId: sWaves.assetId,
          fee: minAssetFee
        },
        user1.privateKey,
        env.network
      );
    });
    await step('check balances', async () => {
      expect(await getBalance(user1.address, env.network)).to.be.equal(user1balance - transferAmt);
      expect(await getBalance(user2.address, env.network)).to.be.equal(user2balance + transferAmt);
      expect(await getAssetBalance(sWaves, user1, env.network)).to.be.equal(user1balanceSw - minAssetFee);
      expect(await getAssetBalance(sWaves, user2, env.network)).to.be.equal(user2balanceSw);
      expect(await getBalance(tokenized.dApp, env.network)).to.be.equal(tokenizedBalance - env.network.transferFee);
      expect(await getAssetContractBalance(sWaves, tokenized, env.network)).to.be.equal(tokenizedBalanceSw + minAssetFee);
    });
    user1balance = await getBalance(user1.address, env.network);
    user1balanceSw = await getAssetBalance(sWaves, user1, env.network);
    tokenizedBalance = await getBalance(tokenized.dApp, env.network);
    tokenizedBalanceSw = await getAssetContractBalance(sWaves, tokenized, env.network);
    await step('deposit with sWAVES fee', async () => {
      const tx = prepareInvokeTx({
        dApp: tokenized.dApp,
        call: {
          function: 'deposit'
        },
        feeAssetId: sWaves.assetId,
        payment: [{ assetId: null, amount: depoAmt }]
      },
      user1.privateKey);
      await broadcast(tx, env.network.nodeAPI);
      const txMined = await waitForTx(tx.id, {
        apiBase: env.network.nodeAPI,
        timeout: env.network.nodeTimeout,
      });
      if(txMined.applicationStatus !== 'succeeded') {
        throw new Error('Transaction failed!');
      }
    });
    await step('check balances', async () => {
      expect(await getBalance(user1.address, env.network)).to.be.equal(user1balance - depoAmt);
      expect(await getBalance(tokenized.dApp, env.network)).to.be.equal(tokenizedBalance - env.network.invokeFee);
      expect(await getAssetContractBalance(sWaves, tokenized, env.network)).to.be.equal(tokenizedBalanceSw + transferAssetFee);
    });
    tokenizedBalance = await getBalance(tokenized.dApp, env.network);
    tokenizedBalanceSw = await getAssetContractBalance(sWaves, tokenized, env.network);
    const managerBalance = await getBalance(manager.address, env.network);
    const techUserBalance = await getBalance(techUser.address, env.network);
    await step('checkpointSponsorship', async () => {
      await checkpointSponsorship(tokenized.dApp, techUser.privateKey);
    });
    await step('check balances', async () => {
      expect(await getBalance(tokenized.dApp, env.network)).to.be.equal(initBalance);
      expect(await getAssetContractBalance(sWaves, tokenized, env.network)).to.be.equal(0);
      expect(managerBalance).is.lessThanOrEqual(await getBalance(manager.address, env.network));
      expect(await getBalance(techUser.address, env.network)).to.be.equal(techUserBalance - env.network.invokeFee);
    });
  });
});