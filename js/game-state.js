// js/game-state.js
// Holds all dynamic state variables for the game.
// These are modified by game-logic.js and read/used by main.js (for UI).

"use strict";

// --- Core Game State ---
let gameInitialized = false;
let gameOver = false;
let currentWorldWidth = 0; 
let currentWorldHeight = 0;

// Game Mode and Faction Setup (set by UI in main.js, used by logic in game-logic.js)
let gameMode = 'human_vs_ai'; 
let currentGameState = 'start_modal'; 

let p1FactionKey = 'human'; 
let p2FactionKey = 'zombie'; 
let playerFactionKey = 'human'; 
let opponentFactionKey = 'zombie'; 

// --- Player Resources ---
let p1Wood = 0; 
let p1Coal = 0; 
let p1CurrentFood = 0; 
let p1FoodCapacity = 0;

let p2Wood = 0; 
let p2Coal = 0; 
let p2CurrentFood = 0; 
let p2FoodCapacity = 0;

// --- Game Entities ---
let units = [];
let buildings = [];
let resources = [];
let constructions = [];

// --- Selection State ---
let selectedUnit = null;
let selectedBuilding = null;

// --- Key Entity References ---
let playerBaseData = null; 
let opponentBaseData = null; 

// --- ID Counters ---
let unitIdCounter = 0;
let buildingIdCounter = 0;
let constructionIdCounter = 0;
let resourceIdCounter = 0; 

// --- AI State ---
let factionAiUpdateCounters = {}; 
let aiGlobalUpdateCounter = 0; 

// --- Game Loop Timing ---
let lastTimestamp = 0;

// --- UI Interaction State (These are primarily managed in main.js but stored here for potential access by game-logic.js if ever needed) ---
let scale = 1.0; 
let viewOffsetX = 0; 
let viewOffsetY = 0;
let isPanning = false; 
let lastPanX = 0; 
let lastPanY = 0;
let keysPressed = { w: false, a: false, s: false, d: false, arrowup: false, arrowleft: false, arrowdown: false, arrowright: false };
let isDebugVisible = false;

let placingBuildingType = null; 
let placingFarm = false;
let farmPreviewTiles = []; 
let farmValidPlacement = false; 
let farmGroupBox = null;
let placementPreviewElement = null; 
let placementData = null;


/**
 * Resets the core dynamic game state to initial values for a new game.
 * Called by initializeAndStartGame in main.js.
 * Does not reset faction choices or game mode, as those are set by the start modal.
 */
function resetCoreGameState() {
    // console.log("GAME-STATE: resetCoreGameState called");
    gameInitialized = false; 
    gameOver = false;
    // currentGameState is typically reset by the function calling this (e.g. to 'in_game' or 'start_modal')

    // Clear entity arrays and their DOM elements
    // Ensure elements are removed from DOM to prevent memory leaks or ghost elements
    [...units, ...buildings, ...resources, ...constructions].forEach(entity => {
        if (entity.element && entity.element.parentNode) {
            entity.element.remove();
        }
        // Special case for farms that are arrays of tiles
        if (entity.buildingType === 'farm' && Array.isArray(entity.tileElements)) {
            entity.tileElements.forEach(tile => tile?.remove());
        }
    });

    units = []; 
    buildings = []; 
    resources = []; 
    constructions = [];

    selectedUnit = null; 
    selectedBuilding = null;
    playerBaseData = null; 
    opponentBaseData = null;

    unitIdCounter = 0; 
    buildingIdCounter = 0; 
    constructionIdCounter = 0;
    resourceIdCounter = 0;

    factionAiUpdateCounters = {}; // Will be repopulated in initializeAndStartGame
    aiGlobalUpdateCounter = 0;
    lastTimestamp = 0;

    // UI-related state that should be reset
    scale = 1.0; viewOffsetX = 0; viewOffsetY = 0;
    isPanning = false; lastPanX = 0; lastPanY = 0;
    keysPressed = { w: false, a: false, s: false, d: false, arrowup: false, arrowleft: false, arrowdown: false, arrowright: false };
    // isDebugVisible is a user preference, might not reset here unless intended
    
    placingBuildingType = null; placingFarm = false;
    farmPreviewTiles.forEach(tile => tile.remove()); // Ensure preview tiles are gone
    farmPreviewTiles = []; 
    if (placementPreviewElement) placementPreviewElement.remove();
    placementPreviewElement = null;
    placementData = null; farmGroupBox = null;

    // Resource initialization happens in initializeAndStartGame using constants from game-data.js
    // console.log("GAME-STATE: Core game state reset complete.");
}

// Simple setters if needed for more controlled state changes from other modules.
// For this non-module structure, direct assignment also works.
function setGameInitialized(value) { gameInitialized = value; }
function setGameOver(value) { gameOver = value; }
function setCurrentGameState(state) { 
    currentGameState = state; 
    // console.log("GAME-STATE: Current Game State set to: ", currentGameState);
}
function setSelectedUnit(unit) { selectedUnit = unit; }
function setSelectedBuilding(building) { selectedBuilding = building; }
