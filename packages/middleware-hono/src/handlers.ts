import type { Context } from "hono";
import type { PaymentRequiredResponse, PaymentDetails } from "@q402/core";
import { PaymentScheme, NetworkConfigs } from "@q402/core";
import type { PaymentEndpointConfig, Q402MiddlewareConfig } from "./config";

/**
 * Create 402 Payment Required response
 */
export function create402Response(
  config: Q402MiddlewareConfig,
  endpoint: PaymentEndpointConfig,
  c: Context,
): PaymentRequiredResponse {
  const networkConfig = NetworkConfigs[config.network];

  const paymentDetails: PaymentDetails = {
    scheme: PaymentScheme.EIP7702_DELEGATED,
    networkId: config.network,
    token: endpoint.token,
    amount: endpoint.amount,
    to: config.recipientAddress,
    implementationContract: config.implementationContract,
    witness: {
      domain: {
        name: "q402",
        version: "1",
        chainId: networkConfig.chainId,
        verifyingContract: config.verifyingContract,
      },
      types: {
        Witness: [
          { name: "owner", type: "address" },
          { name: "token", type: "address" },
          { name: "amount", type: "uint256" },
          { name: "to", type: "address" },
          { name: "deadline", type: "uint256" },
          { name: "paymentId", type: "bytes32" },
          { name: "nonce", type: "uint256" },
        ],
      },
      primaryType: "Witness",
      message: {
        owner: "0x0000000000000000000000000000000000000000", // Placeholder
        token: endpoint.token,
        amount: BigInt(endpoint.amount),
        to: config.recipientAddress,
        deadline: BigInt(Math.floor(Date.now() / 1000) + 900),
        paymentId: "0x0000000000000000000000000000000000000000000000000000000000000000",
        nonce: BigInt(0),
      },
    },
    authorization: {
      chainId: networkConfig.chainId,
      address: config.implementationContract,
      nonce: 0,
    },
  };

  const response: PaymentRequiredResponse = {
    x402Version: 1,
    accepts: [paymentDetails],
  };

  return response;
}

/**
 * Send 402 Payment Required response
 */
export function send402Response(
  c: Context,
  config: Q402MiddlewareConfig,
  endpoint: PaymentEndpointConfig,
): Response {
  const response = create402Response(config, endpoint, c);

  return c.json(response, 402);
}

