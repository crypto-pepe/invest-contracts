import bs58 from 'bs58';
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
    getLastLiquidationBlock
} from '../../utils/common';
import { getEnvironment } from 'relax-env-json';
import { invoke } from '../../utils/transaction';
import { Asset, getAssetByName } from '../../utils/assets';
const env = getEnvironment();

describe('Waves staking', function() {
    describe('Init tests', function() {
        it('check that init been correctly', async () => {
            const contract = getContractByName('waves_staking', this.parent?.ctx);
            await step('check ASSET', async () => {
                expect(
                    await getDataValue(contract, 'ASSET')
                ).to.be.not.equal(bs58.encode(Buffer.from('')));
            });
        });

        it('should throw when try to re-init contract', async () => {
            const contract = getContractByName('waves_staking', this.parent?.ctx);
            const user = getAccountByName('trinity', this.parent?.ctx);
            await stepIgnoreErrorByMessage(
                'try to re-init',
                'Error while executing account-script: init: already initialized',
                async () => {
                    await invoke(
                        {
                            dApp: contract.dApp,
                            call: { function: 'init' },
                            additionalFee: 100000000
                        },
                        user.privateKey
                    );
                }
            );
        });
    });

    describe('Deposit tests', function() {
        it('simple positive', async () => {
            const contract = getContractByName('waves_staking', this.parent?.ctx);
            const user = getAccountByName('neo', this.parent?.ctx);
            const startUserBalance = await getBalance(user.address);
            const amount = 13000000;
            const sWaves: Asset = {
                name: 'sWaves',
                description: '',
                quantity: amount,
                decimals: 8,
                assetId: await getDataValue(contract, 'ASSET')
            };
            const startSWUserBalance = await getAssetBalance(sWaves, user);
            await step('reset state', async () => {
                await resetStakeState(contract);
                await setLeaseAmount(contract, 0);
            });
            await step('set lease node address', async () => {
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
            await step('check user\'s balances', async () => {
                expect(await getAssetBalance(sWaves, user)).to.be.equal(startSWUserBalance + amount);
                expect(
                    await getBalance(user.address)
                ).to.be.equal(
                    startUserBalance - amount - env.network.WavesInvokeFee
                );
            });
            await step('check state', async () => {
                expect(await getDataValue(contract, 'TOTAL_DEPOSIT')).to.be.equal(amount);
                expect(await getDataValue(contract, 'LAST_RATE')).to.be.equal('base64:AOjUpRAA');
                expect(await getDataValue(contract, 'CURRENT_RATE')).to.be.equal('base64:AA==');
                expect(await getDataValue(contract, 'LAST_HEIGHT')).to.be.equal(0);
            });
            await step('check leasing data', async () => {
                expect(await getDataValue(contract, 'LEASE_AMOUNT')).to.be.equal(amount);
            });
        });

        it('should throw when no payments', async () => {
            const contract = getContractByName('waves_staking', this.parent?.ctx);
            const user = getAccountByName('neo', this.parent?.ctx);
            await stepIgnoreErrorByMessage(
                'send deposit with empty payment',
                'Error while executing account-script: deposit: no payments',
                async () => {
                    await sendDeposit(
                        contract,
                        user,
                        []
                    );
                }
            );
        });

        it('should throw when token is not WAVES', async () => {
            const contract = getContractByName('waves_staking', this.parent?.ctx);
            const user = getAccountByName('neo', this.parent?.ctx);
            const sWaves = await getDataValue(contract, 'ASSET');
            await stepIgnoreErrorByMessage(
                'send deposit with empty payment',
                'Error while executing account-script: deposit: payment is not waves',
                async () => {
                    await sendDeposit(
                        contract,
                        user,
                        [
                            {
                                assetId: sWaves,
                                amount: 1366
                            }
                        ]
                    );
                }
            );
        });

        it('should throw when amount = 0', async () => {
            const contract = getContractByName('waves_staking', this.parent?.ctx);
            const user = getAccountByName('neo', this.parent?.ctx);
            await stepIgnoreErrorByMessage(
                'send deposit with empty payment', 
                // 'Error while executing account-script: deposit: invalid payment amount', 
                'non-positive amount: 0 of Waves',
                async () => {
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
                }
            );
        });

        it('should throw when contract been not initialized', async () => {
            const contract = getContractByName('waves_staking', this.parent?.ctx);
            const user = getAccountByName('neo', this.parent?.ctx);
            const sWaves = await getDataValue(contract, 'ASSET');
            await step('reset sWaves ASSET settings', async () => {
                await setAsset(contract, '');
            });
            await stepIgnoreErrorByMessage(
                'send deposit with empty payment',
                'Error while executing account-script: deposit: contract not initialized',
                async () => {
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
                }
            );
            await step('revert ASSET', async () => {
                await setAsset(contract, sWaves);
            });
        });

        it('check stake state calculation', async () => {
            const contract = getContractByName('waves_staking', this.parent?.ctx);
            const user = getAccountByName('neo', this.parent?.ctx);
            const startUserBalance = await getBalance(user.address);
            const amount = 13000000;
            const sWaves: Asset = {
                name: 'sWaves',
                description: '',
                quantity: amount,
                decimals: 8,
                assetId: await getDataValue(contract, 'ASSET')
            };
            const startSWUserBalance = await getAssetBalance(sWaves, user);
            await step('reset state', async () => {
                await resetStakeState(contract);
                await setLeaseAmount(contract, 0);
            });
            await step('set lease node address', async () => {
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
            await step('deposit to contract again', async () => {
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
            await step('check user\'s balances', async () => {
                expect(await getAssetBalance(sWaves, user)).to.be.equal(startSWUserBalance + 2 * amount);
                expect(
                    await getBalance(user.address)
                ).to.be.equal(
                    startUserBalance - 2 * amount - 2 * env.network.WavesInvokeFee
                );
            });
            await step('check state', async () => {
                expect(await getDataValue(contract, 'TOTAL_DEPOSIT')).to.be.equal(2 * amount);
                expect(await getDataValue(contract, 'LAST_RATE')).to.be.equal('base64:AOjUpRAA');
                expect(await getDataValue(contract, 'CURRENT_RATE')).to.be.equal('base64:AA==');
                expect(await getDataValue(contract, 'LAST_HEIGHT')).to.be.equal(0);
            });
            await step('check leasing data', async () => {
                expect(await getDataValue(contract, 'LEASE_AMOUNT')).to.be.equal(2 * amount);
            });
        });
    });

    describe('Stake tests', function() {
        it('Simple positive (without old rewards)', async () => {
            const contract = getContractByName('waves_staking', this.parent?.ctx);
            const techContract = getContractByName('technical', this.parent?.ctx);
            const user = getAccountByName('morpheus', this.parent?.ctx);
            const node = getAccountByName('lease_node_1', this.parent?.ctx);
            const deposit = 1300000000;
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
            const lastBlock = await getLastLiquidationBlock(0);
            await step('stake', async () => {
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
            await step('check state', async () => {
                await setInt(techContract, getAccountByName('trinity', this.parent?.ctx), 1000000000000);
                expect(await getDataValue(contract, 'LAST_RATE'))
                    .to.be.equal(await getDataValue(techContract, 'BINARY_INT'));
                await setInt(
                    techContract, 
                    getAccountByName('trinity', this.parent?.ctx),
                    Math.floor(rewardAmt * 1000000000000 / (deposit * rewardHeight))
                );
                expect(await getDataValue(contract, 'CURRENT_RATE'))
                    .to.be.equal(await getDataValue(techContract, 'BINARY_INT'));
                expect(lastBlock).to.be.lessThanOrEqual(
                    await getDataValue(contract, 'LAST_HEIGHT')
                );
                expect(
                    lastBlock + rewardHeight
                ).to.be.equal(await getDataValue(contract, 'TARGET_HEIGHT'));
            });
            await step('check leasing', async () => {
                expect(await getDataValue(contract, 'LEASE_AMOUNT')).to.be.equal(deposit + rewardAmt);
            });
        });

        it('stake with processed old reward on last block with currentRate = 0', async () => {
            const contract = getContractByName('waves_staking', this.parent?.ctx);
            const techContract = getContractByName('technical', this.parent?.ctx);
            const user = getAccountByName('morpheus', this.parent?.ctx);
            const node = getAccountByName('lease_node_1', this.parent?.ctx);
            const deposit = 1300000000;
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
            const startLastRate = await getDataValue(contract, 'LAST_RATE');
            lastBlock = await getLastLiquidationBlock(0);
            await step('stake', async () => {
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
            await step('check state', async () => {
                expect(await getDataValue(contract, 'LAST_RATE')).to.be.equal(startLastRate);
                await setInt(
                    techContract, 
                    getAccountByName('trinity', this.parent?.ctx),
                    Math.floor(rewardAmt * 1000000000000 / (deposit * rewardHeight))
                );
                expect(await getDataValue(contract, 'CURRENT_RATE'))
                    .to.be.equal(await getDataValue(techContract, 'BINARY_INT'));
                expect(lastBlock).to.be.lessThanOrEqual(
                    await getDataValue(contract, 'LAST_HEIGHT')
                );
                expect(
                    lastBlock + rewardHeight
                ).to.be.equal(await getDataValue(contract, 'TARGET_HEIGHT'));
            });
            await step('check leasing', async () => {
                expect(await getDataValue(contract, 'LEASE_AMOUNT')).to.be.equal(deposit + rewardAmt);
            });
        });

        it('stake with processed old reward on prevous of last block with currentRate > 0', async () => {
            const contract = getContractByName('waves_staking', this.parent?.ctx);
            const techContract = getContractByName('technical', this.parent?.ctx);
            const user = getAccountByName('morpheus', this.parent?.ctx);
            const node = getAccountByName('lease_node_1', this.parent?.ctx);
            const deposit = 1300000000;
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
                await setStakeState(contract, null, null, null, lastBlock - 1, lastBlock + 1);
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
            await step('check state', async () => {
                // 1000000000000 + (1) * 76923076923 = 1076923076923
                await setInt(
                    techContract,
                    getAccountByName('trinity', this.parent?.ctx),
                    1076923076923
                );
                expect(await getDataValue(contract, 'LAST_RATE'))
                    .to.be.equal(await getDataValue(techContract, 'BINARY_INT'));
                // (rewardAmt + 76923076923 * (1)) * 1000000000000 / (deposit * 10) 
                await setInt(
                    techContract,
                    getAccountByName('trinity', this.parent?.ctx),
                    Math.floor((rewardAmt + 76923076923 * 1) * 1000000000000 / (deposit * 10))
                );
                expect(await getDataValue(contract, 'CURRENT_RATE'))
                    .to.be.equal(await getDataValue(techContract, 'BINARY_INT'));
                expect(lastBlock).to.be.lessThanOrEqual(
                    await getDataValue(contract, 'LAST_HEIGHT')
                );
                expect(
                    lastBlock + rewardHeight
                ).to.be.lessThanOrEqual(await getDataValue(contract, 'TARGET_HEIGHT'));
            });
            await step('check leasing', async () => {
                expect(await getDataValue(contract, 'LEASE_AMOUNT')).to.be.equal(deposit + 2 * rewardAmt);
            });
        });

        it('stake with uncommitted old reward (current rate > 0)', async () => {
            const contract = getContractByName('waves_staking', this.parent?.ctx);
            const techContract = getContractByName('technical', this.parent?.ctx);
            const user = getAccountByName('morpheus', this.parent?.ctx);
            const node = getAccountByName('lease_node_1', this.parent?.ctx);
            const deposit = 1300000000;
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
            await step('check state', async () => {
                // 1000000000000 + (2 - -1) * 76923076923 = 1076923076923
                const currentRate = Math.floor(rewardAmt * 1000000000000 / (deposit * rewardHeight));
                await setInt(
                    techContract,
                    getAccountByName('trinity', this.parent?.ctx),
                    Math.floor(1000000000000 + 2 * currentRate)
                );
                expect(await getDataValue(contract, 'LAST_RATE'))
                    .to.be.equal(await getDataValue(techContract, 'BINARY_INT'));
                // rewardAmt * 1000000000000 / (deposit * 10)
                await setInt(
                    techContract,
                    getAccountByName('trinity', this.parent?.ctx),
                    Math.floor(rewardAmt * 1000000000000 / (deposit * rewardHeight))
                );
                expect(await getDataValue(contract, 'CURRENT_RATE'))
                    .to.be.equal(await getDataValue(techContract, 'BINARY_INT'));
                expect(lastBlock).to.be.lessThanOrEqual(
                    await getDataValue(contract, 'LAST_HEIGHT')
                );
                expect(
                    lastBlock + rewardHeight
                ).to.be.lessThanOrEqual(await getDataValue(contract, 'TARGET_HEIGHT'));
            });
            await step('check leasing', async () => {
                expect(await getDataValue(contract, 'LEASE_AMOUNT')).to.be.equal(deposit + 2 * rewardAmt);
            });
        });

        it('should throw when caller is not allowed', async () => {
            const contract = getContractByName('waves_staking', this.parent?.ctx);
            const node = getAccountByName('trinity', this.parent?.ctx);
            await step('set lease node address', async () => {
                await setLeaseNode(contract, getAccountByName('lease_node_1', this.parent?.ctx).address);
            });
            await stepIgnoreErrorByMessage(
                'try to invoke deposit',
                'Error while executing account-script: stake: caller is not allowed',
                async () => {
                    await stake(
                        contract,
                        node,
                        [
                            { type: 'integer', value: 13 }
                        ],
                        [
                            { assetId: null, amount: 66 }
                        ]
                    );
                }
            );
        });

        it('should throw when send invalid number of blocks', async () => {
            const contract = getContractByName('waves_staking', this.parent?.ctx);
            const node = getAccountByName('lease_node_1', this.parent?.ctx);
            await step('set lease node address', async () => {
                await setLeaseNode(contract, node.address);
            });
            await stepIgnoreErrorByMessage(
                'try to invoke deposit',
                'Error while executing account-script: stake: invalid blocks',
                async () => {
                    await stake(
                        contract,
                        node,
                        [
                            { type: 'integer', value: 0 }
                        ],
                        []
                    );
                }
            );
        });

        it('should throw without payment', async () => {
            const contract = getContractByName('waves_staking', this.parent?.ctx);
            const node = getAccountByName('lease_node_1', this.parent?.ctx);
            await step('set lease node address', async () => {
                await setLeaseNode(contract, node.address);
            });
            await stepIgnoreErrorByMessage(
                'try to invoke deposit',
                'Error while executing account-script: stake: no payments',
                async () => {
                    await stake(
                        contract,
                        node,
                        [
                            { type: 'integer', value: 13 }
                        ],
                        []
                    );
                }
            );
        });

        it('should throw if payment asset is not WAVES', async () => {
            const contract = getContractByName('waves_staking', this.parent?.ctx);
            const node = getAccountByName('lease_node_1', this.parent?.ctx);
            await step('set lease node address', async () => {
                await setLeaseNode(contract, node.address);
            });
            await stepIgnoreErrorByMessage(
                'try to invoke deposit',
                'Error while executing account-script: stake: payment is not waves',
                async () => {
                    await stake(
                        contract,
                        node,
                        [
                            { type: 'integer', value: 13 }
                        ],
                        [
                            { assetId: await getAssetByName('USDN', this.parent?.ctx).assetId, amount: 1 }
                        ]
                    );
                }
            );
        });

        it('should throw with zero reward amount', async () => {
            const contract = getContractByName('waves_staking', this.parent?.ctx);
            const node = getAccountByName('lease_node_1', this.parent?.ctx);
            await step('set lease node address', async () => {
                await setLeaseNode(contract, node.address);
            });
            await stepIgnoreErrorByMessage(
                'try to invoke deposit',
                'non-positive amount: 0 of Waves',
                async () => {
                    await stake(
                        contract,
                        node,
                        [
                            { type: 'integer', value: 13 }
                        ],
                        [
                            { assetId: null, amount: 0 }
                        ]
                    );
                }
            );
        });

        it('should throw when try to stake without deposites', async () => {
            const contract = getContractByName('waves_staking', this.parent?.ctx);
            const node = getAccountByName('lease_node_1', this.parent?.ctx);
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
            await step('set lease node address', async () => {
                await setLeaseNode(contract, node.address);
            });
            await stepIgnoreErrorByMessage(
                'stake',
                'Error while executing account-script: stake: no deposits to stake for',
                async () => {
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
                }
            );
        });

        it('should throw when try to send too big block value', async () => {
            const contract = getContractByName('waves_staking', this.parent?.ctx);
            const node = getAccountByName('lease_node_1', this.parent?.ctx);
            const rewardAmt = 1000000000;
            await stepIgnoreErrorByMessage(
                'stake',
                'Error while executing account-script: stake: invalid blocks',
                async () => {
                    await stake(
                        contract,
                        node,
                        [
                            { type: 'integer', value: 9223372036854775808n }
                        ],
                        [
                            { assetId: null, amount: rewardAmt }
                        ]
                    );
                }
            );
        });
    });

    describe('Withdraw tests', function() {
        it('Simple positive test', async () => {
            const contract = getContractByName('waves_staking', this.parent?.ctx);
            const user = getAccountByName('max', this.parent?.ctx);
            const startUserBalance = await getBalance(user.address);
            const amount = 13000000;
            const sWaves: Asset = {
                name: 'sWaves',
                description: '',
                quantity: amount,
                decimals: 8,
                assetId: await getDataValue(contract, 'ASSET')
            };
            const startSWUserBalance = await getAssetBalance(sWaves, user);
            await step('reset state', async () => {
                await resetStakeState(contract);
                await setLeaseAmount(contract, 0);
            });
            await step('set lease node address', async () => {
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
            await step('withdraw', async () => {
                await withdraw(contract, user, sWaves.assetId, amount);
            });
            await step('check user\'s balances', async () => {
                expect(await getAssetBalance(sWaves, user)).to.be.equal(startSWUserBalance);
                expect(
                    await getBalance(user.address)
                ).to.be.equal(
                    startUserBalance - 2 * env.network.WavesInvokeFee
                );
            });
            await step('check state', async () => {
                // TODO: refactor total deposit calculation
                expect(await getDataValue(contract, 'TOTAL_DEPOSIT')).to.be.equal(amount);
                expect(await getDataValue(contract, 'LAST_RATE')).to.be.equal('base64:AOjUpRAA');
                expect(await getDataValue(contract, 'CURRENT_RATE')).to.be.equal('base64:AA==');
                expect(await getDataValue(contract, 'LAST_HEIGHT')).to.be.equal(0);
                expect(await getDataValue(contract, 'TARGET_HEIGHT')).to.be.equal(0);
            });
            await step('check leasing data', async () => {
                expect(await getDataValue(contract, 'LEASE_AMOUNT')).to.be.equal(0);
            });
        });

        it('should throw when invoke has no payments', async () => {
            const contract = getContractByName('waves_staking', this.parent?.ctx);
            const user = getAccountByName('max', this.parent?.ctx);
            await stepIgnoreErrorByMessage(
                'invoke withdraw without payments',
                'Error while executing account-script: withdraw: no payments',
                async () => {
                    await invoke(
                        {
                            dApp: contract.dApp,
                            call: { function: 'withdraw' },
                            payment: []
                        }, 
                        user.privateKey
                    );
                }
            );
        });

        it('should throw if selected not sWaves asset', async () => {
            const contract = getContractByName('waves_staking', this.parent?.ctx);
            const user = getAccountByName('max', this.parent?.ctx);
            await stepIgnoreErrorByMessage(
                'invoke withdraw not sWaves',
                'Error while executing account-script: withdraw: payment is not staked waves',
                async () => {
                    await withdraw(contract, user, null, 1366);
                }
            );
        });

        it('should throw with zero withdraw amount', async () => {
            const contract = getContractByName('waves_staking', this.parent?.ctx);
            const user = getAccountByName('max', this.parent?.ctx);
            const assetId = await getDataValue(contract, 'ASSET');
            await stepIgnoreErrorByMessage(
                'invoke withdraw not sWaves',
                `non-positive amount: 0 of ${assetId}`,
                async () => {
                    await withdraw(
                        contract,
                        user,
                        assetId,
                        0
                    );
                }
            );
        });

        it('can withdraw part of deposit', async () => {
            const contract = getContractByName('waves_staking', this.parent?.ctx);
            const user = getAccountByName('max', this.parent?.ctx);
            const startUserBalance = await getBalance(user.address);
            const amount = 13000000;
            const withdrawAmt = 6600000;
            const sWaves: Asset = {
                name: 'sWaves',
                description: '',
                quantity: amount,
                decimals: 8,
                assetId: await getDataValue(contract, 'ASSET')
            };
            const startSWUserBalance = await getAssetBalance(sWaves, user);
            await step('reset state', async () => {
                await resetStakeState(contract);
                await setLeaseAmount(contract, 0);
            });
            await step('set lease node address', async () => {
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
            await step('withdraw', async () => {
                await withdraw(contract, user, sWaves.assetId, withdrawAmt);
            });
            await step('check user\'s balances', async () => {
                expect(await getAssetBalance(sWaves, user)).to.be.equal(startSWUserBalance + amount - withdrawAmt);
                expect(
                    await getBalance(user.address)
                ).to.be.equal(
                    startUserBalance - 2 * env.network.WavesInvokeFee - amount + withdrawAmt
                );
            });
            await step('check state', async () => {
                // TODO: refactor total deposit calculation
                expect(await getDataValue(contract, 'TOTAL_DEPOSIT')).to.be.equal(amount);
                expect(await getDataValue(contract, 'LAST_RATE')).to.be.equal('base64:AOjUpRAA');
                expect(await getDataValue(contract, 'CURRENT_RATE')).to.be.equal('base64:AA==');
                expect(await getDataValue(contract, 'LAST_HEIGHT')).to.be.equal(0);
                expect(await getDataValue(contract, 'TARGET_HEIGHT')).to.be.equal(0);
            });
            await step('check leasing data', async () => {
                expect(await getDataValue(contract, 'LEASE_AMOUNT')).to.be.equal(amount - withdrawAmt);
            });
        });

        it('withdraw with reward', async () => {
            const contract = getContractByName('waves_staking', this.parent?.ctx);
            const user = getAccountByName('max', this.parent?.ctx);
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
            const startUserBalance = await getBalance(user.address);
            const startSWUserBalance = await getAssetBalance(sWaves, user);
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
            await step('check user\'s balances', async () => {
                expect(
                    await getAssetBalance(sWaves, user)
                ).to.be.equal(startSWUserBalance + deposit);
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
            const withdrawBlock = await getLastLiquidationBlock(0);
            await step('withdraw partially with reward', async () => {
                await withdraw(contract, user, sWaves.assetId, withdrawAmt);
            });
            const prevCurrRate =  Math.floor(rewardAmt * 1000000000000 / (deposit * rewardHeight));
            const lastRate = Math.floor(1000000000000 + 2 * prevCurrRate);
            const currRate = Math.floor(rewardAmt * 1000000000000 / (deposit * rewardHeight));
            const lastRateUpdated = lastRate + currRate * (withdrawBlock - await getDataValue(contract, 'LAST_HEIGHT'));
            const rewardWithdraw = Math.floor(withdrawAmt * lastRateUpdated / 1000000000000);
            await step('check user\'s balances', async () => {
                expect(
                    await getAssetBalance(sWaves, user)
                ).to.be.equal(startSWUserBalance + deposit - withdrawAmt);
                expect(
                    await getBalance(user.address)
                ).to.be.equal(startUserBalance - deposit - 2 * env.network.WavesInvokeFee + rewardWithdraw);
            });
            await step('check leasing', async () => {
                expect(
                    await getDataValue(contract, 'LEASE_AMOUNT')
                ).to.be.equal(deposit + 2 * rewardAmt - rewardWithdraw);
            });
        });
    });
});