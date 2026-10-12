# Sepolia run 5: additional adversarial coverage

These tests extend the existing manifest, oracle conformance, policy revision, applicant gate,
and listing suites. Production contracts and launch settings are unchanged.

## Deferred bond accounting

`RegistryRecoveryInvariant.t.sol` runs 256 sequences of 64 calls with four funded actors and
three projects. It mixes applications, challenges, signed yes/no answers, failed questions,
lost callbacks, expiry, beneficiary handoffs, donations, live fee changes, transfer restrictions,
claims to different wallets, and old failure callbacks. Expected balances and debts come from
request inputs and intended settlement recipients, independently of the registry's balances.

The invariants check:

- Registry assets equal open challenge bonds plus unpaid bonds plus donations.
- Posted bonds equal open bonds plus unpaid bonds plus all completed payouts.
- Each actor retains exactly its unpaid entitlement; handoffs and relistings cannot move it.
- Failed claims leave debts intact, and successful claims pay the selected destination once.
- Fees reach the Intake treasury, and no unused allowance lets it collect another bond.
- Claims and refused payouts cannot corrupt open requests or change listings.

After every campaign, open requests expire and all debts are claimed after transfer restrictions
are removed. Only donations may remain. Deterministic sequences pin multi-project isolation,
debt accumulation across handoffs/relistings, both kinds of refused claim, and no-return payouts.
A separate regression checks that an unreadable Intake cannot prevent recovery after one day.

The test token's refusals revert or return false **without moving assets**. Successful no-return
transfers move the full amount. The model does not claim support for rebasing, transfer taxes,
or a token that reports failure after moving funds. Answers/failures receive 200,000 callback gas,
the mainnet budget; Sepolia's stated budget is 1,000,000.

## Owner query boundary

`RegistryOwnerBoundary.t.sol` fuzzes malformed response lengths and dirty address words with
1,000 runs each. Fixed cases include empty, 1-byte, 20-byte, 31-byte, 33-byte, 64-byte and
65,536-byte replies. It also checks large revert data, an attempted storage write, gas exhaustion,
and a valid owner that refuses an uncapped query.

Authorization is checked before even reading the live oracle price. An ownership change cannot
replace an open question; after it clears, only the new owner or the project may apply again.

## Scope of the checks

All added tests are offline and use the existing dependencies. They require no environment
changes, RPC credentials, or downloads. The existing guarded mainnet and Sepolia fork tests
remain the checks against live dependencies; they skip without their RPC URLs. No deployment,
live oracle panel trial, or README deployment-address update is performed by this tests task.
