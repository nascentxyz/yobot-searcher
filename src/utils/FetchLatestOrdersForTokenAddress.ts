import { utils } from 'ethers';

// ** Parse through events and returns orders for token addresses ** //
const fetchLatestOrdersForTokenAddress = (
  eventsForTokenAddress: any[]
) => {
	const eventsInReversedOrder = eventsForTokenAddress.reverse()

	// ** Go through all the events, and grab the most valuable outstanding user order ** //
	// TODO: how to go through and nix ORDER_CANCELLED and ORDER_PLACED events args _action?

	const ordersMap = new Map();
	const cancelledOrdersMap = new Map();
	eventsInReversedOrder.map(event => {
		// ** Memoize cancelled orders ** //
		if (event.args._action === "ORDER_CANCELLED") {
			let cancelledObject = {
				user: event.args._user,
				priceInWeiEach: event.args._priceInWeiEach,
				quantity: event.args._quantity,
				readableQuantity: event.args._quantity.toString(),
				priceInEthEach: utils.formatEther(event.args._priceInWeiEach)
			}
			cancelledOrdersMap.set(event.args._user, [cancelledObject, ...cancelledOrdersMap.get(event.args._user)] || []);
		}
		// ** Only Store the
		if (!ordersMap.has(event.args._user)) {
			// 
			ordersMap.set(event.args._user, {
					user: event.args._user,
					priceInWeiEach: event.args._priceInWeiEach,
					quantity: event.args._quantity,
					readableQuantity: event.args._quantity.toString(),
					priceInEthEach: utils.formatEther(event.args._priceInWeiEach)
        }
      )
		}
	})
	const ordersArray = Array.from(ordersMap, ([, value]) => value)
	const nonZeroOrders = ordersArray.filter(order => !order.quantity.eq('0'))
	return nonZeroOrders
}

export default fetchLatestOrdersForTokenAddress;