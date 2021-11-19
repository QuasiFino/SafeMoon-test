const {assert} = require('chai');

const SafeMoon = artifacts.require('./SafeMoon');
const IUniswapV2Pair = artifacts.require('./IUniswapV2Pair');

require('chai')
.use(require('chai-as-promised'))
.should()

const contractAddress = '0x985603E5bA204D6C58b5b57Cbe647E3951d1427F';
const pairAddress = '0xbBAf75DF6EaB765b665CEf7d356215524B8aBe75'

contract('SafeMoon', (accounts) => {
  let contract;
  let uniswapV2Pair
  
  
  before(async () => {
    contract = await SafeMoon.at(contractAddress);
    uniswapV2Pair = await IUniswapV2Pair.at(pairAddress);
  })
  
  describe('deployment', async() => {
    it('connects successfully', async() => {
      assert.ok(contract, 'Contract should be deployed')
    })
    it('fetches name', async() => {
      const name = await contract.name();
      assert.equal(name, 'SafeMoon')
    })

    // before adding liquidity
    // it('has sent total token supply to the owner', async() => {
    //   const totalSupply = await contract.totalSupply();
    //   const owner = await contract.owner();
    //   const ownerBalance = await contract.balanceOf(owner);

    //   assert.equal(totalSupply, '1000000000000000000000000')
    //   assert.equal(ownerBalance, '1000000000000000000000000')
    // })

    // After manually adding LP with 50% of token supply
    it('has liquidity in uniswapV2', async() => {
      const uniswapV2Pair = await contract.uniswapV2Pair();
      const uniswapV2PairBalance = await contract.balanceOf(uniswapV2Pair);
      
      assert.equal(uniswapV2PairBalance, '500000000000000000000000')
    })
  })
  describe('Token transfer and Fee deduction', async() => {
    it('does not deduce fee for the owner on transfer', async() => {
      const sender = accounts[0];
      const receiver = accounts[2];
      const result = await contract.transfer(receiver, 100000);
      const event = result.logs[0].args;
      assert.equal(event.from, accounts[0])
      assert.equal(event.to, receiver)
      assert.equal(event.value, '100000') 

      const senderBalance = contract.balanceOf(sender);
      assert.notEqual(senderBalance, '500000000000000000000000');
    })
    it('deduces fee on transfer from accounts included in fee', async() => {
      const result = await contract.transfer(accounts[2], "100", {from: accounts[1]});
        const event = result.logs[0].args;
        assert.equal(event.from, accounts[1])
        assert.equal(event.to, accounts[2])
        assert.notEqual(event.value, '100') 
        const balance = await contract.balanceOf(accounts[2]);

        assert.notEqual(balance, 0);
    })
    it('sends fee to contract', async() => {
      const contractBalance = await contract.balanceOf('0x985603E5bA204D6C58b5b57Cbe647E3951d1427F');
      assert.notEqual(contractBalance, '0');
    })
  })
  describe('Liquidity addition', async() => {
    let lpBalanceBeforeTransfer;
    let lpBalanceAfterTransfer;

    it('adds liquidity', async() => {
      // swapAndLiquify must be enabled
      // checking for lp token balance of the owner
  
      lpBalanceBeforeTransfer = await uniswapV2Pair.balanceOf(accounts[0]);
      console.log(lpBalanceAfterTransfer);

      // contract adds liquidity only when its balance exceeds 500000000000000000000
      await contract.transfer('0x985603E5bA204D6C58b5b57Cbe647E3951d1427F', '500000000000000000000', {from: accounts[0]});
      
      await contract.transfer(accounts[3], '100', {from: accounts[2]})
      
      lpBalanceAfterTransfer = await uniswapV2Pair.balanceOf(accounts[0]);
      console.log(lpBalanceAfterTransfer);

      assert(lpBalanceBeforeTransfer < lpBalanceAfterTransfer);
      
    })
  })
  describe('Reflections', async() => {
    let balanceBeforeTransfer;
    let balanceAfterTransfer;

    it('reflects tokens', async() => {
      
      // checking for balance of an account not involved in transaction
      balanceBeforeTransfer = await contract.balanceOf(accounts[2]);
      console.log(balanceBeforeTransfer);

      // 
      
      await contract.transfer(accounts[1], '5000000000000000000000', {from: accounts[0]})
      await contract.transfer(accounts[3], '5000000000000000000000', {from: accounts[1]})
      
      balanceAfterTransfer = await contract.balanceOf(accounts[2]);
      console.log(balanceAfterTransfer);

      assert(balanceBeforeTransfer < balanceAfterTransfer);
      
    })
  })
  describe('owner privileges', async() => {
    it('allows owner to set fees', async() => {
      await contract.setTaxFeePercent(3, {from: accounts[0]})
      await contract.setLiquidityFeePercent(3, {from: accounts[0]})
      
      const taxFee = await contract._taxFee();
      const liqFee = await contract._liquidityFee();

      assert.equal(taxFee, 3);
      assert.equal(liqFee, 3);
    })
    it('allows owner to set swap and liquify', async() => {
      await contract.setSwapAndLiquifyEnabled(false, {from: accounts[0]})
      
      const swapAndLiquify = await contract.swapAndLiquifyEnabled();

      assert.equal(swapAndLiquify, false);

    })
    it('allows owner to set maxTransaction', async() => {
      await contract.setMaxTxPercent('1', {from: accounts[0]});
      const maxTx = await contract._maxTxAmount();

      assert.equal(maxTx, '10000000000000000000000')
    })
    it('allows owner to include and exclude in fee', async() => {
      await contract.excludeFromFee(accounts[1], {from: accounts[0]});
      const feeExcluded = await contract.isExcludedFromFee(accounts[1]);

      assert.equal(feeExcluded, true)

      await contract.includeInFee(accounts[1], {from: accounts[0]});
      const feeIncluded = await contract.isExcludedFromFee(accounts[1]);

      assert.equal(feeIncluded, false)
    })
    it('allows owner to include and exclude in reward', async() => {
      await contract.excludeFromReward(accounts[1], {from: accounts[0]});
      const rewardExcluded = await contract.isExcludedFromReward(accounts[1]);

      assert.equal(rewardExcluded, true)

      await contract.includeInReward(accounts[1], {from: accounts[0]});
      const rewardIncluded = await contract.isExcludedFromReward(accounts[1]);

      assert.equal(rewardIncluded, false)
    })
    it('does not allow other accounts to make changes to functions with onlyOwner modifier', async() =>{
      try {
        await contract.setTaxFeePercent(3, {from: accounts[1]})
      }catch (err) {
        assert(err, 'Expected an error but did not throw one')
      }
    })
  })
  // console.log(accounts);
})

