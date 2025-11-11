#!/usr/bin/env node
'use strict';

var dotenv = require('dotenv');
var path = require('path');
var viem = require('viem');
var accounts = require('viem/accounts');
var chains = require('viem/chains');
var core = require('@x402-bnb/core');
var express = require('express');
var ethers = require('ethers');

function _interopDefault (e) { return e && e.__esModule ? e : { default: e }; }

var path__default = /*#__PURE__*/_interopDefault(path);
var express__default = /*#__PURE__*/_interopDefault(express);

var __require = /* @__PURE__ */ ((x) => typeof require !== "undefined" ? require : typeof Proxy !== "undefined" ? new Proxy(x, {
  get: (a, b) => (typeof require !== "undefined" ? require : a)[b]
}) : x)(function(x) {
  if (typeof require !== "undefined") return require.apply(this, arguments);
  throw Error('Dynamic require of "' + x + '" is not supported');
});
dotenv.config({ path: path__default.default.resolve(process.cwd(), ".env") });
function loadEnvConfig() {
  const host = process.env.HOST || "0.0.0.0";
  const port = parseInt(process.env.PORT || "8080", 10);
  const logLevel = process.env.LOG_LEVEL || "info";
  const sponsorPrivateKey = process.env.SPONSOR_PRIVATE_KEY;
  if (!sponsorPrivateKey || !sponsorPrivateKey.startsWith("0x")) {
    throw new Error("SPONSOR_PRIVATE_KEY environment variable is required");
  }
  const rpcUrlBscMainnet = process.env.RPC_URL_BSC_MAINNET;
  const rpcUrlBscTestnet = process.env.RPC_URL_BSC_TESTNET;
  if (!rpcUrlBscMainnet && !rpcUrlBscTestnet) {
    throw new Error("At least one RPC URL must be configured");
  }
  const whitelistStr = process.env.IMPLEMENTATION_WHITELIST || "";
  const implementationWhitelist = whitelistStr.split(",").map((addr) => addr.trim()).filter((addr) => addr && addr.startsWith("0x"));
  return {
    host,
    port,
    logLevel,
    sponsorPrivateKey,
    rpcUrlBscMainnet,
    rpcUrlBscTestnet,
    implementationWhitelist
  };
}
function createNetworkClients(config2) {
  const account = accounts.privateKeyToAccount(config2.sponsorPrivateKey);
  const clients = /* @__PURE__ */ new Map();
  if (config2.rpcUrlBscMainnet) {
    const walletClient = viem.createWalletClient({
      account,
      chain: chains.bsc,
      transport: viem.http(config2.rpcUrlBscMainnet)
    });
    const publicClient = viem.createPublicClient({
      chain: chains.bsc,
      transport: viem.http(config2.rpcUrlBscMainnet)
    });
    clients.set(core.SupportedNetworks.BSC_MAINNET, { walletClient, publicClient });
  }
  if (config2.rpcUrlBscTestnet) {
    const walletClient = viem.createWalletClient({
      account,
      chain: chains.bscTestnet,
      transport: viem.http(config2.rpcUrlBscTestnet)
    });
    const publicClient = viem.createPublicClient({
      chain: chains.bscTestnet,
      transport: viem.http(config2.rpcUrlBscTestnet)
    });
    clients.set(core.SupportedNetworks.BSC_TESTNET, { walletClient, publicClient });
  }
  return clients;
}
function getNetworkClients(clientsMap, network) {
  return clientsMap.get(network);
}
async function verifyPaymentWithChecks(payload, config2) {
  if (config2.implementationWhitelist.length > 0) {
    const implementationContract = payload.paymentDetails.implementationContract.toLowerCase();
    const isWhitelisted = config2.implementationWhitelist.some(
      (addr) => addr.toLowerCase() === implementationContract
    );
    console.log(`\u{1F50D} Checking implementation whitelist:`);
    console.log(`   Contract: ${implementationContract}`);
    console.log(`   Whitelist: ${config2.implementationWhitelist.map((a) => a.toLowerCase()).join(", ")}`);
    console.log(`   Is whitelisted: ${isWhitelisted}`);
    if (!isWhitelisted) {
      console.error(`\u274C Implementation contract ${implementationContract} is not in whitelist`);
      return {
        isValid: false,
        invalidReason: core.ErrorReason.INVALID_IMPLEMENTATION
      };
    }
  } else {
    console.log(`\u2139\uFE0F  Implementation whitelist is empty, skipping whitelist check`);
  }
  return await verifyPaymentLocal(payload);
}
async function verifyPaymentLocal(payload) {
  try {
    const { witnessSignature, authorization, paymentDetails } = payload;
    if (!witnessSignature || !authorization || !paymentDetails) {
      return {
        isValid: false,
        invalidReason: core.ErrorReason.INVALID_SIGNATURE
      };
    }
    const witness = paymentDetails.witness;
    if (!witness?.message || !witness?.domain) {
      return {
        isValid: false,
        invalidReason: core.ErrorReason.INVALID_SIGNATURE
      };
    }
    const now = Math.floor(Date.now() / 1e3);
    if (witness.message.deadline && now > Number(witness.message.deadline)) {
      return {
        isValid: false,
        invalidReason: core.ErrorReason.PAYMENT_EXPIRED
      };
    }
    const witnessFormatValid = isValidSignature(witnessSignature);
    const authorizationFormatValid = isValidAuthorization(authorization);
    if (!witnessFormatValid) {
      return {
        isValid: false,
        invalidReason: core.ErrorReason.INVALID_SIGNATURE
      };
    }
    if (!authorizationFormatValid) {
      return {
        isValid: false,
        invalidReason: core.ErrorReason.INVALID_AUTHORIZATION
      };
    }
    const witnessValid = await verifyEIP712Signature(
      witnessSignature,
      witness,
      witness.message.owner
    );
    if (!witnessValid) {
      console.error("\u274C EIP-712 signature verification failed");
      return {
        isValid: false,
        invalidReason: core.ErrorReason.INVALID_SIGNATURE
      };
    }
    console.log("\u2705 EIP-712 signature verified successfully");
    const authorizationValid = await verifyEIP7702Authorization(
      authorization,
      paymentDetails.implementationContract,
      witness.message.owner
      // Pass the expected signer (owner from witness)
    );
    if (!authorizationValid) {
      console.error("\u274C EIP-7702 authorization verification failed");
      return {
        isValid: false,
        invalidReason: core.ErrorReason.INVALID_AUTHORIZATION
      };
    }
    console.log("\u2705 EIP-7702 authorization verified successfully");
    const amountValid = "amount" in paymentDetails ? isValidAmount(paymentDetails.amount) : true;
    const recipientValid = isValidRecipient(paymentDetails.to);
    if (!amountValid) {
      return {
        isValid: false,
        invalidReason: core.ErrorReason.INVALID_AMOUNT
      };
    }
    if (!recipientValid) {
      return {
        isValid: false,
        invalidReason: core.ErrorReason.INVALID_RECIPIENT
      };
    }
    return {
      isValid: true,
      payer: authorization.address,
      details: {
        witnessValid,
        authorizationValid,
        amountValid,
        deadlineValid: true,
        recipientValid
      }
    };
  } catch (error) {
    console.error("Payment verification error:", error);
    return {
      isValid: false,
      invalidReason: core.ErrorReason.UNEXPECTED_ERROR
    };
  }
}
function isValidSignature(signature) {
  return typeof signature === "string" && signature.startsWith("0x") && signature.length === 132;
}
function isValidAuthorization(authorization) {
  const { chainId, address, nonce, yParity, r, s } = authorization;
  return !!(typeof chainId === "number" && chainId > 0 && typeof address === "string" && address.startsWith("0x") && address.length === 42 && typeof nonce === "number" && nonce >= 0 && typeof yParity === "number" && (yParity === 0 || yParity === 1) && typeof r === "string" && r.startsWith("0x") && r.length === 66 && typeof s === "string" && s.startsWith("0x") && s.length === 66);
}
function isValidAmount(amount) {
  try {
    const amountBigInt = BigInt(amount);
    return amountBigInt > 0n;
  } catch {
    return false;
  }
}
function isValidRecipient(recipient) {
  return typeof recipient === "string" && recipient.startsWith("0x") && recipient.length === 42;
}
async function verifyEIP712Signature(signature, witness, expectedSigner) {
  try {
    const { verifyTypedData } = await import('viem');
    const { domain, types, message } = witness;
    const valid = await verifyTypedData({
      address: expectedSigner,
      domain: {
        name: domain.name,
        version: domain.version,
        chainId: domain.chainId,
        verifyingContract: domain.verifyingContract
      },
      types,
      primaryType: Object.keys(types).find((key) => key !== "EIP712Domain") || "TransferAuthorization",
      message,
      signature
    });
    return valid;
  } catch (error) {
    console.error("EIP-712 verification error:", error);
    return false;
  }
}
async function verifyEIP7702Authorization(authorization, expectedContract, expectedSigner) {
  try {
    const viem = await import('viem');
    const { recoverAddress, keccak256, toRlp, toHex, concat, hexToBytes } = viem;
    const { chainId, address, nonce, yParity, r, s } = authorization;
    console.log(`\u{1F50D} Verifying EIP-7702 Authorization:`);
    console.log(`   Contract address: ${address}`);
    console.log(`   Expected contract: ${expectedContract}`);
    console.log(`   Expected signer (owner): ${expectedSigner}`);
    console.log(`   Chain ID: ${chainId}`);
    console.log(`   EOA Nonce: ${nonce}`);
    if (address.toLowerCase() !== expectedContract.toLowerCase()) {
      console.error(`\u274C Authorization contract mismatch: ${address} !== ${expectedContract}`);
      return false;
    }
    const MAGIC = "0x05";
    const rlpData = toRlp([
      toHex(chainId),
      address.toLowerCase(),
      toHex(nonce)
    ]);
    const authHash = keccak256(concat([MAGIC, rlpData]));
    console.log(`   Authorization hash: ${authHash.slice(0, 20)}...`);
    const recoveredAddress = await recoverAddress({
      hash: authHash,
      signature: { r, s, yParity }
    });
    console.log(`   Recovered signer: ${recoveredAddress}`);
    if (recoveredAddress.toLowerCase() !== expectedSigner.toLowerCase()) {
      console.error(`\u274C Authorization signer mismatch:`);
      console.error(`   Expected: ${expectedSigner}`);
      console.error(`   Got: ${recoveredAddress}`);
      return false;
    }
    console.log(`\u2705 Authorization signature is valid (signed by owner ${recoveredAddress})`);
    return true;
  } catch (error) {
    console.error("\u274C EIP-7702 authorization verification error:", error);
    return false;
  }
}

// src/api/routes/verify.ts
async function handleVerify(req, res, config2) {
  try {
    console.log("/verify go req body", req.body);
    const parseResult = core.SignedPaymentPayloadSchema.safeParse(req.body);
    if (!parseResult.success) {
      res.status(400).json({
        error: "Invalid payment payload",
        details: parseResult.error.errors
      });
      return;
    }
    const payload = parseResult.data;
    const result = await verifyPaymentWithChecks(payload, config2);
    console.log("/verify go result", result);
    res.json(result);
  } catch (error) {
    console.error("Verification error:", error);
    res.status(500).json({
      error: "Internal server error",
      message: error instanceof Error ? error.message : "Unknown error"
    });
  }
}
async function settlePaymentWithMonitoring(payload) {
  try {
    const { witnessSignature, authorization, paymentDetails } = payload;
    if (paymentDetails.scheme !== core.PaymentScheme.EIP7702_DELEGATED) {
      return {
        success: false,
        error: "Only single payment scheme is supported"
      };
    }
    const witness = paymentDetails.witness;
    if (!witness?.message) {
      return {
        success: false,
        error: "Invalid witness data"
      };
    }
    const message = witness.message;
    const recipient = "to" in message && message.to ? message.to : "recipient" in message && message.recipient ? message.recipient : paymentDetails.to;
    if (!recipient) {
      return {
        success: false,
        error: "Missing recipient address in witness message"
      };
    }
    const rpcUrl = process.env.RPC_URL_BSC_MAINNET || process.env.RPC_URL;
    const sponsorPrivateKey = process.env.SPONSOR_PRIVATE_KEY || process.env.FACILITATOR_PRIVATE_KEY;
    if (!rpcUrl || !sponsorPrivateKey) {
      return {
        success: false,
        error: "Missing RPC_URL or SPONSOR_PRIVATE_KEY configuration"
      };
    }
    const provider = new ethers.ethers.JsonRpcProvider(rpcUrl);
    const facilitatorWallet = new ethers.ethers.Wallet(sponsorPrivateKey, provider);
    console.error(`   \u{1F4BC} Using facilitator: ${facilitatorWallet.address}`);
    const SIGNATURE_EXECUTOR_ABI = [
      "function executeTransfer(address owner, address facilitator, address token, address recipient, uint256 amount, uint256 nonce, uint256 deadline, bytes calldata signature) external"
    ];
    const amount = typeof message.amount === "bigint" ? message.amount.toString() : String(message.amount);
    const nonce = typeof message.nonce === "bigint" ? message.nonce.toString() : String(message.nonce);
    const deadline = typeof message.deadline === "bigint" ? message.deadline.toString() : String(message.deadline);
    const executorInterface = new ethers.ethers.Interface(SIGNATURE_EXECUTOR_ABI);
    const callData = executorInterface.encodeFunctionData("executeTransfer", [
      message.owner,
      // owner
      facilitatorWallet.address,
      // facilitator
      message.token,
      // token
      recipient,
      // recipient (supports both 'to' and 'recipient' fields)
      amount,
      // amount
      nonce,
      // nonce
      deadline,
      // deadline
      witnessSignature
      // signature
    ]);
    console.error(`\u{1F4CB} Transaction details:`);
    console.error(`   owner: ${message.owner}`);
    console.error(`   facilitator: ${facilitatorWallet.address}`);
    console.error(`   token: ${message.token}`);
    console.error(`   recipient: ${recipient}`);
    console.error(`   amount: ${amount}`);
    console.error(`   nonce: ${nonce}`);
    console.error(`   deadline: ${deadline}`);
    const facilitatorNonce = await facilitatorWallet.getNonce();
    const feeData = await provider.getFeeData();
    const authorizationTuple = {
      chainId: Number(authorization.chainId),
      address: authorization.address,
      nonce: Number(authorization.nonce),
      signature: {
        r: authorization.r,
        s: authorization.s,
        yParity: Number(authorization.yParity)
      }
    };
    const tx = {
      type: 4,
      // EIP-7702
      to: message.owner,
      // Target is User EOA (will be delegated)
      data: callData,
      authorizationList: [authorizationTuple],
      chainId: Number(authorization.chainId),
      nonce: facilitatorNonce,
      gasLimit: 300000n,
      maxFeePerGas: feeData.maxFeePerGas || ethers.ethers.parseUnits("3", "gwei"),
      maxPriorityFeePerGas: feeData.maxPriorityFeePerGas || ethers.ethers.parseUnits("1.5", "gwei")
    };
    console.error(`\u{1F4E4} Sending EIP-7702 transaction...`);
    console.error(`   Type: 0x04 (EIP-7702)`);
    console.error(`   From: ${facilitatorWallet.address} (Facilitator)`);
    console.error(`   To: ${message.owner} (User EOA)`);
    const txResponse = await facilitatorWallet.sendTransaction(tx);
    const receipt = await txResponse.wait();
    if (!receipt) {
      return {
        success: false,
        error: "Transaction receipt not available",
        txHash: txResponse.hash
      };
    }
    if (receipt.status === 1) {
      return {
        success: true,
        txHash: txResponse.hash,
        blockNumber: BigInt(receipt.blockNumber)
      };
    } else {
      return {
        success: false,
        error: "Transaction reverted on-chain",
        txHash: txResponse.hash
      };
    }
  } catch (error) {
    console.error("\u274C Settlement error:", error);
    const errorMessage = error instanceof Error ? error.message : String(error);
    if (errorMessage.includes("insufficient funds")) {
      return {
        success: false,
        error: "Insufficient gas funds in facilitator wallet"
      };
    } else if (errorMessage.includes("nonce")) {
      return {
        success: false,
        error: "Invalid nonce - transaction may have already been executed"
      };
    } else if (errorMessage.includes("execution reverted")) {
      return {
        success: false,
        error: "Contract execution reverted - check signature and authorization"
      };
    }
    return {
      success: false,
      error: errorMessage
    };
  }
}

// src/api/routes/settle.ts
async function handleSettle(req, res, clientsMap) {
  try {
    const parseResult = core.SignedPaymentPayloadSchema.safeParse(req.body);
    if (!parseResult.success) {
      res.status(400).json({
        error: "Invalid payment payload",
        details: parseResult.error.errors
      });
      return;
    }
    const parsed = parseResult.data;
    const payload = {
      witnessSignature: parsed.witnessSignature,
      authorization: {
        chainId: BigInt(parsed.authorization.chainId),
        address: parsed.authorization.address,
        nonce: BigInt(parsed.authorization.nonce),
        yParity: parsed.authorization.yParity,
        r: parsed.authorization.r,
        s: parsed.authorization.s
      },
      paymentDetails: parsed.paymentDetails
    };
    const clients = getNetworkClients(clientsMap, payload.paymentDetails.networkId);
    if (!clients) {
      res.status(400).json({
        error: "Unsupported network",
        network: payload.paymentDetails.networkId
      });
      return;
    }
    const result = await settlePaymentWithMonitoring(payload);
    if (result.success) {
      res.json({
        success: true,
        txHash: result.txHash,
        blockNumber: result.blockNumber?.toString()
      });
    } else {
      res.status(500).json({
        success: false,
        error: result.error
      });
    }
  } catch (error) {
    console.error("Settlement error:", error);
    res.status(500).json({
      error: "Internal server error",
      message: error instanceof Error ? error.message : "Unknown error"
    });
  }
}
async function handleSupported(req, res, clientsMap) {
  try {
    const supportedNetworks = Array.from(clientsMap.keys()).map((network) => {
      const config2 = core.NetworkConfigs[network];
      return {
        networkId: network,
        chainId: config2.chainId,
        name: config2.name,
        explorer: config2.explorer
      };
    });
    res.json({
      version: 1,
      networks: supportedNetworks
    });
  } catch (error) {
    console.error("Supported networks error:", error);
    res.status(500).json({
      error: "Internal server error"
    });
  }
}

// src/api/server.ts
function createServer(config2, clientsMap) {
  const app = express__default.default();
  app.use(express__default.default.json());
  app.use((req, res, next) => {
    res.header("Access-Control-Allow-Origin", "*");
    res.header("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
    res.header("Access-Control-Allow-Headers", "Content-Type, Authorization");
    if (req.method === "OPTIONS") {
      res.sendStatus(200);
      return;
    }
    next();
  });
  app.get("/", (_req, res) => {
    res.json({
      name: "x402 BNB Facilitator",
      version: "0.1.0",
      endpoints: {
        verify: "POST /verify",
        settle: "POST /settle",
        supported: "GET /supported"
      }
    });
  });
  app.post("/verify", (req, res) => handleVerify(req, res, config2));
  app.post("/settle", (req, res) => handleSettle(req, res, clientsMap));
  app.get("/supported", (req, res) => handleSupported(req, res, clientsMap));
  app.get("/health", (_req, res) => {
    let facilitatorAddress;
    try {
      const firstClient = Array.from(clientsMap.values())[0];
      facilitatorAddress = firstClient?.walletClient?.account?.address;
    } catch (error) {
      console.warn("Could not determine facilitator address:", error);
    }
    res.json({
      status: "ok",
      facilitator: facilitatorAddress
    });
  });
  app.use((err, _req, res, _next) => {
    console.error("Server error:", err);
    res.status(500).json({
      error: "Internal server error",
      message: err.message
    });
  });
  return app;
}

// src/index.ts
async function main() {
  console.log("Starting x402 BNB Facilitator...");
  const config2 = loadEnvConfig();
  console.log(`Host: ${config2.host}`);
  console.log(`Port: ${config2.port}`);
  console.log(`Log level: ${config2.logLevel}`);
  const clientsMap = createNetworkClients(config2);
  console.log(`Configured ${clientsMap.size} network(s)`);
  const app = createServer(config2, clientsMap);
  app.listen(config2.port, config2.host, () => {
    console.log(`Facilitator listening on http://${config2.host}:${config2.port}`);
    console.log(`Ready to process payments!`);
  });
}
if (__require.main === module) {
  main().catch((error) => {
    console.error("Fatal error:", error);
    process.exit(1);
  });
}

exports.createNetworkClients = createNetworkClients;
exports.createServer = createServer;
exports.loadEnvConfig = loadEnvConfig;
//# sourceMappingURL=index.js.map
//# sourceMappingURL=index.js.map