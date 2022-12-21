import {
  Account,
  Asset,
  Contract,
  createContracts,
  getBlockHeight,
  getLastBlockId,
  initAccounts,
  initAssets,
  setAssetsForAccounts
} from '@pepe-team/waves-sc-test-utils';
import {
  init as initTokenized,
  setContract as setTokenizedContract,
} from '../../steps/tokenized.staking';
import { Context } from 'mocha';
import { getEnvironment } from 'relax-env-json';
import { setSteps, setTCClaim, setTCStake } from '../../steps/common';
import {
  deployMultisigContract,
  setTechContract
} from '../../steps/hooks.common';
import waitHeight from '@waves/node-api-js/cjs/tools/blocks/waitHeight';
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
      setTCClaim(techContract, true, 0);
      setTCStake(techContract, true);
      await waitHeight(env.network.nodeAPI, await getBlockHeight(0, env.network));
      // deploy tokenized staking
      contracts.push(await deployMultisigContract(init_contracts, 'tokenized_staking', rootSeed));
      // init tokenized staking
      await initTokenizedStaking(contracts);
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

async function initTokenizedStaking(contracts: Contract[]) {
  setTokenizedContract(contracts.filter(c => c.name === 'tokenized_staking')[0]);
  const techContract = contracts.filter(c => c.name === 'technical')[0];
  try {
    await initTokenized(
      techContract,
      'sWAVES',
      'sWAVES token pizdatiy',
      'WAVES',
      techContract.dApp
    );
    console.info('tokenized staking initialized');
  } catch {
    console.info('tokenized staking already initialized');
  }
}