import type { SignedPaymentPayload, SettlementResult } from "@q402/core";
import type { WitnessTypedData } from "@q402/core";
import { PaymentScheme } from "@q402/core";
import { ethers } from "ethers";

/**
 * Settle a payment using ethers.js (same as signature-based-transfer.js)
 * 
 * This executes a real EIP-7702 transaction on-chain using the proven method.
 */
export async function settlePaymentWithMonitoring(
  payload: SignedPaymentPayload,
): Promise<SettlementResult> {
  try {
    const { witnessSignature, authorization, paymentDetails } = payload;
    
    // Only support single payment for now
    if (paymentDetails.scheme !== PaymentScheme.EIP7702_DELEGATED) {
      return {
        success: false,
        error: "Only single payment scheme is supported",
      };
    }

    const witness = paymentDetails.witness as WitnessTypedData;

    if (!witness?.message) {
      return {
        success: false,
        error: "Invalid witness data",
      };
    }

    const message = witness.message;

    // Get recipient address - check both 'to' and 'recipient' fields, fallback to paymentDetails.to
    // Handle different message structures (some may use 'recipient' instead of 'to')
    const recipient = ('to' in message && message.to) 
      ? message.to 
      : ('recipient' in message && (message as { recipient?: string }).recipient)
      ? (message as { recipient: string }).recipient
      : paymentDetails.to;
    
    if (!recipient) {
      return {
        success: false,
        error: "Missing recipient address in witness message",
      };
    }

    // Get RPC URL from clients
    const rpcUrl = process.env.RPC_URL_BSC_MAINNET || process.env.RPC_URL;
    const sponsorPrivateKey = process.env.SPONSOR_PRIVATE_KEY || process.env.FACILITATOR_PRIVATE_KEY;

    if (!rpcUrl || !sponsorPrivateKey) {
      return {
        success: false,
        error: "Missing RPC_URL or SPONSOR_PRIVATE_KEY configuration",
      };
    }

    // Create ethers.js provider and wallet (same as signature-based-transfer.js)
    const provider = new ethers.JsonRpcProvider(rpcUrl);
    const facilitatorWallet = new ethers.Wallet(sponsorPrivateKey, provider);

    console.error(`   💼 Using facilitator: ${facilitatorWallet.address}`);

    // 1. Encode executeTransfer function call (same ABI as successful script)
    const SIGNATURE_EXECUTOR_ABI = [
      "function executeTransfer(address owner, address facilitator, address token, address recipient, uint256 amount, uint256 nonce, uint256 deadline, bytes calldata signature) external",
    ];

    // Get amount, nonce, deadline - handle both bigint and string/string representation
    const amount = typeof message.amount === 'bigint' ? message.amount.toString() : String(message.amount);
    const nonce = typeof message.nonce === 'bigint' ? message.nonce.toString() : String(message.nonce);
    const deadline = typeof message.deadline === 'bigint' ? message.deadline.toString() : String(message.deadline);

    const executorInterface = new ethers.Interface(SIGNATURE_EXECUTOR_ABI);
    const callData = executorInterface.encodeFunctionData("executeTransfer", [
      message.owner,        // owner
      facilitatorWallet.address, // facilitator
      message.token,        // token
      recipient,            // recipient (supports both 'to' and 'recipient' fields)
      amount,               // amount
      nonce,                // nonce
      deadline,             // deadline
      witnessSignature      // signature
    ]);

    console.error(`📋 Transaction details:`);
    console.error(`   owner: ${message.owner}`);
    console.error(`   facilitator: ${facilitatorWallet.address}`);
    console.error(`   token: ${message.token}`);
    console.error(`   recipient: ${recipient}`);
    console.error(`   amount: ${amount}`);
    console.error(`   nonce: ${nonce}`);
    console.error(`   deadline: ${deadline}`);

    // 2. Get facilitator nonce
    const facilitatorNonce = await facilitatorWallet.getNonce();
    const feeData = await provider.getFeeData();

    // 3. Prepare EIP-7702 authorization tuple (from payload)
    // ethers.js requires signature to be an object with r, s, and yParity
    const authorizationTuple = {
      chainId: Number(authorization.chainId),
      address: authorization.address,
      nonce: Number(authorization.nonce),
      signature: {
        r: authorization.r,
        s: authorization.s,
        yParity: Number(authorization.yParity) as 0 | 1,
      },
    };

    // 4. Construct EIP-7702 transaction (same structure as successful script)
    const tx = {
      type: 4,  // EIP-7702
      to: message.owner, // Target is User EOA (will be delegated)
      data: callData,
      authorizationList: [authorizationTuple],
      chainId: Number(authorization.chainId),
      nonce: facilitatorNonce,
      gasLimit: 300000n,
      maxFeePerGas: feeData.maxFeePerGas || ethers.parseUnits("3", "gwei"),
      maxPriorityFeePerGas: feeData.maxPriorityFeePerGas || ethers.parseUnits("1.5", "gwei"),
    };

    console.error(`📤 Sending EIP-7702 transaction...`);
    console.error(`   Type: 0x04 (EIP-7702)`);
    console.error(`   From: ${facilitatorWallet.address} (Facilitator)`);
    console.error(`   To: ${message.owner} (User EOA)`);

    // 5. Send transaction
    const txResponse = await facilitatorWallet.sendTransaction(tx);

    // 6. Wait for confirmation
    const receipt = await txResponse.wait();

    // 7. Check transaction status
    if (!receipt) {
      return {
        success: false,
        error: "Transaction receipt not available",
        txHash: txResponse.hash as `0x${string}`,
      };
    }

    if (receipt.status === 1) {
      return {
        success: true,
        txHash: txResponse.hash as `0x${string}`,
        blockNumber: BigInt(receipt.blockNumber),
      };
    } else {
      return {
        success: false,
        error: "Transaction reverted on-chain",
        txHash: txResponse.hash as `0x${string}`,
      };
    }

  } catch (error) {
    console.error("❌ Settlement error:", error);
    const errorMessage = error instanceof Error ? error.message : String(error);

    // Provide more detailed error information
    if (errorMessage.includes('insufficient funds')) {
      return {
        success: false,
        error: "Insufficient gas funds in facilitator wallet",
      };
    } else if (errorMessage.includes('nonce')) {
      return {
        success: false,
        error: "Invalid nonce - transaction may have already been executed",
      };
    } else if (errorMessage.includes('execution reverted')) {
      return {
        success: false,
        error: "Contract execution reverted - check signature and authorization",
      };
    }

    return {
      success: false,
      error: errorMessage,
    };
  }
}

