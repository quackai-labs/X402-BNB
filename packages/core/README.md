# @q402/core

Core SDK for q402 EIP-7702 delegated payment protocol.

## Installation

```bash
npm install @q402/core viem
```

## Features

- EIP-712 witness signing for payment authorization
- EIP-7702 authorization tuple generation and signing
- Payment verification and validation
- Settlement transaction construction
- Type-safe TypeScript APIs

## Usage

### Client-Side: Creating Payments

```typescript
import { createPaymentHeader, prepareWitness, signWitness } from "@q402/core/client";
import { privateKeyToAccount } from "viem/accounts";

// Create account
const account = privateKeyToAccount("0x...");

// Prepare witness message
const witness = prepareWitness({
  owner: account.address,
  token: "0xTokenAddress",
  amount: "1000000",
  to: "0xRecipient",
});

// Create complete payment header
const paymentHeader = await createPaymentHeader(account, paymentDetails);
```

### Server-Side: Verification & Settlement

```typescript
import { verifyPayment, settlePayment } from "@q402/core/facilitator";
import { createWalletClient } from "viem";

// Verify payment
const result = await verifyPayment(signedPayload);
if (!result.isValid) {
  console.error("Invalid payment:", result.invalidReason);
}

// Settle payment (facilitator)
const settlement = await settlePayment(walletClient, signedPayload);
console.log("Transaction:", settlement.txHash);
```

## API Documentation

### Types

See [src/types](./src/types) for complete type definitions:

- `PaymentDetails` - Payment requirements from server
- `WitnessMessage` - EIP-712 witness structure
- `AuthorizationTuple` - EIP-7702 authorization
- `SignedPaymentPayload` - Complete signed payment

### Client Functions

- `prepareWitness()` - Create witness message
- `signWitness()` - Sign witness with EIP-712
- `prepareAuthorization()` - Create authorization tuple
- `signAuthorization()` - Sign authorization with EIP-7702
- `createPaymentHeader()` - All-in-one payment creation
- `selectPaymentDetails()` - Choose payment from 402 response

### Facilitator Functions

- `verifyPayment()` - Verify all signatures and constraints
- `settlePayment()` - Submit type 0x04 transaction
- `estimateSettlementGas()` - Estimate gas cost

## Networks

Supported networks:

- `bsc-mainnet` - BNB Smart Chain Mainnet (Chain ID: 56)
- `bsc-testnet` - BNB Smart Chain Testnet (Chain ID: 97)

## License

Apache-2.0

