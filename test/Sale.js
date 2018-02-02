'use strict';
const BigNumber = web3.BigNumber;
const should = require('chai')
    .use(require('chai-as-promised'))
    .use(require('chai-bignumber')(BigNumber))
    .should();
const assertJump = require(__dirname + '/helpers/assertJump');
var ACFToken = artifacts.require('ACFToken');
var ACFSaleMock = artifacts.require('ACFSaleMock');


const startTime = 1512086400;
const endTime = 1517356800;

contract('Sale', function(accounts) {

    let token, sale, acfWallet;

    var supply = 7500;

    beforeEach(async function() {
        // create new token
        token = await ACFToken.new(); // 750,000 acf
        acfWallet = accounts[5];
        // create sale contract -->  beneficiary is accounts[5]
        sale = await ACFSaleMock.new(token.address, acfWallet);
        // transfer token to contract
        token.transfer(sale.address, supply*10**18);
    });

    it('check token creator balance', async function() {
        var balance = await token.balanceOf(accounts[0]);
        balance.should.be.bignumber.equal((750000 - 7500)*10**18);
    });

    it('check sale contract token balance', async function() {
        var balance = await token.balanceOf(sale.address);
        balance.should.be.bignumber.equal(supply*10**18);
    });


   it('should not allow to buy before start', async function() {
       try {
           await sale.send(new web3.BigNumber(web3.toWei(1, 'ether')));
       } catch(error) {
           return assertJump(error);
       }
       assert.fail('should have thrown before');
   });


   it('should allow to buy after sale start', async function() {
       await sale.setMockedNow(startTime);
       await sale.sendTransaction({value: new web3.BigNumber(web3.toWei(1, 'ether')), from: accounts[0]}).should.be.fulfilled;
   });

   it('should not allow to buy after sale end', async function() {
       await sale.setMockedNow(endTime);
       try {
           await sale.send(new web3.BigNumber(web3.toWei(1, 'ether')));
       } catch(error) {
           return assertJump(error);
       }
       assert.fail('should have thrown before');
   });


    it('should allocate right number of token', async function() {
        await sale.setMockedNow(startTime);
        await sale.sendTransaction({value: new web3.BigNumber(web3.toWei(1, 'ether')), from: accounts[4]});
        let balance4 = await token.balanceOf(accounts[4]);
        balance4.should.be.bignumber.equal(10 * 10**18);
    });

    it('should reduce token availability', async function() {
        await sale.setMockedNow(startTime);
        await sale.sendTransaction({value: new web3.BigNumber(web3.toWei(1, 'ether')), from: accounts[0]});
        let balance = await token.balanceOf(sale.address);
        balance.should.be.bignumber.equal((supply - 10)*10**18);
    });

    it('should transfer funds into acf wallet', async function() {
        await sale.setMockedNow(startTime);
        let balanceWalletBefore = web3.eth.getBalance(acfWallet);
        await sale.sendTransaction({value: new web3.BigNumber(web3.toWei(3, 'ether')), from: accounts[0]});
        // acf wallet balance should receive the investment
        let balanceWallet = web3.eth.getBalance(acfWallet);
        balanceWallet.minus(balanceWalletBefore).should.be.bignumber.equal(3*10**18);
    });


    it('should allow adding a whitelist member', async function() {

        await sale.setWhitelistStatus(accounts[1], 1, {from: acfWallet}).should.be.fulfilled;

    });

    it('should not allow adding a whitelist member if not owner', async function() {
        try {
            await sale.setWhitelistStatus(accounts[1], 1, {from: accounts[1]});
        }
        catch(error) {
            return assertJump(error);
        }
        assert.fail('should have thrown before');
    });

    it('should allow to buy to a whitelist member before sale starts', async function() {
        // whitelist account 1
        await sale.setWhitelistStatus(accounts[1], 1, {from: acfWallet});
        await sale.sendTransaction({value: new web3.BigNumber(web3.toWei(1, 'ether')), from: accounts[1]}).should.be.fulfilled;
        let balance0 = await token.balanceOf(accounts[1]);
        balance0.should.be.bignumber.equal(10 * 10**18);
    });

    it('should not allow finalizing sale before sale end', async function() {
        await sale.setMockedNow(endTime -1);
        try {
            await sale.finalizeSale({from: acfWallet});
        } catch(error) {
            return assertJump(error);
        }
        assert.fail('should have thrown before');
    });

    it('should allow finalizing sale after sale end', async function() {
        await sale.setMockedNow(endTime);
        await sale.finalizeSale({from: acfWallet}).should.be.fulfilled;
    });


    it('should not allow finalizing sale if not contract owner', async function() {
        await sale.setMockedNow(endTime);
        try {
            await sale.finalizeSale({from: accounts[1]});
        }
        catch(error) {
            return assertJump(error);
        }
        assert.fail('should have thrown before');
    });

    it('should finalize sale with all funds and remaining token in wallet', async function() {
        await sale.setMockedNow(startTime);
        await sale.sendTransaction({value: new web3.BigNumber(web3.toWei(2, 'ether')), from: accounts[1]});
        await sale.sendTransaction({value: new web3.BigNumber(web3.toWei(3, 'ether')), from: accounts[2]});
        await sale.sendTransaction({value: new web3.BigNumber(web3.toWei(5, 'ether')), from: accounts[3]});
        // no token in the wallet before ending sale
        let balanceTokenWallet = await token.balanceOf(acfWallet);
        balanceTokenWallet.should.be.bignumber.equal(0);
        // end the sale
        await sale.setMockedNow(endTime);

        let balanceWalletBefore = web3.eth.getBalance(acfWallet);

        //finalize sale
        await sale.finalizeSale({from: acfWallet, gasPrice: 0}).should.be.fulfilled;

        // sale contract should have 0 eth
        let balance = web3.eth.getBalance(sale.address);
        balance.should.be.bignumber.equal(0);

        // acf wallet balance should receive all the funds
        let balanceWallet = web3.eth.getBalance(acfWallet);
        balanceWallet.should.be.bignumber.equal(balanceWalletBefore);

        // acf wallet should have all the remaining tokens
        balanceTokenWallet = await token.balanceOf(acfWallet);
        balanceTokenWallet.should.be.bignumber.equal((supply - 10*10) * 10**18);
    });








});
