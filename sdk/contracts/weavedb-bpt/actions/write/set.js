const { init, last, isNil } = require("ramda")
const { err, parse, trigger } = require("../../lib/utils")
const { validateSchema, wrapResult } = require("../../../common/lib/utils")
const { validate } = require("../../lib/validate")
const { put } = require("../../lib/index")
const set = async (
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
      "set",
      SmartWeave,
      true,
      kvs
    ))
  }
  let { path, schema, next_data } = await parse(
    state,
    action,
    action.input.function,
    signer,
    0,
    contractErr,
    SmartWeave,
    kvs,
    get,
    type
  )
  validateSchema(schema, next_data, contractErr)
  let { before, after } = await put(
    next_data,
    last(path),
    init(path),
    kvs,
    SmartWeave,
    signer,
    true
  )
  if (depth < 10) {
    state = await trigger(
      ["create"],
      state,
      path,
      SmartWeave,
      kvs,
      executeCron,
      depth,
      {
        data: {
          path: init(path),
          before: before.val,
          after: after.val,
          id: last(path),
          setter: after.setter,
        },
      },
      action.timestamp
    )
  }
  return wrapResult(state, original_signer, SmartWeave, {
    docID: last(path),
    doc: next_data,
    path: init(path),
  })
}

module.exports = { set }
