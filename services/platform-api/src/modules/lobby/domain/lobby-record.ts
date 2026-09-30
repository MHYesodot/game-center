import type { LobbyConfiguration, LobbyMemberRole, LobbyStatus, LobbyVisibility } from '@game-center/contracts'

export const MAX_LOBBY_CAPACITY = 16
export const LOBBY_EXPIRY_WINDOW_MS = 4 * 60 * 60 * 1000
export const LOBBY_RECONNECT_GRACE_MS = 2 * 60 * 1000

export type DurableLobbyRecord = {
	lobbyId: string
	gameId: string
	ownerPlayerId: string
	status: LobbyStatus
	visibility: LobbyVisibility
	capacity: number
	minimumPlayers: number
	configuration: LobbyConfiguration
	joinCodeHash: string | null
	createdAt: string
	updatedAt: string
	closedAt: string | null
	expiresAt: string | null
}

export type DurableLobbyMemberRecord = {
	lobbyId: string
	playerId: string
	role: LobbyMemberRole
	joinedAt: string
	leftAt: string | null
}

export type DurableLobbyAggregate = DurableLobbyRecord & {
	members: DurableLobbyMemberRecord[]
}

export function getActiveLobbyMembers(lobby: DurableLobbyAggregate) {
	return lobby.members.filter((member) => member.leftAt === null)
}

export function getActiveMemberCount(lobby: DurableLobbyAggregate) {
	return getActiveLobbyMembers(lobby).length
}

export function getAvailableSeats(lobby: DurableLobbyAggregate) {
	return lobby.capacity - getActiveMemberCount(lobby)
}

export function getActiveMember(lobby: DurableLobbyAggregate, playerId: string) {
	return getActiveLobbyMembers(lobby).find((member) => member.playerId === playerId) ?? null
}

export function hasActiveOwner(lobby: DurableLobbyAggregate) {
	return getActiveLobbyMembers(lobby).filter((member) => member.role === 'owner').length === 1
}

export function getDeterministicOwnerSuccessor(lobby: DurableLobbyAggregate, leavingOwnerPlayerId: string) {
	return getActiveLobbyMembers(lobby)
		.filter((member) => member.playerId !== leavingOwnerPlayerId)
		.sort((left, right) => {
			if (toTimestamp(left.joinedAt) === toTimestamp(right.joinedAt)) {
				return left.playerId.localeCompare(right.playerId)
			}

			return toTimestamp(left.joinedAt) - toTimestamp(right.joinedAt)
		})[0] ?? null
}

export function isLobbyTerminal(lobby: DurableLobbyAggregate) {
	return lobby.status === 'closed' || lobby.status === 'expired'
}

export function isReadyCapableState(lobby: DurableLobbyAggregate) {
	return lobby.status === 'open'
}

export function canStartLobby(lobby: DurableLobbyAggregate) {
	return lobby.status === 'open'
}

export function isLobbyExpired(lobby: DurableLobbyAggregate, now: string) {
	return lobby.status === 'open' && lobby.expiresAt !== null && toTimestamp(lobby.expiresAt) <= toTimestamp(now)
}

export function materializeLobbyStatus(lobby: DurableLobbyAggregate, now: string): LobbyStatus {
	return isLobbyExpired(lobby, now) ? 'expired' : lobby.status
}

function toTimestamp(value: string) {
	return new Date(value).getTime()
}