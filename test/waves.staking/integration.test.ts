import { getAccountByName } from '../../utils/accounts';
import { getContractByName } from '../../utils/contracts';
import { step, stepIgnoreErrorByMessage } from 'relax-steps-allure';
import {
    init,
    resetStakeState,
    sendDeposit,
    setAsset,
    setInt,
    setLeaseAmount,
    setLeaseNode,
    setStakeState,
    stake,
    withdraw
} from '../../steps/waves.staking';
import { expect } from 'chai';
import {
    getAssetBalance,
    getBalance,
    getDataValue,
    getLastLiquidationBlock,
    liqBlockWaiting
} from '../../utils/common';
import { getEnvironment } from 'relax-env-json';
import { invoke } from '../../utils/transaction';
import { Asset, getAssetByName } from '../../utils/assets';
const env = getEnvironment();

/**
 * MEMO:        1) Total depo value must be less than 92 233 720 368 WAVES
 */
describe('Waves staking integration tests', function() {
    it('check deposit after last reward block and rate changes (2 depo)', async () => {
        const contract = getContractByName('waves_staking', this.parent?.ctx);
        const techContract = getContractByName('technical', this.parent?.ctx);
        const techAcc = getAccountByName('trinity', this.parent?.ctx);
        const user = getAccountByName('neo', this.parent?.ctx);
        const user2 = getAccountByName('thomas', this.parent?.ctx);
        const node = getAccountByName('lease_node_1', this.parent?.ctx);
        const deposit = 1300000000;
        const deposit2 = 6613000000;
        const rewardHeight = 10;
        const rewardAmt = 1000000000;
        await step('reset state', async () => {
            await resetStakeState(contract);
            await setLeaseAmount(contract, 0);
        });
        await step('reinit asset', async () => {
            await setAsset(contract, '');
            await init(contract, getAccountByName('trinity', this.parent?.ctx));
        });
        const sWaves: Asset = {
            name: 'sWaves',
            description: '',
            quantity: deposit,
            decimals: 8,
            assetId: await getDataValue(contract, 'ASSET')
        };
        const startSWUser2Balance = await getAssetBalance(sWaves, user2);
        await step('set lease node address', async () => {
            await setLeaseNode(contract, node.address);
        });
        await step('send deposit', async () => {
            await sendDeposit(
                contract,
                user,
                [
                    { assetId: null, amount: deposit }
                ]
            );
        });
        let lastBlock = await getLastLiquidationBlock(0);
        await step('set test state condition', async () => {
            await setStakeState(contract, null, null, null, lastBlock, lastBlock);
        });
        await step('first stake for state setting', async () => {
            await stake(
                contract,
                node,
                [
                    { type: 'integer', value: rewardHeight }
                ],
                [
                    { assetId: null, amount: rewardAmt }
                ]
            );
        });
        lastBlock = await getLastLiquidationBlock(0);
        await step('set test state condition', async () => {
            await setStakeState(contract, null, null, null, lastBlock - 3, lastBlock - 1);
        });
        lastBlock = await getLastLiquidationBlock(0);
        await step('test stake', async () => {
            await stake(
                contract,
                node,
                [
                    { type: 'integer', value: rewardHeight }
                ],
                [
                    { assetId: null, amount: rewardAmt }
                ]
            );
        });
        lastBlock = await getLastLiquidationBlock(0);
        await step('set test state condition', async () => {
            await setStakeState(contract, null, null, null, lastBlock - 3, lastBlock - 1);
        });
        const prevCurrRate =  Math.floor(rewardAmt * 1000000000000 / (deposit * rewardHeight));
        const lastRate = Math.floor(1000000000000 + 2 * prevCurrRate);
        const currRate = Math.floor(rewardAmt * 1000000000000 / (deposit * rewardHeight));
        // const lastRateUpdated = lastRate + currRate * (withdrawBlock - await getDataValue(contract, 'LAST_HEIGHT'));
        // const rewardWithdraw = Math.floor(withdrawAmt * lastRateUpdated / 1000000000000);
        await step('deposit from other user', async () => {
            await sendDeposit(contract, user2, [{ assetId: null, amount: deposit2 }]);
        });
        const lastRateUpd = lastRate + currRate * 2;
        const issueAmt = Math.floor(deposit2 * 1000000000000 / lastRateUpd);
        const currRateUpd = Math.floor(currRate * deposit / (deposit + issueAmt));
        await step('check user\'s sWaves', async () => {
            expect(
                await getAssetBalance(sWaves, user2)
            ).to.be.equal(startSWUser2Balance + issueAmt);
        });
        await step('check state', async () => {
            expect(await getDataValue(contract, 'TOTAL_DEPOSIT'))
                .to.be.equal(deposit + deposit2);
            await setInt(techContract, techAcc, lastRateUpd);
            expect(await getDataValue(contract, 'LAST_RATE'))
                .to.be.equal(await getDataValue(techContract, 'BINARY_INT'));
            await setInt(techContract, techAcc, currRateUpd);
            expect(await getDataValue(contract, 'CURRENT_RATE'))
                .to.be.equal(await getDataValue(techContract, 'BINARY_INT'));
            expect(await getDataValue(contract, 'LAST_HEIGHT'))
                .to.be.equal(await getDataValue(contract, 'TARGET_HEIGHT'));
            expect(await getDataValue(contract, 'LEASE_AMOUNT'))
                .to.be.equal(deposit + 2 * rewardAmt + deposit2);
        });
        await step('another deposit from other user', async () => {
            await sendDeposit(contract, user2, [{ assetId: null, amount: deposit2 }]);
        });
        await step('another check user\'s sWaves', async () => {
            expect(
                await getAssetBalance(sWaves, user2)
            ).to.be.equal(startSWUser2Balance + 2 * issueAmt);
        });
        await step('another check state', async () => {
            expect(await getDataValue(contract, 'TOTAL_DEPOSIT'))
                .to.be.equal(deposit + 2 * deposit2);
            await setInt(techContract, techAcc, lastRateUpd);
            expect(await getDataValue(contract, 'LAST_RATE'))
                .to.be.equal(await getDataValue(techContract, 'BINARY_INT'));
            const currRateUpd2 = Math.floor(currRateUpd * (deposit + issueAmt) / (deposit + 2 * issueAmt));
            await setInt(techContract, techAcc, currRateUpd2);
            expect(await getDataValue(contract, 'CURRENT_RATE'))
                .to.be.equal(await getDataValue(techContract, 'BINARY_INT'));
            expect(await getDataValue(contract, 'LAST_HEIGHT'))
                .to.be.equal(await getDataValue(contract, 'TARGET_HEIGHT'));
            expect(await getDataValue(contract, 'LEASE_AMOUNT'))
                .to.be.equal(deposit + 2 * rewardAmt + 2 * deposit2);
        });
    });

    it('new user can withdraw immediately after staking without reward', async () => {
        const contract = getContractByName('waves_staking', this.parent?.ctx);
        const user = getAccountByName('neo', this.parent?.ctx);
        const user2 = getAccountByName('thomas', this.parent?.ctx);
        const node = getAccountByName('lease_node_1', this.parent?.ctx);
        const deposit = 1300000000;
        const deposit2 = 6613000000;
        const rewardHeight = 10;
        const rewardAmt = 1000000000;
        await step('reset state', async () => {
            await resetStakeState(contract);
            await setLeaseAmount(contract, 0);
        });
        await step('reinit asset', async () => {
            await setAsset(contract, '');
            await init(contract, getAccountByName('trinity', this.parent?.ctx));
        });
        const sWaves: Asset = {
            name: 'sWaves',
            description: '',
            quantity: deposit,
            decimals: 8,
            assetId: await getDataValue(contract, 'ASSET')
        };
        const startUser2Balance = await getBalance(user2.address);
        await step('set lease node address', async () => {
            await setLeaseNode(contract, node.address);
        });
        await step('send deposit', async () => {
            await sendDeposit(
                contract,
                user,
                [
                    { assetId: null, amount: deposit }
                ]
            );
        });
        let lastBlock = await getLastLiquidationBlock(0);
        await step('set test state condition', async () => {
            await setStakeState(contract, null, null, null, lastBlock, lastBlock);
        });
        await step('first stake for state setting', async () => {
            await stake(
                contract,
                node,
                [
                    { type: 'integer', value: rewardHeight }
                ],
                [
                    { assetId: null, amount: rewardAmt }
                ]
            );
        });
        lastBlock = await getLastLiquidationBlock(0);
        await step('set test state condition', async () => {
            await setStakeState(contract, null, null, null, lastBlock - 3, lastBlock - 1);
        });
        lastBlock = await getLastLiquidationBlock(0);
        await step('test stake', async () => {
            await stake(
                contract,
                node,
                [
                    { type: 'integer', value: rewardHeight }
                ],
                [
                    { assetId: null, amount: rewardAmt }
                ]
            );
        });
        lastBlock = await getLastLiquidationBlock(0);
        await step('set test state condition', async () => {
            await setStakeState(contract, null, null, null, lastBlock - 3, lastBlock - 1);
        });
        const prevCurrRate =  Math.floor(rewardAmt * 1000000000000 / (deposit * rewardHeight));
        const lastRate = Math.floor(1000000000000 + 2 * prevCurrRate);
        const currRate = Math.floor(rewardAmt * 1000000000000 / (deposit * rewardHeight));
        const lastRateUpd = lastRate + currRate * 2;
        const issueAmt = Math.floor(deposit2 * 1000000000000 / lastRateUpd);
        // const lastRateUpdated = lastRate + currRate * (withdrawBlock - await getDataValue(contract, 'LAST_HEIGHT'));
        // const rewardWithdraw = Math.floor(withdrawAmt * lastRateUpdated / 1000000000000);
        await step('deposit from other user', async () => {
            await sendDeposit(contract, user2, [{ assetId: null, amount: deposit2 }]);
        });
        await step('withdraw of 2nd user', async () => {
            await withdraw(contract, user2, sWaves.assetId, issueAmt);
        });
        await step('check user\'s balance', async () => {
            expect(
                startUser2Balance - 2 * env.network.WavesInvokeFee - await getBalance(user2.address)
            ).to.be.lessThanOrEqual(1); // error rate
        });
    });

    // TODO: REFACTOR IT!!!
    xit('check rewards calculate with consecutive staking and withdraw between stakes', async () => {
        const contract = getContractByName('waves_staking', this.parent?.ctx);
        const techContract = getContractByName('technical', this.parent?.ctx);
        const techAcc = getAccountByName('trinity', this.parent?.ctx);
        const user = getAccountByName('neo', this.parent?.ctx);
        const user2 = getAccountByName('thomas', this.parent?.ctx);
        const node = getAccountByName('lease_node_1', this.parent?.ctx);
        const deposit = 1300000000;
        const rewardHeight = 10;
        const rewardAmt = 1000000000;
        const withdrawAmt = 660000000;
        await step('reset state', async () => {
            await resetStakeState(contract);
            await setLeaseAmount(contract, 0);
        });
        await step('reinit asset', async () => {
            await setAsset(contract, '');
            await init(contract, getAccountByName('trinity', this.parent?.ctx));
        });
        const sWaves: Asset = {
            name: 'sWaves',
            description: '',
            quantity: deposit,
            decimals: 8,
            assetId: await getDataValue(contract, 'ASSET')
        };
        const startSWUser2Balance = await getAssetBalance(sWaves, user2);
        await step('set lease node address', async () => {
            await setLeaseNode(contract, node.address);
        });
        await step('send deposit', async () => {
            await sendDeposit(
                contract,
                user,
                [
                    { assetId: null, amount: 1 }
                ]
            );
        });
        let lastBlock = await getLastLiquidationBlock(0);
        await step('set test state condition', async () => {
            await setStakeState(contract, null, null, null, lastBlock, lastBlock);
        });
        await step('zero stake', async () => {
            await stake(
                contract,
                node,
                [
                    { type: 'integer', value: rewardHeight }
                ],
                [
                    { assetId: null, amount: 1 }
                ]
            );
        });
        await step('send deposit', async () => {
            await sendDeposit(
                contract,
                user,
                [
                    { assetId: null, amount: deposit }
                ]
            );
        });
        lastBlock = await getLastLiquidationBlock(0);
        await step('set test state condition', async () => {
            await setStakeState(contract, null, null, null, lastBlock, lastBlock);
        });
        await step('zero stake', async () => {
            await stake(
                contract,
                node,
                [
                    { type: 'integer', value: rewardHeight }
                ],
                [
                    { assetId: null, amount: 1 }
                ]
            );
        });
        await step('partial withdraw', async () => {
            await withdraw(contract, user, sWaves.assetId, withdrawAmt);
        });
        await step('wait 1 block', async () => {
            await liqBlockWaiting(await getLastLiquidationBlock(0));
        });
        await step('another stake', async () => {
            await stake(
                contract,
                node,
                [
                    { type: 'integer', value: rewardHeight }
                ],
                [
                    { assetId: null, amount: rewardAmt }
                ]
            );
        });
        const prevCurrRate =  Math.floor(rewardAmt * 1000000000000 / (deposit * rewardHeight));
        const lastRate = Math.floor(1000000000000 + 2 * prevCurrRate);
        const currRate = Math.floor(rewardAmt * 1000000000000 / (deposit * rewardHeight));
        await step('another check rates', async () => {});
    });

    // TODO: stress test with too many deposites, stakes and with draws
});