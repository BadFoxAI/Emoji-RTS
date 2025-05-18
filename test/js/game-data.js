// js/game-data.js
// Contains static game data: constants, FACTION_DATA, and helper for game action icons.
// Loaded after menu.js and before game-state.js.

"use strict";

// --- Game Constants ---
// These constants define fundamental aspects of the game world and mechanics.
// They are intended to be set once and used throughout the game.

// Viewport and Camera
const MIN_SCALE = 0.1; 
const MAX_SCALE = 3.0; 
const PAN_SPEED = 25; // Speed of camera panning with keyboard

// World Dimensions
const WORLD_WIDTH = 6000; 
const WORLD_HEIGHT = 5000;

// Starting Player Resources
const INITIAL_WOOD = 350; 
const INITIAL_COAL = 250; 
const STARTING_FOOD_CAP = 4; // Initial food capacity provided by the base

// Resource Node Properties
const MINE_HEALTH_INIT = 30;    // How many times a mine can be harvested
const TREE_HARVEST_TIME = 5000; // Milliseconds to harvest one wood from a tree
const MINE_HARVEST_TIME = 7000; // Milliseconds to harvest one coal from a mine

// Unit Properties
const UNIT_SPEED = 2.8; // Base movement speed for units (pixels per game tick/frame adjustment)
const COLLISION_PADDING = 5; // Extra padding for collision checks to prevent visual overlap
const ATTACK_RANGE_TOLERANCE = 10; // How far outside attack range a unit can be before re-pathing
const WORKER_RETREAT_HP_PERCENT = 0.5; // Workers retreat if HP falls below this percentage (e.g., 0.5 = 50%)

// Farm Properties
const FARM_GRID_DIM = 4; // A farm is a 4x4 grid of farm tiles
const FARM_TILE_SIZE = 45; // Pixel size of each individual farm tile
const FARM_TOTAL_SIZE = FARM_GRID_DIM * FARM_TILE_SIZE; // Total pixel size of the farm building group

// Base Placement
const BASE_OFFSET_X = 400; // How far from the world edge player bases are placed
const BASE_OFFSET_Y = 400;

// AI Configuration
const AI_UPDATE_INTERVAL = 30; // AI makes decisions every N game loop frames
const AI_TARGET_WORKERS = 5;   // Ideal number of worker units for AI
const AI_TARGET_SOLDIERS = 7;  // Ideal number of soldier units for AI
const AI_TARGET_ARCHERS = 4;   // Ideal number of archer units for AI
const AI_TARGET_GUARD_TOWERS = 2; // Ideal number of guard towers for AI defense


// --- Game Action Icons ---
// Defines icons for specific game actions, reusing from RTS_MENU_ICONS.
// RTS_MENU_ICONS is defined in menu.js, which is loaded before this file.
const GAME_ACTION_ICONS = {
    BUILD_FARM: RTS_MENU_ICONS.ADD, 
    BUILD_BARRACKS: RTS_MENU_ICONS.ADD, 
    BUILD_ARCHERY: RTS_MENU_ICONS.ADD, 
    BUILD_TOWER: RTS_MENU_ICONS.ADD,
    TRAIN_WORKER: RTS_MENU_ICONS.ACTION, 
    TRAIN_SOLDIER: RTS_MENU_ICONS.ACTION, 
    TRAIN_ARCHER: RTS_MENU_ICONS.ACTION,
    MOVE: RTS_MENU_ICONS.CMD, 
    ATTACK: RTS_MENU_ICONS.ALERT, 
    HARVEST: RTS_MENU_ICONS.TOOL,
    RETURN_RESOURCE: RTS_MENU_ICONS.LOAD,
    ASSIST_BUILD: RTS_MENU_ICONS.SETTINGS
    // Add any other game-specific action icons here
};

// --- FACTION_DATA Definition ---
// This object holds all static data for each playable faction, including
// their units, buildings, costs, emojis, and default hotkeys.
// It directly uses the constants defined above (e.g., STARTING_FOOD_CAP, FARM_TOTAL_SIZE).
const FACTION_DATA = { 
    human: { 
        name: "Humans", 
        emojis: { 
            base: '🏰', worker: ['👩‍🌾', '👨‍🌾'], soldier: ['💂‍♀️🗡️', '💂‍♂️🗡️'], archer: ['🧝‍♀️🏹', '🧝‍♂️🏹'], 
            farm: '🌾', barracks: '⛺', archer_trainer: '🏭', guard_tower: '🗼', 
            tree: '🌳', mine: '⛰️', 
            resource_wood: '🪵', resource_coal: '⛏️' 
        },
        units: {
            worker: { 
                cost: { wood: 5, coal: 2 }, foodCost: 1, hp: 50, type: 'worker', 
                canBuild: true, trainTime: 8000, hotkey: 'w' 
            },
            soldier: { 
                cost: { wood: 10, coal: 5 }, foodCost: 2, hp: 100, type: 'soldier', 
                trainTime: 12000, trainedAt: 'barracks', 
                attackRange: 30, attackDamage: 10, attackSpeed: 1000, hotkey: 's' 
            },
            archer: { 
                cost: { wood: 12, coal: 8 }, foodCost: 2, hp: 70, type: 'archer', 
                trainTime: 15000, trainedAt: 'archer_trainer', 
                attackRange: 150, attackDamage: 8, attackSpeed: 1200, hotkey: 'r' 
            }
        },
        buildings: {
            base: { 
                cost: {}, size: { w: 180, h: 180 }, hp: 1500, buildTime: 1, // Effectively instant for pre-placed bases
                provides_food: STARTING_FOOD_CAP, isBase: true, trains: 'worker' 
            },
            farm: { 
                cost: { wood: 7, coal: 0 }, size: { w: FARM_TOTAL_SIZE, h: FARM_TOTAL_SIZE }, 
                hp: 200, buildTime: 15000, provides_food: 4, hotkey: 'f'
            },
            barracks: { 
                cost: { wood: 7, coal: 5 }, size: { w: 140, h: 140 }, hp: 800, 
                buildTime: 25000, trains: 'soldier', hotkey: 'x' // Using 'x' to avoid conflict with worker 'b' for build menu
            },
            archer_trainer: { 
                cost: { wood: 15, coal: 10 }, size: { w: 130, h: 130 }, hp: 700, 
                buildTime: 30000, trains: 'archer', hotkey: 'c' 
            },
            guard_tower: { 
                cost: { wood: 20, coal: 15 }, size: { w: 80, h: 100 }, hp: 500, 
                buildTime: 35000, attackRange: 200, attackDamage: 12, attackSpeed: 1800, hotkey: 'v' 
            }
        }
    },
    zombie: { 
        name: "Zombies", 
        emojis: { 
            base: '🏯', worker: ['🧟‍♀️', '🧟‍♂️'], soldier: '👹🪓', archer: ['🧟‍♀️🏹', '🧟‍♂️🏹'], 
            farm: '🍖', barracks: '🕳️', archer_trainer: '🕋', guard_tower: '⛩', 
            tree: '🌲', mine: '⛰️', 
            resource_wood: '🪵', resource_coal: '⛏️' 
        },
        units: { 
            worker: { 
                cost: { wood: 5, coal: 2 }, foodCost: 1, hp: 60, type: 'worker', 
                canBuild: true, trainTime: 8000, hotkey: 'w' 
            },
            soldier: { 
                cost: { wood: 10, coal: 5 }, foodCost: 2, hp: 120, type: 'soldier', 
                trainTime: 12000, trainedAt: 'barracks', 
                attackRange: 35, attackDamage: 12, attackSpeed: 1100, hotkey: 's' 
            },
            archer: { 
                cost: { wood: 12, coal: 8 }, foodCost: 2, hp: 80, type: 'archer', 
                trainTime: 15000, trainedAt: 'archer_trainer', 
                attackRange: 140, attackDamage: 7, attackSpeed: 1300, hotkey: 'r' 
            }
        },
        buildings: { 
             base: { 
                cost: {}, size: { w: 180, h: 180 }, hp: 1800, buildTime: 1, 
                provides_food: STARTING_FOOD_CAP, isBase: true, trains: 'worker' 
            },
             farm: { 
                cost: { wood: 7, coal: 0 }, size: { w: FARM_TOTAL_SIZE, h: FARM_TOTAL_SIZE }, 
                hp: 250, buildTime: 15000, provides_food: 4, hotkey: 'f' 
            },
             barracks: { 
                cost: { wood: 7, coal: 5 }, size: { w: 140, h: 140 }, hp: 900, 
                buildTime: 25000, trains: 'soldier', hotkey: 'x' 
            },
             archer_trainer: { 
                cost: { wood: 15, coal: 10 }, size: { w: 130, h: 130 }, hp: 800, 
                buildTime: 30000, trains: 'archer', hotkey: 'c' 
            },
             guard_tower: { 
                cost: { wood: 20, coal: 15 }, size: { w: 80, h: 100 }, hp: 600, 
                buildTime: 35000, attackRange: 190, attackDamage: 14, attackSpeed: 1900, hotkey: 'v' 
            }
         }
    }
};

/**
 * Helper function to retrieve the correct emoji for a given type and faction.
 * Handles cases where multiple emoji variations might exist for a type.
 * @param {string} type - The type of game element (e.g., 'worker', 'base', 'tree').
 * @param {string} factionKey - The key of the faction (e.g., 'human', 'zombie').
 * @returns {string} The emoji string or '?' if not found.
 */
function getEmojiForFaction(type, factionKey) {
    const faction = FACTION_DATA[factionKey];
    if (!faction || !faction.emojis || !faction.emojis[type]) {
        // Accessing global isDebugVisible (from game-state.js)
        // This check is for runtime use.
        if (typeof isDebugVisible !== 'undefined' && isDebugVisible) { // isDebugVisible is in game-state.js
             console.warn(`GAME-DATA: Emoji missing for type "${type}" in faction "${factionKey}"`);
        }
        return '?';
    }
    const emojiData = faction.emojis[type];
    return Array.isArray(emojiData) ? emojiData[Math.floor(Math.random() * emojiData.length)] : emojiData;
}
