import type { LocalAccount, PrivateKeyAccount, WalletClient } from "viem";
import type { PaymentDetails, SignedPaymentPayload } from "../types/payment";
import type { Eip712Domain } from "../types/eip712";
import { prepareWitness } from "./prepareWitness";
import { signWitness, signWitnessWithWallet } from "./signWitness";
import { prepareAuthorization } from "./prepareAuthorization";
import { signAuthorization } from "./signAuthorization";
import { encodeBase64 } from "../utils/encoding";

/**
 * Create a complete payment header for X-PAYMENT
 */
export async function createPaymentHeader(
  account: LocalAccount | PrivateKeyAccount,
  paymentDetails: PaymentDetails,
): Promise<string> {
  // Prepare witness message
  const witnessMessage = prepareWitness({
    owner: account.address,
    token: paymentDetails.token,
    amount: paymentDetails.amount,
    to: paymentDetails.to,
  });

  // Create domain from payment details
  const domain: Eip712Domain = {
    name: "q402",
    version: "1",
    chainId: paymentDetails.authorization.chainId,
    verifyingContract: paymentDetails.authorization.address,
  };

  // Sign witness
  const witnessSignature = await signWitness(account, domain, witnessMessage);

  // Prepare authorization
  const unsignedAuth = prepareAuthorization({
    chainId: paymentDetails.authorization.chainId,
    implementationAddress: paymentDetails.implementationContract,
    nonce: paymentDetails.authorization.nonce,
  });

  // Sign authorization
  const signedAuth = await signAuthorization(account, unsignedAuth);

  // Create signed payload
  const payload: SignedPaymentPayload = {
    witnessSignature,
    authorization: signedAuth,
    paymentDetails,
  };

  // Encode to base64 for X-PAYMENT header
  return encodeBase64(payload);
}

/**
 * Create payment header using wallet client
 */
export async function createPaymentHeaderWithWallet(
  walletClient: WalletClient,
  paymentDetails: PaymentDetails,
): Promise<string> {
  if (!walletClient.account) {
    throw new Error("Wallet client has no account");
  }

  // Prepare witness message
  const witnessMessage = prepareWitness({
    owner: walletClient.account.address,
    token: paymentDetails.token,
    amount: paymentDetails.amount,
    to: paymentDetails.to,
  });

  // Create domain
  const domain: Eip712Domain = {
    name: "q402",
    version: "1",
    chainId: paymentDetails.authorization.chainId,
    verifyingContract: paymentDetails.authorization.address,
  };

  // Sign witness
  const witnessSignature = await signWitnessWithWallet(walletClient, domain, witnessMessage);

  // For authorization, we need to use the account
  const unsignedAuth = prepareAuthorization({
    chainId: paymentDetails.authorization.chainId,
    implementationAddress: paymentDetails.implementationContract,
    nonce: paymentDetails.authorization.nonce,
  });

  // Sign authorization (requires LocalAccount)
  const signedAuth = await signAuthorization(
    walletClient.account as LocalAccount | PrivateKeyAccount,
    unsignedAuth,
  );

  // Create signed payload
  const payload: SignedPaymentPayload = {
    witnessSignature,
    authorization: signedAuth,
    paymentDetails,
  };

  return encodeBase64(payload);
}

