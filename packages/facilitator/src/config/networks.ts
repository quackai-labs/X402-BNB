import { createWalletClient, createPublicClient, http } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { bsc, bscTestnet } from "viem/chains";
import type { WalletClient, PublicClient } from "viem";
import type { SupportedNetwork } from "@q402/core";
import { SupportedNetworks } from "@q402/core";
import type { EnvConfig } from "./env";

/**
 * Network clients
 */
export interface NetworkClients {
  walletClient: WalletClient;
  publicClient: PublicClient;
}

/**
 * Create network clients for all configured networks
 */
export function createNetworkClients(
  config: EnvConfig,
): Map<SupportedNetwork, NetworkClients> {
  const account = privateKeyToAccount(config.sponsorPrivateKey);
  const clients = new Map<SupportedNetwork, NetworkClients>();

  // BSC Mainnet
  if (config.rpcUrlBscMainnet) {
    const walletClient = createWalletClient({
      account,
      chain: bsc,
      transport: http(config.rpcUrlBscMainnet),
    });

    const publicClient = createPublicClient({
      chain: bsc,
      transport: http(config.rpcUrlBscMainnet),
    });

    clients.set(SupportedNetworks.BSC_MAINNET, { walletClient, publicClient });
  }

  // BSC Testnet
  if (config.rpcUrlBscTestnet) {
    const walletClient = createWalletClient({
      account,
      chain: bscTestnet,
      transport: http(config.rpcUrlBscTestnet),
    });

    const publicClient = createPublicClient({
      chain: bscTestnet,
      transport: http(config.rpcUrlBscTestnet),
    });

    clients.set(SupportedNetworks.BSC_TESTNET, { walletClient, publicClient });
  }

  return clients;
}

/**
 * Get clients for a specific network
 */
export function getNetworkClients(
  clientsMap: Map<SupportedNetwork, NetworkClients>,
  network: SupportedNetwork,
): NetworkClients | undefined {
  return clientsMap.get(network);
}

