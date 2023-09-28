const { equals, isNil, init, last } = require("ramda")
const { parse, trigger } = require("../../lib/utils")
const { err, validateSchema, wrapResult } = require("../../../common/lib/utils")
const { validate } = require("../../lib/validate")
const { put } = require("../../lib/index")
const update = async (
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
      "update",
      SmartWeave,
      true,
      kvs
    ))
  }
  let { new_data, path, _data, schema, next_data } = await parse(
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
  if (isNil(_data.__data)) err(`Data doesn't exist`)
  validateSchema(schema, next_data, contractErr)
  let { before, after } = await put(
    next_data,
    last(path),
    init(path),
    kvs,
    SmartWeave,
    signer
  )
  const updated = !equals(before.val, after.val)
  if (updated && depth < 10) {
    await trigger(
      ["update"],
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
          setter: _data.setter,
        },
      }
    )
  }
  return wrapResult(state, original_signer, SmartWeave, {
    docID: last(path),
    doc: next_data,
    path: init(path),
  })
}

module.exports = { update }
