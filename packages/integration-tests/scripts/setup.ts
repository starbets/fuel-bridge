/// @dev The Fuel testing setup.
/// A set of useful helper methods for setting up the integration test environment.
import axios from 'axios';
import { ethers, Signer as EthSigner } from 'ethers';
import { Provider as EthProvider } from '@ethersproject/providers';
import {
  Wallet,
  Provider as FuelProvider,
  WalletUnlocked as FuelWallet,
} from 'fuels';
import { fuels_parseEther, fuels_formatEther } from './utils/parsers';
import {
  FuelChainState,
  FuelChainState__factory,
  FuelMessagePortal,
  FuelMessagePortal__factory,
  FuelERC20Gateway,
  FuelERC20Gateway__factory,
} from '@fuel-bridge/portal-contracts';
import * as dotenv from 'dotenv';
dotenv.config();

// Default config values
const def_http_eth: string = 'http://127.0.0.1:8545';
const def_http_deployer: string = 'http://127.0.0.1:8080';
const def_http_fuel: string = 'http://127.0.0.1:4000/graphql';
const def_pk_eth_deployer: string =
  '0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d';
const def_pk_eth_signer1: string =
  '0x5de4111afa1a4b94908f83103eb1f1706367c2e68ca870fc3fb9a804cdab365a';
const def_pk_eth_signer2: string =
  '0x7c852118294e51e653712a81e05800f419141751be58f605c371e15141b007a6';
const def_pk_fuel_deployer: string =
  '0xba9e8401405cd4327119548bccf0cd8b195c3fb716c848d9571c60bb230c6978';
const def_pk_fuel_signer1: string =
  '0xa349d39f614a3085b7f7f8cef63fd5189136924fc1238e6d25ccdaa43a901cd0';
const def_pk_fuel_signer2: string =
  '0x139f2cd8db62a9d64c3ed4cdc804f1fb53be98d750cd1432a308b34a42d8dcc7';

// Setup options
export interface SetupOptions {
  http_ethereum_client?: string;
  http_deployer?: string;
  http_fuel_client?: string;
  pk_eth_deployer?: string;
  pk_eth_signer1?: string;
  pk_eth_signer2?: string;
  pk_fuel_deployer?: string;
  pk_fuel_signer1?: string;
  pk_fuel_signer2?: string;
}

// The test environment
export interface TestEnvironment {
  eth: {
    provider: EthProvider;
    jsonRPC: string;
    fuelChainState: FuelChainState;
    fuelMessagePortal: FuelMessagePortal;
    fuelERC20Gateway: FuelERC20Gateway;
    deployer: EthSigner;
    signers: EthSigner[];
  };
  fuel: {
    provider: FuelProvider;
    deployer: FuelWallet;
    signers: FuelWallet[];
  };
}

// The setup method for Fuel
export async function setupEnvironment(
  opts: SetupOptions
): Promise<TestEnvironment> {
  const http_ethereum_client: string =
    opts.http_ethereum_client ||
    process.env.HTTP_ETHEREUM_CLIENT ||
    def_http_eth;
  const http_deployer: string =
    opts.http_deployer || process.env.HTTP_DEPLOYER || def_http_deployer;
  const http_fuel_client: string =
    opts.http_fuel_client || process.env.HTTP_FUEL_CLIENT || def_http_fuel;
  const pk_eth_deployer: string =
    opts.pk_eth_deployer || process.env.PK_ETH_DEPLOYER || def_pk_eth_deployer;
  const pk_eth_signer1: string =
    opts.pk_eth_signer1 || process.env.PK_ETH_SIGNER1 || def_pk_eth_signer1;
  const pk_eth_signer2: string =
    opts.pk_eth_signer2 || process.env.PK_ETH_SIGNER2 || def_pk_eth_signer2;
  const pk_fuel_deployer: string =
    opts.pk_fuel_deployer ||
    process.env.PK_FUEL_DEPLOYER ||
    def_pk_fuel_deployer;
  const pk_fuel_signer1: string =
    opts.pk_fuel_signer1 || process.env.PK_FUEL_SIGNER1 || def_pk_fuel_signer1;
  const pk_fuel_signer2: string =
    opts.pk_fuel_signer2 || process.env.PK_FUEL_SIGNER2 || def_pk_fuel_signer2;
  const fuel_chain_consensus_addr: string =
    process.env.FUEL_CHAIN_CONSENSUS_ADDRESS || '';
  const fuel_message_portal_addr: string =
    process.env.FUEL_MESSAGE_PORTAL_ADDRESS || '';
  const fuel_erc20_gateway_addr: string =
    process.env.FUEL_ERC20_GATEWAY_ADDRESS || '';

  // Create provider from http_fuel_client
  const fuel_provider = new FuelProvider(http_fuel_client);
  try {
    await fuel_provider.getBlockNumber();
  } catch (e) {
    throw new Error(
      'Failed to connect to the Fuel client at (' +
        http_fuel_client +
        "). Are you sure it's running?"
    );
  }
  const fuel_deployer = Wallet.fromPrivateKey(pk_fuel_deployer, fuel_provider);
  const fuel_deployerBalance = await fuel_deployer.getBalance();
  if (fuel_deployerBalance.lt(fuels_parseEther('5'))) {
    throw new Error(
      'Fuel deployer balance is very low (' +
        fuels_formatEther(fuel_deployerBalance) +
        'ETH)'
    );
  }
  const fuel_signer1 = Wallet.fromPrivateKey(pk_fuel_signer1, fuel_provider);
  const fuel_signer1Balance = await fuel_signer1.getBalance();
  if (fuel_signer1Balance.lt(fuels_parseEther('1'))) {
    const tx = await fuel_deployer.transfer(
      fuel_signer1.address,
      fuels_parseEther('1').toHex()
    );
    await tx.wait();
  }
  const fuel_signer2 = Wallet.fromPrivateKey(pk_fuel_signer2, fuel_provider);
  const fuel_signer2Balance = await fuel_signer2.getBalance();
  if (fuel_signer2Balance.lt(fuels_parseEther('1'))) {
    const tx = await fuel_deployer.transfer(
      fuel_signer2.address,
      fuels_parseEther('1').toHex()
    );
    await tx.wait();
  }

  // Create provider and signers from http_ethereum_client
  const eth_provider = new ethers.providers.JsonRpcProvider(
    http_ethereum_client
  );
  try {
    await eth_provider.getBlockNumber();
  } catch (e) {
    throw new Error(
      'Failed to connect to the Ethereum client at (' +
        http_ethereum_client +
        "). Are you sure it's running?"
    );
  }
  const eth_deployer = new ethers.Wallet(pk_eth_deployer, eth_provider);
  const eth_deployerBalance = await eth_deployer.getBalance();
  if (eth_deployerBalance < ethers.utils.parseEther('5')) {
    throw new Error(
      'Ethereum deployer balance is very low (' +
        ethers.utils.formatEther(eth_deployerBalance) +
        'ETH)'
    );
  }
  const eth_signer1 = new ethers.Wallet(pk_eth_signer1, eth_provider);
  const eth_signer1Balance = await eth_signer1.getBalance();
  if (eth_signer1Balance < ethers.utils.parseEther('1')) {
    const tx = await eth_deployer.sendTransaction({
      to: await eth_signer1.getAddress(),
      value: ethers.utils.parseEther('1'),
    });
    await tx.wait();
  }
  const eth_signer2 = new ethers.Wallet(pk_eth_signer2, eth_provider);
  const eth_signer2Balance = await eth_signer2.getBalance();
  if (eth_signer2Balance < ethers.utils.parseEther('1')) {
    const tx = await eth_deployer.sendTransaction({
      to: await eth_signer2.getAddress(),
      value: ethers.utils.parseEther('1'),
    });
    await tx.wait();
  }

  // Get contract addresses
  let eth_fuelChainStateAddress: string = fuel_chain_consensus_addr;
  let eth_fuelMessagePortalAddress: string = fuel_message_portal_addr;
  let eth_fuelERC20GatewayAddress: string = fuel_erc20_gateway_addr;
  if (
    !eth_fuelChainStateAddress ||
    !eth_fuelMessagePortalAddress ||
    !eth_fuelERC20GatewayAddress
  ) {
    let deployerAddresses: any = null;
    try {
      deployerAddresses = (
        await axios.get(http_deployer + '/deployments.local.json')
      ).data;
    } catch (e) {
      throw new Error(
        'Failed to connect to the deployer at (' +
          http_deployer +
          "). Are you sure it's running?"
      );
    }
    if (!eth_fuelChainStateAddress) {
      if (!deployerAddresses.FuelChainState) {
        throw new Error('Failed to get FuelChainState address from deployer');
      }
      eth_fuelChainStateAddress = deployerAddresses.FuelChainState;
    }
    if (!eth_fuelMessagePortalAddress) {
      if (!deployerAddresses.FuelMessagePortal) {
        throw new Error(
          'Failed to get FuelMessagePortal address from deployer'
        );
      }
      eth_fuelMessagePortalAddress = deployerAddresses.FuelMessagePortal;
    }
    if (!eth_fuelERC20GatewayAddress) {
      if (!deployerAddresses.FuelERC20Gateway) {
        throw new Error('Failed to get FuelERC20Gateway address from deployer');
      }
      eth_fuelERC20GatewayAddress = deployerAddresses.FuelERC20Gateway;
    }
  }

  // Connect existing contracts
  let eth_fuelChainState: FuelChainState = FuelChainState__factory.connect(
    eth_fuelChainStateAddress,
    eth_deployer
  );
  let eth_fuelMessagePortal: FuelMessagePortal =
    FuelMessagePortal__factory.connect(
      eth_fuelMessagePortalAddress,
      eth_deployer
    );
  let eth_fuelERC20Gateway: FuelERC20Gateway =
    FuelERC20Gateway__factory.connect(
      eth_fuelERC20GatewayAddress,
      eth_deployer
    );

  // Return the Fuel harness object
  return {
    eth: {
      provider: eth_provider,
      jsonRPC: http_ethereum_client,
      fuelChainState: eth_fuelChainState,
      fuelMessagePortal: eth_fuelMessagePortal,
      fuelERC20Gateway: eth_fuelERC20Gateway,
      deployer: eth_deployer,
      signers: [eth_signer1, eth_signer2],
    },
    fuel: {
      provider: fuel_provider,
      deployer: fuel_deployer,
      signers: [fuel_signer1, fuel_signer2],
    },
  };
}
