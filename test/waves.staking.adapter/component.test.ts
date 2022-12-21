import {
  getAccountByName,
  getAssetByName,
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
import { getEnvironment } from 'relax-env-json';
import { claimReward, setAdaptee, setFeeRate, setManager, setMultisig, setTarget, stake, unstake } from '../../steps/waves.staking.adapter';
import { setSignedContext, signedTransfer } from '../../steps/common';
import { expect } from 'chai';
import { base58Encode } from '@waves/ts-lib-crypto';
const env = getEnvironment();

describe('Waves adapter', function() {
  describe('stake tests', function() {
    it('should throw when caller is not adapter', async () => {
      const contract = getContractByName('waves_staking_adapter', this.parent?.ctx);
      const user = getAccountByName('neo', this.parent?.ctx);
      await stepIgnoreErrorByMessage(
        'try to invoke stake',
        'Error while executing dApp: stake: permission denied',
        async () => {
          await invoke(
            {
              dApp: contract.dApp,
              call: { 
                function: 'stake'
              },
              payment: [{ assetId: null, amount: 1366000000 }]
            },
            user.privateKey,
            env.network
          );
        }
      );
    });

    it('should throw when no paymnets', async () => {
      const techContract = getContractByName('technical', this.parent?.ctx);
      await stepIgnoreErrorByMessage(
        'try to invoke stake',
        'Error while executing dApp: stake: no payments',
        async () => {
          await stake([], { privateKey: techContract.privateKey });
        }
      );
    });

    it('should throw when wrong asset', async () => {
      const techContract = getContractByName('technical', this.parent?.ctx);
      const techUser = getAccountByName('tech_acc', this.parent?.ctx);
      const WETH = getAssetByName('WETH', this.parent?.ctx);
      await step('send WETH to mock', async () => {
        await transfer(
          {
            recipient: techContract.dApp,
            amount: 1000000,
            assetId: WETH.assetId
          },
          techUser.privateKey,
          env.network
        );
      });
      await stepIgnoreErrorByMessage(
        'try to invoke stake',
        'Error while executing dApp: stake: payment is not in waves',
        async () => {
          await stake(
            [{ assetId: WETH.assetId, amount: 123 }],
            { privateKey: techContract.privateKey }
          );
        }
      );
    });

    it('should throw when amount <= 0', async () => {
      const techContract = getContractByName('technical', this.parent?.ctx);
      await stepIgnoreErrorByMessage(
        'try to invoke stake',
        // 'Error while executing dApp: stake: invalid payment amount',
        'non-positive amount: 0 of Waves',
        async () => {
          await stake(
            [{ assetId: null, amount: 0 }],
            { privateKey: techContract.privateKey }
          );
        }
      );
    });

    it('simple positive', async () => {
      const techContract = getContractByName('technical', this.parent?.ctx);
      const contract = getContractByName('waves_staking_adapter', this.parent?.ctx);
      const stakeAmt = 1366000000;
      await step('set state', async () => {
        await setSignedContext(
          contract,
          {
            data: [
              { key: 'LEASE_AMOUNT', type: 'integer', value: 0}
            ]
          }
        );
      });
      await step('invoke stake', async () => {
        await stake(
          [{ assetId: null, amount: stakeAmt }],
          { privateKey: techContract.privateKey }
        );
      });
      await step('check state', async () => {
        expect(
          await getDataValue(contract, 'LEASE_AMOUNT', env.network)
        ).to.be.equal(stakeAmt);
      });
    });
  });

  describe('unstake tests', function() {
    it('should throw when caller is not adapter', async () => {
      const contract = getContractByName('waves_staking_adapter', this.parent?.ctx);
      const user = getAccountByName('neo', this.parent?.ctx);
      await stepIgnoreErrorByMessage(
        'try to invoke unstake',
        'Error while executing dApp: unstake: permission denied',
        async () => {
          await invoke(
            {
              dApp: contract.dApp,
              call: { 
                function: 'unstake',
                args: [{ type: 'integer', value: 1366 }]
              }
            },
            user.privateKey,
            env.network
          );
        }
      );
    });

    it('should throw when amount <= 0', async () => {
      const techContract = getContractByName('technical', this.parent?.ctx);
      await stepIgnoreErrorByMessage(
        'try to invoke unstake',
        'Error while executing dApp: unstake: invalid amount',
        async () => {
          await unstake(
            [{ type: 'integer', value: 0 }],
            { privateKey: techContract.privateKey }
          );
        }
      );
    });

    it('simple positive', async () => {
      const techContract = getContractByName('technical', this.parent?.ctx);
      const contract = getContractByName('waves_staking_adapter', this.parent?.ctx);
      const unstakeAmt = 661300000;
      await step('set state', async () => {
        await setSignedContext(
          contract,
          {
            data: [
              { key: 'LEASE_AMOUNT', type: 'integer', value: unstakeAmt }
            ]
          }
        );
      });
      await step('invoke unstake', async () => {
        await unstake(
          [{ type: 'integer', value: unstakeAmt }],
          { privateKey: techContract.privateKey }
        );
      });
      await step('check state', async () => {
        expect(
          await getDataValue(contract, 'LEASE_AMOUNT', env.network)
        ).to.be.equal(0);
        expect(
          await getDataValue(contract, 'LEASE_ID', env.network, false)
        ).is.false;
      });
    });
  });

  describe('claimReward tests', function() {
    it('should throw when caller is not adapter', async () => {
      const contract = getContractByName('waves_staking_adapter', this.parent?.ctx);
      const user = getAccountByName('neo', this.parent?.ctx);
      await stepIgnoreErrorByMessage(
        'try to invoke claimReward',
        'Error while executing dApp: claimReward: permission denied',
        async () => {
          await invoke(
            {
              dApp: contract.dApp,
              call: { 
                function: 'claimReward'
              }
            },
            user.privateKey,
            env.network
          );
        }
      );
    });

    it('should nothing when too few amount', async () => {
      const contract = getContractByName('waves_staking_adapter', this.parent?.ctx);
      const techContract = getContractByName('technical', this.parent?.ctx);
      const techUser = getAccountByName('tech_acc', this.parent?.ctx);
      const admin = getAccountByName('manager', this.parent?.ctx);
      const startFeeRate = Number(await getDataValue(contract, 'FEE_RATE', env.network));
      const startAdapter = String(await getDataValue(contract, 'TARGET', env.network));
      await step('set state', async () => {
        const currBlock = await getBlockHeight(0, env.network);
        await setSignedContext(
          contract,
          {
            data: [
              { key: 'LAST_CLAIM', type: 'integer', value: currBlock - 1441},
              { key: 'FEE_RATE', type: 'integer', value: 0 },
              { key: 'TARGET', type: 'string', value: techUser.address },
            ]
          }
        );
      });
      await step('set mock', async () => {
        await invoke(
          {
            dApp: techContract.dApp,
            call: { 
              function: 'setClaim',
              args: [{ type: 'integer', value: 1366 }]
            }
          },
          techUser.privateKey,
          env.network
        );
      });
      const startMockBalance = await getBalance(techContract.dApp, env.network);
      await step('reset mock balance', async () => {
        await signedTransfer(
          {
            address: techContract.dApp,
            publicKey: techContract.publicKey,
            privateKey: techContract.privateKey
          },
          techUser.address,
          startMockBalance - env.network.transferFee
        );
      });
      const startLastClaim = await getDataValue(contract, 'LAST_CLAIM', env.network);
      const startAdminBalance = await getBalance(admin.address, env.network);
      const startAdapterBalance = await getBalance(contract.dApp, env.network);
      await step('invoke claimReward', async () => {
        await claimReward(techUser.privateKey);
      });
      await step('check state', async () => {
        expect(
          await getDataValue(contract, 'LAST_CLAIM', env.network)
        ).to.be.equal(startLastClaim);
      });
      await step('check balances', async () => {
        expect(
          await getBalance(contract.dApp, env.network)
        ).to.be.equal(startAdapterBalance);
        expect(
          await getBalance(admin.address, env.network)
        ).to.be.equal(startAdminBalance);
        expect(
          await getBalance(techContract.dApp, env.network)
        ).to.be.equal(0);
      });
      await step('revert mock balance', async () => {
        await transfer(
          {
            recipient: techContract.dApp,
            amount: startMockBalance
          },
          techUser.privateKey,
          env.network
        );
      });
      await step('revert state', async () => {
        await setSignedContext(
          contract,
          {
            data: [
              { key: 'FEE_RATE', type: 'integer', value: startFeeRate },
              { key: 'TARGET', type: 'string', value: startAdapter },
            ]
          }
        );
      });
    });

    it('should nothing when too few interval', async () => {
      const contract = getContractByName('waves_staking_adapter', this.parent?.ctx);
      const techContract = getContractByName('technical', this.parent?.ctx);
      const techUser = getAccountByName('tech_acc', this.parent?.ctx);
      const admin = getAccountByName('manager', this.parent?.ctx);
      const startFeeRate = Number(await getDataValue(contract, 'FEE_RATE', env.network));
      const startAdapter = String(await getDataValue(contract, 'TARGET', env.network));
      const reward = 1366136613;
      await step('set state', async () => {
        const currBlock = await getBlockHeight(0, env.network);
        await setSignedContext(
          contract,
          {
            data: [
              { key: 'LAST_CLAIM', type: 'integer', value: currBlock - 13},
              { key: 'FEE_RATE', type: 'integer', value: 0 },
              { key: 'TARGET', type: 'string', value: techUser.address },
            ]
          }
        );
      });
      await step('set mock', async () => {
        await invoke(
          {
            dApp: techContract.dApp,
            call: { 
              function: 'setClaim',
              args: [{ type: 'integer', value: 1366 }]
            }
          },
          techUser.privateKey,
          env.network
        );
      });
      const startMockBalance = await getBalance(techContract.dApp, env.network);
      await step('set mock balance', async () => {
        await signedTransfer(
          {
            address: techContract.dApp,
            publicKey: techContract.publicKey,
            privateKey: techContract.privateKey
          },
          techUser.address,
          startMockBalance - reward - env.network.transferFee
        );
      });
      const startLastClaim = await getDataValue(contract, 'LAST_CLAIM', env.network);
      const startAdminBalance = await getBalance(admin.address, env.network);
      const startAdapterBalance = await getBalance(contract.dApp, env.network);
      await step('invoke claimReward', async () => {
        await claimReward(techUser.privateKey);
      });
      await step('check state', async () => {
        expect(
          await getDataValue(contract, 'LAST_CLAIM', env.network)
        ).to.be.equal(startLastClaim);
      });
      await step('check balances', async () => {
        expect(
          await getBalance(contract.dApp, env.network)
        ).to.be.equal(startAdapterBalance);
        expect(
          await getBalance(admin.address, env.network)
        ).to.be.equal(startAdminBalance);
        expect(
          await getBalance(techContract.dApp, env.network)
        ).to.be.equal(reward);
      });
      await step('revert mock balance', async () => {
        await transfer(
          {
            recipient: techContract.dApp,
            amount: startMockBalance - reward
          },
          techUser.privateKey,
          env.network
        );
      });
      await step('revert state', async () => {
        await setSignedContext(
          contract,
          {
            data: [
              { key: 'FEE_RATE', type: 'integer', value: startFeeRate },
              { key: 'TARGET', type: 'string', value: startAdapter },
            ]
          }
        );
      });
    });

    it('simple positive', async () => {
      const contract = getContractByName('waves_staking_adapter', this.parent?.ctx);
      const techContract = getContractByName('technical', this.parent?.ctx);
      const techUser = getAccountByName('tech_acc', this.parent?.ctx);
      const admin = getAccountByName('manager', this.parent?.ctx);
      const startFeeRate = Number(await getDataValue(contract, 'FEE_RATE', env.network));
      const startAdapter = String(await getDataValue(contract, 'TARGET', env.network));
      const reward = 1366136613;
      const feeRate = 250;
      const fee = Math.floor( reward * feeRate / 10000 );
      await step('set state', async () => {
        const currBlock = await getBlockHeight(0, env.network);
        await setSignedContext(
          contract,
          {
            data: [
              { key: 'LAST_CLAIM', type: 'integer', value: currBlock - 1441},
              { key: 'FEE_RATE', type: 'integer', value: feeRate },
              { key: 'TARGET', type: 'string', value: techUser.address },
              { key: 'MANAGER', type: 'string', value: admin.address },
            ]
          }
        );
      });
      await step('set mock', async () => {
        await invoke(
          {
            dApp: techContract.dApp,
            call: { 
              function: 'setClaim',
              args: [{ type: 'integer', value: reward }]
            }
          },
          techUser.privateKey,
          env.network
        );
      });
      let startMockBalance = await getBalance(techContract.dApp, env.network);
      await step('set mock balance', async () => {
        await transfer(
          {
            recipient: techContract.dApp,
            amount: 10000000000
          },
          techUser.privateKey,
          env.network
        );
        startMockBalance = await getBalance(techContract.dApp, env.network);
        await signedTransfer(
          {
            address: techContract.dApp,
            publicKey: techContract.publicKey,
            privateKey: techContract.privateKey
          },
          techUser.address,
          startMockBalance - reward - env.network.transferFee
        );
      });
      const startAdminBalance = await getBalance(admin.address, env.network);
      const startAdapterBalance = await getBalance(contract.dApp, env.network);
      const startTargetBalance = await getBalance(techUser.address, env.network);
      const lastBlock = await getBlockHeight(0, env.network);
      await step('invoke claimReward', async () => {
        await claimReward(techUser.privateKey);
      });
      await step('check state', async () => {
        expect(lastBlock)
          .is.lessThanOrEqual(
            Number(await getDataValue(contract, 'LAST_CLAIM', env.network))
          );
      });
      await step('check balances', async () => {
        expect(
          await getBalance(contract.dApp, env.network)
        ).to.be.equal(startAdapterBalance);
        expect(
          await getBalance(techUser.address, env.network)
        ).to.be.equal(startTargetBalance + reward - fee - 2 * env.network.invokeFee);
        expect(
          await getBalance(admin.address, env.network)
        ).to.be.equal(startAdminBalance + fee);
        expect(
          await getBalance(techContract.dApp, env.network)
        ).to.be.equal(0);
      });
      await step('revert mock balance', async () => {
        await transfer(
          {
            recipient: techContract.dApp,
            amount: startMockBalance - reward
          },
          techUser.privateKey,
          env.network
        );
      });
      await step('revert state', async () => {
        await setSignedContext(
          contract,
          {
            data: [
              { key: 'FEE_RATE', type: 'integer', value: startFeeRate },
              { key: 'TARGET', type: 'string', value: startAdapter },
            ]
          }
        );
      });
    });

    it('should throw when feeRate = 100%', async () => {
      const contract = getContractByName('waves_staking_adapter', this.parent?.ctx);
      const techContract = getContractByName('technical', this.parent?.ctx);
      const techUser = getAccountByName('tech_acc', this.parent?.ctx);
      const admin = getAccountByName('manager', this.parent?.ctx);
      const startFeeRate = Number(await getDataValue(contract, 'FEE_RATE', env.network));
      const startAdapter = String(await getDataValue(contract, 'TARGET', env.network));
      const reward = 1366136613;
      const feeRate = 10000;
      await step('set state', async () => {
        const currBlock = await getBlockHeight(0, env.network);
        await setSignedContext(
          contract,
          {
            data: [
              { key: 'LAST_CLAIM', type: 'integer', value: currBlock - 1441},
              { key: 'FEE_RATE', type: 'integer', value: feeRate },
              { key: 'TARGET', type: 'string', value: techUser.address },
            ]
          }
        );
      });
      await step('set mock', async () => {
        await invoke(
          {
            dApp: techContract.dApp,
            call: { 
              function: 'setClaim',
              args: [{ type: 'integer', value: reward }]
            }
          },
          techUser.privateKey,
          env.network
        );
      });
      let startMockBalance = await getBalance(techContract.dApp, env.network);
      await step('set mock balance', async () => {
        await transfer(
          {
            recipient: techContract.dApp,
            amount: 10000000000
          },
          techUser.privateKey,
          env.network
        );
        startMockBalance = await getBalance(techContract.dApp, env.network);
        await signedTransfer(
          {
            address: techContract.dApp,
            publicKey: techContract.publicKey,
            privateKey: techContract.privateKey
          },
          techUser.address,
          startMockBalance - reward - env.network.transferFee
        );
      });
      const startLastClaim = await getDataValue(contract, 'LAST_CLAIM', env.network);
      const startAdminBalance = await getBalance(admin.address, env.network);
      const startAdapterBalance = await getBalance(contract.dApp, env.network);
      await step('invoke claimReward', async () => {
        await claimReward(techUser.privateKey);
      });
      await step('check state', async () => {
        expect(
          await getDataValue(contract, 'LAST_CLAIM', env.network)
        ).to.be.equal(startLastClaim);
      });
      await step('check balances', async () => {
        expect(
          await getBalance(contract.dApp, env.network)
        ).to.be.equal(startAdapterBalance);
        expect(
          await getBalance(admin.address, env.network)
        ).to.be.equal(startAdminBalance);
        expect(
          await getBalance(techContract.dApp, env.network)
        ).to.be.equal(reward);
      });
      await step('revert mock balance', async () => {
        await transfer(
          {
            recipient: techContract.dApp,
            amount: startMockBalance - reward
          },
          techUser.privateKey,
          env.network
        );
      });
      await step('revert state', async () => {
        await setSignedContext(
          contract,
          {
            data: [
              { key: 'FEE_RATE', type: 'integer', value: startFeeRate },
              { key: 'TARGET', type: 'string', value: startAdapter },
            ]
          }
        );
      });
    });
  });

  describe('setMultisig tests', function() {
    it('should throw when not self-call', async () => {
      const contract = getContractByName('waves_staking_adapter', this.parent?.ctx);
      const user = getAccountByName('neo', this.parent?.ctx);
      const startMultisig = await getDataValue(contract, 'MULTISIG', env.network);
      await stepIgnoreErrorByMessage(
        'try to invoke setMultisig',
        'Error while executing dApp: setMultisig: permission denied',
        async () => {
          await invoke(
            {
              dApp: contract.dApp,
              call: { 
                function: 'setMultisig',
                args: [{ type: 'string', value: base58Encode(user.address) }]
              }
            },
            user.privateKey,
            env.network
          );
        }
      );
      await step('check MULTISIG', async () => {
        expect(
          await getDataValue(contract, 'MULTISIG', env.network)
        ).to.be.equal(startMultisig);
      });
    });

    it('should throw when wrong multisig address', async () => {
      const contract = getContractByName('waves_staking_adapter', this.parent?.ctx);
      const startMultisig = await getDataValue(contract, 'MULTISIG', env.network);
      await stepIgnoreErrorByMessage(
        'try to invoke setMultisig',
        'Error while executing dApp: setMultisig: invalid multisig address',
        async () => {
          await setMultisig('ololo');
        }
      );
      await step('check MULTISIG', async () => {
        expect(
          await getDataValue(contract, 'MULTISIG', env.network)
        ).to.be.equal(startMultisig);
      });
    });

    it('can change multisig address to the same', async () => {
      const contract = getContractByName('waves_staking_adapter', this.parent?.ctx);
      const techContract = getContractByName('technical', this.parent?.ctx);
      const startMultisig = await getDataValue(contract, 'MULTISIG', env.network);
      await step('invoke setMultisig', async () => {
        await setMultisig(base58Encode(techContract.dApp));
      });
      await step('check MULTISIG', async () => {
        expect(
          await getDataValue(contract, 'MULTISIG', env.network)
        ).to.be.equal(startMultisig);
      });
    });

    /**
     * Disabled
     * DO NOT REPEAT IN SMOKE TESTS OR MAINNET!!!
     */
    xit('can change multisig address to various', async () => {
      const contract = getContractByName('waves_staking_adapter', this.parent?.ctx);
      const techUser = getAccountByName('tech_acc', this.parent?.ctx);
      await step('invoke setMultisig', async () => {
        await setMultisig(base58Encode(techUser.address));
      });
      await step('check MULTISIG', async () => {
        expect(
          await getDataValue(contract, 'MULTISIG', env.network)
        ).to.be.equal(techUser.address);
      });
    });
  });

  describe('setTarget tests', function() {
    it('should throw when not self-call', async () => {
      const contract = getContractByName('waves_staking_adapter', this.parent?.ctx);
      const user = getAccountByName('neo', this.parent?.ctx);
      const startTarget = await getDataValue(contract, 'TARGET', env.network);
      await stepIgnoreErrorByMessage(
        'try to invoke setTarget',
        'Error while executing dApp: setTarget: permission denied',
        async () => {
          await invoke(
            {
              dApp: contract.dApp,
              call: { 
                function: 'setTarget',
                args: [{ type: 'string', value: user.address }]
              }
            },
            user.privateKey,
            env.network
          );
        }
      );
      await step('check TARGET', async () => {
        expect(
          await getDataValue(contract, 'TARGET', env.network)
        ).to.be.equal(startTarget);
      });
    });

    it('should throw when wrong target address', async () => {
      const contract = getContractByName('waves_staking_adapter', this.parent?.ctx);
      const startTarget = await getDataValue(contract, 'TARGET', env.network);
      await stepIgnoreErrorByMessage(
        'try to invoke setTarget',
        'Error while executing dApp: setTarget: invalid target address',
        async () => {
          await setTarget('ololo');
        }
      );
      await step('check TARGET', async () => {
        expect(
          await getDataValue(contract, 'TARGET', env.network)
        ).to.be.equal(startTarget);
      });
    });

    it('can change target address to the same', async () => {
      const contract = getContractByName('waves_staking_adapter', this.parent?.ctx);
      const startTarget = String(await getDataValue(contract, 'TARGET', env.network));
      await step('invoke setTarget',async () => {
        await setTarget(startTarget);
      });
      await step('check TARGET', async () => {
        expect(
          await getDataValue(contract, 'TARGET', env.network)
        ).to.be.equal(startTarget);
      });
    });

    it('can change target address to other', async () => {
      const contract = getContractByName('waves_staking_adapter', this.parent?.ctx);
      const techContract = getContractByName('technical', this.parent?.ctx);
      const user = getAccountByName('morpheus', this.parent?.ctx);
      await step('invoke setTarget',async () => {
        await setTarget(user.address);
      });
      await step('check TARGET', async () => {
        expect(
          await getDataValue(contract, 'TARGET', env.network)
        ).to.be.equal(user.address);
      });
      await step('revert target',async () => {
        await setTarget(techContract.dApp);
      });
      await step('check TARGET', async () => {
        expect(
          await getDataValue(contract, 'TARGET', env.network)
        ).to.be.equal(techContract.dApp);
      });
    });
  });

  describe('setAdaptee tests', function() {
    it('should throw when not self-call', async () => {
      const contract = getContractByName('waves_staking_adapter', this.parent?.ctx);
      const user = getAccountByName('neo', this.parent?.ctx);
      const startAdaptee = await getDataValue(contract, 'ADAPTEE', env.network);
      await stepIgnoreErrorByMessage(
        'try to invoke setAdaptee',
        'Error while executing dApp: setAdaptee: permission denied',
        async () => {
          await invoke(
            {
              dApp: contract.dApp,
              call: { 
                function: 'setAdaptee',
                args: [{ type: 'string', value: user.address }]
              }
            },
            user.privateKey,
            env.network
          );
        }
      );
      await step('check ADAPTEE', async () => {
        expect(
          await getDataValue(contract, 'ADAPTEE', env.network)
        ).to.be.equal(startAdaptee);
      });
    });

    it('should throw when wrong adaptee address', async () => {
      const contract = getContractByName('waves_staking_adapter', this.parent?.ctx);
      const startAdaptee = await getDataValue(contract, 'ADAPTEE', env.network);
      await stepIgnoreErrorByMessage(
        'try to invoke setAdaptee',
        'Error while executing dApp: setAdaptee: invalid target address',
        async () => {
          await setAdaptee('ololo');
        }
      );
      await step('check ADAPTEE', async () => {
        expect(
          await getDataValue(contract, 'ADAPTEE', env.network)
        ).to.be.equal(startAdaptee);
      });
    });

    it('can change adaptee address to the same', async () => {
      const contract = getContractByName('waves_staking_adapter', this.parent?.ctx);
      const techContract = getContractByName('technical', this.parent?.ctx);
      const startAdaptee = await getDataValue(contract, 'ADAPTEE', env.network);
      await step('invoke setAdaptee',async () => {
        await setAdaptee(techContract.dApp);
      });
      await step('check ADAPTEE', async () => {
        expect(
          await getDataValue(contract, 'ADAPTEE', env.network)
        ).to.be.equal(startAdaptee);
      });
    });

    it('can change adaptee address to other', async () => {
      const contract = getContractByName('waves_staking_adapter', this.parent?.ctx);
      const techContract = getContractByName('technical', this.parent?.ctx);
      const user = getAccountByName('morpheus', this.parent?.ctx);
      await step('invoke setAdaptee',async () => {
        await setAdaptee(user.address);
      });
      await step('check ADAPTEE', async () => {
        expect(
          await getDataValue(contract, 'ADAPTEE', env.network)
        ).to.be.equal(user.address);
      });
      await step('revert adaptee',async () => {
        await setAdaptee(techContract.dApp);
      });
      await step('check ADAPTEE', async () => {
        expect(
          await getDataValue(contract, 'ADAPTEE', env.network)
        ).to.be.equal(techContract.dApp);
      });
    });
  });

  describe('setManager tests', function() {
    it('should throw when not self-call', async () => {
      const contract = getContractByName('waves_staking_adapter', this.parent?.ctx);
      const user = getAccountByName('neo', this.parent?.ctx);
      const startManager = await getDataValue(contract, 'MANAGER', env.network);
      await stepIgnoreErrorByMessage(
        'try to invoke setManager',
        'Error while executing dApp: setManager: permission denied',
        async () => {
          await invoke(
            {
              dApp: contract.dApp,
              call: { 
                function: 'setManager',
                args: [{ type: 'string', value: user.address }]
              }
            },
            user.privateKey,
            env.network
          );
        }
      );
      await step('check MANAGER', async () => {
        expect(
          await getDataValue(contract, 'MANAGER', env.network)
        ).to.be.equal(startManager);
      });
    });

    it('should throw when wrong manager address', async () => {
      const contract = getContractByName('waves_staking_adapter', this.parent?.ctx);
      const startManager = await getDataValue(contract, 'MANAGER', env.network);
      await stepIgnoreErrorByMessage(
        'try to invoke setManager',
        'Error while executing dApp: setManager: invalid target address',
        async () => {
          await setManager('ololo');
        }
      );
      await step('check MANAGER', async () => {
        expect(
          await getDataValue(contract, 'MANAGER', env.network)
        ).to.be.equal(startManager);
      });
    });

    it('can change manager address to the same', async () => {
      const contract = getContractByName('waves_staking_adapter', this.parent?.ctx);
      const startManager = String(await getDataValue(contract, 'MANAGER', env.network));
      await step('invoke setManager',async () => {
        await setManager(startManager);
      });
      await step('check MANAGER', async () => {
        expect(
          await getDataValue(contract, 'MANAGER', env.network)
        ).to.be.equal(startManager);
      });
    });

    it('can change manager address to other', async () => {
      const contract = getContractByName('waves_staking_adapter', this.parent?.ctx);
      const techContract = getContractByName('technical', this.parent?.ctx);
      const user = getAccountByName('morpheus', this.parent?.ctx);
      await step('invoke setManager',async () => {
        await setManager(user.address);
      });
      await step('check MANAGER', async () => {
        expect(
          await getDataValue(contract, 'MANAGER', env.network)
        ).to.be.equal(user.address);
      });
      await step('revert manager',async () => {
        await setManager(techContract.dApp);
      });
      await step('check MANAGER', async () => {
        expect(
          await getDataValue(contract, 'MANAGER', env.network)
        ).to.be.equal(techContract.dApp);
      });
    });
  });

  describe('setFeeRate tests', function() {
    it('should throw when not self-call', async () => {
      const contract = getContractByName('waves_staking_adapter', this.parent?.ctx);
      const user = getAccountByName('neo', this.parent?.ctx);
      const startFeeRate = await getDataValue(contract, 'FEE_RATE', env.network);
      await stepIgnoreErrorByMessage(
        'try to invoke setFeeRate',
        'Error while executing dApp: setFeeRate: permission denied',
        async () => {
          await invoke(
            {
              dApp: contract.dApp,
              call: { 
                function: 'setFeeRate',
                args: [{ type: 'integer', value: 376 }]
              }
            },
            user.privateKey,
            env.network
          );
        }
      );
      await step('check FEE_RATE', async () => {
        expect(
          await getDataValue(contract, 'FEE_RATE', env.network)
        ).to.be.equal(startFeeRate);
      });
    });

    it('should throw when rate < 0', async () => {
      await stepIgnoreErrorByMessage(
        'try to set rate < 0',
        'Error while executing dApp: setFeeRate: invalid infrastructure fee',
        async () => {
          await setFeeRate(-1);
        }
      );
    });

    it('should throw when rate > PERCENT_FACTOR', async () => {
      await stepIgnoreErrorByMessage(
        'try to set rate < 0',
        'Error while executing dApp: setFeeRate: invalid infrastructure fee',
        async () => {
          await setFeeRate(10001);
        }
      );
    });

    it('should set rate = 0', async () => {
      const contract = getContractByName('waves_staking_adapter', this.parent?.ctx);
      const startRate = Number(await getDataValue(contract, 'FEE_RATE', env.network));
      await step('set zero rate', async () => {
        await setFeeRate(0);
      });
      await step('check rate', async () => {
        expect(
          await getDataValue(contract, 'FEE_RATE', env.network)
        ).to.be.equal(0);
      });
      await step('revert rate', async () => {
        await setFeeRate(startRate);
      });
      await step('check rate', async () => {
        expect(
          await getDataValue(contract, 'FEE_RATE', env.network)
        ).to.be.equal(startRate);
      });
    });

    // Why it need?
    it('should set rate = PERCENT_FACTOR', async () => {
      const contract = getContractByName('waves_staking_adapter', this.parent?.ctx);
      const startRate = Number(await getDataValue(contract, 'FEE_RATE', env.network));
      await step('set max rate', async () => {
        await setFeeRate(10000);
      });
      await step('check rate', async () => {
        expect(
          await getDataValue(contract, 'FEE_RATE', env.network)
        ).to.be.equal(10000);
      });
      await step('revert rate', async () => {
        await setFeeRate(startRate);
      });
      await step('check rate', async () => {
        expect(
          await getDataValue(contract, 'FEE_RATE', env.network)
        ).to.be.equal(startRate);
      });
    });
  });
});