// js/game-logic.js
// Contains the core game simulation logic: entity creation/management,
// AI behavior, combat resolution, resource gathering processes,
// construction progress, and the main game loop.

"use strict";

// --- Entity Creation & Management Functions ---

/**
 * Creates a new unit and adds it to the game.
 * @param {string} unitType - The type of unit to create (e.g., 'worker', 'soldier').
 * @param {object} spawnPos - An object {x, y} for the spawn location.
 * @param {string} factionKey - The faction this unit belongs to.
 * @returns {object|null} The created unit object or null if creation failed.
 */
function createUnit(unitType, spawnPos, factionKey) {
    const unitFactionData = FACTION_DATA[factionKey];
    if (!unitFactionData) { console.error(`GAME_LOGIC: No faction data for ${factionKey} in createUnit`); return null; }
    const unitStaticData = unitFactionData.units[unitType];
    if (!unitStaticData) { console.error(`GAME_LOGIC: No unit data for ${unitType} in faction ${factionKey}`); return null; }

    const element = document.createElement('div');
    element.classList.add('game-object', 'unit', unitType);
    element.textContent = getEmojiForFaction(unitType, factionKey); // From 0_rts_menu_and_data.js
    
    const unit = {
        id: `unit-${unitIdCounter++}`, // unitIdCounter from game-state.js
        faction: factionKey,
        element: element,
        unitType: unitType,
        worldX: spawnPos.x,
        worldY: spawnPos.y,
        target: null, targetElement: null, state: 'idle',
        resourceType: null, harvestTimer: null, indicatorElement: null,
        lastHarvestedNodeId: null, constructionId: null, ai_tasked: false,
        hp: unitStaticData.hp, maxHp: unitStaticData.hp,
        foodCost: unitStaticData.foodCost,
        canBuild: unitStaticData.canBuild || false,
        attackRange: unitStaticData.attackRange || 0,
        attackDamage: unitStaticData.attackDamage || 0,
        attackSpeed: unitStaticData.attackSpeed || 1000,
        lastAttackTime: 0,
        speed: UNIT_SPEED, // UNIT_SPEED from 0_rts_menu_and_data.js
        hpContainer: null, hpInner: null,
        progressBarContainer: null, progressBarInner: null, // For potential future abilities
    };

    const indicator = document.createElement('div');
    indicator.classList.add('carrying-indicator');
    element.appendChild(indicator);
    unit.indicatorElement = indicator;

    const { hpContainer, hpInner } = createHpBarElement(); // From 4_main-ui-input.js
    element.appendChild(hpContainer);
    unit.hpContainer = hpContainer;
    unit.hpInner = hpInner;
    updateHpBar(unit); // From 4_main-ui-input.js

    gameWorld.appendChild(element); // gameWorld from 4_main-ui-input.js
    const unitSize = 36; // Should ideally be a constant or derived from CSS
    placeElementInWorld(element, unit.worldX - unitSize / 2, unit.worldY - unitSize / 2); // From 4_main-ui-input.js
    element.classList.add('idle'); // Initial state
    element.dataset.unitId = unit.id;
    element.dataset.faction = factionKey;
    
    if (gameMode === 'human_vs_ai' && factionKey === playerFactionKey) { 
        element.addEventListener('click', (e) => { e.stopPropagation(); handleUnitClick(unit); }); // handleUnitClick from 4_main-ui-input.js
    }
    
    units.push(unit); // Add to global units array from game-state.js
    return unit;
}

/**
 * Creates a new building (or farm tiles) and adds it to the game.
 * @param {string} buildingType - The type of building.
 * @param {object} positionBox - {xMin, yMin, width, height, centerX, centerY}.
 * @param {string} factionKey - The owner faction.
 * @param {boolean} isBase - True if this is the main faction base.
 * @param {boolean} isConstructed - True if spawning a fully built structure, false if it's a conceptual representation after construction.
 * @returns {object|null} The created building object or null.
 */
function createBuilding(buildingType, positionBox, factionKey, isBase = false, isConstructed = true) {
    const buildingFactionData = FACTION_DATA[factionKey];
    if (!buildingFactionData) { console.error(`GAME_LOGIC: No faction data for ${factionKey} in createBuilding`); return null; }
    const buildingStaticData = buildingFactionData.buildings[buildingType];
    if (!buildingStaticData) { console.error(`GAME_LOGIC: No building data for ${buildingType} in ${factionKey}`); return null; }

    const element = document.createElement('div');
    const id = `bldg-${buildingIdCounter++}`; // buildingIdCounter from game-state.js
    element.id = id;
    element.classList.add('game-object', 'building', buildingType);
    element.textContent = getEmojiForFaction(buildingType, factionKey);
    element.style.left = `${positionBox.xMin}px`;
    element.style.top = `${positionBox.yMin}px`;
    element.style.width = `${positionBox.width}px`;
    element.style.height = `${positionBox.height}px`;

    // Dynamically get font size from a temporary element (if not already styled by a more specific class)
    // This ensures emojis scale somewhat with the building size if generic .building styles are used.
    if (!element.style.fontSize && buildingType !== 'farm') { // Farms are special
        const tempStyleCheck = document.createElement('div');
        tempStyleCheck.classList.add(buildingType); // Assumes CSS class for building type exists for font-size
        gameWorld.appendChild(tempStyleCheck); // gameWorld from main-ui-input.js
        element.style.fontSize = window.getComputedStyle(tempStyleCheck).fontSize;
        gameWorld.removeChild(tempStyleCheck);
    }
    
    element.dataset.buildingId = id;
    element.dataset.buildingType = buildingType;
    element.dataset.faction = factionKey;

    let pbContainer = null, pbInner = null;
    if (buildingStaticData.trains) {
        const { container, inner } = createProgressBarElement(); // from main-ui-input.js
        element.appendChild(container);
        pbContainer = container;
        pbInner = inner;
        if (pbContainer) pbContainer.style.display = 'none';
    }
    const { hpContainer, hpInnerElem } = createHpBarElement(); // Renamed to avoid conflict in destructuring
    element.appendChild(hpContainer);
    
    gameWorld.appendChild(element);

    const buildingData = {
        id: id,
        buildingType: buildingType,
        element: element, // This will be null for completed farms
        box: getElementWorldBoundingBox(element), // from main-ui-input.js
        isConstructing: !isConstructed,
        isBase: isBase,
        faction: factionKey,
        hp: isConstructed ? buildingStaticData.hp : buildingStaticData.hp * 0.1, // Construction sites start with low HP
        maxHp: buildingStaticData.hp,
        hpContainer: hpContainer,
        hpInner: hpInnerElem,
        provides_food: buildingStaticData.provides_food || 0,
        isTraining: false,
        trainingProgress: 0,
        trainingTotalTime: 0,
        trainingUnitType: null,
        progressBarContainer: pbContainer,
        progressBarInner: pbInner,
        // Combat stats for buildings like Guard Tower
        attackRange: buildingStaticData.attackRange || 0,
        attackDamage: buildingStaticData.attackDamage || 0,
        attackSpeed: buildingStaticData.attackSpeed || 0,
        lastAttackTime: 0
    };

    if (buildingType === 'farm' && isConstructed) {
        // Farm "building" itself is conceptual after construction; individual tiles are visual.
        buildingData.element = null; 
        buildingData.hpContainer = null; 
        buildingData.hpInner = null; 
        // Remove the single placeholder div used for sizing/positioning the farm group.
        if (element.parentNode === gameWorld) gameWorld.removeChild(element); 

        for (let i = 0; i < FARM_GRID_DIM * FARM_GRID_DIM; i++) {
            const tile = document.createElement('div');
            tile.classList.add('game-object', 'building', 'farm', 'farm-tile');
            tile.textContent = getEmojiForFaction('farm', factionKey);
            const dx = i % FARM_GRID_DIM;
            const dy = Math.floor(i / FARM_GRID_DIM);
            const tileX = positionBox.xMin + dx * FARM_TILE_SIZE;
            const tileY = positionBox.yMin + dy * FARM_TILE_SIZE;
            placeElementInWorld(tile, tileX, tileY);
            tile.style.width = `${FARM_TILE_SIZE}px`;
            tile.style.height = `${FARM_TILE_SIZE}px`;
            tile.style.fontSize = `${FARM_TILE_SIZE * 0.9}px`; // Approximate scaling
            gameWorld.appendChild(tile);
            // Note: these tiles are not individually added to the `buildings` array or made selectable.
            // The `buildingData` object for the farm group represents the whole farm.
        }
    } else {
         updateHpBar(buildingData); // from main-ui-input.js
    }

    // Make non-farm player buildings clickable
    if (buildingType !== 'farm' && ((gameMode === 'human_vs_ai' && factionKey === playerFactionKey) || 
                                   (gameMode === 'ai_vs_ai' && factionKey === playerFactionKey))) { // p1 AI buildings
        element.addEventListener('click', (e) => { e.stopPropagation(); handleBuildingClick(buildingData); });
    } else if (buildingType !== 'farm' && gameMode === 'human_vs_ai' && factionKey !== playerFactionKey) { // Clickable enemy buildings
        element.addEventListener('click', (e) => { e.stopPropagation(); handleBuildingClick(buildingData); });
    }

    buildings.push(buildingData); // Add to global buildings array from game-state.js
    if (isBase) {
        if (factionKey === playerFactionKey) playerBaseData = buildingData; // from game-state.js
        else opponentBaseData = buildingData; // from game-state.js
    }
    return buildingData;
}


/**
 * Creates a construction site visual and data object.
 * @param {string} buildingType - The type of building being constructed.
 * @param {object} box - The bounding box {xMin, yMin, width, height} for placement.
 * @param {string} forFaction - The faction owning the construction.
 * @param {object|null} byWorker - The worker unit that initiated construction (can be null).
 * @returns {object|null} The construction site data object or null.
 */
function createConstructionSite(buildingType, box, forFaction, byWorker) {
    const id = `cons-${constructionIdCounter++}`; // constructionIdCounter from game-state.js
    const buildingStaticData = FACTION_DATA[forFaction].buildings[buildingType];
    if (!buildingStaticData) { console.error("GAME_LOGIC: No static data for construction: " + buildingType); return null; }

    const elem = document.createElement('div');
    elem.id = id;
    elem.classList.add('game-object', 'building', 'construction-site', buildingType);
    elem.textContent = getEmojiForFaction(buildingType, forFaction); 
    elem.dataset.constructionId = id;
    elem.dataset.buildingType = buildingType;
    elem.dataset.faction = forFaction;
    elem.style.left = `${box.xMin}px`; elem.style.top = `${box.yMin}px`;
    elem.style.width = `${box.width}px`; elem.style.height = `${box.height}px`;

    // Set font size based on the final building's class (for emoji scaling)
    const tempFinal = document.createElement('div');
    tempFinal.classList.add(buildingType); // Assumes CSS class for building type exists
    gameWorld.appendChild(tempFinal);
    elem.style.fontSize = window.getComputedStyle(tempFinal).fontSize;
    gameWorld.removeChild(tempFinal);

    if(buildingType === 'farm') elem.style.opacity = 0.2; // Farms look different under construction

    const { container: pC, inner: pBI } = createProgressBarElement(); // from main-ui-input.js
    elem.appendChild(pC);
    if(pC) pC.style.display = 'none'; // Initially hide progress bar
    const { hpContainer, hpInnerElem } = createHpBarElement(); // from main-ui-input.js
    elem.appendChild(hpContainer);
    
    // Allow clicking on enemy construction sites to see info (or potentially attack)
    if (gameMode === 'human_vs_ai' && forFaction !== playerFactionKey) {
        elem.addEventListener('click', (e) => { 
            e.stopPropagation(); 
            // Find the actual construction data object to pass to handleBuildingClick
            const consDataObj = constructions.find(c => c.id === id);
            if (consDataObj) handleBuildingClick(consDataObj); // handleBuildingClick from main-ui-input.js
        });
    }
    gameWorld.appendChild(elem);

    const constructionData = {
        id: id, buildingType: buildingType, box: box, element: elem,
        isConstructing: true, assignedWorker: null, progress: 0,
        buildTime: buildingStaticData.buildTime,
        progressBarContainer: pC, progressBarInner: pBI,
        faction: forFaction,
        hp: buildingStaticData.hp * 0.1, // Start with 10% HP
        maxHp: buildingStaticData.hp, 
        hpContainer: hpContainer, hpInner: hpInnerElem
    };
    updateHpBar(constructionData); // from main-ui-input.js
    constructions.push(constructionData); // from game-state.js
    buildings.push(constructionData); // Also add to buildings array for targeting/overlap checks

    if(byWorker && byWorker.unitType === 'worker' && byWorker.faction === forFaction && byWorker.canBuild){
        assignWorkerToConstruction(constructionData, byWorker, (forFaction !== playerFactionKey || gameMode === 'ai_vs_ai'));
    }
    // UI updates are handled by the caller (e.g. updateResourceDisplay)
    return constructionData;
}


// --- Core Game Logic Functions ---

/**
 * Sets up the initial map with bases and resources.
 * Called once at the start of a game.
 */
function initializeMapAndBases() {
    gameWorld.style.width = `${WORLD_WIDTH}px`; // WORLD_WIDTH from 0_rts_menu_and_data.js
    gameWorld.style.height = `${WORLD_HEIGHT}px`; // WORLD_HEIGHT from 0_rts_menu_and_data.js

    const p1BaseStaticData = FACTION_DATA[p1FactionKey].buildings.base; // p1FactionKey from game-state.js
    const p2BaseStaticData = FACTION_DATA[p2FactionKey].buildings.base; // p2FactionKey from game-state.js

    const p1BaseBox = {
        xMin: BASE_OFFSET_X, yMin: WORLD_HEIGHT - BASE_OFFSET_Y - p1BaseStaticData.size.h,
        width: p1BaseStaticData.size.w, height: p1BaseStaticData.size.h,
        centerX: BASE_OFFSET_X + p1BaseStaticData.size.w / 2,
        centerY: WORLD_HEIGHT - BASE_OFFSET_Y - p1BaseStaticData.size.h / 2
    };
    const p2BaseBox = {
        xMin: WORLD_WIDTH - BASE_OFFSET_X - p2BaseStaticData.size.w, yMin: BASE_OFFSET_Y,
        width: p2BaseStaticData.size.w, height: p2BaseStaticData.size.h,
        centerX: WORLD_WIDTH - BASE_OFFSET_X - p2BaseStaticData.size.w / 2,
        centerY: BASE_OFFSET_Y + p2BaseStaticData.size.h / 2
    };
    
    // createBuilding is from this file (game-logic.js)
    playerBaseData = createBuilding('base', p1BaseBox, p1FactionKey, true, true);
    opponentBaseData = createBuilding('base', p2BaseBox, p2FactionKey, true, true);


    if (!playerBaseData || !opponentBaseData) {
        throw new Error("FATAL: Base creation failed during map initialization.");
    }

    const obstacles = [playerBaseData.box, opponentBaseData.box]; // Initial obstacles are the bases
    const zoneMargin = 50; // Margin from world edges for resource zones
    const p1ResourceZone = { minX: zoneMargin, maxX: WORLD_WIDTH * 0.4, minY: WORLD_HEIGHT * 0.6 - zoneMargin, maxY: WORLD_HEIGHT - zoneMargin };
    const p2ResourceZone = { minX: WORLD_WIDTH * 0.6, maxX: WORLD_WIDTH - zoneMargin, minY: zoneMargin, maxY: WORLD_HEIGHT * 0.4 + zoneMargin };
    const neutralZone = { minX: WORLD_WIDTH * 0.2, maxX: WORLD_WIDTH * 0.8, minY: WORLD_HEIGHT * 0.2, maxY: WORLD_HEIGHT * 0.8 };
    
    const startingMinesPerPlayer = 2; 
    const startingTreesPerPlayer = 30;
    const neutralMines = 3; 
    const neutralTrees = 60;
    let newlyPlacedBoxes; // To collect boxes of newly placed resources

    // Place resources for Player 1
    newlyPlacedBoxes = placeResourcesCarefully('mine', startingMinesPerPlayer, getEmojiForFaction('mine', p1FactionKey), p1ResourceZone, obstacles); 
    obstacles.push(...newlyPlacedBoxes);
    newlyPlacedBoxes = placeResourcesCarefully('tree', startingTreesPerPlayer, getEmojiForFaction('tree', p1FactionKey), p1ResourceZone, obstacles); 
    obstacles.push(...newlyPlacedBoxes);

    // Place resources for Player 2
    newlyPlacedBoxes = placeResourcesCarefully('mine', startingMinesPerPlayer, getEmojiForFaction('mine', p2FactionKey), p2ResourceZone, obstacles); 
    obstacles.push(...newlyPlacedBoxes);
    newlyPlacedBoxes = placeResourcesCarefully('tree', startingTreesPerPlayer, getEmojiForFaction('tree', p2FactionKey), p2ResourceZone, obstacles); 
    obstacles.push(...newlyPlacedBoxes);
    
    // Place neutral resources (using p1 emoji for visual consistency, could be neutral specific)
    newlyPlacedBoxes = placeResourcesCarefully('mine', neutralMines, getEmojiForFaction('mine', p1FactionKey), neutralZone, obstacles); 
    obstacles.push(...newlyPlacedBoxes);
    newlyPlacedBoxes = placeResourcesCarefully('tree', neutralTrees, getEmojiForFaction('tree', p1FactionKey), neutralZone, obstacles); 
    obstacles.push(...newlyPlacedBoxes);

    // Create initial units AFTER bases and resources are fully defined and placed.
    let p1InitialWorkerCount = (gameMode === 'ai_vs_ai' ? 2 : 1);
    for(let i=0; i<p1InitialWorkerCount; i++) {
        createUnit('worker', getSpawnPosition(playerBaseData.element, i, p1InitialWorkerCount), p1FactionKey);
    }
    
    let p2InitialWorkerCount = (gameMode === 'ai_vs_ai' || gameMode === 'human_vs_ai') ? 2 : 0; 
    if (p2InitialWorkerCount > 0 && opponentBaseData && opponentBaseData.element) {
        for(let i=0; i<p2InitialWorkerCount; i++) {
             createUnit('worker', getSpawnPosition(opponentBaseData.element, i, p2InitialWorkerCount), p2FactionKey);
        }
    }
}

/**
 * Carefully places resource nodes in a given zone, avoiding overlaps.
 * @param {string} type - 'tree' or 'mine'.
 * @param {number} count - Number of resources to place.
 * @param {string} emoji - The emoji to display for this resource.
 * @param {object} zone - {minX, maxX, minY, maxY} defining the placement area.
 * @param {Array<object>} allCurrentObstacles - Array of existing bounding boxes to avoid.
 * @returns {Array<object>} An array of bounding boxes for the newly placed resources.
 */
function placeResourcesCarefully(type, count, emoji, zone, allCurrentObstacles) {
    let elSize;
    if (type === 'mine') elSize = { w: 140, h: 140 }; // From CSS
    else if (type === 'tree') elSize = { w: 100, h: 100 }; // From CSS
    else elSize = { w: 100, h: 100 }; // Default fallback

    const resourceRadius = Math.max(elSize.w, elSize.h) / 2;
    const spacing = resourceRadius * 0.8; // Minimum spacing between centers of resources
    let placedCount = 0;
    let attempts = 0;
    const maxTotalAttempts = count * 200; // Safety break for dense maps
    const newlyPlacedBoxes = [];

    while (placedCount < count && attempts < maxTotalAttempts) {
        attempts++;
        // Calculate random position within the zone for the center of the resource
        const randX = Math.random() * (zone.maxX - zone.minX - elSize.w) + zone.minX + elSize.w / 2;
        const randY = Math.random() * (zone.maxY - zone.minY - elSize.h) + zone.minY + elSize.h / 2;

        const potentialBox = {
            xMin: randX - elSize.w / 2, yMin: randY - elSize.h / 2,
            xMax: randX + elSize.w / 2, yMax: randY + elSize.h / 2,
            width: elSize.w, height: elSize.h, centerX: randX, centerY: randY
        };

        // Check world bounds
        if(potentialBox.xMin < 0 || potentialBox.xMax > currentWorldWidth || potentialBox.yMin < 0 || potentialBox.yMax > currentWorldHeight) continue;
        // Check if it's actually within the intended placement zone (center point check)
        if(potentialBox.centerX < zone.minX || potentialBox.centerX > zone.maxX || potentialBox.centerY < zone.minY || potentialBox.centerY > zone.maxY) continue;
        
        let tooClose = false;
        for (const existingBox of allCurrentObstacles) {
            if (existingBox && checkAABBOverlap(potentialBox, existingBox, spacing)) { // checkAABBOverlap from main-ui-input.js
                tooClose = true;
                break;
            }
        }
        if (tooClose) continue;

        // Create resource element and data
        const rElement = document.createElement('div');
        rElement.classList.add('game-object', 'resource', type);
        rElement.textContent = emoji;
        const resourceId = `res-${type}-${resourceIdCounter++}`; // resourceIdCounter from game-state.js
        rElement.id = resourceId;
        rElement.style.width = `${elSize.w}px`;
        rElement.style.height = `${elSize.h}px`;
        if (type === 'mine') rElement.style.fontSize = '140px'; // Match CSS
        else if (type === 'tree') rElement.style.fontSize = '100px'; // Match CSS
        
        placeElementInWorld(rElement, potentialBox.xMin, potentialBox.yMin); // from main-ui-input.js
        gameWorld.appendChild(rElement);

        const resourceData = {
            id: resourceId,
            type: type,
            element: rElement,
            box: getElementWorldBoundingBox(rElement), // from main-ui-input.js
            health: (type === 'mine') ? MINE_HEALTH_INIT : 1 // MINE_HEALTH_INIT from 0_rts_menu_and_data.js
        };

        if (resourceData.box.width === 0) { // If getBoundingBox failed
            gameWorld.removeChild(rElement);
            attempts--; // Retry this one
            continue;
        }
        
        resources.push(resourceData); // resources from game-state.js
        allCurrentObstacles.push(resourceData.box); // Add to current obstacles for next placement
        newlyPlacedBoxes.push(resourceData.box);
        placedCount++;
    }
    if (placedCount < count) {
        console.warn(`GAME_LOGIC: Could only place ${placedCount}/${count} ${type} resources in the zone.`);
    }
    return newlyPlacedBoxes;
}

/**
 * Sets the state of a unit, updating its class list and internal properties.
 * @param {object} unit - The unit object.
 * @param {string} newState - The new state string (e.g., 'idle', 'moving', 'harvesting').
 */
function setUnitState(unit, newState) {
    if (!unit || unit.state === newState) return;
    if(unit.element) { 
        unit.element.classList.remove('error-state', unit.state); // Remove old state class
    }

    // State-specific cleanup or setup
    if (unit.state === 'harvesting') { clearTimeout(unit.harvestTimer); unit.harvestTimer = null; }
    if (unit.state === 'attacking') { unit.lastAttackTime = 0; }

    // If changing from a construction-related state, ensure unassignment
    if (newState !== 'building' && newState !== 'moving_to_build' && unit.constructionId) {
        const cons = constructions.find(c => c.id === unit.constructionId);
        if (cons && cons.assignedWorker === unit) {
            cons.assignedWorker = null;
            if(cons.element) cons.element.classList.remove('building'); // Visual cue on construction site
            if(cons.progressBarContainer) cons.progressBarContainer.style.display = 'none';
        }
        unit.constructionId = null;
    }
    unit.state = newState;
    if(unit.element) {
        unit.element.classList.add(newState); // Add new state class
        unit.element.classList.toggle('carrying', unit.state === 'returning' && unit.resourceType !== null);
    }

    if (unit.indicatorElement) {
        let indicatorEmoji = '';
        if (unit.state === 'returning' && unit.resourceType) {
            indicatorEmoji = unit.resourceType === 'wood' ? getEmojiForFaction( 'resource_wood', unit.faction) : getEmojiForFaction('resource_coal', unit.faction);
        }
        unit.indicatorElement.textContent = indicatorEmoji;
    }

    // Reset properties when becoming idle or changing tasks
    if (newState === 'idle') {
        unit.target = null; unit.targetElement = null;
        unit.lastHarvestedNodeId = null; unit.constructionId = null;
        unit.ai_tasked = false; // Reset AI tasking on idle
    } else if (newState === 'attacking') {
        unit.target = null; // Pathing target is cleared, relies on targetElement
        unit.lastAttackTime = 0;
    } else if (newState === 'retreating') {
        unit.targetElement = null; unit.resourceType = null; // Drop resources if retreating
    }
    // If the selected unit's state changes, UI might need an update
    if (gameMode === 'human_vs_ai' && unit === selectedUnit) {
        updateSelectionInfo(); // from main-ui-input.js
    }
    // updateDebugPanel(); // Usually called by a higher-level UI update function
}

/**
 * Issues a command to a unit, setting its target and state.
 * @param {object} unit - The unit to command.
 * @param {object} command - Command object, e.g., { state, target, targetElement, preferredType, constructionId }
 * @param {boolean} [triggeredByAI=false] - True if the command originated from AI.
 */
function issueCommand(unit, command, triggeredByAI = false) {
    if (!unit || unit.hp <= 0) return;
    clearTimeout(unit.harvestTimer); // Stop any current harvesting
    unit.harvestTimer = null;

    if (command.state !== 'returning') { unit.lastHarvestedNodeId = null; } // Clear last harvested unless returning

    // Set preferred resource type for workers, if specified by human player
    if (command.state === 'moving_to_resource' && command.preferredType && unit.faction === playerFactionKey && gameMode === 'human_vs_ai') {
        unit.preferredResourceType = command.preferredType;
    } else if (command.state !== 'moving_to_resource') { // Clear preference if not moving to resource
        delete unit.preferredResourceType;
    }

    // If unit was building something else, ensure it's unassigned from old construction
    if (unit.state === 'building' && unit.constructionId && unit.constructionId !== command.constructionId) {
        const oldCons = constructions.find(c => c.id === unit.constructionId);
        if (oldCons && oldCons.assignedWorker === unit) {
            oldCons.assignedWorker = null;
            if(oldCons.element) oldCons.element.classList.remove('building');
            if(oldCons.progressBarContainer) oldCons.progressBarContainer.style.display = 'none';
        }
    }
    unit.constructionId = command.constructionId || null; // Assign new construction ID if any
    unit.ai_tasked = triggeredByAI;
    unit.targetElement = command.targetElement; // DOM element of the target
    unit.target = command.target; // {x, y} world coordinates for pathing
    
    setUnitState(unit, command.state); // This updates class lists and internal state

    if (command.state !== 'returning') { // Drop resources if not returning
        unit.resourceType = null; 
        if (unit.indicatorElement) unit.indicatorElement.textContent = '';
        if (unit.element) unit.element.classList.remove('carrying');
    }
    // updateDebugPanel(); // Usually called by a higher-level UI update function
}

// --- Combat and Damage ---
/**
 * Applies damage to a target entity and handles its death.
 * @param {object} targetData - The unit or building object to damage.
 * @param {number} damage - The amount of damage to deal.
 */
function dealDamage(targetData, damage) {
    if (!targetData || targetData.hp <= 0) return; // Target already dead or invalid
    targetData.hp -= damage;
    updateHpBar(targetData); // from main-ui-input.js

    // Worker retreat logic for player
    if (gameMode === 'human_vs_ai' && 
        targetData.faction === playerFactionKey && 
        targetData.unitType === 'worker' &&
        targetData.hp > 0 && 
        (targetData.hp / targetData.maxHp) < WORKER_RETREAT_HP_PERCENT &&
        targetData.state !== 'retreating' && playerBaseData && playerBaseData.hp > 0) {
        issueCommand(targetData, { 
            state: 'retreating', 
            target: {x: playerBaseData.box.centerX, y: playerBaseData.box.centerY}
        }, false); // Not an AI command
    }

    if (targetData.hp <= 0) {
        targetData.hp = 0; // Cap HP at 0
        if (targetData.element && targetData.element.parentNode === gameWorld) {
            try { gameWorld.removeChild(targetData.element); } 
            catch (e) { console.warn("GAME_LOGIC: Error removing element of dead entity:", e); }
        }

        // If the dead entity was selected, deselect it
        if (selectedUnit === targetData) deselectAll(); // from main-ui-input.js
        if (selectedBuilding === targetData) deselectAll(); // For construction sites that were selected

        // Make any units attacking this target idle
        units.forEach(attacker => {
            if ((attacker.state === 'attacking' || attacker.state === 'moving_to_attack') && attacker.targetElement === targetData.element) {
                setUnitState(attacker, 'idle');
            }
        });

        // Remove from appropriate game arrays
        const unitIndex = units.findIndex(u => u.id === targetData.id);
        if (unitIndex > -1) {
            units.splice(unitIndex, 1);
        } else {
            const buildingIndex = buildings.findIndex(b => b.id === targetData.id);
            if (buildingIndex > -1) {
                const destroyedBuildingData = buildings[buildingIndex];
                
                // If it was a construction site, also remove from constructions array
                const consIndex = constructions.findIndex(c => c.id === targetData.id);
                if (consIndex > -1) { 
                    const worker = constructions[consIndex].assignedWorker;
                    if (worker && worker.state === 'building' && worker.constructionId === targetData.id) {
                        setUnitState(worker, 'idle'); // Make assigned worker idle
                    }
                    constructions.splice(consIndex, 1);
                }
                buildings.splice(buildingIndex, 1); // Remove from main buildings array

                if (destroyedBuildingData.isBase) {
                    checkGameOver(); // This might end the game
                }
                // Check if the building provided food
                const staticBldgData = FACTION_DATA[destroyedBuildingData.faction]?.buildings[destroyedBuildingData.buildingType];
                if (staticBldgData?.provides_food) {
                    updateResourceDisplay(); // Recalculate food capacity
                }
            }
        }
        updateResourceDisplay(); // Update current food if a unit died
        // updateDebugPanel(); // updateResourceDisplay calls updateDebugPanel
    }
}

/**
 * Checks if a game over condition has been met (e.g., a base destroyed).
 * @returns {boolean} True if the game is over, false otherwise.
 */
function checkGameOver() {
    if (gameOver) return true; // Game is already over

    const p1HasBase = buildings.some(b => b.isBase && b.faction === p1FactionKey && b.hp > 0);
    const p2HasBase = buildings.some(b => b.isBase && b.faction === p2FactionKey && b.hp > 0);
    let winner = null;

    if (gameInitialized) { // Only check if game has properly started
        if (!p2HasBase && p1HasBase) {
            winner = p1FactionKey;
        } else if (!p1HasBase && p2HasBase) {
            winner = p2FactionKey;
        } else if (!p1HasBase && !p2HasBase) {
            winner = "Draw"; // Or could be based on last one standing if units remain
        }
    }

    if (winner) {
        gameOver = true; // Set global from game-state.js
        showGameOver(winner); // showGameOver is in main-ui-input.js
        return true;
    }
    return false;
}

// --- Resource Gathering & Construction Callbacks/Processes ---
function handleHarvestComplete(unit, resourceData) { /* ... (Same as previous full code) ... */ }
function handleDepositResource(unit) { /* ... (Same as previous full code) ... */ }
function assignWorkerToConstruction(constructionData, unit, triggeredByAI = false) { /* ... (Same as previous full code) ... */ }
function startWorkerBuilding(unit, constructionData) { /* ... (Same as previous full code) ... */ }
function completeConstruction(constructionData) { /* ... (Same as previous full code, ensure it calls createBuilding for the final step) ... */ }
function completeAnyUnitTraining(buildingData) { /* ... (Same as previous full code, ensure it calls createUnit) ... */ }

// --- AI Logic ---
function findAndTargetNearestResource(unit, resourceClassType, specificNode = null, triggeredByAI = false) { /* ... (Same as previous full code) ... */ }
function findNearestResource(unit, resourceClassType) { /* ... (Same as previous full code) ... */ }
function aiCanAffordGeneric(factionKey, itemType, isUnit, woodRes, coalRes, foodRes, foodCap) { /* ... (Same as previous full code) ... */ }
function aiStartConstructionGeneric(factionKey, type, box, assignedWorker) { /* ... (Same as previous full code) ... */ }
function aiTryBuildGeneric(factionKey, factionBaseData, buildingType, builderUnit) { /* ... (Same as previous full code) ... */ }
function updateSingleAI(currentAIFactionKey) { /* ... (Same as previous full code, ensure it uses factionAiUpdateCounters from game-state.js) ... */ }


// --- Main Game Loop ---
function gameLoop(timestamp) {
    if (currentGameState !== 'in_game' || gameOver) {
        if (gameInitialized || currentGameState !== 'start_modal') {
            requestAnimationFrame(gameLoop); 
        }
        return;
    }

    const deltaTime = (lastTimestamp > 0) ? Math.min(50, timestamp - lastTimestamp) : 16.67; 
    lastTimestamp = timestamp; 
    const deltaFactor = deltaTime / 16.67; 
    
    // Camera Panning (from main-ui-input.js state)
    let dxPan = 0, dyPan = 0; 
    if (keysPressed.w || keysPressed.arrowup) dyPan += PAN_SPEED; 
    if (keysPressed.s || keysPressed.arrowdown) dyPan -= PAN_SPEED; 
    if (keysPressed.a || keysPressed.arrowleft) dxPan += PAN_SPEED; 
    if (keysPressed.d || keysPressed.arrowright) dxPan -= PAN_SPEED; 
    if (dxPan !== 0 || dyPan !== 0) { 
        viewOffsetX += dxPan * deltaFactor; 
        viewOffsetY += dyPan * deltaFactor; 
        clampCamera(); // from main-ui-input.js
        applyTransform(); // from main-ui-input.js
    } 
    
    // Update Units
    units.forEach(unit => {
        if (!unit.element || !unit.element.isConnected || unit.hp <= 0) return;
        updateHpBar(unit); // from main-ui-input.js
        let targetPos = unit.target;
        const isMovingState = unit.state === 'moving' || unit.state === 'moving_to_resource' || unit.state === 'returning' || unit.state === 'moving_to_build' || unit.state === 'moving_to_attack' || unit.state === 'retreating';

        // Update target for returning/retreating units to their base
        if (unit.state === 'returning' || unit.state === 'retreating') {
            const targetBase = unit.faction === playerFactionKey ? playerBaseData : opponentBaseData;
            if (targetBase && targetBase.box && targetBase.hp > 0) {
                targetPos = { x: targetBase.box.centerX, y: targetBase.box.centerY };
                unit.target = targetPos; // Update unit's pathing target
            } else {
                setUnitState(unit, 'idle'); return; // No base to return to
            }
        }

        // Update target for units moving to attack (dynamic target re-evaluation)
        if (unit.state === 'moving_to_attack' && unit.targetElement) {
            const targetData = units.find(u => u.element === unit.targetElement && u.hp > 0) || 
                             buildings.find(b => b.element === unit.targetElement && b.hp > 0);
            if (targetData) {
                const targetBox = getElementWorldBoundingBox(targetData.element);
                // Simple targeting: move towards center. Could be improved to form a concave arc.
                targetPos = { x: targetBox.centerX, y: targetBox.centerY };
                unit.target = targetPos;
            } else { // Target died or disappeared while moving
                setUnitState(unit, 'idle'); return;
            }
        }
        
        // Unit Movement Logic
        if (isMovingState && targetPos) {
            const moveDx = targetPos.x - unit.worldX;
            const moveDy = targetPos.y - unit.worldY;
            const distSqToTarget = moveDx * moveDx + moveDy * moveDy;
            let arrivalThresholdSq = (unit.speed * 1.5) ** 2; 
            let targetInRange = false;

            // Check if in attack range when moving to attack
            if (unit.state === 'moving_to_attack' && unit.targetElement && unit.attackRange > 0) {
                const targetData = units.find(u => u.element === unit.targetElement && u.hp > 0) || 
                                 buildings.find(b => b.element === unit.targetElement && b.hp > 0);
                if (targetData && targetData.faction !== unit.faction) {
                    const targetBox = getElementWorldBoundingBox(targetData.element);
                    const distToTargetCenterSq = distanceSq({x: unit.worldX, y: unit.worldY}, {x: targetBox.centerX, y: targetBox.centerY});
                    // Approximate distance to edge of target
                    const targetRadiusApproximation = Math.min(targetBox.width, targetBox.height) / 2;
                    const distToTargetEdgeApprox = Math.max(0, Math.sqrt(distToTargetCenterSq) - targetRadiusApproximation);
                    
                    if (distToTargetEdgeApprox <= unit.attackRange + ATTACK_RANGE_TOLERANCE) {
                        targetInRange = true;
                        // No need to adjust arrivalThresholdSq here, just switch to 'attacking' state
                    }
                } else { // Target invalid or friendly
                    setUnitState(unit, 'idle'); return;
                }
            }

            if (unit.state === 'moving_to_attack' && targetInRange) {
                setUnitState(unit, 'attacking');
                unit.target = null; // Stop pathing, rely on attack logic for positioning/range
            } else if (distSqToTarget > arrivalThresholdSq) {
                const dist = Math.sqrt(distSqToTarget);
                const moveFactor = unit.speed * deltaFactor;
                unit.worldX += (moveDx / dist) * moveFactor;
                unit.worldY += (moveDy / dist) * moveFactor;
                placeElementInWorld(unit.element, unit.worldX - unit.element.offsetWidth / 2, unit.worldY - unit.element.offsetHeight / 2);
                if (unit.ai_tasked && unit.state !== 'moving_to_attack' && unit.state !== 'moving_to_build') {
                    unit.ai_tasked = false; // Mark AI task as "in progress but not yet complete"
                }
            } else { // Arrived at destination
                const previousState = unit.state;
                const arrivedAtElement = unit.targetElement;
                unit.target = null; // Clear pathing target

                if (previousState === 'moving_to_resource') {
                    const resourceData = resources.find(r => r.element === arrivedAtElement);
                    if (resourceData && resourceData.element?.isConnected && !(resourceData.type === 'mine' && resourceData.health <= 0)) {
                        unit.resourceType = resourceData.type === 'tree' ? 'wood' : 'coal';
                        setUnitState(unit, 'harvesting');
                        const harvestTime = resourceData.type === 'tree' ? TREE_HARVEST_TIME : MINE_HARVEST_TIME;
                        clearTimeout(unit.harvestTimer);
                        unit.harvestTimer = setTimeout(() => handleHarvestComplete(unit, resourceData), harvestTime);
                    } else { // Resource gone or invalid
                        findAndTargetNearestResource(unit, (arrivedAtElement?.classList.contains('mine') ? 'mine' : 'tree'), null, (unit.faction !== playerFactionKey || gameMode === 'ai_vs_ai'));
                    }
                } else if (previousState === 'returning') {
                    handleDepositResource(unit);
                    // handleDepositResource will issue the next command
                } else if (previousState === 'retreating') {
                    setUnitState(unit, 'idle');
                } else if (previousState === 'moving_to_build') {
                    const consData = constructions.find(c => c.id === unit.constructionId);
                    if (consData && consData.isConstructing && consData.assignedWorker === unit && consData.element === arrivedAtElement) {
                        startWorkerBuilding(unit, consData);
                    } else { // Construction site gone or reassigned
                        setUnitState(unit, 'idle'); unit.constructionId = null; unit.targetElement = null;
                    }
                } else if (previousState === 'moving') {
                    setUnitState(unit, 'idle');
                    unit.targetElement = null;
                } else if (previousState === 'moving_to_attack') { // Arrived at attack-move location
                    const targetData = units.find(u => u.element === arrivedAtElement && u.hp > 0) || 
                                     buildings.find(b => b.element === arrivedAtElement && b.hp > 0);
                    if (targetData && targetData.faction !== unit.faction) {
                        setUnitState(unit, 'attacking'); // Switch to attack state
                    } else { // Target gone or became friendly
                        setUnitState(unit, 'idle'); unit.targetElement = null;
                    }
                }
            }
        }
        
        // Unit Attack Logic
        if (unit.state === 'attacking' && unit.attackDamage > 0) {
            const targetData = units.find(u => u.element === unit.targetElement && u.hp > 0) || 
                             buildings.find(b => b.element === unit.targetElement && b.hp > 0);
            
            if (!targetData || targetData.faction === unit.faction || !targetData.element?.isConnected) {
                setUnitState(unit, 'idle'); // Target invalid, stop attacking
            } else {
                const targetBox = getElementWorldBoundingBox(targetData.element);
                const distSqToEnemy = distanceSq({x: unit.worldX, y: unit.worldY}, {x: targetBox.centerX, y: targetBox.centerY});
                const targetRadiusApproximation = Math.min(targetBox.width, targetBox.height) / 2;
                const distToTargetEdgeApprox = Math.max(0, Math.sqrt(distSqToEnemy) - targetRadiusApproximation);

                if (distToTargetEdgeApprox > unit.attackRange + ATTACK_RANGE_TOLERANCE) {
                    // Target moved out of range, chase it (issue a new move_to_attack command)
                    issueCommand(unit, { 
                        state: 'moving_to_attack', 
                        target: { x: targetBox.centerX, y: targetBox.centerY }, 
                        targetElement: targetData.element 
                    }, (unit.faction !== playerFactionKey || gameMode === 'ai_vs_ai'));
                } else { // In range, perform attack
                    if (!unit.lastAttackTime || timestamp - unit.lastAttackTime >= unit.attackSpeed) {
                        dealDamage(targetData, unit.attackDamage);
                        unit.lastAttackTime = timestamp;
                    }
                }
            }
        }
    });
    
    // Update Buildings (training, tower attacks)
    buildings.forEach(bldg => { 
        updateHpBar(bldg); 
        if (!bldg.isConstructing && bldg.isTraining && bldg.trainingTotalTime > 0) {
            bldg.trainingProgress += deltaTime;
            const progressPercent = Math.min(100, (bldg.trainingProgress / bldg.trainingTotalTime) * 100);
            if (bldg.progressBarInner) bldg.progressBarInner.style.width = `${progressPercent}%`;
            if (bldg.progressBarContainer && bldg.progressBarContainer.style.display === 'none') {
                bldg.progressBarContainer.style.display = 'block';
            }
            if (bldg.trainingProgress >= bldg.trainingTotalTime) {
                completeAnyUnitTraining(bldg);
            }
        }
        // Basic Tower Attack Logic (can be expanded)
        if (!bldg.isConstructing && bldg.buildingType === 'guard_tower' && bldg.attackDamage > 0 && bldg.hp > 0) {
            if (!bldg.lastAttackTime || timestamp - bldg.lastAttackTime >= bldg.attackSpeed) {
                let closestEnemy = null;
                let minDistSq = bldg.attackRange * bldg.attackRange;
                const towerPos = { x: bldg.box.centerX, y: bldg.box.centerY };

                units.forEach(unit => {
                    if (unit.hp > 0 && unit.faction !== bldg.faction) {
                        const unitPos = { x: unit.worldX, y: unit.worldY };
                        const dSq = distanceSq(towerPos, unitPos);
                        if (dSq < minDistSq) {
                            minDistSq = dSq;
                            closestEnemy = unit;
                        }
                    }
                });
                if (closestEnemy) {
                    dealDamage(closestEnemy, bldg.attackDamage);
                    bldg.lastAttackTime = timestamp;
                    // TODO: Add visual effect for tower attack
                }
            }
        }
    });
    
    // Update Constructions
    for (let i = constructions.length - 1; i >= 0; i--) { 
        const cons = constructions[i];
        if (!cons.isConstructing || !cons.element || !cons.element.isConnected) {
            // This might happen if it was completed and removed in the same loop by another process
            // Or if element somehow got detached. Consider removing from constructions array if problematic.
            continue;
        }
        updateHpBar(cons); 
        const worker = cons.assignedWorker; 
        let isBuildingByWorker = false; 
        if (worker && worker.state === 'building' && worker.constructionId === cons.id) { 
            isBuildingByWorker = true; 
            cons.progress += deltaTime; 
            const hpGain = (cons.maxHp / cons.buildTime) * deltaTime; 
            cons.hp = Math.min(cons.maxHp, cons.hp + hpGain); 
            updateHpBar(cons); 
        } 
        if (cons.progressBarInner) { 
            const progressPercent = Math.min(100, (cons.progress / cons.buildTime) * 100); 
            cons.progressBarInner.style.width = `${progressPercent}%`; 
            if(cons.progressBarContainer) cons.progressBarContainer.style.display = isBuildingByWorker ? 'block' : 'none'; 
        } 
        if(cons.element) cons.element.classList.toggle('building', isBuildingByWorker); 
        if (cons.progress >= cons.buildTime) { 
            completeConstruction(cons); // This will remove it from constructions array
        } 
    }
    
    // AI Updates
    aiGlobalUpdateCounter++;
    if (gameMode === 'ai_vs_ai') {
        if (aiGlobalUpdateCounter % 2 === 0) updateSingleAI(p1FactionKey); // Stagger AI
        else updateSingleAI(p2FactionKey);
    } else if (gameMode === 'human_vs_ai') { // Only P2 is AI
        updateSingleAI(p2FactionKey);
    }
    
    if (!gameOver && checkGameOver()) { return; } // Game over might have been triggered
    
    if (isDebugVisible) updateDebugPanel(); // from main-ui-input.js
    
    requestAnimationFrame(gameLoop);
}
