# Test results

24/24 passed

| # | Category | Test case | Result | Observed |
|---|---|---|---|---|
| 1 | Valid | Constructor sets deployer as regulator | PASS | Succeeded as expected |
| 2 | Valid | Regulator approves manufacturer | PASS | Succeeded as expected |
| 3 | Valid | Approved manufacturer registers BATCH-001 | PASS | Succeeded as expected |
| 4 | Valid | Anyone can verify BATCH-001 => AUTHENTIC | PASS | Succeeded as expected |
| 5 | Valid | Batch count is 1 | PASS | Succeeded as expected |
| 6 | Valid | Manufacturer recalls own batch | PASS | Succeeded as expected |
| 7 | Valid | Unknown batch verifies as NOT REGISTERED | PASS | Succeeded as expected |
| 8 | Valid | Regulator revokes manufacturer | PASS | Succeeded as expected |
| 9 | Invalid | Empty batch ID rejected | PASS | Reverted: "Batch ID required" |
| 10 | Invalid | Empty drug name rejected | PASS | Reverted: "Drug name required" |
| 11 | Invalid | Past expiry date rejected | PASS | Reverted: "Expiry must be in the future" |
| 12 | Invalid | Duplicate batch ID rejected | PASS | Reverted: "Batch ID already registered" |
| 13 | Invalid | Approving zero address rejected | PASS | Reverted: "Invalid address" |
| 14 | Invalid | Approving already-approved manufacturer rejected | PASS | Reverted: "Already approved" |
| 15 | Invalid | Recalling non-existent batch rejected | PASS | Reverted: "Batch not found" |
| 16 | Invalid | Recalling an already recalled batch rejected | PASS | Reverted: "Already recalled" |
| 17 | Invalid | Revoking non-approved address rejected | PASS | Reverted: "Manufacturer not approved" |
| 18 | Invalid | Reading batch index out of range rejected | PASS | Reverted: "Index out of range" |
| 19 | Unauthorised | Non-regulator cannot approve manufacturer | PASS | Reverted: "Only regulator allowed" |
| 20 | Unauthorised | Non-regulator cannot revoke manufacturer | PASS | Reverted: "Only regulator allowed" |
| 21 | Unauthorised | Unapproved address cannot register batch | PASS | Reverted: "Not an approved manufacturer" |
| 22 | Unauthorised | Other manufacturer cannot recall someone else's batch | PASS | Reverted: "Not authorised to recall" |
| 23 | Unauthorised | Random user cannot recall batch | PASS | Reverted: "Not authorised to recall" |
| 24 | Unauthorised | Revoked manufacturer cannot register batch | PASS | Reverted: "Not an approved manufacturer" |
