// js/game-logic.js
// Contains the core game simulation logic: entity creation/management,
// AI behavior, combat resolution, resource gathering processes,
// construction progress, and the main game loop.

"use strict";

// Note: This file assumes that variables from 'game-data.js' (like FACTION_DATA, WORLD_WIDTH, UNIT_SPEED)
// and 'game-state.js' (like units, buildings, p1Wood, selectedUnit) are globally accessible
// due to script load order. It also assumes helper functions from 'main.js' (like updateHpBar,
// placeElementInWorld, getElementWorldBoundingBox, etc.) are globally accessible.

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
    element.textContent = getEmojiForFaction(unitType, factionKey); 
    
    const unit = {
        id: `unit-${unitIdCounter++}`, 
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
        speed: UNIT_SPEED, 
        hpContainer: null, hpInner: null,
        progressBarContainer: null, progressBarInner: null,
    };

    const indicator = document.createElement('div');
    indicator.classList.add('carrying-indicator');
    element.appendChild(indicator);
    unit.indicatorElement = indicator;

    const { hpContainer, hpInnerElem } = createHpBarElement(); // from main.js
    element.appendChild(hpContainer);
    unit.hpContainer = hpContainer;
    unit.hpInner = hpInnerElem; // Corrected from previous typo
    updateHpBar(unit); // from main.js

    gameWorld.appendChild(element); // gameWorld from main.js
    const unitSize = 36; 
    placeElementInWorld(element, unit.worldX - unitSize / 2, unit.worldY - unitSize / 2); // from main.js
    element.classList.add('idle'); 
    element.dataset.unitId = unit.id;
    element.dataset.faction = factionKey;
    
    if (gameMode === 'human_vs_ai' && factionKey === playerFactionKey) { 
        element.addEventListener('click', (e) => { e.stopPropagation(); handleUnitClick(unit); }); // handleUnitClick from main.js
    }
    
    units.push(unit); 
    return unit;
}

/**
 * Creates a new building (or farm tiles) and adds it to the game.
 * This is for *completed* buildings or the initial setup of bases.
 * Construction sites are handled by createConstructionSite.
 */
function createBuilding(buildingType, positionBox, factionKey, isBase = false, isConstructed = true) {
    const buildingFactionData = FACTION_DATA[factionKey];
    if (!buildingFactionData) { console.error(`GAME_LOGIC: No faction data for ${factionKey} in createBuilding`); return null; }
    const buildingStaticData = buildingFactionData.buildings[buildingType];
    if (!buildingStaticData) { console.error(`GAME_LOGIC: No building data for ${buildingType} in ${factionKey}`); return null; }

    const element = document.createElement('div');
    const id = `bldg-${buildingIdCounter++}`;
    element.id = id;
    element.classList.add('game-object', 'building', buildingType);
    element.textContent = getEmojiForFaction(buildingType, factionKey);
    element.style.left = `${positionBox.xMin}px`;
    element.style.top = `${positionBox.yMin}px`;
    element.style.width = `${positionBox.width}px`;
    element.style.height = `${positionBox.height}px`;

    if (buildingType !== 'farm') { // Farms don't need dynamic font sizing for a single placeholder
        const tempStyleCheck = document.createElement('div');
        tempStyleCheck.classList.add(buildingType); 
        gameWorld.appendChild(tempStyleCheck);
        element.style.fontSize = window.getComputedStyle(tempStyleCheck).fontSize;
        gameWorld.removeChild(tempStyleCheck);
    }
    
    element.dataset.buildingId = id;
    element.dataset.buildingType = buildingType;
    element.dataset.faction = factionKey;

    let pbContainer = null, pbInner = null;
    if (buildingStaticData.trains) {
        const { container, inner } = createProgressBarElement();
        element.appendChild(container);
        pbContainer = container;
        pbInner = inner;
        if (pbContainer) pbContainer.style.display = 'none';
    }
    const { hpContainer, hpInnerElem } = createHpBarElement(); 
    element.appendChild(hpContainer);
    
    // Add to DOM only if not a conceptual farm group post-construction
    if (!(buildingType === 'farm' && isConstructed)) {
        gameWorld.appendChild(element);
    }

    const buildingData = {
        id: id,
        buildingType: buildingType,
        element: (buildingType === 'farm' && isConstructed) ? null : element, 
        box: (buildingType === 'farm' && isConstructed) ? positionBox : getElementWorldBoundingBox(element), 
        isConstructing: !isConstructed, // Will be false if isConstructed is true
        isBase: isBase,
        faction: factionKey,
        hp: buildingStaticData.hp, // Completed buildings start at full HP
        maxHp: buildingStaticData.hp,
        hpContainer: (buildingType === 'farm' && isConstructed) ? null : hpContainer,
        hpInner: (buildingType === 'farm' && isConstructed) ? null : hpInnerElem,
        provides_food: buildingStaticData.provides_food || 0,
        isTraining: false, trainingProgress: 0, trainingTotalTime: 0, trainingUnitType: null,
        progressBarContainer: pbContainer, progressBarInner: pbInner,
        attackRange: buildingStaticData.attackRange || 0,
        attackDamage: buildingStaticData.attackDamage || 0,
        attackSpeed: buildingStaticData.attackSpeed || 0,
        lastAttackTime: 0,
        tileElements: [] // For farm tiles
    };

    if (buildingType === 'farm' && isConstructed) {
        if (element.parentNode === gameWorld) gameWorld.removeChild(element); // Remove the placeholder if it was added
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
            tile.style.fontSize = `${FARM_TILE_SIZE * 0.9}px`; 
            gameWorld.appendChild(tile);
            buildingData.tileElements.push(tile); // Store farm tiles if needed for later removal
        }
    } else {
         updateHpBar(buildingData);
    }

    if (buildingData.element && buildingType !== 'farm') { // Add click listener only if there's a main element
      if (((gameMode === 'human_vs_ai' || gameMode === 'ai_vs_ai') && factionKey === playerFactionKey) ||
          (gameMode === 'human_vs_ai' && factionKey !== playerFactionKey) ) {
          buildingData.element.addEventListener('click', (e) => { e.stopPropagation(); handleBuildingClick(buildingData); });
      }
    }

    buildings.push(buildingData);
    if (isBase) {
        if (factionKey === playerFactionKey) playerBaseData = buildingData;
        else opponentBaseData = buildingData;
    }
    return buildingData;
}

/**
 * Creates a construction site visual and data object.
 */
function createConstructionSite(buildingType, box, forFaction, byWorker) {
    const id = `cons-${constructionIdCounter++}`;
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

    const tempFinal = document.createElement('div');
    tempFinal.classList.add(buildingType);
    gameWorld.appendChild(tempFinal);
    elem.style.fontSize = window.getComputedStyle(tempFinal).fontSize;
    gameWorld.removeChild(tempFinal);

    if(buildingType === 'farm') elem.style.opacity = 0.2;

    const { container: pC, inner: pBI } = createProgressBarElement();
    elem.appendChild(pC);
    if(pC) pC.style.display = 'none'; 
    const { hpContainer, hpInnerElem } = createHpBarElement();
    elem.appendChild(hpContainer);
    
    // Allow clicking on ANY construction site to see info (player or enemy)
    elem.addEventListener('click', (e) => { 
        e.stopPropagation(); 
        const consDataObj = constructions.find(c => c.id === id) || buildings.find(b => b.id === id && b.isConstructing); // Check both arrays
        if (consDataObj) handleBuildingClick(consDataObj); 
    });
    gameWorld.appendChild(elem);

    const constructionData = {
        id: id, buildingType: buildingType, box: box, element: elem,
        isConstructing: true, assignedWorker: null, progress: 0,
        buildTime: buildingStaticData.buildTime,
        progressBarContainer: pC, progressBarInner: pBI,
        faction: forFaction,
        hp: buildingStaticData.hp * 0.1, maxHp: buildingStaticData.hp, 
        hpContainer: hpContainer, hpInner: hpInnerElem
    };
    updateHpBar(constructionData);
    constructions.push(constructionData);
    buildings.push(constructionData); 

    if(byWorker && byWorker.unitType === 'worker' && byWorker.faction === forFaction && byWorker.canBuild){
        assignWorkerToConstruction(constructionData, byWorker, (forFaction !== playerFactionKey || gameMode === 'ai_vs_ai'));
    }
    return constructionData;
}


// --- Core Game Logic Functions ---
function initializeMapAndBases() {
    gameWorld.style.width = `${WORLD_WIDTH}px`; 
    gameWorld.style.height = `${WORLD_HEIGHT}px`;

    const p1BaseStaticData = FACTION_DATA[p1FactionKey].buildings.base;
    const p2BaseStaticData = FACTION_DATA[p2FactionKey].buildings.base;

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
    
    playerBaseData = createBuilding('base', p1BaseBox, p1FactionKey, true, true);
    opponentBaseData = createBuilding('base', p2BaseBox, p2FactionKey, true, true);

    if (!playerBaseData || !opponentBaseData) {
        throw new Error("FATAL: Base creation failed during map initialization.");
    }

    const obstacles = [playerBaseData.box, opponentBaseData.box]; 
    const zoneMargin = 50; 
    const p1ResourceZone = { minX: zoneMargin, maxX: WORLD_WIDTH * 0.4, minY: WORLD_HEIGHT * 0.6 - zoneMargin, maxY: WORLD_HEIGHT - zoneMargin };
    const p2ResourceZone = { minX: WORLD_WIDTH * 0.6, maxX: WORLD_WIDTH - zoneMargin, minY: zoneMargin, maxY: WORLD_HEIGHT * 0.4 + zoneMargin };
    const neutralZone = { minX: WORLD_WIDTH * 0.2, maxX: WORLD_WIDTH * 0.8, minY: WORLD_HEIGHT * 0.2, maxY: WORLD_HEIGHT * 0.8 };
    
    const startingMinesPerPlayer = 2; const startingTreesPerPlayer = 30;
    const neutralMines = 3; const neutralTrees = 60;
    let newlyPlacedBoxes; 

    newlyPlacedBoxes = placeResourcesCarefully('mine', startingMinesPerPlayer, getEmojiForFaction('mine', p1FactionKey), p1ResourceZone, obstacles); obstacles.push(...newlyPlacedBoxes);
    newlyPlacedBoxes = placeResourcesCarefully('tree', startingTreesPerPlayer, getEmojiForFaction('tree', p1FactionKey), p1ResourceZone, obstacles); obstacles.push(...newlyPlacedBoxes);
    newlyPlacedBoxes = placeResourcesCarefully('mine', startingMinesPerPlayer, getEmojiForFaction('mine', p2FactionKey), p2ResourceZone, obstacles); obstacles.push(...newlyPlacedBoxes);
    newlyPlacedBoxes = placeResourcesCarefully('tree', startingTreesPerPlayer, getEmojiForFaction('tree', p2FactionKey), p2ResourceZone, obstacles); obstacles.push(...newlyPlacedBoxes);
    newlyPlacedBoxes = placeResourcesCarefully('mine', neutralMines, getEmojiForFaction('mine', p1FactionKey), neutralZone, obstacles); 
    obstacles.push(...newlyPlacedBoxes);
    newlyPlacedBoxes = placeResourcesCarefully('tree', neutralTrees, getEmojiForFaction('tree', p1FactionKey), neutralZone, obstacles); 
    obstacles.push(...newlyPlacedBoxes);

    let p1InitialWorkerCount = (gameMode === 'ai_vs_ai' ? 2 : 1);
    for(let i=0; i<p1InitialWorkerCount; i++) {
        if (playerBaseData && playerBaseData.element) {
            createUnit('worker', getSpawnPosition(playerBaseData.element, i, p1InitialWorkerCount), p1FactionKey);
        } else { console.error("P1 Base element missing for initial worker spawn."); }
    }
    
    let p2InitialWorkerCount = (gameMode === 'ai_vs_ai' || gameMode === 'human_vs_ai') ? 2 : 0; 
    if (p2InitialWorkerCount > 0 && opponentBaseData && opponentBaseData.element) {
        for(let i=0; i<p2InitialWorkerCount; i++) {
             createUnit('worker', getSpawnPosition(opponentBaseData.element, i, p2InitialWorkerCount), p2FactionKey);
        }
    }
}

function placeResourcesCarefully(type, count, emoji, zone, allCurrentObstacles) { /* ... (Same as previous full code) ... */ }
function setUnitState(unit, newState) { /* ... (Same as previous full code) ... */ }
function issueCommand(unit, command, triggeredByAI = false) { /* ... (Same as previous full code) ... */ }
function dealDamage(targetData, damage) { /* ... (Same as previous full code) ... */ }
function checkGameOver() { /* ... (Same as previous full code) ... */ }
function handleHarvestComplete(unit, resourceData) { /* ... (Same as previous full code) ... */ }
function handleDepositResource(unit) { /* ... (Same as previous full code) ... */ }
function findAndTargetNearestResource(unit, resourceClassType, specificNode = null, triggeredByAI = false) { /* ... (Same as previous full code) ... */ }
function assignWorkerToConstruction(constructionData, unit, triggeredByAI = false) { /* ... (Same as previous full code) ... */ }
function startWorkerBuilding(unit, constructionData) { /* ... (Same as previous full code) ... */ }
function completeConstruction(constructionData) { /* ... (Same as previous full code, ensure it calls createBuilding for the final step and handles selectedBuilding update if it was the construction site) ... */ }
function completeAnyUnitTraining(buildingData) { /* ... (Same as previous full code, ensure it calls createUnit) ... */ }
function aiCanAffordGeneric(factionKey, itemType, isUnit, woodRes, coalRes, foodRes, foodCap) { /* ... (Same as previous full code) ... */ }
function aiStartConstructionGeneric(factionKey, type, box, assignedWorker) { /* ... (Same as previous full code) ... */ }
function aiTryBuildGeneric(factionKey, factionBaseData, buildingType, builderUnit) { /* ... (Same as previous full code) ... */ }
function updateSingleAI(currentAIFactionKey) { /* ... (Same as previous full code, using factionAiUpdateCounters from game-state.js) ... */ }
function getSpawnPosition(buildingElement, index, totalUnitsOfType = 1) { /* ... (Same as previous full code) ... */ }
function findNearestResource(unit, resourceClassType) { /* ... (Same as previous full code) ... */ }


// --- Main Game Loop ---
function gameLoop(timestamp) {
    if (currentGameState !== 'in_game' || gameOver) { // currentGameState from game-state.js
        if (gameInitialized || currentGameState !== 'start_modal') { // gameInitialized from game-state.js
            requestAnimationFrame(gameLoop); 
        }
        return;
    }

    const deltaTime = (lastTimestamp > 0) ? Math.min(50, timestamp - lastTimestamp) : 16.67; // lastTimestamp from game-state.js
    lastTimestamp = timestamp; 
    const deltaFactor = deltaTime / 16.67; 
    
    // Camera Panning (state from game-state.js, functions from main.js)
    let dxPan = 0, dyPan = 0; 
    if (keysPressed.w || keysPressed.arrowup) dyPan += PAN_SPEED; 
    if (keysPressed.s || keysPressed.arrowdown) dyPan -= PAN_SPEED; 
    if (keysPressed.a || keysPressed.arrowleft) dxPan += PAN_SPEED; 
    if (keysPressed.d || keysPressed.arrowright) dxPan -= PAN_SPEED; 
    if (dxPan !== 0 || dyPan !== 0) { 
        viewOffsetX += dxPan * deltaFactor; 
        viewOffsetY += dyPan * deltaFactor; 
        clampCamera(); 
        applyTransform(); 
    } 
    
    // Update Units
    units.forEach(unit => { // units from game-state.js
        if (!unit.element || !unit.element.isConnected || unit.hp <= 0) return;
        updateHpBar(unit); // from main.js
        let targetPos = unit.target;
        const isMovingState = unit.state === 'moving' || unit.state === 'moving_to_resource' || unit.state === 'returning' || unit.state === 'moving_to_build' || unit.state === 'moving_to_attack' || unit.state === 'retreating';

        if (unit.state === 'returning' || unit.state === 'retreating') {
            const targetBase = unit.faction === playerFactionKey ? playerBaseData : opponentBaseData;
            if (targetBase && targetBase.box && targetBase.hp > 0) {
                targetPos = { x: targetBase.box.centerX, y: targetBase.box.centerY };
                unit.target = targetPos; 
            } else {
                setUnitState(unit, 'idle'); return; 
            }
        }

        if (unit.state === 'moving_to_attack' && unit.targetElement) {
            const targetData = units.find(u => u.element === unit.targetElement && u.hp > 0) || 
                             buildings.find(b => b.element === unit.targetElement && b.hp > 0);
            if (targetData) {
                const targetBox = getElementWorldBoundingBox(targetData.element);
                targetPos = { x: targetBox.centerX, y: targetBox.centerY }; // Simplified target for attack-move
                unit.target = targetPos;
            } else { 
                setUnitState(unit, 'idle'); return;
            }
        }
        
        if (isMovingState && targetPos) {
            const moveDx = targetPos.x - unit.worldX;
            const moveDy = targetPos.y - unit.worldY;
            const distSqToTarget = moveDx * moveDx + moveDy * moveDy;
            let arrivalThresholdSq = (unit.speed * 1.5) ** 2; 
            let targetInRange = false;

            if (unit.state === 'moving_to_attack' && unit.targetElement && unit.attackRange > 0) {
                const targetData = units.find(u => u.element === unit.targetElement && u.hp > 0) || 
                                 buildings.find(b => b.element === unit.targetElement && b.hp > 0);
                if (targetData && targetData.faction !== unit.faction) {
                    const targetBox = getElementWorldBoundingBox(targetData.element);
                    const distToTargetCenterSq = distanceSq({x: unit.worldX, y: unit.worldY}, {x: targetBox.centerX, y: targetBox.centerY});
                    const targetRadiusApproximation = Math.min(targetBox.width, targetBox.height) / 2;
                    const distToTargetEdgeApprox = Math.max(0, Math.sqrt(distToTargetCenterSq) - targetRadiusApproximation);
                    
                    if (distToTargetEdgeApprox <= unit.attackRange + ATTACK_RANGE_TOLERANCE) {
                        targetInRange = true;
                    }
                } else { 
                    setUnitState(unit, 'idle'); return;
                }
            }

            if (unit.state === 'moving_to_attack' && targetInRange) {
                setUnitState(unit, 'attacking');
                unit.target = null; 
            } else if (distSqToTarget > arrivalThresholdSq) {
                const dist = Math.sqrt(distSqToTarget);
                const moveFactor = unit.speed * deltaFactor;
                unit.worldX += (moveDx / dist) * moveFactor;
                unit.worldY += (moveDy / dist) * moveFactor;
                placeElementInWorld(unit.element, unit.worldX - unit.element.offsetWidth / 2, unit.worldY - unit.element.offsetHeight / 2);
                if (unit.ai_tasked && unit.state !== 'moving_to_attack' && unit.state !== 'moving_to_build') {
                    unit.ai_tasked = false; 
                }
            } else { 
                const previousState = unit.state;
                const arrivedAtElement = unit.targetElement;
                unit.target = null; 

                if (previousState === 'moving_to_resource') {
                    const resourceData = resources.find(r => r.element === arrivedAtElement);
                    if (resourceData && resourceData.element?.isConnected && !(resourceData.type === 'mine' && resourceData.health <= 0)) {
                        unit.resourceType = resourceData.type === 'tree' ? 'wood' : 'coal';
                        setUnitState(unit, 'harvesting');
                        const harvestTime = resourceData.type === 'tree' ? TREE_HARVEST_TIME : MINE_HARVEST_TIME;
                        clearTimeout(unit.harvestTimer);
                        unit.harvestTimer = setTimeout(() => handleHarvestComplete(unit, resourceData), harvestTime);
                    } else { 
                        findAndTargetNearestResource(unit, (arrivedAtElement?.classList.contains('mine') ? 'mine' : 'tree'), null, (unit.faction !== playerFactionKey || gameMode === 'ai_vs_ai'));
                    }
                } else if (previousState === 'returning') {
                    handleDepositResource(unit);
                } else if (previousState === 'retreating') {
                    setUnitState(unit, 'idle');
                } else if (previousState === 'moving_to_build') {
                    const consData = constructions.find(c => c.id === unit.constructionId);
                    if (consData && consData.isConstructing && consData.assignedWorker === unit && consData.element === arrivedAtElement) {
                        startWorkerBuilding(unit, consData);
                    } else { 
                        setUnitState(unit, 'idle'); unit.constructionId = null; unit.targetElement = null;
                    }
                } else if (previousState === 'moving') {
                    setUnitState(unit, 'idle');
                    unit.targetElement = null;
                } else if (previousState === 'moving_to_attack') { 
                    const targetData = units.find(u => u.element === arrivedAtElement && u.hp > 0) || 
                                     buildings.find(b => b.element === arrivedAtElement && b.hp > 0);
                    if (targetData && targetData.faction !== unit.faction) {
                        setUnitState(unit, 'attacking'); 
                    } else { 
                        setUnitState(unit, 'idle'); unit.targetElement = null;
                    }
                }
            }
        }
        
        if (unit.state === 'attacking' && unit.attackDamage > 0) { /* ... (Same as previous full code) ... */ }
    });
    
    buildings.forEach(bldg => { /* ... (Same as previous full code, including tower attack logic) ... */ });
    for (let i = constructions.length - 1; i >= 0; i--) { /* ... (Same as previous full code) ... */ }
    
    aiGlobalUpdateCounter++;
    if (gameMode === 'ai_vs_ai') {
        if (aiGlobalUpdateCounter % 2 === 0) updateSingleAI(p1FactionKey);
        else updateSingleAI(p2FactionKey);
    } else if (gameMode === 'human_vs_ai') {
        updateSingleAI(p2FactionKey);
    }
    
    if (!gameOver && checkGameOver()) { return; } 
    
    if (isDebugVisible) updateDebugPanel(); 
    
    requestAnimationFrame(gameLoop);
}

// --- Placeholder for functions that were in previous single file, ensure they are here or in main.js if UI related ---
// Example: trainUnit would be here, as it's core game logic.
/**
 * Initiates training a unit in a building.
 * @param {string} unitType - The type of unit to train.
 * @param {object} trainingBuilding - The building object that will train the unit.
 */
function trainUnit(unitType, trainingBuilding) {
    const factionKey = trainingBuilding.faction;
    const unitStaticData = FACTION_DATA[factionKey]?.units[unitType];
    const buildingStaticData = FACTION_DATA[factionKey]?.buildings[trainingBuilding.buildingType];

    if (!unitStaticData || !trainingBuilding || trainingBuilding.isTraining || 
        !buildingStaticData?.trains || buildingStaticData.trains !== unitType) {
        // console.warn("GAME_LOGIC: Cannot train unit. Invalid data, building busy, or wrong unit type for building.");
        return;
    }

    const cost = unitStaticData.cost;
    let currentResWood = factionKey === playerFactionKey ? p1Wood : p2Wood;
    let currentResCoal = factionKey === playerFactionKey ? p1Coal : p2Coal;
    let currentFactionFood = factionKey === playerFactionKey ? p1CurrentFood : p2CurrentFood;
    let currentFactionFoodCap = factionKey === playerFactionKey ? p1FoodCapacity : p2FoodCapacity;

    if (currentResWood < (cost.wood || 0) || currentResCoal < (cost.coal || 0)) {
        // console.log(`GAME_LOGIC: Not enough resources for ${factionKey} to train ${unitType}`);
        if (factionKey === playerFactionKey && isDebugVisible) showTemporaryMessage(`Not enough resources for ${unitType}!`);
        return;
    }
    if (currentFactionFood + unitStaticData.foodCost > currentFactionFoodCap) {
        // console.log(`GAME_LOGIC: Not enough food capacity for ${factionKey} to train ${unitType}`);
        if (factionKey === playerFactionKey && isDebugVisible) showTemporaryMessage(`Not enough food for ${unitType}!`);
        return;
    }

    // Deduct resources
    if (factionKey === playerFactionKey) {
        p1Wood -= (cost.wood || 0);
        p1Coal -= (cost.coal || 0);
    } else {
        p2Wood -= (cost.wood || 0);
        p2Coal -= (cost.coal || 0);
    }
    updateResourceDisplay(); // In main.js - this will update for the current player

    trainingBuilding.isTraining = true;
    trainingBuilding.trainingUnitType = unitType;
    trainingBuilding.trainingProgress = 0;
    trainingBuilding.trainingTotalTime = unitStaticData.trainTime;

    if (trainingBuilding.progressBarInner) trainingBuilding.progressBarInner.style.width = '0%';
    if (trainingBuilding.progressBarContainer) trainingBuilding.progressBarContainer.style.display = 'block';
    if (trainingBuilding.element) trainingBuilding.element.classList.add('training');

    if (gameMode === 'human_vs_ai' && factionKey === playerFactionKey) {
        updateCommandCard(); // In main.js
        updateSelectionInfo(); // In main.js
    }
    // updateDebugPanel(); // Called by updateResourceDisplay
}
