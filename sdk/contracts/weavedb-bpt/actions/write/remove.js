const { isNil, last, init } = require("ramda")
const { parse, trigger } = require("../../lib/utils")
const { clone } = require("../../../common/lib/pure")
const { err, wrapResult } = require("../../../common/lib/utils")
const { validate } = require("../../lib/validate")
const { del } = require("../../lib/index")

const remove = async (
  state,
  action,
  signer,
  contractErr = true,
  SmartWeave,
  kvs,
  executeCron,
  depth = 1,
  type = "direct",
  get
) => {
  if ((state.bundlers ?? []).length !== 0 && type === "direct") {
    err("only bundle queries are allowed")
  }
  let original_signer = null
  if (isNil(signer)) {
    ;({ signer, original_signer } = await validate(
      state,
      action,
      "delete",
      SmartWeave,
      true,
      kvs
    ))
  }
  const { data, query, new_data, path, _data, col } = await parse(
    state,
    action,
    "delete",
    signer,
    0,
    contractErr,
    SmartWeave,
    kvs,
    get,
    type
  )
  if (isNil(_data.__data)) err(`Data doesn't exist`)
  let { before, after } = await del(
    last(path),
    init(path),
    kvs,
    SmartWeave,
    signer
  )
  if (depth < 10) {
    await trigger(
      ["delete"],
      state,
      path,
      SmartWeave,
      kvs,
      executeCron,
      depth,
      {
        data: {
          before: before.val,
          after: after.val,
          id: last(path),
          setter: _data.setter,
        },
      }
    )
  }

  return wrapResult(state, original_signer, SmartWeave, {
    docID: last(path),
    doc: null,
    path: init(path),
  })
}

module.exports = { remove }
