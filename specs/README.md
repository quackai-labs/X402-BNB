# q402 Protocol Specifications

This directory contains the specifications for the q402 protocol, following the [x402 standard](https://github.com/coinbase/x402) with EIP-7702 extensions.

## Protocol Overview

q402 extends the x402 payment protocol with EIP-7702 delegated execution, enabling gasless payments on BSC and other EVM networks.

## Specifications

- [Core Protocol](./core-protocol.md) - Base x402 protocol implementation
- [EIP-7702 Extension](./schemes/eip7702-delegated/README.md) - EIP-7702 delegated execution scheme
- [BSC Integration](./networks/bsc.md) - BNB Smart Chain specific configuration
- [API Reference](./api/README.md) - HTTP API specifications

## Protocol Flow

1. **Payment Discovery**: Client requests resource, server responds with 402 Payment Required
2. **Payment Preparation**: Client creates EIP-712 witness and EIP-7702 authorization
3. **Payment Submission**: Client sends X-PAYMENT header with signed payload
4. **Verification**: Resource server verifies payment via facilitator
5. **Settlement**: Facilitator submits EIP-7702 transaction to blockchain
6. **Response**: Server returns resource with X-PAYMENT-RESPONSE header

## Scheme Support

- ✅ `evm/eip7702-signature-based` - EIP-7702 delegated execution with EIP-712 witness
- 🚧 `evm/eip7702-batch` - Batch payments (future)
- 🚧 `evm/permit2-based` - Permit2 integration (future)

## Network Support

- ✅ BNB Smart Chain (Mainnet/Testnet)
- 🚧 Ethereum (when EIP-7702 is available)
- 🚧 Other EVM networks with EIP-7702 support

## Compliance

This implementation follows the x402 standard:
- HTTP 402 semantics
- Standard header formats (X-PAYMENT, X-PAYMENT-RESPONSE)
- Facilitator API compatibility (/verify, /settle, /supported)
- Standard error codes and responses

## Security

- Double-nonce replay protection (EIP-712 + EIP-7702)
- Deadline-based expiration
- Signature verification at multiple layers
- Implementation contract whitelisting
