// js/main.js
// Handles game initialization, top-level UI (modals, panels), global input,
// JSRTSMenu builders and interaction, camera, and placement previews.
// This is the main "conductor" script, loaded last.

"use strict";

// Note: This file assumes that variables from 'game-data.js' and 'game-state.js'
// and functions from 'game-logic.js' and 'menu.js' are globally accessible
// due to script load order.

// --- DOM Element References (will be assigned in DOMContentLoaded) ---
let viewportElement, gameWorld, modalOverlay, mainMenuOverlay, uiPanelElement, uiLeftElements,
    humanBtn, zombieBtn, versusBtn, resumeGameBtn, editorModeBtn, restartGameBtn, 
    gameOverMessageDiv, commandCardContainerElement,
    woodCountSpan, coalCountSpan, foodCountSpan, foodCapSpan, selectionInfoDiv,
    debugPanel, debugCurrentGameState, debugPlayerFaction, debugOpponentFaction, 
    debugWorldSize, debugUnitCount,
    debugP1Wood, debugP1Coal, debugP1Food, debugP1FoodCap,
    debugP2Wood, debugP2Coal, debugP2Food, debugP2FoodCap,
    debugP1BuildingCount, debugP2BuildingCount,
    debugConstructionCount, debugResourceNodesCount, 
    debugSelectedId, debugSelectedType, debugSelectedFactionSel, 
    debugSelectedHp, debugSelectedState, debugSelectedTarget;

// JSRTSMenu Instances (initialized in DOMContentLoaded)
let commandCardMenu;
let contextMenu;
let globalCooldownManagerInstance; // Instantiated in initializeMenus


// --- Initialization and Setup ---
document.addEventListener('DOMContentLoaded', () => {
    // Assign DOM elements
    viewportElement = document.getElementById('viewport');
    gameWorld = document.getElementById('game-world');
    modalOverlay = document.getElementById('start-modal-overlay');
    mainMenuOverlay = document.getElementById('main-menu-overlay');
    uiPanelElement = document.getElementById('ui-panel');
    uiLeftElements = document.getElementById('ui-left-elements');
    humanBtn = document.getElementById('human-btn');
    zombieBtn = document.getElementById('zombie-btn');
    versusBtn = document.getElementById('versus-btn');
    resumeGameBtn = document.getElementById('resume-game-btn');
    editorModeBtn = document.getElementById('editor-mode-btn');
    restartGameBtn = document.getElementById('restart-game-btn');
    gameOverMessageDiv = document.getElementById('game-over-message');
    commandCardContainerElement = document.getElementById('command-card-container');

    woodCountSpan = document.getElementById('wood-count'); 
    coalCountSpan = document.getElementById('coal-count'); 
    foodCountSpan = document.getElementById('food-count'); 
    foodCapSpan = document.getElementById('food-capacity');
    selectionInfoDiv = document.getElementById('selection-info');
    
    debugPanel = document.getElementById('debug-panel'); 
    debugCurrentGameState = document.getElementById('debug-current-game-state');
    debugPlayerFaction = document.getElementById('debug-player-faction'); 
    debugOpponentFaction = document.getElementById('debug-opponent-faction');
    debugWorldSize = document.getElementById('debug-world-size'); 
    debugUnitCount = document.getElementById('debug-unit-count');
    debugP1Wood = document.getElementById('debug-p1-wood'); 
    debugP1Coal = document.getElementById('debug-p1-coal');
    debugP1Food = document.getElementById('debug-p1-food'); 
    debugP1FoodCap = document.getElementById('debug-p1-food-cap');
    debugP2Wood = document.getElementById('debug-p2-wood'); 
    debugP2Coal = document.getElementById('debug-p2-coal');
    debugP2Food = document.getElementById('debug-p2-food'); 
    debugP2FoodCap = document.getElementById('debug-p2-food-cap');
    debugP1BuildingCount = document.getElementById('debug-p1-building-count'); 
    debugP2BuildingCount = document.getElementById('debug-p2-building-count'); 
    debugResourceNodesCount = document.getElementById('debug-resource-nodes-count'); 
    debugConstructionCount = document.getElementById('debug-construction-count');
    debugSelectedId = document.getElementById('debug-selected-id'); 
    debugSelectedType = document.getElementById('debug-selected-type');
    debugSelectedFactionSel = document.getElementById('debug-selected-faction-sel'); 
    debugSelectedHp = document.getElementById('debug-selected-hp');
    debugSelectedState = document.getElementById('debug-selected-state'); 
    debugSelectedTarget = document.getElementById('debug-selected-target');
    
    initializeMenus();

    // Assign event listeners for modal buttons
    humanBtn.onclick = () => { startGameWithOptions('human_vs_ai', 'human'); };
    zombieBtn.onclick = () => { startGameWithOptions('human_vs_ai', 'zombie'); };
    versusBtn.onclick = () => { startGameWithOptions('ai_vs_ai', 'human', 'zombie'); };
    
    resumeGameBtn.onclick = hideMainMenu;
    editorModeBtn.onclick = () => {
        hideMainMenu();
        console.log("MAIN.JS: Editor Mode Clicked - Not Implemented Yet.");
        setCurrentGameState('editor'); 
        // initializeEditor(); // TODO: You'd create this function for editor setup
    };
    restartGameBtn.onclick = () => { 
        hideMainMenu(); 
        if(modalOverlay) modalOverlay.style.display = 'flex'; 
        setCurrentGameState('start_modal');
        if (commandCardMenu) commandCardMenu.hide();
        if (contextMenu) contextMenu.hide();
        if (gameWorld) gameWorld.innerHTML = ''; 
        // Game state (units, resources etc.) will be reset by initializeAndStartGame
    };

    // Viewport and global event listeners
    viewportElement.addEventListener('mousedown', handleViewportMouseDown);
    viewportElement.addEventListener('mousemove', handleViewportMouseMove);
    viewportElement.addEventListener('mouseup', handleViewportMouseUp);
    viewportElement.addEventListener('mouseleave', handleViewportMouseLeave);
    viewportElement.addEventListener('wheel', handleViewportWheel, { passive: false });
    viewportElement.addEventListener('contextmenu', (e) => { 
        if (currentGameState !== 'in_game') return;
        if (e.defaultPrevented && contextMenu && contextMenu.isVisible) return;
        gameHandleContextMenu(e); 
    });

    window.addEventListener('keydown', handleGlobalKeyDown);
    window.addEventListener('keyup', handleGlobalKeyUp);

    // Show start modal initially
    setCurrentGameState('start_modal'); 
    if(modalOverlay) modalOverlay.style.display = 'flex';
});

/**
 * Initializes JSRTSMenu instances.
 */
function initializeMenus() {
    globalCooldownManagerInstance = new CooldownManager(); // From menu.js
    commandCardMenu = new JSRTSMenu('command-card-menu-actual-container', globalCooldownManagerInstance); // Class from menu.js
    contextMenu = new JSRTSMenu('context-menu-actual-container', globalCooldownManagerInstance);
}

// --- Game State Transition Functions ---

/**
 * Configures and starts a new game based on player/AI choices.
 * @param {string} mode - 'human_vs_ai' or 'ai_vs_ai'.
 * @param {string} p1Key - Faction key for player 1.
 * @param {string|null} [p2KeyIfAiVsAi=null] - Faction key for player 2 if AI vs AI.
 */
function startGameWithOptions(mode, p1Key, p2KeyIfAiVsAi = null) {
    // Set global game state variables (from game-state.js)
    gameMode = mode; 
    p1FactionKey = p1Key; 
    playerFactionKey = p1Key; 
    
    if (gameMode === 'ai_vs_ai') {
        p2FactionKey = p2KeyIfAiVsAi || (p1Key === 'human' ? 'zombie' : 'human'); 
        opponentFactionKey = p2FactionKey; 
    } else { // human_vs_ai
        p2FactionKey = (p1Key === 'human') ? 'zombie' : 'human'; 
        opponentFactionKey = p2FactionKey;
    }

    if(modalOverlay) modalOverlay.style.display = 'none';
    if(mainMenuOverlay) mainMenuOverlay.style.display = 'none';
    if(uiPanelElement) uiPanelElement.style.visibility = (gameMode === 'human_vs_ai') ? 'visible' : 'hidden';
    if(viewportElement) viewportElement.style.visibility = 'visible';
    setCurrentGameState('in_game'); // setCurrentGameState from game-state.js
    initializeAndStartGame(); // This function is now in this file
}

/**
 * Initializes all game systems, data, map, and starts the game loop.
 * This is called after faction/mode selection.
 */
function initializeAndStartGame() { 
    if (!gameWorld) gameWorld = document.getElementById('game-world');
    if (!gameWorld) { 
        console.error("MAIN.JS: FATAL - Could not find #game-world element during game start!"); 
        setCurrentGameState('start_modal'); 
        if(modalOverlay) modalOverlay.style.display = 'flex'; 
        return; 
    }

    resetCoreGameState(); // from game-state.js

    // FACTION_DATA is globally available from game-data.js
    // Constants it uses (STARTING_FOOD_CAP, FARM_TOTAL_SIZE) are also global from game-data.js

    currentWorldWidth = WORLD_WIDTH; // from game-data.js
    currentWorldHeight = WORLD_HEIGHT; // from game-data.js

    // Initialize resources using constants from game-data.js
    p1Wood = INITIAL_WOOD; p1Coal = INITIAL_COAL;
    p1CurrentFood = 0; p1FoodCapacity = STARTING_FOOD_CAP;
    p2Wood = INITIAL_WOOD; p2Coal = INITIAL_COAL;
    p2CurrentFood = 0; p2FoodCapacity = STARTING_FOOD_CAP;
    
    // Initialize AI update counters for the current factions (from game-state.js)
    factionAiUpdateCounters[p1FactionKey] = 0; 
    factionAiUpdateCounters[p2FactionKey] = 0;

    try {
        initializeMapAndBases(); // This is in game-logic.js
    } catch (error) {
        console.error("MAIN.JS: FATAL ERROR during map/base initialization:", error);
        setCurrentGameState('start_modal'); 
        if(modalOverlay) modalOverlay.style.display = 'flex';
        const modalContent = document.getElementById('start-modal'); 
        if (modalContent) { 
            let errorP = modalContent.querySelector('.error-message'); 
            if (!errorP) { errorP = document.createElement('p'); errorP.className = 'error-message'; errorP.style.color = 'red'; modalContent.appendChild(errorP); } 
            errorP.textContent = "Initialization Error: " + error.message; 
        }
        return;
    }
    setGameInitialized(true); // from game-state.js
    
    // Initial UI updates
    updateResourceDisplay();
    updateSelectionInfo();
    updateCommandCard(); 
    
    if (playerBaseData && playerBaseData.box) { 
        centerViewOn(playerBaseData.box.centerX, playerBaseData.box.centerY);
    } else if (WORLD_WIDTH && WORLD_HEIGHT) { 
        centerViewOn(WORLD_WIDTH / 2, WORLD_HEIGHT / 2); 
    }
    applyTransform();

    requestAnimationFrame(gameLoop); // gameLoop is in game-logic.js
}


/** Shows the main menu overlay and pauses game interactions. */
function showMainMenu() {
    setCurrentGameState('main_menu'); // from game-state.js
    if(mainMenuOverlay) mainMenuOverlay.style.display = 'flex';
    if (commandCardMenu) commandCardMenu.hide();
    if (contextMenu) contextMenu.hide();
}

/** Hides the main menu overlay and resumes game or returns to start. */
function hideMainMenu() {
    if(gameInitialized && !gameOver) { 
        setCurrentGameState('in_game'); // from game-state.js
        if(mainMenuOverlay) mainMenuOverlay.style.display = 'none';
    } else { 
        if(mainMenuOverlay) mainMenuOverlay.style.display = 'none';
        if(modalOverlay) modalOverlay.style.display = 'flex';
        setCurrentGameState('start_modal');
    }
}

// --- UI Update Functions ---
/** Updates the resource display panel for the current player. */
function updateResourceDisplay() {
    try {
        p1CurrentFood = calculateCurrentFood(p1FactionKey); 
        p1FoodCapacity = calculateFoodCapacity(p1FactionKey); 
        if (gameMode === 'human_vs_ai') {
            if(woodCountSpan) woodCountSpan.textContent = p1Wood;
            if(coalCountSpan) coalCountSpan.textContent = p1Coal;
            if(foodCountSpan) foodCountSpan.textContent = p1CurrentFood;
            if(foodCapSpan) foodCapSpan.textContent = p1FoodCapacity;
        }
        p2CurrentFood = calculateCurrentFood(p2FactionKey);
        p2FoodCapacity = calculateFoodCapacity(p2FactionKey);
    } catch (e) { console.error("MAIN.JS: Resource display error:", e); }
    
    if (commandCardMenu && commandCardMenu.isVisible && currentGameState === 'in_game') { 
        updateCommandCard(); 
    }
    updateDebugPanel(); 
}

/** Updates the selection information panel. */
function updateSelectionInfo() {
    if (!selectionInfoDiv) return;
    if (gameMode === 'ai_vs_ai') { selectionInfoDiv.innerHTML = "AI vs AI - Watching..."; return; }
    
    let text = 'Selected: None';
    if (selectedUnit) { 
        text = `Selected: ${getEmojiForFaction(selectedUnit.unitType, selectedUnit.faction)} Unit ${selectedUnit.id} (${selectedUnit.unitType}, ${selectedUnit.hp}/${selectedUnit.maxHp} HP, Faction: ${selectedUnit.faction}, State: ${selectedUnit.state})`; 
    } else if (selectedBuilding) { 
        if (selectedBuilding.isConstructing){ 
            text = `Selected: ${getEmojiForFaction(selectedBuilding.buildingType, selectedBuilding.faction)} Site ${selectedBuilding.id} (${selectedBuilding.hp}/${selectedBuilding.maxHp} HP, Constructing...)`;
        } else if (selectedBuilding.faction === playerFactionKey) { 
            text = `Selected: ${getEmojiForFaction(selectedBuilding.buildingType, selectedBuilding.faction)} ${selectedBuilding.buildingType} ${selectedBuilding.id} (${selectedBuilding.hp}/${selectedBuilding.maxHp} HP)`; 
            if(selectedBuilding.isTraining) { text += ` (Training ${getEmojiForFaction(selectedBuilding.trainingUnitType, selectedBuilding.faction)} ${selectedBuilding.trainingUnitType})`; }
        } else if (selectedBuilding.faction !== playerFactionKey) { 
            text = `Selected: Opponent ${getEmojiForFaction(selectedBuilding.buildingType, selectedBuilding.faction)} ${selectedBuilding.buildingType} ${selectedBuilding.id} (${selectedBuilding.hp}/${selectedBuilding.maxHp} HP)`; 
            if(selectedBuilding.isTraining) { text += ` (Training...)`; } 
            else if (selectedBuilding.isConstructing) { text += ` (Constructing...)`; }
        }
    } else if (placingBuildingType) { 
        text = `Placing ${getEmojiForFaction(placingBuildingType, playerFactionKey)} ${placingBuildingType}...`; 
    }
    selectionInfoDiv.innerHTML = text;
    updateDebugPanel(); 
}

/** Updates or shows/hides the command card based on current selection. */
function updateCommandCard() {
    if (currentGameState !== 'in_game' || !gameInitialized || gameOver || gameMode === 'ai_vs_ai' || !commandCardMenu) {
        if(commandCardMenu) commandCardMenu.hide();
        return;
    }

    const anchorElement = commandCardContainerElement; 
    let builderFn = null;

    if (selectedUnit && selectedUnit.faction === playerFactionKey) {
        switch (selectedUnit.unitType) {
            case 'worker': builderFn = buildWorkerCommandCard; break;
        }
    } else if (selectedBuilding && selectedBuilding.faction === playerFactionKey && !selectedBuilding.isConstructing) {
         switch (selectedBuilding.buildingType) {
            case 'base': builderFn = buildBaseCommandCard; break;
            case 'barracks': builderFn = buildBarracksCommandCard; break;
            case 'archer_trainer': builderFn = buildArcherTrainerCommandCard; break;
        }
    }

    if (builderFn) {
        commandCardMenu.showRoot(anchorElement, builderFn, selectedUnit?.element || selectedBuilding?.element);
    } else {
        commandCardMenu.hide();
    }
}

// --- JSRTSMenu Builder Functions ---
function buildWorkerCommandCard() {
    const currentFactionStaticData = FACTION_DATA[playerFactionKey]; 
    const canAfford = (cost) => p1Wood >= (cost.wood || 0) && p1Coal >= (cost.coal || 0); 

    const buildActionsSubmenu = () => {
        commandCardMenu.addBackButton();
        const farmData = currentFactionStaticData.buildings.farm;
        commandCardMenu.addButton(`Farm`, () => { if(canAfford(farmData.cost)) startPlacingBuilding('farm'); else showTemporaryMessage("Not enough resources for Farm!"); },
            { iconSrc: GAME_ACTION_ICONS.BUILD_FARM, costText: `W${farmData.cost.wood}`, isCostInsufficient: !canAfford(farmData.cost), hotkey: farmData.hotkey, tooltip: `Build Farm (${farmData.hotkey?.toUpperCase()})` });

        const barracksData = currentFactionStaticData.buildings.barracks;
        commandCardMenu.addButton(`Barracks`, () => { if(canAfford(barracksData.cost)) startPlacingBuilding('barracks'); else showTemporaryMessage("Not enough resources for Barracks!"); },
            { iconSrc: GAME_ACTION_ICONS.BUILD_BARRACKS, costText: `W${barracksData.cost.wood}C${barracksData.cost.coal}`, isCostInsufficient: !canAfford(barracksData.cost), hotkey: barracksData.hotkey, tooltip: `Build Barracks (${barracksData.hotkey?.toUpperCase()})` });
        
        const archeryData = currentFactionStaticData.buildings.archer_trainer;
        commandCardMenu.addButton(`Archery`, () => { if(canAfford(archeryData.cost)) startPlacingBuilding('archer_trainer'); else showTemporaryMessage("Not enough resources for Archery!"); },
            { iconSrc: GAME_ACTION_ICONS.BUILD_ARCHERY, costText: `W${archeryData.cost.wood}C${archeryData.cost.coal}`, isCostInsufficient: !canAfford(archeryData.cost), hotkey: archeryData.hotkey, tooltip: `Build Archery (${archeryData.hotkey?.toUpperCase()})` });

        const towerData = currentFactionStaticData.buildings.guard_tower;
        commandCardMenu.addButton(`Guard Tower`, () => { if(canAfford(towerData.cost)) startPlacingBuilding('guard_tower'); else showTemporaryMessage("Not enough resources for Guard Tower!"); },
            { iconSrc: GAME_ACTION_ICONS.BUILD_TOWER, costText: `W${towerData.cost.wood}C${towerData.cost.coal}`, isCostInsufficient: !canAfford(towerData.cost), hotkey: towerData.hotkey, tooltip: `Build Guard Tower (${towerData.hotkey?.toUpperCase()})` });
    };

    commandCardMenu.addButton("Build", () => { commandCardMenu.openSubmenu(buildActionsSubmenu); return true; }, 
        { iconSrc: RTS_MENU_ICONS.ADD, hotkey: 'b', opensSubmenu: true, tooltip: "Open build menu (B)"}
    );
}

function buildBaseCommandCard() {
    const currentFactionStaticData = FACTION_DATA[playerFactionKey];
    const unitToTrain = currentFactionStaticData.buildings.base.trains; 
    if (!unitToTrain) return;
    const unitData = currentFactionStaticData.units[unitToTrain];
    if (!unitData) return;

    const cost = unitData.cost;
    const foodCost = unitData.foodCost;
    const canAffordRes = p1Wood >= (cost.wood || 0) && p1Coal >= (cost.coal || 0);
    const hasFoodCap = p1CurrentFood + foodCost <= p1FoodCapacity;

    commandCardMenu.addButton(
        `Train ${getEmojiForFaction(unitToTrain, playerFactionKey)} ${unitToTrain}`,
        () => { 
            if(canAffordRes && hasFoodCap && !selectedBuilding.isTraining) { 
                trainUnit(unitToTrain, selectedBuilding); 
                updateCommandCard(); 
            } else {
                if (!canAffordRes) showTemporaryMessage("Not enough resources!");
                else if (!hasFoodCap) showTemporaryMessage("Not enough food!");
                else if (selectedBuilding.isTraining) showTemporaryMessage("Already training!");
            }
        },
        {
            iconSrc: GAME_ACTION_ICONS.TRAIN_WORKER, 
            costText: `W${cost.wood}C${cost.coal}F${foodCost}`,
            isCostInsufficient: !canAffordRes || !hasFoodCap,
            disabled: selectedBuilding.isTraining,
            hotkey: unitData.hotkey, 
            tooltip: `Train ${unitToTrain} (${unitData.hotkey?.toUpperCase()}). Cost: ${cost.wood}W, ${cost.coal}C, ${foodCost}F.`
        }
    );
}
function buildBarracksCommandCard() {
    const currentFactionStaticData = FACTION_DATA[playerFactionKey];
    const unitToTrain = currentFactionStaticData.buildings.barracks.trains; 
    if (!unitToTrain) return;
    const unitData = currentFactionStaticData.units[unitToTrain];
     if (!unitData) return;

    const cost = unitData.cost;
    const foodCost = unitData.foodCost;
    const canAffordRes = p1Wood >= (cost.wood || 0) && p1Coal >= (cost.coal || 0);
    const hasFoodCap = p1CurrentFood + foodCost <= p1FoodCapacity;

    commandCardMenu.addButton(
        `Train ${getEmojiForFaction(unitToTrain, playerFactionKey)} ${unitToTrain}`,
        () => { 
            if(canAffordRes && hasFoodCap && !selectedBuilding.isTraining) {
                trainUnit(unitToTrain, selectedBuilding); 
                updateCommandCard(); 
            } else {
                if (!canAffordRes) showTemporaryMessage("Not enough resources!");
                else if (!hasFoodCap) showTemporaryMessage("Not enough food!");
                else if (selectedBuilding.isTraining) showTemporaryMessage("Already training!");
            }
        },
        {
            iconSrc: GAME_ACTION_ICONS.TRAIN_SOLDIER,
            costText: `W${cost.wood}C${cost.coal}F${foodCost}`,
            isCostInsufficient: !canAffordRes || !hasFoodCap,
            disabled: selectedBuilding.isTraining,
            hotkey: unitData.hotkey, 
            tooltip: `Train ${unitToTrain} (${unitData.hotkey?.toUpperCase()}). Cost: ${cost.wood}W, ${cost.coal}C, ${foodCost}F.`
        }
    );
}
function buildArcherTrainerCommandCard() {
    const currentFactionStaticData = FACTION_DATA[playerFactionKey];
    const unitToTrain = currentFactionStaticData.buildings.archer_trainer.trains; 
    if (!unitToTrain) return;
    const unitData = currentFactionStaticData.units[unitToTrain];
    if (!unitData) return;

    const cost = unitData.cost;
    const foodCost = unitData.foodCost;
    const canAffordRes = p1Wood >= (cost.wood || 0) && p1Coal >= (cost.coal || 0);
    const hasFoodCap = p1CurrentFood + foodCost <= p1FoodCapacity;

    commandCardMenu.addButton(
        `Train ${getEmojiForFaction(unitToTrain, playerFactionKey)} ${unitToTrain}`,
        () => { 
             if(canAffordRes && hasFoodCap && !selectedBuilding.isTraining) {
                trainUnit(unitToTrain, selectedBuilding); 
                updateCommandCard(); 
            } else {
                if (!canAffordRes) showTemporaryMessage("Not enough resources!");
                else if (!hasFoodCap) showTemporaryMessage("Not enough food!");
                else if (selectedBuilding.isTraining) showTemporaryMessage("Already training!");
            }
        },
        {
            iconSrc: GAME_ACTION_ICONS.TRAIN_ARCHER,
            costText: `W${cost.wood}C${cost.coal}F${foodCost}`,
            isCostInsufficient: !canAffordRes || !hasFoodCap,
            disabled: selectedBuilding.isTraining,
            hotkey: unitData.hotkey, 
            tooltip: `Train ${unitToTrain} (${unitData.hotkey?.toUpperCase()}). Cost: ${cost.wood}W, ${cost.coal}C, ${foodCost}F.`
        }
    );
}

// --- Context Menu Builders ---
function buildMoveContextMenu(contextData) {
    contextMenu.addButton("Move", () => { issueCommand(selectedUnit, { state: 'moving', target: contextData.worldPos, targetElement: null }); }, { iconSrc: GAME_ACTION_ICONS.MOVE, hotkey: 'm' }); 
}
function buildAttackContextMenu(contextData, targetEntityData) {
    const targetBox = getElementWorldBoundingBox(targetEntityData.element);
    contextMenu.addButton(`Attack ${getEmojiForFaction(targetEntityData.unitType || targetEntityData.buildingType, targetEntityData.faction)}`, () => { issueCommand(selectedUnit, { state: 'moving_to_attack', targetElement: targetEntityData.element, target: { x: targetBox.centerX, y: targetBox.centerY } }); }, { iconSrc: GAME_ACTION_ICONS.ATTACK, hotkey: 'a' }); 
}
function buildHarvestContextMenu(contextData, resourceData) {
    const targetBox = getElementWorldBoundingBox(resourceData.element);
    contextMenu.addButton(`Harvest ${getEmojiForFaction(resourceData.type, playerFactionKey)}`, () => { issueCommand(selectedUnit, { state: 'moving_to_resource', targetElement: resourceData.element, target: { x: targetBox.centerX, y: targetBox.centerY }, preferredType: resourceData.type }); }, { iconSrc: GAME_ACTION_ICONS.HARVEST, hotkey: 'h' }); 
}
function buildAssistConstructionContextMenu(contextData, consData) {
    contextMenu.addButton(`Build ${getEmojiForFaction(consData.buildingType, consData.faction)}`, () => { assignWorkerToConstruction(consData, selectedUnit, false); }, { iconSrc: GAME_ACTION_ICONS.ASSIST_BUILD, hotkey: 'b' }); 
}
function buildReturnResourceContextMenu(contextData) {
    const targetBase = playerBaseData; 
    if (!targetBase || !targetBase.element) return; 
    const targetBox = getElementWorldBoundingBox(targetBase.element);
    contextMenu.addButton(`Return ${getEmojiForFaction(selectedUnit.resourceType === 'wood' ? 'resource_wood' : 'resource_coal', selectedUnit.faction)}`, () => { issueCommand(selectedUnit, { state: 'returning', targetElement: targetBase.element, target: { x: targetBox.centerX, y: targetBox.centerY } }); }, { iconSrc: GAME_ACTION_ICONS.RETURN_RESOURCE, hotkey: 'r' }); 
}


// --- Input Handling Functions ---
function handleViewportMouseDown(e) {
    if (e.target.closest('.js-rts-menu-base-container') || e.target.closest('#command-card-container') || e.target.closest('#ui-left-elements')) return; 
    if (currentGameState !== 'in_game' || !gameInitialized || gameOver) return;
    
    if (gameMode === 'ai_vs_ai' && e.button === 0 && !e.target.closest('.game-object')) { 
        isPanning = true; lastPanX = e.clientX; lastPanY = e.clientY; if(viewportElement) viewportElement.classList.add('panning'); e.preventDefault(); return; 
    }
    if (e.button === 0) { // Left Click
        if (placingBuildingType || placingFarm) { 
            if (finalizePlacement) finalizePlacement(); e.stopPropagation(); return; 
        } 
        if (!e.target.closest('.game-object')) { 
            if (deselectAll) deselectAll(); 
            isPanning = true; lastPanX = e.clientX; lastPanY = e.clientY; if(viewportElement) viewportElement.classList.add('panning'); e.preventDefault(); 
        }
    }
}
function handleViewportMouseMove(e) {
    if (currentGameState !== 'in_game' || !gameInitialized || gameOver) return;
    if (gameMode === 'human_vs_ai' && (placingBuildingType || placingFarm)) { 
        const { x, y } = viewportToWorld(e.clientX, e.clientY); 
        if (updatePlacementPreview) updatePlacementPreview(x, y); 
    }
    else if (isPanning) { 
        const dx = e.clientX - lastPanX; const dy = e.clientY - lastPanY; 
        viewOffsetX += dx; viewOffsetY += dy; 
        lastPanX = e.clientX; lastPanY = e.clientY; 
        clampCamera(); applyTransform(); 
    }
}
function handleViewportMouseUp(e) { 
    if (currentGameState !== 'in_game' || !gameInitialized || gameOver) return; 
    if (e.button === 0 && isPanning) { isPanning = false; if(viewportElement) viewportElement.classList.remove('panning'); } 
}
function handleViewportMouseLeave() { if (isPanning) { isPanning = false; if(viewportElement) viewportElement.classList.remove('panning'); } }
function handleViewportWheel(event) { 
    if (currentGameState !== 'in_game' || !gameInitialized || gameOver) return; 
    try { 
        event.preventDefault(); 
        const delta = event.deltaY < 0 ? 1.1 : 1 / 1.1; 
        const mouseX = event.clientX; const mouseY = event.clientY; 
        const rect = viewportElement.getBoundingClientRect(); 
        const mouseViewportX = mouseX - rect.left; 
        const mouseViewportY = mouseY - rect.top; 
        const worldXBefore = (mouseViewportX - viewOffsetX) / scale; 
        const worldYBefore = (mouseViewportY - viewOffsetY) / scale; 
        const newScale = Math.max(MIN_SCALE, Math.min(MAX_SCALE, scale * delta)); 
        viewOffsetX = mouseViewportX - worldXBefore * newScale; 
        viewOffsetY = mouseViewportY - worldYBefore * newScale; 
        scale = newScale; 
        clampCamera(); applyTransform(); 
    } catch (err) { console.error("MAIN.JS: Zoom Error:", err); } 
}

function gameHandleContextMenu(event) {
    if (currentGameState !== 'in_game' || gameMode === 'ai_vs_ai' || !gameInitialized || gameOver || !contextMenu) return;
    
    const clickedOnMenu = event.target.closest('.js-rts-menu-base-container') || event.target.closest('#command-card-container');
    if (event.target.closest('#ui-left-elements') || clickedOnMenu) {
         if (clickedOnMenu) event.preventDefault();
         return;
    }

    if (placingBuildingType || placingFarm) {
        cancelPlacement(); 
        event.preventDefault(); 
        return;
    }

    const worldPos = viewportToWorld(event.clientX, event.clientY);
    const clickedOnGameObject = event.target.closest('.game-object');
    let builderFn = null;
    let contextData = { worldPos, eventTarget: event.target, clickedOnGameObject };

    if (selectedUnit && selectedUnit.faction === playerFactionKey) {
        event.preventDefault(); 
        
        if (clickedOnGameObject) {
            const targetUnitData = units.find(u => u.element === clickedOnGameObject && u.hp > 0);
            const targetBuildingData = buildings.find(b => b.element === clickedOnGameObject && b.hp > 0);
            const targetResourceData = resources.find(r => r.element === clickedOnGameObject);
            const targetConstructionData = constructions.find(c => c.element === clickedOnGameObject);

            if (targetUnitData && targetUnitData.faction !== playerFactionKey) { 
                if (selectedUnit.attackDamage > 0) { builderFn = (ctxData) => buildAttackContextMenu(ctxData, targetUnitData); }
                else { builderFn = buildMoveContextMenu; }
            } else if (targetBuildingData && targetBuildingData.faction !== playerFactionKey) { 
                 if (selectedUnit.attackDamage > 0) { builderFn = (ctxData) => buildAttackContextMenu(ctxData, targetBuildingData); }
                 else { builderFn = buildMoveContextMenu; }
            } else if (targetResourceData && selectedUnit.unitType === 'worker') { 
                if (!(targetResourceData.type === 'mine' && resourceData.health <= 0)) { // resourceData was undefined here, should be targetResourceData
                    builderFn = (ctxData) => buildHarvestContextMenu(ctxData, targetResourceData);
                } else { builderFn = buildMoveContextMenu; }
            } else if (targetConstructionData && targetConstructionData.faction === playerFactionKey && selectedUnit.canBuild) { 
                 if (!targetConstructionData.assignedWorker || targetConstructionData.assignedWorker === selectedUnit) {
                    builderFn = (ctxData) => buildAssistConstructionContextMenu(ctxData, targetConstructionData);
                } else { builderFn = buildMoveContextMenu; }
            } else if (targetBuildingData && targetBuildingData.buildingType === 'base' && targetBuildingData.faction === playerFactionKey && selectedUnit.resourceType) { 
                builderFn = (ctxData) => buildReturnResourceContextMenu(ctxData);
            } else { builderFn = buildMoveContextMenu; }
        } else { builderFn = buildMoveContextMenu; }
    } else if (!selectedUnit && clickedOnGameObject) { 
        event.preventDefault();
        const targetUnitData = units.find(u => u.element === clickedOnGameObject && u.hp > 0 && u.faction === playerFactionKey);
        const targetBuildingData = buildings.find(b => b.element === clickedOnGameObject && b.hp > 0 && b.faction === playerFactionKey && b.buildingType !== 'farm' && !b.isConstructing);
        const targetConstructionSite = constructions.find(c => c.element === clickedOnGameObject && c.faction === playerFactionKey);

        if (targetUnitData) { handleUnitClick(targetUnitData); } 
        else if (targetBuildingData) { handleBuildingClick(targetBuildingData); }
        else if (targetConstructionSite) { handleBuildingClick(targetConstructionSite); } 
        return; 
    } else { return; }

    if (builderFn) {
        contextMenu.showRoot({ x: event.clientX, y: event.clientY }, () => builderFn(contextData), event.target);
    }
}

function handleGlobalKeyDown(e) {
    if (e.defaultPrevented && (contextMenu?.isVisible || commandCardMenu?.isVisible)) {
        return; 
    }

    const key = e.key.toLowerCase();

    if (currentGameState === 'main_menu' || currentGameState === 'start_modal') {
        if (key === 'escape' && currentGameState === 'main_menu' && gameInitialized && !gameOver) {
            hideMainMenu();
            e.preventDefault();
        }
        return; 
    }
    
    if (currentGameState !== 'in_game' || !gameInitialized || gameOver) return;
    
    if (keysPressed.hasOwnProperty(key) && (key === 'w' || key === 'a' || key === 's' || key === 'd' || key.startsWith("arrow"))) {
        keysPressed[key] = true;
        if (key.startsWith("arrow")) e.preventDefault(); 
    }
    if (key === '`') { if (toggleDebugPanel) toggleDebugPanel(); e.preventDefault(); return; }

    if (gameMode === 'human_vs_ai' && !e.target.matches('input, textarea')) {
        // Global Game Hotkeys 
        if (selectedBuilding && selectedBuilding.faction === playerFactionKey && !selectedBuilding.isConstructing) {
            const bldgStaticData = FACTION_DATA[playerFactionKey].buildings[selectedBuilding.buildingType];
            if (bldgStaticData?.trains) {
                const unitTypeToTrain = bldgStaticData.trains;
                const unitStaticData = FACTION_DATA[playerFactionKey].units[unitTypeToTrain];
                if (unitStaticData?.hotkey && key === unitStaticData.hotkey) {
                    if (isDebugVisible) console.log(`MAIN.JS: Global hotkey - Train ${unitTypeToTrain} from ${selectedBuilding.buildingType}`);
                    trainUnit(unitTypeToTrain, selectedBuilding); 
                    updateCommandCard(); 
                    e.preventDefault(); return;
                }
            }
        } else if (selectedUnit && selectedUnit.unitType === 'worker' && selectedUnit.faction === playerFactionKey) {
            if (key === 'b') { 
                if (isDebugVisible) console.log("MAIN.JS: Global hotkey - Trigger Worker Build Menu (B)");
                if (commandCardMenu && commandCardMenu.isVisible) {
                    const buildButtonData = commandCardMenu.buttonsData.find(bd => bd.label.toLowerCase() === "build" && bd.options.opensSubmenu);
                    if (buildButtonData && buildButtonData.callback && !buildButtonData.disabled) { buildButtonData.callback(); }
                } else { 
                    updateCommandCard(); 
                    setTimeout(() => { 
                         const buildButtonData = commandCardMenu?.buttonsData.find(bd => bd.label.toLowerCase() === "build" && bd.options.opensSubmenu);
                         if (buildButtonData && buildButtonData.callback && !buildButtonData.disabled) buildButtonData.callback();
                    }, 50); 
                }
                e.preventDefault(); return;
            }
            
            for (const buildingKey in FACTION_DATA[playerFactionKey].buildings) {
                const buildingData = FACTION_DATA[playerFactionKey].buildings[buildingKey];
                if (buildingData.hotkey && key === buildingData.hotkey) {
                    if (aiCanAffordGeneric(playerFactionKey, buildingKey, false, p1Wood, p1Coal, 0,0) && !placingBuildingType && !placingFarm) {
                        if (isDebugVisible) console.log(`MAIN.JS: Global hotkey - Start placing ${buildingKey}`);
                        startPlacingBuilding(buildingKey); 
                        e.preventDefault(); return;
                    } else if (isDebugVisible) {
                        console.log(`MAIN.JS: Global hotkey - Cannot place ${buildingKey} - cost or already placing.`);
                    }
                }
            }
        }

        if (key === 'escape') {
            if (contextMenu && contextMenu.isVisible) { contextMenu.hide(); e.preventDefault(); return; }
            if (commandCardMenu && commandCardMenu.isVisible && commandCardMenu.menuStateStack.length > 0) { /* JSRTSMenu's Esc handles submenus */ }
            else if (commandCardMenu && commandCardMenu.isVisible && commandCardMenu.menuStateStack.length === 0){ commandCardMenu.hide(); e.preventDefault(); return;} 
            else if (placingBuildingType || placingFarm) { if(cancelPlacement) cancelPlacement(); e.preventDefault(); return;}
            else if (selectedUnit || selectedBuilding) { if(deselectAll) deselectAll(); e.preventDefault(); return;}
            else { showMainMenu(); e.preventDefault(); return;} 
        }
    }
}
function handleGlobalKeyUp(e) { 
    const key = e.key.toLowerCase();
    if (keysPressed.hasOwnProperty(key)) { keysPressed[key] = false; } 
}

function handleUnitClick(unit) { 
    if (gameMode === 'ai_vs_ai') return; 
    if (selectedUnit === unit) return; 
    deselectAll(); 
    setSelectedUnit(unit); 
    if(unit.element) unit.element.classList.add('selected'); 
    if (unit.hpContainer) unit.hpContainer.style.display = 'block'; 
    updateSelectionInfo(); 
    updateCommandCard(); 
}
function handleBuildingClick(buildingData) { 
    if (gameMode === 'ai_vs_ai') return; 
    if (buildingData.buildingType === 'farm' && !buildingData.isConstructing) { 
        deselectAll(); 
        return; 
    }
    if (selectedBuilding === buildingData) return; 
    deselectAll(); 
    setSelectedBuilding(buildingData); 
    if (selectedBuilding.element) { 
        selectedBuilding.element.classList.add('selected-building'); 
        if (selectedBuilding.hpContainer) selectedBuilding.hpContainer.style.display = 'block'; 
    } 
    updateSelectionInfo(); 
    updateCommandCard(); 
}
function deselectAll() { 
    if (gameMode === 'ai_vs_ai') return; 
    if (selectedUnit) { 
        if(selectedUnit.element) selectedUnit.element.classList.remove('selected'); 
        if (selectedUnit.hpContainer && selectedUnit.hp === selectedUnit.maxHp) { 
            selectedUnit.hpContainer.style.display = 'none'; 
        }
        setSelectedUnit(null);
    } 
    if (selectedBuilding) { 
        if (selectedBuilding.element) { 
            selectedBuilding.element.classList.remove('selected-building'); 
            if (selectedBuilding.hpContainer && selectedBuilding.hp === selectedBuilding.maxHp && !selectedBuilding.isConstructing) { 
                 selectedBuilding.hpContainer.style.display = 'none';
            }
        } 
        setSelectedBuilding(null);
    } 
    if (placingBuildingType || placingFarm) { 
        cancelPlacement(); 
    } 
    updateSelectionInfo(); 
    updateCommandCard(); 
}

// --- Camera & Placement Functions ---
function clampCamera() { if (!gameInitialized || !viewportElement) return; const worldWidthScaled = currentWorldWidth * scale; const worldHeightScaled = currentWorldHeight * scale; const minX = viewportElement.clientWidth - worldWidthScaled; const minY = viewportElement.clientHeight - worldHeightScaled; viewOffsetX = (minX > 0) ? minX / 2 : Math.min(0, Math.max(minX, viewOffsetX)); viewOffsetY = (minY > 0) ? minY / 2 : Math.min(0, Math.max(minY, viewOffsetY)); }
function applyTransform() { if(gameWorld) gameWorld.style.transform = `translate(${viewOffsetX.toFixed(2)}px, ${viewOffsetY.toFixed(2)}px) scale(${scale.toFixed(3)})`; }
function viewportToWorld(clientX, clientY) { if (!viewportElement) return {x:0, y:0}; const rect = viewportElement.getBoundingClientRect(); const worldX = (clientX - rect.left - viewOffsetX) / scale; const worldY = (clientY - rect.top - viewOffsetY) / scale; return { x: worldX, y: worldY }; }
function centerViewOn(worldX, worldY) { scale = 1.0; viewOffsetX = viewportElement.clientWidth / 2 - worldX * scale; viewOffsetY = viewportElement.clientHeight / 2 - worldY * scale; clampCamera(); applyTransform(); }

function startPlacingBuilding(type) { 
    if (gameMode === 'ai_vs_ai') return; 
    if (placingBuildingType || placingFarm) return; 

    const buildingStaticData = FACTION_DATA[playerFactionKey].buildings[type];
    if (!buildingStaticData) { console.error("MAIN.JS: No static data for building type: " + type); return; }
    const cost = buildingStaticData.cost;

    if (p1Wood < (cost.wood || 0) || p1Coal < (cost.coal || 0)) {
        showTemporaryMessage(`Not enough resources for ${type}!`);
        updateCommandCard(); 
        return; 
    }
    p1Wood -= (cost.wood || 0);
    p1Coal -= (cost.coal || 0);
    updateResourceDisplay(); 

    if (type === 'farm') { 
        placingFarm = true; 
        placingBuildingType = 'farm'; 
        if (farmPreviewTiles.length === 0) { 
            for (let i = 0; i < FARM_GRID_DIM * FARM_GRID_DIM; i++) { 
                const p = document.createElement('div'); 
                p.classList.add('farm-preview-tile', 'preview-invalid'); 
                p.textContent = getEmojiForFaction('farm', playerFactionKey); 
                p.style.pointerEvents = 'none'; 
                gameWorld.appendChild(p); farmPreviewTiles.push(p); 
            } 
        } else { 
            farmPreviewTiles.forEach(p => { if(p) { p.style.display = 'flex'; p.classList.remove('preview-valid'); p.classList.add('preview-invalid'); } }); 
        } 
        farmValidPlacement = false; 
        farmGroupBox = null; 
    } else { 
        placingBuildingType = type; 
        placementData = { type: type, size: buildingStaticData.size, valid: false, finalBox: null }; 
        placementPreviewElement = document.createElement('div'); 
        placementPreviewElement.classList.add('game-object', 'building-preview', type); 
        placementPreviewElement.textContent = getEmojiForFaction(type, playerFactionKey); 
        placementPreviewElement.style.width = `${buildingStaticData.size.w}px`; 
        placementPreviewElement.style.height = `${buildingStaticData.size.h}px`; 
        const tempStyleCheck = document.createElement('div'); 
        tempStyleCheck.classList.add(type); 
        gameWorld.appendChild(tempStyleCheck); 
        placementPreviewElement.style.fontSize = window.getComputedStyle(tempStyleCheck).fontSize; 
        gameWorld.removeChild(tempStyleCheck); 
        placementPreviewElement.style.pointerEvents = 'none'; 
        gameWorld.appendChild(placementPreviewElement); 
    } 
    if (commandCardMenu) commandCardMenu.hide(); 
    updateSelectionInfo(); 
}
function updatePlacementPreview(worldX, worldY) { 
    if (gameMode === 'ai_vs_ai' || (!placingBuildingType && !placingFarm)) return; 
    const checkOverlap = (boxToCheck) => { 
        if (resources.some(r => r.element?.isConnected && checkAABBOverlap(boxToCheck, r.box || getElementWorldBoundingBox(r.element), COLLISION_PADDING))) return true; 
        // Check against completed buildings AND active construction sites
        if (buildings.some(b => b.element && (!b.isConstructing || (b.isConstructing && b.element.classList.contains('construction-site'))) && checkAABBOverlap(boxToCheck, b.box || getElementWorldBoundingBox(b.element), COLLISION_PADDING))) return true; 
        return false; 
    }; 
    const checkBounds = (boxToCheck) => { return boxToCheck.xMin >= 0 && boxToCheck.xMax <= currentWorldWidth && boxToCheck.yMin >= 0 && boxToCheck.yMax <= currentWorldHeight; }; 
    
    if (placingFarm) { 
        const farmSize = FARM_TOTAL_SIZE; 
        const gx = worldX - farmSize / 2; 
        const gy = worldY - farmSize / 2; 
        farmGroupBox = { xMin: gx, yMin: gy, xMax: gx + farmSize, yMax: gy + farmSize, width: farmSize, height: farmSize }; 
        farmValidPlacement = !checkOverlap(farmGroupBox) && checkBounds(farmGroupBox); 
        farmPreviewTiles.forEach((p, idx) => { 
            if(!p) return; 
            const dx = idx % FARM_GRID_DIM; 
            const dy = Math.floor(idx / FARM_GRID_DIM); 
            placeElementInWorld(p, gx + dx * FARM_TILE_SIZE, gy + dy * FARM_TILE_SIZE); 
            p.classList.toggle('preview-valid', farmValidPlacement); 
            p.classList.toggle('preview-invalid', !farmValidPlacement); 
            p.style.display = 'flex'; 
        }); 
        placementData = { type: 'farm', size: {w: farmSize, h: farmSize}, valid: farmValidPlacement, finalBox: farmGroupBox }; 
    } else if (placingBuildingType && placementPreviewElement) { 
        const type = placingBuildingType; 
        const size = FACTION_DATA[playerFactionKey].buildings[type].size; 
        const potentialBox = { 
            xMin: worldX - size.w / 2, yMin: worldY - size.h / 2, 
            xMax: worldX + size.w / 2, yMax: worldY + size.h / 2, 
            width: size.w, height: size.h, centerX: worldX, centerY: worldY 
        }; 
        placeElementInWorld(placementPreviewElement, potentialBox.xMin, potentialBox.yMin); 
        placementData.valid = !checkOverlap(potentialBox) && checkBounds(potentialBox); 
        placementPreviewElement.classList.toggle('valid', placementData.valid); 
        placementPreviewElement.classList.toggle('preview-invalid', !placementData.valid); 
        placementData.finalBox = potentialBox; 
    } 
}
function finalizePlacement() { 
    if (gameMode === 'ai_vs_ai') return; 
    const currentPlacementType = placingBuildingType; 
    if (!currentPlacementType || !placementData) { cancelPlacement(); return; } 
    if (!placementData.valid || !placementData.finalBox) { 
        showTemporaryMessage("Cannot place building here!");
        cancelPlacement(); 
        return; 
    } 
    createConstructionSite(currentPlacementType, placementData.finalBox, playerFactionKey, selectedUnit); 
    
    if (currentPlacementType === 'farm') { 
        farmPreviewTiles.forEach(p => { if(p && p.parentNode === gameWorld) gameWorld.removeChild(p); }); 
        farmPreviewTiles = []; 
        placingFarm = false; 
    } else if (placementPreviewElement) { 
        if (placementPreviewElement.parentNode === gameWorld) gameWorld.removeChild(placementPreviewElement); 
        placementPreviewElement = null; 
    } 
    placingBuildingType = null; 
    placementData = null; 
    farmGroupBox = null; 
    if (selectedUnit) updateCommandCard(); 
    else deselectAll(); 
    updateSelectionInfo(); 
}
function cancelPlacement() { 
    if (gameMode === 'ai_vs_ai') return; 
    const currentPlacementType = placingBuildingType; 
    if (!currentPlacementType) return; 

    const buildingStaticData = FACTION_DATA[playerFactionKey].buildings[currentPlacementType];
    if (buildingStaticData?.cost) {
        p1Wood += (buildingStaticData.cost.wood || 0);
        p1Coal += (buildingStaticData.cost.coal || 0);
        updateResourceDisplay();
    }
    
    if (currentPlacementType === 'farm') { 
        farmPreviewTiles.forEach(p => { if(p && p.parentNode === gameWorld) gameWorld.removeChild(p); }); 
        farmPreviewTiles = []; 
        placingFarm = false; 
    } else if (placementPreviewElement) { 
        if (placementPreviewElement.parentNode === gameWorld) gameWorld.removeChild(placementPreviewElement); 
        placementPreviewElement = null; 
    } 
    placingBuildingType = null; 
    placementData = null; 
    farmGroupBox = null; 
    if (selectedUnit) updateCommandCard(); 
    updateSelectionInfo(); 
}

// --- DOM Helper Functions ---
function createHpBarElement() { const c = document.createElement('div'); c.className = 'hp-bar-container'; const i = document.createElement('div'); i.className = 'hp-bar-inner'; c.appendChild(i); return { hpContainer: c, hpInnerElem: i }; }
function createProgressBarElement() { const c = document.createElement('div'); c.className = 'progress-bar-container'; const i = document.createElement('div'); i.className = 'progress-bar-inner'; c.appendChild(i); return { container: c, inner: i }; }
function placeElementInWorld(element, worldX, worldY) { if(element) {element.style.left = `${worldX}px`; element.style.top = `${worldY}px`; }}
function getElementWorldBoundingBox(element) { 
    if (!element || typeof element.getBoundingClientRect !== 'function') { return { xMin: 0, yMin: 0, xMax: 0, yMax: 0, width: 0, height: 0, centerX: 0, centerY: 0 }; } 
    try { 
        const worldX = parseFloat(element.style.left || 0); 
        const worldY = parseFloat(element.style.top || 0); 
        let width = element.offsetWidth; 
        let height = element.offsetHeight; 
        if(width === 0 || height === 0 || !Number.isFinite(width) || !Number.isFinite(height)) { 
            const style = window.getComputedStyle(element); 
            const buildingType = element.dataset.buildingType; 
            const factionKey = element.dataset.faction || playerFactionKey; 
            const buildingStaticData = buildingType && FACTION_DATA[factionKey] ? FACTION_DATA[factionKey].buildings[buildingType] : null; 
            if (buildingStaticData?.size) { 
                width = buildingStaticData.size.w; height = buildingStaticData.size.h; 
            } else if (element.classList.contains('unit')) { 
                width = 36; height = 36; 
            } else if (element.classList.contains('resource')) { 
                width = element.classList.contains('tree') ? 100 : 140; 
                height = element.classList.contains('tree') ? 100 : 140; 
            } else { 
                width = parseFloat(style.width) || 0; 
                height = parseFloat(style.height) || 0; 
            } 
        } 
        width = Number.isFinite(width) ? width : 0; 
        height = Number.isFinite(height) ? height : 0; 
        return { xMin: worldX, yMin: worldY, xMax: worldX + width, yMax: worldY + height, width: width, height: height, centerX: worldX + width / 2, centerY: worldY + height / 2 }; 
    } catch (error) { 
        console.error("MAIN.JS: getBoundingBox error:", element, error); 
        return { xMin: 0, yMin: 0, xMax: 0, yMax: 0, width: 0, height: 0, centerX: 0, centerY: 0 }; 
    } 
}
function updateHpBar(entity) { 
    if (entity.hpContainer && entity.hpInner && entity.maxHp > 0) { 
        const hpPercent = Math.max(0, (entity.hp / entity.maxHp)); 
        entity.hpInner.style.width = `${hpPercent * 100}%`; 
        
        const shouldShowHpBar = entity.hp < entity.maxHp || entity === selectedUnit || entity === selectedBuilding || (entity.isConstructing && entity.hp < entity.maxHp);

        if (shouldShowHpBar) {
            entity.hpContainer.style.display = 'block'; 
            if (hpPercent > 0.6) { entity.hpInner.style.backgroundColor = 'var(--progress-hp-healthy)'; } 
            else if (hpPercent > 0.3) { entity.hpInner.style.backgroundColor = 'var(--progress-hp-damaged)'; } 
            else { entity.hpInner.style.backgroundColor = 'var(--progress-hp-critical)'; } 
        } else {
            entity.hpContainer.style.display = 'none'; 
        }
    } 
}

// --- Debug UI ---
function toggleDebugPanel() { 
    isDebugVisible = !isDebugVisible; 
    if (debugPanel) debugPanel.classList.toggle('visible', isDebugVisible); 
    if (isDebugVisible) updateDebugPanel(); 
}
function updateDebugPanel() { 
    if (!isDebugVisible || !debugPanel) return; 
    try { 
        if(debugCurrentGameState) debugCurrentGameState.textContent = currentGameState;
        if(debugPlayerFaction && FACTION_DATA[playerFactionKey]) debugPlayerFaction.textContent = FACTION_DATA[playerFactionKey].name; 
        if(debugOpponentFaction && FACTION_DATA[opponentFactionKey]) debugOpponentFaction.textContent = FACTION_DATA[opponentFactionKey].name;
        if(debugWorldSize) debugWorldSize.textContent = `${currentWorldWidth}x${currentWorldHeight}`; 
        if(debugUnitCount) debugUnitCount.textContent = units.length; 
        if(debugP1Wood) debugP1Wood.textContent = p1Wood; 
        if(debugP1Coal) debugP1Coal.textContent = p1Coal; 
        if(debugP1Food) debugP1Food.textContent = p1CurrentFood; 
        if(debugP1FoodCap) debugP1FoodCap.textContent = p1FoodCapacity; 
        if(debugP2Wood) debugP2Wood.textContent = p2Wood; 
        if(debugP2Coal) debugP2Coal.textContent = p2Coal; 
        if(debugP2Food) debugP2Food.textContent = p2CurrentFood; 
        if(debugP2FoodCap) debugP2FoodCap.textContent = p2FoodCapacity; 
        if(debugP1BuildingCount) debugP1BuildingCount.textContent = `${buildings.filter(b => b.faction === p1FactionKey && !b.isConstructing).length}`; 
        if(debugP2BuildingCount) debugP2BuildingCount.textContent = `${buildings.filter(b => b.faction === p2FactionKey && !b.isConstructing).length}`; 
        if(debugResourceNodesCount) debugResourceNodesCount.textContent = resources.filter(r => r.element?.isConnected).length; 
        if(debugConstructionCount) debugConstructionCount.textContent = constructions.length; 
        
        if (selectedUnit && gameMode === 'human_vs_ai') { 
            if(debugSelectedId) debugSelectedId.textContent = selectedUnit.id; 
            if(debugSelectedType) debugSelectedType.textContent = selectedUnit.unitType; 
            if(debugSelectedFactionSel) debugSelectedFactionSel.textContent = selectedUnit.faction; 
            if(debugSelectedHp) debugSelectedHp.textContent = `${selectedUnit.hp}/${selectedUnit.maxHp}`; 
            if(debugSelectedState) debugSelectedState.textContent = selectedUnit.state; 
            if(debugSelectedTarget) debugSelectedTarget.textContent = selectedUnit.target ? `${selectedUnit.target.x.toFixed(0)}, ${selectedUnit.target.y.toFixed(0)}` : 'None'; 
        } else if (selectedBuilding && gameMode === 'human_vs_ai') { 
            if(debugSelectedId) debugSelectedId.textContent = selectedBuilding.id; 
            if(debugSelectedType) debugSelectedType.textContent = selectedBuilding.buildingType; 
            if(debugSelectedFactionSel) debugSelectedFactionSel.textContent = selectedBuilding.faction; 
            if(debugSelectedHp) debugSelectedHp.textContent = `${selectedBuilding.hp}/${selectedBuilding.maxHp}`; 
            let sState = 'Idle';
            if (selectedBuilding.isConstructing) {
                 sState = `Constructing (${(selectedBuilding.progress && selectedBuilding.buildTime ? (selectedBuilding.progress / selectedBuilding.buildTime * 100) : 0).toFixed(0)}%)`;
            } else if (selectedBuilding.isTraining) {
                 sState = `Training (${(selectedBuilding.trainingProgress && selectedBuilding.trainingTotalTime ? (selectedBuilding.trainingProgress / selectedBuilding.trainingTotalTime * 100) : 0).toFixed(0)}%)`;
            }
            if(debugSelectedState) debugSelectedState.textContent = sState; 
            if(debugSelectedTarget) debugSelectedTarget.textContent = 'N/A';
        } else { 
            if(debugSelectedId) debugSelectedId.textContent = 'N/A'; 
            if(debugSelectedType) debugSelectedType.textContent = 'N/A'; 
            if(debugSelectedFactionSel) debugSelectedFactionSel.textContent = 'N/A'; 
            if(debugSelectedHp) debugSelectedHp.textContent = 'N/A'; 
            if(debugSelectedState) debugSelectedState.textContent = 'N/A'; 
            if(debugSelectedTarget) debugSelectedTarget.textContent = 'N/A'; 
        } 
    } catch (e) { console.error("MAIN.JS: Debug panel update error:", e)} 
}

// --- Game Over Display ---
function showGameOver(winnerFactionKey) { 
    setGameInitialized(false); 
    setGameOver(true);       
    const winnerName = winnerFactionKey === "Draw" ? "It's a Draw!" : (FACTION_DATA[winnerFactionKey]?.name || winnerFactionKey) + " Wins!"; 
    if(gameOverMessageDiv) {
        gameOverMessageDiv.innerHTML = `<h2>Game Over!</h2><p>${winnerName}</p><button id="gameOverPlayAgain">Play Again?</button>`; 
        gameOverMessageDiv.style.display = 'block';
        const playAgainBtn = document.getElementById('gameOverPlayAgain');
        if (playAgainBtn) {
            playAgainBtn.onclick = () => { 
                gameOverMessageDiv.style.display = 'none';
                if(modalOverlay) modalOverlay.style.display = 'flex'; 
                setCurrentGameState('start_modal');
                 if (commandCardMenu) commandCardMenu.hide();
                if (contextMenu) contextMenu.hide();
                if (gameWorld) gameWorld.innerHTML = ''; 
            };
        }
    }
    if (commandCardMenu) commandCardMenu.hide();
    if (contextMenu) contextMenu.hide();
}

/**
 * Helper to show a temporary message on screen (e.g., "Not enough wood!")
 */
function showTemporaryMessage(message, duration = 2000) {
    let msgDiv = document.getElementById('temp-message-div');
    if (!msgDiv) {
        msgDiv = document.createElement('div');
        msgDiv.id = 'temp-message-div';
        Object.assign(msgDiv.style, {
            position: 'fixed', bottom: '70px', left: '50%',
            transform: 'translateX(-50%)', padding: '10px 20px',
            backgroundColor: 'rgba(200, 0, 0, 0.8)', color: 'white',
            borderRadius: '5px', zIndex: '15000',
            transition: 'opacity 0.5s ease-out', pointerEvents: 'none'
        });
        document.body.appendChild(msgDiv);
    }
    msgDiv.textContent = message;
    msgDiv.style.opacity = '1';
    
    if (msgDiv.hideTimeout) clearTimeout(msgDiv.hideTimeout);
    if (msgDiv.removeTimeout) clearTimeout(msgDiv.removeTimeout);

    msgDiv.hideTimeout = setTimeout(() => {
        if(msgDiv) msgDiv.style.opacity = '0';
    }, duration - 500); 
    msgDiv.removeTimeout = setTimeout(() => {
        if (msgDiv && msgDiv.parentNode) {
            msgDiv.parentNode.removeChild(msgDiv);
        }
    }, duration);
}

// --- Utility: AABB Collision Check (used by placement logic) ---
function checkAABBOverlap(box1, box2, padding = 0) { 
    if (!box1 || !box2 || box1.width === 0 || box2.width === 0) return false; 
    return ( 
        box1.xMin < box2.xMax + padding && 
        box1.xMax > box2.xMin - padding && 
        box1.yMin < box2.yMax + padding && 
        box1.yMax > box2.yMin - padding 
    ); 
}

// Utility function to calculate current food used by a faction (needed by UI for display and JSRTSMenu builders)
function calculateCurrentFood(factionKeyToCalc) { 
    if (!FACTION_DATA[factionKeyToCalc] || !FACTION_DATA[factionKeyToCalc].units) return 0;
    return units.reduce((sum, u) => sum + (u.faction === factionKeyToCalc ? (FACTION_DATA[factionKeyToCalc].units[u.unitType]?.foodCost || 0) : 0), 0); 
}

// Utility function to calculate total food capacity for a faction (needed by UI for display and JSRTSMenu builders)
function calculateFoodCapacity(factionKeyToCalc) { 
    let capacity = 0; 
    if (!FACTION_DATA[factionKeyToCalc] || !FACTION_DATA[factionKeyToCalc].buildings) return STARTING_FOOD_CAP;
    buildings.forEach(b => { 
        if (b.faction === factionKeyToCalc && !b.isConstructing && b.hp > 0) { 
            const data = FACTION_DATA[factionKeyToCalc].buildings[b.buildingType]; 
            if (data?.provides_food) { 
                capacity += data.provides_food; 
            } 
        } 
    }); 
    return Math.max(STARTING_FOOD_CAP, capacity); 
}
