pragma solidity ^0.4.11;

import "./ACFToken.sol";
import 'zeppelin/math/SafeMath.sol';
import 'zeppelin/ownership/Ownable.sol';


contract ACFSale is Ownable{

    uint public startTime = 1512064800;   // unix ts in which the sale starts.
    uint public endTime = 1517356800;     // unix ts in which the sale end.

    address public ACFWallet;           // The address to hold the funds donated

    uint public totalCollected = 0;     // In wei
    bool public saleStopped = false;    // Has ACF  stopped the sale?
    bool public saleFinalized = false;  // Has ACF  finalized the sale?

    ACFToken public token;              // The token

    uint constant public minInvestment = 0.1 ether;    // Minimum investment  0,1 ETH

    /** Addresses that are allowed to invest even before ICO opens. For testing, for ICO partners, etc. */
    mapping (address => bool) public whitelist;

    event NewBuyer(address indexed holder, uint256 ACFAmount, uint256 amount);
    // Address early participation whitelist status changed
    event Whitelisted(address addr, bool status);


    function ACFSale (
    address _token,
    address _ACFWallet
    )
    {
        token = ACFToken(_token);
        ACFWallet = _ACFWallet;
        // add wallet as whitelisted
        setWhitelistStatus(ACFWallet, true);
        transferOwnership(ACFWallet);
    }

    // change whitelist status for a specific address
    function setWhitelistStatus(address addr, bool status)
    onlyOwner {
        whitelist[addr] = status;
        Whitelisted(addr, status);
    }

    // Get the rate for a ACF token 1 ACF = 0.05 ETH -> 20 ACF = 1 ETH
    function getRate() constant public returns (uint256) {
        return 10;
    }

    /**
        * Get the amount of unsold tokens allocated to this contract;
    */
    function getTokensLeft() public constant returns (uint) {
        return token.balanceOf(this);
    }

    function () public payable {
        doPayment(msg.sender);
    }

    function doPayment(address _owner)
    only_during_sale_period_or_whitelisted(_owner)
    only_sale_not_stopped
    non_zero_address(_owner)
    minimum_value(minInvestment)
    internal {

        uint256 tokensLeft = getTokensLeft();

        if(tokensLeft <= 0) throw;

        // Calculate how many tokens at current price
        uint256 tokenAmount = SafeMath.mul(msg.value, getRate());
        // do not allow selling more than what we have
        if(tokenAmount > tokensLeft) throw;

        if (!ACFWallet.send(msg.value)) throw;

        // transfer token (it will throw error if transaction is not valid)
        token.transfer(_owner, tokenAmount);

        // record total selling
        totalCollected = SafeMath.add(totalCollected, msg.value);

        NewBuyer(_owner, tokenAmount, msg.value);
    }

    //  Function to stop sale for an emergency.
    //  Only ACF can do it after it has been activated.
    function emergencyStopSale()
    only_sale_not_stopped
    onlyOwner
    public {
        saleStopped = true;
    }

    //  Function to restart stopped sale.
    //  Only ACF  can do it after it has been disabled and sale is ongoing.
    function restartSale()
    only_during_sale_period
    only_sale_stopped
    onlyOwner
    public {
        saleStopped = false;
    }


    function finalizeSale()
    only_after_sale
    onlyOwner
    public {
        doFinalizeSale();
    }

    function doFinalizeSale()
    internal {

        // move all remaining eth in the sale contract to ACFWallet
        if (!ACFWallet.send(this.balance)) throw;

        // transfer remaining tokens to ACFWallet
        token.transfer(ACFWallet, getTokensLeft());

        saleFinalized = true;
        saleStopped = true;
    }


    function getNow() internal constant returns (uint) {
        return now;
    }

    modifier only(address x) {
        if (msg.sender != x) throw;
        _;
    }

    modifier only_during_sale_period {
        if (getNow() < startTime) throw;
        if (getNow() >= endTime) throw;
        _;
    }

    // valid only during sale or before sale if the sender is whitelisted
    modifier only_during_sale_period_or_whitelisted(address x) {
        if (getNow() < startTime && !whitelist[x]) throw;
        if (getNow() >= endTime) throw;
        _;
    }

    modifier only_after_sale {
        if (getNow() < endTime) throw;
        _;
    }

    modifier only_sale_stopped {
        if (!saleStopped) throw;
        _;
    }

    modifier only_sale_not_stopped {
        if (saleStopped) throw;
        _;
    }

    modifier non_zero_address(address x) {
        if (x == 0) throw;
        _;
    }

    modifier minimum_value(uint256 x) {
        if (msg.value < x) throw;
        _;
    }

}
