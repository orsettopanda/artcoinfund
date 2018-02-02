'use strict';
const BigNumber = web3.BigNumber;
const should = require('chai')
    .use(require('chai-as-promised'))
    .use(require('chai-bignumber')(BigNumber))
    .should();
const assertJump = require(__dirname + '/helpers/assertJump');
var ACFToken = artifacts.require('ACFToken');
var ACFPreSaleMock = artifacts.require('ACFPreSaleMock');

const value = new web3.BigNumber(web3.toWei(1, 'ether'));

const startTime = 1509494400;
const endTime = 1510704000;

contract('PreSale Big', function(accounts) {

    let token, presale, acfWallet;
    var supply = 19;

    beforeEach(async function() {
        // create new token
        token = await ACFToken.new(); // 750,000 acf
        acfWallet = accounts[5];
        // create presale contract -->  beneficiary is accounts[5]
        presale = await ACFPreSaleMock.new(token.address, acfWallet);
        // transfer token to contract
        token.transfer(presale.address, supply*10**18);
    });

    it('check token creator balance', async function() {
        var balance = await token.balanceOf(accounts[0]);
        balance.should.be.bignumber.equal((750000 - 19)*10**18);
    });

    it('should allocate right number of token', async function() {
        await presale.setMockedNow(startTime);
        let balance4Before = web3.eth.getBalance(accounts[4]);
        await presale.sendTransaction({value: new web3.BigNumber(web3.toWei(1, 'ether')), from: accounts[4],  gasPrice: 0});
        let balance4Token = await token.balanceOf(accounts[4]);
        balance4Token.should.be.bignumber.equal(19 * 10**18);

        let balance4 = await web3.eth.getBalance(accounts[4]);
        // we hit max number of token
        //console.log('balance difference :' + balance4.minus(balance4Before))
        // only 1 ether should be payed
        balance4Before.minus(balance4).should.be.bignumber.equal(9.5 * 10 ** 17);
    });

});

contract('PreSale', function(accounts) {

    let token, presale, acfWallet;

    var supply = 7500;

    beforeEach(async function() {
        // create new token
        token = await ACFToken.new(); // 750,000 acf
        acfWallet = accounts[5];
        // create presale contract -->  beneficiary is accounts[5]
        presale = await ACFPreSaleMock.new(token.address, acfWallet);
        // transfer token to contract
        token.transfer(presale.address, supply*10**18);
    });

    it('check token creator balance', async function() {
        var balance = await token.balanceOf(accounts[0]);
        balance.should.be.bignumber.equal((750000 - 7500)*10**18);
    });

    it('check presale contract token balance', async function() {
        var balance = await token.balanceOf(presale.address);
        balance.should.be.bignumber.equal(supply*10**18);
    });


   it('should not allow to buy before start', async function() {
       try {
           await presale.send(value);
       } catch(error) {
           return assertJump(error);
       }
       assert.fail('should have thrown before');
   });


   it('should allow to buy after sale start', async function() {
       await presale.setMockedNow(startTime);
       await presale.sendTransaction({value: value, from: accounts[0]}).should.be.fulfilled;
   });

   it('should not allow to buy after sale end', async function() {
       await presale.setMockedNow(endTime);
       try {
           await presale.send(value);
       } catch(error) {
           return assertJump(error);
       }
       assert.fail('should have thrown before');
   });


    it('should allocate right number of token', async function() {
        await presale.setMockedNow(startTime);
        await presale.sendTransaction({value: value, from: accounts[4]});
        let balance4 = await token.balanceOf(accounts[4]);
        balance4.should.be.bignumber.equal(20 * 10**18);
    });

    it('should reduce token availability', async function() {
        await presale.setMockedNow(startTime);
        await presale.sendTransaction({value: value, from: accounts[0]});
        let balance = await token.balanceOf(presale.address);
        balance.should.be.bignumber.equal((supply - 20)*10**18);
    });


    it('should allow adding a whitelist member', async function() {

        await presale.setWhitelistStatus(accounts[1], 1, {from: acfWallet}).should.be.fulfilled;

    });

    it('should not allow adding a whitelist member if not owner', async function() {
        try {
            await presale.setWhitelistStatus(accounts[1], 1, {from: accounts[1]});
        }
        catch(error) {
            return assertJump(error);
        }
        assert.fail('should have thrown before');
    });

    it('should allow to buy to a whitelist member before sale starts', async function() {
        // whitelist account 1
        await presale.setWhitelistStatus(accounts[1], 1, {from: acfWallet});
        await presale.sendTransaction({value: value, from: accounts[1]}).should.be.fulfilled;
        let balance0 = await token.balanceOf(accounts[1]);
        balance0.should.be.bignumber.equal(20 * 10**18);
    });

    it('should not allow finalizing sale before sale end', async function() {
        await presale.setMockedNow(endTime -1);
        try {
            await presale.finalizeSale({from: acfWallet});
        } catch(error) {
            return assertJump(error);
        }
        assert.fail('should have thrown before');
    });

    it('should allow finalizing sale after sale end', async function() {
        await presale.setMockedNow(endTime);
        await presale.finalizeSale({from: acfWallet}).should.be.fulfilled;
    });


    it('should not allow finalizing sale if not contract owner', async function() {
        await presale.setMockedNow(endTime);
        try {
            await presale.finalizeSale({from: accounts[1]});
        }
        catch(error) {
            return assertJump(error);
        }
        assert.fail('should have thrown before');
    });

    it('should finalize sale with all funds and remaining token in wallet', async function() {
        await presale.setMockedNow(startTime);
        await presale.sendTransaction({value: new web3.BigNumber(web3.toWei(2, 'ether')), from: accounts[1]});
        await presale.sendTransaction({value: new web3.BigNumber(web3.toWei(3, 'ether')), from: accounts[2]});
        await presale.sendTransaction({value: new web3.BigNumber(web3.toWei(5, 'ether')), from: accounts[3]});
        // no token in the wallet before ending sale
        let balanceTokenWallet = await token.balanceOf(acfWallet);
        balanceTokenWallet.should.be.bignumber.equal(0);
        // end the sale
        await presale.setMockedNow(endTime);

        let balanceWalletBefore = web3.eth.getBalance(acfWallet);

        //finalize sale
        await presale.finalizeSale({from: acfWallet, gasPrice: 0}).should.be.fulfilled;

        // presale contract should have 0 eth
        let balance = web3.eth.getBalance(presale.address);
        balance.should.be.bignumber.equal(0);

        // acf wallet balance should receive all the funds
        let balanceWallet = web3.eth.getBalance(acfWallet);
        balanceWallet.minus(balanceWalletBefore).should.be.bignumber.equal(10*10**18);

        // acf wallet should have all the remaining tokens
        balanceTokenWallet = await token.balanceOf(acfWallet);
        balanceTokenWallet.should.be.bignumber.equal((supply - 10*20) * 10**18);
    });

    it('should not allow refunding before sale end', async function() {
        await presale.setMockedNow(startTime);
        // invest
        await presale.sendTransaction({value: new web3.BigNumber(web3.toWei(5, 'ether')), from: accounts[0]});
        await presale.setMockedNow(9999);
        try {
            await presale.refund();
        }
        catch(error) {
            return assertJump(error);
        }
        assert.fail('should have thrown before');

    });


    it('should allow refunding', async function() {
        await presale.setMockedNow(startTime);
        // invest
        await presale.sendTransaction({value: new web3.BigNumber(web3.toWei(5, 'ether')), from: accounts[0], gasPrice: 0});
        //close
        await presale.setMockedNow(endTime);

        let investorBalance = web3.eth.getBalance(accounts[0]);
        await presale.refund({from: accounts[0], gasPrice: 0}).should.be.fulfilled;
        let investorBalance2 = web3.eth.getBalance(accounts[0]);
        assert.equal(investorBalance2 - investorBalance, 5*10**18);

    });


    it('should not allow refunding if not invested', async function() {
        await presale.setMockedNow(startTime);
        // invest
        await presale.sendTransaction({value: new web3.BigNumber(web3.toWei(5, 'ether')), from: accounts[0]});
        // close
        await presale.setMockedNow(endTime);
        try {
            await presale.refund({from: accounts[1]});
        }
        catch(error) {
            return assertJump(error);
        }
        assert.fail('should have thrown before');

    });

    it('should refund all the investments of the same user', async function() {
        await presale.setMockedNow(startTime);
        // invest
        await presale.sendTransaction({value: new web3.BigNumber(web3.toWei(5, 'ether')), from: accounts[0], gasPrice: 0});
        await presale.sendTransaction({value: new web3.BigNumber(web3.toWei(3, 'ether')), from: accounts[0], gasPrice: 0});
        //close
        await presale.setMockedNow(endTime);
        let investorBalance = web3.eth.getBalance(accounts[0]);
        await presale.refund({from: accounts[0], gasPrice: 0}).should.be.fulfilled;
        let investorBalance2 = web3.eth.getBalance(accounts[0]);
        assert.equal(investorBalance2 - investorBalance, 8*10**18);

    });


    it('should refund investments of different users', async function() {
        await presale.setMockedNow(startTime);
        // invest
        await presale.sendTransaction({value: new web3.BigNumber(web3.toWei(5, 'ether')), from: accounts[1]});
        await presale.sendTransaction({value: new web3.BigNumber(web3.toWei(3, 'ether')), from: accounts[2]});
        let investor0Balance = web3.eth.getBalance(accounts[1]);
        let investor1Balance = web3.eth.getBalance(accounts[2]);
        //close
        await presale.setMockedNow(endTime);
        // refund 0
        await presale.refund({from: accounts[1], gasPrice: 0}).should.be.fulfilled;
        let investor0Balance2 = web3.eth.getBalance(accounts[1]);
        investor0Balance2.minus(investor0Balance).should.be.bignumber.equal(5 * 10**18);
        ;
        // refund 1
        await presale.refund({from: accounts[2], gasPrice: 0}).should.be.fulfilled;
        let investor1Balance2 = web3.eth.getBalance(accounts[2]);
        investor1Balance2.minus(investor1Balance).should.be.bignumber.equal(3 * 10**18);


    });


});
