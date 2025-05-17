// js/game-state.js
// Holds all dynamic state variables for the game.
// These are modified by game_logic.js and read/used by main_ui_input.js.

"use strict";

// --- Core Game State ---
let gameInitialized = false;
let gameOver = false;
let currentWorldWidth = 0; 
let currentWorldHeight = 0;

// Game Mode and Faction Setup (set by UI, used by logic)
let gameMode = 'human_vs_ai'; // Default, will be set by start modal
let currentGameState = 'start_modal'; // 'start_modal', 'in_game', 'main_menu', 'editor'

let p1FactionKey = 'human'; // Default, will be set by start modal
let p2FactionKey = 'zombie'; // Default, will be set by start modal
let playerFactionKey = 'human'; // The faction the human player directly controls
let opponentFactionKey = 'zombie'; // The primary opponent for the human player

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
let factionAiUpdateCounters = {}; // Will be { [factionKey]: count }
let aiGlobalUpdateCounter = 0; // Used to stagger AI updates if needed

// --- Game Loop Timing ---
let lastTimestamp = 0;

// --- Function to reset game state for a new game ---
// This is called by initializeAndStartGame in main_ui_input.js
function resetCoreGameState() {
    console.log("resetCoreGameState called");
    gameInitialized = false; 
    gameOver = false;
    // currentGameState is typically reset by the function calling this (e.g. to 'in_game' or 'start_modal')

    // Faction keys and gameMode are set by the start modal, not reset here.

    // Clear entity arrays
    units.forEach(u => u.element?.remove()); // Remove elements from DOM
    buildings.forEach(b => b.element?.remove());
    resources.forEach(r => r.element?.remove());
    constructions.forEach(c => c.element?.remove());

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

    // Resource initialization happens in initializeAndStartGame using constants
    // console.log("Core game state reset complete.");
}

// Setter functions for state that might be changed from other modules
// This helps manage state changes more explicitly if needed, though for this structure,
// direct modification of these global variables is also possible.
function setGameInitialized(value) { gameInitialized = value; }
function setGameOver(value) { gameOver = value; }
function setCurrentGameState(state) { currentGameState = state; }
function setSelectedUnit(unit) { selectedUnit = unit; }
function setSelectedBuilding(building) { selectedBuilding = building; }
