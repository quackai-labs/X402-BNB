import type { SignedPaymentPayload, VerificationResult } from "@q402/core";
import type { EnvConfig } from "../config/env";
import { ErrorReason } from "@q402/core";

/**
 * Verify a payment with additional checks
 */
export async function verifyPaymentWithChecks(
  payload: SignedPaymentPayload,
  config: EnvConfig,
): Promise<VerificationResult> {
  // Check implementation contract is whitelisted
  if (config.implementationWhitelist.length > 0) {
    const implementationContract = payload.paymentDetails.implementationContract.toLowerCase();
    const isWhitelisted = config.implementationWhitelist.some(
      (addr) => addr.toLowerCase() === implementationContract,
    );

    console.log(`🔍 Checking implementation whitelist:`);
    console.log(`   Contract: ${implementationContract}`);
    console.log(`   Whitelist: ${config.implementationWhitelist.map(a => a.toLowerCase()).join(", ")}`);
    console.log(`   Is whitelisted: ${isWhitelisted}`);

    if (!isWhitelisted) {
      console.error(`❌ Implementation contract ${implementationContract} is not in whitelist`);
      return {
        isValid: false,
        invalidReason: ErrorReason.INVALID_IMPLEMENTATION,
      };
    }
  } else {
    console.log(`ℹ️  Implementation whitelist is empty, skipping whitelist check`);
  }

  // Perform standard verification using local function
  return await verifyPaymentLocal(payload);
}

/**
 * Local implementation of payment verification with EIP-712 signature verification
 */
async function verifyPaymentLocal(payload: SignedPaymentPayload): Promise<VerificationResult> {
  try {
    const { witnessSignature, authorization, paymentDetails } = payload;
    
    // 1. Basic payload validation
    if (!witnessSignature || !authorization || !paymentDetails) {
      return {
        isValid: false,
        invalidReason: ErrorReason.INVALID_SIGNATURE,
      };
    }

    const witness = paymentDetails.witness as any;
    if (!witness?.message || !witness?.domain) {
      return {
        isValid: false,
        invalidReason: ErrorReason.INVALID_SIGNATURE,
      };
    }

    // 2. Check deadline (from witness message)
    const now = Math.floor(Date.now() / 1000);
    if (witness.message.deadline && now > Number(witness.message.deadline)) {
      return {
        isValid: false,
        invalidReason: ErrorReason.PAYMENT_EXPIRED,
      };
    }

    // 3. Verify signature formats
    const witnessFormatValid = isValidSignature(witnessSignature);
    const authorizationFormatValid = isValidAuthorization(authorization);

    if (!witnessFormatValid) {
      return {
        isValid: false,
        invalidReason: ErrorReason.INVALID_SIGNATURE,
      };
    }

    if (!authorizationFormatValid) {
      return {
        isValid: false,
        invalidReason: ErrorReason.INVALID_AUTHORIZATION,
      };
    }

    // 4. Verify EIP-712 witness signature (actual cryptographic verification)
    const witnessValid = await verifyEIP712Signature(
      witnessSignature,
      witness,
      witness.message.owner
    );

    if (!witnessValid) {
      console.error("❌ EIP-712 signature verification failed");
      return {
        isValid: false,
        invalidReason: ErrorReason.INVALID_SIGNATURE,
      };
    }

    console.log("✅ EIP-712 signature verified successfully");

    // 5. Verify EIP-7702 authorization signature
    const authorizationValid = await verifyEIP7702Authorization(
      authorization,
      paymentDetails.implementationContract,
      witness.message.owner  // Pass the expected signer (owner from witness)
    );

    if (!authorizationValid) {
      console.error("❌ EIP-7702 authorization verification failed");
      return {
        isValid: false,
        invalidReason: ErrorReason.INVALID_AUTHORIZATION,
      };
    }

    console.log("✅ EIP-7702 authorization verified successfully");

    // 6. Verify amounts and recipients
    const amountValid = 'amount' in paymentDetails ? isValidAmount(paymentDetails.amount) : true;
    const recipientValid = isValidRecipient(paymentDetails.to);

    if (!amountValid) {
      return {
        isValid: false,
        invalidReason: ErrorReason.INVALID_AMOUNT,
      };
    }

    if (!recipientValid) {
      return {
        isValid: false,
        invalidReason: ErrorReason.INVALID_RECIPIENT,
      };
    }

    // All validations passed
    return {
      isValid: true,
      payer: authorization.address,
      details: {
        witnessValid,
        authorizationValid,
        amountValid,
        deadlineValid: true,
        recipientValid,
      },
    };
    
  } catch (error) {
    console.error("Payment verification error:", error);
    return {
      isValid: false,
      invalidReason: ErrorReason.UNEXPECTED_ERROR,
    };
  }
}

/**
 * Validate signature format
 */
function isValidSignature(signature: string): boolean {
  return (
    typeof signature === 'string' &&
    signature.startsWith('0x') &&
    signature.length === 132 // 65 bytes = 130 hex chars + 0x prefix
  );
}

/**
 * Validate EIP-7702 authorization format
 */
function isValidAuthorization(authorization: any): boolean {
  const { chainId, address, nonce, yParity, r, s } = authorization;
  
  return !!(
    typeof chainId === 'number' && chainId > 0 &&
    typeof address === 'string' && address.startsWith('0x') && address.length === 42 &&
    typeof nonce === 'number' && nonce >= 0 &&
    typeof yParity === 'number' && (yParity === 0 || yParity === 1) &&
    typeof r === 'string' && r.startsWith('0x') && r.length === 66 &&
    typeof s === 'string' && s.startsWith('0x') && s.length === 66
  );
}

/**
 * Validate payment amount
 */
function isValidAmount(amount: string): boolean {
  try {
    const amountBigInt = BigInt(amount);
    return amountBigInt > 0n;
  } catch {
    return false;
  }
}

/**
 * Validate recipient address
 */
function isValidRecipient(recipient: string): boolean {
  return (
    typeof recipient === 'string' &&
    recipient.startsWith('0x') &&
    recipient.length === 42
  );
}

/**
 * Verify EIP-712 typed data signature
 */
async function verifyEIP712Signature(
  signature: string,
  witness: any,
  expectedSigner: string
): Promise<boolean> {
  try {
    const { verifyTypedData } = await import('viem');
    
    const { domain, types, message } = witness;
    
    // Verify the signature
    const valid = await verifyTypedData({
      address: expectedSigner as any,
      domain: {
        name: domain.name,
        version: domain.version,
        chainId: domain.chainId,
        verifyingContract: domain.verifyingContract as any,
      },
      types: types,
      primaryType: Object.keys(types).find(key => key !== 'EIP712Domain') || 'TransferAuthorization',
      message: message,
      signature: signature as any,
    });

    return valid;
    
  } catch (error) {
    console.error("EIP-712 verification error:", error);
    return false;
  }
}

/**
 * Verify EIP-7702 authorization signature
 * 
 * The authorization allows a User's EOA to delegate its code to implementationContract.
 * The signature must be from the User's EOA (the owner), not the contract.
 */
async function verifyEIP7702Authorization(
  authorization: any,
  expectedContract: string,
  expectedSigner: string
): Promise<boolean> {
  try {
    const viem = await import('viem');
    const { recoverAddress, keccak256, toRlp, toHex, concat, hexToBytes } = viem;
    
    const { chainId, address, nonce, yParity, r, s } = authorization;
    
    console.log(`🔍 Verifying EIP-7702 Authorization:`);
    console.log(`   Contract address: ${address}`);
    console.log(`   Expected contract: ${expectedContract}`);
    console.log(`   Expected signer (owner): ${expectedSigner}`);
    console.log(`   Chain ID: ${chainId}`);
    console.log(`   EOA Nonce: ${nonce}`);
    
    // 1. Verify the authorization is for the expected contract
    if (address.toLowerCase() !== expectedContract.toLowerCase()) {
      console.error(`❌ Authorization contract mismatch: ${address} !== ${expectedContract}`);
      return false;
    }
    
    // 2. Construct EIP-7702 authorization message
    // Format: keccak256(MAGIC || rlp([chain_id, address, nonce]))
    // This is signed by the User's EOA to authorize delegation
    const MAGIC = '0x05';
    
    // Use toRlp instead of encodeRlp
    const rlpData = toRlp([
      toHex(chainId),
      address.toLowerCase(),
      toHex(nonce),
    ]);
    
    // Concatenate MAGIC and RLP data
    const authHash = keccak256(concat([MAGIC as any, rlpData]));
    console.log(`   Authorization hash: ${authHash.slice(0, 20)}...`);
    
    // 3. Recover signer from signature
    const recoveredAddress = await recoverAddress({
      hash: authHash,
      signature: { r: r as any, s: s as any, yParity },
    });
    
    console.log(`   Recovered signer: ${recoveredAddress}`);
    
    // 4. Verify the recovered address matches the expected signer (owner)
    if (recoveredAddress.toLowerCase() !== expectedSigner.toLowerCase()) {
      console.error(`❌ Authorization signer mismatch:`);
      console.error(`   Expected: ${expectedSigner}`);
      console.error(`   Got: ${recoveredAddress}`);
      return false;
    }
    
    console.log(`✅ Authorization signature is valid (signed by owner ${recoveredAddress})`);
    return true;
    
  } catch (error) {
    console.error("❌ EIP-7702 authorization verification error:", error);
    return false;
  }
}

