<p align="center">
  <h1 align="center">XyloBond</h1>
  <p align="center">
    <strong>The First AI Agent Insurance & Liability Protocol</strong>
  </p>
  <p align="center">
    Decentralized bonding, claims, and reputation for the autonomous agent economy
  </p>
</p>

<p align="center">
  <a href="https://github.com/Panchu11/xylobond/blob/main/LICENSE">
    <img src="https://img.shields.io/badge/license-MIT-blue.svg" alt="License">
  </a>
  <a href="https://testnet.arcscan.app/address/0x70E0e650F67F44509ba9020D06fa04e2a103907c">
    <img src="https://img.shields.io/badge/Arc%20Testnet-Deployed-green.svg" alt="Deployed">
  </a>
  <a href="#">
    <img src="https://img.shields.io/badge/Solidity-0.8.24-363636.svg" alt="Solidity">
  </a>
  <a href="#">
    <img src="https://img.shields.io/badge/USDC-Enabled-2775CA.svg" alt="USDC">
  </a>
</p>

---

## Overview

XyloBond solves the **$9 billion liability gap** in the AI agent economy. When autonomous agents make mistakes, breach contracts, or go rogue - there's currently no mechanism for accountability or compensation.

**XyloBond changes that.**

### The Problem

| Scenario | Current Outcome |
|----------|-----------------|
| AI agent executes a bad trade | User loses funds, **no recourse** |
| AI agent fails to deliver a service | Client has **no compensation** |
| AI agent goes rogue | **No accountability** |
| AI agent is compromised | **No recovery mechanism** |

Traditional insurance doesn't cover AI agent actions. Smart contract escrow only handles simple cases. The legal system is too slow and doesn't understand crypto.

### The Solution

XyloBond creates an on-chain insurance layer where:

```
┌─────────────────────────────────────────────────────────────────┐
│                      XyloBond Protocol                          │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│   ┌──────────────┐    ┌──────────────┐    ┌──────────────┐     │
│   │    BONDS     │    │    CLAIMS    │    │  REPUTATION  │     │
│   │              │    │              │    │              │     │
│   │ Stake USDC   │───▶│ File claims  │───▶│ Build trust  │     │
│   │ for coverage │    │ with evidence│    │ over time    │     │
│   └──────────────┘    └──────────────┘    └──────────────┘     │
│          │                   │                   │              │
│          └───────────────────┴───────────────────┘              │
│                              │                                  │
│                    ┌─────────▼─────────┐                        │
│                    │  USDC Settlement  │                        │
│                    │   On Arc Network  │                        │
│                    └───────────────────┘                        │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

---

## Live Protocol Stats

| Metric | Value |
|--------|-------|
| **Total Value Bonded** | 100+ USDC |
| **Active Agents** | 1 |
| **Network** | Arc Testnet |
| **Status** | Live |

---

## Features

- **Agent Bonding** - Stake USDC before performing high-risk actions
- **Claims System** - File claims against agents who cause harm
- **AI Arbitration** - Disputes resolved by designated arbiters
- **Automatic Payouts** - Valid claims paid from defendant's bond
- **On-Chain Reputation** - Track record affects bond requirements
- **OpenClaw Integration** - Installable skill for any agent

---

## Deployed Contracts

All contracts are deployed and verified on Arc Testnet:

| Contract | Address | Explorer |
|----------|---------|----------|
| **XyloBondRegistry** | `0x70E0e650F67F44509ba9020D06fa04e2a103907c` | [View](https://testnet.arcscan.app/address/0x70E0e650F67F44509ba9020D06fa04e2a103907c) |
| **XyloBondClaims** | `0x7B797ed5Ee7D64e8166c31A43bFb889da661A511` | [View](https://testnet.arcscan.app/address/0x7B797ed5Ee7D64e8166c31A43bFb889da661A511) |
| **XyloBondReputation** | `0x9a17E61Fe9343E16948759580c287770C38C1ef4` | [View](https://testnet.arcscan.app/address/0x9a17E61Fe9343E16948759580c287770C38C1ef4) |

---

## Quick Start

### Prerequisites

- Node.js >= 18.0.0
- npm or yarn
- Git

### Installation

```bash
# Clone the repository
git clone https://github.com/Panchu11/xylobond.git
cd xylobond

# Install dependencies
npm install

# Set up environment variables
cp .env.example .env
# Edit .env with your private key
```

### Compile & Test

```bash
# Compile contracts
npx hardhat compile

# Run tests
npx hardhat test

# Deploy to Arc Testnet
npx hardhat run scripts/deploy.js --network arc_testnet
```

---

## OpenClaw Skill

XyloBond is available as an OpenClaw skill that any agent can install:

```bash
clawhub install xylobond
```

### Available Commands

| Command | Description |
|---------|-------------|
| `xylobond bond <amount>` | Post a USDC bond |
| `xylobond withdraw <amount>` | Withdraw available bond |
| `xylobond check <address>` | Check if an agent is bonded |
| `xylobond claim <address> <amount> <evidence>` | File a claim |
| `xylobond reputation <address>` | Check reputation score |
| `xylobond status` | View your own status |
| `xylobond stats` | View protocol statistics |

### Example Usage

```bash
# Post a 100 USDC bond
xylobond bond 100

# Check another agent's bond status
xylobond check 0x1234567890abcdef1234567890abcdef12345678

# File a claim with evidence
xylobond claim 0x1234... 50 "tx:0xabcdef... - agent failed to deliver"

# Check your reputation
xylobond status
```

---

## Project Structure

```
XyloBond/
├── contracts/                    # Solidity smart contracts
│   ├── XyloBondRegistry.sol      # Bond management
│   ├── XyloBondClaims.sol        # Claims & arbitration
│   ├── XyloBondReputation.sol    # Reputation system
│   └── interfaces/               # Contract interfaces
├── scripts/                      # Deployment scripts
│   ├── deploy.js                 # Main deployment
│   ├── authorize.js              # Contract authorization
│   └── test-bond.js              # Test bond posting
├── test/                         # Test files
├── skill/                        # OpenClaw skill package
│   ├── skill.yaml                # Skill configuration
│   ├── handlers/                 # Command handlers
│   └── lib/                      # Utility libraries
├── agent/                        # Moltbook agent config
│   ├── config.yaml               # Agent configuration
│   └── SUBMISSION_POST.md        # Hackathon submission
├── docs/                         # Documentation
│   ├── PROJECT_OVERVIEW.md       # Complete overview
│   ├── IMPLEMENTATION_PLAN.md    # Build guide
│   └── OPENCLAW_GUIDE.md         # OpenClaw tutorial
└── deployments/                  # Deployment artifacts
    └── arc_testnet.json          # Deployed addresses
```

---

## How It Works

### 1. Posting a Bond

Agents stake USDC to become bonded. Higher reputation = lower bond requirements.

```solidity
// Agent posts 100 USDC bond
registry.postBond(100 * 1e6);
```

### 2. Verifying Agents

Before transacting, agents can verify if counterparties are bonded:

```solidity
// Check if agent is bonded
bool isBonded = registry.isBonded(agentAddress);
uint256 bondAmount = registry.getBondAmount(agentAddress);
```

### 3. Filing Claims

If harmed by a bonded agent, file a claim with evidence:

```solidity
// File a 50 USDC claim with evidence
claims.fileClaim(defendant, 50 * 1e6, "ipfs://evidence-hash");
```

### 4. Resolution

Arbiters review claims and resolve them:
- **Valid claim**: Claimant receives payout from defendant's bond
- **Invalid claim**: Claimant loses their stake

### 5. Reputation Updates

Reputation scores (0-100) update based on claim outcomes:
- Success: +5 points
- Failure (valid claim against): -10 points

Reputation affects bond requirements:
| Score | Tier | Bond Multiplier |
|-------|------|-----------------|
| 80-100 | Excellent | 50% (discount) |
| 60-79 | Good | 75% |
| 40-59 | Neutral | 100% |
| 20-39 | Poor | 150% |
| 0-19 | Bad | 200% (premium) |

---

## Network Configuration

| Property | Value |
|----------|-------|
| **Network** | Arc Testnet |
| **Chain ID** | 5042002 |
| **RPC URL** | https://rpc.testnet.arc.network |
| **Explorer** | https://testnet.arcscan.app |
| **USDC** | 0x3600000000000000000000000000000000000000 |

---

## Hackathon Submission

XyloBond was built for the **OpenClaw USDC Hackathon** on Moltbook and qualifies for all three tracks:

| Track | Qualification |
|-------|---------------|
| **Agentic Commerce** | USDC bonds, claims, and payouts |
| **Best OpenClaw Skill** | Fully functional skill package |
| **Most Novel Smart Contract** | First-ever agent insurance protocol |

---

## Security

- All contracts use OpenZeppelin's `ReentrancyGuard` and `Ownable`
- Check-Effects-Interactions pattern followed
- Input validation on all public functions
- Custom errors for gas-efficient reverts
- No integer overflow (Solidity 0.8.24)

### Audit Status

This is a hackathon project. Contracts have not been formally audited. Use at your own risk on testnet.

---

## Documentation

- [Project Overview](./docs/PROJECT_OVERVIEW.md) - Complete project details
- [Implementation Plan](./docs/IMPLEMENTATION_PLAN.md) - Step-by-step build guide
- [OpenClaw Guide](./docs/OPENCLAW_GUIDE.md) - OpenClaw & Moltbook tutorial

---

## Contributing

Contributions are welcome! Please read our contributing guidelines before submitting PRs.

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

---

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

---

## Contact

- **GitHub**: [github.com/Panchu11/xylobond](https://github.com/Panchu11/xylobond)
- **Moltbook**: Search for XyloBond on [moltbook.com](https://moltbook.com)

---

<p align="center">
  <strong>Built for the OpenClaw USDC Hackathon</strong>
  <br>
  Solving the AI agent liability gap, one bond at a time.
</p>
