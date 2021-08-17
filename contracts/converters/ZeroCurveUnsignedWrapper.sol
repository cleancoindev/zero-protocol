// SPDX-License-Identifier: MIT

pragma solidity >=0.7.0;


import {IERC20} from 'oz410/token/ERC20/IERC20.sol';
import {SafeERC20} from 'oz410/token/ERC20/SafeERC20.sol';
import {ICurvePool} from '../interfaces/ICurvePool.sol';
import {SafeMath} from 'oz410/math/SafeMath.sol';

contract ZeroCurveUnsignedWrapper {
	uint256 public immutable tokenInIndex;
	uint256 public immutable tokenOutIndex;
	address public immutable tokenInAddress;
	address public immutable tokenOutAddress;
	address public immutable pool;

	using SafeMath for uint256;
	using SafeERC20 for IERC20;

	constructor(
		uint256 _tokenInIndex,
		uint256 _tokenOutIndex,
		address _pool
	) {
		tokenInIndex = _tokenInIndex;
		tokenOutIndex = _tokenOutIndex;
		address _tokenInAddress = tokenInAddress = ICurvePool(_pool).coins(_tokenInIndex);
		tokenOutAddress = ICurvePool(_pool).coins(_tokenOutIndex);
		pool = _pool;
		IERC20(_tokenInAddress).safeApprove(_pool, type(uint256).max);
	}

	function estimate(uint256 _amount) public returns (uint256 result) {
		result = ICurvePool(pool).get_dy(tokenInIndex, tokenOutIndex, _amount);
	}

	function convert(address _module) external returns (uint256) {
		uint256 _balance = IERC20(tokenInAddress).balanceOf(address(this));
		uint256 _startOut = IERC20(tokenOutAddress).balanceOf(address(this));
		ICurvePool(pool).exchange(tokenInIndex, tokenOutIndex, _balance, 1);
		uint256 _actualOut = IERC20(tokenOutAddress).balanceOf(address(this)) - _startOut;
		IERC20(tokenOutAddress).safeTransfer(msg.sender, _actualOut);
		return _actualOut;
	}
}