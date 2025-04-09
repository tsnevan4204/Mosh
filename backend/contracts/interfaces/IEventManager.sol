// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

interface IEventManager {
    function createEvent(
        string memory metadataURI,
        uint256 ticketPrice,
        uint256 maxTickets,
        uint256 eventDate
    ) external;

    function buyTicket(uint256 eventId) external payable;

    function updateEventMetadataURI(uint256 eventId, string calldata newURI) external;

    function updateTicketPrice(uint256 eventId, uint256 newPrice) external;

    function cancelEvent(uint256 eventId) external payable;

    function getEventBuyers(uint256 eventId) external view returns (address[] memory);
}