const { hash } = require("../common/actions/read/hash")
const { getCrons } = require("../common/actions/read/getCrons")
const { getAlgorithms } = require("../common/actions/read/getAlgorithms")
const {
  getLinkedContract,
} = require("../common/actions/read/getLinkedContract")
const { getOwner } = require("../common/actions/read/getOwner")
const { getAddressLink } = require("../common/actions/read/getAddressLink")
const { getRelayerJob } = require("../common/actions/read/getRelayerJob")
const { listRelayerJobs } = require("../common/actions/read/listRelayerJobs")
const { getEvolve } = require("../common/actions/read/getEvolve")
const { getInfo } = require("../common/actions/read/getInfo")

const { ids } = require("./actions/read/ids")
const { nonce } = require("./actions/read/nonce")
const { version } = require("./actions/read/version")
const { get } = require("./actions/read/get")
const { getSchema } = require("./actions/read/getSchema")
const { getRules } = require("./actions/read/getRules")
const { getIndexes } = require("./actions/read/getIndexes")
const { listCollections } = require("./actions/read/listCollections")

const { set } = require("./actions/write/set")
const { upsert } = require("./actions/write/upsert")
const { update } = require("./actions/write/update")
const { remove } = require("./actions/write/remove")
const { addOwner } = require("./actions/write/addOwner")
const { removeOwner } = require("./actions/write/removeOwner")
const { setAlgorithms } = require("./actions/write/setAlgorithms")
const { setCanEvolve } = require("./actions/write/setCanEvolve")
const { setSecure } = require("./actions/write/setSecure")
const { setSchema } = require("./actions/write/setSchema")
const { addIndex } = require("./actions/write/addIndex")
const { removeIndex } = require("./actions/write/removeIndex")
const { setRules } = require("./actions/write/setRules")
const { removeCron } = require("./actions/write/removeCron")
const { addRelayerJob } = require("./actions/write/addRelayerJob")
const { removeRelayerJob } = require("./actions/write/removeRelayerJob")
const { linkContract } = require("./actions/write/linkContract")
const { unlinkContract } = require("./actions/write/unlinkContract")
const { removeAddressLink } = require("./actions/write/removeAddressLink")
const { addCron } = require("./actions/write/addCron")
const { addAddressLink } = require("./actions/write/addAddressLink")
const { evolve } = require("./actions/write/evolve")
const { add } = require("./actions/write/add")
const { batch } = require("./actions/write/batch")
const { bundle } = require("./actions/write/bundle")
const { relay } = require("./actions/write/relay")
const { migrate } = require("./actions/write/migrate")

const { cron } = require("./lib/cron")
const { err, isEvolving } = require("../common/lib/utils")
const { includes, isNil } = require("ramda")

const writes = [
  "relay",
  "set",
  "setSchema",
  "setRules",
  "addIndex",
  "removeIndex",
  "add",
  "upsert",
  "remove",
  "batch",
  "bundle",
  "addCron",
  "removeCron",
  "setAlgorithms",
  "addRelayerJob",
  "linkContract",
  "unlinkContract",
  "setCanEvolve",
  "setSecure",
  "addOwner",
  "removeOwner",
  "addAddressLink",
  "removeAddressLink",
]

const addHash =
  _SmartWeave =>
  async ({ state, result }) => {
    if (isNil(state.hash)) {
      state.hash = _SmartWeave.transaction.id
    } else {
      const hashes = _SmartWeave.arweave.utils.concatBuffers([
        _SmartWeave.arweave.utils.stringToBuffer(state.hash),
        _SmartWeave.arweave.utils.stringToBuffer(_SmartWeave.transaction.id),
      ])
      const hash = await _SmartWeave.arweave.crypto.hash(hashes, "SHA-384")
      state.hash = _SmartWeave.arweave.utils.bufferTob64(hash)
    }
    return { state, result }
  }

async function handle(state, action, _SmartWeave) {
  if (typeof SmartWeave !== "undefined") _SmartWeave = SmartWeave
  if (isEvolving(state) && includes(action.input.function)(writes)) {
    err("contract needs migration")
  }
  try {
    ;({ state } = await cron(state, _SmartWeave))
  } catch (e) {
    console.log(e)
  }
  switch (action.input.function) {
    case "get":
      return await get(state, action, false, _SmartWeave)
    case "cget":
      return await get(state, action, true, _SmartWeave)
    case "getAddressLink":
      return await getAddressLink(state, action, _SmartWeave)
    case "listCollections":
      return await listCollections(state, action, _SmartWeave)
    case "getInfo":
      return await getInfo(state, action, _SmartWeave)
    case "getCrons":
      return await getCrons(state, action, _SmartWeave)
    case "getAlgorithms":
      return await getAlgorithms(state, action, _SmartWeave)
    case "getLinkedContract":
      return await getLinkedContract(state, action, _SmartWeave)
    case "listRelayerJobs":
      return await listRelayerJobs(state, action, _SmartWeave)
    case "getRelayerJob":
      return await getRelayerJob(state, action, _SmartWeave)
    case "getIndexes":
      return await getIndexes(state, action, _SmartWeave)
    case "getSchema":
      return await getSchema(state, action, _SmartWeave)
    case "getRules":
      return await getRules(state, action, _SmartWeave)
    case "ids":
      return await ids(state, action, _SmartWeave)
    case "nonce":
      return await nonce(state, action, _SmartWeave)
    case "hash":
      return await hash(state, action, _SmartWeave)
    case "version":
      return await version(state, action, _SmartWeave)
    case "getOwner":
      return await getOwner(state, action, _SmartWeave)
    case "getEvolve":
      return await getEvolve(state, action, _SmartWeave)
    case "add":
      return await addHash(_SmartWeave)(
        await add(state, action, undefined, undefined, undefined, _SmartWeave)
      )
    case "set":
      return await addHash(_SmartWeave)(
        await set(state, action, undefined, undefined, _SmartWeave)
      )
    case "upsert":
      return await addHash(_SmartWeave)(
        await upsert(state, action, undefined, undefined, _SmartWeave)
      )
    case "update":
      return await addHash(_SmartWeave)(
        await update(state, action, undefined, undefined, _SmartWeave)
      )
    case "delete":
      return await addHash(_SmartWeave)(
        await remove(state, action, undefined, undefined, _SmartWeave)
      )
    case "batch":
      return await addHash(_SmartWeave)(
        await batch(state, action, undefined, undefined, _SmartWeave)
      )
    case "bundle":
      return await addHash(_SmartWeave)(
        await bundle(state, action, undefined, undefined, _SmartWeave)
      )

    case "relay":
      return await addHash(_SmartWeave)(
        await relay(state, action, undefined, undefined, _SmartWeave)
      )

    case "addOwner":
      return await addHash(_SmartWeave)(
        await addOwner(state, action, undefined, undefined, _SmartWeave)
      )
    case "removeOwner":
      return await addHash(_SmartWeave)(
        await removeOwner(state, action, undefined, undefined, _SmartWeave)
      )
    case "setAlgorithms":
      return await addHash(_SmartWeave)(
        await setAlgorithms(state, action, undefined, undefined, _SmartWeave)
      )
    case "setCanEvolve":
      return await addHash(_SmartWeave)(
        await setCanEvolve(state, action, undefined, undefined, _SmartWeave)
      )
    case "setSecure":
      return await addHash(_SmartWeave)(
        await setSecure(state, action, undefined, undefined, _SmartWeave)
      )
    case "setSchema":
      return await addHash(_SmartWeave)(
        await setSchema(state, action, undefined, undefined, _SmartWeave)
      )
    case "addIndex":
      return await addHash(_SmartWeave)(
        await addIndex(state, action, undefined, undefined, _SmartWeave)
      )
    case "removeIndex":
      return await addHash(_SmartWeave)(
        await removeIndex(state, action, undefined, undefined, _SmartWeave)
      )

    case "setRules":
      return await addHash(_SmartWeave)(
        await setRules(state, action, undefined, undefined, _SmartWeave)
      )
    case "removeCron":
      return await addHash(_SmartWeave)(
        await removeCron(state, action, undefined, undefined, _SmartWeave)
      )
    case "addRelayerJob":
      return await addHash(_SmartWeave)(
        await addRelayerJob(state, action, undefined, undefined, _SmartWeave)
      )
    case "removeRelayerJob":
      return await addHash(_SmartWeave)(
        await removeRelayerJob(state, action, undefined, undefined, _SmartWeave)
      )
    case "linkContract":
      return await addHash(_SmartWeave)(
        await linkContract(state, action, undefined, undefined, _SmartWeave)
      )
    case "unlinkContract":
      return await addHash(_SmartWeave)(
        await unlinkContract(state, action, undefined, undefined, _SmartWeave)
      )
    case "removeAddressLink":
      return await addHash(_SmartWeave)(
        await removeAddressLink(
          state,
          action,
          undefined,
          undefined,
          _SmartWeave
        )
      )

    case "addCron":
      return await addHash(_SmartWeave)(
        await addCron(state, action, undefined, undefined, _SmartWeave)
      )
    case "addAddressLink":
      return await addHash(_SmartWeave)(
        await addAddressLink(state, action, undefined, undefined, _SmartWeave)
      )
    case "evolve":
      return await addHash(_SmartWeave)(
        await evolve(state, action, undefined, undefined, _SmartWeave)
      )
    case "migrate":
      return await addHash(_SmartWeave)(
        await migrate(state, action, undefined, undefined, _SmartWeave)
      )

    default:
      err(
        `No function supplied or function not recognised: "${action.input.function}"`
      )
  }
  return { state }
}

module.exports = { handle }
