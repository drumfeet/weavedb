const { providers, Wallet, utils } = require("ethers")
const { expect } = require("chai")
const { mergeLeft } = require("ramda")
const { init, stop, initBeforeEach, addFunds } = require("./util")

const tests = require("./common")
describe("WeaveDB", function () {
  let wallet,
    walletAddress,
    db,
    arweave_wallet,
    contractTxId,
    dfinityTxId,
    ethereumTxId,
    intercallTxId
  const Arweave = require("arweave")

  this.timeout(0)

  before(async () => {
    db = await init("web", 2, false)
  })

  after(async () => await stop())

  beforeEach(async () => {
    ;({
      arweave_wallet,
      walletAddress,
      wallet,
      dfinityTxId,
      ethereumTxId,
      intercallTxId,
      contractTxId,
    } = await initBeforeEach(false, false, "evm", 2, false))
  })

  afterEach(async () => {
    try {
      clearInterval(db.interval)
    } catch (e) {}
  })

  tests(it, () => ({
    db,
    ver: "../sdk/contracts/weavedb-kv/lib/version",
    init: "../dist/weavedb-kv/initial-state.json",
    wallet,
    Arweave,
    arweave_wallet,
    walletAddress,
    dfinityTxId,
    ethereumTxId,
    contractTxId,
  }))
})
