# EIP-7702 Delegated Execution Scheme

## Scheme Identifier

`evm/eip7702-signature-based`

## Overview

This scheme enables gasless payments using EIP-7702 delegated execution. Users sign payment intentions off-chain, and facilitators execute the payments on-chain while paying gas fees.

## Architecture

1. **User** signs an EIP-712 witness message authorizing payment
2. **User** signs an EIP-7702 authorization tuple for delegated execution
3. **Facilitator** constructs and submits an EIP-7702 transaction (type 0x04)
4. **Implementation Contract** executes the payment in the user's account context

## Payload Structure

```typescript
interface EIP7702SignatureBasedPayload {
  witnessSignature: Hex;           // EIP-712 signature of witness message
  authorization: AuthorizationTuple; // EIP-7702 authorization
  paymentDetails: PaymentDetails;   // Payment information
}

interface AuthorizationTuple {
  chainId: bigint;
  address: Hex;                    // Implementation contract address
  nonce: bigint;
  yParity: number;
  r: Hex;
  s: Hex;
}

interface PaymentDetails {
  scheme: "evm/eip7702-signature-based";
  networkId: string;
  token: Hex;                      // ERC-20 token address
  amount: string;                  // Amount in wei
  to: Hex;                         // Recipient address
  implementationContract: Hex;      // Delegated execution contract
  witness: {
    types: EIP712Types;
    domain: EIP712Domain;
    message: WitnessMessage;
  };
  authorization: AuthorizationTuple;
  deadline: string;                // Unix timestamp
  nonce: string;                   // Unique nonce
}
```

## Witness Message

The EIP-712 witness message authorizes the specific payment:

```typescript
interface WitnessMessage {
  owner: Hex;                      // User's address
  token: Hex;                      // Token contract
  amount: bigint;                  // Payment amount
  to: Hex;                         // Recipient
  deadline: bigint;                // Expiration time
  paymentId: Hex;                  // Unique payment ID
  nonce: bigint;                   // Anti-replay nonce
}
```

## EIP-712 Domain

```typescript
interface EIP712Domain {
    name: "q402";
  version: "1";
  chainId: number;
  verifyingContract: Hex;          // Implementation contract address
}
```

## Verification Process

1. **Recover Witness Signer**: Use `ecrecover` on EIP-712 signature
2. **Recover Authorization Signer**: Use `ecrecover` on EIP-7702 authorization
3. **Verify Signer Match**: Ensure both signatures are from the same address
4. **Validate Constraints**: Check amounts, deadlines, recipients
5. **Check Nonces**: Verify nonces haven't been used

## Settlement Process

1. **Construct EIP-7702 Transaction**: Type 0x04 with authorization list
2. **Set Transaction Target**: Send to user's EOA (not implementation contract)
3. **Include Call Data**: Encoded function call to implementation contract
4. **Submit Transaction**: Facilitator pays gas, user's account executes

## Implementation Contract Interface

```solidity
interface IPaymentImplementation {
    function pay(
        address owner,
        address token,
        uint256 amount,
        address to,
        uint256 deadline,
        bytes32 paymentId,
        bytes calldata signature
    ) external;

    function payBatch(
        address owner,
        PaymentItem[] calldata items,
        uint256 deadline,
        bytes32 paymentId,
        bytes calldata signature
    ) external;
}
```

## Security Model

- **Double Nonce Protection**: EIP-712 witness nonce + EIP-7702 authorization nonce
- **Time Bounds**: Deadline prevents indefinite authorization
- **Signature Binding**: Authorization and witness must be from same signer
- **Implementation Whitelisting**: Only trusted contracts can be authorized
- **Amount Limits**: Witness specifies exact payment amounts

## Gas Considerations

- **User**: No gas required (gasless experience)
- **Facilitator**: Pays all gas costs
- **Estimation**: ~200,000 gas per payment (varies by token/network)

## Example Transaction

```typescript
// EIP-7702 transaction (type 0x04)
{
  type: 0x04,
  to: "0x1234...", // User's EOA address
  data: "0x...",    // Encoded pay() function call
  value: 0n,
  authorizationList: [{
    chainId: 56,
    address: "0x5678...", // Implementation contract
    nonce: 0,
    yParity: 1,
    r: "0x...",
    s: "0x..."
  }]
}
```
