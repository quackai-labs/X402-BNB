/**
 * q402 - EIP-7702 Delegated Payment Protocol
 * 
 * A production-ready EIP-7702 delegated execution payment flow for BSC and EVM networks,
 * with gas sponsored by facilitators.
 * 
 * Inspired by the x402 protocol: https://github.com/coinbase/x402
 * 
 * @packageDocumentation
 */

export * from "./types";
export * from "./client";
export * from "./contracts";
export * from "./utils";
export * from "./facilitator";

/**
 * Protocol version
 */
export const X402_BNB_VERSION = 1;

