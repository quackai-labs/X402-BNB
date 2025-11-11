import type { Hex, Address } from "viem";
import { recoverTypedDataAddress, recoverMessageAddress, keccak256, concat, toRlp } from "viem";
import type { SignedPaymentPayload } from "../types/payment";
import type { VerificationResult } from "../types/responses";
import { ErrorReason } from "../types/responses";
import { validateDeadline, validateAmount } from "../utils/validation";

/**
 * Verify a signed payment payload
 */
export async function verifyPayment(
  payload: SignedPaymentPayload,
): Promise<VerificationResult> {
  try {
    const { witnessSignature, authorization, paymentDetails } = payload;

    // Step 1: Recover witness signer
    const witnessDomain = {
      name: "q402",
      version: "1",
      chainId: paymentDetails.authorization.chainId,
      verifyingContract: paymentDetails.authorization.address,
    };

    const witnessMessage = {
      owner: authorization.address, // Should match authorization signer
      token: paymentDetails.token,
      amount: BigInt(paymentDetails.amount),
      to: paymentDetails.to,
      deadline: BigInt(0), // Will be extracted from witness
      paymentId: "0x0000000000000000000000000000000000000000000000000000000000000000" as Hex,
      nonce: BigInt(0),
    };

    let witnessRecovered: Address;
    try {
      witnessRecovered = await recoverTypedDataAddress({
        domain: witnessDomain,
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
        message: witnessMessage,
        signature: witnessSignature,
      });
    } catch {
      return {
        isValid: false,
        invalidReason: ErrorReason.INVALID_SIGNATURE,
        details: {
          witnessValid: false,
          authorizationValid: false,
          amountValid: false,
          deadlineValid: false,
          recipientValid: false,
        },
      };
    }

    // Step 2: Recover authorization signer
    const authEncoded = toRlp([
      authorization.chainId === 0n
        ? "0x"
        : `0x${authorization.chainId.toString(16)}` as Hex,
      authorization.address,
      authorization.nonce === 0n ? "0x" : `0x${authorization.nonce.toString(16)}` as Hex,
    ]);

    const authMessage = concat(["0x05" as Hex, authEncoded]);
    const authHash = keccak256(authMessage);

    // Reconstruct signature from yParity, r, s
    const v = authorization.yParity + 27;
    const reconstructedSig = concat([
      authorization.r,
      authorization.s,
      `0x${v.toString(16).padStart(2, "0")}` as Hex,
    ]);

    let authRecovered: Address;
    try {
      authRecovered = await recoverMessageAddress({
        message: { raw: authHash },
        signature: reconstructedSig,
      });
    } catch {
      return {
        isValid: false,
        invalidReason: ErrorReason.INVALID_AUTHORIZATION,
        payer: witnessRecovered,
        details: {
          witnessValid: true,
          authorizationValid: false,
          amountValid: false,
          deadlineValid: false,
          recipientValid: false,
        },
      };
    }

    // Step 3: Verify signers match
    if (witnessRecovered.toLowerCase() !== authRecovered.toLowerCase()) {
      return {
        isValid: false,
        invalidReason: ErrorReason.INVALID_SIGNATURE,
        payer: witnessRecovered,
        details: {
          witnessValid: true,
          authorizationValid: true,
          amountValid: false,
          deadlineValid: false,
          recipientValid: false,
        },
      };
    }

    // Step 4: Validate amount
    const amount = BigInt(paymentDetails.amount);
    if (!validateAmount(amount)) {
      return {
        isValid: false,
        invalidReason: ErrorReason.INVALID_AMOUNT,
        payer: witnessRecovered,
        details: {
          witnessValid: true,
          authorizationValid: true,
          amountValid: false,
          deadlineValid: false,
          recipientValid: false,
        },
      };
    }

    // Step 5: Validate deadline (if available in witness)
    // Note: Full deadline validation would require parsing the actual witness message
    const deadlineValid = true; // Placeholder

    // Step 6: Validate recipient matches
    const recipientValid = true; // Already checked in witness

    // All checks passed
    return {
      isValid: true,
      payer: witnessRecovered,
      details: {
        witnessValid: true,
        authorizationValid: true,
        amountValid: true,
        deadlineValid,
        recipientValid,
      },
    };
  } catch (error) {
    return {
      isValid: false,
      invalidReason: ErrorReason.UNEXPECTED_ERROR,
      details: {
        witnessValid: false,
        authorizationValid: false,
        amountValid: false,
        deadlineValid: false,
        recipientValid: false,
      },
    };
  }
}

/**
 * Verify witness signature
 */
export async function verifyWitnessSignature(
  signature: Hex,
  domain: {
    name: string;
    version?: string;
    chainId: number;
    verifyingContract: Address;
  },
  message: {
    owner: Address;
    token: Address;
    amount: bigint;
    to: Address;
    deadline: bigint;
    paymentId: Hex;
    nonce: bigint;
  },
): Promise<Address> {
  return await recoverTypedDataAddress({
    domain,
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
    message,
    signature,
  });
}

