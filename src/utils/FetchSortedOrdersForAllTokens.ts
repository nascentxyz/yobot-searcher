import { providers } from "ethers"

import {
  filterEventsByTokenAddress,
  fetchAllERC721LimitOrderEvents,
  fetchLatestOrdersForTokenAddress
} from "./";

// returns a Map(tokenAddress => array of orders sorted from highest to lowest price offered)
const fetchSortedOrdersForAllTokens = async (
  ERC721LimitOrderContract,
  filterStartBlock: number,
  provider: providers.InfuraProvider,
  ERC721LimitOrderInterface: any
) => {
	const allEvents = await fetchAllERC721LimitOrderEvents(
    ERC721LimitOrderContract,
    filterStartBlock,
    provider,
    ERC721LimitOrderInterface
  )
	const tokenAddresses = Array.from(new Set(allEvents.map(event => event.args.tokenAddress.toString())))
	const orders = new Map()
	tokenAddresses.map(tokenAddress => {
		const eventsForTokenAddress = filterEventsByTokenAddress(tokenAddress, allEvents)
		// sort latestOrders based on price offered
    const latestOrders = fetchLatestOrdersForTokenAddress(tokenAddress);
		const sortedOrders = latestOrders.sort((a,b) => a.priceInWeiEach.gt(b.priceInWeiEach))
		orders.set(tokenAddress, sortedOrders)
	})
	return orders
}

export default fetchSortedOrdersForAllTokens;