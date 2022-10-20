import { getAccountByName } from '../../utils/accounts';
import { getContractByName } from '../../utils/contracts';
import { step, stepIgnoreErrorByMessage } from 'relax-steps-allure';
import { 
    resetAccountDepo,
    resetStakeState,
    sendDeposit,
    setLeaseNode,
    setLiquidDepo,
    setTotalLiquidSupply,
    stake,
    withdraw
} from '../../steps/waves.staking.old';
import { expect } from 'chai';
import { getBalance, getDataValue } from '../../utils/common';
import { getEnvironment } from 'relax-env-json';
import { invoke } from '../../utils/transaction';
const env = getEnvironment();

/**
 * MEMO:        1) why needed and used LEASE_ID? for futures unleasings
 *              2) how can I manipulate with ACCOUNT_DEPOSIT__ or ACCOUNT_BALANCE__??? changing only on deposit and withdraw
 *              3) how I can calculate LEASE_ID? - it's so difficult in tests, best way is use @Callable deposit directly
 * 
 * BUGS:        2) can't stake with error "stake: zero total supply"
 *              3) can't empty user's balance checking
 * 
 * FIXED:       1) can't withdraw immediately after deposit
 */
describe('Waves staking', function() {
    describe('Init tests', function() {
        it('check that init been correctly', async () => {
            const contract = getContractByName('waves_staking', this.parent?.ctx);
            await step('check PERCENTS_LAST_IDX', async () => {
                expect(
                    await getDataValue(contract, 'PERCENTS_LAST_IDX')
                ).to.be.equal(1);
            });
            await step('check PERCENTS__0', async () => {
                expect(await getDataValue(contract, 'PERCENTS__0')).to.be.equal('base64:AOjUpRAA');
            });
        });

        it('should throw when try to re-init contract', async () => {
            const contract = getContractByName('waves_staking', this.parent?.ctx);
            const user = getAccountByName('trinity', this.parent?.ctx);
            await stepIgnoreErrorByMessage('try to re-init', 'Error while executing account-script: init: already initialized', async () => {
                await invoke(
                    {
                        dApp: contract.dApp,
                        call: { function: 'init' }
                    },
                    user.privateKey
                );
            });
        });
    });

    describe('Deposit tests', function() {
        it('simple positive', async () => {
            const contract = getContractByName('waves_staking', this.parent?.ctx);
            const user = getAccountByName('neo', this.parent?.ctx);
            const amount = 13000000;
            const startBalance = await getBalance(user.address);
            await step('set lease node address', async () => {
                await resetStakeState(contract);
                await resetAccountDepo(contract, user);
                await setLeaseNode(contract, getAccountByName('lease_node_1', this.parent?.ctx).address);
            });
            await step('deposit to contract', async () => {
                await sendDeposit(
                    contract,
                    user,
                    [
                        {
                            assetId: null,
                            amount: amount
                        }
                    ]
                );
            });
            await step('check LIQUID_DEPOSIT', async () => {
                expect(await getDataValue(contract, 'LIQUID_DEPOSIT')).to.be.equal(amount);
            });
            await step('check ACCOUNT_DEPOSIT__', async () => {
                expect(
                    await getDataValue(contract, `ACCOUNT_DEPOSIT__${user.address}`)
                ).to.be.equal(amount);
            });
            await step('check LEASE_AMOUNT', async () => {
                expect(await getDataValue(contract, 'LEASE_AMOUNT')).to.be.equal(amount);
            });
            await step('check user balance', async () => {
                expect(
                    await getBalance(user.address)
                ).to.be.equal(startBalance - amount - env.network.WavesInvokeFee);
            });
        });
        
        it('should throw when no payments', async () => {
            const contract = getContractByName('waves_staking', this.parent?.ctx);
            const user = getAccountByName('neo', this.parent?.ctx);
            stepIgnoreErrorByMessage('send deposit with empty payment', 'deposit: no payments', async () => {
                await sendDeposit(
                    contract,
                    user,
                    []
                );
            });
        });

        it('should throw when token is not WAVES', async () => {
            const contract = getContractByName('waves_staking', this.parent?.ctx);
            const user = getAccountByName('neo', this.parent?.ctx);
            stepIgnoreErrorByMessage('send deposit with empty payment', 'deposit: payment is not waves', async () => {
                await sendDeposit(
                    contract,
                    user,
                    [
                        {
                            assetId: 'WETH',
                            amount: 1366
                        }
                    ]
                );
            });
        });

        it('should throw when amount = 0', async () => {
            const contract = getContractByName('waves_staking', this.parent?.ctx);
            const user = getAccountByName('neo', this.parent?.ctx);
            stepIgnoreErrorByMessage('send deposit with empty payment', 'deposit: invalid payment amount', async () => {
                await sendDeposit(
                    contract,
                    user,
                    [
                        {
                            assetId: null,
                            amount: 0
                        }
                    ]
                );
            });
        });

        it('should throw when no set leaseNodeAddress', async () => {
            const contract = getContractByName('waves_staking', this.parent?.ctx);
            const user = getAccountByName('neo', this.parent?.ctx);
            await step('reset state', async () => {
                await setLeaseNode(contract, '');
            });
            stepIgnoreErrorByMessage('send deposit with empty payment', 'getLeaseNode: no lease node address', async () => {
                await sendDeposit(
                    contract,
                    user,
                    [
                        {
                            assetId: null,
                            amount: 1366
                        }
                    ]
                );
            });
        });

        it('can deposit with many payments', async () => {
            const contract = getContractByName('waves_staking', this.parent?.ctx);
            const user = getAccountByName('neo', this.parent?.ctx);
            const amount = 13000000;
            const secAmount = 66000000;
            const thirdAmount = 32109876;
            const startBalance = await getBalance(user.address);
            await step('set lease node address', async () => {
                await resetStakeState(contract);
                await resetAccountDepo(contract, user);
                await setLeaseNode(contract, await getAccountByName('lease_node_1', this.parent?.ctx).address);
            });
            await step('deposit to contract', async () => {
                await sendDeposit(
                    contract,
                    user,
                    [
                        {
                            assetId: null,
                            amount: amount
                        },
                        {
                            assetId: null,
                            amount: secAmount
                        },
                        {
                            assetId: null,
                            amount: thirdAmount
                        }
                    ]
                );
            });
            await step('check LIQUID_DEPOSIT', async () => {
                expect(await getDataValue(contract, 'LIQUID_DEPOSIT')).to.be.equal(amount);
            });
            await step('check ACCOUNT_DEPOSIT__', async () => {
                expect(
                    await getDataValue(contract, `ACCOUNT_DEPOSIT__${user.address}`)
                ).to.be.equal(amount);
            });
            await step('check LEASE_AMOUNT', async () => {
                expect(await getDataValue(contract, 'LEASE_AMOUNT')).to.be.equal(amount);
            });
            await step('check user balance', async () => {
                expect(
                    await getBalance(user.address)
                ).to.be.equal(startBalance - amount - secAmount - thirdAmount - env.network.WavesInvokeFee);
            });
        });

        // [PARAMETRIZED] check change account deposit, reward ID and balance
    });

    describe('Stake tests', function() {
        it('simple positive', async () => {
            const contract = getContractByName('waves_staking', this.parent?.ctx);
            const node = getAccountByName('lease_node_1', this.parent?.ctx);
            const reward = 123;
            await step('reset state', async () => {
                await resetStakeState(contract);
                await setLeaseNode(contract, node.address);
            });
            await step('call stake function', async () => {
                await stake(
                    contract,
                    node,
                    [
                        { type: 'integer', value: reward }
                    ]
                );
            });
            await step('check LIQUID_TOTAL_SUPPLY', async () => {
                expect(
                    await getDataValue(contract, 'LIQUID_TOTAL_SUPPLY')
                ).to.be.equal(0);
            });
            await step('check LIQUID_DEPOSIT', async () => {
                expect(
                    await getDataValue(contract, 'LIQUID_DEPOSIT')
                ).to.be.equal(0);
            });
            await step('check PERCENTS_LAST_IDX', async () => {
                expect(
                    await getDataValue(contract, 'PERCENTS_LAST_IDX')
                ).to.be.equal(1);
            });
            // await step('check PERCENTS__', async () => {
            //     expect(
            //         await getDataValue(contract, 'PERCENTS__0')
            //     ).to.be.equal(Number.parseInt(1000000000000));
            // });
        });

        // TODO: CHECK PERCENTS__!!!!
        it('stake with rewarding but without liquid depo and total supply', async () => {
            const contract = getContractByName('waves_staking', this.parent?.ctx);
            const node = getAccountByName('lease_node_1', this.parent?.ctx);
            const startDepo = 1366000000;
            const reward = 1230000000;
            await step('set state', async () => {
                await resetStakeState(contract);
                await setLiquidDepo(contract, startDepo);
                await setLeaseNode(contract, node.address);
            });
            await step('call stake function', async () => {
                await stake(
                    contract,
                    node,
                    [
                        { type: 'integer', value: reward }
                    ]
                );
            });
            await step('check LIQUID_TOTAL_SUPPLY', async () => {
                expect(
                    await getDataValue(contract, 'LIQUID_TOTAL_SUPPLY')
                ).to.be.equal(startDepo);
            });
            await step('check LIQUID_DEPOSIT', async () => {
                expect(
                    await getDataValue(contract, 'LIQUID_DEPOSIT')
                ).to.be.equal(0);
            });
            await step('check PERCENTS_LAST_IDX', async () => {
                expect(
                    await getDataValue(contract, 'PERCENTS_LAST_IDX')
                ).to.be.equal(1);
            });
        });

        // TODO: CHECK PERCENTS__!!!!
        it('stake with rewarding and total supply but without liquid depo', async () => {
            const contract = getContractByName('waves_staking', this.parent?.ctx);
            const node = getAccountByName('lease_node_1', this.parent?.ctx);
            const startSupply = 1366000000;
            const reward = 1230000000;
            await step('set state', async () => {
                await resetStakeState(contract);
                await setTotalLiquidSupply(contract, startSupply);
                await setLeaseNode(contract, node.address);
            });
            await step('call stake function', async () => {
                await stake(
                    contract,
                    node,
                    [
                        { type: 'integer', value: reward }
                    ]
                );
            });
            await step('check LIQUID_TOTAL_SUPPLY', async () => {
                expect(
                    await getDataValue(contract, 'LIQUID_TOTAL_SUPPLY')
                ).to.be.equal(startSupply + reward);
            });
            await step('check LIQUID_DEPOSIT', async () => {
                expect(
                    await getDataValue(contract, 'LIQUID_DEPOSIT')
                ).to.be.equal(0);
            });
            await step('check PERCENTS_LAST_IDX', async () => {
                expect(
                    await getDataValue(contract, 'PERCENTS_LAST_IDX')
                ).to.be.equal(2);
            });
        });

        // TODO: CHECK PERCENTS__!!!!
        it('stake with rewarding, total supply and liquid depo', async () => {
            const contract = getContractByName('waves_staking', this.parent?.ctx);
            const node = getAccountByName('lease_node_1', this.parent?.ctx);
            const startSupply = 1366000000;
            const startDepo = 6613000000;
            const reward = 1230000000;
            await step('set state', async () => {
                await resetStakeState(contract);
                await setTotalLiquidSupply(contract, startSupply);
                await setLiquidDepo(contract, startDepo);
                await setLeaseNode(contract, node.address);
            });
            await step('call stake function', async () => {
                await stake(
                    contract,
                    node,
                    [
                        { type: 'integer', value: reward }
                    ]
                );
            });
            await step('check LIQUID_TOTAL_SUPPLY', async () => {
                expect(
                    await getDataValue(contract, 'LIQUID_TOTAL_SUPPLY')
                ).to.be.equal(startSupply + startDepo + reward);
            });
            await step('check LIQUID_DEPOSIT', async () => {
                expect(
                    await getDataValue(contract, 'LIQUID_DEPOSIT')
                ).to.be.equal(0);
            });
            await step('check PERCENTS_LAST_IDX', async () => {
                expect(
                    await getDataValue(contract, 'PERCENTS_LAST_IDX')
                ).to.be.equal(2);
            });
        });

        it('should throw when wrong caller', async () => {
            const contract = getContractByName('waves_staking', this.parent?.ctx);
            const node = getAccountByName('lease_node_1', this.parent?.ctx);
            const caller = getAccountByName('trinity', this.parent?.ctx);
            await step('reset state', async () => {
                await resetStakeState(contract);
                await setTotalLiquidSupply(contract, 0);
                await setLiquidDepo(contract, 0);
                await setLeaseNode(contract, node.address);
            });
            stepIgnoreErrorByMessage('send stake with wrong caller', 'stake: caller is not allowed', async () => {
                await stake(
                    contract,
                    caller,
                    [
                        { type: 'integer', value: 13 }
                    ]
                );
            });
        });

        it('should throw when incorrect reward', async () => {
            const contract = getContractByName('waves_staking', this.parent?.ctx);
            const node = getAccountByName('lease_node_1', this.parent?.ctx);
            await step('reset state', async () => {
                await resetStakeState(contract);
                await setTotalLiquidSupply(contract, 0);
                await setLiquidDepo(contract, 0);
                await setLeaseNode(contract, node.address);
            });
            stepIgnoreErrorByMessage('send stake with wrong caller', 'stake: invalid reward', async () => {
                await stake(
                    contract,
                    node,
                    [
                        { type: 'integer', value: 0 }
                    ]
                );
            });
        });

        // [PARAMETRIZED] check liquid total supply and percents
    });

    describe('Withdraw tests', function() {
        it('can withdraw immediately after deposit (without rewarding)', async () => {
            const contract = getContractByName('waves_staking', this.parent?.ctx);
            const user = getAccountByName('max', this.parent?.ctx);
            const startAccDepo = 1366000000;
            const startUserBalance = await getBalance(user.address);
            await step('set state', async () => {
                await resetStakeState(contract);
                await resetAccountDepo(contract, user);
                await setLeaseNode(contract, getAccountByName('lease_node_1', this.parent?.ctx).address);
            });
            await step('send deposit', async () => {
                await sendDeposit(
                    contract,
                    user,
                    [
                        {
                            assetId: null,
                            amount: startAccDepo
                        }
                    ]
                );
            });
            await step('check user\'s balance', async () => {
                expect(
                    await getBalance(user.address)
                ).to.be.equal(startUserBalance - startAccDepo - env.network.WavesInvokeFee);
            });
            await step('call withdraw', async () => {
                await withdraw(contract, user);
            });
            await step('check ACCOUNT_BALANCE__', async () => {
                expect(
                    await getDataValue(contract, `ACCOUNT_BALANCE__${user.address}`)
                ).to.be.equal(0);
            });
            await step('check ACCOUNT_DEPOSIT__', async () => {
                expect(
                    await getDataValue(contract, `ACCOUNT_DEPOSIT__${user.address}`)
                ).to.be.equal(0);
            });
            await step('check user\'s balance', async () => {
                expect(
                    await getBalance(user.address)
                ).to.be.equal(startUserBalance - 3 * env.network.WavesInvokeFee);
            });
        });

        // TODO: Check LIQUID_TOTAL_SUPPLY, LIQUID_DEPOSIT and LEASE_AMOUNT
        it('can withdraw after stake but without reward', async () => {
            const contract = getContractByName('waves_staking', this.parent?.ctx);
            const user = getAccountByName('max', this.parent?.ctx);
            const startAccDepo = 1366000000;
            const node = getAccountByName('lease_node_1', this.parent?.ctx);
            const reward = 300000000;
            const startUserBalance = await getBalance(user.address);
            await step('set state', async () => {
                await resetStakeState(contract);
                await resetAccountDepo(contract, user);
                await setLeaseNode(contract, getAccountByName('lease_node_1', this.parent?.ctx).address);
            });
            await step('send deposit', async () => {
                await sendDeposit(
                    contract,
                    user,
                    [
                        {
                            assetId: null,
                            amount: startAccDepo
                        }
                    ]
                );
            });
            await step('check user\'s balance', async () => {
                expect(
                    await getBalance(user.address)
                ).to.be.equal(startUserBalance - startAccDepo - env.network.WavesInvokeFee);
            });
            await step('stake', async () => {
                await stake(
                    contract,
                    node,
                    [
                        { type: 'integer', value: reward }
                    ]
                );
            });
            await step('call withdraw', async () => {
                await withdraw(contract, user);
            });
            await step('check ACCOUNT_BALANCE__', async () => {
                expect(
                    await getDataValue(contract, `ACCOUNT_BALANCE__${user.address}`)
                ).to.be.equal(0);
            });
            await step('check ACCOUNT_DEPOSIT__', async () => {
                expect(
                    await getDataValue(contract, `ACCOUNT_DEPOSIT__${user.address}`)
                ).to.be.equal(0);
            });
            await step('check user balance', async () => {
                expect(
                    await getBalance(user.address)
                ).to.be.equal(startUserBalance - 3 * env.network.WavesInvokeFee);
            });
        });

        // TODO: Check LIQUID_TOTAL_SUPPLY, LIQUID_DEPOSIT and LEASE_AMOUNT
        // TODO: await new reward calculation
        xit('can withdraw after stake and after claim reward', async () => {
            const contract = getContractByName('waves_staking', this.parent?.ctx);
            const user = getAccountByName('max', this.parent?.ctx);
            const startAccDepo = 1366000000;
            const node = getAccountByName('lease_node_1', this.parent?.ctx);
            const reward = 300000000;
            const startUserBalance = await getBalance(user.address);
            await step('set state', async () => {
                await resetStakeState(contract);
                await resetAccountDepo(contract, user);
                await setLeaseNode(contract, getAccountByName('lease_node_1', this.parent?.ctx).address);
            });
            await step('send deposit', async () => {
                await sendDeposit(
                    contract,
                    user,
                    [
                        {
                            assetId: null,
                            amount: startAccDepo
                        }
                    ]
                );
            });
            await step('check user\'s balance', async () => {
                expect(
                    await getBalance(user.address)
                ).to.be.equal(startUserBalance - startAccDepo - env.network.WavesInvokeFee);
            });
            await step('stake', async () => {
                await stake(
                    contract,
                    node,
                    [
                        { type: 'integer', value: reward }
                    ]
                );
            });
            await step('another stake (for reward creation)', async () => {
                await stake(
                    contract,
                    node,
                    [
                        { type: 'integer', value: reward }
                    ]
                );
            });//1219619326500,732064422
            await step('call withdraw', async () => {
                await withdraw(contract, user);
            });
            await step('check ACCOUNT_BALANCE__', async () => {
                expect(
                    await getDataValue(contract, `ACCOUNT_BALANCE__${user.address}`)
                ).to.be.equal(0);
            });
            await step('check ACCOUNT_DEPOSIT__', async () => {
                expect(
                    await getDataValue(contract, `ACCOUNT_DEPOSIT__${user.address}`)
                ).to.be.equal(0);
            });
            await step('check user balance', async () => {
                expect(
                    await getBalance(user.address)
                ).to.be.equal(startUserBalance + reward - 3 * env.network.WavesInvokeFee);
            });
        });

        it('should throw when try to withdraw with empty depo', async () => {
            const contract = getContractByName('waves_staking', this.parent?.ctx);
            const user = getAccountByName('gerry', this.parent?.ctx);
            await step('set state', async () => {
                await resetStakeState(contract);
                await resetAccountDepo(contract, user);
                await setLeaseNode(contract, getAccountByName('lease_node_1', this.parent?.ctx).address);
            });
            await stepIgnoreErrorByMessage('try to invoke withdraw', 'Error while executing account-script: withdraw: insufficient funds', async () => {
                await withdraw(contract, user);
            });
        });

        // [PARAMETRIZED] check rewards
    });

    // describe('Integration tests', function() {

    //     // TODO: deposit after deposit and withdraw after withdraw

    //     // TODO: check the correct calculate for reward percents!!! (reward_idx not changed with next deposits)
    //     // maybe manipulations with deposit and withdraw...

    //     // TODO: Stress tests
    //     // too many deposits
    //     // too many deposits and withdraws
    //     // too many stakes with reward
    // });
});
