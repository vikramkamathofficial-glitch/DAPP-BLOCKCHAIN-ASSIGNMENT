// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/// @title MedVerify - Medicine batch authenticity registry
/// @notice A regulator approves manufacturers; approved manufacturers register
///         medicine batches; anyone (pharmacist, patient) can verify a batch.
contract MedVerify {
    // ---------- State ----------
    address public regulator;

    struct Batch {
        string batchId;
        string drugName;
        address manufacturer;
        uint256 manufactureDate;
        uint256 expiryDate;
        bool recalled;
        bool exists;
    }

    mapping(address => bool) public approvedManufacturers;
    mapping(bytes32 => Batch) private batches;
    string[] private batchIds;

    // ---------- Events ----------
    event ManufacturerApproved(address indexed manufacturer);
    event ManufacturerRevoked(address indexed manufacturer);
    event BatchRegistered(string batchId, string drugName, address indexed manufacturer, uint256 expiryDate);
    event BatchRecalled(string batchId, address indexed recalledBy);

    // ---------- Modifiers ----------
    modifier onlyRegulator() {
        require(msg.sender == regulator, "Only regulator allowed");
        _;
    }

    modifier onlyApprovedManufacturer() {
        require(approvedManufacturers[msg.sender], "Not an approved manufacturer");
        _;
    }

    // ---------- Constructor ----------
    constructor() {
        regulator = msg.sender;
    }

    // ---------- Regulator functions ----------
    function approveManufacturer(address _manufacturer) external onlyRegulator {
        require(_manufacturer != address(0), "Invalid address");
        require(!approvedManufacturers[_manufacturer], "Already approved");
        approvedManufacturers[_manufacturer] = true;
        emit ManufacturerApproved(_manufacturer);
    }

    function revokeManufacturer(address _manufacturer) external onlyRegulator {
        require(approvedManufacturers[_manufacturer], "Manufacturer not approved");
        approvedManufacturers[_manufacturer] = false;
        emit ManufacturerRevoked(_manufacturer);
    }

    // ---------- Manufacturer functions ----------
    function registerBatch(
        string calldata _batchId,
        string calldata _drugName,
        uint256 _expiryDate
    ) external onlyApprovedManufacturer {
        require(bytes(_batchId).length > 0, "Batch ID required");
        require(bytes(_drugName).length > 0, "Drug name required");
        require(_expiryDate > block.timestamp, "Expiry must be in the future");

        bytes32 key = keccak256(bytes(_batchId));
        require(!batches[key].exists, "Batch ID already registered");

        batches[key] = Batch({
            batchId: _batchId,
            drugName: _drugName,
            manufacturer: msg.sender,
            manufactureDate: block.timestamp,
            expiryDate: _expiryDate,
            recalled: false,
            exists: true
        });
        batchIds.push(_batchId);

        emit BatchRegistered(_batchId, _drugName, msg.sender, _expiryDate);
    }

    /// @notice The batch's own manufacturer or the regulator can recall it.
    function recallBatch(string calldata _batchId) external {
        bytes32 key = keccak256(bytes(_batchId));
        Batch storage b = batches[key];
        require(b.exists, "Batch not found");
        require(msg.sender == b.manufacturer || msg.sender == regulator, "Not authorised to recall");
        require(!b.recalled, "Already recalled");

        b.recalled = true;
        emit BatchRecalled(_batchId, msg.sender);
    }

    // ---------- Public read functions ----------
    /// @notice Returns batch details and a status string:
    ///         AUTHENTIC, EXPIRED, RECALLED or NOT REGISTERED.
    function verifyBatch(string calldata _batchId)
        external
        view
        returns (
            bool found,
            string memory drugName,
            address manufacturer,
            uint256 manufactureDate,
            uint256 expiryDate,
            bool recalled,
            string memory status
        )
    {
        Batch storage b = batches[keccak256(bytes(_batchId))];
        if (!b.exists) {
            return (false, "", address(0), 0, 0, false, "NOT REGISTERED");
        }
        string memory s = "AUTHENTIC";
        if (b.recalled) {
            s = "RECALLED";
        } else if (block.timestamp > b.expiryDate) {
            s = "EXPIRED";
        }
        return (true, b.drugName, b.manufacturer, b.manufactureDate, b.expiryDate, b.recalled, s);
    }

    function getBatchCount() external view returns (uint256) {
        return batchIds.length;
    }

    function getBatchIdAt(uint256 _index) external view returns (string memory) {
        require(_index < batchIds.length, "Index out of range");
        return batchIds[_index];
    }
}
