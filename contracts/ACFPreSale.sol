pragma solidity ^0.4.11;

import "./ACFToken.sol";
import 'zeppelin/math/SafeMath.sol';
import 'zeppelin/ownership/Ownable.sol';


contract ACFPreSale is Ownable{

    uint public startTime = 1509494400;   // unix ts in which the sale starts.
    uint public endTime = 1510704000;     // unix ts in which the sale end.

    address public ACFWallet;           // The address to hold the funds donated

    uint public totalCollected = 0;     // In wei
    bool public saleStopped = false;    // Has ACF  stopped the sale?
    bool public saleFinalized = false;  // Has ACF  finalized the sale?

    ACFToken public token;              // The token


    uint constant public minInvestment = 0.1 ether;    // Minimum investment  0,1 ETH
    uint public minFundingGoal = 150 ether;          // Minimum funding goal for sale success

    /** Addresses that are allowed to invest even before ICO opens. For testing, for ICO partners, etc. */
    mapping (address => bool) public whitelist;

    /** How much they have invested */
    mapping(address => uint) public balances;

    event NewBuyer(address indexed holder, uint256 ACFAmount, uint256 amount);
    // Address early participation whitelist status changed
    event Whitelisted(address addr, bool status);
    // Investor has been refunded because the ico did not reach the min funding goal
    event Refunded(address investor, uint value);

    function ACFPreSale (
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
        return 20;
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

        if(tokensLeft <= 0){
            // nothing to sell
            throw;
        }
        // Calculate how many tokens at current price
        uint256 tokenAmount = SafeMath.mul(msg.value, getRate());
        // do not allow selling more than what we have
        if(tokenAmount > tokensLeft) {
            // buy all
            tokenAmount = tokensLeft;

            // calculate change
            uint256 change = SafeMath.sub(msg.value, SafeMath.div(tokenAmount, getRate()));
            if(!_owner.send(change)) throw;

        }
        // transfer token (it will throw error if transaction is not valid)
        token.transfer(_owner, tokenAmount);
        // record investment
        balances[_owner] = SafeMath.add(balances[_owner], msg.value);
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


    //  Moves funds in sale contract to ACFWallet.
    //   Moves funds in sale contract to ACFWallet.
    function moveFunds()
    onlyOwner
    public {
        // move funds
        if (!ACFWallet.send(this.balance)) throw;
    }


    function finalizeSale()
    only_after_sale
    onlyOwner
    public {
        doFinalizeSale();
    }

    function doFinalizeSale()
    internal {
        if (totalCollected >= minFundingGoal){
            // move all remaining eth in the sale contract to ACFWallet
            if (!ACFWallet.send(this.balance)) throw;
        }
        // transfer remaining tokens to ACFWallet
        token.transfer(ACFWallet, getTokensLeft());

        saleFinalized = true;
        saleStopped = true;
    }

    /**
        Refund investment, token will remain to the investor
    **/
    function refund()
    only_sale_refundable {
        address investor = msg.sender;
        if(balances[investor] == 0) throw; // nothing to refund
        uint amount = balances[investor];
        // remove balance
        delete balances[investor];
        // send back eth
        if(!investor.send(amount)) throw;

        Refunded(investor, amount);
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

    modifier only_sale_refundable {
        if (getNow() < endTime) throw; // sale must have ended
        if (totalCollected >= minFundingGoal) throw; // sale must be under min funding goal
        _;
    }

}
