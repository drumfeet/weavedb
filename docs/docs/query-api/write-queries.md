---
sidebar_position: 1
---

# Write Queries

:::info
`db` is assumed to be the state variable storing the WeaveDB SDK object.

For references, see [Initialize WeaveDB](/docs/get-started#initialize-weavedb)
:::

## add

To add a new document:

```js
await db.add({ "age": 20, "name": "Bob" }, "collection_name")
```
:::note 
The doc id will be randomly yet deterministically assigned.
:::

## set

```js
await db.set({ "age": 20, "name": "Bob" }, "collection_name", "doc_id")
```
:::note 
This will reset the whole doc if the doc already exists.
:::

## upsert

Upsert will merge the new data with an existing doc or will set a new doc if it does not already exist:

```js
await db.upsert({ "age": 20, "name": "Bob" }, "collection_name", "doc_id")
```

## update

```js
await db.update({ "age": 25 }, "collection_name", "doc_id")
```
:::note 
This will fail if the doc does not exist.
:::

The following is a list of special operations. WeaveDB has shortcuts for common operations that are only available with the [SDK](https://docs.weavedb.dev/docs/category/weavedb-sdk) and not with the web console terminal at the moment.

### Delete a field

```js
await db.update({ "age": db.del() }, "collection_name", "doc_id")
```

### Increase a field

```js
await db.update({ "age": db.inc(5) }, "collection_name", "doc_id")
```

### Decrease a field

```js
await db.update({ "age": db.inc(-5) }, "collection_name", "doc_id")
```

### Array union

```js
await db.update({ "chars": db.union([ "a", "b", "c", "d" ]) }, "collection_name", "doc_id")
```

### Array remove

```js
await db.update({ "chars": db.union([ "b", "c" ]) }, "collection_name", "doc_id")
```

### Set block timestamp
```js
await db.update({ "date": db.ts() }, "collection_name", "doc_id")
```

### Set signer Ethereum address
```js
await db.update({ "address": db.signer() }, "collection_name", "doc_id")
```

## delete

Delete a doc

```js
await db.delete("collection_name", "doc_id")
```

## batch

An atomic batch is a feature that allows you to perform multiple read and write operations as a single, atomic unit. 

Atomic means that all the operations within the batch are either fully completed or completely aborted. If any of the write operations fail, none of the changes will be applied to the database, ensuring data integrity.

```js
await db.batch([
  ["set", { name: "Bob" }, "people", "Bob"],
  ["upsert", { name: "Alice" }, "people", "Alice"],
  ["delete", "John"]
])
```
:::note 
You can use batch only if all the queries are by the same signer. If you have multiple signers, use [bundle](write-queries#bundle). 
:::

Admin queries can be batch-executed as well:

```js
await db.batch([
  ["setSchema", schema, "people"],
  ["setRules", rules, "people"],
  ["addOwner", "0xABC"]
], { ar : admin_arweave_wallet })
```

## bundle

Bundle multiple queries from multiple signers

```js
const query1 = await db.sign("set", {name: "Bob"}, "people", "Bob", {evm: wallet1})
const query2 = await db.sign("set", {name: "Alice"}, "people", "Alice", {ii: wallet2})
const query3 = await db.sign("set", {name: "Beth"}, "people", "Beth", {ar: wallet3})

await db.bundle([query1, query2, query3], {ar: bundler_wallet})
```

## sign

Sign a query without sending a transaction:

```js
await db.sign("set", {name: "Bob", age: 20}, "collection_name", "doc_id")
```

## relay

Relay a query:

```js
const param = await db.sign("set", {name: "Bob"}, "collection_name", "doc_id")
const extra = { age: 20 }
await db.relay("jobID", param, extra, {evm: relayer_wallet})
```

<!-- /docs/authentication/auth.md -->
<!-- ## addAddressLink -->

<!-- /docs/authentication/auth.md -->
<!-- ## removeAddressLink -->

