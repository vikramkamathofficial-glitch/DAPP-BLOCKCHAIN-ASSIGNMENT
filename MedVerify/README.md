# MedVerify – Blockchain Medicine Authenticity DApp

**Course:** Blockchain Technology (CSE4444) – Assignment 2
**Student:** `vikram gangadhar kamath` | **Reg. No:** `230905014`

## 1. Problem addressed

Counterfeit and expired medicines are a serious public-health problem. Patients and pharmacists have no
tamper-proof way to check whether a medicine batch is genuine, who made it, or whether it has been recalled.

**MedVerify** puts a medicine batch registry on the Ethereum blockchain:

| Role | What they can do |
|---|---|
| **Regulator** (contract deployer) | Approve / revoke manufacturers |
| **Approved manufacturer** | Register batches (ID, drug, expiry); recall their own batches |
| **Anyone** (pharmacist, patient) | Verify a batch ID and see status: `AUTHENTIC`, `EXPIRED`, `RECALLED` or `NOT REGISTERED` |

The regulator can also recall any batch.

## 2. Project structure

```
MedVerify/
├── contracts/MedVerify.sol     Solidity smart contract
├── frontend/                   index.html, style.css, app.js (Ethers.js v6 + MetaMask)
├── test/run-tests.js           Automated tests (valid / invalid / unauthorised)
├── docs/test-results.md        Generated test results table
├── docs/screenshots/           <--screenshots here
├── package.json
└── README.md
```

## 3. Smart contract overview

- **Variables:** `regulator`, `approvedManufacturers` mapping, `batches` mapping, `batchIds` array, `Batch` struct
- **Constructor:** sets `msg.sender` as the regulator
- **Functions:** `approveManufacturer`, `revokeManufacturer`, `registerBatch`, `recallBatch`, `verifyBatch`, `getBatchCount`, `getBatchIdAt`
- **Validation:** `require` checks for empty inputs, past expiry, duplicate IDs, zero address, role checks (`onlyRegulator`, `onlyApprovedManufacturer`)
- **Events:** `ManufacturerApproved`, `ManufacturerRevoked`, `BatchRegistered`, `BatchRecalled`

## 4. How to run

### 4.1 Compile and deploy in Remix
1. Open https://remix.ethereum.org and create `MedVerify.sol`; paste the contents of `contracts/MedVerify.sol`.
2. **Solidity Compiler** tab: compiler `0.8.20` or newer, EVM version `paris` (needed for Ganache), then **Compile**.
3. **Deploy & Run** tab:
   - Environment: *Injected Provider – MetaMask* (for Sepolia) or *Custom – External HTTP Provider* `http://127.0.0.1:7545` (for Ganache).
   - Contract: `MedVerify` → **Deploy**, confirm in MetaMask.
4. Copy the deployed contract address.

### 4.2 Run the frontend
```bash
cd MedVerify
npm install
npm run serve        # serves ./frontend at http://localhost:8080
```
Open http://localhost:8080 (MetaMask needs to be served over http(s), not opened as a `file://` page in some browsers).

### 4.3 Connect MetaMask and interact
1. Install MetaMask; select the same network you deployed to (Sepolia, or add Ganache: RPC `http://127.0.0.1:7545`, chain ID `1337`).
2. Click **Connect MetaMask** and approve the connection.
3. Paste the deployed contract address and click **Load Contract**. Your role is shown.
4. As the **regulator** account: enter a manufacturer address → **Approve Manufacturer**.
5. Switch MetaMask to the **manufacturer** account: enter batch ID, drug name, expiry → **Register Batch**.
6. Any account: enter the batch ID under **Verify a Batch** to read data from the chain.
7. Try **Recall Batch**, then verify again to see `RECALLED`.

## 5. Deployment details

| Item | Value |
|---|---|
| Network | `<Sepolia / Ganache>` |
| Contract address | `<0x...>` |
| Deployer (regulator) | `<0x...>` |
| Deployment tx hash | `<0x...>` |
| Compiler | solc 0.8.20+ (tested with 0.8.26, EVM `paris`) |

## 6. Test cases and results

Automated tests run the compiled contract on an in-process Ganache chain:

```bash
npm install
npm test
```

Result: **24 / 24 passed** (full table in [`docs/test-results.md`](docs/test-results.md)).

### Valid inputs
| Test | Expected | Observed |
|---|---|---|
| Deployer becomes regulator | `regulator()` = deployer | PASS |
| Regulator approves manufacturer | Approved | PASS |
| Approved manufacturer registers batch | Tx succeeds | PASS |
| Anyone verifies registered batch | `AUTHENTIC` | PASS |
| Manufacturer recalls own batch | Status `RECALLED` | PASS |
| Verify unknown batch | `NOT REGISTERED` | PASS |
| Regulator revokes manufacturer | Revoked | PASS |

### Invalid inputs
| Test | Expected revert message | Observed |
|---|---|---|
| Empty batch ID | `Batch ID required` | PASS |
| Empty drug name | `Drug name required` | PASS |
| Expiry date in the past | `Expiry must be in the future` | PASS |
| Duplicate batch ID | `Batch ID already registered` | PASS |
| Approve zero address | `Invalid address` | PASS |
| Approve already-approved address | `Already approved` | PASS |
| Recall non-existent batch | `Batch not found` | PASS |
| Recall already-recalled batch | `Already recalled` | PASS |
| Revoke non-approved address | `Manufacturer not approved` | PASS |
| Read batch index out of range | `Index out of range` | PASS |

### Unauthorised access
| Test | Expected revert message | Observed |
|---|---|---|
| Non-regulator approves manufacturer | `Only regulator allowed` | PASS |
| Non-regulator revokes manufacturer | `Only regulator allowed` | PASS |
| Unapproved address registers batch | `Not an approved manufacturer` | PASS |
| Another manufacturer recalls someone else's batch | `Not authorised to recall` | PASS |
| Random user recalls batch | `Not authorised to recall` | PASS |
| Revoked manufacturer registers batch | `Not an approved manufacturer` | PASS |

> Also repeat a few of these **through the UI + MetaMask** and capture the screenshots below
> (e.g. register a duplicate batch ID, or try approving a manufacturer from a non-regulator account).

## 7. Screenshots
CHECK FOLDER

## 8. Security notes

- No private keys, seed phrases or passwords are stored in this repository.
- Role checks are enforced on-chain, not just in the UI.
