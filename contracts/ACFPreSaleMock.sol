pragma solidity ^0.4.8;

import './ACFPreSale.sol';

// @dev ACFPreSaleMock mocks current time

contract ACFPreSaleMock is ACFPreSale {

  uint public mockedNow;

  function ACFPreSaleMock (
  address _token,
  address _wallet
  ) ACFPreSale(_token, _wallet) {
    mockedNow = 0;
    minFundingGoal = 9 ether;
  }

  function getNow() internal constant returns (uint) {
    return mockedNow;
  }

  function setMockedNow(uint _b) {
    mockedNow = _b;
  }

}
