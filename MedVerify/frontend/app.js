// MedVerify frontend - Ethers.js v6 + MetaMask

const ABI = [
  "constructor()",
  "function regulator() view returns (address)",
  "function approvedManufacturers(address) view returns (bool)",
  "function approveManufacturer(address _manufacturer)",
  "function revokeManufacturer(address _manufacturer)",
  "function registerBatch(string _batchId, string _drugName, uint256 _expiryDate)",
  "function recallBatch(string _batchId)",
  "function verifyBatch(string _batchId) view returns (bool found, string drugName, address manufacturer, uint256 manufactureDate, uint256 expiryDate, bool recalled, string status)",
  "function getBatchCount() view returns (uint256)",
  "function getBatchIdAt(uint256 _index) view returns (string)",
  "event ManufacturerApproved(address indexed manufacturer)",
  "event ManufacturerRevoked(address indexed manufacturer)",
  "event BatchRegistered(string batchId, string drugName, address indexed manufacturer, uint256 expiryDate)",
  "event BatchRecalled(string batchId, address indexed recalledBy)"
];

let provider, signer, contract, account;

const $ = (id) => document.getElementById(id);

function setStatus(msg, type = "") {
  const el = $("status");
  el.textContent = msg;
  el.className = "status " + type;
}

function errMsg(e) {
  return e.reason || e.shortMessage || (e.info && e.info.error && e.info.error.message) || e.message || String(e);
}

// ---------- Wallet ----------
async function connectWallet() {
  if (!window.ethereum) {
    setStatus("MetaMask not detected. Please install the extension.", "err");
    return;
  }
  try {
    provider = new ethers.BrowserProvider(window.ethereum);
    await provider.send("eth_requestAccounts", []);
    signer = await provider.getSigner();
    account = await signer.getAddress();
    const net = await provider.getNetwork();
    $("account").textContent = account;
    $("walletInfo").classList.remove("hidden");
    $("connectBtn").textContent = "Connected";
    setStatus(`Wallet connected on chain ${net.chainId}.`, "ok");

    window.ethereum.on("accountsChanged", () => window.location.reload());
    window.ethereum.on("chainChanged", () => window.location.reload());

    const saved = localStorage.getItem("medverify_address");
    if (saved) {
      $("contractAddress").value = saved;
      await loadContract();
    }
  } catch (e) {
    setStatus("Connection failed: " + errMsg(e), "err");
  }
}

async function loadContract() {
  if (!signer) return setStatus("Connect MetaMask first.", "err");
  const addr = $("contractAddress").value.trim();
  if (!ethers.isAddress(addr)) return setStatus("Invalid contract address.", "err");
  try {
    const code = await provider.getCode(addr);
    if (code === "0x") return setStatus("No contract found at that address on this network.", "err");

    contract = new ethers.Contract(addr, ABI, signer);
    localStorage.setItem("medverify_address", addr);

    const reg = await contract.regulator();
    $("regulatorAddr").textContent = reg;
    $("batchCount").textContent = (await contract.getBatchCount()).toString();

    let role = "Public user";
    if (reg.toLowerCase() === account.toLowerCase()) role = "Regulator";
    else if (await contract.approvedManufacturers(account)) role = "Approved manufacturer";
    $("role").textContent = role;

    setStatus("Contract loaded.", "ok");
    await listBatches();
  } catch (e) {
    setStatus("Could not load contract: " + errMsg(e), "err");
  }
}

// ---------- Transaction helper ----------
async function sendTx(label, fn) {
  if (!contract) return setStatus("Load the contract first.", "err");
  try {
    setStatus(`${label}: waiting for MetaMask confirmation...`);
    const tx = await fn();
    setStatus(`${label}: tx sent (${tx.hash}). Waiting for confirmation...`);
    const receipt = await tx.wait();
    setStatus(`${label}: SUCCESS in block ${receipt.blockNumber}. Tx hash: ${tx.hash}`, "ok");
    $("batchCount").textContent = (await contract.getBatchCount()).toString();
    await listBatches();
  } catch (e) {
    setStatus(`${label} FAILED: ${errMsg(e)}`, "err");
  }
}

// ---------- Actions ----------
async function verify() {
  if (!contract) return setStatus("Load the contract first.", "err");
  const id = $("verifyId").value.trim();
  const box = $("verifyResult");
  if (!id) return setStatus("Enter a batch ID to verify.", "err");
  try {
    const r = await contract.verifyBatch(id);
    box.className = "result show";
    if (!r.found) {
      box.classList.add("NOT");
      box.innerHTML = `<b>NOT REGISTERED</b><br>No batch with ID "${escapeHtml(id)}" exists. Treat as possibly counterfeit.`;
    } else {
      box.classList.add(r.status);
      box.innerHTML = `
        <b>${r.status}</b><br>
        Drug: ${escapeHtml(r.drugName)}<br>
        Manufacturer: ${r.manufacturer}<br>
        Registered: ${new Date(Number(r.manufactureDate) * 1000).toLocaleString()}<br>
        Expiry: ${new Date(Number(r.expiryDate) * 1000).toLocaleDateString()}<br>
        Recalled: ${r.recalled ? "Yes" : "No"}`;
    }
    setStatus("Verification read from blockchain.", "ok");
  } catch (e) {
    setStatus("Verify failed: " + errMsg(e), "err");
  }
}

async function listBatches() {
  if (!contract) return;
  try {
    const n = Number(await contract.getBatchCount());
    const tbody = $("batchTable").querySelector("tbody");
    tbody.innerHTML = "";
    for (let i = 0; i < n; i++) {
      const id = await contract.getBatchIdAt(i);
      const tr = document.createElement("tr");
      tr.innerHTML = `<td>${i + 1}</td><td>${escapeHtml(id)}</td>`;
      tbody.appendChild(tr);
    }
  } catch (e) {
    setStatus("Could not list batches: " + errMsg(e), "err");
  }
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}

// ---------- Wire up ----------
$("connectBtn").addEventListener("click", connectWallet);
$("loadContractBtn").addEventListener("click", loadContract);
$("verifyBtn").addEventListener("click", verify);
$("listBtn").addEventListener("click", listBatches);

$("approveBtn").addEventListener("click", () => {
  const a = $("mfrAddress").value.trim();
  if (!ethers.isAddress(a)) return setStatus("Invalid manufacturer address.", "err");
  sendTx("Approve manufacturer", () => contract.approveManufacturer(a));
});

$("revokeBtn").addEventListener("click", () => {
  const a = $("mfrAddress").value.trim();
  if (!ethers.isAddress(a)) return setStatus("Invalid manufacturer address.", "err");
  sendTx("Revoke manufacturer", () => contract.revokeManufacturer(a));
});

$("registerBtn").addEventListener("click", () => {
  const id = $("batchId").value.trim();
  const name = $("drugName").value.trim();
  const d = $("expiry").value;
  if (!id || !name || !d) return setStatus("Fill in batch ID, drug name and expiry date.", "err");
  const expiry = Math.floor(new Date(d + "T23:59:59").getTime() / 1000);
  sendTx("Register batch", () => contract.registerBatch(id, name, expiry));
});

$("recallBtn").addEventListener("click", () => {
  const id = $("recallId").value.trim();
  if (!id) return setStatus("Enter a batch ID to recall.", "err");
  sendTx("Recall batch", () => contract.recallBatch(id));
});
