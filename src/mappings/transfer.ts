import { log } from '@graphprotocol/graph-ts'

import { Transfer as TransferEvent } from '../types/PositionManager/PositionManager'
import { LiquidityPosition, Position, Transfer } from '../types/schema'
import { loadTransaction } from '../utils'
import { eventId, positionId } from '../utils/id'

// The subgraph handler must have this signature to be able to handle events,
// however, we invoke a helper in order to inject dependencies for unit tests.
export function handleTransfer(event: TransferEvent): void {
  handleTransferHelper(event)
}

export function handleTransferHelper(event: TransferEvent): void {
  const tokenId = positionId(event.params.id)
  const from = event.params.from
  const to = event.params.to

  let position = Position.load(tokenId)
  if (position === null) {
    position = new Position(tokenId)
    position.tokenId = event.params.id
    position.origin = event.transaction.from.toHexString()
    position.createdAtTimestamp = event.block.timestamp
  }

  // Link with pool using LiquidityPosition if available
  if (!position.pool) {
    const liquidityPosition = LiquidityPosition.load(tokenId)
    if (liquidityPosition !== null) {
      position.pool = liquidityPosition.pool
      // Update the LiquidityPosition to link back to this Position
      liquidityPosition.position = position.id
      liquidityPosition.save()
      log.info('Linked Position {} to Pool {} via LiquidityPosition', [tokenId, liquidityPosition.pool])
    }
  }

  position.owner = to.toHexString()

  const transaction = loadTransaction(event)

  const transfer = new Transfer(eventId(event.transaction.hash, event.logIndex))
  transfer.tokenId = event.params.id
  transfer.from = from.toHexString()
  transfer.to = to.toHexString()
  transfer.origin = event.transaction.from.toHexString()
  transfer.transaction = transaction.id
  transfer.logIndex = event.logIndex
  transfer.timestamp = transaction.timestamp
  transfer.position = position.id

  position.save()
  transfer.save()
}
