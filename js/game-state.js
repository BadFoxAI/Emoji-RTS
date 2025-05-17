// js/game-state.js
// Holds all dynamic state variables for the game.
// These are modified by game-logic.js and read/used by main.js (for UI).
// Loaded after game-data.js.

"use strict";

// --- Core Game State ---
let gameInitialized = false;    // True once the game has fully initialized and is ready to run
let gameOver = false;           // True when a game over condition is met
let currentWorldWidth = 0;      // Actual width of the game world (set during initialization)
let currentWorldHeight = 0;     // Actual height of the game world (set during initialization)

// Game Mode and Faction Setup (set by UI, used by logic)
let gameMode = 'human_vs_ai';   // Current game mode: 'human_vs_ai', 'ai_vs_ai'
let currentGameState = 'start_modal'; // Overall application state: 'start_modal', 'in_game', 'main_menu', 'editor'

let p1FactionKey = 'human';     // Faction key for player 1 (e.g., 'human', 'zombie')
let p2FactionKey = 'zombie';    // Faction key for player 2
let playerFactionKey = 'human'; // The faction key of the human player (if any)
let opponentFactionKey = 'zombie';// The faction key of the primary opponent to the human player

// --- Player Resources ---
// These track the resources for each player.
let p1Wood = 0; 
let p1Coal = 0; 
let p1CurrentFood = 0;          // Current food used by player 1's units
let p1FoodCapacity = 0;         // Total food capacity for player 1

let p2Wood = 0; 
let p2Coal = 0; 
let p2CurrentFood = 0; 
let p2FoodCapacity = 0;

// --- Game Entities ---
// Arrays to hold all active game objects.
let units = [];                 // All unit objects
let buildings = [];             // All building objects (including construction sites conceptually)
let resources = [];             // All resource node objects (trees, mines)
let constructions = [];         // Active construction site objects (distinct from completed buildings)

// --- Selection State (for player interaction) ---
let selectedUnit = null;        // The currently selected unit object by the player
let selectedBuilding = null;    // The currently selected building object by the player

// --- Key Entity References ---
let playerBaseData = null;      // Reference to player 1's main base object
let opponentBaseData = null;    // Reference to player 2's (or AI opponent's) main base object

// --- ID Counters (for generating unique IDs for new entities) ---
let unitIdCounter = 0;
let buildingIdCounter = 0;
let constructionIdCounter = 0;
let resourceIdCounter = 0; 

// --- AI State ---
let factionAiUpdateCounters = {}; // Stores AI update tick counts per faction: { [factionKey]: count }
let aiGlobalUpdateCounter = 0;    // General counter, can be used to stagger AI updates if needed

// --- Game Loop Timing ---
let lastTimestamp = 0;          // Timestamp of the last game loop execution

// --- UI Interaction State ---
// These are primarily managed in main.js but stored here for potential access 
// by game-logic.js if core game mechanics ever need to directly query or modify them.
// For this structure, these are mostly for reference if needed by game-logic.
let scale = 1.0;                // Current zoom level of the viewport
let viewOffsetX = 0;            // Camera X offset
let viewOffsetY = 0;            // Camera Y offset
let isPanning = false;          // True if the player is currently panning the camera
let lastPanX = 0;               // Last mouse X position during panning
let lastPanY = 0;               // Last mouse Y position during panning
let keysPressed = {             // Tracks currently pressed movement/control keys
    w: false, a: false, s: false, d: false, 
    arrowup: false, arrowleft: false, arrowdown: false, arrowright: false 
};
let isDebugVisible = false;     // True if the debug panel is visible

// Building Placement State (managed in main.js)
let placingBuildingType = null; // String type of building being placed (e.g., 'farm')
let placingFarm = false;        // Specific flag for farm placement (due to its grid nature)
let farmPreviewTiles = [];      // Array of DOM elements for farm placement preview
let farmValidPlacement = false; // True if the current farm preview location is valid
let farmGroupBox = null;        // Bounding box of the entire farm being placed
let placementPreviewElement = null; // DOM element for single building placement preview
let placementData = null;       // Data object for the building being placed { type, size, valid, finalBox }


/**
 * Resets the core dynamic game state to initial values for a new game.
 * This is typically called by initializeAndStartGame (in main.js) 
 * before setting up a new game session.
 * It does not reset faction choices or game mode, as those are set by the start modal.
 */
function resetCoreGameState() {
    // console.log("GAME-STATE: resetCoreGameState called");
    gameInitialized = false; 
    gameOver = false;
    // currentGameState is reset by the calling function (e.g., startGameWithOptions in main.js)

    // Clear entity arrays and ensure their DOM elements are removed
    // Spread into a new array before iterating to avoid issues if removal modifies the original array
    [...units, ...buildings, ...resources, ...constructions].forEach(entity => {
        if (entity.element && entity.element.parentNode) {
            entity.element.remove();
        }
        // Special handling for farms if they store multiple tile elements
        if (entity.buildingType === 'farm' && Array.isArray(entity.tileElements)) {
            entity.tileElements.forEach(tile => {
                if (tile && tile.parentNode) {
                    tile.remove();
                }
            });
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

    // Reset UI-related state variables that are managed here (or mirrored from main.js for logic access)
    scale = 1.0; viewOffsetX = 0; viewOffsetY = 0;
    isPanning = false; lastPanX = 0; lastPanY = 0;
    keysPressed = { w: false, a: false, s: false, d: false, arrowup: false, arrowleft: false, arrowdown: false, arrowright: false };
    // isDebugVisible is a user preference, typically not reset with game state unless intended.
    
    // Reset building placement state
    placingBuildingType = null; 
    placingFarm = false;
    farmPreviewTiles.forEach(tile => { if (tile && tile.parentNode) tile.remove(); }); // Ensure preview tiles are gone
    farmPreviewTiles = []; 
    if (placementPreviewElement && placementPreviewElement.parentNode) placementPreviewElement.remove();
    placementPreviewElement = null;
    placementData = null; 
    farmGroupBox = null;

    // Resource counts are reset in initializeAndStartGame using constants from game-data.js
    // console.log("GAME-STATE: Core game state reset complete.");
}

// Setter functions for critical state flags, allowing more controlled changes from other modules.
// While direct assignment works in this non-module setup, setters can be useful for debugging or adding side effects.
function setGameInitialized(value) { 
    gameInitialized = value; 
    // if (isDebugVisible) console.log("GAME-STATE: gameInitialized set to", value);
}
function setGameOver(value) { 
    gameOver = value; 
    // if (isDebugVisible) console.log("GAME-STATE: gameOver set to", value);
}
function setCurrentGameState(state) { 
    currentGameState = state; 
    // if (isDebugVisible) console.log("GAME-STATE: Current Game State set to: ", currentGameState);
    // Potentially trigger UI changes based on game state here if not handled elsewhere
}
function setSelectedUnit(unit) { 
    selectedUnit = unit; 
    // if (isDebugVisible) console.log("GAME-STATE: Selected unit:", unit ? unit.id : 'None');
}
function setSelectedBuilding(building) { 
    selectedBuilding = building; 
    // if (isDebugVisible) console.log("GAME-STATE: Selected building:", building ? building.id : 'None');
}
