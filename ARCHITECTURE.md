# Architecture Documentation

## Overview

q402 is a TypeScript implementation of a gasless payment protocol using EIP-7702 delegated execution on BSC and EVM networks. The architecture is designed as a modular monorepo with clear separation of concerns.

## Project Structure

```
q402/
├── packages/
│   ├── core/                 # Core SDK
│   ├── middleware-express/   # Express middleware
│   ├── middleware-hono/      # Hono middleware
│   └── facilitator/          # Facilitator service
├── examples/
│   └── bsc-testnet/         # BSC testnet examples
└── docs/                    # Documentation
```

## Core Components

### 1. Core SDK (@q402/core)

The foundation of the protocol, providing:

**Type System**
- `types/network.ts` - Network configurations (BSC mainnet/testnet)
- `types/eip7702.ts` - Authorization tuple structures
- `types/eip712.ts` - Witness message structures
- `types/payment.ts` - Payment flow types
- `types/schemas.ts` - Zod validation schemas
- `types/responses.ts` - API response types

**Client Functions**
- `client/prepareWitness.ts` - Create EIP-712 witness messages
- `client/signWitness.ts` - Sign witness with private key
- `client/prepareAuthorization.ts` - Create EIP-7702 auth tuples
- `client/signAuthorization.ts` - Sign authorization tuples
- `client/createPaymentHeader.ts` - Generate X-PAYMENT header
- `client/selectPaymentDetails.ts` - Choose from 402 response

**Facilitator Functions**
- `facilitator/verify.ts` - Verify signatures and constraints
- `facilitator/settle.ts` - Construct and submit 0x04 transactions

**Utilities**
- `utils/errors.ts` - Custom error classes
- `utils/nonce.ts` - Nonce generation
- `utils/encoding.ts` - Base64 and RLP encoding
- `utils/validation.ts` - Input validation

**Contracts**
- `contracts/abi.ts` - Implementation contract ABIs
- `contracts/addresses.ts` - Contract address registry

### 2. Express Middleware (@q402/middleware-express)

HTTP middleware for Express.js applications:

**Components**
- `middleware.ts` - Main middleware function
- `handlers.ts` - 402 response generators
- `config.ts` - Configuration types

**Features**
- Automatic 402 response for unpaid requests
- Payment signature verification
- Optional auto-settlement
- Request object extension with payment info
- X-PAYMENT-RESPONSE header generation

### 3. Hono Middleware (@q402/middleware-hono)

HTTP middleware for Hono framework:

**Components**
- `middleware.ts` - Hono-compatible middleware
- `handlers.ts` - 402 response generators  
- `config.ts` - Configuration types

**Features**
- Same features as Express middleware
- Hono context integration
- Type-safe with Hono's type system

### 4. Facilitator Service (@q402/facilitator)

Standalone verification and settlement service:

**API Routes**
- `POST /verify` - Verify payment signatures
- `POST /settle` - Submit payment to blockchain
- `GET /supported` - List supported networks
- `GET /health` - Health check

**Services**
- `services/verification.ts` - Whitelist checks + verification
- `services/settlement.ts` - Transaction submission + monitoring

**Configuration**
- `config/env.ts` - Environment variable loading
- `config/networks.ts` - Network client management

## Payment Flow

### Client-Side Flow

```
1. Request Resource
   ↓
2. Receive 402 Response with paymentDetails
   ↓
3. Create Witness Message (EIP-712)
   - owner, token, amount, to, deadline, paymentId, nonce
   ↓
4. Sign Witness with Private Key
   ↓
5. Create Authorization Tuple (EIP-7702)
   - chain_id, implementation address, nonce
   ↓
6. Sign Authorization Tuple
   ↓
7. Combine into X-PAYMENT Header (Base64)
   ↓
8. Send Request with X-PAYMENT
   ↓
9. Receive Resource + X-PAYMENT-RESPONSE
```

### Server-Side Flow

```
1. Receive Request
   ↓
2. Check for X-PAYMENT Header
   ├─ No → Return 402 with paymentDetails
   └─ Yes ↓
3. Decode Payment Payload
   ↓
4. Verify Witness Signature (EIP-712)
   ↓
5. Verify Authorization Signature (EIP-7702)
   ↓
6. Verify Constraints (amount, deadline, recipient)
   ↓
7. If Auto-Settle:
   ├─ Construct 0x04 Transaction
   ├─ Submit to Blockchain
   └─ Wait for Confirmation
   ↓
8. Fulfill Request
   ↓
9. Return Resource + X-PAYMENT-RESPONSE
```

## Signature Schemes

### EIP-712 Witness Signing

```typescript
Domain:
    name: "q402"
  version: "1"
  chainId: 56 (or 97)
  verifyingContract: <verifier address>

Message:
  owner: address
  token: address
  amount: uint256
  to: address
  deadline: uint256
  paymentId: bytes32
  nonce: uint256

Signature: ECDSA over keccak256(domain_separator || message_hash)
```

### EIP-7702 Authorization Signing

```typescript
Authorization Tuple:
  chain_id: uint256
  address: address (implementation contract)
  nonce: uint64

Digest: keccak256(0x05 || rlp([chain_id, address, nonce]))
Signature: ECDSA over digest
```

## Transaction Type 0x04

EIP-7702 introduces a new transaction type for delegated execution:

```typescript
{
  type: 0x04,
  to: <owner's EOA>,
  authorizationList: [
    {
      chainId: uint256,
      address: <implementation>,
      nonce: uint64,
      yParity: 0 or 1,
      r: bytes32,
      s: bytes32
    }
  ],
  data: <encoded function call>,
  // Standard tx fields: nonce, gasLimit, maxFeePerGas, etc.
}
```

The transaction temporarily delegates the owner's EOA code to the implementation contract, executes the call in that context, then reverts the delegation.

## Security Model

### Defense Layers

1. **Signature Verification**
   - EIP-712 witness signature must recover to owner
   - EIP-7702 authorization must recover to owner
   - Both must match

2. **Nonce Management**
   - EIP-7702 authorization nonce (uint64, on-chain)
   - Application nonce (off-chain tracking)
   - Payment ID uniqueness

3. **Time Constraints**
   - Deadline field in witness
   - Short validity windows (default 15 minutes)
   - Server-side expiration checks

4. **Whitelist Controls**
   - Implementation contract whitelist
   - Token address validation
   - Recipient address validation

5. **Amount Limits**
   - Per-transaction caps
   - Per-account limits
   - Rate limiting

6. **Event Logging**
   - All payments logged on-chain
   - Immutable audit trail
   - Indexable for analytics

### Attack Mitigation

**Replay Attacks**: Prevented by dual nonce system + payment ID uniqueness

**Front-Running**: Signature binds to specific payer; any submitter has same effect

**Man-in-the-Middle**: HTTPS + signature verification

**Phishing**: Domain separation in EIP-712; users see clear signing UI

**Implementation Exploit**: Whitelist + version management

## Extensibility

### Adding New Networks

1. Add network config to `core/src/types/network.ts`
2. Update `SupportedNetworks` enum
3. Add RPC URL to facilitator config
4. Deploy implementation contract
5. Update contract addresses

### Adding New Schemes

1. Define new scheme in `core/src/types/payment.ts`
2. Implement signing logic in `core/src/client/`
3. Implement verification in `core/src/facilitator/`
4. Update middleware to handle new scheme
5. Add examples

### Custom Middleware

Both Express and Hono middleware follow a clear pattern that can be adapted to other frameworks:

```typescript
1. Extract X-PAYMENT header
2. Decode and parse payload
3. Call core verify function
4. Optionally settle
5. Inject payment info into request context
6. Continue or return 402
```

## Performance Considerations

### Client-Side

- Signature generation: ~10ms (EIP-712 + EIP-7702)
- Network latency: Variable (2-way HTTP)
- No on-chain interaction for users

### Server-Side

- Signature verification: ~5ms per signature
- Settlement (if enabled): 3-5 seconds (BSC block time)
- Async settlement recommended for high throughput

### Facilitator

- Stateless verification: Horizontally scalable
- Settlement queue: Process in background
- RPC connection pooling recommended

## Monitoring and Observability

### Metrics

- Payment verification rate
- Settlement success rate
- Transaction confirmation time
- Error rates by type
- Network latency

### Logs

- All verification attempts
- Settlement transactions (tx hash)
- Errors with context
- Performance timings

### Traces

- OpenTelemetry compatible
- Request ID correlation
- Distributed tracing support

## Deployment

### Development

```bash
pnpm install
pnpm build
pnpm test
```

### Production

**Core SDK**: Published to npm
**Middleware**: Integrated into application
**Facilitator**: Deployed as standalone service

## Future Enhancements

1. **Smart Nonce Strategies**
   - Bit-field nonces for parallelization
   - Per-resource nonce domains

2. **Witness Extensions**
   - KYC/AML metadata
   - Jurisdiction identifiers
   - Identity weighting

3. **Cross-Chain Support**
   - More EIP-7702 networks
   - Bridge integration
   - Multi-chain settlements

4. **Advanced Features**
   - Recurring payments
   - Streaming payments
   - Escrow support

## References

- [EIP-7702 Specification](https://eips.ethereum.org/EIPS/eip-7702)
- [EIP-712 Specification](https://eips.ethereum.org/EIPS/eip-712)
- [Original x402 Protocol](https://github.com/coinbase/x402)
- [BSC Documentation](https://docs.bnbchain.org/)

