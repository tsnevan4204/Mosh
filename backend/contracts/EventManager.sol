// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "@openzeppelin/contracts/access/Ownable.sol";
import "./Ticket.sol";
import "./interfaces/IEventManager.sol";

contract EventManager is Ownable, IEventManager {
    Ticket public ticketNFT;
    uint256 public nextEventId;

    struct EventData {
        uint256 id;
        address organizer;
        string metadataURI;
        uint256 ticketPrice;
        uint256 maxTickets;
        uint256 ticketsSold;
        uint256 eventDate;
        bool cancelled;
    }

    mapping(uint256 => EventData) public events;
    mapping(uint256 => address[]) public eventBuyers;
    mapping(uint256 => mapping(address => uint256)) public payments;
    mapping(uint256 => uint256) public totalReceived;


    // 🔐 Custom Errors
    error NotOrganizer();
    error EventCancelled();
    error AlreadyCancelled();
    error EventInPast();
    error SoldOut();
    error IncorrectPayment();
    error RefundFailed();
    error NotAllowedToBuyOwnTicket();
    error ForwardFailed();

    // 📢 Events
    event EventCreated(uint256 indexed eventId, address indexed organizer);
    event TicketPurchased(uint256 indexed eventId, uint256 ticketId, address indexed buyer);
    event MetadataUpdated(uint256 indexed eventId, string newURI);
    event TicketPriceUpdated(uint256 indexed eventId, uint256 newPrice);
    event EventWasCancelled(uint256 indexed eventId);

    constructor(address _ticketNFT) {
        ticketNFT = Ticket(_ticketNFT);
    }

    function createEvent(
        string memory metadataURI,
        uint256 ticketPrice,
        uint256 maxTickets,
        uint256 eventDate
    ) external override {
        if (eventDate <= block.timestamp) revert EventInPast();

        uint256 eventId = nextEventId++;
        events[eventId] = EventData({
            id: eventId,
            organizer: msg.sender,
            metadataURI: metadataURI,
            ticketPrice: ticketPrice,
            maxTickets: maxTickets,
            ticketsSold: 0,
            eventDate: eventDate,
            cancelled: false
        });

        emit EventCreated(eventId, msg.sender);
    }

    function buyTicket(uint256 eventId) external payable override {
        EventData storage evt = events[eventId];

        if (evt.cancelled) revert EventCancelled();
        if (block.timestamp >= evt.eventDate) revert EventInPast();
        if (evt.ticketsSold >= evt.maxTickets) revert SoldOut();
        if (msg.value != evt.ticketPrice) revert IncorrectPayment();
        if (msg.sender == evt.organizer) revert NotAllowedToBuyOwnTicket();

        evt.ticketsSold += 1;

        uint256 ticketId = ticketNFT.mintTicket(msg.sender, evt.metadataURI, eventId);
        emit TicketPurchased(eventId, ticketId, msg.sender);
        
        totalReceived[eventId] += msg.value;
        payments[eventId][msg.sender] += msg.value;
        eventBuyers[eventId].push(msg.sender);

        // 💸 Immediately forward payment to organizer
        (bool sent, ) = payable(evt.organizer).call{value: msg.value}("");
        if (!sent) revert ForwardFailed();
    }

    function updateEventMetadataURI(uint256 eventId, string calldata newURI) external override {
        EventData storage evt = events[eventId];
        if (msg.sender != evt.organizer) revert NotOrganizer();
        if (evt.cancelled) revert EventCancelled();
        if (block.timestamp >= evt.eventDate) revert EventInPast();

        evt.metadataURI = newURI;
        emit MetadataUpdated(eventId, newURI);
    }

    function updateTicketPrice(uint256 eventId, uint256 newPrice) external override {
        EventData storage evt = events[eventId];
        if (msg.sender != evt.organizer) revert NotOrganizer();
        if (evt.cancelled) revert EventCancelled();
        if (block.timestamp >= evt.eventDate) revert EventInPast();

        evt.ticketPrice = newPrice;
        emit TicketPriceUpdated(eventId, newPrice);
    }

    function getEventBuyers(uint256 eventId) external view returns (address[] memory) {
        return eventBuyers[eventId];
    }

    function cancelEvent(uint256 eventId) external payable {
        EventData storage evt = events[eventId];

        if (msg.sender != evt.organizer) revert NotOrganizer();
        if (evt.cancelled) revert AlreadyCancelled();
        if (block.timestamp >= evt.eventDate) revert EventInPast();

        uint256 expectedRefund = totalReceived[eventId];
        if (msg.value != expectedRefund) revert IncorrectPayment();

        evt.cancelled = true;
        emit EventWasCancelled(eventId);

        for (uint256 i = 0; i < eventBuyers[eventId].length; i++) {
            address buyer = eventBuyers[eventId][i];
            uint256 refundAmount = payments[eventId][buyer];
            if (refundAmount > 0) {
                payments[eventId][buyer] = 0;
                (bool sent, ) = payable(buyer).call{value: refundAmount}("");
                if (!sent) revert RefundFailed();
            }
        }
    }

}
