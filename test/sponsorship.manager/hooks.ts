import {
  Account,
  Asset,
  Contract,
  createContracts,
  deployScript,
  getLastBlockId,
  initAccounts,
  initAssets,
  setAssetsForAccounts,
  transfer
} from '@pepe-team/waves-sc-test-utils';
import { base58Encode, keyPair } from '@waves/ts-lib-crypto';
import { Context } from 'mocha';
import { getEnvironment } from 'relax-env-json';
import { setSteps } from '../../steps/common';
import {
  deployMultisigContract,
  setTechContract
} from '../../steps/hooks.common';
import { setContract, setMockPayeer, setMultisig } from '../../steps/sponsorship.manager';
const env = getEnvironment();

export type TestContext = Mocha.Context & Context;
export type InjectableContext = Readonly<{
    accounts: Account[];
    assets: Asset[];
    contracts: Contract[];
    start_block: string;
}>;

// eslint-disable-next-line @typescript-eslint/no-var-requires
const initData = require('./data/init.json');
const rootSeed = initData.rootSeed;

export const mochaHooks = async (): Promise<Mocha.RootHookObject> => {
  return {
    async beforeAll(this: Mocha.Context) {
      const assets = await initAssets(env.assets, rootSeed, env.network);
      console.table(assets);
  
      const accounts = await initAccounts(
        rootSeed,
        env.accounts,
        env.amountPerAccount,
        env.network
      );
      await setAssetsForAccounts(
        rootSeed,
        accounts,
        assets,
        env.amountPerAsset,
        env.network
      );
      console.table(accounts);
  
      const init_contracts = createContracts(
        rootSeed,
        env.contracts,
        env.network,
        accounts.length + 1
      );
      const contracts: Contract[] = [];
      const techContract = await setTechContract(init_contracts, rootSeed, 'test/sponsorship.manager/');
      contracts.push(techContract);
      // set mock contract
      setSteps(
        techContract,
        accounts.filter(a => a.name == 'tech_acc')[0]
      );
      // deploy payeer
      contracts.push(await deployPayeerContract(init_contracts, rootSeed, 'test/sponsorship.manager/'));
      // deploy sponsorship manager
      contracts.push(await deployMultisigContract(init_contracts, 'sponsorship_manager', rootSeed));
      setContract(contracts.filter(c => c.name == 'sponsorship_manager')[0]);
      // set multisig
      await setMultisig(base58Encode(techContract.dApp));
      console.table(contracts);
      
      const context: InjectableContext = {
        accounts: accounts,
        assets: assets,
        contracts: contracts,
        start_block: await getLastBlockId(env.network),
      };
      Object.assign(this, context);
    }
  };
};

async function deployPayeerContract(
  contracts: any[],
  rootSeed: string,
  testDir: string
): Promise<Contract> {
  console.info('deploy payeer contract...');
  const contract = contracts.filter(c => c.name == 'payeer')[0];
  contract.path = testDir + contract.path;
  await transfer(
    {
      recipient: contract.dApp,
      amount: env.amountPerContract + 2,
    },
    keyPair(rootSeed).privateKey,
    env.network
  );
  await deployScript(contract.path, contract.privateKey, env.network);
  console.info('payeer contract deployed');
  const techContract = contracts.filter(c => c.name == 'technical')[0];
  await setMockPayeer(techContract, contract.dApp);
  console.info('set of mock payeer complete');
  return {
    name: 'technical',
    privateKey: contract.privateKey,
    publicKey: contract.publicKey,
    dApp: contract.dApp,
    path: contract.path
  };
}
