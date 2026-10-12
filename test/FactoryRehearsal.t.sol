// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

import {Test} from "forge-std/Test.sol";
import {ProjectRegistry} from "../src/ProjectRegistry.sol";

/// @dev Test-only factory: deploy the manifest's init code with CREATE2, without initialization
/// calls or sent value, as in the protected deployment probe.
contract ApplicationFactoryRehearsal {
    function deploy(bytes memory code, bytes32 salt) external returns (address deployed) {
        require(code.length > 0 && code.length <= 49_152, "invalid init code");
        assembly ("memory-safe") {
            deployed := create2(0, add(code, 32), mload(code), salt)
        }
        require(deployed != address(0) && deployed.code.length > 0, "constructor failed");
    }
}

contract FactoryRehearsalTest is Test {
    function test_sepoliaFactoryDeploysOnlyManifestRegistryOnAnEmptyChain() public {
        vm.chainId(11155111);
        string memory manifest = vm.readFile("./launch.json");
        assertEq(vm.parseJsonString(manifest, ".kind"), "evm_contracts");
        assertEq(vm.parseJsonString(manifest, ".contracts[0].contract"), "ProjectRegistry");
        assertFalse(vm.keyExistsJson(manifest, ".contracts[1]"), "only the registry is deployed");
        string[] memory args = vm.parseJsonStringArray(manifest, ".contracts[0].constructorArgs");
        assertEq(args.length, 7);
        address intake = vm.parseAddress(args[0]);
        address asset = vm.parseAddress(args[1]);
        address stacker = vm.parseAddress(args[2]);
        address signer = vm.parseAddress(args[3]);
        assertEq(intake.code.length, 0);
        assertEq(asset.code.length, 0);
        assertEq(stacker.code.length, 0);
        assertEq(signer.code.length, 0);
        uint256 cooldown = vm.parseUint(args[6]);
        assertLe(cooldown, type(uint64).max);
        bytes memory code = bytes.concat(
            vm.getCode("ProjectRegistry.sol:ProjectRegistry"),
            abi.encode(
                intake,
                asset,
                stacker,
                signer,
                vm.parseUint(args[4]),
                vm.parseUint(args[5]),
                uint64(cooldown)
            )
        );
        bytes32 salt = bytes32("ProjectRegistry");
        ApplicationFactoryRehearsal factory = new ApplicationFactoryRehearsal();
        address predicted = address(
            uint160(
                uint256(
                    keccak256(abi.encodePacked(hex"ff", address(factory), salt, keccak256(code)))
                )
            )
        );
        ProjectRegistry registry = ProjectRegistry(factory.deploy(code, salt));
        assertEq(address(registry), predicted, "CREATE2 address matches the supplied init code");
        assertGt(address(registry).code.length, 0);
        assertLe(address(registry).code.length, 24_576);
        assertEq(address(registry.intake()), intake);
        assertEq(address(registry.oracleAsset()), asset);
        assertEq(registry.stacker(), stacker);
        assertEq(registry.oracleSigner(), signer);
        assertEq(registry.challengeBond(), 5e18);
        assertEq(registry.challengeCooldown(), 3600);
        assertEq(registry.questionChainId(), 1);
        assertEq(stacker.code.length, 0, "no Stacker deployed");
        assertEq(asset.code.length, 0, "no oracle token deployed");
        assertEq(
            address(0x2B69099E59b05901faA1DD164fabf098bf831E82).code.length,
            0,
            "no TestIMD deployed"
        );
        assertEq(
            address(0xF9e2EEc3B610ec6781f7438aC5Fb4bc049d81Cc1).code.length,
            0,
            "no TestSIMD deployed"
        );
        (bool registryOwner,) = address(registry).staticcall(abi.encodeWithSignature("owner()"));
        assertFalse(registryOwner);
    }
}
