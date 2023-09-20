const { isNil } = require("ramda")
const { parse } = require("../../lib/utils")
const { err, isOwner, wrapResult } = require("../../../common/lib/utils")
const { validate } = require("../../lib/validate")

const removeCron = async (
  state,
  action,
  signer,
  contractErr = true,
  SmartWeave,
  kvs,
  executeCron,
  depth = 1,
  type = "direct"
) => {
  if ((state.bundlers ?? []).length !== 0 && type === "direct") {
    err("only bundle queries are allowed")
  }

  let original_signer = null
  if (isNil(signer)) {
    ;({ signer, original_signer } = await validate(
      state,
      action,
      "removeCron",
      SmartWeave,
      true,
      kvs
    ))
  }
  const owner = isOwner(signer, state)
  if (isNil(state.crons)) {
    state.crons = { lastExecuted: SmartWeave.block.timestamp, crons: {} }
  }
  const [key] = action.input.query
  if (isNil(state.crons.crons[key])) err("cron doesn't exist")
  delete state.crons.crons[key]
  return wrapResult(state, original_signer, SmartWeave)
}

module.exports = { removeCron }
