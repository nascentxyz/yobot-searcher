import { utils } from 'ethers';

// use the `getEventsForTokenAddress` function to get eventsForTokenAddress
const fetchLatestOrdersForTokenAddress = (
  eventsForTokenAddress: any[]
) => {
	const eventsInReversedOrder = eventsForTokenAddress.reverse()
	// go through all the events (in reverse order), grab the latest user order and store it in a Map
	const ordersMap = new Map()
	eventsInReversedOrder.map(event => {
		if (!ordersMap.has(event.args._user)) {
			ordersMap.set(event.args.user, {
        user: event.args.user,
        priceInWeiEach: event.args.priceInWeiEach,
        quantity: event.args.quantity,
        readableQuantity: event.args.quantity.toString(),
        priceInEthEach: utils.formatEther(event.args.priceInWeiEach)
        }
      )
		}
	})
	const ordersArray = Array.from(ordersMap, ([, value]) => value)
	const nonZeroOrders = ordersArray.filter(order => !order.quantity.eq('0'))
	return nonZeroOrders
}

export default fetchLatestOrdersForTokenAddress;