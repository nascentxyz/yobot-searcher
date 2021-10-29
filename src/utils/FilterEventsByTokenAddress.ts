

const filterEventsByTokenAddress = (
  tokenAddress: string,
  allEvents: any[]
) => {
	return allEvents.filter(event => event.args.tokenAddress == tokenAddress)
}

export default filterEventsByTokenAddress;