import { providers } from "ethers"

import {
  filterEventsByTokenAddress,
  fetchAllERC721LimitOrderEvents,
  fetchLatestOrdersForTokenAddress
} from "./";

// ** Maps tokenAddress => array of orders sorted from highest to lowest price offered ** //
const fetchSortedOrdersForAllTokens = async (
  ERC721LimitOrderContract,
  filterStartBlock: number,
  provider: providers.InfuraProvider,
  ERC721LimitOrderInterface: any
) => {
	// ** Get all ERC721LimitOrder events ** //
  const allEvents = await fetchAllERC721LimitOrderEvents(
    ERC721LimitOrderContract,
    filterStartBlock,
    provider,
    ERC721LimitOrderInterface
  );

  // ** Get a Set of Token Addresses ** //
	const tokenAddresses = Array.from(new Set(allEvents.map(event => event.args._tokenAddress.toString())))
	const orders = new Map()

  // ** For each Token Address ** //
	tokenAddresses.map(tokenAddress => {
    // ** Get all ERC721LimitOrder events for that Token Address ** //
		const eventsForTokenAddress = filterEventsByTokenAddress(tokenAddress, allEvents)
    // ** Get the latest orders given those events ** //
    const latestOrders = fetchLatestOrdersForTokenAddress(eventsForTokenAddress);
		// ** Sort the orders by price offered ** //
		const sortedOrders = latestOrders.sort((a,b) => a.priceInWeiEach.gt(b.priceInWeiEach))
		orders.set(tokenAddress, sortedOrders)
	})

  // ** Return the orders mapping ** //
	return orders
}

export default fetchSortedOrdersForAllTokens;