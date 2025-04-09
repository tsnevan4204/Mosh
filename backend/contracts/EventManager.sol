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
        bool withdrawn;
    }

    mapping(uint256 => EventData) public events;
    mapping(uint256 => address[]) public eventBuyers;
    mapping(uint256 => mapping(address => uint256)) public payments;

    // 🔐 Custom Errors
    error NotOrganizer();
    error EventCancelled();
    error AlreadyCancelled();
    error EventInPast();
    error EventNotHappenedYet();
    error SoldOut();
    error IncorrectPayment();
    error RefundFailed();
    error AlreadyWithdrawn();
    error WithdrawFailed();
    error NotAllowedToBuyOwnTicket();

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
            cancelled: false,
            withdrawn: false
        });

        emit EventCreated(eventId, msg.sender);
    }

    function buyTicket(uint256 eventId) external payable override {
        EventData storage evt = events[eventId];

        if (evt.cancelled) revert EventCancelled();
        if (block.timestamp >= evt.eventDate) revert EventInPast();
        if (evt.ticketsSold >= evt.maxTickets) revert SoldOut();
        if (msg.sender == evt.organizer) revert NotAllowedToBuyOwnTicket();
        if (msg.value != evt.ticketPrice) revert IncorrectPayment();

        evt.ticketsSold += 1;

        uint256 ticketId = ticketNFT.mintTicket(msg.sender, evt.metadataURI, eventId);
        emit TicketPurchased(eventId, ticketId, msg.sender);

        payments[eventId][msg.sender] += msg.value;
        eventBuyers[eventId].push(msg.sender);
    }

    function updateEventMetadataURI(uint256 eventId, string calldata newURI) external override {
        EventData storage evt = events[eventId];
        if (msg.sender != evt.organizer) revert NotOrganizer();
        if (evt.cancelled) revert EventCancelled();

        evt.metadataURI = newURI;
        emit MetadataUpdated(eventId, newURI);
    }

    function updateTicketPrice(uint256 eventId, uint256 newPrice) external override {
        EventData storage evt = events[eventId];
        if (msg.sender != evt.organizer) revert NotOrganizer();
        if (evt.cancelled) revert EventCancelled();

        evt.ticketPrice = newPrice;
        emit TicketPriceUpdated(eventId, newPrice);
    }

    function cancelEvent(uint256 eventId) external override {
        EventData storage evt = events[eventId];
        if (msg.sender != evt.organizer) revert NotOrganizer();
        if (evt.cancelled) revert AlreadyCancelled();

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

    function withdrawFunds(uint256 eventId) external override {
        EventData storage evt = events[eventId];
        if (msg.sender != evt.organizer) revert NotOrganizer();
        if (evt.cancelled) revert EventCancelled();
        if (block.timestamp <= evt.eventDate) revert EventNotHappenedYet();
        if (evt.withdrawn) revert AlreadyWithdrawn();

        evt.withdrawn = true;

        uint256 amount = evt.ticketPrice * evt.ticketsSold;
        (bool sent, ) = payable(evt.organizer).call{value: amount}("");
        if (!sent) revert WithdrawFailed();
    }
}