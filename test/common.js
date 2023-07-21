const { expect } = require("chai")
const { mergeLeft, pluck, isNil, compose, map, pick, dissoc } = require("ramda")
const { providers, Wallet } = require("ethers")
const { Ed25519KeyIdentity } = require("@dfinity/identity")
const _ii = [
  "302a300506032b6570032100ccd1d1f725fc35a681d8ef5d563a3c347829bf3f0fe822b4a4b004ee0224fc0d",
  "010925abb4cf8ccb7accbcfcbf0a6adf1bbdca12644694bb47afc7182a4ade66ccd1d1f725fc35a681d8ef5d563a3c347829bf3f0fe822b4a4b004ee0224fc0d",
]
const Account = require("intmax").Account
const EthCrypto = require("eth-crypto")
const EthWallet = require("ethereumjs-wallet").default
const { readFileSync } = require("fs")
const { resolve } = require("path")

const tests = {
  "should get version": async ({ db, ver }) => {
    const version = require(ver)
    expect(await db.getVersion()).to.equal(version)
  },

  "should get nonce": async ({ db, wallet }) => {
    expect(await db.getNonce(wallet.getAddressString())).to.equal(1)
    await db.set({ id: 1 }, "col", "doc")
    expect(await db.getNonce(wallet.getAddressString())).to.equal(2)
  },

  "should get hash": async ({ db, Arweave }) => {
    expect(await db.getHash()).to.equal(null)
    const tx = await db.set({ id: 1 }, "col", "doc")
    expect(await db.getHash()).to.eql(tx.originalTxId)
    const tx2 = await db.set({ id: 2 }, "col", "doc2")
    const hashes = Arweave.utils.concatBuffers([
      Arweave.utils.stringToBuffer(tx.originalTxId),
      Arweave.utils.stringToBuffer(tx2.originalTxId),
    ])
    const hash = await Arweave.crypto.hash(hashes, "SHA-384")
    const new_hash = Arweave.utils.bufferTob64(hash)
    expect(await db.getHash()).to.eql(new_hash)
  },

  "should add & get": async ({ db }) => {
    const data = { name: "Bob", age: 20 }
    const tx = (await db.add(data, "ppl")).originalTxId
    expect(await db.get("ppl", (await db.getIds(tx))[0])).to.eql(data)
  },

  "should set & get": async ({ db }) => {
    const data = { name: "Bob", age: 20 }
    const data2 = { name: "Alice", height: 160 }
    await db.set(data, "ppl", "Bob")
    expect(await db.get("ppl", "Bob")).to.eql(data)
    await db.set(data2, "ppl", "Bob")
    expect(await db.get("ppl", "Bob")).to.eql(data2)
  },

  "should cget & pagenate": async ({ db }) => {
    const data = { name: "Bob", age: 20 }
    const data2 = { name: "Alice", age: 160 }
    await db.set(data, "ppl", "Bob")
    expect(await db.get("ppl", "Bob")).to.eql(data)
    await db.set(data2, "ppl", "Alice")
    const cursor = (await db.cget("ppl", ["age"], 1))[0]
    expect(await db.get("ppl", ["age"], ["startAfter", cursor])).to.eql([data2])
  },

  "should update": async ({ db, type }) => {
    const data = { name: "Bob", age: 20 }
    await db.set(data, "ppl", "Bob")
    expect(await db.get("ppl", "Bob")).to.eql(data)
    await db.update({ age: 25 }, "ppl", "Bob")
    expect(await db.get("ppl", "Bob")).to.eql({ name: "Bob", age: 25 })
    await db.update({ age: db.inc(5) }, "ppl", "Bob")
    expect(await db.get("ppl", "Bob")).to.eql({ name: "Bob", age: 30 })
    await db.update({ age: db.del() }, "ppl", "Bob")
    expect(await db.get("ppl", "Bob")).to.eql({ name: "Bob" })

    // arrayUnion
    await db.update({ foods: db.union("pasta", "cake", "wine") }, "ppl", "Bob")
    expect(await db.get("ppl", "Bob")).to.eql({
      name: "Bob",
      foods: ["pasta", "cake", "wine"],
    })

    // arrayRemove
    await db.update({ foods: db.remove("pasta", "cake") }, "ppl", "Bob")
    expect(await db.get("ppl", "Bob")).to.eql({
      name: "Bob",
      foods: ["wine"],
    })

    // timestamp
    const tx = (await db.update({ death: db.ts() }, "ppl", "Bob")).originalTxId
    if (type === "offchain") {
      const tx = await db.update({ death: db.ts() }, "ppl", "Bob")
      expect((await db.get("ppl", "Bob")).death).to.eql(tx.block.timestamp)
    } else {
      const tx_data = await db.arweave.transactions.get(tx)
      const timestamp = (await db.arweave.blocks.get(tx_data.block)).timestamp
      expect((await db.get("ppl", "Bob")).death).to.be.lte(timestamp)
    }
  },

  "should upsert": async ({ db }) => {
    const data = { name: "Bob", age: 20 }
    await db.upsert(data, "ppl", "Bob")
    expect(await db.get("ppl", "Bob")).to.eql(data)
  },

  "should delete": async ({ db }) => {
    const data = { name: "Bob", age: 20 }
    await db.set(data, "ppl", "Bob")
    expect(await db.get("ppl", "Bob")).to.eql(data)
    await db.delete("ppl", "Bob")
    expect(await db.get("ppl", "Bob")).to.eql(null)
  },

  "should get a collection": async ({ db, arweave_wallet }) => {
    const Bob = {
      name: "Bob",
      age: 20,
      height: 170,
      weight: 75,
      letters: ["b", "o"],
    }
    const Alice = {
      name: "Alice",
      age: 30,
      height: 160,
      weight: 60,
      letters: ["a", "l", "i", "c", "e"],
    }
    const John = {
      name: "John",
      age: 40,
      height: 180,
      weight: 100,
      letters: ["j", "o", "h", "n"],
    }
    const Beth = {
      name: "Beth",
      age: 30,
      height: 165,
      weight: 70,
      letters: ["b", "e", "t", "h"],
    }
    await db.set(Bob, "ppl", "Bob")
    await db.set(Alice, "ppl", "Alice")
    await db.set(John, "ppl", "John")
    await db.set(Beth, "ppl", "Beth")
    expect(await db.get("ppl")).to.eql([Alice, Beth, Bob, John])

    // limit
    expect((await db.get("ppl", 1)).length).to.eql(1)

    // sort
    expect(await db.get("ppl", ["height"])).to.eql([Alice, Beth, Bob, John])
    // sort desc
    expect(await db.get("ppl", ["height", "desc"])).to.eql([
      John,
      Bob,
      Beth,
      Alice,
    ])

    // sort multiple fields
    await db.addIndex([["age"], ["weight", "desc"]], "ppl", {
      ar: arweave_wallet,
    })

    expect(await db.get("ppl", ["age"], ["weight", "desc"])).to.eql([
      Bob,
      Beth,
      Alice,
      John,
    ])

    // skip startAt

    expect(await db.get("ppl", ["age"], ["startAt", 30])).to.eql([
      Beth,
      Alice,
      John,
    ])

    // skip startAfter
    expect(await db.get("ppl", ["age"], ["startAfter", 30])).to.eql([John])

    // skip endAt
    expect(await db.get("ppl", ["age"], ["endAt", 30])).to.eql([
      Bob,
      Beth,
      Alice,
    ])

    // skip endBefore
    expect(await db.get("ppl", ["age"], ["endBefore", 30])).to.eql([Bob])

    // skip startAt multiple fields
    await db.addIndex([["age"], ["weight"]], "ppl", {
      ar: arweave_wallet,
    })
    expect(
      await db.get("ppl", ["age"], ["weight"], ["startAt", 30, 70])
    ).to.eql([Beth, John])

    // skip endAt multiple fields
    expect(await db.get("ppl", ["age"], ["weight"], ["endAt", 30, 60])).to.eql([
      Bob,
      Alice,
    ])

    // where =
    expect(await db.get("ppl", ["age", "==", 30])).to.eql([Alice, Beth])

    // where >
    expect(await db.get("ppl", ["age"], ["age", ">", 30])).to.eql([John])

    // where >=
    expect(await db.get("ppl", ["age"], ["age", ">=", 30])).to.eql([
      Beth,
      Alice,
      John,
    ])

    // where <
    expect(await db.get("ppl", ["age"], ["age", "<", 30])).to.eql([Bob])

    // where <=
    expect(await db.get("ppl", ["age"], ["age", "<=", 30])).to.eql([
      Bob,
      Beth,
      Alice,
    ])

    // where =!
    expect(await db.get("ppl", ["age"], ["age", "!=", 30])).to.eql([Bob, John])

    // where in
    expect(await db.get("ppl", ["age", "in", [20, 30]])).to.eql([
      Alice,
      Beth,
      Bob,
    ])

    // where not-in
    expect(await db.get("ppl", ["age"], ["age", "not-in", [20, 30]])).to.eql([
      John,
    ])

    // where array-contains
    expect(await db.get("ppl", ["letters", "array-contains", "b"])).to.eql([
      Beth,
      Bob,
    ])

    // where array-contains-any
    expect(
      await db.get("ppl", ["letters", "array-contains-any", ["j", "t"]])
    ).to.eql([Beth, John])
  },

  "should batch execute": async ({ db }) => {
    const data = { name: "Bob", age: 20 }
    const data2 = { name: "Alice", age: 40 }
    const data3 = { name: "Beth", age: 10 }
    const tx = (
      await db.batch([
        ["set", data, "ppl", "Bob"],
        ["set", data3, "ppl", "Beth"],
        ["update", { age: 30 }, "ppl", "Bob"],
        ["upsert", { age: 20 }, "ppl", "Bob"],
        ["add", data2, "ppl"],
        ["delete", "ppl", "Beth"],
      ])
    ).originalTxId
    expect(await db.get("ppl", "Bob")).to.eql({ name: "Bob", age: 20 })
    expect(await db.get("ppl", (await db.getIds(tx))[0])).to.eql(data2)
    expect(await db.get("ppl", "Beth")).to.eql(null)
  },

  "should set schema": async ({ db, arweave_wallet }) => {
    const data = { name: "Bob", age: 20 }
    const schema = {
      type: "object",
      required: ["name"],
      properties: {
        name: {
          type: "number",
        },
      },
    }
    const schema2 = {
      type: "object",
      required: ["name"],
      properties: {
        name: {
          type: "string",
        },
      },
    }
    await db.setSchema(schema, "ppl", {
      ar: arweave_wallet,
    })
    expect(await db.getSchema("ppl")).to.eql(schema)
    expect(await db.listCollections()).to.eql(["ppl"])
    await db.set(data, "ppl", "Bob")
    expect(await db.get("ppl", "Bob")).to.eql(null)
    await db.setSchema(schema2, "ppl", {
      ar: arweave_wallet,
    })
    expect(await db.getSchema("ppl")).to.eql(schema2)
    await db.set(data, "ppl", "Bob")
    expect(await db.get("ppl", "Bob")).to.eql(data)
  },

  "should set rules": async ({ db, arweave_wallet }) => {
    const data = { name: "Bob", age: 20 }
    const rules = {
      "allow create,update": {
        and: [
          { "!=": [{ var: "request.auth.signer" }, null] },
          { "<": [{ var: "resource.newData.age" }, 30] },
        ],
      },
      "deny delete": { "!=": [{ var: "request.auth.signer" }, null] },
    }
    await db.setRules(rules, "ppl", {
      ar: arweave_wallet,
    })
    expect(await db.getRules("ppl")).to.eql(rules)
    await db.set(data, "ppl", "Bob")
    expect(await db.get("ppl", "Bob")).to.eql(data)
    await db.delete("ppl", "Bob")
    expect(await db.get("ppl", "Bob")).to.eql(data)
    await db.update({ age: db.inc(10) }, "ppl", "Bob")
    expect(await db.get("ppl", "Bob")).to.eql({ name: "Bob", age: 20 })
    await db.update({ age: db.inc(5) }, "ppl", "Bob")
    expect(await db.get("ppl", "Bob")).to.eql({ name: "Bob", age: 25 })
  },

  "should add index": async ({ db, arweave_wallet }) => {
    const data = { name: "Bob", age: 20 }
    const data2 = { name: "Alice", age: 25 }
    const data3 = { name: "Beth", age: 5 }
    const data4 = { name: "John", age: 20, height: 150 }
    await db.add(data, "ppl")
    expect(await db.get("ppl", ["age"])).to.eql([data])
    await db.set(data2, "ppl", "Alice")
    expect(await db.get("ppl", ["age", "desc"])).to.eql([data2, data])
    await db.upsert(data3, "ppl", "Beth")
    expect(await db.get("ppl", ["age", "desc"])).to.eql([data2, data, data3])
    await db.update({ age: 30 }, "ppl", "Beth")
    expect(await db.get("ppl", ["age", "desc"])).to.eql([
      { name: "Beth", age: 30 },
      data2,
      data,
    ])
    await db.addIndex([["age"], ["name", "desc"]], "ppl", {
      ar: arweave_wallet,
    })
    await db.addIndex([["age"], ["name", "desc"], ["height"]], "ppl", {
      ar: arweave_wallet,
    })
    await db.addIndex([["age"], ["name", "desc"], ["height", "desc"]], "ppl", {
      ar: arweave_wallet,
    })

    await db.upsert(data4, "ppl", "John")
    expect(await db.get("ppl", ["age"], ["name", "desc"])).to.eql([
      data4,
      data,
      data2,
      { name: "Beth", age: 30 },
    ])

    await db.addIndex([["name"], ["age"]], "ppl", {
      ar: arweave_wallet,
    })

    expect(
      await db.get("ppl", ["name"], ["age"], ["name", "in", ["Alice", "John"]])
    ).to.eql([data2, data4])

    expect(await db.getIndexes("ppl")).to.eql([
      [["__id__", "asc"]],
      [["name", "asc"]],
      [["age", "asc"]],
      [
        ["age", "asc"],
        ["name", "desc"],
      ],
      [
        ["age", "asc"],
        ["name", "desc"],
        ["height", "asc"],
      ],
      [
        ["age", "asc"],
        ["name", "desc"],
        ["height", "desc"],
      ],
      [["height", "asc"]],
      [
        ["name", "asc"],
        ["age", "asc"],
      ],
    ])
  },

  "should link temporarily generated address": async ({ wallet, db }) => {
    const addr = wallet.getAddressString()
    const { identity } = await db.createTempAddress(addr)
    expect(await db.getAddressLink(identity.address.toLowerCase())).to.eql({
      address: addr,
      expiry: 0,
    })
    delete db.wallet
    await db.set({ name: "Beth", age: 10 }, "ppl", "Beth", {
      wallet: addr,
      privateKey: identity.privateKey,
    })
    expect((await db.cget("ppl", "Beth")).setter).to.eql(addr)
    await db.removeAddressLink(
      {
        address: identity.address,
      },
      { wallet }
    )
    await db.set({ name: "Bob", age: 20 }, "ppl", "Bob", {
      privateKey: identity.privateKey,
    })
    expect((await db.cget("ppl", "Bob")).setter).to.eql(
      identity.address.toLowerCase()
    )
  },

  "should link temporarily generated address with Lens Protocol": async ({
    db,
    wallet,
    arweave_wallet,
  }) => {
    const { identity, tx: param } = await db._createTempAddress(
      wallet.getAddressString(),
      null,
      "lens:123",
      {
        evm: wallet,
        relay: true,
        jobID: "auth:lens",
      }
    )
    const pkp = Wallet.createRandom()
    pkp._account = { address: pkp.address }
    const job = {
      relayers: [pkp.address.toLowerCase()],
      schema: {
        type: "object",
        required: ["linkTo"],
        properties: {
          linkTo: {
            type: "string",
          },
        },
      },
    }
    await db.addRelayerJob("auth:lens", job, {
      ar: arweave_wallet,
    })
    const sig = await db.relay(
      "auth:lens",
      param,
      { linkTo: "lens:123" },
      { intmax: pkp, relay: true }
    )
    await db.write("relay", sig)
    expect((await db.getAddressLink(identity.address)).address).to.eql(
      "lens:123"
    )
  },

  "should set signer and account": async ({ db, arweave_wallet, wallet }) => {
    const { identity, tx: param } = await db._createTempAddress(
      wallet.getAddressString(),
      null,
      "lens:123",
      {
        evm: wallet,
        relay: true,
        jobID: "auth:lens",
      }
    )
    const pkp = Wallet.createRandom()
    pkp._account = { address: pkp.address }
    const job = {
      relayers: [pkp.address.toLowerCase()],
      schema: {
        type: "object",
        required: ["linkTo"],
        properties: {
          linkTo: {
            type: "string",
          },
        },
      },
    }
    await db.addRelayerJob("auth:lens", job, {
      ar: arweave_wallet,
    })
    const sig = await db.relay(
      "auth:lens",
      param,
      { linkTo: "lens:123" },
      { intmax: pkp, relay: true }
    )
    await db.write("relay", sig)
    expect((await db.getAddressLink(identity.address)).address).to.eql(
      "lens:123"
    )
  },

  "should pre-process the new data with rules": async ({
    db,
    arweave_wallet,
  }) => {
    const rules = {
      let: {
        "resource.newData.age": 30,
      },
      "allow create": true,
    }
    await db.setRules(rules, "ppl", {
      ar: arweave_wallet,
    })
    await db.upsert({ name: "Bob" }, "ppl", "Bob")
    expect((await db.get("ppl", "Bob")).age).to.eql(30)
    await db.upsert({ name: "Bob" }, "ppl", "Bob")
  },

  "should execute crons": async ({ db, arweave_wallet, type }) => {
    await db.set({ age: 3 }, "ppl", "Bob")
    await db.addCron(
      {
        span: 2,
        times: 2,
        do: true,
        jobs: [["upsert", [{ age: db.inc(1) }, "ppl", "Bob"]]],
      },
      "inc age",
      {
        ar: arweave_wallet,
      }
    )
    expect((await db.get("ppl", "Bob")).age).to.eql(4)
    while (true) {
      if (type !== "offchain") await db.mineBlock()
      if ((await db.get("ppl", "Bob")).age > 4) {
        break
      }
    }
    expect((await db.get("ppl", "Bob")).age).to.be.eql(5)
    await db.removeCron("inc age", {
      ar: arweave_wallet,
    })
    expect((await db.getCrons()).crons).to.eql({})
  },

  "should add & get with internet identity": async ({ db }) => {
    const ii = Ed25519KeyIdentity.fromJSON(JSON.stringify(_ii))
    const data = { name: "Bob", age: 20 }
    const tx = (await db.add(data, "ppl", { ii })).originalTxId
    expect((await db.cget("ppl", (await db.getIds(tx))[0])).setter).to.eql(
      ii.toJSON()[0]
    )
  },

  "should add & get with Arweave wallet": async ({ db }) => {
    const arweave_wallet = await db.arweave.wallets.generate()
    const data = { name: "Bob", age: 20 }
    const tx = (await db.add(data, "ppl", { ar: arweave_wallet })).originalTxId
    const addr = await db.arweave.wallets.jwkToAddress(arweave_wallet)
    expect((await db.cget("ppl", (await db.getIds(tx))[0])).setter).to.eql(addr)
    return
  },

  "should link temporarily generated address with internet identity": async ({
    db,
  }) => {
    const ii = Ed25519KeyIdentity.fromJSON(JSON.stringify(_ii))
    const addr = ii.toJSON()[0]
    const { identity } = await db.createTempAddressWithII(ii)
    await db.set({ name: "Beth", age: 10 }, "ppl", "Beth", {
      wallet: addr,
      privateKey: identity.privateKey,
    })
    expect((await db.cget("ppl", "Beth")).setter).to.eql(addr)
    await db.removeAddressLink(
      {
        address: identity.address,
      },
      { ii }
    )
    await db.set({ name: "Bob", age: 20 }, "ppl", "Bob", {
      privateKey: identity.privateKey,
    })
    expect((await db.cget("ppl", "Bob")).setter).to.eql(
      identity.address.toLowerCase()
    )
  },

  "should link temporarily generated address with Arweave wallet": async ({
    db,
  }) => {
    const arweave_wallet = await db.arweave.wallets.generate()
    let addr = await db.arweave.wallets.jwkToAddress(arweave_wallet)
    const { identity } = await db.createTempAddressWithAR(arweave_wallet)
    await db.set({ name: "Beth", age: 10 }, "ppl", "Beth", {
      wallet: addr,
      privateKey: identity.privateKey,
    })
    expect((await db.cget("ppl", "Beth")).setter).to.eql(addr)
    await db.removeAddressLink(
      {
        address: identity.address,
      },
      { ar: arweave_wallet }
    )
    await db.set({ name: "Bob", age: 20 }, "ppl", "Bob", {
      privateKey: identity.privateKey,
    })
    expect((await db.cget("ppl", "Bob")).setter).to.eql(
      identity.address.toLowerCase()
    )
  },

  /*"should set algorithms": async ({ db, arweave_wallet }) => {
    const provider = new providers.JsonRpcProvider("http://localhost/")
    const intmax_wallet = new Account(provider)
    await intmax_wallet.activate()
    const data = { name: "Bob", age: 20 }
    const tx = (await db.add(data, "ppl", { intmax: intmax_wallet }))
      .originalTxId
    const addr = intmax_wallet._address
    expect((await db.cget("ppl", (await db.getIds(tx))[0])).setter).to.eql(addr)
    await db.setAlgorithms(["secp256k1", "rsa256"], {
      ar: arweave_wallet,
    })
    const data2 = { name: "Alice", age: 25 }
    await db.set(data2, "ppl", "Alice", { intmax: intmax_wallet })
    expect(await db.get("ppl", "Alice")).to.be.eql(null)
    await db.setAlgorithms(["poseidon", "rsa256"], {
      ar: arweave_wallet,
    })
    await db.set(data2, "ppl", "Alice", { intmax: intmax_wallet })
    expect(await db.get("ppl", "Alice")).to.be.eql(data2)
    return
    },*/

  "should link and unlink external contracts": async ({
    db,
    arweave_wallet,
  }) => {
    expect(await db.getLinkedContract("contractA")).to.eql(null)
    await db.linkContract("contractA", "xyz", {
      ar: arweave_wallet,
    })
    expect(await db.getLinkedContract("contractA")).to.eql("xyz")
    await db.unlinkContract("contractA", "xyz", {
      ar: arweave_wallet,
    })
    expect(await db.getLinkedContract("contractA")).to.eql(null)
    return
  },

  "should evolve": async ({ arweave_wallet, db, walletAddress, ver }) => {
    const data = { name: "Bob", age: 20 }
    const evolve = "contract-1"
    const evolve2 = "contract-2"
    const version = require(ver)

    const history1 = {
      signer: walletAddress,
      srcTxId: evolve,
      oldVersion: version,
    }
    const history2 = {
      signer: walletAddress,
      srcTxId: evolve2,
      oldVersion: version,
    }

    expect(await db.getEvolve()).to.eql({
      canEvolve: true,
      evolve: null,
      history: [],
      isEvolving: false,
    })

    await db.evolve(evolve, { ar: arweave_wallet })
    await db.migrate(version, { ar: arweave_wallet })
    const evo = await db.getEvolve()
    expect(dissoc("history", evo)).to.eql({
      canEvolve: true,
      evolve,
      isEvolving: false,
    })
    expect(
      compose(map(pick(["signer", "srcTxId", "oldVersion"])))(evo.history)
    ).to.eql([history1])
    await db.setCanEvolve(false, { ar: arweave_wallet })
    const evo2 = await db.getEvolve()
    expect(dissoc("history", evo2)).to.eql({
      canEvolve: false,
      evolve,
      isEvolving: false,
    })
    expect(
      compose(map(pick(["signer", "srcTxId", "oldVersion"])))(evo2.history)
    ).to.eql([history1])

    await db.evolve(evolve2, { ar: arweave_wallet })
    const evo3 = await db.getEvolve()
    expect(dissoc("history", evo3)).to.eql({
      canEvolve: false,
      evolve: evolve,
      isEvolving: false,
    })
    expect(
      compose(map(pick(["signer", "srcTxId", "oldVersion"])))(evo3.history)
    ).to.eql([history1])

    await db.setCanEvolve(true, { ar: arweave_wallet })
    await db.evolve(evolve2, { ar: arweave_wallet })
    await db.set(data, "ppl", "Bob")
    expect(await db.get("ppl", "Bob")).to.eql(null)
    const evo4 = await db.getEvolve()
    expect(dissoc("history", evo4)).to.eql({
      canEvolve: true,
      evolve: evolve2,
      isEvolving: true,
    })

    await db.migrate(version, { ar: arweave_wallet })
    expect(
      compose(map(pick(["signer", "srcTxId", "oldVersion"])))(evo4.history)
    ).to.eql([history1, history2])

    await db.set(data, "ppl", "Bob")
    expect(await db.get("ppl", "Bob")).to.eql(data)
    return
  },

  "should manage owner": async ({ db, arweave_wallet }) => {
    const addr = await db.arweave.wallets.jwkToAddress(arweave_wallet)
    const arweave_wallet2 = await db.arweave.wallets.generate()
    let addr2 = await db.arweave.wallets.jwkToAddress(arweave_wallet2)
    expect(await db.getOwner()).to.eql([addr])
    await db.addOwner(addr2, { ar: arweave_wallet })
    expect(await db.getOwner()).to.eql([addr, addr2])
    await db.removeOwner(addr2, { ar: arweave_wallet })
    await db.removeOwner(addr, { ar: arweave_wallet })
    expect(await db.getOwner()).to.eql([])
    return
  },

  "should relay queries": async ({ db, arweave_wallet, wallet }) => {
    const identity = EthCrypto.createIdentity()
    const job = {
      relayers: [identity.address],
      schema: {
        type: "object",
        required: ["height"],
        properties: {
          height: {
            type: "number",
          },
        },
      },
    }
    await db.addRelayerJob("test-job", job, {
      ar: arweave_wallet,
    })
    expect(await db.getRelayerJob("test-job")).to.eql(job)
    expect(await db.listRelayerJobs()).to.eql(["test-job"])
    const rules = {
      let: {
        "resource.newData.height": { var: "request.auth.extra.height" },
      },
      "allow write": true,
    }
    await db.setRules(rules, "ppl", {
      ar: arweave_wallet,
    })

    const data = { name: "Bob", age: 20 }
    const data2 = { name: "Bob", age: 20, height: 182 }
    const param = await db.sign("set", data, "ppl", "Bob", {
      jobID: "test-job",
    })
    await db.relay(
      "test-job",
      param,
      { height: 182 },
      {
        privateKey: identity.privateKey,
        wallet: identity.address,
      }
    )
    const addr = wallet.getAddressString()
    const doc = await db.cget("ppl", "Bob")
    expect(doc.setter).to.equal(addr)
    expect(doc.data).to.eql(data2)
    await db.removeRelayerJob("test-job", { ar: arweave_wallet })
    expect(await db.getRelayerJob("test-job")).to.eql(null)
    return
  },

  "should relay queries with Intmax Wallet / Lit Protocol PKP": async ({
    db,
    arweave_wallet,
    wallet,
  }) => {
    const intmax_wallet = Wallet.createRandom()
    intmax_wallet._account = { address: intmax_wallet.address }

    const job = {
      relayers: [intmax_wallet.address],
      schema: {
        type: "object",
        required: ["height"],
        properties: {
          height: {
            type: "number",
          },
        },
      },
    }
    await db.addRelayerJob("test-job", job, {
      ar: arweave_wallet,
    })
    expect(await db.getRelayerJob("test-job")).to.eql(job)
    expect(await db.listRelayerJobs()).to.eql(["test-job"])
    const rules = {
      let: {
        "resource.newData.height": { var: "request.auth.extra.height" },
      },
      "allow write": true,
    }
    await db.setRules(rules, "ppl", {
      ar: arweave_wallet,
    })

    const data = { name: "Bob", age: 20 }
    const data2 = { name: "Bob", age: 20, height: 182 }
    const param = await db.sign("set", data, "ppl", "Bob", {
      jobID: "test-job",
    })
    await db.relay(
      "test-job",
      param,
      { height: 182 },
      {
        intmax: intmax_wallet,
      }
    )
    const addr = wallet.getAddressString()
    const doc = await db.cget("ppl", "Bob")
    expect(doc.setter).to.equal(addr)
    expect(doc.data).to.eql(data2)
    await db.removeRelayerJob("test-job", { ar: arweave_wallet })
    expect(await db.getRelayerJob("test-job")).to.eql(null)
    return
  },

  "should relay queries with multisig": async ({
    db,
    arweave_wallet,
    wallet,
  }) => {
    const identity = EthCrypto.createIdentity()
    const identity2 = EthCrypto.createIdentity()
    const identity3 = EthCrypto.createIdentity()
    const wallet2 = new Wallet(identity2.privateKey)
    const wallet3 = new Wallet(identity3.privateKey)
    const jobID = "test-job"
    const job = {
      relayers: [identity.address],
      signers: [identity.address, identity2.address, identity3.address],
      multisig: 50,
      multisig_type: "percent",
      schema: {
        type: "object",
        required: ["height"],
        properties: {
          height: {
            type: "number",
          },
        },
      },
    }

    await db.addRelayerJob("test-job", job, {
      ar: arweave_wallet,
    })
    expect(await db.getRelayerJob("test-job")).to.eql(job)

    const rules = {
      let: {
        "resource.newData.height": { var: "request.auth.extra.height" },
      },
      "allow write": true,
    }
    await db.setRules(rules, "ppl", {
      ar: arweave_wallet,
    })

    const data = { name: "Bob", age: 20 }
    const data2 = { name: "Bob", age: 20, height: 182 }
    const params = await db.sign("set", data, "ppl", "Bob", {
      jobID,
    })
    const extra = { height: 182 }
    const multisig_data = {
      extra,
      jobID,
      params,
    }
    const sig2 = await wallet2.signMessage(JSON.stringify(multisig_data))
    const sig3 = await wallet3.signMessage(JSON.stringify(multisig_data))
    await db.relay("test-job", params, extra, {
      privateKey: identity.privateKey,
      wallet: identity.address,
      multisigs: [sig2, sig3],
    })
    const addr = wallet.getAddressString()
    const doc = await db.cget("ppl", "Bob")
    expect(doc.setter).to.equal(addr)
    expect(doc.data).to.eql(data2)
    await db.removeRelayerJob("test-job", { ar: arweave_wallet })
    expect(await db.getRelayerJob("test-job")).to.eql(null)
    return
  },

  "should match signers": async ({ db, dfinityTxId, ethereumTxId, wallet }) => {
    const original_account = EthWallet.generate()
    const { identity: temp_account } = await db.createTempAddress(
      original_account
    )
    const preset_addr = wallet.getAddressString() // this was set when initializing SDK with EthWallet
    const original_addr = original_account.getAddressString()
    const temp_addr = temp_account.address.toLowerCase()

    // sign with the original_account (default)
    await db.set({ signer: db.signer() }, "signers", "s1", {
      wallet: original_account,
    })
    expect((await db.get("signers", "s1")).signer).to.equal(original_addr)

    // sign with the temp_account linked to the original_account
    await db.set({ signer: db.signer() }, "signers", "s2", {
      wallet: original_addr,
      privateKey: temp_account.privateKey,
    })
    expect((await db.get("signers", "s2")).signer).to.equal(original_addr)

    // sign with the temp_account but as itself
    await db.set({ signer: db.signer() }, "signers", "s3", {
      privateKey: temp_account.privateKey,
    })
    expect((await db.get("signers", "s3")).signer).to.equal(temp_addr)

    // sign with the preset wallet
    await db.set({ signer: db.signer() }, "signers", "s4")
    expect((await db.get("signers", "s4")).signer).to.equal(preset_addr)
  },

  "should list collections": async ({ db }) => {
    await db.set({}, "ppl", "Bob")
    await db.set({}, "ppl2", "Bob")
    await db.set({ name: "toyota" }, "ppl", "Bob", "cars", "toyota")
    await db.set({ name: "apple" }, "ppl", "Bob", "foods", "apple")
    expect(await db.listCollections()).to.eql(["ppl", "ppl2"])
    expect(await db.listCollections("ppl", "Bob")).to.eql(["cars", "foods"])
  },

  "should get info": async ({
    db,
    arweave_wallet,
    dfinityTxId,
    ethereumTxId,
    ver,
    init,
  }) => {
    const addr = await db.arweave.wallets.jwkToAddress(arweave_wallet)
    const version = require(ver)
    const initial_state = JSON.parse(
      readFileSync(resolve(__dirname, init), "utf8")
    )
    expect(await db.getInfo()).to.eql({
      auth: {
        algorithms: ["secp256k1", "secp256k1-2", "ed25519", "rsa256"],
        name: "weavedb",
        version: "1",
      },
      canEvolve: true,
      contracts: {
        dfinity: dfinityTxId,
        ethereum: ethereumTxId,
      },
      evolve: null,
      isEvolving: false,
      secure: false,
      version,
      owner: addr,
      evolveHistory: [],
    })
    return
  },

  "should update sub collections": async ({ db, arweave_wallet }) => {
    const data = { name: "Bob", age: 20 }
    const data2 = { weight: 70 }
    await db.set(data, "ppl", "Bob")
    const rules = { "allow write": true }
    await db.setRules(rules, "ppl", "Bob", "foods", { ar: arweave_wallet })
    await db.set(data2, "ppl", "Bob", "foods", "apple")
    expect(await db.get("ppl", "Bob", "foods", "apple")).to.eql(data2)
  },

  "should sort without indexes": async ({ db }) => {
    const data = { name: "Bob", age: 20 }
    const data2 = { name: "Alice", age: 25 }
    const data3 = { name: "John", age: 30 }
    const data4 = { name: "Beth", age: 35 }
    await db.set(data, "ppl", "Bob")
    await db.set(data2, "ppl", "Alice")
    await db.set(data3, "ppl", "John")
    await db.set(data4, "ppl", "Beth")
    const ppl = await db.cget("ppl", 2)
    expect(pluck("data")(ppl)).to.eql([data2, data4])
    const ppl2 = await db.cget("ppl", ["startAfter", ppl[1]], 2)
    expect(pluck("data")(ppl2)).to.eql([data, data3])

    expect(await db.get("ppl", ["__id__", "desc"])).to.eql([
      data3,
      data,
      data4,
      data2,
    ])
  },

  "should set secure": async ({ db, arweave_wallet }) => {
    await db.setSecure(false, { ar: arweave_wallet })
    expect((await db.getInfo()).secure).to.eql(false)
    await db.setSecure(true, { ar: arweave_wallet })
    expect((await db.getInfo()).secure).to.eql(true)
    return
  },

  "should reject invalid col/doc ids": async ({ db }) => {
    await db.set({}, "__ppl__", "Bob")
    await db.set({}, "ppl", "Bob/Alice")
    expect(await db.get("ppl")).to.eql([])
    expect(await db.listCollections()).to.eql([])
    return
  },

  "should insert contract info into access rules": async ({
    db,
    arweave_wallet,
    contractTxId,
  }) => {
    const data = { name: "Bob", age: 20 }
    const rules = {
      let: { "resource.newData.contract": { var: "contract" } },
      "allow write": true,
    }
    const arweave_wallet2 = await db.arweave.wallets.generate()
    let addr2 = await db.arweave.wallets.jwkToAddress(arweave_wallet2)
    await db.addOwner(addr2, { ar: arweave_wallet })
    await db.setRules(rules, "ppl", {
      ar: arweave_wallet,
    })
    await db.set(data, "ppl", "Bob")
    expect(await db.get("ppl", "Bob")).to.eql(
      mergeLeft(
        {
          contract: {
            id: contractTxId,
            owners: await db.getOwner(),
            version: await db.getVersion(),
          },
        },
        data
      )
    )
  },

  "should batch execute admin methods": async ({ db, arweave_wallet }) => {
    const schema = {
      type: "object",
      required: ["name"],
      properties: {
        name: {
          type: "number",
        },
      },
    }
    const rules = {
      "allow create,update": {
        and: [
          { "!=": [{ var: "request.auth.signer" }, null] },
          { "<": [{ var: "resource.newData.age" }, 30] },
        ],
      },
      "deny delete": { "!=": [{ var: "request.auth.signer" }, null] },
    }
    const algorithms = ["secp256k1", "rsa256"]
    const index = [
      ["age", "desc"],
      ["name", "desc"],
    ]
    const arweave_wallet2 = await db.arweave.wallets.generate()
    const addr = await db.arweave.wallets.jwkToAddress(arweave_wallet)
    const addr2 = await db.arweave.wallets.jwkToAddress(arweave_wallet2)

    const identity = EthCrypto.createIdentity()
    const identity2 = EthCrypto.createIdentity()
    const identity3 = EthCrypto.createIdentity()
    const jobID = "test-job"
    const job = {
      relayers: [identity.address],
      signers: [identity.address, identity2.address, identity3.address],
      multisig: 50,
      multisig_type: "percent",
      schema: {
        type: "object",
        required: ["height"],
        properties: {
          height: {
            type: "number",
          },
        },
      },
    }
    const cron = {
      span: 2,
      times: 2,
      start: 10000000000,
      do: false,
      jobs: [["add", [{ age: db.inc(1) }, "ppl"]]],
    }

    await db.batch(
      [
        ["addCron", cron, "inc age"],
        ["setSchema", schema, "ppl"],
        ["setRules", rules, "ppl"],
        ["setCanEvolve", false],
        ["setSecure", true],
        ["setAlgorithms", algorithms],
        ["addIndex", index, "ppl"],
        ["addOwner", addr2],
        ["addRelayerJob", jobID, job],
      ],
      {
        ar: arweave_wallet,
      }
    )
    expect(await db.getSchema("ppl")).to.eql(schema)
    expect(await db.getRules("ppl")).to.eql(rules)
    expect((await db.getEvolve()).canEvolve).to.eql(false)
    expect((await db.getInfo()).secure).to.eql(true)
    expect(await db.getAlgorithms()).to.eql(algorithms)
    expect(await db.getIndexes("ppl")).to.eql([index])
    expect(await db.getOwner()).to.eql([addr, addr2])
    expect(await db.getRelayerJob(jobID)).to.eql(job)
    expect((await db.getCrons()).crons).to.eql({ "inc age": cron })
    await db.batch(
      [
        ["removeCron", "inc age"],
        ["removeOwner", addr2],
        ["removeIndex", index, "ppl"],
        ["removeRelayerJob", jobID],
      ],
      {
        ar: arweave_wallet,
      }
    )
    expect((await db.getCrons()).crons).to.eql({})
    expect(await db.getOwner()).to.eql([addr])
    expect(await db.getIndexes("ppl")).to.eql([])
    expect(await db.getRelayerJob(jobID)).to.eql(null)
  },

  "should only allow owners": async ({ db, arweave_wallet }) => {
    const data = { name: "Bob", age: 20 }
    const addr = await db.arweave.wallets.jwkToAddress(arweave_wallet)
    const rules = {
      "allow create": {
        in: [{ var: "request.auth.signer" }, { var: "contract.owners" }],
      },
    }
    await db.setRules(rules, "ppl", {
      ar: arweave_wallet,
    })
    expect(await db.getRules("ppl")).to.eql(rules)
    await db.set(data, "ppl", "Bob")
    expect(await db.get("ppl", "Bob")).to.eql(null)
    await db.set(data, "ppl", "Bob", { ar: arweave_wallet })
    expect(await db.get("ppl", "Bob")).to.eql(data)
  },

  "should bundle mulitple transactions": async ({ db }) => {
    const arweave_wallet2 = await db.arweave.wallets.generate()
    const arweave_wallet3 = await db.arweave.wallets.generate()
    const data = { name: "Bob", age: 20 }
    const data2 = { name: "Alice", age: 30 }
    const params = await db.sign("set", data, "ppl", "Bob", {
      ar: arweave_wallet2,
    })
    const params2 = await db.sign("upsert", data2, "ppl", "Alice", {
      ar: arweave_wallet3,
    })
    await db.bundle([params, params2])
    expect(await db.get("ppl", "Bob")).to.eql(data)
    expect(await db.get("ppl", "Alice")).to.eql(data2)
  },

  "should update nested object with dot notation": async ({ db }) => {
    const data = { age: 30 }
    await db.set(data, "ppl", "Bob")
    expect(await db.get("ppl", "Bob")).to.eql(data)
    await db.upsert({ "favorites.food": "apple" }, "ppl", "Bob")
    const data2 = { age: 30, favorites: { food: "apple" } }
    expect(await db.get("ppl", "Bob")).to.eql(data2)
    await db.update(
      {
        "countries.UAE.Dubai": "Marina",
        "favorites.music": "opera",
        "favorites.food": db.del(),
      },
      "ppl",
      "Bob"
    )
    const data3 = {
      age: 30,
      favorites: { music: "opera" },
      countries: { UAE: { Dubai: "Marina" } },
    }
    expect(await db.get("ppl", "Bob")).to.eql(data3)
    expect(await db.get("ppl", ["countries.UAE.Dubai", "==", "Marina"])).to.eql(
      [data3]
    )
  },

  "should add triggers": async ({ db, arweave_wallet }) => {
    const data1 = {
      key: "trg",
      on: "create",
      func: [
        ["let", "batches", []],
        [
          "do",
          [
            "when",
            ["propEq", "id", "Bob"],
            [
              "pipe",
              ["var", "batches"],
              ["append", ["[]", "update", { age: db.inc(2) }, "ppl", "Bob"]],
              ["let", "batches"],
            ],
            { var: "data" },
          ],
        ],
        ["batch", { var: "batches" }],
      ],
    }
    const data2 = {
      key: "trg2",
      on: "update",
      func: [["upsert", [{ name: "Alice", age: db.inc(1) }, "ppl", "Alice"]]],
    }
    const data3 = {
      key: "trg3",
      on: "delete",
      func: [["update", [{ age: db.inc(1) }, "ppl", "Bob"]]],
    }
    await db.addTrigger(data1, "ppl", { ar: arweave_wallet })
    await db.addTrigger(data2, "ppl", { ar: arweave_wallet })
    await db.addTrigger(mergeLeft({ index: 0 }, data3), "ppl", {
      ar: arweave_wallet,
    })
    expect(await db.getTriggers("ppl")).to.eql([data3, data1, data2])
    await db.set({ name: "Bob", age: 20 }, "ppl", "Bob")
    expect((await db.get("ppl", "Bob")).age).to.eql(22)
    await db.removeTrigger("trg2", "ppl", { ar: arweave_wallet })
    expect(await db.getTriggers("ppl")).to.eql([data3, data1])

    const trigger = {
      key: "inc-count",
      on: "create",
      func: [
        ["upsert", [{ count: db.inc(1) }, "like-count", { var: "data.id" }]],
      ],
    }
    await db.addTrigger(trigger, "likes", { ar: arweave_wallet })
    await db.set({ data: Date.now() }, "likes", "abc")
    expect((await db.get("like-count", "abc")).count).to.equal(1)
  },
}

module.exports = (it, its, local = {}) => {
  const _tests = mergeLeft(local, tests)
  for (const k in mergeLeft(local, _tests)) {
    const [name, type] = k.split(".")
    ;(isNil(type) ? it : it[type])(name, async () => _tests[k](its()))
  }
}
