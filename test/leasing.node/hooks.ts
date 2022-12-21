import {
  Account,
  Asset,
  Contract,
  createContracts,
  getLastBlockId,
  initAccounts,
  initAssets,
  setAssetsForAccounts
} from '@pepe-team/waves-sc-test-utils';
import { base58Encode } from '@waves/ts-lib-crypto';
import { Context } from 'mocha';
import { getEnvironment } from 'relax-env-json';
import { setSteps } from '../../steps/common';
import {
  deployMultisigContract,
  setTechContract
} from '../../steps/hooks.common';
import { init as initNode, setContract } from '../../steps/leasing.node.new';
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
      const techContract = await setTechContract(init_contracts, rootSeed, 'test/tokenized.staking/');
      contracts.push(techContract);
      // set mock contract
      setSteps(
        techContract,
        accounts.filter(a => a.name == 'tech_acc')[0]
      );
      // deploy leasing node
      contracts.push(await deployMultisigContract(init_contracts, 'leasing_node', rootSeed));
      //set leasing node
      setContract(contracts.filter(f => f.name == 'leasing_node')[0]);
      await initLeasingNode(contracts);
      
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

async function initLeasingNode(contracts: Contract[]) {
  try {
    await initNode(
      contracts.filter(c => c.name === 'leasing_node')[0],
      base58Encode(contracts.filter(c => c.name === 'technical')[0].dApp),
      contracts.filter(c => c.name === 'technical')[0].dApp
    );
    console.info('leasing node initialized');
  } catch {
    console.info('leasing node already initialized');
  }
}
