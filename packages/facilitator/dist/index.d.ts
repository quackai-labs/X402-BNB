import { Hex, Address, WalletClient, PublicClient } from 'viem';
import { SupportedNetwork } from '@x402-bnb/core';
import { Express } from 'express';

/**
 * Environment configuration
 */
interface EnvConfig {
    /**
     * Server host
     */
    host: string;
    /**
     * Server port
     */
    port: number;
    /**
     * Log level
     */
    logLevel: string;
    /**
     * Sponsor private key (for signing transactions)
     */
    sponsorPrivateKey: Hex;
    /**
     * BSC mainnet RPC URL
     */
    rpcUrlBscMainnet?: string;
    /**
     * BSC testnet RPC URL
     */
    rpcUrlBscTestnet?: string;
    /**
     * Implementation contract whitelist
     */
    implementationWhitelist: Address[];
}
/**
 * Load and validate environment configuration
 */
declare function loadEnvConfig(): EnvConfig;

/**
 * Network clients
 */
interface NetworkClients {
    walletClient: WalletClient;
    publicClient: PublicClient;
}
/**
 * Create network clients for all configured networks
 */
declare function createNetworkClients(config: EnvConfig): Map<SupportedNetwork, NetworkClients>;

/**
 * Create Express server with facilitator routes
 */
declare function createServer(config: EnvConfig, clientsMap: Map<SupportedNetwork, NetworkClients>): Express;

export { createNetworkClients, createServer, loadEnvConfig };
