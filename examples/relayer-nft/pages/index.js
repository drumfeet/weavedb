import SDK from "weavedb-sdk"
import { ethers } from "ethers"
import { useRef, useEffect, useState } from "react"
import { map } from "ramda"
import {
  Button,
  Box,
  Flex,
  Input,
  Textarea,
  ChakraProvider,
} from "@chakra-ui/react"

let sdk
const contractTxId = process.env.NEXT_PUBLIC_WEAVEDB_CONTRACT_TX_ID
const nftContractAddr = process.env.NEXT_PUBLIC_NFT_CONTRACT_ADDR

export default function Home() {
  const [nfts, setNFTs] = useState([])
  useEffect(() => {
    ;(async () => {
      const _sdk = new SDK({
        contractTxId,
        network: "localhost",
      })
      await _sdk.initializeWithoutWallet()
      sdk = _sdk
      setNFTs(await _sdk.get("nft", ["tokenID", "desc"]))
    })()
  }, [])

  const Header = () => (
    <Flex justify="center" width="500px" p={3}>
      <Box flex={1}>Mint NFT and post a Message with your tokenID!</Box>
      <Box
        as="a"
        target="_blank"
        sx={{ textDecoration: "underline" }}
        href={`https://goerli.etherscan.io/token/${nftContractAddr}#writeContract`}
      >
        mint
      </Box>
    </Flex>
  )
  const Post = () => {
    const [message, setMessage] = useState("")
    const [tokenID, setTokenID] = useState("")
    return (
      <Flex justify="center" width="500px" mb={5}>
        <Input
          w="100px"
          placeholder="tokenID"
          sx={{ borderRadius: "3px 0 0 3px" }}
          value={tokenID}
          onChange={e => {
            if (!Number.isNaN(+e.target.value)) {
              setTokenID(e.target.value)
            }
          }}
        />
        <Input
          flex={1}
          placeholder="Message"
          sx={{ borderRadius: "0" }}
          value={message}
          onChange={e => {
            setMessage(e.target.value)
          }}
        />
        <Button
          sx={{ borderRadius: "0 3px 3px 0" }}
          onClick={async () => {
            if (tokenID === "") {
              alert("enter your tokenID")
              return
            }
            if (/^\s*$/.test(message)) {
              alert("enter message")
              return
            }
            const provider = new ethers.providers.Web3Provider(
              window.ethereum,
              "any"
            )
            await provider.send("eth_requestAccounts", [])
            const addr = await provider.getSigner().getAddress()
            const params = await sdk.sign(
              "set",
              { tokenID: +tokenID, text: message },
              "nft",
              tokenID,
              {
                wallet: addr,
                jobID: "nft",
              }
            )
            const res = await fetch("/api/ownerOf", {
              method: "POST",
              body: JSON.stringify(params),
            }).then(v => v.json())
            if (
              !res.success ||
              (await sdk.db.readState()).cachedValue.validity[
                res.tx.originalTxId
              ] !== true
            ) {
              alert("Something went wrong")
            } else {
              setMessage("")
              setTokenID("")
              setNFTs(await sdk.get("nft", ["tokenID", "desc"]))
            }
          }}
        >
          Post
        </Button>
      </Flex>
    )
  }
  return (
    <ChakraProvider>
      <Flex direction="column" align="center" fontSize="12px">
        <Header />
        <Post />
        <Box>
          <Flex bg="#EDF2F7" w="500px">
            <Flex justify="center" p={2} w="75px">
              tokenID
            </Flex>
            <Flex justify="center" p={2} w="100px">
              Owner
            </Flex>
            <Box p={2} flex={1}>
              Message
            </Box>
          </Flex>
          {map(v => (
            <Flex
              sx={{ ":hover": { bg: "#EDF2F7" } }}
              w="500px"
              as="a"
              target="_blank"
              href={`https://goerli.etherscan.io/token/${nftContractAddr}?a=${v.owner}`}
            >
              <Flex justify="center" p={2} w="75px">
                {v.tokenID}
              </Flex>
              <Flex justify="center" p={2} w="100px">
                {v.owner.slice(0, 5)}...{v.owner.slice(-3)}
              </Flex>
              <Box p={2} flex={1}>
                {v.text}
              </Box>
            </Flex>
          ))(nfts)}
        </Box>
      </Flex>
    </ChakraProvider>
  )
}