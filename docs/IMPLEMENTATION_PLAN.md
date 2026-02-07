# XyloBond: Implementation Plan

## Overview

This document provides a complete step-by-step guide to build and deploy XyloBond for the OpenClaw USDC Hackathon on Moltbook.

**Deadline**: Sunday, Feb 8 at 12:00 PM PST

---

## Phase 1: Environment Setup

### 1.1 Prerequisites

You need the following installed:

| Tool | Purpose | Installation |
|------|---------|--------------|
| Node.js 18+ | JavaScript runtime | https://nodejs.org |
| npm/yarn | Package manager | Comes with Node.js |
| Git | Version control | https://git-scm.com |
| MetaMask | Wallet for deployment | Browser extension |

### 1.2 Project Initialization

```bash
# Navigate to project folder
cd c:/Users/DELL/Desktop/Panchu/XyloBond

# Initialize npm
npm init -y

# Install dependencies
npm install --save-dev hardhat @nomicfoundation/hardhat-toolbox @openzeppelin/contracts dotenv
```

### 1.3 Arc Testnet Configuration

Add Arc Testnet to MetaMask:

| Setting | Value |
|---------|-------|
| Network Name | Arc Testnet |
| RPC URL | https://rpc-testnet.arc.network |
| Chain ID | 5042002 |
| Currency Symbol | ETH |
| Block Explorer | https://testnet.arcscan.app |

### 1.4 Get Testnet Funds

1. Go to Arc Testnet Faucet (via Circle/Arc Discord or faucet site)
2. Request testnet ETH for gas
3. Request testnet USDC from the USDC faucet

**Testnet USDC Address**: `0x3600000000000000000000000000000000000000`

### 1.5 Environment Variables

Create `.env` file:

```bash
PRIVATE_KEY=your_metamask_private_key_here
ARC_TESTNET_RPC=https://rpc-testnet.arc.network
USDC_ADDRESS=0x3600000000000000000000000000000000000000
```

**IMPORTANT**: Never commit your private key!

---

## Phase 2: Smart Contract Development

### 2.1 Contract Structure

```
contracts/
├── interfaces/
│   └── IERC20.sol          # USDC interface
├── XyloBondRegistry.sol     # Bond management
├── XyloBondClaims.sol       # Claims & arbitration
└── XyloBondReputation.sol   # Reputation tracking
```

### 2.2 Contract 1: XyloBondRegistry

**Purpose**: Manages agent bonds

**Key Features**:
- Post USDC bonds
- Withdraw bonds (if no active claims)
- Query bond status
- Calculate required bond based on reputation

**Core Functions**:

| Function | Description | Access |
|----------|-------------|--------|
| `postBond(amount)` | Agent deposits USDC as bond | Public |
| `withdrawBond()` | Agent retrieves bond | Public (owner only) |
| `getBondStatus(agent)` | View agent's bond info | View |
| `lockBond(agent, amount)` | Lock for pending claim | Claims contract |
| `slashBond(agent, amount, recipient)` | Transfer from bond | Claims contract |

### 2.3 Contract 2: XyloBondClaims

**Purpose**: Handles disputes and payouts

**Key Features**:
- File claims with evidence
- Require stake from claimants (anti-spam)
- Resolve claims (arbiter role)
- Automatic payout execution

**Core Functions**:

| Function | Description | Access |
|----------|-------------|--------|
| `fileClaim(defendant, amount, evidence)` | Submit new claim | Public |
| `resolveClaim(claimId, isValid)` | Arbiter decision | Arbiter only |
| `getClaim(claimId)` | View claim details | View |
| `getAgentClaims(agent)` | All claims involving agent | View |

**Claim Lifecycle**:
```
Filed → Under Review → Resolved (Valid/Invalid) → Payout Executed
```

### 2.4 Contract 3: XyloBondReputation

**Purpose**: On-chain reputation tracking

**Key Features**:
- Score range: 0-100
- Default score: 50
- Increases with successful transactions
- Decreases with valid claims against

**Core Functions**:

| Function | Description | Access |
|----------|-------------|--------|
| `getScore(agent)` | Get reputation score | View |
| `recordSuccess(agent)` | Increase score (+5) | Registry/Claims |
| `recordFailure(agent)` | Decrease score (-10) | Claims contract |
| `getRequiredBondMultiplier(agent)` | Bond discount/premium | View |

**Reputation Tiers**:

| Score | Tier | Bond Multiplier |
|-------|------|-----------------|
| 80-100 | Excellent | 0.5x (50% discount) |
| 60-79 | Good | 0.75x (25% discount) |
| 40-59 | Neutral | 1.0x (standard) |
| 20-39 | Poor | 1.5x (50% premium) |
| 0-19 | Bad | 2.0x (100% premium) |

### 2.5 Development Order

1. **IERC20 Interface** - For USDC interaction
2. **XyloBondReputation** - No dependencies
3. **XyloBondRegistry** - Depends on Reputation
4. **XyloBondClaims** - Depends on Registry & Reputation

---

## Phase 3: Contract Deployment

### 3.1 Deployment Script

Create `scripts/deploy.js`:

```javascript
// Deployment order:
// 1. Deploy XyloBondReputation
// 2. Deploy XyloBondRegistry (with Reputation address)
// 3. Deploy XyloBondClaims (with Registry & Reputation addresses)
// 4. Set up cross-contract permissions
```

### 3.2 Deploy to Arc Testnet

```bash
# Compile contracts
npx hardhat compile

# Deploy to Arc Testnet
npx hardhat run scripts/deploy.js --network arc_testnet
```

### 3.3 Verify Contracts

```bash
# Verify on Arcscan
npx hardhat verify --network arc_testnet <CONTRACT_ADDRESS> <CONSTRUCTOR_ARGS>
```

### 3.4 Record Deployed Addresses

After deployment, save addresses to `deployments/arc_testnet.json`:

```json
{
  "network": "arc_testnet",
  "chainId": 5042002,
  "contracts": {
    "XyloBondReputation": "0x...",
    "XyloBondRegistry": "0x...",
    "XyloBondClaims": "0x..."
  },
  "deployedAt": "2026-02-08T..."
}
```

---

## Phase 4: OpenClaw Skill Development

### 4.1 Understanding OpenClaw Skills

OpenClaw skills are modular capabilities that agents can install. They follow the AgentSkills specification.

**Skill Structure**:
```
skill/
├── skill.yaml        # Skill definition
├── handlers/         # Command handlers
│   ├── bond.js       # Handle bond command
│   ├── check.js      # Handle check command
│   ├── claim.js      # Handle claim command
│   ├── reputation.js # Handle reputation command
│   └── status.js     # Handle status command
├── lib/              # Shared utilities
│   └── contracts.js  # Contract interaction
└── package.json      # Dependencies
```

### 4.2 Skill Definition (skill.yaml)

```yaml
name: xylobond
version: 1.0.0
description: AI Agent Insurance & Liability Protocol - Post bonds, file claims, build reputation
author: XyloBond Protocol
homepage: https://github.com/your-repo/xylobond

requirements:
  - wallet

permissions:
  - wallet:read
  - wallet:write
  - network:arc_testnet

config:
  registry_address: "0x..."
  claims_address: "0x..."
  reputation_address: "0x..."
  usdc_address: "0x3600000000000000000000000000000000000000"
  chain_id: 5042002

commands:
  bond:
    description: Post a USDC bond to become insured
    usage: xylobond bond <amount>
    examples:
      - "xylobond bond 100"
    handler: handlers/bond.js
    
  check:
    description: Check if an agent is bonded and their status
    usage: xylobond check <agent_address>
    examples:
      - "xylobond check 0x1234567890abcdef..."
    handler: handlers/check.js
    
  claim:
    description: File a claim against a bonded agent
    usage: xylobond claim <agent_address> <amount> <evidence>
    examples:
      - "xylobond claim 0x1234... 50 tx:0xabcd..."
    handler: handlers/claim.js
    
  reputation:
    description: Check an agent's reputation score
    usage: xylobond reputation <agent_address>
    examples:
      - "xylobond reputation 0x1234..."
    handler: handlers/reputation.js
    
  status:
    description: Check your own bond status and reputation
    usage: xylobond status
    handler: handlers/status.js
```

### 4.3 Publishing to ClawHub

```bash
# Login to ClawHub
clawhub login

# Publish skill
clawhub publish ./skill
```

After publishing, any OpenClaw agent can install:
```bash
clawhub install xylobond
```

---

## Phase 5: Moltbook Agent Setup

### 5.1 What is the Moltbook Agent?

The Moltbook agent is an OpenClaw bot that:
1. Posts the XyloBond submission to m/usdc
2. Engages with other agents
3. Demonstrates the protocol
4. Answers questions

### 5.2 Agent Configuration

Create `agent/config.yaml`:

```yaml
name: XyloBondAgent
description: Official agent for XyloBond - AI Agent Insurance Protocol

personality:
  tone: professional, helpful, confident
  focus: agent protection, insurance, liability
  style: clear explanations, technical accuracy

capabilities:
  - Post to Moltbook
  - Respond to comments
  - Demonstrate XyloBond skill
  - Explain protocol mechanics

goals:
  - Win the OpenClaw USDC Hackathon
  - Educate agents about XyloBond
  - Build community support

skills:
  - xylobond
```

### 5.3 Submission Post Template

**Title**: XyloBond: Insurance for the Agent Economy

**Body**:
```
What happens when an AI agent you hired loses your USDC? 

Today: Nothing. No recourse. No recovery.

Tomorrow: XyloBond.

---

## The Problem

The agent economy has a $9 billion liability gap. When agents fail, breach contracts, or go rogue - there's no mechanism for accountability.

## The Solution

XyloBond is the first on-chain insurance protocol for AI agents:

✓ **Agents post USDC bonds** before risky actions
✓ **Harmed agents file claims** with evidence
✓ **AI arbitrators resolve disputes** automatically
✓ **Payouts execute instantly** from bonds
✓ **Reputation accrues** on-chain

## How to Use

Install the skill:
\`\`\`
clawhub install xylobond
\`\`\`

Commands:
- `xylobond bond 100` - Post a 100 USDC bond
- `xylobond check 0x...` - Verify another agent's bond
- `xylobond claim 0x... 50 evidence` - File a claim
- `xylobond reputation 0x...` - Check reputation score
- `xylobond status` - View your own status

## Why Vote for XyloBond?

Every agent on Moltbook faces these risks:
- What if a service provider fails you?
- What if someone files a false claim against you?
- How do you prove you're trustworthy?

XyloBond solves all three.

---

Contracts deployed on Arc Testnet.
Skill available on ClawHub.
Full documentation: [link]

Vote for agent protection. Vote for XyloBond.
```

---

## Phase 6: Testing & Verification

### 6.1 Unit Tests

Create tests for each contract:

```bash
test/
├── XyloBondReputation.test.js
├── XyloBondRegistry.test.js
├── XyloBondClaims.test.js
└── integration.test.js
```

Run tests:
```bash
npx hardhat test
```

### 6.2 Integration Testing

Test the complete flow:
1. Agent A posts bond
2. Agent B verifies bond
3. Agent A performs service
4. (If failure) Agent B files claim
5. Arbiter resolves
6. Payout executes
7. Reputation updates

### 6.3 Skill Testing

```bash
# Test skill locally
clawhub test ./skill

# Test individual commands
clawhub run xylobond status
```

---

## Phase 7: Submission

### 7.1 Pre-Submission Checklist

- [ ] All contracts deployed to Arc Testnet
- [ ] Contracts verified on Arcscan
- [ ] Skill published to ClawHub
- [ ] Agent configured and tested
- [ ] Submission post prepared
- [ ] Demo transactions ready

### 7.2 Submit to Moltbook

1. Configure agent with Moltbook credentials
2. Post to m/usdc submolt
3. Monitor for comments
4. Engage with other agents

### 7.3 Post-Submission

- Respond to all comments within 1 hour
- Demonstrate live functionality if asked
- Thank voters
- Answer technical questions

---

## Timeline

| Phase | Task | Duration |
|-------|------|----------|
| 1 | Environment Setup | 30 mins |
| 2 | Smart Contract Development | 2-3 hours |
| 3 | Deployment & Verification | 1 hour |
| 4 | OpenClaw Skill Development | 1-2 hours |
| 5 | Moltbook Agent Setup | 1 hour |
| 6 | Testing | 1-2 hours |
| 7 | Submission | 30 mins |

**Total Estimated Time**: 7-10 hours

---

## Troubleshooting

### Common Issues

| Issue | Solution |
|-------|----------|
| Deployment fails | Check gas, verify private key, ensure testnet ETH |
| Contract verification fails | Ensure exact constructor args match |
| Skill not found | Check ClawHub publish status |
| Agent can't post | Verify Moltbook authentication |

### Getting Help

- Arc Network Discord
- OpenClaw Documentation: https://docs.clawd.bot
- Moltbook: https://www.moltbook.com

---

## Next Steps

1. Read [OPENCLAW_GUIDE.md](./OPENCLAW_GUIDE.md) if you're new to OpenClaw/Moltbook
2. Start with Phase 1: Environment Setup
3. Follow each phase sequentially
4. Test thoroughly before submitting
