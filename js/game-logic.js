// js/game-logic.js
// Contains the core game simulation logic: entity creation/management,
// AI behavior, combat resolution, resource gathering processes,
// construction progress, and the main game loop.

"use strict";

// Note: This file assumes that variables from 'game-data.js' (like FACTION_DATA, WORLD_WIDTH, UNIT_SPEED)
// and 'game-state.js' (like units, buildings, p1Wood, selectedUnit) are globally accessible
// due to script load order. It also assumes helper functions from 'main.js' (like updateHpBar,
// placeElementInWorld, getElementWorldBoundingBox, etc.) are globally accessible.


/**
 * Calculates the squared distance between two points.
 * Avoids a square root operation if only comparing distances.
 * @param {object} pos1 - {x, y}
 * @param {object} pos2 - {x, y}
 * @returns {number} The squared distance.
 */
function distanceSq(pos1, pos2) {
    if (!pos1 || !pos2 || typeof pos1.x !== 'number' || typeof pos1.y !== 'number' || typeof pos2.x !== 'number' || typeof pos2.y !== 'number') {
        console.error("GAME_LOGIC: Invalid input to distanceSq", pos1, pos2);
        return Infinity; // Return a large number to avoid breaking further logic if possible
    }
    const dx = pos1.x - pos2.x;
    const dy = pos1.y - pos2.y;
    return dx * dx + dy * dy;
}

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

    const { hpContainer, hpInnerElem } = createHpBarElement(); 
    element.appendChild(hpContainer);
    unit.hpContainer = hpContainer;
    unit.hpInner = hpInnerElem; 
    updateHpBar(unit); 

    gameWorld.appendChild(element); 
    const unitSize = 36; 
    placeElementInWorld(element, unit.worldX - unitSize / 2, unit.worldY - unitSize / 2); 
    element.classList.add('idle'); 
    element.dataset.unitId = unit.id;
    element.dataset.faction = factionKey;
    
    if (gameMode === 'human_vs_ai' && factionKey === playerFactionKey) { 
        element.addEventListener('click', (e) => { e.stopPropagation(); handleUnitClick(unit); }); 
    }
    
    units.push(unit); 
    return unit;
}

/**
 * Creates a new building (or farm tiles) and adds it to the game.
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

    if (buildingType !== 'farm') { 
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
    
    if (!(buildingType === 'farm' && isConstructed)) {
        gameWorld.appendChild(element);
    }

    const buildingData = {
        id: id,
        buildingType: buildingType,
        element: (buildingType === 'farm' && isConstructed) ? null : element, 
        box: (buildingType === 'farm' && isConstructed) ? positionBox : getElementWorldBoundingBox(element), 
        isConstructing: !isConstructed, 
        isBase: isBase,
        faction: factionKey,
        hp: buildingStaticData.hp, 
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
        tileElements: [] 
    };

    if (buildingType === 'farm' && isConstructed) {
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
            tile.style.fontSize = `${FARM_TILE_SIZE * 0.9}px`; 
            gameWorld.appendChild(tile);
            buildingData.tileElements.push(tile); 
        }
    } else {
         updateHpBar(buildingData); 
    }

    if (buildingData.element && buildingType !== 'farm') { 
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
    
    elem.addEventListener('click', (e) => { 
        e.stopPropagation(); 
        const consDataObj = constructions.find(c => c.id === id) || buildings.find(b => b.id === id && b.isConstructing);
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
/**
 * Sets up the initial map with bases and resources.
 */
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
        throw new Error("GAME_LOGIC: FATAL - Base creation failed during map initialization.");
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
        } else { console.error("GAME_LOGIC: P1 Base element missing for initial worker spawn."); }
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
 */
function placeResourcesCarefully(type, count, emoji, zone, allCurrentObstacles) {
    let elSize;
    if (type === 'mine') elSize = { w: 140, h: 140 }; 
    else if (type === 'tree') elSize = { w: 100, h: 100 }; 
    else elSize = { w: 100, h: 100 }; 

    const resourceRadius = Math.max(elSize.w, elSize.h) / 2;
    const spacing = resourceRadius * 0.8; 
    let placedCount = 0;
    let attempts = 0;
    const maxTotalAttempts = count * 200; 
    const newlyPlacedBoxes = [];

    while (placedCount < count && attempts < maxTotalAttempts) {
        attempts++;
        const randX = Math.random() * (zone.maxX - zone.minX - elSize.w) + zone.minX + elSize.w / 2;
        const randY = Math.random() * (zone.maxY - zone.minY - elSize.h) + zone.minY + elSize.h / 2;

        const potentialBox = {
            xMin: randX - elSize.w / 2, yMin: randY - elSize.h / 2,
            xMax: randX + elSize.w / 2, yMax: randY + elSize.h / 2,
            width: elSize.w, height: elSize.h, centerX: randX, centerY: randY
        };

        if(potentialBox.xMin < 0 || potentialBox.xMax > currentWorldWidth || potentialBox.yMin < 0 || potentialBox.yMax > currentWorldHeight) continue;
        if(potentialBox.centerX < zone.minX || potentialBox.centerX > zone.maxX || potentialBox.centerY < zone.minY || potentialBox.centerY > zone.maxY) continue;
        
        let tooClose = false;
        for (const existingBox of allCurrentObstacles) {
            if (existingBox && checkAABBOverlap(potentialBox, existingBox, spacing)) { 
                tooClose = true;
                break;
            }
        }
        if (tooClose) continue;

        const rElement = document.createElement('div');
        rElement.classList.add('game-object', 'resource', type);
        rElement.textContent = emoji;
        const resourceId = `res-${type}-${resourceIdCounter++}`; 
        rElement.id = resourceId;
        rElement.style.width = `${elSize.w}px`;
        rElement.style.height = `${elSize.h}px`;
        if (type === 'mine') rElement.style.fontSize = '140px'; 
        else if (type === 'tree') rElement.style.fontSize = '100px'; 
        
        placeElementInWorld(rElement, potentialBox.xMin, potentialBox.yMin); 
        gameWorld.appendChild(rElement);

        const resourceData = {
            id: resourceId,
            type: type,
            element: rElement,
            box: getElementWorldBoundingBox(rElement), 
            health: (type === 'mine') ? MINE_HEALTH_INIT : 1 
        };

        if (resourceData.box.width === 0) { 
            gameWorld.removeChild(rElement);
            attempts--; 
            continue;
        }
        
        resources.push(resourceData); 
        allCurrentObstacles.push(resourceData.box); 
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
 */
function setUnitState(unit, newState) {
    if (!unit || unit.state === newState) return;
    if(unit.element) { 
        unit.element.classList.remove('error-state', unit.state); 
    }

    if (unit.state === 'harvesting') { clearTimeout(unit.harvestTimer); unit.harvestTimer = null; }
    if (unit.state === 'attacking') { unit.lastAttackTime = 0; }

    if (newState !== 'building' && newState !== 'moving_to_build' && unit.constructionId) {
        const cons = constructions.find(c => c.id === unit.constructionId);
        if (cons && cons.assignedWorker === unit) {
            cons.assignedWorker = null;
            if(cons.element) cons.element.classList.remove('building'); 
            if(cons.progressBarContainer) cons.progressBarContainer.style.display = 'none';
        }
        unit.constructionId = null;
    }
    unit.state = newState;
    if(unit.element) {
        unit.element.classList.add(newState); 
        unit.element.classList.toggle('carrying', unit.state === 'returning' && unit.resourceType !== null);
    }

    if (unit.indicatorElement) {
        let indicatorEmoji = '';
        if (unit.state === 'returning' && unit.resourceType) {
            indicatorEmoji = unit.resourceType === 'wood' ? getEmojiForFaction( 'resource_wood', unit.faction) : getEmojiForFaction('resource_coal', unit.faction);
        }
        unit.indicatorElement.textContent = indicatorEmoji;
    }

    if (newState === 'idle') {
        unit.target = null; unit.targetElement = null;
        unit.lastHarvestedNodeId = null; unit.constructionId = null;
        unit.ai_tasked = false; 
    } else if (newState === 'attacking') {
        unit.target = null; 
        unit.lastAttackTime = 0;
    } else if (newState === 'retreating') {
        unit.targetElement = null; unit.resourceType = null; 
    }
    if (gameMode === 'human_vs_ai' && unit === selectedUnit) {
        updateSelectionInfo(); 
    }
}

/**
 * Issues a command to a unit, setting its target and state.
 */
function issueCommand(unit, command, triggeredByAI = false) {
    if (!unit || unit.hp <= 0) return;
    clearTimeout(unit.harvestTimer); 
    unit.harvestTimer = null;

    if (command.state !== 'returning') { unit.lastHarvestedNodeId = null; } 

    if (command.state === 'moving_to_resource' && command.preferredType && unit.faction === playerFactionKey && gameMode === 'human_vs_ai') {
        unit.preferredResourceType = command.preferredType;
    } else if (command.state !== 'moving_to_resource') { 
        delete unit.preferredResourceType;
    }

    if (unit.state === 'building' && unit.constructionId && unit.constructionId !== command.constructionId) {
        const oldCons = constructions.find(c => c.id === unit.constructionId);
        if (oldCons && oldCons.assignedWorker === unit) {
            oldCons.assignedWorker = null;
            if(oldCons.element) oldCons.element.classList.remove('building');
            if(oldCons.progressBarContainer) oldCons.progressBarContainer.style.display = 'none';
        }
    }
    unit.constructionId = command.constructionId || null; 
    unit.ai_tasked = triggeredByAI;
    unit.targetElement = command.targetElement; 
    unit.target = command.target; 
    
    setUnitState(unit, command.state); 

    if (command.state !== 'returning') { 
        unit.resourceType = null; 
        if (unit.indicatorElement) unit.indicatorElement.textContent = '';
        if (unit.element) unit.element.classList.remove('carrying');
    }
}

// --- Combat and Damage ---
function dealDamage(targetData, damage) {
    if (!targetData || targetData.hp <= 0) return; 
    targetData.hp -= damage;
    updateHpBar(targetData); 

    if (gameMode === 'human_vs_ai' && 
        targetData.faction === playerFactionKey && 
        targetData.unitType === 'worker' &&
        targetData.hp > 0 && 
        (targetData.hp / targetData.maxHp) < WORKER_RETREAT_HP_PERCENT &&
        targetData.state !== 'retreating' && playerBaseData && playerBaseData.hp > 0) {
        issueCommand(targetData, { 
            state: 'retreating', 
            target: {x: playerBaseData.box.centerX, y: playerBaseData.box.centerY}
        }, false); 
    }

    if (targetData.hp <= 0) {
        targetData.hp = 0; 
        if (targetData.element && targetData.element.parentNode === gameWorld) {
            try { gameWorld.removeChild(targetData.element); } 
            catch (e) { console.warn("GAME_LOGIC: Error removing element of dead entity:", e); }
        }

        if (selectedUnit === targetData) deselectAll(); 
        if (selectedBuilding === targetData) deselectAll(); 

        units.forEach(attacker => {
            if ((attacker.state === 'attacking' || attacker.state === 'moving_to_attack') && attacker.targetElement === targetData.element) {
                setUnitState(attacker, 'idle');
            }
        });

        const unitIndex = units.findIndex(u => u.id === targetData.id);
        if (unitIndex > -1) {
            units.splice(unitIndex, 1);
        } else {
            const buildingIndex = buildings.findIndex(b => b.id === targetData.id);
            if (buildingIndex > -1) {
                const destroyedBuildingData = buildings[buildingIndex];
                
                const consIndex = constructions.findIndex(c => c.id === targetData.id);
                if (consIndex > -1) { 
                    const worker = constructions[consIndex].assignedWorker;
                    if (worker && worker.state === 'building' && worker.constructionId === targetData.id) {
                        setUnitState(worker, 'idle'); 
                    }
                    constructions.splice(consIndex, 1);
                }
                buildings.splice(buildingIndex, 1); 

                if (destroyedBuildingData.isBase) {
                    checkGameOver(); 
                }
                const staticBldgData = FACTION_DATA[destroyedBuildingData.faction]?.buildings[destroyedBuildingData.buildingType];
                if (staticBldgData?.provides_food) {
                    updateResourceDisplay(); 
                }
            }
        }
        updateResourceDisplay(); 
    }
}

function checkGameOver() {
    if (gameOver) return true; 

    const p1HasBase = buildings.some(b => b.isBase && b.faction === p1FactionKey && b.hp > 0);
    const p2HasBase = buildings.some(b => b.isBase && b.faction === p2FactionKey && b.hp > 0);
    let winner = null;

    if (gameInitialized) { 
        if (!p2HasBase && p1HasBase) {
            winner = p1FactionKey;
        } else if (!p1HasBase && p2HasBase) {
            winner = p2FactionKey;
        } else if (!p1HasBase && !p2HasBase) {
            winner = "Draw"; 
        }
    }

    if (winner) {
        setGameOver(true); 
        showGameOver(winner); 
        return true;
    }
    return false;
}

// --- Resource Gathering & Construction Callbacks/Processes ---
function handleHarvestComplete(unit, resourceData) {
    if (!unit || unit.state !== 'harvesting' || !resourceData || !resourceData.element?.isConnected) {
        if (unit && unit.state === 'harvesting') setUnitState(unit, 'idle');
        return;
    }
    unit.harvestTimer = null;
    let harvestedType = null;
    const nodeId = resourceData.id;

    if (resourceData.type === 'tree') {
        resourceData.health = 0; 
        harvestedType = 'wood';
        if (resourceData.element.parentNode === gameWorld) {
            try { gameWorld.removeChild(resourceData.element); } catch(e) {}
        }
        resources = resources.filter(r => r.id !== nodeId);
    } else if (resourceData.type === 'mine') {
        if (resourceData.health > 0) {
            resourceData.health--;
            harvestedType = 'coal';
            if (resourceData.health <= 0) {
                resourceData.element.classList.add('depleting');
                setTimeout(() => {
                    if (resourceData.element?.isConnected && resourceData.element.parentNode === gameWorld) {
                        try { gameWorld.removeChild(resourceData.element); } catch(e) {}
                    }
                    resources = resources.filter(r => r.id !== nodeId);
                }, 500); 
            }
        }
    }

    if (harvestedType) {
        unit.resourceType = harvestedType;
        unit.lastHarvestedNodeId = nodeId;
        const targetBase = unit.faction === playerFactionKey ? playerBaseData : opponentBaseData;
        if (targetBase && targetBase.hp > 0) {
             issueCommand(unit, { state: 'returning', target: {x:targetBase.box.centerX, y:targetBase.box.centerY}, targetElement: targetBase.element });
        } else {
            setUnitState(unit, 'idle'); 
        }
    } else { 
        let nextPreferredType = unit.preferredResourceType || (resourceData.type === 'tree' ? 'mine' : 'tree');
        findAndTargetNearestResource(unit, nextPreferredType, null, (unit.faction !== playerFactionKey || gameMode === 'ai_vs_ai'));
        unit.targetElement = null; 
    }
}

function handleDepositResource(unit) {
    const returnedType = unit.resourceType;
    const lastNodeId = unit.lastHarvestedNodeId;
    let deposited = false;

    const targetBase = unit.faction === playerFactionKey ? playerBaseData : opponentBaseData;
    if (!targetBase || targetBase.hp <= 0) {
        setUnitState(unit, 'idle'); 
        return;
    }

    if (unit.faction === playerFactionKey) {
        if (returnedType === 'wood') { p1Wood++; deposited = true; }
        else if (returnedType === 'coal') { p1Coal++; deposited = true; }
    } else { 
        if (returnedType === 'wood') { p2Wood++; deposited = true; }
        else if (returnedType === 'coal') { p2Coal++; deposited = true; }
    }

    if(deposited) updateResourceDisplay(); 

    unit.resourceType = null;
    if (unit.indicatorElement) unit.indicatorElement.textContent = '';
    if (unit.element) unit.element.classList.remove('carrying');

    let nextTargetNode = null;
    const searchType = unit.preferredResourceType || (returnedType === 'wood' ? 'tree' : 'mine');
    
    if (searchType === 'mine' && lastNodeId) {
        nextTargetNode = resources.find(r => r.id === lastNodeId && r.element?.isConnected && r.health > 0);
    }
    if (!nextTargetNode) { 
        nextTargetNode = findNearestResource(unit, searchType);
    }
    if (!nextTargetNode && unit.preferredResourceType) { 
        nextTargetNode = findNearestResource(unit, searchType === 'tree' ? 'mine' : 'tree');
    }

    if (nextTargetNode) {
        findAndTargetNearestResource(unit, nextTargetNode.type, nextTargetNode, (unit.faction !== playerFactionKey || gameMode === 'ai_vs_ai'));
    } else {
        setUnitState(unit, 'idle'); 
    }
}

function findAndTargetNearestResource(unit, resourceClassType, specificNode = null, triggeredByAI = false) {
    const nodeToTarget = specificNode || findNearestResource(unit, resourceClassType);
    if (nodeToTarget && nodeToTarget.element && nodeToTarget.element.isConnected) {
        const targetBox = nodeToTarget.box || getElementWorldBoundingBox(nodeToTarget.element);
        if (targetBox.width > 0) {
            issueCommand(unit, { 
                state: 'moving_to_resource', 
                target: { x: targetBox.centerX, y: targetBox.centerY }, 
                targetElement: nodeToTarget.element, 
                preferredType: resourceClassType 
            }, triggeredByAI);
            return true;
        } else {
            setUnitState(unit, 'idle'); 
        }
    } else {
        setUnitState(unit, 'idle'); 
    }
    return false;
}

function assignWorkerToConstruction(constructionData, unit, triggeredByAI = false) {
    if (constructionData.assignedWorker && constructionData.assignedWorker !== unit) {
        const oldWorker = constructionData.assignedWorker;
        if (oldWorker.state === 'building' && oldWorker.constructionId === constructionData.id) {
            setUnitState(oldWorker, 'idle');
        }
    } else if (constructionData.assignedWorker === unit) {
        return; 
    }

    if (unit.constructionId && unit.constructionId !== constructionData.id) {
        const otherCons = constructions.find(c => c.id === unit.constructionId);
        if (otherCons && otherCons.assignedWorker === unit) {
            otherCons.assignedWorker = null;
            if(otherCons.element) otherCons.element.classList.remove('building');
            if(otherCons.progressBarContainer) otherCons.progressBarContainer.style.display = 'none';
        }
    }

    constructionData.assignedWorker = unit;
    unit.constructionId = constructionData.id;
    const unitSize = 36; 
    const targetX = constructionData.box.xMin + constructionData.box.width / 2;
    const targetY = constructionData.box.yMin + constructionData.box.height + unitSize / 2 + COLLISION_PADDING;
    issueCommand(unit, { 
        state: 'moving_to_build', 
        target: { x: targetX, y: targetY }, 
        targetElement: constructionData.element,
        constructionId: constructionData.id 
    }, triggeredByAI);
}

function startWorkerBuilding(unit, constructionData) {
    if (unit.constructionId === constructionData.id && constructionData.assignedWorker === unit) {
        setUnitState(unit, 'building');
        if(constructionData.element) constructionData.element.classList.add('building');
        if (constructionData.progressBarContainer) constructionData.progressBarContainer.style.display = 'block';
    }
}

function completeConstruction(constructionData) {
    const buildingType = constructionData.buildingType;
    const buildingFaction = constructionData.faction;
    const buildingStaticData = FACTION_DATA[buildingFaction].buildings[buildingType];
    if (!buildingStaticData) { console.error("GAME_LOGIC: Cannot complete construction, no static data for " + buildingType); return; }

    const buildingIndex = buildings.findIndex(b => b.id === constructionData.id);
    if (buildingIndex === -1) { console.error("GAME_LOGIC: Cannot find construction " + constructionData.id + " in buildings array to complete."); return; }
    
    if(constructionData.element && constructionData.element.parentNode === gameWorld) {
        try { gameWorld.removeChild(constructionData.element); } catch(e) {}
    }
    
    const newBuilding = createBuilding(buildingType, constructionData.box, buildingFaction, buildingStaticData.isBase || false, true);
    
    if (newBuilding) {
        newBuilding.id = constructionData.id; 
        if(newBuilding.element && buildingType !== 'farm') newBuilding.element.id = constructionData.id; 
        buildings[buildingIndex] = newBuilding; 

        if (selectedBuilding === constructionData) { 
            setSelectedBuilding(newBuilding); 
            updateCommandCard(); 
        }
    } else {
        console.error("GAME_LOGIC: Failed to create final building for " + buildingType);
        buildings.splice(buildingIndex, 1); 
    }

    const worker = constructionData.assignedWorker;
    if (worker && worker.constructionId === constructionData.id && worker.state === 'building') {
        setUnitState(worker, 'idle');
        worker.constructionId = null;
    }

    const consIndex = constructions.findIndex(c => c.id === constructionData.id);
    if (consIndex > -1) {
        constructions.splice(consIndex, 1);
    }

    updateResourceDisplay(); 
    if (gameMode === 'human_vs_ai' && buildingFaction === playerFactionKey && buildingType !== 'farm') {
        // updateCommandCard handled by setSelectedBuilding if selection changes
    }
}

function completeAnyUnitTraining(buildingData) {
    const unitTypeToSpawn = buildingData.trainingUnitType;
    const factionKey = buildingData.faction;
    if (!unitTypeToSpawn) return;

    const existingUnitsOfFaction = units.filter(u => u.faction === factionKey).length;
    const spawnPos = getSpawnPosition(buildingData.element, existingUnitsOfFaction, 5); 
    
    const newUnit = createUnit(unitTypeToSpawn, spawnPos, factionKey); 
    if (newUnit && (factionKey === p2FactionKey || (factionKey === p1FactionKey && gameMode === 'ai_vs_ai'))) {
        if ((newUnit.unitType === 'soldier' || newUnit.unitType === 'archer') && opponentBaseData && opponentBaseData.hp > 0) {
             issueCommand(newUnit, { 
                state: 'moving_to_attack', 
                target: { x: opponentBaseData.box.centerX, y: opponentBaseData.box.centerY }, 
                targetElement: opponentBaseData.element 
            }, true);
        } else {
            setUnitState(newUnit, 'idle'); 
        }
    }

    buildingData.isTraining = false;
    buildingData.trainingUnitType = null;
    buildingData.trainingProgress = 0;
    buildingData.trainingTotalTime = 0;
    if (buildingData.progressBarInner) buildingData.progressBarInner.style.width = '0%';
    if (buildingData.progressBarContainer) buildingData.progressBarContainer.style.display = 'none';
    if (buildingData.element) buildingData.element.classList.remove('training');

    if (gameMode === 'human_vs_ai' && buildingData.faction === playerFactionKey) {
        updateCommandCard(); 
        updateSelectionInfo(); 
    }
    updateResourceDisplay(); 
}

/**
 * Initiates training a unit in a building.
 */
function trainUnit(unitType, trainingBuilding) {
    const factionKey = trainingBuilding.faction;
    const unitStaticData = FACTION_DATA[factionKey]?.units[unitType];
    const buildingStaticData = FACTION_DATA[factionKey]?.buildings[trainingBuilding.buildingType];

    if (!unitStaticData || !trainingBuilding || trainingBuilding.isTraining || 
        !buildingStaticData?.trains || buildingStaticData.trains !== unitType) {
        if(typeof isDebugVisible !== 'undefined' && isDebugVisible) console.warn("GAME_LOGIC: Cannot train unit. Invalid data, building busy, or wrong unit type for building.");
        return;
    }

    const cost = unitStaticData.cost;
    let currentResWood = factionKey === playerFactionKey ? p1Wood : p2Wood;
    let currentResCoal = factionKey === playerFactionKey ? p1Coal : p2Coal;
    let currentFactionFood = factionKey === playerFactionKey ? p1CurrentFood : p2CurrentFood;
    let currentFactionFoodCap = factionKey === playerFactionKey ? p1FoodCapacity : p2FoodCapacity;

    if (currentResWood < (cost.wood || 0) || currentResCoal < (cost.coal || 0)) {
        if (factionKey === playerFactionKey && typeof showTemporaryMessage === 'function') showTemporaryMessage(`Not enough resources for ${unitType}!`);
        return;
    }
    if (currentFactionFood + unitStaticData.foodCost > currentFactionFoodCap) {
        if (factionKey === playerFactionKey && typeof showTemporaryMessage === 'function') showTemporaryMessage(`Not enough food for ${unitType}!`);
        return;
    }

    if (factionKey === playerFactionKey) {
        p1Wood -= (cost.wood || 0);
        p1Coal -= (cost.coal || 0);
    } else { 
        p2Wood -= (cost.wood || 0);
        p2Coal -= (cost.coal || 0);
    }
    if (typeof updateResourceDisplay === 'function') updateResourceDisplay(); 

    trainingBuilding.isTraining = true;
    trainingBuilding.trainingUnitType = unitType;
    trainingBuilding.trainingProgress = 0;
    trainingBuilding.trainingTotalTime = unitStaticData.trainTime;

    if (trainingBuilding.progressBarInner) trainingBuilding.progressBarInner.style.width = '0%';
    if (trainingBuilding.progressBarContainer) trainingBuilding.progressBarContainer.style.display = 'block';
    if (trainingBuilding.element) trainingBuilding.element.classList.add('training');

    if (gameMode === 'human_vs_ai' && factionKey === playerFactionKey) {
        if (typeof updateCommandCard === 'function') updateCommandCard(); 
        if (typeof updateSelectionInfo === 'function') updateSelectionInfo(); 
    }
}


// --- AI Logic ---
function aiCanAffordGeneric(factionKey, itemType, isUnit, woodRes, coalRes, foodRes, foodCap) {
    const itemDataContainer = isUnit ? FACTION_DATA[factionKey]?.units : FACTION_DATA[factionKey]?.buildings;
    if (!itemDataContainer) return false;
    const itemStaticData = itemDataContainer[itemType];
    if (!itemStaticData || !itemStaticData.cost) return false;

    const cost = itemStaticData.cost;
    if (woodRes < (cost.wood || 0) || coalRes < (cost.coal || 0)) return false;
    
    if (isUnit) {
        if (!itemStaticData.foodCost) return true; 
        if (foodRes + itemStaticData.foodCost > foodCap) return false;
    }
    return true;
}

function aiStartConstructionGeneric(factionKey, type, box, assignedWorker) {
    const cost = FACTION_DATA[factionKey].buildings[type].cost;
    if (factionKey === p1FactionKey) { 
        p1Wood -= (cost.wood || 0);
        p1Coal -= (cost.coal || 0);
    } else { 
        p2Wood -= (cost.wood || 0);
        p2Coal -= (cost.coal || 0);
    }
    return createConstructionSite(type, box, factionKey, assignedWorker);
}

function aiTryBuildGeneric(factionKey, factionBaseData, buildingType, builderUnit) {
    if (!factionBaseData || !factionBaseData.box || !builderUnit || !builderUnit.canBuild) return false;
    const buildingStaticData = FACTION_DATA[factionKey].buildings[buildingType];
    if (!buildingStaticData) return false;

    const baseBox = factionBaseData.box;
    const size = buildingStaticData.size;
    let attempts = 0;
    const MAX_ATTEMPTS = 50;
    const PLACEMENT_RADIUS_MIN = Math.max(baseBox.width, baseBox.height) / 2 + Math.max(size.w, size.h) / 2 + 30;
    const PLACEMENT_RADIUS_MAX = PLACEMENT_RADIUS_MIN + 250;

    while (attempts < MAX_ATTEMPTS) {
        attempts++;
        const angle = Math.random() * 2 * Math.PI;
        const radius = Math.random() * (PLACEMENT_RADIUS_MAX - PLACEMENT_RADIUS_MIN) + PLACEMENT_RADIUS_MIN;
        const potentialX = baseBox.centerX + Math.cos(angle) * radius;
        const potentialY = baseBox.centerY + Math.sin(angle) * radius;
        const potentialBox = {
            xMin: potentialX - size.w / 2, yMin: potentialY - size.h / 2,
            xMax: potentialX + size.w / 2, yMax: potentialY + size.h / 2,
            width: size.w, height: size.h, centerX: potentialX, centerY: potentialY
        };

        if (potentialBox.xMin < 0 || potentialBox.xMax > currentWorldWidth || potentialBox.yMin < 0 || potentialBox.yMax > currentWorldHeight) continue;
        
        let overlaps = resources.some(r => r.element?.isConnected && checkAABBOverlap(potentialBox, r.box || getElementWorldBoundingBox(r.element), COLLISION_PADDING));
        if (!overlaps) overlaps = buildings.some(b => b.element && checkAABBOverlap(potentialBox, b.box || getElementWorldBoundingBox(b.element), COLLISION_PADDING));
        if (!overlaps) overlaps = constructions.some(c => c.element && checkAABBOverlap(potentialBox, c.box || getElementWorldBoundingBox(c.element), COLLISION_PADDING));

        if (!overlaps) {
            aiStartConstructionGeneric(factionKey, buildingType, potentialBox, builderUnit);
            return true; 
        }
    }
    return false; 
}

function getSpawnPosition(buildingElement, index, totalUnitsOfType = 1) {
    if (!buildingElement) {
        console.warn("GAME_LOGIC: getSpawnPosition called with no buildingElement, defaulting to center.");
        return { x: currentWorldWidth / 2, y: currentWorldHeight / 2 };
    }
    const bBox = getElementWorldBoundingBox(buildingElement); 
    if (bBox.width === 0 && bBox.height === 0) { 
        console.warn("GAME_LOGIC: getSpawnPosition buildingElement has zero dimensions, defaulting to center.");
        return { x: currentWorldWidth / 2, y: currentWorldHeight / 2 };
    }
    const center = { x: bBox.centerX, y: bBox.centerY };
    const baseRadius = Math.max(bBox.width, bBox.height) / 2 + 25; 
    const angleIncrement = totalUnitsOfType > 1 ? (360 / totalUnitsOfType) : 0;
    const angle = (index * angleIncrement) * (Math.PI / 180); 
    const radiusOffset = Math.floor(index / totalUnitsOfType) * 10; 
    const radius = baseRadius + radiusOffset + (Math.sqrt(index % totalUnitsOfType) * 8); 
    
    let spawnX = center.x + Math.cos(angle) * radius;
    let spawnY = center.y + Math.sin(angle) * radius;

    const unitHalfSize = 18; 
    spawnX = Math.max(unitHalfSize, Math.min(currentWorldWidth - unitHalfSize, spawnX));
    spawnY = Math.max(unitHalfSize, Math.min(currentWorldHeight - unitHalfSize, spawnY));
    
    return { x: spawnX, y: spawnY };
}

function findNearestResource(unit, resourceClassType) {
    let nearestNode = null;
    let minDistanceSq = Infinity;
    const unitPos = { x: unit.worldX, y: unit.worldY };

    resources.forEach(resource => {
        if (resource.type !== resourceClassType || !resource.element?.isConnected) return;
        if (resourceClassType === 'mine' && resource.health <= 0) return; 

        const isTargetedByOwnFaction = units.some(u => 
            u !== unit && 
            u.faction === unit.faction && 
            u.targetElement === resource.element && 
            (u.state === 'moving_to_resource' || u.state === 'harvesting')
        );
        if (isTargetedByOwnFaction && resourceClassType === 'mine') return; 

        const bbox = resource.box || getElementWorldBoundingBox(resource.element);
        if (!bbox || bbox.width === 0) return; 

        const resourcePos = { x: bbox.centerX, y: bbox.centerY };
        const distSq = distanceSq(unitPos, resourcePos); // distanceSq is now in this file
        if (distSq < minDistanceSq) {
            minDistanceSq = distSq;
            nearestNode = resource;
        }
    });
    return nearestNode;
}


// --- AI Logic ---
function updateSingleAI(currentAIFactionKey) {
    if (factionAiUpdateCounters[currentAIFactionKey] === undefined) {
        factionAiUpdateCounters[currentAIFactionKey] = 0;
    }

    factionAiUpdateCounters[currentAIFactionKey]++;
    if (factionAiUpdateCounters[currentAIFactionKey] < AI_UPDATE_INTERVAL || gameOver) {
        return;
    }
    factionAiUpdateCounters[currentAIFactionKey] = 0;
    
    const isP1AI = currentAIFactionKey === p1FactionKey; 
    let currentAIWood = isP1AI ? p1Wood : p2Wood; 
    let currentAICoal = isP1AI ? p1Coal : p2Coal; 
    let currentAIFood = calculateCurrentFood(currentAIFactionKey); 
    let currentAIFoodCap = calculateFoodCapacity(currentAIFactionKey);

    let currentAIBase = isP1AI ? playerBaseData : opponentBaseData; 
    let enemyAIBase = isP1AI ? opponentBaseData : playerBaseData; 

    if (!currentAIBase || currentAIBase.hp <= 0) {
        return; 
    }

    const aiUnits = units.filter(u => u.faction === currentAIFactionKey && u.hp > 0); 
    const aiWorkers = aiUnits.filter(u => u.unitType === 'worker'); 
    const aiSoldiers = aiUnits.filter(u => u.unitType === 'soldier'); 
    const aiArchers = aiUnits.filter(u => u.unitType === 'archer'); 
    
    const aiOwnBases = buildings.filter(b => b.faction === currentAIFactionKey && b.buildingType === 'base' && !b.isConstructing && b.hp > 0); 
    const aiOwnBarracks = buildings.filter(b => b.faction === currentAIFactionKey && b.buildingType === 'barracks' && !b.isConstructing && b.hp > 0); 
    const aiOwnArcheryRanges = buildings.filter(b => b.faction === currentAIFactionKey && b.buildingType === 'archer_trainer' && !b.isConstructing && b.hp > 0); 
    const aiOwnFarmsCount = buildings.filter(b => b.faction === currentAIFactionKey && b.buildingType === 'farm' && !b.isConstructing && b.hp > 0).length; 
    const aiOwnGuardTowersCount = buildings.filter(b => b.faction === currentAIFactionKey && b.buildingType === 'guard_tower' && !b.isConstructing && b.hp > 0).length; 
    
    const needsFood = (currentAIFoodCap - currentAIFood) < (aiWorkers.length > 1 ? 3 : 2); 
    
    const isBuildingFarm = constructions.some(c => c.faction === currentAIFactionKey && c.buildingType === 'farm'); 
    const isBuildingBarracks = constructions.some(c => c.faction === currentAIFactionKey && c.buildingType === 'barracks'); 
    const isBuildingArchery = constructions.some(c => c.faction === currentAIFactionKey && c.buildingType === 'archer_trainer'); 
    const isBuildingGuardTower = constructions.some(c => c.faction === currentAIFactionKey && c.buildingType === 'guard_tower'); 

    if (aiOwnBases.length > 0 && !aiOwnBases[0].isTraining && aiWorkers.length < AI_TARGET_WORKERS && 
        aiCanAffordGeneric(currentAIFactionKey, 'worker', true, currentAIWood, currentAICoal, currentAIFood, currentAIFoodCap)) {
        trainUnit('worker', aiOwnBases[0]); 
        return; 
    } 
    
    const availableBuilders = aiWorkers.filter(w => w.state === 'idle' && !w.ai_tasked && !w.constructionId); 
    if (availableBuilders.length > 0) { 
        const builder = availableBuilders[0]; 
        let builtSomething = false;
        if (needsFood && !isBuildingFarm && aiOwnFarmsCount < Math.ceil((aiUnits.reduce((sum, u) => sum + u.foodCost, 0) + 5) / STARTING_FOOD_CAP) && 
            aiCanAffordGeneric(currentAIFactionKey, 'farm', false, currentAIWood, currentAICoal, currentAIFood, currentAIFoodCap)) { 
            builtSomething = aiTryBuildGeneric(currentAIFactionKey, currentAIBase, 'farm', builder); 
        } else if (aiOwnBarracks.length === 0 && !isBuildingBarracks && aiWorkers.length >=2 && 
                   aiCanAffordGeneric(currentAIFactionKey, 'barracks', false, currentAIWood, currentAICoal, currentAIFood, currentAIFoodCap)) { 
            builtSomething = aiTryBuildGeneric(currentAIFactionKey, currentAIBase, 'barracks', builder); 
        } else if (aiOwnBarracks.length > 0 && aiOwnArcheryRanges.length === 0 && !isBuildingArchery && aiWorkers.length >= 3 && 
                   aiCanAffordGeneric(currentAIFactionKey, 'archer_trainer', false, currentAIWood, currentAICoal, currentAIFood, currentAIFoodCap)) { 
            builtSomething = aiTryBuildGeneric(currentAIFactionKey, currentAIBase, 'archer_trainer', builder); 
        } else if (aiOwnBarracks.length > 0 && aiOwnGuardTowersCount < AI_TARGET_GUARD_TOWERS && !isBuildingGuardTower && aiWorkers.length >=3 && 
                   currentAIWood > 50 && currentAICoal > 40 && 
                   aiCanAffordGeneric(currentAIFactionKey, 'guard_tower', false, currentAIWood, currentAICoal, currentAIFood, currentAIFoodCap) ) { 
            builtSomething = aiTryBuildGeneric(currentAIFactionKey, currentAIBase, 'guard_tower', builder); 
        }

        if (!builtSomething && builder.state === 'idle') { 
             let preferredType = (currentAIWood < currentAICoal * 1.2 || currentAIWood < 40 + aiWorkers.length * 5) ? 'tree' : 'mine'; 
             if (currentAICoal < 25 + aiWorkers.length * 3 && currentAIWood > 50) preferredType = 'mine'; 
             let targetNode = findNearestResource(builder, preferredType); 
             if (!targetNode) { targetNode = findNearestResource(builder, preferredType === 'tree' ? 'mine' : 'tree'); } 
             if (targetNode) { findAndTargetNearestResource(builder, targetNode.type, targetNode, true); }
        }
         if(builtSomething) return; 
    } 
    
    if (aiOwnBarracks.length > 0 && !aiOwnBarracks[0].isTraining && aiSoldiers.length < AI_TARGET_SOLDIERS && 
        aiCanAffordGeneric(currentAIFactionKey, 'soldier', true, currentAIWood, currentAICoal, currentAIFood, currentAIFoodCap)) { 
        trainUnit('soldier', aiOwnBarracks[0]); 
    } else if (aiOwnArcheryRanges.length > 0 && !aiOwnArcheryRanges[0].isTraining && aiArchers.length < AI_TARGET_ARCHERS && 
        aiCanAffordGeneric(currentAIFactionKey, 'archer', true, currentAIWood, currentAICoal, currentAIFood, currentAIFoodCap)) { 
        trainUnit('archer', aiOwnArcheryRanges[0]); 
    } 
    
    const idleCombatUnits = aiUnits.filter(u => (u.unitType === 'soldier' || u.unitType === 'archer') && u.state === 'idle' && !u.ai_tasked); 
    if (idleCombatUnits.length > 2 && enemyAIBase && enemyAIBase.hp > 0) { 
        idleCombatUnits.forEach(unit => { 
            issueCommand(unit, { 
                state: 'moving_to_attack', 
                target: { x: enemyAIBase.box.centerX, y: enemyAIBase.box.centerY }, 
                targetElement: enemyAIBase.element 
            }, true); 
        }); 
    } 
}


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
    
    units.forEach(unit => {
        if (!unit.element || !unit.element.isConnected || unit.hp <= 0) return;
        updateHpBar(unit); 
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
                targetPos = { x: targetBox.centerX, y: targetBox.centerY }; 
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
        
        if (unit.state === 'attacking' && unit.attackDamage > 0) {
            const targetData = units.find(u => u.element === unit.targetElement && u.hp > 0) || 
                             buildings.find(b => b.element === unit.targetElement && b.hp > 0);
            
            if (!targetData || targetData.faction === unit.faction || !targetData.element?.isConnected) {
                setUnitState(unit, 'idle'); 
            } else {
                const targetBox = getElementWorldBoundingBox(targetData.element);
                const distSqToEnemy = distanceSq({x: unit.worldX, y: unit.worldY}, {x: targetBox.centerX, y: targetBox.centerY});
                const targetRadiusApproximation = Math.min(targetBox.width, targetBox.height) / 2;
                const distToTargetEdgeApprox = Math.max(0, Math.sqrt(distSqToEnemy) - targetRadiusApproximation);

                if (distToTargetEdgeApprox > unit.attackRange + ATTACK_RANGE_TOLERANCE) {
                    issueCommand(unit, { 
                        state: 'moving_to_attack', 
                        target: { x: targetBox.centerX, y: targetBox.centerY }, 
                        targetElement: targetData.element 
                    }, (unit.faction !== playerFactionKey || gameMode === 'ai_vs_ai'));
                } else { 
                    if (!unit.lastAttackTime || timestamp - unit.lastAttackTime >= unit.attackSpeed) {
                        dealDamage(targetData, unit.attackDamage);
                        unit.lastAttackTime = timestamp;
                    }
                }
            }
        }
    });
    
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
                }
            }
        }
    });
    
    for (let i = constructions.length - 1; i >= 0; i--) { 
        const cons = constructions[i];
        if (!cons.isConstructing || !cons.element || !cons.element.isConnected) {
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
            const progressPercent = Math.min(100, (cons.progress && cons.buildTime ? (cons.progress / cons.buildTime * 100) : 0)); 
            cons.progressBarInner.style.width = `${progressPercent}%`; 
            if(cons.progressBarContainer) cons.progressBarContainer.style.display = isBuildingByWorker ? 'block' : 'none'; 
        } 
        if(cons.element) cons.element.classList.toggle('building', isBuildingByWorker); 
        if (cons.progress >= cons.buildTime) { 
            completeConstruction(cons); 
        } 
    }
    
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
