# Sepolia test run 5 adaptation

## Scope and deployment compatibility

The supplied `launch.json` already deploys exactly one `ProjectRegistry` with the requested seven arguments, in constructor order:

| Argument | Value |
|---|---|
| Intake v2 | `0xa43e6f75ee006411f79ac1c84120606c2330de82` |
| Oracle payment asset | `0x44a1cd38474fb1748400e7deb5f8d786cce3f89a` |
| Existing test run 2 Stacker | `0x0457276d7b036818b3eddc1a4a3fceda61e9314d` |
| Oracle signer | `0x5598aa9146215bc13eb26f2c692ad1461fd32982` |
| Question chain ID | `1` |
| Challenge bond | `5000000000000000000` |
| Challenge cooldown | `3600` |

No production contract or manifest change was needed. `src/ProjectRegistry.sol`, `src/oracle/OracleAttestation.sol`, and `src/Stacker.sol` are unchanged. The registry already has version 3 rules, the bounded `owner()` applicant gate, Intake v2 callbacks, and owed-bond recovery. Its nonpayable constructor takes four addresses, two `uint256` values and one `uint64`; it has no owner, external constructor calls, initialization step, or linked library. The Stacker is only named in questions and is never called by the registry.

The built registry runtime is **23,256 bytes**, below EIP-170's 24,576-byte limit. Creation bytecode is 24,835 bytes; adding the seven ABI words yields 25,059 bytes, below the protected probe's 49,152-byte init-code limit. Existing deployment tests check the runtime for DELEGATECALL, CALLCODE and SELFDESTRUCT while skipping PUSH data. The factory rehearsal now deploys the exact manifest arguments with CREATE2 on an empty chain and checks the predicted address and all configuration getters.

The existing configuration and dependencies were retained: solc 0.8.26, Cancun, 10,000 optimizer runs, `bytecode_hash = "none"`, and the configured fuzz/invariant runs. No workflows, token deployments, dependencies, or production administration capabilities were added.

## Changes and reasons

| File | Change | Requirement or finding |
|---|---|---|
| `test/RegistrySepoliaFork.t.sol` | Rehearse PLEA's current hook `0x2d5a03d5bab98a4a435edad11813373963bca8cc` and test run 2's live Stacker. Assert the current hook owner and both addresses in the real Intake's emitted question. Add an offline check against the manifest and the task's hook address. | Imported finding `24fe652d…`; the fork rehearsal must exercise this launch's targets, even when offline verification skips the RPC test. |
| `test/FactoryRehearsal.t.sol` | Replace the historical two-contract rehearsal with one CREATE2 deployment using the registry bytecode and arguments read from the manifest. Check init-code and runtime size, deterministic address, immutable settings and absence of an owner. | Test run 5 deploys only the registry, fully configured by the factory on an empty chain. |
| `test/RegistryRevisionRegression.t.sol` | Extend the existing self-challenge test to three consecutive rounds: outsiders are refused without paying, each defended bond returns to the beneficiary, net cost is only the fee, and the cooldown is unchanged. An outsider can file when its transaction is included first after settlement. | Reproduce imported finding `2ecbe6a1…` and substantiate the retained design limit. |
| `docs/design.md` | Document self-challenge slot occupancy, cost, expiry and transaction-ordering limits alongside application spam. Correct claims that a defended project gains quiet time or that no new cooldown prevents all blocking. | The imported audit explicitly permits documenting this limit; preserve the brief's source, permissionless challenges and defended-bond destination. |
| `README.md` | Describe the registry-only test run 5 handoff, correct the branch's manifest description and offline-check notes, and reserve the deployment section for a confirmed address after launch. | Accurate launch scope and the instruction to publish a test run 5 address only once live. |
| `ADAPTATION.md` | Record changes, audit dispositions, verification and deployment handoff limits. | Acceptance criterion. |

## Imported audit dispositions

### `2ecbe6a1ad59e0b37b2d010d73645e25facf08f0ea513557467f452262d26a3b` — reproduced; documented design limit

The expanded `test_selfChallengeOccupiesSlotOnlyUntilItSettles` reproduces the report against the unchanged registry: after the listing cooldown, the beneficiary files three successive challenges, each outsider attempt reverts `AskOpen`, each signed yes returns the 5 IMD bond, and total beneficiary cost is exactly `3 * 0.5e18` plus gas. The original `challengeOpenAt` is unchanged. This demonstrates ordering selected by the test, not a simulation proving the beneficiary always wins the public mempool.

The report's documented-limit resolution is used. The brief explicitly keeps the registry source, allows anyone to challenge, and pays a defended bond to the beneficiary. Refusing just that address would be bypassed by its other wallet; keeping its bond would change the required economics without preventing such a bypass. No on-chain anti-spam fix is claimed. The panel still checks every rule and can delist on a self-challenge; expiry can release a stale slot but cannot guarantee the outsider's next transaction is included first.

### `24fe652d2b6841860be9a0b49c58c7416ea56c66bf665a21372329e58914f145` — reproduced and fixed

Before changing the addresses, the new offline regression failed because the fork's Stacker was `0x293c7134ab8f6bf1d8ff44ed806575f8f1baf477`, whereas the manifest specifies `0x0457276d7b036818b3eddc1a4a3fceda61e9314d`. Inspection also confirmed the old PLEA hook `0x3d4ccac329010b8bea3b14498d9a45eab00c68cc`. Both constants are corrected, and the emitted-question assertions pin the requested hook, Stacker and Sepolia chain. The regression passes after the fix.

### `b072e46bb97cf0fdb0ff9a22d5ab0dadbd7d993a2eb8235d9a5d9e8119a6085d` — coverage statement, no defect to reproduce

This item has no failing input or requested code fix. The protected probe, pinned security and oracle references, production registry/verifier, manifest, relevant documentation and regression tests were reviewed. The existing oracle conformance tests retain the protocol's digest, signature vector and callback selector; the existing ECDSA-first/ERC-1271 verifier is retained as required by the brief. Its signature-check implementation differs from the reference's generic helper, without changing the attestation schema or domain.

The brief's explicit settings take precedence over the generic consumer example: this registry has no owner/setters, always uses Intake v2, reads the fee live, and refunds only its own challenge bond on failure. It never treats an unsigned failure as a listing or delisting decision. The writer's pairing of a signed answer to an Intake request, mutable Intake price/callback gas/writer, fixed signer and lack of a pinned question hash remain trust assumptions. No new off-chain panel judgment or production deployment is claimed.

## Verification

- `forge build` — passed with the unchanged project configuration.
- `forge test` — **224 passed, 0 failed, 13 skipped (237 total)**. The skips are the 11 RPC-dependent fork tests and 2 checks for the mainnet manifest. The extra offline target regression accounts for the increase from the original 236 tests.
- Targeted factory, rehearsal-target and registry regression tests — passed after the address fix. Before the fix, the new target regression failed as expected; the self-challenge reproduction passed.
- `ETH_RPC_URL=https://ethereum-rpc.publicnode.com SEPOLIA_RPC_URL=https://ethereum-sepolia-rpc.publicnode.com forge test --match-path 'test/*Fork.t.sol' -vv` — **12 passed, 0 failed, 0 skipped** (all 11 fork tests plus the new offline target check). This includes the corrected PLEA application paying the real Intake v2 on a local Sepolia fork, the synthetic signed listing answer, and the existing live Stacker/vault compatibility checks. Forks used the endpoints' latest state at execution.
- Read-only Sepolia RPC calls confirmed Intake `callbackGas() = 1000000` and the current PLEA hook's `owner() = 0x4b91078b2374c956a65f7af0999cae0a935e6821`.
- `git diff --check` passed. Production source, `launch.json`, build configuration and dependencies have no diff. No Slither or Mythril run was performed.

## Deployment handoff

The worker performed local rehearsals and read-only RPC checks; it did not read wallet keys, broadcast transactions or deploy anything on a live network. The deployment service still performs its own transaction simulation and gas-ceiling check. The brief's approximately 36.7M Sepolia deployment estimate must not be replaced by the much lower Cancun test gas figure.

Once the launch service returns the confirmed deployment receipt, add the real registry address and block to the README's **Sepolia test run 5** table, then carry out the live applications, listing and challenge trial against version 3. A fork answer signed with a test key does not demonstrate that the live oracle panel accepts the rules or that PLEA passes them. No registry address has been guessed or substituted.
