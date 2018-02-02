pragma solidity ^0.4.8;

import './ACFSale.sol';

// @dev ACFSaleMock mocks current time

contract ACFSaleMock is ACFSale {

  uint public mockedNow;

  function ACFSaleMock (
  address _token,
  address _wallet
  ) ACFSale(_token, _wallet) {
    mockedNow = 0;
  }

  function getNow() internal constant returns (uint) {
    return mockedNow;
  }

  function setMockedNow(uint _b) {
    mockedNow = _b;
  }

}
