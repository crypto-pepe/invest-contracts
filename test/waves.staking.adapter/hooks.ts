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
import {
  init as initWAdapter,
  setContract as setAdapterContract,
  setContract,
} from '../../steps/waves.staking.adapter';
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
      const techContract = await setTechContract(init_contracts, rootSeed, 'test/waves.staking.adapter/');
      contracts.push(techContract);
      // set mock contract
      setSteps(
        techContract,
        accounts.filter(a => a.name == 'tech_acc')[0]
      );
      // deploy waves adapter
      contracts.push(await deployMultisigContract(init_contracts, 'waves_staking_adapter', rootSeed));
      //set waves adapter
      await initWavesAdapter(contracts, accounts);
      
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

async function initWavesAdapter(
  contracts: Contract[],
  accounts: Account[]
) {
  const adapter = contracts.filter(c => c.name === 'waves_staking_adapter')[0];
  setAdapterContract(adapter);
  try {
    await initWAdapter(
      base58Encode(contracts.filter(c => c.name === 'technical')[0].dApp),
      contracts.filter(c => c.name === 'technical')[0].dApp,
      contracts.filter(c => c.name === 'technical')[0].dApp,
      accounts.filter(a => a.name === 'manager')[0].address,
      env.leasingNode.infraFee
    );
    console.info('waves adapter initialized');
  } catch {
    console.info('waves adapter already initialized');
  }
}