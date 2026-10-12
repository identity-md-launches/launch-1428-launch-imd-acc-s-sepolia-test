// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

import {RegistryBase} from "./ProjectRegistry.t.sol";
import {ProjectRegistry, IIntake} from "src/ProjectRegistry.sol";
import {RegistryOwnerResponse} from "./mocks/RegistryOwnerResponse.sol";

/// @notice Exercise the ABI and gas boundary of the new owner-only application rule.
/// forge-config: default.fuzz.runs = 1000
contract RegistryOwnerBoundaryTest is RegistryBase {
    RegistryOwnerResponse internal ownerResponse;

    function setUp() public override {
        super.setUp();
        ownerResponse = new RegistryOwnerResponse();
        project = address(ownerResponse);
    }

    function _configure(uint256 word, uint256 size, uint8 behavior) internal {
        ownerResponse.configure(word, size, behavior);
    }

    function _assertPermissionlessApplication() internal {
        assertEq(reg.projectOwner(project), address(0), "malformed owner answer must mean no owner");
        uint256 funds = imd.balanceOf(applicant);
        uint256 requests = intake.count();
        bytes32 id = _apply();
        assertEq(imd.balanceOf(applicant), funds - 0.5e18);
        assertEq(intake.count(), requests + 1);
        assertEq(reg.projectOfIntake(id), project);
        assertEq(reg.projectOf(project).asker, applicant);
        assertTrue(_answer(id, false));
    }

    function testFuzz_nonWordLengthCannotBeDecodedAsOwner(uint8 rawSize) public {
        uint256 size = bound(rawSize, 0, 95);
        if (size >= 32) size++; // includes short addresses and extra words, excludes a valid word
        _configure(uint256(uint160(beneficiary)), size, 0);
        _assertPermissionlessApplication();
    }

    function testFuzz_dirtyAddressWordCannotBlockAnUnownedApplication(uint96 rawHighBits) public {
        uint256 highBits = bound(rawHighBits, 1, type(uint96).max);
        _configure((highBits << 160) | uint256(uint160(beneficiary)), 32, 0);
        _assertPermissionlessApplication();
    }

    function test_ownerAnswerLengthEdges() public {
        uint256[7] memory sizes = [uint256(0), 1, 20, 31, 33, 64, 65_536];
        for (uint256 i; i < sizes.length; ++i) {
            _configure(uint256(uint160(beneficiary)), sizes[i], 0);
            _assertPermissionlessApplication();
        }
    }

    function test_returnAndRevertBombsStayWithinOwnerReadBudget() public {
        for (uint8 behavior; behavior < 2; ++behavior) {
            _configure(uint256(uint160(beneficiary)), 65_536, behavior);
            uint256 gasBefore = gasleft();
            address reported = reg.projectOwner(project);
            uint256 used = gasBefore - gasleft();
            assertEq(reported, address(0));
            assertLt(used, 45_000, "owner returndata copied without a bound");
            _assertPermissionlessApplication();
        }
    }

    function test_ownerReadCannotWriteProjectStorage() public {
        _configure(uint256(uint160(beneficiary)), 32, 2);
        _assertPermissionlessApplication();
        assertEq(ownerResponse.writes(), 0, "owner() was called with a state-changing CALL");
    }

    function test_gasExhaustingOwnerDoesNotExhaustApplication() public {
        _configure(uint256(uint160(beneficiary)), 32, 3);
        uint256 gasBefore = gasleft();
        address reported = reg.projectOwner(project);
        uint256 used = gasBefore - gasleft();
        assertEq(reported, address(0));
        assertLt(used, 45_000, "unbounded owner gas");
        _assertPermissionlessApplication();
    }

    function test_validOwnerIsReadWithAtMostThirtyThousandGas() public {
        _configure(uint256(uint160(applicant)), 32, 4);
        assertEq(reg.projectOwner(project), applicant);
        bytes32 id = _apply();
        assertTrue(_answer(id, true));
        assertTrue(reg.isListed(project));
    }

    function test_ownerGateRunsBeforeEvenReadingTheLiveOracleFee() public {
        _configure(uint256(uint160(beneficiary)), 32, 0);
        bytes memory unavailable = abi.encodeWithSignature("PriceReadUnavailable()");
        vm.mockCallRevert(address(intake), IIntake.priceOf.selector, unavailable);
        uint256 funds = imd.balanceOf(applicant);
        uint256 allowance = imd.allowance(applicant, address(reg));
        vm.prank(applicant);
        vm.expectRevert(
            abi.encodeWithSelector(ProjectRegistry.NotProjectOwner.selector, beneficiary)
        );
        reg.applyListing(project, "Denied", "https://example.org/source", 50, applicant);
        assertEq(imd.balanceOf(applicant), funds);
        assertEq(imd.allowance(applicant, address(reg)), allowance);
        assertEq(intake.count(), 0);
        assertEq(uint256(reg.projectOf(project).ask), uint256(ProjectRegistry.Ask.None));
        vm.clearMockedCalls();
        _configure(uint256(uint160(applicant)), 32, 0);
        assertTrue(_answer(_apply(), true), "denial must not poison the question slot");
    }

    function test_ownershipChangeCannotReplaceAnOpenQuestionButControlsTheNextOne() public {
        _configure(uint256(uint160(applicant)), 32, 0);
        bytes32 original = _apply();
        bytes32 record = keccak256(abi.encode(reg.projectOf(project)));
        uint256 treasury = imd.balanceOf(intake.TREASURY());
        _configure(uint256(uint160(challenger)), 32, 0);

        vm.prank(applicant);
        vm.expectRevert(
            abi.encodeWithSelector(ProjectRegistry.NotProjectOwner.selector, challenger)
        );
        reg.applyListing(project, "Old owner", "https://example.org/source", 25, applicant);
        vm.prank(challenger);
        vm.expectRevert(ProjectRegistry.AskOpen.selector);
        reg.applyListing(project, "New owner", "https://example.org/source", 100, challenger);
        assertEq(keccak256(abi.encode(reg.projectOf(project))), record);
        assertEq(imd.balanceOf(intake.TREASURY()), treasury);
        assertEq(reg.projectOfIntake(original), project);

        assertTrue(intake.fail(original, 1, "body_refused", 200_000));
        vm.prank(applicant);
        vm.expectRevert(
            abi.encodeWithSelector(ProjectRegistry.NotProjectOwner.selector, challenger)
        );
        reg.applyListing(project, "Old owner", "https://example.org/source", 25, applicant);
        vm.prank(challenger);
        bytes32 replacement =
            reg.applyListing(project, "New owner", "https://example.org/source", 100, challenger);
        assertTrue(_answer(replacement, true));
        assertEq(reg.projectOf(project).beneficiary, challenger);
        assertEq(reg.projectOf(project).rateBps, 100);
        assertEq(intake.count(), 2);
    }
}
