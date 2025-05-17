// js/game-data.js
// Contains static game data: constants and FACTION_DATA.
// Loaded after menu.js and before game-state.js.

"use strict";

// --- Game Constants ---
const MIN_SCALE = 0.1; 
const MAX_SCALE = 3.0; 
const PAN_SPEED = 25;

const WORLD_WIDTH = 6000; 
const WORLD_HEIGHT = 5000;
const INITIAL_WOOD = 350; // Increased for easier testing
const INITIAL_COAL = 250; // Increased for easier testing
const STARTING_FOOD_CAP = 4; // Note: This is 'let' in some versions if modifiable. For static data, const is fine.

const MINE_HEALTH_INIT = 30;
const TREE_HARVEST_TIME = 5000; 
const MINE_HARVEST_TIME = 7000;
const UNIT_SPEED = 2.8; 
const COLLISION_PADDING = 5;
const FARM_GRID_DIM = 4; 
const FARM_TILE_SIZE = 45; 
const FARM_TOTAL_SIZE = FARM_GRID_DIM * FARM_TILE_SIZE; // Calculated once from other consts

const BASE_OFFSET_X = 400; 
const BASE_OFFSET_Y = 400;
const ATTACK_RANGE_TOLERANCE = 10; 
const WORKER_RETREAT_HP_PERCENT = 0.5;

const AI_UPDATE_INTERVAL = 30; // Game loop frames between AI updates
const AI_TARGET_WORKERS = 5;
const AI_TARGET_SOLDIERS = 7; 
const AI_TARGET_ARCHERS = 4; 
const AI_TARGET_GUARD_TOWERS = 2;

// --- FACTION_DATA Definition ---
// This uses the constants defined above.
const FACTION_DATA = { 
    human: { 
        name: "Humans", 
        emojis: { base: '🏰', worker: ['👩‍🌾', '👨‍🌾'], soldier: ['💂‍♀️🗡️', '💂‍♂️🗡️'], archer: ['🧝‍♀️🏹', '🧝‍♂️🏹'], farm: '🌾', barracks: '⛺', archer_trainer: '🏭', guard_tower: '🗼', tree: '🌳', mine: '⛰️', resource_wood: '🪵', resource_coal: '⛏️' },
        units: {
            worker: { cost: { wood: 5, coal: 2 }, foodCost: 1, hp: 50, type: 'worker', canBuild: true, trainTime: 8000, hotkey: 'w' },
            soldier: { cost: { wood: 10, coal: 5 }, foodCost: 2, hp: 100, type: 'soldier', trainTime: 12000, trainedAt: 'barracks', attackRange: 30, attackDamage: 10, attackSpeed: 1000, hotkey: 's' },
            archer: { cost: { wood: 12, coal: 8 }, foodCost: 2, hp: 70, type: 'archer', trainTime: 15000, trainedAt: 'archer_trainer', attackRange: 150, attackDamage: 8, attackSpeed: 1200, hotkey: 'r' }
        },
        buildings: {
            base: { cost: {}, size: { w: 180, h: 180 }, hp: 1500, buildTime: 1, provides_food: STARTING_FOOD_CAP, isBase: true, trains: 'worker' },
            farm: { cost: { wood: 7, coal: 0 }, size: { w: FARM_TOTAL_SIZE, h: FARM_TOTAL_SIZE }, hp: 200, buildTime: 15000, provides_food: 4, hotkey: 'f'},
            barracks: { cost: { wood: 7, coal: 5 }, size: { w: 140, h: 140 }, hp: 800, buildTime: 25000, trains: 'soldier', hotkey: 'x' }, // x to avoid conflict with worker build 'b'
            archer_trainer: { cost: { wood: 15, coal: 10 }, size: { w: 130, h: 130 }, hp: 700, buildTime: 30000, trains: 'archer', hotkey: 'c' }, // c for archery
            guard_tower: { cost: { wood: 20, coal: 15 }, size: { w: 80, h: 100 }, hp: 500, buildTime: 35000, attackRange: 200, attackDamage: 12, attackSpeed: 1800, hotkey: 'v' } // v for tower
        }
    },
    zombie: { 
        name: "Zombies", 
        emojis: { base: '🏯', worker: ['🧟‍♀️', '🧟‍♂️'], soldier: '👹🪓', archer: ['🧟‍♀️🏹', '🧟‍♂️🏹'], farm: '🍖', barracks: '🕳️', archer_trainer: '🕋', guard_tower: '⛩', tree: '🌲', mine: '⛰️', resource_wood: '🪵', resource_coal: '⛏️' },
        units: { 
            worker: { cost: { wood: 5, coal: 2 }, foodCost: 1, hp: 60, type: 'worker', canBuild: true, trainTime: 8000, hotkey: 'w' },
            soldier: { cost: { wood: 10, coal: 5 }, foodCost: 2, hp: 120, type: 'soldier', trainTime: 12000, trainedAt: 'barracks', attackRange: 35, attackDamage: 12, attackSpeed: 1100, hotkey: 's' },
            archer: { cost: { wood: 12, coal: 8 }, foodCost: 2, hp: 80, type: 'archer', trainTime: 15000, trainedAt: 'archer_trainer', attackRange: 140, attackDamage: 7, attackSpeed: 1300, hotkey: 'r' }
        },
        buildings: { // Ensuring hotkeys are consistent or unique for zombies too
             base: { cost: {}, size: { w: 180, h: 180 }, hp: 1800, buildTime: 1, provides_food: STARTING_FOOD_CAP, isBase: true, trains: 'worker' },
             farm: { cost: { wood: 7, coal: 0 }, size: { w: FARM_TOTAL_SIZE, h: FARM_TOTAL_SIZE }, hp: 250, buildTime: 15000, provides_food: 4, hotkey: 'f' },
             barracks: { cost: { wood: 7, coal: 5 }, size: { w: 140, h: 140 }, hp: 900, buildTime: 25000, trains: 'soldier', hotkey: 'x' },
             archer_trainer: { cost: { wood: 15, coal: 10 }, size: { w: 130, h: 130 }, hp: 800, buildTime: 30000, trains: 'archer', hotkey: 'c' },
             guard_tower: { cost: { wood: 20, coal: 15 }, size: { w: 80, h: 100 }, hp: 600, buildTime: 35000, attackRange: 190, attackDamage: 14, attackSpeed: 1900, hotkey: 'v' }
         }
    }
};

// --- Helper to get emoji ---
// This function is used by various parts of the game to display faction-specific emojis.
function getEmojiForFaction(type, factionKey) {
    const faction = FACTION_DATA[factionKey];
    // Check if faction and emojis exist to prevent errors, default to '?'
    if (!faction || !faction.emojis || !faction.emojis[type]) {
        // isDebugVisible might not be defined when this file is initially parsed.
        // It's better to check for it before logging, or just log always for now.
        // if(typeof isDebugVisible !== 'undefined' && isDebugVisible) console.warn(`Emoji missing: ${type} in ${factionKey}`);
        return '?';
    }
    const emojiData = faction.emojis[type];
    // Handle cases where an emoji type might have multiple variations (e.g., male/female worker)
    return Array.isArray(emojiData) ? emojiData[Math.floor(Math.random() * emojiData.length)] : emojiData;
}
