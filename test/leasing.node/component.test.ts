import {
  getAccountByName,
  getBalance,
  getContractByName,
  getDataValue,
  invoke,
  transfer
} from '@pepe-team/waves-sc-test-utils';
import { base58Encode } from '@waves/ts-lib-crypto';
import { expect } from 'chai';
import {
  step,
  stepIgnoreErrorByMessage
} from 'relax-steps-allure';
import { getEnvironment } from 'relax-env-json';
import { claim, setClaimer, setMultisig } from '../../steps/leasing.node.new';
import { setSignedContext, signedTransfer } from '../../steps/common';
const env = getEnvironment();

describe('Leasing node', function() {
  // describe('init tests', function() {});

  describe('setMultisig tests', function() {
    it('should throw when not self-call', async () => {
      const contract = getContractByName('leasing_node', this.parent?.ctx);
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
      const contract = getContractByName('leasing_node', this.parent?.ctx);
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
      const contract = getContractByName('leasing_node', this.parent?.ctx);
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
      const contract = getContractByName('leasing_node', this.parent?.ctx);
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

  describe('setClaimer tests', function() {
    it('should throw when not self-call', async () => {
      const contract = getContractByName('leasing_node', this.parent?.ctx);
      const user = getAccountByName('neo', this.parent?.ctx);
      const startClaimer = await getDataValue(contract, 'CLAIMER', env.network);
      await stepIgnoreErrorByMessage(
        'try to invoke setClaimer',
        'Error while executing dApp: setClaimer: permission denied',
        async () => {
          await invoke(
            {
              dApp: contract.dApp,
              call: { 
                function: 'setClaimer',
                args: [{ type: 'string', value: base58Encode(user.address) }]
              }
            },
            user.privateKey,
            env.network
          );
        }
      );
      await step('check CLAIMER', async () => {
        expect(
          await getDataValue(contract, 'CLAIMER', env.network)
        ).to.be.equal(startClaimer);
      });
    });

    it('should throw when wrong claimer address', async () => {
      const contract = getContractByName('leasing_node', this.parent?.ctx);
      const startClaimer = await getDataValue(contract, 'CLAIMER', env.network);
      await stepIgnoreErrorByMessage(
        'try to invoke setClaimer',
        'Error while executing dApp: setClaimer: invalid claimer address',
        async () => {
          await setClaimer('ololo');
        }
      );
      await step('check CLAIMER', async () => {
        expect(
          await getDataValue(contract, 'CLAIMER', env.network)
        ).to.be.equal(startClaimer);
      });
    });

    it('can change claimer address to the same', async () => {
      const contract = getContractByName('leasing_node', this.parent?.ctx);
      const startClaimer = String(await getDataValue(contract, 'CLAIMER', env.network));
      await step('invoke setMultisig', async () => {
        await setClaimer(startClaimer);
      });
      await step('check CLAIMER', async () => {
        expect(
          await getDataValue(contract, 'CLAIMER', env.network)
        ).to.be.equal(startClaimer);
      });
    });

    it('can change claimer address to various', async () => {
      const contract = getContractByName('leasing_node', this.parent?.ctx);
      const techContract = getContractByName('technical', this.parent?.ctx);
      const user = getAccountByName('neo', this.parent?.ctx);
      await step('invoke setClaimer', async () => {
        await setClaimer(user.address);
      });
      await step('check CLAIMER', async () => {
        expect(
          await getDataValue(contract, 'CLAIMER', env.network)
        ).to.be.equal(user.address);
      });
      await step('revert claimer address', async () => {
        await setClaimer(techContract.dApp);
      });
      await step('check CLAIMER', async () => {
        expect(
          await getDataValue(contract, 'CLAIMER', env.network)
        ).to.be.equal(techContract.dApp);
      });
    });
  });

  describe('claim tests', function() {
    it('should throw when call no-claimer', async () => {
      const contract = getContractByName('leasing_node', this.parent?.ctx);
      const techContract = getContractByName('technical', this.parent?.ctx);
      const user = getAccountByName('max', this.parent?.ctx);
      await step('set right claimer', async () => {
        await setSignedContext(
          contract,
          {
            data: [
              { key: 'CLAIMER', type: 'string', value: base58Encode(techContract.dApp) }
            ]
          }
        );
      });
      await stepIgnoreErrorByMessage(
        'try to invoke claim',
        'Error while executing dApp: claim: permission denied',
        async () => {
          await claim(1366, user.privateKey);
        }
      );
    });

    it('should throw when amount <= 0', async () => {
      const techContract = getContractByName('technical', this.parent?.ctx);
      await stepIgnoreErrorByMessage(
        'try to invoke claim',
        'Error while executing dApp: claim: invalid amount',
        async () => {
          await claim(0, { privateKey: techContract.privateKey });
        }
      );
    });

    it('should throw when amount > node balance', async () => {
      const contract = getContractByName('leasing_node', this.parent?.ctx);
      const techContract = getContractByName('technical', this.parent?.ctx);
      const nodeBalance = await getBalance(contract.dApp, env.network);
      await stepIgnoreErrorByMessage(
        'try to invoke claim',
        'Error while executing dApp: claim: invalid amount',
        async () => {
          await claim(nodeBalance + 1, { privateKey: techContract.privateKey });
        }
      );
    });

    it('can claim 1 satoshi', async () => {
      const contract = getContractByName('leasing_node', this.parent?.ctx);
      const techContract = getContractByName('technical', this.parent?.ctx);
      const techUser = getAccountByName('tech_acc', this.parent?.ctx);
      const balance = 1366136600;
      await step('set claimer', async () => {
        await setSignedContext(
          contract,
          {
            data: [
              { key: 'CLAIMER', type: 'string', value: base58Encode(techUser.address) }
            ]
          }
        );
      });
      const startNodeBalance = await getBalance(contract.dApp, env.network);
      await step('set node balance', async () => {
        await transfer(
          {
            recipient: contract.dApp,
            amount: 10000000000
          },
          techUser.privateKey,
          env.network
        );
        await signedTransfer(
          {
            address: contract.dApp,
            publicKey: contract.publicKey,
            privateKey: contract.privateKey
          },
          techUser.address,
          await getBalance(contract.dApp, env.network) - env.network.transferFee - balance
        );
      });
      const startClaimerBalance = await getBalance(techUser.address, env.network);
      await step('invoke claim', async () => {
        await claim(1, techUser.privateKey);
      });
      await step('check balances', async () => {
        expect(
          await getBalance(techUser.address, env.network)
        ).to.be.equal(startClaimerBalance + 1 - env.network.invokeFee);
        expect(
          await getBalance(contract.dApp, env.network)
        ).to.be.equal(balance - 1);
      });
      await step('revert node balance', async () => {
        await transfer(
          {
            recipient: contract.dApp,
            amount: startNodeBalance - balance
          },
          techUser.privateKey,
          env.network
        );
      });
      await step('revert claimer', async () => {
        await setSignedContext(
          contract,
          {
            data: [
              { key: 'CLAIMER', type: 'string', value: base58Encode(techContract.dApp) }
            ]
          }
        );
      });
    });

    it('can claim all balance', async () => {
      const contract = getContractByName('leasing_node', this.parent?.ctx);
      const techContract = getContractByName('technical', this.parent?.ctx);
      const techUser = getAccountByName('tech_acc', this.parent?.ctx);
      const balance = 1366136600;
      await step('set claimer', async () => {
        await setSignedContext(
          contract,
          {
            data: [
              { key: 'CLAIMER', type: 'string', value: base58Encode(techUser.address) }
            ]
          }
        );
      });
      const startNodeBalance = await getBalance(contract.dApp, env.network);
      await step('set node balance', async () => {
        await transfer(
          {
            recipient: contract.dApp,
            amount: 10000000000
          },
          techUser.privateKey,
          env.network
        );
        await signedTransfer(
          {
            address: contract.dApp,
            publicKey: contract.publicKey,
            privateKey: contract.privateKey
          },
          techUser.address,
          await getBalance(contract.dApp, env.network) - env.network.transferFee - balance
        );
      });
      const startClaimerBalance = await getBalance(techUser.address, env.network);
      await step('invoke claim', async () => {
        await claim(balance, techUser.privateKey);
      });
      await step('check balances', async () => {
        expect(
          await getBalance(techUser.address, env.network)
        ).to.be.equal(startClaimerBalance + balance - env.network.invokeFee);
        expect(
          await getBalance(contract.dApp, env.network)
        ).to.be.equal(0);
      });
      await step('revert node balance', async () => {
        await transfer(
          {
            recipient: contract.dApp,
            amount: startNodeBalance
          },
          techUser.privateKey,
          env.network
        );
      });
      await step('revert claimer', async () => {
        await setSignedContext(
          contract,
          {
            data: [
              { key: 'CLAIMER', type: 'string', value: base58Encode(techContract.dApp) }
            ]
          }
        );
      });
    });
  });

  // describe('verification tests', function() {});
});