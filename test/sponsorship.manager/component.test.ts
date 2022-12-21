import {
  Asset,
  getAccountByName,
  getAssetBalance,
  getBalance,
  getContractByName,
  getDataValue,
  invoke,
  LONG,
  transfer
} from '@pepe-team/waves-sc-test-utils';
import { base58Encode } from '@waves/ts-lib-crypto';
import { expect } from 'chai';
import {
  step,
  stepCatchError,
  stepIgnoreErrorByMessage
} from 'relax-steps-allure';
import {
  checkpointSponsorship,
  mintTestAsset,
  setMockAsset,
  setMultisig,
  setupSponsorship,
  updateSponsorshipMock,
  updateWithdrawMock
} from '../../steps/sponsorship.manager';
import { getEnvironment } from 'relax-env-json';
import {
  getAssetContractBalance,
  prepareInvokeTx,
  sendTransaction,
  setSignedContext,
  setTxSign
} from '../../steps/common';
const env = getEnvironment();

// TODO: CHECK MATH in e2e
describe('Sponsorship Manager', function() {
  describe('verification tests', function() {
    it('simple positive (status true)', async () => {
      const contract = getContractByName('sponsorship_manager', this.parent?.ctx);
      let tx: any;
      await step('create reinit transaction', async () => {
        tx = prepareInvokeTx(
          {
            dApp: contract.dApp,
            call: {
              function: 'setMultisig',
              args: [{ type: 'string', value: base58Encode('abc123') }]
            }
          },
          {privateKey: contract.privateKey}
        );
      });
      await step('sign reinit tx', async () => {
        await setTxSign(contract.dApp, tx.id);
      });
      await stepIgnoreErrorByMessage(
        'reinit contract',
        'Error while executing dApp: setMultisig: invalid multisig address',
        async () => {
          await sendTransaction(tx);
        }
      );
    });
    
    it('should throw when status no true', async () => {
      const contract = getContractByName('sponsorship_manager', this.parent?.ctx);
      let tx: any;
      await step('create reinit transaction', async () => {
        tx = prepareInvokeTx(
          {
            dApp: contract.dApp,
            call: {
              function: 'setMultisig',
              args: [{ type: 'string', value: base58Encode('abc123') }]
            }
          },
          {privateKey: contract.privateKey}
        );
      });
      await step('set reinit tx sign with false value', async () => {
        await setTxSign(contract.dApp, tx.id, false);
      });
      await stepIgnoreErrorByMessage(
        'reinit contract',
        'Transaction is not allowed by account-script',
        async () => {
          await sendTransaction(tx);
        }
      );
    });
    
    it('should throw when have no status', async () => {
      const contract = getContractByName('sponsorship_manager', this.parent?.ctx);
      let tx: any;
      await step('create reinit transaction', async () => {
        tx = prepareInvokeTx(
          {
            dApp: contract.dApp,
            call: {
              function: 'setMultisig',
              args: [{ type: 'string', value: base58Encode('abc123') }]
            }
          },
          {privateKey: contract.privateKey}
        );
      });
      await stepIgnoreErrorByMessage(
        'reinit contract',
        'Transaction is not allowed by account-script',
        async () => {
          await sendTransaction(tx);
        }
      );
    });
  });

  describe('setupSponsorship tests', function() {
    it('should throw when not self-call', async () => {
      const contract = getContractByName('sponsorship_manager', this.parent?.ctx);
      const user = getAccountByName('morpheus', this.parent?.ctx);
      await stepIgnoreErrorByMessage(
        'try to invoke setupSponsorship',
        'Error while executing dApp: setupSponsorship: permission denied',
        async () => {
          await invoke(
            {
              dApp: contract.dApp,
              call: { 
                function: 'setupSponsorship',
                args: [
                  { type: 'string', value: 'token contract' },
                  { type: 'integer', value: 0 },
                  { type: 'integer', value: 0 },
                  { type: 'integer', value: 0 },
                  { type: 'string', value: 'beneficiary' },
                ]
              }
            },
            user.privateKey,
            env.network
          );
        }
      );
    });

    it('should throw when wrong token address', async () => {
      const techContract = getContractByName('technical', this.parent?.ctx);
      await stepIgnoreErrorByMessage(
        'try to invoke setupSponsorship',
        'Error while executing dApp: setupSponsorship: invalid token contract',
        async () => {
          await setupSponsorship(
            base58Encode('aaaaaaaaaaa'),
            500000,
            1000000000,
            100000000,
            techContract.dApp
          );
        }
      );
    });

    it('should throw when invalid fee value', async () => {
      const techContract = getContractByName('technical', this.parent?.ctx);
      await stepIgnoreErrorByMessage(
        'try to invoke setupSponsorship',
        'Error while executing dApp: setupSponsorship: invalid min sponsored asset fee',
        async () => {
          await setupSponsorship(
            base58Encode(techContract.dApp),
            -1,
            1000000000,
            100000000,
            techContract.dApp
          );
        }
      );
    });

    it('should throw when invalid sponsored WAVES amount', async () => {
      const techContract = getContractByName('technical', this.parent?.ctx);
      await stepIgnoreErrorByMessage(
        'try to invoke setupSponsorship',
        'Error while executing dApp: setupSponsorship: invalid sponsored waves',
        async () => {
          await setupSponsorship(
            base58Encode(techContract.dApp),
            500000,
            -1,
            100000000,
            techContract.dApp
          );
        }
      );
    });

    it('should throw when invalid treshold WAVES amount', async () => {
      const techContract = getContractByName('technical', this.parent?.ctx);
      await stepIgnoreErrorByMessage(
        'try to invoke setupSponsorship',
        'Error while executing dApp: setupSponsorship: invalid threshold waves',
        async () => {
          await setupSponsorship(
            base58Encode(techContract.dApp),
            500000,
            1000000000,
            -1,
            techContract.dApp
          );
        }
      );
    });

    it('should throw when wrong beneficiary address', async () => {
      const techContract = getContractByName('technical', this.parent?.ctx);
      await stepIgnoreErrorByMessage(
        'try to invoke setupSponsorship',
        'Error while executing dApp: setupSponsorship: invalid beneficiary address',
        async () => {
          await setupSponsorship(
            base58Encode(techContract.dApp),
            500000,
            1000000000,
            100000000,
            base58Encode('cccccccccccccccccccc')
          );
        }
      );
    });

    it('simple positive', async () => {
      const techContract = getContractByName('technical', this.parent?.ctx);
      const contract = getContractByName('sponsorship_manager', this.parent?.ctx);
      const delta = 100000000;
      await step('set mock', async () => {
        await setMockAsset(techContract, 'sWAVES', 'sWAVES description');
        await updateSponsorshipMock(techContract, true);
      });
      const startMockBalance = await getBalance(techContract.dApp, env.network);
      const startContractBalance = await getBalance(contract.dApp, env.network);
      const sponsoredWaves = startMockBalance + delta;
      await step(
        'invoke setupSponsorship',
        async () => {
          await setupSponsorship(
            base58Encode(techContract.dApp),
            500000,
            sponsoredWaves,
            sponsoredWaves,
            base58Encode(contract.dApp)
          );
        }
      );
      await step('check balances', async () => {
        expect(await getBalance(techContract.dApp, env.network)).to.be.equal(sponsoredWaves);
        expect(await getBalance(contract.dApp, env.network))
          .to.be.equal(startContractBalance - delta - env.network.invokeFee);
      });
    });

    it('no transfers when sponsoredWaves = tokenized balance', async () => {
      const techContract = getContractByName('technical', this.parent?.ctx);
      const contract = getContractByName('sponsorship_manager', this.parent?.ctx);
      const manager = getAccountByName('manager', this.parent?.ctx);
      await step('set mock', async () => {
        await updateSponsorshipMock(techContract, true);
      });
      const startMockBalance = await getBalance(techContract.dApp, env.network);
      const startContractBalance = await getBalance(contract.dApp, env.network);
      await step(
        'invoke setupSponsorship',
        async () => {
          await setupSponsorship(
            base58Encode(techContract.dApp),
            450000,
            startMockBalance,
            startMockBalance,
            base58Encode(manager.address)
          );
        }
      );
      await step('check balances', async () => {
        expect(await getBalance(contract.dApp, env.network)).to.be.equal(startContractBalance - env.network.invokeFee);
        expect(await getBalance(techContract.dApp, env.network)).to.be.equal(startMockBalance);
      });
    });

    it('no transfers when sponsoredWaves = 0', async () => {
      const techContract = getContractByName('technical', this.parent?.ctx);
      const contract = getContractByName('sponsorship_manager', this.parent?.ctx);
      await step('set mock', async () => {
        await updateSponsorshipMock(techContract, true);
      });
      const startBeneficiaryBalance = await getBalance(techContract.dApp, env.network);
      const startContractBalance = await getBalance(contract.dApp, env.network);
      await step(
        'invoke setupSponsorship',
        async () => {
          await setupSponsorship(
            base58Encode(techContract.dApp),
            450000,
            0,
            0,
            base58Encode(techContract.dApp)
          );
        }
      );
      await step('check balances', async () => {
        expect(await getBalance(techContract.dApp, env.network)).to.be.equal(startBeneficiaryBalance);
        expect(await getBalance(contract.dApp, env.network)).to.be.equal(startContractBalance - env.network.invokeFee);
      });
    });

    it('should throw when broken updateSponsorship invoke', async () => {
      const techContract = getContractByName('technical', this.parent?.ctx);
      const contract = getContractByName('sponsorship_manager', this.parent?.ctx);
      await step('set mock', async () => {
        await updateSponsorshipMock(techContract, false);
      });
      const startBeneficiaryBalance = await getBalance(techContract.dApp, env.network);
      const startContractBalance = await getBalance(contract.dApp, env.network);
      const isError = await stepCatchError(
        'invoke setupSponsorship',
        async () => {
          await setupSponsorship(
            base58Encode(techContract.dApp),
            450000,
            0,
            100000000,
            base58Encode(techContract.dApp)
          );
        }
      );
      await step('check error', async () => {
        expect(isError).is.true;
      });
      await step('check balances', async () => {
        expect(await getBalance(techContract.dApp, env.network)).to.be.equal(startBeneficiaryBalance);
        expect(await getBalance(contract.dApp, env.network)).to.be.equal(startContractBalance);
      });
    });
  });

  describe('checkpointSponsorship tests', async () => {
    it('should throw when wrong token contract address', async () => {
      const techContract = getContractByName('technical', this.parent?.ctx);
      const contract = getContractByName('sponsorship_manager', this.parent?.ctx);
      const techUser = getAccountByName('tech_acc', this.parent?.ctx);
      const manager = getAccountByName('manager', this.parent?.ctx);
      const delta = 100000000;
      await step('set mock', async () => {
        await setMockAsset(techContract, 'sWAVES', 'sWAVES description');
        await updateSponsorshipMock(techContract, true);
      });
      await step('set state', async () => {
        const assetId = await getDataValue(techContract, 'ASSET', env.network);
        const sponsoredWaves = await getBalance(techContract.dApp, env.network) + delta;
        const value_ = techContract.dApp + '__' + assetId + '__500000__' + sponsoredWaves + '__1000000000__' + manager.address;
        await setSignedContext(
          contract,
          {
            data: [
              { key: `SPONSORSHIP__${techContract.dApp}`, type: 'string', value: value_ }
            ]
          }
        );
      });
      const startContractBalance = await getBalance(contract.dApp, env.network);
      const startMockBalance = await getBalance(techContract.dApp, env.network);
      const startBeneficiaryBalance = await getBalance(manager.address, env.network);
      const startTechuserBalance = await getBalance(techUser.address, env.network);
      await stepIgnoreErrorByMessage(
        'try to invoke checkpointSponsorship',
        'Error while executing dApp: checkpointSponsorship: invalid token contract',
        async () => {
          await checkpointSponsorship(
            base58Encode('ababababa'),
            techUser.privateKey
          );
        }
      );
      await step('check balances', async () => {
        expect(await getBalance(contract.dApp, env.network)).to.be.equal(startContractBalance);
        expect(await getBalance(techContract.dApp, env.network)).to.be.equal(startMockBalance);
        expect(await getBalance(manager.address, env.network)).to.be.equal(startBeneficiaryBalance);
        expect(await getBalance(techUser.address, env.network)).to.be.equal(startTechuserBalance);
      });
    });

    it('should throw when token contract address is incorrect', async () => {
      const techContract = getContractByName('technical', this.parent?.ctx);
      const contract = getContractByName('sponsorship_manager', this.parent?.ctx);
      const techUser = getAccountByName('tech_acc', this.parent?.ctx);
      const manager = getAccountByName('manager', this.parent?.ctx);
      const delta = 100000000;
      await step('set mock', async () => {
        await setMockAsset(techContract, 'sWAVES', 'sWAVES description');
        await updateSponsorshipMock(techContract, true);
      });
      await step('set state', async () => {
        const assetId = await getDataValue(techContract, 'ASSET', env.network);
        const sponsoredWaves = await getBalance(techContract.dApp, env.network) + delta;
        const value_ = techContract.dApp + '__' + assetId + '__500000__' + sponsoredWaves + '__1000000000__' + manager.address;
        await setSignedContext(
          contract,
          {
            data: [
              { key: `SPONSORSHIP__${techContract.dApp}`, type: 'string', value: value_ }
            ]
          }
        );
      });
      const startContractBalance = await getBalance(contract.dApp, env.network);
      const startMockBalance = await getBalance(techContract.dApp, env.network);
      const startBeneficiaryBalance = await getBalance(manager.address, env.network);
      const startTechuserBalance = await getBalance(techUser.address, env.network);
      await stepIgnoreErrorByMessage(
        'try to invoke checkpointSponsorship',
        'Error while executing dApp: _loadSponsorship: no sponsorship',
        async () => {
          await checkpointSponsorship(
            base58Encode(manager.address),
            techUser.privateKey
          );
        }
      );
      await step('check balances', async () => {
        expect(await getBalance(contract.dApp, env.network)).to.be.equal(startContractBalance);
        expect(await getBalance(techContract.dApp, env.network)).to.be.equal(startMockBalance);
        expect(await getBalance(manager.address, env.network)).to.be.equal(startBeneficiaryBalance);
        expect(await getBalance(techUser.address, env.network)).to.be.equal(startTechuserBalance);
      });
    });

    it('should throw when no treshold', async () => {
      const techContract = getContractByName('technical', this.parent?.ctx);
      const contract = getContractByName('sponsorship_manager', this.parent?.ctx);
      const techUser = getAccountByName('tech_acc', this.parent?.ctx);
      const manager = getAccountByName('manager', this.parent?.ctx);
      const delta = 100000000;
      await step('set mock', async () => {
        await setMockAsset(techContract, 'sWAVES', 'sWAVES description');
        await updateSponsorshipMock(techContract, true);
      });
      await step('set state', async () => {
        const assetId = await getDataValue(techContract, 'ASSET', env.network);
        const sponsoredWaves = await getBalance(techContract.dApp, env.network) + delta;
        const thresholdWaves = await getBalance(techContract.dApp, env.network) - delta;
        const value_ = techContract.dApp + '__' + assetId + '__500000__' + sponsoredWaves + '__' + thresholdWaves + '__' + manager.address;
        await setSignedContext(
          contract,
          {
            data: [
              { key: `SPONSORSHIP__${techContract.dApp}`, type: 'string', value: value_ }
            ]
          }
        );
      });
      const startContractBalance = await getBalance(contract.dApp, env.network);
      const startMockBalance = await getBalance(techContract.dApp, env.network);
      const startBeneficiaryBalance = await getBalance(manager.address, env.network);
      const startTechuserBalance = await getBalance(techUser.address, env.network);
      await stepIgnoreErrorByMessage(
        'try to invoke checkpointSponsorship',
        'Error while executing dApp: checkpointSponsorship: no threshold has been reached',
        async () => {
          await checkpointSponsorship(
            base58Encode(techContract.dApp),
            techUser.privateKey
          );
        }
      );
      await step('check balances', async () => {
        expect(await getBalance(contract.dApp, env.network)).to.be.equal(startContractBalance);
        expect(await getBalance(techContract.dApp, env.network)).to.be.equal(startMockBalance);
        expect(await getBalance(manager.address, env.network)).to.be.equal(startBeneficiaryBalance);
        expect(await getBalance(techUser.address, env.network)).to.be.equal(startTechuserBalance);
      });
    });

    it('should throw when updateSponsorship invoke error', async () => {
      const techContract = getContractByName('technical', this.parent?.ctx);
      const contract = getContractByName('sponsorship_manager', this.parent?.ctx);
      const techUser = getAccountByName('tech_acc', this.parent?.ctx);
      const manager = getAccountByName('manager', this.parent?.ctx);
      const delta = 100000000;
      await step('set mock', async () => {
        await setMockAsset(techContract, 'sWAVES', 'sWAVES description');
        await updateSponsorshipMock(techContract, false);
      });
      await step('set state', async () => {
        const assetId = await getDataValue(techContract, 'ASSET', env.network);
        const sponsoredWaves = await getBalance(techContract.dApp, env.network) + delta;
        const thresholdWaves = await getBalance(techContract.dApp, env.network) + delta;
        const value_ = techContract.dApp + '__' + assetId + '__500000__' + sponsoredWaves + '__' + thresholdWaves + '__' + manager.address;
        await setSignedContext(
          contract,
          {
            data: [
              { key: `SPONSORSHIP__${techContract.dApp}`, type: 'string', value: value_ }
            ]
          }
        );
      });
      const startContractBalance = await getBalance(contract.dApp, env.network);
      const startMockBalance = await getBalance(techContract.dApp, env.network);
      const startBeneficiaryBalance = await getBalance(manager.address, env.network);
      const startTechuserBalance = await getBalance(techUser.address, env.network);
      const isError = await stepCatchError(
        'try to invoke checkpointSponsorship',
        async () => {
          await checkpointSponsorship(
            base58Encode(techContract.dApp),
            techUser.privateKey
          );
        }
      );
      await step('check error', async () => {
        expect(isError).is.true;
      });
      await step('check balances', async () => {
        expect(await getBalance(contract.dApp, env.network)).to.be.equal(startContractBalance);
        expect(await getBalance(techContract.dApp, env.network)).to.be.equal(startMockBalance);
        expect(await getBalance(manager.address, env.network)).to.be.equal(startBeneficiaryBalance);
        expect(await getBalance(techUser.address, env.network)).to.be.equal(startTechuserBalance);
      });
    });

    it('should throw when withdraw was broken', async () => {
      const techContract = getContractByName('technical', this.parent?.ctx);
      const contract = getContractByName('sponsorship_manager', this.parent?.ctx);
      const techUser = getAccountByName('tech_acc', this.parent?.ctx);
      const manager = getAccountByName('manager', this.parent?.ctx);
      const delta = 100000000;
      await step('set mock', async () => {
        await setMockAsset(techContract, 'sWAVES', 'sWAVES description');
        await updateSponsorshipMock(techContract, true);
        await updateWithdrawMock(techContract, false);
      });
      await step('set state', async () => {
        const assetId = await getDataValue(techContract, 'ASSET', env.network);
        const sponsoredWaves = await getBalance(techContract.dApp, env.network) + delta;
        const thresholdWaves = await getBalance(techContract.dApp, env.network) + delta;
        const value_ = techContract.dApp + '__' + assetId + '__500000__' + sponsoredWaves + '__' + thresholdWaves + '__' + manager.address;
        await setSignedContext(
          contract,
          {
            data: [
              { key: `SPONSORSHIP__${techContract.dApp}`, type: 'string', value: value_ }
            ]
          }
        );
      });
      const startContractBalance = await getBalance(contract.dApp, env.network);
      const startMockBalance = await getBalance(techContract.dApp, env.network);
      const startBeneficiaryBalance = await getBalance(manager.address, env.network);
      const startTechuserBalance = await getBalance(techUser.address, env.network);
      const isError = await stepCatchError(
        'try to invoke checkpointSponsorship',
        // 'Error while executing dApp: checkpointSponsorship: invocation error',
        async () => {
          await checkpointSponsorship(
            base58Encode(techContract.dApp),
            techUser.privateKey
          );
        }
      );
      await step('check error', async () => {
        expect(isError).is.true;
      });
      await step('check balances', async () => {
        expect(await getBalance(contract.dApp, env.network)).to.be.equal(startContractBalance);
        expect(await getBalance(techContract.dApp, env.network)).to.be.equal(startMockBalance);
        expect(await getBalance(manager.address, env.network)).to.be.equal(startBeneficiaryBalance);
        expect(await getBalance(techUser.address, env.network)).to.be.equal(startTechuserBalance);
      });
    });

    it('simple positive', async () => {
      const techContract = getContractByName('technical', this.parent?.ctx);
      const contract = getContractByName('sponsorship_manager', this.parent?.ctx);
      const techUser = getAccountByName('tech_acc', this.parent?.ctx);
      const manager = getAccountByName('manager', this.parent?.ctx);
      const delta = 100000000;
      await step('set mock', async () => {
        await setMockAsset(techContract, 'sWAVES', 'sWAVES description');
        await updateSponsorshipMock(techContract, true);
        await updateWithdrawMock(techContract, true);
      });
      let startMockBalance = await getBalance(techContract.dApp, env.network);
      const sponsoredWaves = startMockBalance + 2 * delta - env.network.invokeFee;
      const thresholdWaves = startMockBalance + delta - env.network.invokeFee;
      const assetId = await getDataValue(techContract, 'ASSET', env.network);
      await step('set state', async () => {
        const value_ = techContract.dApp + '__' + assetId + '__500000__' + sponsoredWaves + '__' + thresholdWaves + '__' + manager.address;
        await setSignedContext(
          contract,
          {
            data: [
              { key: `SPONSORSHIP__${techContract.dApp}`, type: 'string', value: value_ }
            ]
          }
        );
      });
      startMockBalance = await getBalance(techContract.dApp, env.network);
      const startContractBalance = await getBalance(contract.dApp, env.network);
      const startBeneficiaryBalance = await getBalance(manager.address, env.network);
      const startTechuserBalance = await getBalance(techUser.address, env.network);
      await step(
        'invoke checkpointSponsorship',
        async () => {
          await checkpointSponsorship(
            base58Encode(techContract.dApp),
            techUser.privateKey
          );
        }
      );
      await step('check balances', async () => {
        expect(await getBalance(techContract.dApp, env.network)).to.be.equal(sponsoredWaves);
        expect(await getBalance(manager.address, env.network)).to.be.equal(startBeneficiaryBalance);
        expect(await getBalance(techUser.address, env.network)).to.be.equal(startTechuserBalance - env.network.invokeFee);
        expect(await getBalance(contract.dApp, env.network)).to.be.equal(startContractBalance - (sponsoredWaves - startMockBalance));
      });
    });

    it('simple positive with sWAVES transfer', async () => {
      const techContract = getContractByName('technical', this.parent?.ctx);
      const contract = getContractByName('sponsorship_manager', this.parent?.ctx);
      const techUser = getAccountByName('tech_acc', this.parent?.ctx);
      const manager = getAccountByName('manager', this.parent?.ctx);
      const delta = 100000000;
      const transferAmt = 100000000;
      await step('set mock', async () => {
        await setMockAsset(techContract, 'sWAVES', 'sWAVES description');
        await updateSponsorshipMock(techContract, true, transferAmt);
        await updateWithdrawMock(techContract, true);
      });
      await step('mint sWAVESes', async () => {
        await mintTestAsset(techContract, contract.dApp, transferAmt);
      });
      let startMockBalance = await getBalance(techContract.dApp, env.network);
      const assetId = await getDataValue(techContract, 'ASSET', env.network);
      const sponsoredWaves = startMockBalance + 2 * delta;
      const thresholdWaves = startMockBalance + delta;
      await step('set state', async () => {
        const value_ = techContract.dApp + '__' + assetId + '__500000__' + sponsoredWaves + '__' + thresholdWaves + '__' + manager.address;
        await setSignedContext(
          contract,
          {
            data: [
              { key: `SPONSORSHIP__${techContract.dApp}`, type: 'string', value: value_ }
            ]
          }
        );
      });
      startMockBalance = await getBalance(techContract.dApp, env.network);
      const startContractBalance = await getBalance(contract.dApp, env.network);
      const startBeneficiaryBalance = await getBalance(manager.address, env.network);
      const startTechuserBalance = await getBalance(techUser.address, env.network);
      const sWaves: Asset = {
        name: 'sWaves',
        description: '',
        quantity: 1,
        decimals: 8,
        assetId: String(await getDataValue(techContract, 'ASSET', env.network))
      };
      const startSWTechBalance = await getAssetContractBalance(sWaves, techContract, env.network);
      await step(
        'invoke checkpointSponsorship',
        async () => {
          await checkpointSponsorship(
            base58Encode(techContract.dApp),
            techUser.privateKey
          );
        }
      );
      await step('check balances', async () => {
        expect(await getBalance(techContract.dApp, env.network)).to.be.equal(sponsoredWaves);
        expect(await getBalance(manager.address, env.network)).to.be.equal(startBeneficiaryBalance);
        expect(await getBalance(techUser.address, env.network)).to.be.equal(startTechuserBalance - env.network.invokeFee);
        expect(
          await getAssetContractBalance(sWaves, techContract, env.network)
        ).to.be.equal(startSWTechBalance + transferAmt);
        expect(await getAssetContractBalance(sWaves, contract, env.network)).to.be.equal(0);
        expect(await getBalance(contract.dApp, env.network)).to.be.equal(startContractBalance - (sponsoredWaves - startMockBalance));
      });
    });

    it('pass with wavesToCharge = 0', async () => {
      const techContract = getContractByName('technical', this.parent?.ctx);
      const contract = getContractByName('sponsorship_manager', this.parent?.ctx);
      const techUser = getAccountByName('tech_acc', this.parent?.ctx);
      const manager = getAccountByName('manager', this.parent?.ctx);
      const delta = 100000000;
      await step('set mock', async () => {
        await setMockAsset(techContract, 'sWAVES', 'sWAVES description');
        await updateSponsorshipMock(techContract, true);
        await updateWithdrawMock(techContract, true);
      });
      let startMockBalance = await getBalance(techContract.dApp, env.network);
      const assetId = await getDataValue(techContract, 'ASSET', env.network);
      const sponsoredWaves = startMockBalance;
      const thresholdWaves = startMockBalance + delta;
      await step('set state', async () => {
        const value_ = techContract.dApp + '__' + assetId + '__500000__' + sponsoredWaves + '__' + thresholdWaves + '__' + manager.address;
        await setSignedContext(
          contract,
          {
            data: [
              { key: `SPONSORSHIP__${techContract.dApp}`, type: 'string', value: value_ }
            ]
          }
        );
      });
      startMockBalance = await getBalance(techContract.dApp, env.network);
      const startContractBalance = await getBalance(contract.dApp, env.network);
      const startBeneficiaryBalance = await getBalance(manager.address, env.network);
      const startTechuserBalance = await getBalance(techUser.address, env.network);
      await step(
        'invoke checkpointSponsorship',
        async () => {
          await checkpointSponsorship(
            base58Encode(techContract.dApp),
            techUser.privateKey
          );
        }
      );
      await step('check balances', async () => {
        expect(await getBalance(manager.address, env.network)).to.be.equal(startBeneficiaryBalance);
        expect(await getBalance(techUser.address, env.network)).to.be.equal(startTechuserBalance - env.network.invokeFee);
        expect(await getBalance(contract.dApp, env.network)).to.be.equal(startContractBalance);
        expect(await getBalance(techContract.dApp, env.network)).to.be.equal(startMockBalance);
      });
    });

    it('pass with wavesToBeneficiary > 0 but less than compensation', async () => {
      const techContract = getContractByName('technical', this.parent?.ctx);
      const contract = getContractByName('sponsorship_manager', this.parent?.ctx);
      const techUser = getAccountByName('tech_acc', this.parent?.ctx);
      const manager = getAccountByName('manager', this.parent?.ctx);
      const transferAmt = 100000000;
      const withdrawAmt = 900000;
      await step('set mock', async () => {
        await setMockAsset(techContract, 'sWAVES', 'sWAVES description');
        await updateSponsorshipMock(techContract, true, transferAmt);
        await updateWithdrawMock(techContract, true, withdrawAmt);
      });
      let assetId: string;
      await step('mint sWAVESes', async () => {
        await mintTestAsset(techContract, contract.dApp, transferAmt);
        await mintTestAsset(techContract, techUser.address, transferAmt);
        assetId = String(await getDataValue(techContract, 'ASSET', env.network));
        expect(transferAmt).is.lessThanOrEqual(await getAssetContractBalance(assetId, contract, env.network));
      });
      const startMockBalance = await getBalance(techContract.dApp, env.network);
      const sponsoredWaves = startMockBalance;
      const thresholdWaves = startMockBalance;
      await step('set state', async () => {
        const value_ = techContract.dApp + '__' + assetId + '__500000__' + sponsoredWaves + '__' + thresholdWaves + '__' + manager.address;
        await setSignedContext(
          contract,
          {
            data: [
              { key: `SPONSORSHIP__${techContract.dApp}`, type: 'string', value: value_ }
            ]
          }
        );
      });
      const startContractBalance = await getBalance(contract.dApp, env.network);
      const startBeneficiaryBalance = await getBalance(manager.address, env.network);
      const startTechuserBalance = await getBalance(techUser.address, env.network);
      await step(
        'invoke checkpointSponsorship',
        async () => {
          await checkpointSponsorship(
            base58Encode(techContract.dApp),
            techUser.privateKey
          );
        }
      );
      await step('check balances', async () => {
        expect(await getBalance(techUser.address, env.network)).to.be.equal(startTechuserBalance - env.network.invokeFee);
        expect(await getBalance(contract.dApp, env.network)).to.be.equal(startContractBalance);
        expect(await getBalance(manager.address, env.network)).to.be.equal(startBeneficiaryBalance + withdrawAmt);
        expect(await getBalance(techContract.dApp, env.network)).to.be.equal(sponsoredWaves);
      });
    });

    it('pass with wavesToBeneficiary > 0 and equal compensation', async () => {
      const techContract = getContractByName('technical', this.parent?.ctx);
      const contract = getContractByName('sponsorship_manager', this.parent?.ctx);
      const techUser = getAccountByName('tech_acc', this.parent?.ctx);
      const manager = getAccountByName('manager', this.parent?.ctx);
      const transferAmt = 100000000;
      const withdrawAmt = 1000000;
      await step('set mock', async () => {
        await setMockAsset(techContract, 'sWAVES', 'sWAVES description');
        await updateSponsorshipMock(techContract, true, transferAmt);
        await updateWithdrawMock(techContract, true, withdrawAmt);
      });
      let assetId: string;
      await step('mint sWAVESes', async () => {
        await mintTestAsset(techContract, contract.dApp, transferAmt);
        await mintTestAsset(techContract, techUser.address, transferAmt);
        assetId = String(await getDataValue(techContract, 'ASSET', env.network));
        expect(transferAmt).is.lessThanOrEqual(await getAssetContractBalance(assetId, contract, env.network));
      });
      const startMockBalance = await getBalance(techContract.dApp, env.network);
      const sponsoredWaves = startMockBalance;
      const thresholdWaves = startMockBalance;
      await step('set state', async () => {
        const value_ = techContract.dApp + '__' + assetId + '__500000__' + sponsoredWaves + '__' + thresholdWaves + '__' + manager.address;
        await setSignedContext(
          contract,
          {
            data: [
              { key: `SPONSORSHIP__${techContract.dApp}`, type: 'string', value: value_ }
            ]
          }
        );
      });
      const startContractBalance = await getBalance(contract.dApp, env.network);
      const startBeneficiaryBalance = await getBalance(manager.address, env.network);
      const startTechuserBalance = await getBalance(techUser.address, env.network);
      await step(
        'invoke checkpointSponsorship',
        async () => {
          await checkpointSponsorship(
            base58Encode(techContract.dApp),
            techUser.privateKey
          );
        }
      );
      await step('check balances', async () => {
        expect(await getBalance(techUser.address, env.network)).to.be.equal(startTechuserBalance - env.network.invokeFee);
        expect(await getBalance(contract.dApp, env.network)).to.be.equal(startContractBalance);
        expect(await getBalance(manager.address, env.network)).to.be.equal(startBeneficiaryBalance + withdrawAmt);
        expect(await getBalance(techContract.dApp, env.network)).to.be.equal(sponsoredWaves);
      });
    });

    it('pass with wavesToBeneficiary > 0 and more than compensation', async () => {
      const techContract = getContractByName('technical', this.parent?.ctx);
      const contract = getContractByName('sponsorship_manager', this.parent?.ctx);
      const techUser = getAccountByName('tech_acc', this.parent?.ctx);
      const manager = getAccountByName('manager', this.parent?.ctx);
      const transferAmt = 100000000;
      const withdrawAmt = 100000000;
      await step('set mock', async () => {
        await setMockAsset(techContract, 'sWAVES', 'sWAVES description');
        await updateSponsorshipMock(techContract, true, transferAmt);
        await updateWithdrawMock(techContract, true, withdrawAmt);
      });
      let assetId: string;
      await step('mint sWAVESes', async () => {
        await mintTestAsset(techContract, contract.dApp, transferAmt);
        await mintTestAsset(techContract, techUser.address, transferAmt);
        assetId = String(await getDataValue(techContract, 'ASSET', env.network));
        expect(transferAmt).is.lessThanOrEqual(await getAssetContractBalance(assetId, contract, env.network));
      });
      const startMockBalance = await getBalance(techContract.dApp, env.network);
      const sponsoredWaves = startMockBalance;
      const thresholdWaves = startMockBalance;
      await step('set state', async () => {
        const value_ = techContract.dApp + '__' + assetId + '__500000__' + sponsoredWaves + '__' + thresholdWaves + '__' + manager.address;
        await setSignedContext(
          contract,
          {
            data: [
              { key: `SPONSORSHIP__${techContract.dApp}`, type: 'string', value: value_ }
            ]
          }
        );
      });
      const startContractBalance = await getBalance(contract.dApp, env.network);
      const startBeneficiaryBalance = await getBalance(manager.address, env.network);
      const startTechuserBalance = await getBalance(techUser.address, env.network);
      await step(
        'invoke checkpointSponsorship',
        async () => {
          await checkpointSponsorship(
            base58Encode(techContract.dApp),
            techUser.privateKey
          );
        }
      );
      await step('check balances', async () => {
        expect(await getBalance(techUser.address, env.network)).to.be.equal(startTechuserBalance + env.network.invokeFee); // because 2 invokeFee compensation
        expect(await getBalance(contract.dApp, env.network)).to.be.equal(startContractBalance);
        expect(await getBalance(manager.address, env.network)).to.be.equal(startBeneficiaryBalance + withdrawAmt - 2 * env.network.invokeFee);
        expect(await getBalance(techContract.dApp, env.network)).to.be.equal(sponsoredWaves);
      });
    });
  });

  describe('setMultisig tests', function() {
    it('should throw when not self-call', async () => {
      const contract = getContractByName('sponsorship_manager', this.parent?.ctx);
      const user = getAccountByName('morpheus', this.parent?.ctx);
      await stepIgnoreErrorByMessage(
        'try to set new multisig',
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
    });

    it('should throw when wrong multisig address', async () => {
      const contract = getContractByName('sponsorship_manager', this.parent?.ctx);
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
      const contract = getContractByName('sponsorship_manager', this.parent?.ctx);
      const startMultisig = String(await getDataValue(contract, 'MULTISIG', env.network));
      await step('invoke setMultisig', async () => {
        await setMultisig(startMultisig);
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
      const contract = getContractByName('sponsorship_manager', this.parent?.ctx);
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
});