// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

import {MintableIMD} from "./MockIntake.sol";

/// @dev Test-only transfer faults. A refusal never moves tokens; a no-return transfer does.
/// Fee collection uses ordinary transferFrom so faults exercise settlement and claimBond.
contract RegistryRecoveryAsset is MintableIMD {
    enum Mode {
        Normal,
        Revert,
        False,
        NoReturn
    }

    mapping(address => Mode) public mode;

    error TransferRefused(address recipient);

    function setMode(address recipient, Mode mode_) external {
        mode[recipient] = mode_;
    }

    function transfer(address to, uint256 amount) public virtual override returns (bool) {
        Mode current = mode[to];
        if (current == Mode.Revert) revert TransferRefused(to);
        if (current == Mode.False) return false;
        super.transfer(to, amount);
        if (current == Mode.NoReturn) {
            assembly ("memory-safe") {
                return(0, 0)
            }
        }
        return true;
    }
}
