const { expect } = require("chai")
const { parseQuery } = require("../sdk/contracts/weavedb-bpt/lib/utils")
const { readFileSync } = require("fs")
const { resolve } = require("path")
const { mergeLeft } = require("ramda")
const EthCrypto = require("eth-crypto")
const {
  getSignature,
  getEventHash,
  generatePrivateKey,
  getPublicKey,
} = require("nostr-tools")

const tests = {
  "should get info": async ({
    db,
    arweave_wallet,
    dfinityTxId,
    ethereumTxId,
    bundlerTxId,
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
        bundler: bundlerTxId,
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
      Alice,
      Beth,
      John,
    ])

    // skip startAfter
    expect(await db.get("ppl", ["age"], ["startAfter", 30])).to.eql([John])

    // skip endAt
    expect(await db.get("ppl", ["age"], ["endAt", 30])).to.eql([
      Bob,
      Alice,
      Beth,
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

    // where ==
    expect(await db.get("ppl", ["age", "==", 30])).to.eql([Alice, Beth])

    // where >
    expect(await db.get("ppl", ["age"], ["age", ">", 30])).to.eql([John])

    // where >=
    expect(await db.get("ppl", ["age"], ["age", ">=", 30])).to.eql([
      Alice,
      Beth,
      John,
    ])

    // where <
    expect(await db.get("ppl", ["age"], ["age", "<", 30])).to.eql([Bob])

    // where <=
    expect(await db.get("ppl", ["age"], ["age", "<=", 30])).to.eql([
      Bob,
      Alice,
      Beth,
    ])

    // where array-contains
    expect(await db.get("ppl", ["letters", "array-contains", "b"])).to.eql([
      Beth,
      Bob,
    ])

    // where =!
    expect(await db.get("ppl", ["age"], ["age", "!=", 30])).to.eql([Bob, John])

    // where in

    expect(await db.get("ppl", ["age", "in", [20, 30]])).to.eql([
      Bob,
      Alice,
      Beth,
    ])

    // where not-in
    expect(await db.get("ppl", ["age"], ["age", "not-in", [20, 30]])).to.eql([
      John,
    ])

    // where in with sort
    expect(await db.get("ppl", ["weight"], ["age", "in", [20, 30]])).to.eql([
      Alice,
      Beth,
      Bob,
    ])

    // where not-in with sort
    expect(
      await db.get("ppl", ["age"], ["weight", "desc"], ["age", "not-in", [30]])
    ).to.eql([Bob, John])
    // where != with sort
    expect(
      await db.get("ppl", ["age"], ["weight", "desc"], ["age", "!=", 30])
    ).to.eql([Bob, John])

    // where array-contains-any
    expect(
      await db.get("ppl", ["letters", "array-contains-any", ["j", "t"]])
    ).to.eql([Beth, John])

    // where array-contains-any with sort

    await db.addIndex(
      [["letters", "array"], ["age", "desc"], ["weight"]],
      "ppl",
      {
        ar: arweave_wallet,
      }
    )
    expect(
      await db.get(
        "ppl",
        ["age", "desc"],
        ["weight", "asc"],
        ["letters", "array-contains-any", ["j", "t", "a"]]
      )
    ).to.eql([John, Alice, Beth])

    // where == with sort
    expect(await db.get("ppl", ["weight", "desc"], ["age", "==", 30])).to.eql([
      Beth,
      Alice,
    ])

    // where multiple == with sort
    await db.addIndex([["age"], ["height"], ["weight", "desc"]], "ppl", {
      ar: arweave_wallet,
    })
    expect(
      await db.get(
        "ppl",
        ["weight", "desc"],
        ["age", "==", 30],
        ["height", "==", 160]
      )
    ).to.eql([Alice])
    expect(
      await db.get(
        "ppl",
        ["height"],
        ["weight", "desc"],
        ["age", "==", 30],
        ["height", "==", 160]
      )
    ).to.eql([Alice])

    await db.addIndex([["age"], ["height"], ["weight", "desc"]], "ppl", {
      ar: arweave_wallet,
    })
    expect(
      await db.get(
        "ppl",
        ["age"],
        ["height"],
        ["age", "==", 30],
        ["height", "!=", 160],
        ["weight", "desc"]
      )
    ).to.eql([Beth])

    // array-contains with limit
    expect(await db.get("ppl", ["letters", "array-contains", "b"], 1)).to.eql([
      Beth,
    ])

    const alice = await db.cget("ppl", "Alice")
    const bob = await db.cget("ppl", "Bob")
    const beth = await db.cget("ppl", "Beth")
    const john = await db.cget("ppl", "John")
    // cursor
    expect(await db.get("ppl", ["age"], ["startAfter", alice])).to.eql([
      Beth,
      John,
    ])

    expect(await db.get("ppl", ["age", ">", 20], ["startAfter", alice])).to.eql(
      [Beth, John]
    )

    expect(
      await db.get("ppl", ["age", ">=", 20], ["startAfter", alice])
    ).to.eql([Beth, John])

    expect(await db.get("ppl", ["age", ">", 30], ["startAt", alice])).to.eql([
      John,
    ])

    expect(await db.get("ppl", ["age"], ["endBefore", alice])).to.eql([Bob])

    expect(await db.get("ppl", ["age", "<=", 29], ["endBefore", beth])).to.eql([
      Bob,
    ])

    expect(await db.get("ppl", ["age", ">=", 20], ["endBefore", beth])).to.eql([
      Bob,
      Alice,
    ])

    expect(await db.get("ppl", ["age", ">=", 20], ["endAt", alice])).to.eql([
      Bob,
      Alice,
    ])

    // array-contains with cursor
    await db.addIndex([["letters", "array"], ["name"]], "ppl", {
      ar: arweave_wallet,
    })

    expect(
      await db.get(
        "ppl",
        ["name", ">", "Beth"],
        ["letters", "array-contains", "b"],
        ["startAfter", beth]
      )
    ).to.eql([Bob])

    // array-contains-any with cursor
    expect(
      await db.get(
        "ppl",
        ["letters", "array-contains-any", ["b", "j"]],
        ["startAfter", beth]
      )
    ).to.eql([Bob, John])

    // where in with cursor
    expect(
      await db.get("ppl", ["age", "in", [20, 30]], ["startAfter", alice])
    ).to.eql([Beth])

    // where not-in with cursor
    expect(
      await db.get(
        "ppl",
        ["age"],
        ["age", "not-in", [20, 30]],
        ["startAfter", john]
      )
    ).to.eql([])

    // where =! with cursor
    expect(
      await db.get("ppl", ["age"], ["age", "!=", 30], ["startAfter", bob])
    ).to.eql([John])

    // desc/reverse tests
    expect(
      await db.get(
        "ppl",
        ["age", "desc"],
        ["age", ">", 20],
        ["startAfter", john]
      )
    ).to.eql([Beth, Alice])

    expect(
      await db.get(
        "ppl",
        ["age", "desc"],
        ["age", ">=", 30],
        ["startAt", beth],
        ["endAt", beth]
      )
    ).to.eql([Beth])

    expect(
      await db.get("ppl", ["age", "desc"], ["age", "<", 40], ["startAt", alice])
    ).to.eql([Alice, Bob])

    expect(
      await db.get(
        "ppl",
        ["age", "desc"],
        ["age", "<=", 40],
        ["startAfter", alice]
      )
    ).to.eql([Bob])
    expect(
      await db.get(
        "ppl",
        ["age", "desc"],
        ["age", "<", 40],
        ["startAfter", alice]
      )
    ).to.eql([Bob])

    expect(
      await db.get(
        "ppl",
        ["age", "desc"],
        ["age", ">", 20],
        ["endBefore", alice]
      )
    ).to.eql([John, Beth])

    expect(
      await db.get("ppl", ["age", "desc"], ["age", ">=", 30], ["endAt", alice])
    ).to.eql([John, Beth, Alice])

    expect(
      await db.get("ppl", ["age", "desc"], ["age", "<", 40], ["endAt", bob])
    ).to.eql([Beth, Alice, Bob])

    expect(
      await db.get(
        "ppl",
        ["age", "desc"],
        ["age", "<=", 40],
        ["endBefore", bob]
      )
    ).to.eql([John, Beth, Alice])

    // in with desc
    expect(await db.get("ppl", ["age", "asc"], ["age", "in", [40, 20]])).to.eql(
      [Bob, John]
    )
    expect(
      await db.get("ppl", ["age", "desc"], ["age", "in", [40, 20]])
    ).to.eql([John, Bob])

    expect(
      await db.get(
        "ppl",
        ["age", "desc"],
        ["age", "in", [40, 20]],
        ["startAfter", john]
      )
    ).to.eql([Bob])
    expect(
      await db.get(
        "ppl",
        ["age", "desc"],
        ["age", "in", [40, 20]],
        ["startAt", john],
        ["endBefore", bob]
      )
    ).to.eql([John])
    expect(await db.get("ppl", ["age", "not-in", [40, 20]])).to.eql([
      Alice,
      Beth,
    ])

    expect(
      await db.get("ppl", ["age", "desc"], ["age", "not-in", [40, 20]])
    ).to.eql([Beth, Alice])

    expect(
      await db.get(
        "ppl",
        ["age", "desc"],
        ["age", "not-in", [40, 20]],
        ["startAfter", beth]
      )
    ).to.eql([Alice])

    expect(
      await db.get(
        "ppl",
        ["age", "desc"],
        ["age", "!=", 30],
        ["startAfter", john]
      )
    ).to.eql([Bob])

    await db.addIndex(
      [
        ["letters", "array"],
        ["age", "desc"],
      ],
      "ppl",
      {
        ar: arweave_wallet,
      }
    )

    expect(
      await db.get(
        "ppl",
        ["age", "desc"],
        ["letters", "array-contains", "b"],
        ["age", "in", [20, 40]],
        ["startAt", bob]
      )
    ).to.eql([Bob])

    expect(
      await db.get(
        "ppl",
        ["age", "desc"],
        ["letters", "array-contains-any", ["b", "j"]],
        ["age", "in", [20, 40]],
        ["startAt", john]
      )
    ).to.eql([John, Beth, Bob])
  },

  "should update nested object with dot notation": async ({
    db,
    arweave_wallet,
  }) => {
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
    await db.addIndex([["countries.UAE.Dubai", "asc"]], "ppl", {
      ar: arweave_wallet,
    })

    expect(await db.get("ppl", ["countries.UAE.Dubai", "==", "Marina"])).to.eql(
      [data3]
    )
  },

  "should parse queries": async ({ db }) => {
    expect(parseQuery(["ppl", ["age", "==", 4]]).queries[0].opt).to.eql({
      limit: 1000,
      startAt: { age: 4 },
      endAt: { age: 4 },
    })
  },

  "should only allow add": async ({ db, arweave_wallet }) => {
    const rules = {
      "allow create": { "==": [{ var: "request.func" }, "add"] },
    }
    await db.setRules(rules, "ppl", { ar: arweave_wallet })
    const data = { name: "Bob", age: 20 }
    await db.set(data, "ppl", "Bob")
    expect((await db.get("ppl")).length).to.eql(0)
    await db.add(data, "ppl")
    expect((await db.get("ppl")).length).to.eql(1)
  },

  "should execute custom queries": async ({ db, arweave_wallet }) => {
    const rules = ["set:reg", [["allow()", true]], "set", [["allow()", true]]]
    await db.setRules(rules, "ppl", { ar: arweave_wallet })

    const data = { name: "Bob", age: 20 }
    await db.query("set:reg", data, "ppl", "Bob")
    expect(await db.get("ppl", "Bob")).to.eql(data)
  },

  "should set bundlers": async ({ db, walletAddress, arweave_wallet }) => {
    const bundlers = [walletAddress]
    await db.setBundlers(bundlers, { ar: arweave_wallet })
    expect(await db.getBundlers()).to.eql(bundlers)
    const tx = await db.bundle([await db.sign("add", {}, "ppl")])
    expect(tx.success).to.eql(true)
    const tx2 = await db.add({}, "ppl", { ar: arweave_wallet })
    expect(tx2.success).to.eql(false)

    await db.setBundlers(["0xabc"], { ar: arweave_wallet })
    const tx3 = await db.bundle([await db.sign("add", {}, "ppl")])
    expect(tx2.success).to.eql(false)
    return
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
  "should add array indexes": async ({ db, arweave_wallet }) => {
    const index = [
      ["favs", "array"],
      ["date", "desc"],
    ]
    await db.addIndex(index, "ppl", {
      ar: arweave_wallet,
    })
    const bob = { favs: ["food", "juice"], name: "bob", date: 1 }
    const alice = { favs: ["food", "cars"], name: "alice", date: 2 }
    expect((await db.getIndexes("ppl"))[0]).to.eql(index)
    await db.add(bob, "ppl")
    await db.add(alice, "ppl")
    expect(
      await db.get("ppl", ["favs", "array-contains", "food"], ["date", "desc"])
    ).to.eql([alice, bob])
  },
  "should force inequality come before sort": async ({
    db,
    arweave_wallet,
  }) => {
    await db.addIndex([["a"], ["age"]], "ppl", {
      ar: arweave_wallet,
    })
    const bob = { age: 1, a: 1 }
    await db.add(bob, "ppl")
    let err = false
    try {
      await db.get("ppl", ["age"], ["a", "!=", [1]])
    } catch (e) {
      err = true
    }
    expect(err).to.eql(true)
    expect(await db.get("ppl", ["age"], ["a", "in", [1]])).to.eql([bob])
  },
  "should run triggers": async ({ db, arweave_wallet }) => {
    const trigger = {
      key: "inc-count",
      version: 2,
      on: "create",
      func: [
        ["=$art", ["get()", ["posts", { var: "data.after.aid" }]]],
        ["=$week", ["subtract", { var: "block.timestamp" }, 60 * 60 * 24 * 7]],
        [
          "=$new_pt",
          [
            "add",
            1,
            [
              "multiply",
              ["defaultTo", 0, { var: "art.pt" }],
              [
                "subtract",
                1,
                [
                  "divide",
                  [
                    "subtract",
                    { var: "block.timestamp" },
                    ["defaultTo", { var: "week" }, { var: "art.ptts" }],
                  ],
                  { var: "week" },
                ],
              ],
            ],
          ],
        ],
        [
          "update()",
          [
            {
              likes: db.inc(1),
              pt: { var: "new_pt" },
              ptts: db.ts(),
              last_like: db.ts(),
            },
            "posts",
            { var: `data.after.aid` },
          ],
        ],
      ],
    }
    await db.addTrigger(trigger, "likes", { ar: arweave_wallet })
    await db.set({ id: "id-1", likes: 3 }, "posts", "id-1", {
      ar: arweave_wallet,
    })
    await db.add({ aid: "id-1" }, "likes", { ar: arweave_wallet })
    await db.add({ aid: "id-1" }, "likes", { ar: arweave_wallet })
    await db.add({ aid: "id-1" }, "likes", { ar: arweave_wallet })
    expect((await db.get("posts", "id-1")).likes).to.eql(6)
  },
  "should handle conditions with cron": async ({ db, arweave_wallet }) => {
    await db.set({ age: 1 }, "ppl", "Bob")
    await db.addCron(
      {
        do: true,
        version: 2,
        times: 1,
        span: 1,
        jobs: [["update()", [{ age: db.inc(1) }, "ppl", "Bob"]]],
      },
      "inc_age",
      {
        ar: arweave_wallet,
      }
    )
    expect((await db.get("ppl", "Bob")).age).to.eql(2)

    await db.addCron(
      {
        do: true,
        version: 2,
        times: 1,
        span: 1,
        jobs: [["break"], ["update()", [{ age: db.inc(1) }, "ppl", "Bob"]]],
      },
      "inc_age",
      {
        ar: arweave_wallet,
      }
    )
    expect((await db.get("ppl", "Bob")).age).to.eql(2)

    await db.addCron(
      {
        do: true,
        version: 2,
        times: 1,
        span: 1,
        jobs: [["break"], ["update()", [{ age: db.inc(1) }, "ppl", "Bob"]]],
      },
      "inc_age",
      {
        ar: arweave_wallet,
      }
    )
    expect((await db.get("ppl", "Bob")).age).to.eql(2)

    await db.addCron(
      {
        do: true,
        version: 2,
        times: 1,
        span: 1,
        jobs: [
          [
            "if",
            ["identity", false],
            ["update()", [{ age: db.inc(1) }, "ppl", "Bob"]],
          ],
        ],
      },
      "inc_age",
      {
        ar: arweave_wallet,
      }
    )
    expect((await db.get("ppl", "Bob")).age).to.eql(2)

    await db.addCron(
      {
        do: true,
        version: 2,
        times: 1,
        span: 1,
        jobs: [
          [
            "if",
            ["identity", true],
            ["update()", [{ age: db.inc(1) }, "ppl", "Bob"]],
          ],
        ],
      },
      "inc_age",
      {
        ar: arweave_wallet,
      }
    )
    expect((await db.get("ppl", "Bob")).age).to.eql(3)

    await db.addCron(
      {
        do: true,
        version: 2,
        times: 1,
        span: 1,
        jobs: [
          [
            "if",
            ["identity", false],
            ["update()", [{ age: db.inc(1) }, "ppl", "Bob"]],
            "else",
            ["update()", [{ age: db.inc(2) }, "ppl", "Bob"]],
          ],
        ],
      },
      "inc_age",
      {
        ar: arweave_wallet,
      }
    )
    expect((await db.get("ppl", "Bob")).age).to.eql(5)
  },
  "should tick": async ({ db, arweave_wallet }) => {
    await db.addCron(
      {
        version: 2,
        span: 1,
        times: 2,
        jobs: [["get", "ppl", ["ppl"]]],
      },
      "ticker",
      {
        ar: arweave_wallet,
      }
    )
    let success = false
    while (true) {
      const tx = await db.tick()
      if (tx.success) {
        success = true
        break
      }
    }
    expect(success).to.eql(true)
  },
  "should get in access control rules": async ({ db, arweave_wallet }) => {
    await db.set({ name: "Bob", age: 20 }, "users", "Bob")
    const rules = [
      [
        "create",
        [
          ["=$bob", ["get()", ["users", "$new.name"]]],
          ["=$new.age", "$bob.age"],
        ],
      ],
      ["write", [["allow()", true]]],
    ]
    await db.setRules(rules, "ppl", { ar: arweave_wallet })
    await db.set({ name: "Bob" }, "ppl", "Bob")
    expect((await db.get("ppl", "Bob")).age).to.eql(20)
  },
  "should allow if/ifelse in access control rules": async ({
    db,
    arweave_wallet,
  }) => {
    const rules = {
      "let create": {
        "resource.newData.age": [
          "ifelse",
          ["equals", "Bob", { var: "resource.newData.name" }],
          20,
          30,
        ],
      },
      "allow create": true,
    }
    await db.setRules(rules, "ppl", { ar: arweave_wallet })
    await db.set({ name: "Bob" }, "ppl", "Bob")
    expect((await db.get("ppl", "Bob")).age).to.eql(20)
    await db.set({ name: "Alice" }, "ppl", "Alice")
    expect((await db.get("ppl", "Alice")).age).to.eql(30)
  },
  "should change method name in access control rules": async ({
    db,
    arweave_wallet,
  }) => {
    const rules = {
      "let create": {
        "request.method": [
          "if",
          ["equals", "Bob", { var: "resource.newData.name" }],
          "Bob",
        ],
      },
      "allow Bob": true,
    }
    await db.setRules(rules, "ppl", { ar: arweave_wallet })
    await db.set({ name: "Bob" }, "ppl", "Bob", { ar: arweave_wallet })
    expect((await db.get("ppl", "Bob")).name).to.eql("Bob")
    await db.set({ name: "Alice" }, "ppl", "Alice", { ar: arweave_wallet })
    expect(await db.get("ppl", "Alice")).to.eql(null)
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
        version: 2,
        jobs: [["upsert()", [{ age: db.inc(1) }, "ppl", "Bob"]]],
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
      version: 2,
      jobs: [["add", [{ age: db.inc(1) }, "ppl"]]],
    }
    const trigger = {
      key: "inc-count",
      on: "create",
      version: 2,
      func: [["upsert()", [{ count: db.inc(1) }, "like-count", "$data.id"]]],
    }

    const tx = await db.batch(
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
        ["addTrigger", trigger, "ppl"],
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
    expect((await db.getTriggers("ppl"))[0]).to.eql(trigger)
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

  "should add triggers": async ({ db, arweave_wallet }) => {
    const data1 = {
      key: "trg",
      version: 2,
      on: "create",
      func: [
        [
          "when",
          ["propEq", "id", "Bob"],
          ["toBatch", ["update", { age: db.inc(2) }, "ppl", "Bob"]],
          { var: "data" },
        ],
      ],
    }
    const data2 = {
      key: "trg2",
      version: 2,
      on: "update",
      func: [["upsert()", [{ name: "Alice", age: db.inc(1) }, "ppl", "Alice"]]],
    }
    const data3 = {
      key: "trg3",
      version: 2,
      on: "delete",
      func: [["update()", [{ age: db.inc(1) }, "ppl", "Bob"]]],
    }
    await db.addTrigger(data1, "ppl", { ar: arweave_wallet })
    await db.addTrigger(data2, "ppl", { ar: arweave_wallet })
    await db.addTrigger(mergeLeft({ index: 0 }, data3), "ppl", {
      ar: arweave_wallet,
    })
    expect(await db.getTriggers("ppl")).to.eql([data3, data1, data2])
    await db.set({ name: "Bob", age: 20 }, "ppl", "Bob")
    expect((await db.get("ppl", "Bob")).age).to.eql(22)
    return
    await db.removeTrigger("trg2", "ppl", { ar: arweave_wallet })
    expect(await db.getTriggers("ppl")).to.eql([data3, data1])

    const trigger = {
      key: "inc-count",
      on: "create",
      version: 2,
      func: [
        ["upsert()", [{ count: db.inc(1) }, "like-count", { var: "data.id" }]],
      ],
    }
    await db.addTrigger(trigger, "likes", { ar: arweave_wallet })
    await db.set({ data: Date.now() }, "likes", "abc")
    expect((await db.get("like-count", "abc")).count).to.equal(1)
  },
  "should process nostr events.only": async ({ db, arweave_wallet }) => {
    const rule = [
      [
        "set:nostr_events",
        [
          ["=$event", ["get()", ["nostr_events", "$id"]]],
          ["if", "o$event", ["deny()"]],
          ["allow()"],
        ],
      ],
    ]
    await db.setRules(rule, "nostr_events", { ar: arweave_wallet })
    const trigger = {
      key: "nostr_events",
      on: "create",
      version: 2,
      func: [
        [
          "if",
          ["equals", 1, "$data.after.kind"],
          [
            "set()",
            [
              {
                id: "$data.id",
                owner: "$data.after.pubkey",
                type: "status",
                description: "$data.after.content",
                date: "$data.after.created_at",
                repost: "",
                reply_to: "",
                reply: false,
                quote: false,
                parents: [],
                hashes: [],
                mentions: [],
                repost: 0,
                quotes: 0,
                comments: 0,
              },
              "posts",
              "$data.id",
            ],
          ],
        ],
        [
          "if",
          ["equals", 0, "$data.after.kind"],
          [
            "[]",
            ["=$profile", ["parse()", "$data.after.content"]],
            [
              "set()",
              [
                {
                  name: "$profile.name",
                  address: "$data.after.pubkey",
                  followers: 0,
                  following: 0,
                },
                "users",
                "$data.after.pubkey",
              ],
            ],
          ],
        ],
      ],
    }
    await db.addTrigger(trigger, "nostr_events", { ar: arweave_wallet })

    let sk = generatePrivateKey()
    let pubkey = getPublicKey(sk)

    let event = {
      kind: 1,
      created_at: Math.floor(Date.now() / 1000),
      tags: [],
      content: "hello",
      pubkey,
    }
    event.id = getEventHash(event)
    event.sig = getSignature(event, sk)
    await db.nostr(event)
    await db.nostr(event)
    let event2 = {
      kind: 1,
      created_at: Math.floor(Date.now() / 1000),
      tags: [],
      content: "hello2",
      pubkey,
    }
    event2.id = getEventHash(event2)
    event2.sig = getSignature(event2, sk)
    await db.nostr(event2)
    console.log(await db.get("posts"))
    let event3 = {
      kind: 0,
      created_at: Math.floor(Date.now() / 1000),
      tags: [],
      content: JSON.stringify({
        name: "user",
        about: "test user",
        picture: "https://example.com/avatar.png",
      }),
      pubkey,
    }
    event3.id = getEventHash(event3)
    event3.sig = getSignature(event3, sk)
    await db.nostr(event3)
    console.log(await db.get("users"))
  },
}

module.exports = { tests }
