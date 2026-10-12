// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

/// @dev Test-only owner ABI adversary. The real registry must make a bounded STATICCALL.
contract RegistryOwnerResponse {
    uint256 public writes;
    uint256 internal word;
    uint256 internal size;
    uint8 internal behavior;

    function configure(uint256 word_, uint256 size_, uint8 behavior_) external {
        word = word_;
        size = size_;
        behavior = behavior_;
    }

    fallback() external {
        require(msg.sig == bytes4(0x8da5cb5b), "only owner selector");
        uint256 outputWord = word;
        uint256 outputSize = size;
        uint8 current = behavior;
        if (current == 2) writes++;
        if (current == 3) {
            assembly {
                for {} 1 {} {}
            }
        }
        // If the caller ever removes its gas cap, this otherwise-valid owner answer disappears.
        if (current == 4) require(gasleft() <= 30_000, "owner call was not capped");
        assembly ("memory-safe") {
            let ptr := mload(0x40)
            mstore(ptr, outputWord)
            if eq(current, 1) { revert(ptr, outputSize) }
            return(ptr, outputSize)
        }
    }
}
