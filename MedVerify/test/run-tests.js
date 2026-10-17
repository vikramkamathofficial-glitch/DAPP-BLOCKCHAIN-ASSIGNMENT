// Automated tests for MedVerify: compiles the contract, runs it on an in-process
// Ganache chain, and checks valid / invalid / unauthorised scenarios.
// Run with:  npm install && npm test

const fs = require("fs");
const path = require("path");
const solc = require("solc");
const ganache = require("ganache");
const { ethers } = require("ethers");

function compile() {
  const src = fs.readFileSync(path.join(__dirname, "..", "contracts", "MedVerify.sol"), "utf8");
  const input = {
    language: "Solidity",
    sources: { "MedVerify.sol": { content: src } },
    // "paris" avoids opcodes (PUSH0/MCOPY) that older Ganache versions do not support
    settings: { evmVersion: "paris", outputSelection: { "*": { "*": ["abi", "evm.bytecode.object"] } } },
  };
  const out = JSON.parse(solc.compile(JSON.stringify(input)));
  const errs = (out.errors || []).filter((e) => e.severity === "error");
  if (errs.length) throw new Error(errs.map((e) => e.formattedMessage).join("\n"));
  const c = out.contracts["MedVerify.sol"].MedVerify;
  return { abi: c.abi, bytecode: "0x" + c.evm.bytecode.object };
}

const results = [];
async function check(category, name, fn, expectRevert = null) {
  try {
    await fn();
    if (expectRevert) {
      results.push({ category, name, pass: false, note: "Expected revert but succeeded" });
    } else {
      results.push({ category, name, pass: true, note: "Succeeded as expected" });
    }
  } catch (e) {
    const msg = e.reason || e.shortMessage || e.message;
    if (expectRevert && msg.includes(expectRevert)) {
      results.push({ category, name, pass: true, note: `Reverted: "${expectRevert}"` });
    } else {
      results.push({ category, name, pass: false, note: `Unexpected error: ${msg}` });
    }
  }
}

(async () => {
  const { abi, bytecode } = compile();
  const provider = new ethers.BrowserProvider(
    ganache.provider({ logging: { quiet: true }, wallet: { totalAccounts: 5, deterministic: true } })
  );
  const regulator = await provider.getSigner(0);
  const mfr = await provider.getSigner(1);
  const attacker = await provider.getSigner(2);
  const mfr2 = await provider.getSigner(3);

  const factory = new ethers.ContractFactory(abi, bytecode, regulator);
  const c = await factory.deploy();
  await c.waitForDeployment();

  const asMfr = c.connect(mfr);
  const asAttacker = c.connect(attacker);
  const future = Math.floor(Date.now() / 1000) + 365 * 24 * 3600;

  // ---------- VALID ----------
  await check("Valid", "Constructor sets deployer as regulator", async () => {
    if ((await c.regulator()) !== (await regulator.getAddress())) throw new Error("regulator mismatch");
  });
  await check("Valid", "Regulator approves manufacturer", async () => {
    await (await c.approveManufacturer(await mfr.getAddress())).wait();
    if (!(await c.approvedManufacturers(await mfr.getAddress()))) throw new Error("not approved");
  });
  await check("Valid", "Approved manufacturer registers BATCH-001", async () => {
    await (await asMfr.registerBatch("BATCH-001", "Paracetamol 500mg", future)).wait();
  });
  await check("Valid", "Anyone can verify BATCH-001 => AUTHENTIC", async () => {
    const r = await asAttacker.verifyBatch("BATCH-001");
    if (!r.found || r.status !== "AUTHENTIC") throw new Error("status was " + r.status);
  });
  await check("Valid", "Batch count is 1", async () => {
    if ((await c.getBatchCount()) !== 1n) throw new Error("count mismatch");
  });
  await check("Valid", "Manufacturer recalls own batch", async () => {
    await (await asMfr.recallBatch("BATCH-001")).wait();
    const r = await c.verifyBatch("BATCH-001");
    if (r.status !== "RECALLED") throw new Error("status was " + r.status);
  });
  await check("Valid", "Unknown batch verifies as NOT REGISTERED", async () => {
    const r = await c.verifyBatch("FAKE-999");
    if (r.found || r.status !== "NOT REGISTERED") throw new Error("unexpected result");
  });
  await check("Valid", "Regulator revokes manufacturer", async () => {
    await (await c.revokeManufacturer(await mfr.getAddress())).wait();
  });

  // Re-approve for the invalid tests
  await (await c.approveManufacturer(await mfr.getAddress())).wait();
  await (await asMfr.registerBatch("BATCH-002", "Amoxicillin 250mg", future)).wait();

  // ---------- INVALID ----------
  await check("Invalid", "Empty batch ID rejected", () => asMfr.registerBatch.staticCall("", "Drug", future), "Batch ID required");
  await check("Invalid", "Empty drug name rejected", () => asMfr.registerBatch.staticCall("B-X", "", future), "Drug name required");
  await check("Invalid", "Past expiry date rejected", () => asMfr.registerBatch.staticCall("B-Y", "Drug", 1000), "Expiry must be in the future");
  await check("Invalid", "Duplicate batch ID rejected", () => asMfr.registerBatch.staticCall("BATCH-002", "Drug", future), "Batch ID already registered");
  await check("Invalid", "Approving zero address rejected", () => c.approveManufacturer.staticCall(ethers.ZeroAddress), "Invalid address");
  await check("Invalid", "Approving already-approved manufacturer rejected", async () => c.approveManufacturer.staticCall(await mfr.getAddress()), "Already approved");
  await check("Invalid", "Recalling non-existent batch rejected", () => asMfr.recallBatch.staticCall("NOPE"), "Batch not found");
  await check("Invalid", "Recalling an already recalled batch rejected", () => asMfr.recallBatch.staticCall("BATCH-001"), "Already recalled");
  await check("Invalid", "Revoking non-approved address rejected", async () => c.revokeManufacturer.staticCall(await attacker.getAddress()), "Manufacturer not approved");
  await check("Invalid", "Reading batch index out of range rejected", () => c.getBatchIdAt(99), "Index out of range");

  // ---------- UNAUTHORISED ----------
  await check("Unauthorised", "Non-regulator cannot approve manufacturer", async () => asAttacker.approveManufacturer.staticCall(await attacker.getAddress()), "Only regulator allowed");
  await check("Unauthorised", "Non-regulator cannot revoke manufacturer", async () => asAttacker.revokeManufacturer.staticCall(await mfr.getAddress()), "Only regulator allowed");
  await check("Unauthorised", "Unapproved address cannot register batch", () => asAttacker.registerBatch.staticCall("EVIL-1", "Fake pill", future), "Not an approved manufacturer");
  await check("Unauthorised", "Other manufacturer cannot recall someone else's batch", async () => {
    await (await c.approveManufacturer(await mfr2.getAddress())).wait();
    return c.connect(mfr2).recallBatch.staticCall("BATCH-002");
  }, "Not authorised to recall");
  await check("Unauthorised", "Random user cannot recall batch", () => asAttacker.recallBatch.staticCall("BATCH-002"), "Not authorised to recall");
  await check("Unauthorised", "Revoked manufacturer cannot register batch", async () => {
    await (await c.revokeManufacturer(await mfr2.getAddress())).wait();
    return c.connect(mfr2).registerBatch.staticCall("B-REV", "Drug", future);
  }, "Not an approved manufacturer");

  // ---------- Report ----------
  let pass = 0;
  let md = "| # | Category | Test case | Result | Observed |\n|---|---|---|---|---|\n";
  results.forEach((r, i) => {
    if (r.pass) pass++;
    md += `| ${i + 1} | ${r.category} | ${r.name} | ${r.pass ? "PASS" : "FAIL"} | ${r.note} |\n`;
    console.log(`${r.pass ? "PASS" : "FAIL"}  [${r.category}] ${r.name} -> ${r.note}`);
  });
  console.log(`\n${pass}/${results.length} tests passed`);
  fs.mkdirSync(path.join(__dirname, "..", "docs"), { recursive: true });
  fs.writeFileSync(path.join(__dirname, "..", "docs", "test-results.md"), `# Test results\n\n${pass}/${results.length} passed\n\n${md}`);
  process.exit(pass === results.length ? 0 : 1);
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
