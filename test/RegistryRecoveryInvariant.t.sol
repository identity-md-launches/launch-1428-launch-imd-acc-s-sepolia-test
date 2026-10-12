// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

import {Test} from "forge-std/Test.sol";
import {StdInvariant} from "forge-std/StdInvariant.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {ProjectRegistry, IIntake} from "src/ProjectRegistry.sol";
import {OracleAttestation} from "src/oracle/OracleAttestation.sol";
import {MockIntake, MockProject} from "./mocks/MockIntake.sol";
import {RegistryRecoveryAsset} from "./mocks/RegistryRecoveryAsset.sol";

/// @dev The ledger follows paid requests and intended recipients, not observed balances/debts.
/// Models the fixed 5 IMD bond, including debts left behind by a prior beneficiary or listing.
contract RegistryRecoveryHandler is Test {
    uint256 internal constant KEY = 0xA11CE;
    uint256 public constant BOND = 5e18;
    uint256 public constant INITIAL = 10_000e18;
    uint256 public constant ACTORS = 4;
    uint256 public constant PROJECTS = 3;

    struct Question {
        bytes32 id;
        address payer;
        uint64 askedAt;
        bool challenge;
    }

    ProjectRegistry public immutable reg;
    MockIntake public immutable intake;
    RegistryRecoveryAsset public immutable asset;
    address[4] public actors;
    address[3] public projects;
    Question[3] public pending;
    bool[3] public listed;
    address[3] public beneficiary;
    mapping(address => uint256) public funds;
    mapping(address => uint256) public owed;
    bytes32[] internal closedIds;

    uint256 public fee = 0.5e18;
    uint256 public feesPaid;
    uint256 public donated;
    uint256 public bondsPosted;
    uint256 public bondsPaid;
    uint256 public openBonds;
    uint256 public debtCreated;
    uint256 public debtClaimed;
    uint256 public failedClaims;
    uint256 public successfulClaims;
    uint256 public applications;
    uint256 public defenses;
    uint256 public delistings;
    uint256 public clears;
    uint256 public replays;
    uint256 public handoffs;
    uint256 internal uuid;

    constructor(ProjectRegistry reg_, MockIntake intake_, RegistryRecoveryAsset asset_) {
        reg = reg_;
        intake = intake_;
        asset = asset_;
        for (uint256 i; i < ACTORS; ++i) {
            actors[i] = makeAddr(string.concat("recovery actor ", vm.toString(i)));
            asset.mint(actors[i], INITIAL);
            funds[actors[i]] = INITIAL;
        }
        for (uint256 i; i < PROJECTS; ++i) {
            projects[i] = address(new MockProject());
        }
    }

    function ask(uint256 pSeed, uint256 payerSeed, uint256 beneficiarySeed, uint16 rawRate)
        external
    {
        uint256 i = pSeed % PROJECTS;
        if (pending[i].id != bytes32(0)) return;
        address payer = actors[payerSeed % ACTORS];
        address nextBeneficiary = actors[beneficiarySeed % ACTORS];
        uint256 payment = fee + (listed[i] ? BOND : 0);
        assertGe(funds[payer], payment, "fixture exhausted its initial funding");
        if (listed[i]) {
            uint64 opens = reg.projectOf(projects[i]).challengeOpenAt;
            if (block.timestamp < opens) vm.warp(opens);
        }
        vm.startPrank(payer);
        asset.approve(address(reg), payment);
        bytes32 id;
        if (listed[i]) {
            id = reg.challengeForBeneficiary(projects[i], "Review the fee outflow.", beneficiary[i]);
        } else {
            id = reg.applyListing(
                projects[i],
                "Recovery",
                "https://example.org/source",
                uint16(bound(rawRate, 25, 100)),
                nextBeneficiary
            );
        }
        vm.stopPrank();
        assertNotEq(id, bytes32(0));
        pending[i] = Question(id, payer, uint64(block.timestamp), listed[i]);
        funds[payer] -= payment;
        feesPaid += fee;
        if (listed[i]) {
            openBonds += BOND;
            bondsPosted += BOND;
        } else {
            beneficiary[i] = nextBeneficiary;
            applications++;
        }
    }

    /// @dev Yes, no, refusal, disagreement, completed-without-delivery, or timed-out request.
    function settle(uint256 pSeed, uint8 rawOutcome) external {
        uint256 i = pSeed % PROJECTS;
        Question memory q = pending[i];
        if (q.id == bytes32(0)) return;
        uint256 outcome = bound(rawOutcome, 0, 5);
        if (outcome < 2) {
            OracleAttestation.Attestation memory a;
            a.requestId = bytes32(++uuid << 128);
            a.chainId = 1;
            a.answer = abi.encode(outcome == 0);
            a.panelSize = 15;
            a.quorum = 11;
            a.agreed = 11;
            a.issuedAt = uint64(block.timestamp);
            a.expiresAt = uint64(block.timestamp + 1 days);
            (uint8 v, bytes32 r, bytes32 s) = vm.sign(KEY, reg.attestationDigest(a));
            bool ok = intake.deliver(q.id, a, abi.encodePacked(r, s, v), 200_000);
            if (block.timestamp > uint256(q.askedAt) + 1 days) {
                assertFalse(ok, "a late answer spent a bond");
                assertFalse(reg.consumed(a.requestId), "late answer consumed its UUID");
                reg.expire(projects[i]);
                if (q.challenge) _pay(q.payer);
                clears++;
            } else {
                assertTrue(ok, "settlement must not wait on a refused token transfer");
                assertTrue(reg.consumed(a.requestId));
                if (q.challenge) {
                    _pay(outcome == 0 ? beneficiary[i] : q.payer);
                    if (outcome == 0) defenses++;
                    else delistings++;
                }
                listed[i] = outcome == 0;
            }
        } else {
            if (outcome < 4) {
                assertTrue(
                    intake.fail(q.id, outcome == 2 ? 1 : 2, "disagreed", 200_000),
                    "a refusal must clear even when the token refuses the refund"
                );
            } else {
                if (outcome == 4) {
                    intake.completeSilently(q.id);
                } else if (block.timestamp <= uint256(q.askedAt) + 1 days) {
                    vm.warp(uint256(q.askedAt) + 1 days + 1);
                }
                vm.prank(actors[(i + 1) % ACTORS]);
                reg.expire(projects[i]);
            }
            if (q.challenge) _pay(q.payer);
            clears++;
        }
        closedIds.push(q.id);
        delete pending[i];
        assertEq(reg.projectOfIntake(q.id), address(0), "settled reverse index survives");
    }

    function _pay(address recipient) internal {
        openBonds -= BOND;
        if (_refuses(recipient)) {
            owed[recipient] += BOND;
            debtCreated += BOND;
        } else {
            funds[recipient] += BOND;
            bondsPaid += BOND;
        }
    }

    function configureRecipient(uint256 aSeed, uint8 rawMode) external {
        asset.setMode(actors[aSeed % ACTORS], RegistryRecoveryAsset.Mode(bound(rawMode, 0, 3)));
    }

    function claim(uint256 aSeed, uint256 destinationSeed) external {
        address actor = actors[aSeed % ACTORS];
        address destination = actors[destinationSeed % ACTORS];
        uint256 amount = owed[actor];
        if (amount == 0) {
            vm.prank(actor);
            vm.expectRevert(ProjectRegistry.NothingOwed.selector);
            reg.claimBond(destination);
            failedClaims++;
        } else if (_refuses(destination)) {
            RegistryRecoveryAsset.Mode mode = asset.mode(destination);
            vm.prank(actor);
            vm.expectRevert(
                mode == RegistryRecoveryAsset.Mode.Revert
                    ? abi.encodeWithSelector(
                        RegistryRecoveryAsset.TransferRefused.selector, destination
                    )
                    : abi.encodeWithSelector(
                        SafeERC20.SafeERC20FailedOperation.selector, address(asset)
                    )
            );
            reg.claimBond(destination);
            failedClaims++;
        } else {
            vm.prank(actor);
            reg.claimBond(destination);
            owed[actor] = 0;
            funds[destination] += amount;
            debtClaimed += amount;
            bondsPaid += amount;
            successfulClaims++;
        }
    }

    function handOver(uint256 pSeed, uint256 aSeed) external {
        uint256 i = pSeed % PROJECTS;
        if (!listed[i]) return;
        address next = actors[aSeed % ACTORS];
        if (pending[i].id != bytes32(0)) {
            vm.prank(beneficiary[i]);
            vm.expectRevert(ProjectRegistry.AskOpen.selector);
            reg.setBeneficiary(projects[i], next);
            return;
        }
        uint64 opens = reg.handoffOpenAt(projects[i]);
        if (block.timestamp < opens) vm.warp(opens);
        vm.prank(beneficiary[i]);
        reg.setBeneficiary(projects[i], next);
        beneficiary[i] = next;
        handoffs++;
    }

    function donate(uint256 aSeed, uint96 rawAmount) external {
        address actor = actors[aSeed % ACTORS];
        uint256 amount = bound(rawAmount, 1, 1e18);
        vm.prank(actor);
        asset.transfer(address(reg), amount);
        funds[actor] -= amount;
        donated += amount;
    }

    function reprice(uint96 rawPrice) external {
        fee = bound(rawPrice, 1, 1e18);
        intake.setPrice(fee);
    }

    function passTime(uint32 seconds_, uint8 blocks_) external {
        vm.warp(block.timestamp + bound(seconds_, 0, 2 days));
        vm.roll(block.number + bound(blocks_, 1, 64));
    }

    function replay(uint256 seed) external {
        if (closedIds.length == 0) return;
        bytes32 id = closedIds[seed % closedIds.length];
        vm.prank(address(intake));
        vm.expectRevert(abi.encodeWithSelector(ProjectRegistry.UnknownRequest.selector, id));
        reg.onOracleFailure(id, 2, "disagreed", 0, 0, "");
        replays++;
    }

    function _refuses(address recipient) internal view returns (bool) {
        RegistryRecoveryAsset.Mode mode = asset.mode(recipient);
        return mode == RegistryRecoveryAsset.Mode.Revert || mode == RegistryRecoveryAsset.Mode.False;
    }

    function assertLedger() external view {
        uint256 totalDebt;
        uint256 totalFunds;
        for (uint256 i; i < ACTORS; ++i) {
            address actor = actors[i];
            assertEq(reg.bondOwed(actor), owed[actor], "debt belongs to its original recipient");
            assertEq(asset.balanceOf(actor), funds[actor], "actor was paid or charged incorrectly");
            assertEq(asset.allowance(actor, address(reg)), 0, "only exact payments authorized");
            totalDebt += owed[actor];
            totalFunds += funds[actor];
        }
        assertEq(totalDebt, debtCreated - debtClaimed, "debts accumulate and can be claimed once");
        assertEq(
            bondsPosted, openBonds + totalDebt + bondsPaid, "every posted bond is accounted for"
        );
        assertEq(
            asset.balanceOf(address(reg)), openBonds + totalDebt + donated, "registry solvency"
        );
        assertEq(asset.balanceOf(intake.TREASURY()), feesPaid, "treasury receives only live fees");
        assertEq(asset.balanceOf(address(intake)), 0);
        assertEq(asset.allowance(address(reg), address(intake)), 0, "no bond spending approval");
        assertEq(asset.totalSupply(), ACTORS * INITIAL, "fixed campaign supply");
        assertEq(totalFunds + feesPaid + openBonds + totalDebt + donated, ACTORS * INITIAL);
    }

    function assertQuestions() external view {
        uint256 locked;
        for (uint256 i; i < PROJECTS; ++i) {
            Question memory q = pending[i];
            ProjectRegistry.Project memory actual = reg.projectOf(projects[i]);
            assertEq(actual.listed, listed[i], "only a timely signed answer changes listing");
            assertEq(actual.beneficiary, beneficiary[i], "wrong beneficiary");
            assertEq(actual.intakeId, q.id, "claim must not touch an open request");
            assertEq(actual.asker, q.payer);
            if (q.id == bytes32(0)) {
                assertEq(uint256(actual.ask), uint256(ProjectRegistry.Ask.None));
            } else {
                assertEq(reg.projectOfIntake(q.id), projects[i]);
                assertEq(
                    uint256(actual.ask),
                    uint256(q.challenge ? ProjectRegistry.Ask.Challenge : ProjectRegistry.Ask.Apply)
                );
                if (q.challenge) locked += BOND;
            }
        }
        assertEq(openBonds, locked, "one bond per open challenge");
    }
}

/// forge-config: default.invariant.runs = 256
/// forge-config: default.invariant.depth = 64
/// forge-config: default.invariant.fail-on-revert = true
contract RegistryRecoveryInvariantTest is StdInvariant, Test {
    RegistryRecoveryHandler internal handler;

    function setUp() public {
        vm.chainId(11155111);
        vm.roll(1000);
        vm.warp(1_800_000_000);
        MockIntake intake = new MockIntake();
        RegistryRecoveryAsset asset = new RegistryRecoveryAsset();
        ProjectRegistry reg = new ProjectRegistry(
            address(intake),
            address(asset),
            address(new MockProject()),
            vm.addr(0xA11CE),
            1,
            5e18,
            3600
        );
        handler = new RegistryRecoveryHandler(reg, intake, asset);
        // Begin with two listed projects and one open application, so all branches are reachable.
        handler.ask(0, 0, 1, 25);
        handler.settle(0, 0);
        handler.ask(1, 0, 2, 100);
        handler.settle(1, 0);
        handler.ask(2, 0, 3, 50);
        bytes4[] memory selectors = new bytes4[](9);
        selectors[0] = handler.ask.selector;
        selectors[1] = handler.settle.selector;
        selectors[2] = handler.configureRecipient.selector;
        selectors[3] = handler.claim.selector;
        selectors[4] = handler.handOver.selector;
        selectors[5] = handler.donate.selector;
        selectors[6] = handler.reprice.selector;
        selectors[7] = handler.passTime.selector;
        selectors[8] = handler.replay.selector;
        targetContract(address(handler));
        targetSelector(FuzzSelector(address(handler), selectors));
    }

    function invariant_openAndDeferredBondsRemainFullyBacked() public view {
        handler.assertLedger();
    }

    function invariant_claimsAndRefusedTransfersPreserveQuestions() public view {
        handler.assertQuestions();
    }

    /// @dev Once transfer restrictions lift, every remaining liability can be drained.
    function afterInvariant() public {
        for (uint256 i; i < 3; ++i) {
            handler.settle(i, 5);
        }
        for (uint256 i; i < 4; ++i) {
            handler.configureRecipient(i, 0);
        }
        for (uint256 i; i < 4; ++i) {
            handler.claim(i, (i + 1) % 4);
        }
        _check();
        assertEq(handler.openBonds(), 0);
        assertEq(handler.debtCreated(), handler.debtClaimed(), "all debts recoverable");
        assertEq(handler.asset().balanceOf(address(handler.reg())), handler.donated());
    }

    function test_handlerAccumulatesDebtAcrossHandoffsAndPaysEachRecipientOnce() public {
        handler.configureRecipient(1, 1); // beneficiary rejects bond
        handler.ask(0, 2, 0, 50);
        handler.settle(0, 0);
        _check();
        handler.handOver(0, 3); // the old beneficiary's debt must stay with actor 1
        handler.ask(0, 2, 0, 50);
        handler.configureRecipient(2, 2); // challenger returns false
        handler.settle(0, 1);
        _check();
        handler.ask(0, 2, 3, 25); // a debtor can pay for a new application
        handler.settle(0, 0);
        handler.ask(0, 2, 0, 50);
        handler.settle(0, 2); // second bond owed to actor 2
        _check();
        assertEq(handler.owed(handler.actors(1)), 5e18);
        assertEq(handler.owed(handler.actors(2)), 10e18);

        handler.claim(1, 1); // revert leaves debt intact
        handler.claim(2, 2); // false leaves debt intact
        handler.claim(0, 0); // another wallet cannot take either debt
        _check();
        handler.configureRecipient(3, 3); // no-return transfer is successful
        handler.claim(1, 3);
        handler.claim(2, 3);
        handler.claim(2, 3); // claimed once
        handler.replay(0);
        _check();
        assertEq(handler.debtCreated(), 15e18);
        assertEq(handler.debtClaimed(), 15e18);
        assertEq(handler.failedClaims(), 4);
        assertEq(handler.successfulClaims(), 2);
        afterInvariant();
    }

    function test_handlerKeepsOtherBondsAndDonationsWhileDrainingOneDebt() public {
        handler.ask(0, 2, 0, 50);
        handler.ask(1, 3, 0, 50); // two independent bonds at risk
        handler.donate(0, 1);
        handler.configureRecipient(2, 1);
        handler.settle(0, 4); // missed callback, refund becomes a debt
        handler.claim(2, 0);
        _check();
        assertEq(handler.openBonds(), 5e18, "the other challenge keeps its collateral");
        handler.configureRecipient(3, 2);
        handler.settle(1, 3); // panel disagreement, refund becomes another debt
        _check();
        handler.configureRecipient(0, 3);
        handler.claim(3, 0);
        handler.settle(2, 1); // application rejects without inventing a bond
        _check();
        assertEq(handler.debtCreated(), 10e18);
        assertEq(handler.debtClaimed(), 10e18);
        afterInvariant();
    }

    function test_unreadableIntakeCannotTrapAStaleBondOrEraseAnOwedRefund() public {
        handler.ask(0, 2, 0, 50);
        handler.configureRecipient(2, 1);
        bytes memory failure = abi.encodeWithSignature("IntakeReadUnavailable()");
        vm.mockCallRevert(address(handler.intake()), IIntake.requests.selector, failure);
        vm.expectRevert(failure);
        handler.settle(0, 4); // the early-expiry read fails; the whole attempt rolls back
        _check();
        assertEq(handler.openBonds(), 5e18);
        assertEq(handler.debtCreated(), 0);

        handler.settle(0, 5); // past one day the broken Intake is no longer needed
        _check();
        assertEq(handler.openBonds(), 0);
        assertEq(handler.owed(handler.actors(2)), 5e18);
        handler.claim(2, 0);
        _check();
        vm.clearMockedCalls();
        afterInvariant();
    }

    function test_noReturnSettlementPaysWithoutCreatingPhantomDebt() public {
        handler.configureRecipient(1, 3);
        handler.ask(0, 2, 0, 50);
        handler.settle(0, 0); // beneficiary receives a transfer without return data
        _check();
        handler.configureRecipient(2, 3);
        handler.ask(0, 2, 0, 50);
        handler.settle(0, 1); // challenger receives a transfer without return data
        _check();
        assertEq(handler.bondsPosted(), 10e18);
        assertEq(handler.bondsPaid(), 10e18);
        assertEq(handler.debtCreated(), 0);
        afterInvariant();
    }

    function _check() internal view {
        handler.assertLedger();
        handler.assertQuestions();
    }
}
