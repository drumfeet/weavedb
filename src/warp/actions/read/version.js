import { isNil } from "ramda"
import { err } from "../../../common/warp/lib/utils"

export const version = async (state, action) => {
  const { version } = state
  if (isNil(version)) err(`No version assigned`)
  return { result: version }
}
