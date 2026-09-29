import type { Lobby } from '@game-center/contracts'

export type PlatformLobby = Lobby

export function countActiveLobbyMembers(lobby: PlatformLobby) {
	return lobby.members.filter((member) => member.role !== 'spectator').length
}

export function countReadyLobbyMembers(lobby: PlatformLobby) {
	return lobby.members.filter((member) => member.role !== 'spectator' && member.readyState === 'ready').length
}

export function isLobbyReadyForAllocation(lobby: PlatformLobby) {
	const activeMemberCount = countActiveLobbyMembers(lobby)

	return (
		activeMemberCount >= lobby.settings.minPlayers &&
		activeMemberCount <= lobby.settings.maxPlayers &&
		countReadyLobbyMembers(lobby) === activeMemberCount
	)
}