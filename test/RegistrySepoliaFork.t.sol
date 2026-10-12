// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

import {Test} from "forge-std/Test.sol";
import {Vm} from "forge-std/Vm.sol";
import {ProjectRegistry, IIntake} from "../src/ProjectRegistry.sol";
import {OracleAttestation} from "../src/oracle/OracleAttestation.sol";

interface ITestIMD {
    function mint(address to, uint256 amount) external;
    function approve(address spender, uint256 amount) external returns (bool);
    function balanceOf(address who) external view returns (uint256);
}

/// @dev Against a fork of Sepolia with the real Intake v2 and its test IMD: an application really
/// pays the Intake and opens a request with our callback and failure function; then the Intake's
/// answer is played with a test key (the registry here trusts that key instead of the oracle's).
/// Set SEPOLIA_RPC_URL to run it; it is skipped otherwise.
contract RegistrySepoliaForkTest is Test {
    address internal constant INTAKE = 0xa43e6F75ee006411F79Ac1C84120606C2330DE82;
    address internal constant ORACLE_IMD = 0x44a1Cd38474FB1748400E7DEb5F8D786ccE3F89A;
    address internal constant PLEA_HOOK = 0x2d5A03d5bAb98a4a435edad11813373963bcA8cC;
    /// @dev Test run 2's live Stacker (launch #1294), also used by test run 5's registry.
    address internal constant LIVE_STACKER = 0x0457276D7b036818B3EddC1A4A3FCeda61e9314d;
    uint256 internal constant KEY = 0xA11CE;

    ProjectRegistry internal reg;
    /// @dev PLEA's hook reports the test wallet as its `owner()`, and only the owner may apply for it.
    address internal applicant = 0x4b91078b2374c956A65F7Af0999CaE0a935E6821;
    bool internal forked;

    function setUp() public {
        string memory rpc = vm.envOr("SEPOLIA_RPC_URL", string(""));
        if (bytes(rpc).length == 0) return;
        vm.createSelectFork(rpc);
        if (block.chainid != 11_155_111) return;
        forked = true;
        reg = new ProjectRegistry(INTAKE, ORACLE_IMD, LIVE_STACKER, vm.addr(KEY), 1, 5e18, 1 hours);
        ITestIMD(ORACLE_IMD).mint(applicant, 10e18);
        vm.prank(applicant);
        ITestIMD(ORACLE_IMD).approve(address(reg), type(uint256).max);
    }

    modifier onlyFork() {
        if (!forked) vm.skip(true);
        _;
    }

    /// @dev Runs offline too: a skipped fork must not hide drift from this launch's targets.
    function test_rehearsalTargetsMatchTestRun5() public view {
        string memory manifest = vm.readFile("./launch.json");
        assertEq(vm.parseJsonString(manifest, ".contracts[0].contract"), "ProjectRegistry");
        assertFalse(vm.keyExistsJson(manifest, ".contracts[1]"), "registry only");
        string[] memory args = vm.parseJsonStringArray(manifest, ".contracts[0].constructorArgs");
        assertEq(INTAKE, vm.parseAddress(args[0]));
        assertEq(ORACLE_IMD, vm.parseAddress(args[1]));
        assertEq(LIVE_STACKER, vm.parseAddress(args[2]), "rehearse the manifest's live Stacker");
        assertEq(
            PLEA_HOOK,
            vm.parseAddress("0x2d5a03d5bab98a4a435edad11813373963bca8cc"),
            "rehearse PLEA's current hook"
        );
    }

    function test_sepolia_applyPaysTheRealIntake_thenAnswerLists() public onlyFork {
        assertGt(LIVE_STACKER.code.length, 0, "the existing Stacker is live");
        assertEq(reg.projectOwner(PLEA_HOOK), applicant, "apply as the current hook's owner");
        uint256 before_ = ITestIMD(ORACLE_IMD).balanceOf(applicant);
        vm.recordLogs();
        vm.prank(applicant);
        uint256 g = gasleft();
        bytes32 id =
            reg.applyListing(PLEA_HOOK, "PLEA", "https://github.com/khaed1/plea", 50, applicant);
        emit log_named_uint("applyListing gas (fork, excl. 21k base)", g - gasleft());

        assertEq(before_ - ITestIMD(ORACLE_IMD).balanceOf(applicant), 0.5e18, "0.5 test IMD paid");
        assertEq(ITestIMD(ORACLE_IMD).balanceOf(address(reg)), 0);
        (address payer, address target, bytes4 sel, bool completed) = IIntake(INTAKE).requests(id);
        assertEq(payer, address(reg));
        assertEq(target, address(reg));
        assertEq(sel, bytes4(0x510379c7));
        assertFalse(completed);

        // The real Intake emitted Requested with our body, and FailureHookSet with our failure function.
        bool sawRequested;
        bool sawFailureHook;
        Vm.Log[] memory logs = vm.getRecordedLogs();
        for (uint256 i; i < logs.length; ++i) {
            if (logs[i].emitter != INTAKE) continue;
            if (
                logs[i].topics[0]
                    == keccak256(
                        "Requested(bytes32,address,bytes32,bytes,address,bytes4,address,uint256)"
                    )
            ) {
                (bytes memory body,,,,) =
                    abi.decode(logs[i].data, (bytes, address, bytes4, address, uint256));
                assertEq(vm.parseJsonString(string(body), ".answerType"), "bool");
                assertEq(vm.parseJsonUint(string(body), ".chainId"), 1);
                assertEq(vm.parseJsonUint(string(body), ".consumer.chainId"), 11_155_111);
                assertEq(
                    vm.parseJsonAddress(string(body), ".consumer.verifyingContract"), address(reg)
                );
                string memory question = vm.parseJsonString(string(body), ".question");
                assertTrue(
                    vm.contains(
                        question,
                        "Stacker 0x0457276d7b036818b3eddc1a4a3fceda61e9314d on chain 11155111"
                    )
                );
                assertTrue(
                    vm.contains(
                        question,
                        "contract 0x2d5a03d5bab98a4a435edad11813373963bca8cc on chain 11155111"
                    )
                );
                sawRequested = true;
            }
            if (logs[i].topics[0] == keccak256("FailureHookSet(bytes32,bytes4)")) {
                assertEq(bytes4(logs[i].data), bytes4(0xa7980e31), "failure selector registered");
                sawFailureHook = true;
            }
        }
        assertTrue(sawRequested, "Requested emitted");
        assertTrue(sawFailureHook, "FailureHookSet emitted");

        OracleAttestation.Attestation memory a;
        a.requestId = bytes32(uint256(1) << 128);
        a.chainId = 1;
        a.answerType = OracleAttestation.ANSWER_BOOL;
        a.answer = abi.encode(true);
        a.panelSize = 15;
        a.quorum = 11;
        a.agreed = 14;
        a.issuedAt = uint64(block.timestamp);
        a.expiresAt = uint64(block.timestamp + 1 days);
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(KEY, reg.attestationDigest(a));
        bytes memory sig = abi.encodePacked(r, s, v);
        vm.prank(INTAKE);
        g = gasleft();
        reg.onOracleResult(id, a, sig);
        emit log_named_uint("onOracleResult gas (listing)", g - gasleft());
        assertTrue(reg.isListed(PLEA_HOOK));
        assertEq(reg.projectOf(PLEA_HOOK).fromBlock, block.number);
    }
}
