const { isNil, is, intersection } = require("ramda")
const { parse } = require("../../lib/utils")
const { clone } = require("../../../common/lib/pure")
const { err, wrapResult } = require("../../../common/lib/utils")
const { validate } = require("../../lib/validate")
const { validate: validator } = require("../../../common/lib/jsonschema")

const addRelayerJob = async (
  state,
  action,
  signer,
  contractErr = true,
  SmartWeave,
  kvs
) => {
  let original_signer = null
  if (isNil(signer)) {
    ;({ signer, original_signer } = await validate(
      state,
      action,
      "addRelayerJob",
      SmartWeave,
      true,
      kvs
    ))
  }

  let { _data, data, query, new_data, path } = await parse(
    state,
    action,
    "addRelayerJob",
    signer,
    null,
    contractErr,
    SmartWeave,
    kvs
  )
  const [jobID, job] = query
  if (!isNil(job.relayers) && !is(Array, job.relayers)) {
    err("relayers must be Array")
  }
  if (!isNil(job.signers) && !is(Array, job.signers)) {
    err("signers must be Array")
  }
  if (!isNil(job.schema)) {
    try {
      validator(undefined, clone(job.schema))
    } catch (e) {
      err("schema error")
    }
  }
  if (isNil(state.relayers)) state.relayers = {}
  state.relayers[jobID] = job
  return wrapResult(state, original_signer, SmartWeave)
}

module.exports = { addRelayerJob }
