// js/menu-component/rts-menu.js
// Contains the JSRTSMenu class and CooldownManager.
// This is a self-contained UI component.

"use strict";

// --- Icon Placeholders (or actual SVGs/paths if you have them) ---
// These are default icons that JSRTSMenu can use if items are given these keys as iconSrc.
// Your game-specific icons (GAME_ACTION_ICONS) will be defined in game-data.js and passed to JSRTSMenu.
const RTS_MENU_ICONS = { 
    SAVE:'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 16 16"><rect width="16" height="16" fill="%234CAF50"/></svg>',
    LOAD:'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 16 16"><rect width="16" height="16" fill="%232196F3"/></svg>',
    SETTINGS:'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 16 16"><rect width="16" height="16" fill="%23FFC107"/></svg>',
    QUIT:'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 16 16"><rect width="16" height="16" fill="%23F44336"/></svg>',
    ACTION:'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 16 16"><rect width="16" height="16" fill="%239C27B0"/></svg>',
    TOOL:'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 16 16"><rect width="16" height="16" fill="%23795548"/></svg>',
    CMD:'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 16 16"><rect width="16" height="16" fill="%23607D8B"/></svg>',
    ALERT:'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 16 16"><rect width="16" height="16" fill="%23E91E63"/></svg>',
    ADD:'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 16 16"><rect width="16" height="16" fill="%23FF9800"/></svg>',
    INFO:'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 16 16"><rect width="16" height="16" fill="%2300BCD4"/></svg>',
    BACK:'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="%2303A9F4" viewBox="0 0 24 24"><path d="M20 11H7.83l5.59-5.59L12 4l-8 8 8 8 1.41-1.41L7.83 13H20v-2z"/></svg>' 
};

/**
 * Manages cooldowns for abilities or actions.
 * This class is used by JSRTSMenu to track and display cooldowns on menu items.
 */
class CooldownManager { 
    constructor() { 
        this.cooldowns = new Map(); 
    } 
    
    /**
     * Starts a cooldown for a given ability.
     * @param {string} abilityId - Unique identifier for the ability.
     * @param {number} durationSeconds - Duration of the cooldown in seconds.
     */
    start(abilityId, durationSeconds) { 
        if (!abilityId || typeof abilityId !== 'string' || durationSeconds <= 0) { 
            // console.warn("CooldownManager: Invalid parameters for start().", {abilityId, durationSeconds}); 
            return; 
        } 
        const endTime = Date.now() + durationSeconds * 1000; 
        this.cooldowns.set(abilityId, endTime); 
    } 
    
    /**
     * Checks if an ability is currently on cooldown.
     * @param {string} abilityId - The ID of the ability.
     * @returns {boolean} True if on cooldown, false otherwise.
     */
    isOnCooldown(abilityId) { 
        if (!abilityId) return false; 
        const endTime = this.cooldowns.get(abilityId); 
        return endTime && Date.now() < endTime; 
    } 
    
    /**
     * Gets the remaining cooldown time in seconds for an ability.
     * @param {string} abilityId - The ID of the ability.
     * @returns {number} Remaining seconds, or 0 if not on cooldown.
     */
    getRemainingSeconds(abilityId) { 
        if (!abilityId) return 0; 
        const endTime = this.cooldowns.get(abilityId); 
        if (endTime && Date.now() < endTime) { 
            return Math.max(0, (endTime - Date.now()) / 1000); 
        } 
        return 0; 
    } 
}

/**
 * @class JSRTSMenu
 * A script-driven, accessible menu system suitable for RTS game UIs
 * and general web application context or action menus.
 */
class JSRTSMenu {
    /**
     * Creates an instance of JSRTSMenu.
     * @param {string} containerId - The ID of the HTML element that will contain the menu.
     *                                This element should have the class `js-rts-menu-base-container`.
     * @param {CooldownManager} cooldownManagerInstance - An instance of CooldownManager.
     */
    constructor(containerId, cooldownManagerInstance) { 
        this.container = document.getElementById(containerId); 
        if (!this.container) { 
            console.error(`JSRTSMenu Error: Menu container element with ID "${containerId}" not found.`); 
            // Potentially create a fallback or throw an error to halt execution if critical
            return; 
        } 
        if (!cooldownManagerInstance || typeof cooldownManagerInstance.isOnCooldown !== 'function') { 
            console.error(`JSRTSMenu Error: Valid CooldownManager instance is required.`); 
            return; 
        }
        this.cooldownManager = cooldownManagerInstance; 
        
        this.buttonsData = []; 
        this.isVisible = false; 
        this.menuStateStack = []; // For managing submenu navigation
        this.currentBuilderFn = null; // The function that populates the current menu view
        this.visualCooldownTimers = new Map(); // Stores interval IDs for updating cooldown visuals
        this.focusedIndex = -1; // Index of the currently focused item
        this.baseMenuId = containerId; // Used for generating unique item IDs
        this.nextItemId = 0; // Counter for unique item IDs

        // Related to the element that triggered the menu sequence (for focus restoration)
        this.triggerElementForCurrentSequence = null; 
        this.lastContextMenuTargetIsBody = null; // Specifically for body right-clicks
        this.currentSequenceAnchor = null; // The element or coordinates the current menu sequence is anchored to

        // Tooltip management
        this.tooltipElement = document.getElementById('js-rts-menu-global-tooltip'); 
        if (!this.tooltipElement) { 
            this.tooltipElement = document.createElement('div'); 
            this.tooltipElement.id = 'js-rts-menu-global-tooltip'; 
            this.tooltipElement.className = 'menu-tooltip'; // Ensure this class is styled in main CSS
            this.tooltipElement.setAttribute('role', 'tooltip'); 
            this.tooltipElement.setAttribute('aria-hidden', 'true'); 
            document.body.appendChild(this.tooltipElement); 
            console.warn("JSRTSMenu Warning: Global tooltip element '#js-rts-menu-global-tooltip' not found, created fallback."); 
        }
        this.tooltipElement.setAttribute('tabindex', '-1'); // Make it non-tabbable but focusable by script if needed
        this.activeTooltipTarget = null; 
        this.tooltipShowTimeout = null; 
        this.tooltipHideTimeout = null; 
        this.tooltipShowDelay = 400; // Milliseconds before showing tooltip

        // Type-ahead search functionality
        this.searchQuery = ''; 
        this.searchTimeout = null; 
        this.searchDelay = 700; // Milliseconds to wait before clearing search query

        // ARIA attributes for the main menu container
        this.container.setAttribute('role', 'menu'); 
        this.container.setAttribute('aria-orientation', 'vertical'); 
        
        this._setupGlobalListeners(); 
    }

    /** Clears the current type-ahead search query and associated timeout. */
    _clearSearchState(logMessage = "JSRTSMenu: Search query cleared.") { 
        clearTimeout(this.searchTimeout); 
        this.searchQuery = ''; 
        this.searchTimeout = null; 
        // Conditional logging: isDebugVisible is defined in game-state.js and set in main.js
        if(logMessage && logMessage.length > 0 && typeof isDebugVisible !== 'undefined' && isDebugVisible) { 
            console.log(logMessage); 
        } 
    }

    /** Sets up global event listeners for menu interactions (click outside, keyboard navigation). */
    _setupGlobalListeners() { 
        // Handles clicks outside the menu to hide it
        document.addEventListener('click', (event) => { 
            if (this.isVisible && !this.container.contains(event.target) && !event.target.closest(`#${this.container.id}`)) { 
                // If the click was on the element that triggered this menu sequence, don't hide.
                if (this.triggerElementForCurrentSequence && this.triggerElementForCurrentSequence.contains(event.target)) { return; } 
                // Special check for command card: if click is inside its dedicated panel, don't hide.
                const commandCardPanel = document.getElementById('command-card-container');
                if (commandCardPanel && commandCardPanel.contains(event.target) && this.container.id === 'command-card-menu-actual-container') {
                     return; 
                }
                this.hide(); 
            } 
        }); 
        
        // Handles keyboard navigation and hotkeys for the menu
        document.addEventListener('keydown', (event) => { 
            if (!this.isVisible) return; // Only process if this menu instance is visible
            
            const activeElement = document.activeElement; 
            // Ignore keydown if focus is inside an input/textarea unless it's this menu container itself
            if (activeElement !== this.container && activeElement && 
                (activeElement.tagName === 'INPUT' || activeElement.tagName === 'TEXTAREA' || activeElement.isContentEditable)) {
                return; 
            }
            
            const pressedKey = event.key.toLowerCase(); 
            let keyHandledByMenu = false; 
            
            // 1. Type-ahead Search (single printable characters, not space, no modifiers)
            if (event.key.length === 1 && event.key !== ' ' && !event.ctrlKey && !event.metaKey && !event.altKey) { 
                event.preventDefault(); 
                event.stopPropagation(); // Prevent game's global listener from processing this as well
                this.searchQuery += pressedKey; 
                this._performSearch(); 
                keyHandledByMenu = true; 
            } 
            if (keyHandledByMenu) return; 
            
            // 2. Hotkeys for currently visible menu items (e.g., 'F1', 'Ctrl+S', or single char like 'b' if defined as hotkey)
            let specificHotkeyMatched = false; 
            if (this.buttonsData.length > 0 && (event.key.length > 1 || event.key === ' ' || event.ctrlKey || event.altKey || event.metaKey )) { 
                for (const btnData of this.buttonsData) { 
                    if (btnData.hotkey && btnData.hotkey.toLowerCase() === pressedKey) { 
                        if (!btnData.disabled && (this._canActivateItem(btnData) || btnData.options?.type === 'checkbox' || btnData.options?.type === 'radio')) { 
                            event.preventDefault(); event.stopPropagation(); 
                            if (btnData.options?.type === 'checkbox' || btnData.options?.type === 'radio') { 
                                const oldCheckedState = btnData.options.checked; this._toggleCheckableItem(btnData); 
                                if (typeof btnData.callback === 'function') { if (btnData.options.type === 'checkbox' || oldCheckedState !== btnData.options.checked) { btnData.callback(btnData.options.checked, btnData); } } 
                            } else { this._executeCallback(btnData); } 
                            specificHotkeyMatched = true; break; 
                        } else if (btnData.options?.abilityId && this.cooldownManager.isOnCooldown(btnData.options.abilityId)) { 
                            event.preventDefault(); event.stopPropagation(); specificHotkeyMatched = true; break; // Hotkey matched but on cooldown
                        } else if (btnData.disabled) { 
                            event.preventDefault(); event.stopPropagation(); specificHotkeyMatched = true; break; // Hotkey matched but item disabled
                        } 
                    } 
                } 
            } 
            if (specificHotkeyMatched) return; 
            
            // 3. Navigation and Activation Keys (Arrow keys, Enter, Space, Escape, Home, End, Tab)
            switch (event.key) { 
                case 'Backspace': 
                    event.preventDefault(); event.stopPropagation(); 
                    if (this.searchQuery.length > 0) { 
                        this.searchQuery = this.searchQuery.slice(0, -1); 
                        if (this.searchQuery.length > 0) { this._performSearch(); } 
                        else { 
                            this._clearSearchState("JSRTSMenu: Search query cleared by backspace."); 
                            const currentFocusedItem = this.buttonsData[this.focusedIndex]; 
                            if (currentFocusedItem && currentFocusedItem.element && !currentFocusedItem.isSeparator && !currentFocusedItem.disabled) { this._setFocus(this.focusedIndex); } 
                            else { this.navigateToFirst(); } 
                        } 
                    } 
                    break; 
                case 'Escape': 
                    event.preventDefault(); event.stopPropagation(); 
                    if (this.searchQuery !== '') { 
                        this._clearSearchState("JSRTSMenu: Escape cleared active search."); 
                        const currentFocusedItem = this.buttonsData[this.focusedIndex]; 
                        if (currentFocusedItem && currentFocusedItem.element && !currentFocusedItem.isSeparator && !currentFocusedItem.disabled) { this._setFocus(this.focusedIndex); } 
                        else { this.navigateToFirst(); } 
                    } else { 
                        if (this.menuStateStack.length > 0) { // If in a submenu
                            const parentState = this.menuStateStack.pop(); 
                            if (parentState && parentState.builder) { 
                                this.triggerElementForCurrentSequence = parentState.overallTriggerElement; 
                                this.currentSequenceAnchor = parentState.parentAnchor; 
                                this.show(this.currentSequenceAnchor, parentState.builder, parentState.triggerItemIndexInParent); 
                            } 
                        } else { this.hide(); } // At root menu, hide
                    } 
                    break; 
                case 'ArrowUp': event.preventDefault(); event.stopPropagation(); this._clearSearchState(null); this.navigate(-1); break; 
                case 'ArrowDown': event.preventDefault(); event.stopPropagation(); this._clearSearchState(null); this.navigate(1); break; 
                case 'Enter': case ' ': event.preventDefault(); event.stopPropagation(); this.activateFocusedItem(); break; 
                case 'Home': event.preventDefault(); event.stopPropagation(); this._clearSearchState(null); this.navigateToFirst(); break; 
                case 'End': event.preventDefault(); event.stopPropagation(); this._clearSearchState(null); this.navigateToLast(); break; 
                case 'Tab': event.preventDefault(); event.stopPropagation(); this.hide(); break; // Tab out of the menu
            } 
        }); 
    }

    /** Performs a search based on `this.searchQuery` and focuses the first match. */
    _performSearch() { clearTimeout(this.searchTimeout); if (!this.searchQuery) { this._clearSearchState("JSRTSMenu: Search query became empty, search stopped."); return; } let firstMatchIndex = -1; for (let i = 0; i < this.buttonsData.length; i++) { const itemData = this.buttonsData[i]; if (itemData.element && !itemData.isSeparator && !itemData.disabled) { const labelText = itemData.label.toLowerCase(); if (labelText.startsWith(this.searchQuery)) { firstMatchIndex = i; break; } } } if (firstMatchIndex !== -1) { this._setFocus(firstMatchIndex); } this.searchTimeout = setTimeout(() => { this._clearSearchState(); }, this.searchDelay); }
    
    /** Generates a unique ID for menu items. */
    _generateUniqueId() { return `${this.baseMenuId}-item-${this.nextItemId++}`; }
    
    /** Checks if a standard (non-checkable) menu item can be activated. */
    _canActivateItem(bd) { return bd && !bd.isSeparator && !bd.disabled && !(bd.options?.abilityId && this.cooldownManager.isOnCooldown(bd.options.abilityId)) && typeof bd.callback === 'function';}
    
    /** Navigates menu items. @param {number} direction - -1 for up, 1 for down. */
    navigate(direction) { const itemCount = this.buttonsData.length; if (itemCount === 0) return; const isNavigable = (index) => { if(index < 0 || index >= this.buttonsData.length) return false; const item = this.buttonsData[index]; return item && item.element && !item.isSeparator && !item.disabled; }; let currentTabbableIndex = this.buttonsData.findIndex(bd => bd.element && bd.element.getAttribute('tabindex') === '0'); if (currentTabbableIndex === -1) { currentTabbableIndex = this.focusedIndex; } let searchIndex = currentTabbableIndex; if (searchIndex === -1) { searchIndex = (direction === 1) ? 0 : itemCount - 1; if (!isNavigable(searchIndex)) { let initialSearch = searchIndex; do { searchIndex = (searchIndex + direction + itemCount) % itemCount; } while (!isNavigable(searchIndex) && searchIndex !== initialSearch); if (!isNavigable(searchIndex)) searchIndex = -1; } } else { let initialSearch = searchIndex; do { searchIndex = (searchIndex + direction + itemCount) % itemCount; } while (!isNavigable(searchIndex) && searchIndex !== initialSearch); if (!isNavigable(searchIndex)) searchIndex = isNavigable(currentTabbableIndex) ? currentTabbableIndex : -1; } this._setFocus(searchIndex); }
    
    /** Navigates to the first activatable menu item. */
    navigateToFirst() { const idx = this.buttonsData.findIndex(b => b.element && !b.isSeparator && !b.disabled); this._setFocus(idx); }
    
    /** Navigates to the last activatable menu item. */
    navigateToLast() { let idx = -1; for (let i = this.buttonsData.length - 1; i >= 0; i--) { const bd = this.buttonsData[i]; if (bd.element && !bd.isSeparator && !bd.disabled) { idx = i; break; } } this._setFocus(idx); }
    
    /** Sets roving tabindex and focus to a menu item. @param {number} newIndex - Index of the item to focus. */
    _setFocus(newIndex) { if (this.focusedIndex !== -1 && this.focusedIndex < this.buttonsData.length && this.buttonsData[this.focusedIndex] && this.buttonsData[this.focusedIndex].element) { this.buttonsData[this.focusedIndex].element.setAttribute('tabindex', '-1'); } this.focusedIndex = newIndex; if (this.focusedIndex !== -1 && this.focusedIndex < this.buttonsData.length && this.buttonsData[this.focusedIndex] && this.buttonsData[this.focusedIndex].element) { const targetButton = this.buttonsData[this.focusedIndex].element; if (targetButton) { targetButton.setAttribute('tabindex', '0'); targetButton.focus({ preventScroll: true }); targetButton.scrollIntoView({ block: 'nearest', inline: 'nearest' }); } } else if (newIndex === -1 || !(this.focusedIndex < this.buttonsData.length && this.buttonsData[this.focusedIndex])) { this.focusedIndex = -1; } }

    /** Activates the currently focused menu item (e.g., on Enter/Space). */
    activateFocusedItem() { const focusedElement = document.activeElement; const focusedBtnData = this.buttonsData.find(bd => bd.element === focusedElement); if (!focusedBtnData || focusedBtnData.disabled) return; const itemType = focusedBtnData.options?.type; if (itemType === 'checkbox' || itemType === 'radio') { const oldCheckedState = focusedBtnData.options.checked; const stateActuallyChanged = this._toggleCheckableItem(focusedBtnData); if (typeof focusedBtnData.callback === 'function') { if (itemType === 'checkbox' || stateActuallyChanged) { focusedBtnData.callback(focusedBtnData.options.checked, focusedBtnData); } } this._clearSearchState(null); } else if (this._canActivateItem(focusedBtnData)) { this._executeCallback(focusedBtnData); } }
    
    /** Toggles the state of a checkbox or radio button item. */
    _toggleCheckableItem(buttonData) { const options = buttonData.options; let stateChanged = false; if (options.type === 'checkbox') { options.checked = !options.checked; buttonData.element.setAttribute('aria-checked', String(options.checked)); stateChanged = true; } else if (options.type === 'radio') { if (!options.checked) { options.checked = true; buttonData.element.setAttribute('aria-checked', 'true'); stateChanged = true; this.buttonsData.forEach(item => { if (item !== buttonData && item.options?.type === 'radio' && item.options?.radioGroup === options.radioGroup && item.options?.checked) { item.options.checked = false; item.element.setAttribute('aria-checked', 'false'); } }); } } return stateChanged; }
    
    /** Executes the callback for a standard menu item or opens a submenu. */
    _executeCallback(buttonData) { 
        if (buttonData.options?.opensSubmenu) { 
            buttonData.element.setAttribute('aria-expanded', 'true'); 
        } 
        const abilityId = buttonData.options?.abilityId; 
        const cooldownSecs = buttonData.options?.cooldownSeconds; 
        if(abilityId && cooldownSecs > 0) { 
            this.cooldownManager.start(abilityId, cooldownSecs); 
            this._updateButtonCooldownState(buttonData); 
        } 
        let callbackResult; 
        if (typeof buttonData.callback === 'function') { 
            callbackResult = buttonData.callback(); 
        } 
        this._clearSearchState(null); 
        if (callbackResult !== true) { // If callback doesn't return true to keep menu open
            if (this.container.id !== 'command-card-menu-actual-container') { // Popups like context menu hide
                this.hide();
            } else if (this.container.id === 'command-card-menu-actual-container' && buttonData.options?.opensSubmenu) {
                // Submenu was opened from command card, command card itself (parent) stays.
            } else if (this.container.id === 'command-card-menu-actual-container') {
                // Standard action on command card. It might persist or be refreshed by updateCommandCard() later.
                // If the action results in deselection, updateCommandCard() will hide it.
            }
        }
    }
    
    /** Clears all items from the menu. */
    clear() { this.focusedIndex = -1; this.visualCooldownTimers.forEach(intervalId => clearInterval(intervalId)); this.visualCooldownTimers.clear(); this.buttonsData = []; this.container.innerHTML = ''; this._clearSearchState(null); }
    
    /** Builds the DOM elements for a menu item. */
    _buildButtonDOM(label, callback, options = {}) { const { type = 'button', checked = false, radioGroup = null, disabled = false, isBackButton = false, tooltip = null, disabledTooltip = null, cooldownSeconds = 0, abilityId = null, iconSrc = null, costText = null, isCostInsufficient = false, hotkey = null, opensSubmenu = false } = options; if (cooldownSeconds > 0 && !abilityId) { console.warn(`JSRTSMenu Warning: Button "${label}" has cooldownSeconds but no abilityId.`); } const initiallyOnCooldown = abilityId ? this.cooldownManager.isOnCooldown(abilityId) : false; const isActuallyDisabled = disabled || isCostInsufficient || initiallyOnCooldown; const wrapper = document.createElement('div'); wrapper.classList.add('js-rts-menu-button-wrapper'); const buttonElement = document.createElement('button'); buttonElement.setAttribute('tabindex', '-1'); let itemRole = 'menuitem'; if (type === 'checkbox') itemRole = 'menuitemcheckbox'; else if (type === 'radio') itemRole = 'menuitemradio'; buttonElement.setAttribute('role', itemRole); if (type === 'checkbox' || type === 'radio') { buttonElement.setAttribute('aria-checked', String(checked)); } if (isActuallyDisabled) { buttonElement.setAttribute('aria-disabled', 'true'); buttonElement.disabled = true; } if (hotkey) { buttonElement.setAttribute('aria-keyshortcuts', hotkey); } if (opensSubmenu) { buttonElement.setAttribute('aria-haspopup', 'true'); buttonElement.setAttribute('aria-expanded', 'false'); } if (type === 'checkbox' || type === 'radio') { const indicatorSpan = document.createElement('span'); indicatorSpan.classList.add('js-rts-menu-item-indicator'); indicatorSpan.setAttribute('aria-hidden', 'true'); buttonElement.appendChild(indicatorSpan); } if (iconSrc) { const img = document.createElement('img'); img.src = iconSrc; img.classList.add('js-rts-menu-button-icon'); img.alt = ''; buttonElement.appendChild(img); } const labelSpan = document.createElement('span'); labelSpan.classList.add('js-rts-menu-button-label'); labelSpan.textContent = label; buttonElement.appendChild(labelSpan); if (costText) { const span = document.createElement('span'); span.classList.add('js-rts-menu-button-cost'); if (isCostInsufficient) span.classList.add('cost-insufficient'); span.textContent = costText; buttonElement.appendChild(span); } if (hotkey && !isBackButton && this.container.id !== 'command-card-menu-actual-container') { const hotkeySpan = document.createElement('span'); hotkeySpan.classList.add('js-rts-menu-button-hotkey'); hotkeySpan.textContent = `(${hotkey.toUpperCase()})`; wrapper.appendChild(hotkeySpan); } if(isBackButton) buttonElement.classList.add('js-rts-menu-back-button'); const mergedOptions = { ...options, type, checked, radioGroup, abilityId, cooldownSeconds, disabled: isActuallyDisabled, disabledOriginal: disabled, opensSubmenu, iconSrc, costText, isCostInsufficient, hotkey, tooltip, disabledTooltip }; const buttonData = { label, callback, disabled: isActuallyDisabled, tooltip, disabledTooltip, element: buttonElement, wrapper, originalLabel: label, isBackButton, hotkey, options: mergedOptions }; buttonElement.addEventListener('click', (event) => { event.stopPropagation(); if (buttonData.disabled) return; if (buttonData.options.type === 'checkbox' || buttonData.options.type === 'radio') { const oldCheckedState = buttonData.options.checked; const stateActuallyChanged = this._toggleCheckableItem(buttonData); if (typeof buttonData.callback === 'function') { if (buttonData.options.type === 'checkbox' || stateActuallyChanged) { buttonData.callback(buttonData.options.checked, buttonData); } } this._clearSearchState(null); } else if (this._canActivateItem(buttonData) && typeof buttonData.callback === 'function') { this._executeCallback(buttonData); } else if (buttonData.options?.opensSubmenu && typeof buttonData.callback === 'function') { this._executeCallback(buttonData); } }); const tooltipContentToUse = (isActuallyDisabled && disabledTooltip) ? disabledTooltip : tooltip; if (tooltipContentToUse && this.tooltipElement) { wrapper.addEventListener('mouseenter', () => { clearTimeout(this.tooltipShowTimeout); this.tooltipShowTimeout = setTimeout(() => { this._showTooltip(wrapper, tooltipContentToUse); }, this.tooltipShowDelay); }); wrapper.addEventListener('mouseleave', () => { clearTimeout(this.tooltipShowTimeout); this._hideTooltip(); }); buttonElement.addEventListener('focus', () => this._showTooltip(wrapper, tooltipContentToUse)); buttonElement.addEventListener('blur', () => this._hideTooltip()); if(this.tooltipElement) buttonElement.setAttribute('aria-describedby', this.tooltipElement.id); } wrapper.insertBefore(buttonElement, wrapper.firstChild); return {buttonData, wrapper}; }
    
    /** Adds a new button to the menu. */
    addButton(label, callback, options = {}) { const {buttonData, wrapper} = this._buildButtonDOM(label, callback, options); this.buttonsData.push(buttonData); this.container.appendChild(wrapper); if(buttonData.options?.abilityId && this.cooldownManager.isOnCooldown(buttonData.options.abilityId)) { this._updateButtonCooldownState(buttonData); } }
    
    /** Shows the global tooltip. */
    _showTooltip(targetWrapper, tooltipContent) { if (!this.tooltipElement || !tooltipContent) return; clearTimeout(this.tooltipHideTimeout); this.activeTooltipTarget = targetWrapper; if (/<[a-z][\s\S]*>/i.test(tooltipContent)) { this.tooltipElement.innerHTML = tooltipContent; } else { this.tooltipElement.textContent = tooltipContent; } if (this.tooltipElement.parentNode !== document.body) { document.body.appendChild(this.tooltipElement); } this.tooltipElement.style.visibility = 'hidden'; this.tooltipElement.style.opacity = '1'; this.tooltipElement.style.left = '0px'; this.tooltipElement.style.top = '0px'; const targetRect = targetWrapper.getBoundingClientRect(); const ttRect = this.tooltipElement.getBoundingClientRect(); this.tooltipElement.style.opacity = '0'; const viewportWidth = window.innerWidth; const viewportHeight = window.innerHeight; const margin = 10; let ttTop, ttLeft; const positionsToTry = ['above', 'below', 'right', 'left']; let bestFit = null; for (const pos of positionsToTry) { switch (pos) { case 'above': ttTop = targetRect.top - ttRect.height - margin; ttLeft = targetRect.left + (targetRect.width / 2) - (ttRect.width / 2); break; case 'below': ttTop = targetRect.bottom + margin; ttLeft = targetRect.left + (targetRect.width / 2) - (ttRect.width / 2); break; case 'right': ttTop = targetRect.top + (targetRect.height / 2) - (ttRect.height / 2); ttLeft = targetRect.right + margin; break; case 'left': ttTop = targetRect.top + (targetRect.height / 2) - (ttRect.height / 2); ttLeft = targetRect.left - ttRect.width - margin; break; default: ttTop=0; ttLeft=0; } if (ttLeft < margin) ttLeft = margin; if (ttLeft + ttRect.width > viewportWidth - margin) ttLeft = viewportWidth - ttRect.width - margin; if (ttTop < margin) ttTop = margin; if (ttTop + ttRect.height > viewportHeight - margin) ttTop = viewportHeight - ttRect.height - margin; if (ttTop >= margin && ttLeft >= margin && ttTop + ttRect.height <= viewportHeight - margin && ttLeft + ttRect.width <= viewportWidth - margin) { bestFit = { top: ttTop, left: ttLeft }; break; } if (!bestFit) { bestFit = {top: ttTop, left: ttLeft}; }} if(bestFit) {this.tooltipElement.style.top = `${bestFit.top}px`; this.tooltipElement.style.left = `${bestFit.left}px`; this.tooltipElement.style.visibility = 'visible'; this.tooltipElement.style.opacity = '1'; this.tooltipElement.setAttribute('aria-hidden', 'false');} }
    
    /** Hides the global tooltip. */
    _hideTooltip() { clearTimeout(this.tooltipShowTimeout); this.activeTooltipTarget = null; this.tooltipHideTimeout = setTimeout(() => { if (this.tooltipElement && !this.activeTooltipTarget) { this.tooltipElement.style.opacity = '0'; const transitionDuration = parseFloat(getComputedStyle(this.tooltipElement).transitionDuration) * 1000 || 150; setTimeout(() => { if(this.tooltipElement && this.tooltipElement.style.opacity === '0') { this.tooltipElement.style.visibility = 'hidden'; this.tooltipElement.setAttribute('aria-hidden', 'true'); this.tooltipElement.style.left = '-9999px'; this.tooltipElement.style.top = '-9999px'; }}, transitionDuration); } }, 50); }
    
    /** Adds a separator line to the menu. */
    addSeparator() { const sep = document.createElement('div'); sep.classList.add('js-rts-menu-separator'); sep.setAttribute('role', 'separator'); this.container.appendChild(sep); this.buttonsData.push({isSeparator: true, wrapper: sep }); }
    
    /** Updates the visual state of a button with a cooldown. */
    _updateButtonCooldownState(buttonData) { const abilityId = buttonData.options?.abilityId; if (!abilityId || !buttonData.element || !buttonData.wrapper) return; const remainingSeconds = this.cooldownManager.getRemainingSeconds(abilityId); const isOnCd = remainingSeconds > 0; const baseDisabled = (buttonData.options?.disabledOriginal ?? false) || (buttonData.options?.isCostInsufficient ?? false); buttonData.disabled = baseDisabled || isOnCd; buttonData.element.disabled = buttonData.disabled; if (buttonData.disabled) { buttonData.element.setAttribute('aria-disabled', 'true'); } else { buttonData.element.removeAttribute('aria-disabled'); } let ov = buttonData.wrapper.querySelector('.js-rts-menu-button-cooldown-timer'); if (isOnCd) { if (!ov) { ov = document.createElement('div'); ov.classList.add('js-rts-menu-button-cooldown-timer'); buttonData.wrapper.appendChild(ov); } ov.style.display = 'flex'; ov.textContent = `${remainingSeconds.toFixed(1)}s`; if (!this.visualCooldownTimers.has(abilityId)) { const intervalId = setInterval(() => { const currentBtnData = this.buttonsData.find(bd => bd.options?.abilityId === abilityId && bd.element === buttonData.element); if (!currentBtnData || !this.isVisible) { clearInterval(this.visualCooldownTimers.get(abilityId)); this.visualCooldownTimers.delete(abilityId); return; } const currentRemaining = this.cooldownManager.getRemainingSeconds(abilityId); const currentOv = currentBtnData.wrapper?.querySelector('.js-rts-menu-button-cooldown-timer'); if (currentRemaining > 0 && currentOv) { currentOv.textContent = `${currentRemaining.toFixed(1)}s`; if (!currentBtnData.element.disabled) { currentBtnData.disabled = true; currentBtnData.element.disabled = true; currentBtnData.element.setAttribute('aria-disabled', 'true'); } } else { if (currentOv) currentOv.style.display = 'none'; const originallyDisabled = (currentBtnData.options?.disabledOriginal ?? false) || (currentBtnData.options?.isCostInsufficient ?? false); if(!originallyDisabled) { currentBtnData.disabled = false; currentBtnData.element.disabled = false; currentBtnData.element.removeAttribute('aria-disabled'); } clearInterval(this.visualCooldownTimers.get(abilityId)); this.visualCooldownTimers.delete(abilityId); } }, 100); this.visualCooldownTimers.set(abilityId, intervalId); } } else { if (ov) ov.style.display = 'none'; if (this.visualCooldownTimers.has(abilityId)) { clearInterval(this.visualCooldownTimers.get(abilityId)); this.visualCooldownTimers.delete(abilityId); } const originallyDisabled = (buttonData.options?.disabledOriginal ?? false) || (buttonData.options?.isCostInsufficient ?? false); if(!originallyDisabled) { buttonData.disabled = false; buttonData.element.disabled = false; buttonData.element.removeAttribute('aria-disabled'); } } }
    
    /** Shows the root menu. */
    showRoot(targetOrPosition, builderFn, triggerEl = null) { this.focusedIndex = -1; this.menuStateStack = []; this.triggerElementForCurrentSequence = triggerEl || (document.activeElement instanceof HTMLElement && typeof document.activeElement.focus === 'function' && document.activeElement !== document.body ? document.activeElement : null); this._clearSearchState(null); if (targetOrPosition instanceof HTMLElement) { this.currentSequenceAnchor = targetOrPosition; } else if (typeof targetOrPosition === 'object' && 'x' in targetOrPosition && 'y' in targetOrPosition) { this.currentSequenceAnchor = { x: targetOrPosition.x, y: targetOrPosition.y }; } else { this.currentSequenceAnchor = {x:0, y:0}; console.warn("JSRTSMenu: showRoot called with invalid targetOrPosition for anchor; defaulting to (0,0)."); } this.show(this.currentSequenceAnchor, builderFn, null); }
    
    /** Shows a menu or submenu. */
    show(targetOrPosition, builderFn, indexToFocusInThisMenu = null) { 
        this.currentBuilderFn = builderFn; 
        this.clear(); 
        this.nextItemId = 0; 
        const anchorForThisView = targetOrPosition || this.currentSequenceAnchor || {x:0,y:0}; 
        
        if (typeof builderFn === 'function') {
            builderFn(); 
        } else { 
            console.error("JSRTSMenu Error: show() requires a builder function."); 
            this.hide(); return; 
        } 
        
        const menuItems = this.buttonsData.filter(b => b.element && !b.isSeparator); 
        if (menuItems.length === 0 && this.container.id !== 'command-card-menu-actual-container' && this.menuStateStack.length === 0) { 
            this.hide(); return; 
        } 
        
        this.container.style.maxHeight = ''; 
        this.container.style.overflowY = ''; 
        this.container.style.visibility = 'hidden'; 
        this.container.style.display = 'block'; 
        this.container.style.opacity = '0'; 
        
        const menuActualHeight = this.container.scrollHeight; 
        const viewportHeight = window.innerHeight; 
        const maxMenuHeight = viewportHeight * 0.85; 
        
        if (this.container.id !== 'command-card-menu-actual-container' && menuActualHeight > maxMenuHeight) { 
            this.container.style.maxHeight = `${maxMenuHeight}px`; 
            this.container.style.overflowY = 'auto'; 
        } 
        
        const menuRect = this.container.getBoundingClientRect(); 
        const menuWidth = menuRect.width; 
        let menuHeightToUse = menuRect.height; 
        
        if (this.container.id === 'command-card-menu-actual-container') {
            const panel = document.getElementById('command-card-container');
            if (panel) {
                if (this.container.parentNode !== panel) { 
                    panel.appendChild(this.container);
                }
                this.container.style.left = ''; 
                this.container.style.top = '';
            } else {
                console.error("JSRTSMenu Error: Command card panel '#command-card-container' not found!");
                this.hide(); return;
            }
        } else { 
            let idealX, idealY; 
            const vpW = window.innerWidth; 
            const vpH = window.innerHeight; 
            const sX = window.pageXOffset; 
            const sY = window.pageYOffset; 
            const m = 5; 

            if (anchorForThisView instanceof HTMLElement) { 
                const tR = anchorForThisView.getBoundingClientRect(); 
                idealX = tR.right + sX + m; 
                idealY = tR.top + sY; 
                if (idealX + menuWidth > vpW + sX - m) { idealX = tR.left + sX - menuWidth - m; } 
                if (idealY + menuHeightToUse > vpH + sY - m) { idealY = vpH + sY - menuHeightToUse - m; } 
                if (idealY < sY + m) idealY = sY + m; 
                if (idealX < sX + m) idealX = sX + m; 
            } else if (typeof anchorForThisView === 'object' && 'x' in anchorForThisView && 'y' in anchorForThisView) { 
                idealX = anchorForThisView.x; 
                idealY = anchorForThisView.y; 
                if (idealX + menuWidth > vpW + sX - m) idealX = vpW + sX - menuWidth - m; 
                if (idealY + menuHeightToUse > vpH + sY - m) idealY = vpH + sY - menuHeightToUse - m; 
                if (idealX < sX + m) idealX = sX + m; 
                if (idealY < sY + m) idealY = sY + m; 
            } else { 
                console.error("JSRTSMenu Error: show() needs valid anchor (element or {x,y}) for popup positioning."); 
                this.hide(); return; 
            } 
            this.container.style.left = `${Math.max(sX + m, idealX)}px`; 
            this.container.style.top = `${Math.max(sY + m, idealY)}px`; 
        }
        
        this.isVisible = true; 
        this.container.style.visibility = 'visible'; 
        this.container.style.opacity = '1'; 
        
        this.buttonsData.forEach(bd => { if(bd.options?.abilityId) this._updateButtonCooldownState(bd); }); 
        
        if (indexToFocusInThisMenu !== null && indexToFocusInThisMenu >= 0 && indexToFocusInThisMenu < this.buttonsData.length && this.buttonsData[indexToFocusInThisMenu].element) { 
            const itemToFocusData = this.buttonsData[indexToFocusInThisMenu]; 
            this._setFocus(indexToFocusInThisMenu); 
            if (itemToFocusData.element.hasAttribute('aria-expanded')) { 
                itemToFocusData.element.setAttribute('aria-expanded', 'false'); 
            } 
        } else { 
            this.navigateToFirst(); 
        } 
    }
    
    /** Hides the menu and cleans up state. */
    hide() { 
        if (!this.isVisible) return; 
        this._hideTooltip(); 
        const elementToRestoreFocus = this.triggerElementForCurrentSequence; 
        this.focusedIndex = -1; 
        this.visualCooldownTimers.forEach(intervalId => clearInterval(intervalId)); 
        this.visualCooldownTimers.clear(); 
        this.container.style.display = 'none'; 
        this.container.style.opacity = '0'; 
        this.isVisible = false; 
        if (this.container.id === 'command-card-menu-actual-container') {
            const panel = document.getElementById('command-card-container'); 
            if(panel && panel.contains(this.container)) {
                // Only remove if it's a child. Avoid error if already removed or never added.
                try { panel.removeChild(this.container); } catch(e) {}
            }
        } 
        if (elementToRestoreFocus && typeof elementToRestoreFocus.focus === 'function') { 
            if (document.body.contains(elementToRestoreFocus) && (elementToRestoreFocus.offsetWidth > 0 || elementToRestoreFocus.offsetHeight > 0 || elementToRestoreFocus.getClientRects().length > 0)) { 
                if (elementToRestoreFocus !== document.body || (this.lastContextMenuTargetIsBody === false && this.triggerElementForCurrentSequence === document.body)) { 
                    setTimeout(() => { try { elementToRestoreFocus.focus(); } catch(e) {/*ignore focus error if element became non-focusable*/} }, 0); 
                } 
            } 
        } 
        this.triggerElementForCurrentSequence = null; 
        this.lastContextMenuTargetIsBody = null; 
        this.currentSequenceAnchor = null; 
        this._clearSearchState(null); 
    }
    
    /** Opens a submenu. */
    openSubmenu(submenuBuilderFn) { if(!this.currentBuilderFn) return; const currentFocusedItemIndex = this.focusedIndex; const triggerItemData = (currentFocusedItemIndex !== -1 && this.buttonsData[currentFocusedItemIndex]) ? this.buttonsData[currentFocusedItemIndex] : null; this._clearSearchState(null); let submenuAnchorTarget = this.currentSequenceAnchor; if(triggerItemData && triggerItemData.wrapper) { triggerItemData.element.setAttribute('aria-expanded', 'true'); const triggerWrapperRect = triggerItemData.wrapper.getBoundingClientRect(); submenuAnchorTarget = { x: triggerWrapperRect.right + window.pageXOffset + 2, y: triggerWrapperRect.top + window.pageYOffset }; } this.menuStateStack.push({ builder: this.currentBuilderFn, triggerItemIndexInParent: currentFocusedItemIndex, overallTriggerElement: this.triggerElementForCurrentSequence, parentAnchor: this.currentSequenceAnchor }); this.show(submenuAnchorTarget, submenuBuilderFn, null); }
    
    /** Adds a "Back" button to navigate to the parent menu, if applicable. */
    addBackButton() { if(this.menuStateStack.length > 0){ this.addButton("Back", () => { const parentState = this.menuStateStack.pop(); if(parentState && parentState.builder){ this.triggerElementForCurrentSequence = parentState.overallTriggerElement; this.currentSequenceAnchor = parentState.parentAnchor; this.show(this.currentSequenceAnchor, parentState.builder, parentState.triggerItemIndexInParent); return true;} }, {isBackButton:true, tooltip:"Go back", iconSrc:RTS_MENU_ICONS.BACK }); } }
}
