// js/menu.js
// Contains the JSRTSMenu class and CooldownManager.
// This is a reusable UI component.

"use strict";

// --- Icon Placeholders (or actual SVGs/paths if you have them) ---
// These are used by JSRTSMenu if items are given iconSrc options.
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
 * A script-driven, accessible menu system.
 */
class JSRTSMenu {
    constructor(containerId, cooldownManagerInstance) { 
        this.container = document.getElementById(containerId); 
        if (!this.container) { console.error(`JSRTSMenu Error: Container ID "${containerId}" not found.`); return; } 
        if (!cooldownManagerInstance || typeof cooldownManagerInstance.isOnCooldown !== 'function') { 
            console.error(`JSRTSMenu Error: Valid CooldownManager instance is required.`); return; 
        }
        this.cooldownManager = cooldownManagerInstance; 
        this.buttonsData = []; 
        this.isVisible = false; 
        this.menuStateStack = []; 
        this.currentBuilderFn = null; 
        this.visualCooldownTimers = new Map(); 
        this.focusedIndex = -1; 
        this.baseMenuId = containerId; 
        this.nextItemId = 0; 
        this.triggerElementForCurrentSequence = null; 
        this.lastContextMenuTargetIsBody = null; 
        this.currentSequenceAnchor = null; 
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
        this.tooltipElement.setAttribute('tabindex', '-1'); 
        this.activeTooltipTarget = null; 
        this.tooltipShowTimeout = null; 
        this.tooltipHideTimeout = null; 
        this.tooltipShowDelay = 400; 
        this.searchQuery = ''; 
        this.searchTimeout = null; 
        this.searchDelay = 700; 
        this.container.setAttribute('role', 'menu'); 
        this.container.setAttribute('aria-orientation', 'vertical'); 
        this._setupGlobalListeners(); 
    }

    _clearSearchState(logMessage = "JSRTSMenu: Search query cleared.") { 
        clearTimeout(this.searchTimeout); 
        this.searchQuery = ''; 
        this.searchTimeout = null; 
        // Conditional logging based on a global debug flag (e.g., window.isDebugVisible)
        // For now, keeping it simple. To use isDebugVisible, it would need to be passed or accessed globally.
        // if(logMessage && logMessage.length > 0 && isDebugVisible) { console.log(logMessage); } 
    }

    _setupGlobalListeners() { 
        document.addEventListener('click', (event) => { 
            if (this.isVisible && !this.container.contains(event.target) && !event.target.closest(`#${this.container.id}`)) { 
                if (this.triggerElementForCurrentSequence && this.triggerElementForCurrentSequence.contains(event.target)) { return; } 
                // Special check for command card: if click is inside its panel, don't hide
                const commandCardPanel = document.getElementById('command-card-container');
                if (commandCardPanel && commandCardPanel.contains(event.target) && this.container.id === 'command-card-menu-actual-container') {
                     return; 
                }
                this.hide(); 
            } 
        }); 
        
        document.addEventListener('keydown', (event) => { 
            if (!this.isVisible) return; 
            const activeElement = document.activeElement; 
            if (activeElement !== this.container && activeElement && (activeElement.tagName === 'INPUT' || activeElement.tagName === 'TEXTAREA' || activeElement.isContentEditable)) return; 
            
            const pressedKey = event.key.toLowerCase(); 
            let keyHandledByMenu = false; 
            
            // 1. Type-ahead Search
            if (event.key.length === 1 && event.key !== ' ' && !event.ctrlKey && !event.metaKey && !event.altKey) { 
                event.preventDefault(); event.stopPropagation(); 
                this.searchQuery += pressedKey; this._performSearch(); 
                keyHandledByMenu = true; 
            } 
            if (keyHandledByMenu) return; 
            
            // 2. Hotkeys for currently visible menu items
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
                            event.preventDefault(); event.stopPropagation(); specificHotkeyMatched = true; break;
                        } else if (btnData.disabled) { 
                            event.preventDefault(); event.stopPropagation(); specificHotkeyMatched = true; break;
                        } 
                    } 
                } 
            } 
            if (specificHotkeyMatched) return; 
            
            // 3. Navigation and Activation Keys
            switch (event.key) { 
                case 'Backspace': event.preventDefault(); event.stopPropagation(); if (this.searchQuery.length > 0) { this.searchQuery = this.searchQuery.slice(0, -1); if (this.searchQuery.length > 0) { this._performSearch(); } else { this._clearSearchState("JSRTSMenu: Search query cleared by backspace."); const currentFocusedItem = this.buttonsData[this.focusedIndex]; if (currentFocusedItem && currentFocusedItem.element && !currentFocusedItem.isSeparator && !currentFocusedItem.disabled) { this._setFocus(this.focusedIndex); } else { this.navigateToFirst(); } } } break; 
                case 'Escape': event.preventDefault(); event.stopPropagation(); if (this.searchQuery !== '') { this._clearSearchState("JSRTSMenu: Escape cleared active search."); const currentFocusedItem = this.buttonsData[this.focusedIndex]; if (currentFocusedItem && currentFocusedItem.element && !currentFocusedItem.isSeparator && !currentFocusedItem.disabled) { this._setFocus(this.focusedIndex); } else { this.navigateToFirst(); } } else { if (this.menuStateStack.length > 0) { const parentState = this.menuStateStack.pop(); if (parentState && parentState.builder) { this.triggerElementForCurrentSequence = parentState.overallTriggerElement; this.currentSequenceAnchor = parentState.parentAnchor; this.show(this.currentSequenceAnchor, parentState.builder, parentState.triggerItemIndexInParent); } } else { this.hide(); } } break; 
                case 'ArrowUp': event.preventDefault(); event.stopPropagation(); this._clearSearchState(null); this.navigate(-1); break; 
                case 'ArrowDown': event.preventDefault(); event.stopPropagation(); this._clearSearchState(null); this.navigate(1); break; 
                case 'Enter': case ' ': event.preventDefault(); event.stopPropagation(); this.activateFocusedItem(); break; 
                case 'Home': event.preventDefault(); event.stopPropagation(); this._clearSearchState(null); this.navigateToFirst(); break; 
                case 'End': event.preventDefault(); event.stopPropagation(); this._clearSearchState(null); this.navigateToLast(); break; 
                case 'Tab': event.preventDefault(); event.stopPropagation(); this.hide(); break; 
            } 
        }); 
    }

    _performSearch() { clearTimeout(this.searchTimeout); if (!this.searchQuery) { this._clearSearchState("JSRTSMenu: Search query became empty, search stopped."); return; } let firstMatchIndex = -1; for (let i = 0; i < this.buttonsData.length; i++) { const itemData = this.buttonsData[i]; if (itemData.element && !itemData.isSeparator && !itemData.disabled) { const labelText = itemData.label.toLowerCase(); if (labelText.startsWith(this.searchQuery)) { firstMatchIndex = i; break; } } } if (firstMatchIndex !== -1) { this._setFocus(firstMatchIndex); } this.searchTimeout = setTimeout(() => { this._clearSearchState(); }, this.searchDelay); }
    _generateUniqueId() { return `${this.baseMenuId}-item-${this.nextItemId++}`; }
    _canActivateItem(bd) { return bd && !bd.isSeparator && !bd.disabled && !(bd.options?.abilityId && this.cooldownManager.isOnCooldown(bd.options.abilityId)) && typeof bd.callback === 'function';}
    navigate(direction) { const itemCount = this.buttonsData.length; if (itemCount === 0) return; const isNavigable = (index) => { if(index < 0 || index >= this.buttonsData.length) return false; const item = this.buttonsData[index]; return item && item.element && !item.isSeparator && !item.disabled; }; let currentTabbableIndex = this.buttonsData.findIndex(bd => bd.element && bd.element.getAttribute('tabindex') === '0'); if (currentTabbableIndex === -1) { currentTabbableIndex = this.focusedIndex; } let searchIndex = currentTabbableIndex; if (searchIndex === -1) { searchIndex = (direction === 1) ? 0 : itemCount - 1; if (!isNavigable(searchIndex)) { let initialSearch = searchIndex; do { searchIndex = (searchIndex + direction + itemCount) % itemCount; } while (!isNavigable(searchIndex) && searchIndex !== initialSearch); if (!isNavigable(searchIndex)) searchIndex = -1; } } else { let initialSearch = searchIndex; do { searchIndex = (searchIndex + direction + itemCount) % itemCount; } while (!isNavigable(searchIndex) && searchIndex !== initialSearch); if (!isNavigable(searchIndex)) searchIndex = isNavigable(currentTabbableIndex) ? currentTabbableIndex : -1; } this._setFocus(searchIndex); }
    navigateToFirst() { const idx = this.buttonsData.findIndex(b => b.element && !b.isSeparator && !b.disabled); this._setFocus(idx); }
    navigateToLast() { let idx = -1; for (let i = this.buttonsData.length - 1; i >= 0; i--) { const bd = this.buttonsData[i]; if (bd.element && !bd.isSeparator && !bd.disabled) { idx = i; break; } } this._setFocus(idx); }
    _setFocus(newIndex) { if (this.focusedIndex !== -1 && this.focusedIndex < this.buttonsData.length && this.buttonsData[this.focusedIndex] && this.buttonsData[this.focusedIndex].element) { this.buttonsData[this.focusedIndex].element.setAttribute('tabindex', '-1'); } this.focusedIndex = newIndex; if (this.focusedIndex !== -1 && this.focusedIndex < this.buttonsData.length && this.buttonsData[this.focusedIndex] && this.buttonsData[this.focusedIndex].element) { const targetButton = this.buttonsData[this.focusedIndex].element; if (targetButton) { targetButton.setAttribute('tabindex', '0'); targetButton.focus({ preventScroll: true }); targetButton.scrollIntoView({ block: 'nearest', inline: 'nearest' }); } } else if (newIndex === -1 || !(this.focusedIndex < this.buttonsData.length && this.buttonsData[this.focusedIndex])) { this.focusedIndex = -1; } }
    activateFocusedItem() { const focusedElement = document.activeElement; const focusedBtnData = this.buttonsData.find(bd => bd.element === focusedElement); if (!focusedBtnData || focusedBtnData.disabled) return; const itemType = focusedBtnData.options?.type; if (itemType === 'checkbox' || itemType === 'radio') { const oldCheckedState = focusedBtnData.options.checked; const stateActuallyChanged = this._toggleCheckableItem(focusedBtnData); if (typeof focusedBtnData.callback === 'function') { if (itemType === 'checkbox' || stateActuallyChanged) { focusedBtnData.callback(focusedBtnData.options.checked, focusedBtnData); } } this._clearSearchState(null); } else if (this._canActivateItem(focusedBtnData)) { this._executeCallback(focusedBtnData); } }
    _toggleCheckableItem(buttonData) { const options = buttonData.options; let stateChanged = false; if (options.type === 'checkbox') { options.checked = !options.checked; buttonData.element.setAttribute('aria-checked', String(options.checked)); stateChanged = true; } else if (options.type === 'radio') { if (!options.checked) { options.checked = true; buttonData.element.setAttribute('aria-checked', 'true'); stateChanged = true; this.buttonsData.forEach(item => { if (item !== buttonData && item.options?.type === 'radio' && item.options?.radioGroup === options.radioGroup && item.options?.checked) { item.options.checked = false; item.element.setAttribute('aria-checked', 'false'); } }); } } return stateChanged; }
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
        // Conditional hiding:
        // - Popups (context menu) hide unless callback returns true.
        // - Command card persists unless callback returns true OR it's a submenu action.
        if (callbackResult !== true) {
            if (this.container.id !== 'command-card-menu-actual-container') {
                this.hide();
            } else if (this.container.id === 'command-card-menu-actual-container' && buttonData.options?.opensSubmenu) {
                // Submenu was opened from command card, command card itself (parent) stays.
            } else if (this.container.id === 'command-card-menu-actual-container') {
                // Standard action on command card. It might persist or be refreshed by updateCommandCard() later.
                // If the action results in deselection, updateCommandCard() will hide it.
            }
        }
    }
    clear() { this.focusedIndex = -1; this.visualCooldownTimers.forEach(intervalId => clearInterval(intervalId)); this.visualCooldownTimers.clear(); this.buttonsData = []; this.container.innerHTML = ''; this._clearSearchState(null); }
    _buildButtonDOM(label, callback, options = {}) { const { type = 'button', checked = false, radioGroup = null, disabled = false, isBackButton = false, tooltip = null, disabledTooltip = null, cooldownSeconds = 0, abilityId = null, iconSrc = null, costText = null, isCostInsufficient = false, hotkey = null, opensSubmenu = false } = options; if (cooldownSeconds > 0 && !abilityId) { console.warn(`JSRTSMenu Warning: Button "${label}" has cooldownSeconds but no abilityId.`); } const initiallyOnCooldown = abilityId ? this.cooldownManager.isOnCooldown(abilityId) : false; const isActuallyDisabled = disabled || isCostInsufficient || initiallyOnCooldown; const wrapper = document.createElement('div'); wrapper.classList.add('js-rts-menu-button-wrapper'); const buttonElement = document.createElement('button'); buttonElement.setAttribute('tabindex', '-1'); let itemRole = 'menuitem'; if (type === 'checkbox') itemRole = 'menuitemcheckbox'; else if (type === 'radio') itemRole = 'menuitemradio'; buttonElement.setAttribute('role', itemRole); if (type === 'checkbox' || type === 'radio') { buttonElement.setAttribute('aria-checked', String(checked)); } if (isActuallyDisabled) { buttonElement.setAttribute('aria-disabled', 'true'); buttonElement.disabled = true; } if (hotkey) { buttonElement.setAttribute('aria-keyshortcuts', hotkey); } if (opensSubmenu) { buttonElement.setAttribute('aria-haspopup', 'true'); buttonElement.setAttribute('aria-expanded', 'false'); } if (type === 'checkbox' || type === 'radio') { const indicatorSpan = document.createElement('span'); indicatorSpan.classList.add('js-rts-menu-item-indicator'); indicatorSpan.setAttribute('aria-hidden', 'true'); buttonElement.appendChild(indicatorSpan); } if (iconSrc) { const img = document.createElement('img'); img.src = iconSrc; img.classList.add('js-rts-menu-button-icon'); img.alt = ''; buttonElement.appendChild(img); } const labelSpan = document.createElement('span'); labelSpan.classList.add('js-rts-menu-button-label'); labelSpan.textContent = label; buttonElement.appendChild(labelSpan); if (costText) { const span = document.createElement('span'); span.classList.add('js-rts-menu-button-cost'); if (isCostInsufficient) span.classList.add('cost-insufficient'); span.textContent = costText; buttonElement.appendChild(span); } if (hotkey && !isBackButton && this.container.id !== 'command-card-menu-actual-container') { const hotkeySpan = document.createElement('span'); hotkeySpan.classList.add('js-rts-menu-button-hotkey'); hotkeySpan.textContent = `(${hotkey.toUpperCase()})`; wrapper.appendChild(hotkeySpan); } if(isBackButton) buttonElement.classList.add('js-rts-menu-back-button'); const mergedOptions = { ...options, type, checked, radioGroup, abilityId, cooldownSeconds, disabled: isActuallyDisabled, disabledOriginal: disabled, opensSubmenu, iconSrc, costText, isCostInsufficient, hotkey, tooltip, disabledTooltip }; const buttonData = { label, callback, disabled: isActuallyDisabled, tooltip, disabledTooltip, element: buttonElement, wrapper, originalLabel: label, isBackButton, hotkey, options: mergedOptions }; buttonElement.addEventListener('click', (event) => { event.stopPropagation(); if (buttonData.disabled) return; if (buttonData.options.type === 'checkbox' || buttonData.options.type === 'radio') { const oldCheckedState = buttonData.options.checked; const stateActuallyChanged = this._toggleCheckableItem(buttonData); if (typeof buttonData.callback === 'function') { if (buttonData.options.type === 'checkbox' || stateActuallyChanged) { buttonData.callback(buttonData.options.checked, buttonData); } } this._clearSearchState(null); } else if (this._canActivateItem(buttonData) && typeof buttonData.callback === 'function') { this._executeCallback(buttonData); } else if (buttonData.options?.opensSubmenu && typeof buttonData.callback === 'function') { this._executeCallback(buttonData); } }); const tooltipContentToUse = (isActuallyDisabled && disabledTooltip) ? disabledTooltip : tooltip; if (tooltipContentToUse && this.tooltipElement) { wrapper.addEventListener('mouseenter', () => { clearTimeout(this.tooltipShowTimeout); this.tooltipShowTimeout = setTimeout(() => { this._showTooltip(wrapper, tooltipContentToUse); }, this.tooltipShowDelay); }); wrapper.addEventListener('mouseleave', () => { clearTimeout(this.tooltipShowTimeout); this._hideTooltip(); }); buttonElement.addEventListener('focus', () => this._showTooltip(wrapper, tooltipContentToUse)); buttonElement.addEventListener('blur', () => this._hideTooltip()); if(this.tooltipElement) buttonElement.setAttribute('aria-describedby', this.tooltipElement.id); } wrapper.insertBefore(buttonElement, wrapper.firstChild); return {buttonData, wrapper}; }
    addButton(label, callback, options = {}) { const {buttonData, wrapper} = this._buildButtonDOM(label, callback, options); this.buttonsData.push(buttonData); this.container.appendChild(wrapper); if(buttonData.options?.abilityId && this.cooldownManager.isOnCooldown(buttonData.options.abilityId)) { this._updateButtonCooldownState(buttonData); } }
    _showTooltip(targetWrapper, tooltipContent) { if (!this.tooltipElement || !tooltipContent) return; clearTimeout(this.tooltipHideTimeout); this.activeTooltipTarget = targetWrapper; if (/<[a-z][\s\S]*>/i.test(tooltipContent)) { this.tooltipElement.innerHTML = tooltipContent; } else { this.tooltipElement.textContent = tooltipContent; } if (this.tooltipElement.parentNode !== document.body) { document.body.appendChild(this.tooltipElement); } this.tooltipElement.style.visibility = 'hidden'; this.tooltipElement.style.opacity = '1'; this.tooltipElement.style.left = '0px'; this.tooltipElement.style.top = '0px'; const targetRect = targetWrapper.getBoundingClientRect(); const ttRect = this.tooltipElement.getBoundingClientRect(); this.tooltipElement.style.opacity = '0'; const viewportWidth = window.innerWidth; const viewportHeight = window.innerHeight; const margin = 10; let ttTop, ttLeft; const positionsToTry = ['above', 'below', 'right', 'left']; let bestFit = null; for (const pos of positionsToTry) { switch (pos) { case 'above': ttTop = targetRect.top - ttRect.height - margin; ttLeft = targetRect.left + (targetRect.width / 2) - (ttRect.width / 2); break; case 'below': ttTop = targetRect.bottom + margin; ttLeft = targetRect.left + (targetRect.width / 2) - (ttRect.width / 2); break; case 'right': ttTop = targetRect.top + (targetRect.height / 2) - (ttRect.height / 2); ttLeft = targetRect.right + margin; break; case 'left': ttTop = targetRect.top + (targetRect.height / 2) - (ttRect.height / 2); ttLeft = targetRect.left - ttRect.width - margin; break; default: ttTop=0; ttLeft=0; } if (ttLeft < margin) ttLeft = margin; if (ttLeft + ttRect.width > viewportWidth - margin) ttLeft = viewportWidth - ttRect.width - margin; if (ttTop < margin) ttTop = margin; if (ttTop + ttRect.height > viewportHeight - margin) ttTop = viewportHeight - ttRect.height - margin; if (ttTop >= margin && ttLeft >= margin && ttTop + ttRect.height <= viewportHeight - margin && ttLeft + ttRect.width <= viewportWidth - margin) { bestFit = { top: ttTop, left: ttLeft }; break; } if (!bestFit) { bestFit = {top: ttTop, left: ttLeft}; }} if(bestFit) {this.tooltipElement.style.top = `${bestFit.top}px`; this.tooltipElement.style.left = `${bestFit.left}px`; this.tooltipElement.style.visibility = 'visible'; this.tooltipElement.style.opacity = '1'; this.tooltipElement.setAttribute('aria-hidden', 'false');} }
    _hideTooltip() { clearTimeout(this.tooltipShowTimeout); this.activeTooltipTarget = null; this.tooltipHideTimeout = setTimeout(() => { if (this.tooltipElement && !this.activeTooltipTarget) { this.tooltipElement.style.opacity = '0'; const transitionDuration = parseFloat(getComputedStyle(this.tooltipElement).transitionDuration) * 1000 || 150; setTimeout(() => { if(this.tooltipElement && this.tooltipElement.style.opacity === '0') { this.tooltipElement.style.visibility = 'hidden'; this.tooltipElement.setAttribute('aria-hidden', 'true'); this.tooltipElement.style.left = '-9999px'; this.tooltipElement.style.top = '-9999px'; }}, transitionDuration); } }, 50); }
    addSeparator() { const sep = document.createElement('div'); sep.classList.add('js-rts-menu-separator'); sep.setAttribute('role', 'separator'); this.container.appendChild(sep); this.buttonsData.push({isSeparator: true, wrapper: sep }); }
    _updateButtonCooldownState(buttonData) { const abilityId = buttonData.options?.abilityId; if (!abilityId || !buttonData.element || !buttonData.wrapper) return; const remainingSeconds = this.cooldownManager.getRemainingSeconds(abilityId); const isOnCd = remainingSeconds > 0; const baseDisabled = (buttonData.options?.disabledOriginal ?? false) || (buttonData.options?.isCostInsufficient ?? false); buttonData.disabled = baseDisabled || isOnCd; buttonData.element.disabled = buttonData.disabled; if (buttonData.disabled) { buttonData.element.setAttribute('aria-disabled', 'true'); } else { buttonData.element.removeAttribute('aria-disabled'); } let ov = buttonData.wrapper.querySelector('.js-rts-menu-button-cooldown-timer'); if (isOnCd) { if (!ov) { ov = document.createElement('div'); ov.classList.add('js-rts-menu-button-cooldown-timer'); buttonData.wrapper.appendChild(ov); } ov.style.display = 'flex'; ov.textContent = `${remainingSeconds.toFixed(1)}s`; if (!this.visualCooldownTimers.has(abilityId)) { const intervalId = setInterval(() => { const currentBtnData = this.buttonsData.find(bd => bd.options?.abilityId === abilityId && bd.element === buttonData.element); if (!currentBtnData || !this.isVisible) { clearInterval(this.visualCooldownTimers.get(abilityId)); this.visualCooldownTimers.delete(abilityId); return; } const currentRemaining = this.cooldownManager.getRemainingSeconds(abilityId); const currentOv = currentBtnData.wrapper?.querySelector('.js-rts-menu-button-cooldown-timer'); if (currentRemaining > 0 && currentOv) { currentOv.textContent = `${currentRemaining.toFixed(1)}s`; if (!currentBtnData.element.disabled) { currentBtnData.disabled = true; currentBtnData.element.disabled = true; currentBtnData.element.setAttribute('aria-disabled', 'true'); } } else { if (currentOv) currentOv.style.display = 'none'; const originallyDisabled = (currentBtnData.options?.disabledOriginal ?? false) || (currentBtnData.options?.isCostInsufficient ?? false); if(!originallyDisabled) { currentBtnData.disabled = false; currentBtnData.element.disabled = false; currentBtnData.element.removeAttribute('aria-disabled'); } clearInterval(this.visualCooldownTimers.get(abilityId)); this.visualCooldownTimers.delete(abilityId); } }, 100); this.visualCooldownTimers.set(abilityId, intervalId); } } else { if (ov) ov.style.display = 'none'; if (this.visualCooldownTimers.has(abilityId)) { clearInterval(this.visualCooldownTimers.get(abilityId)); this.visualCooldownTimers.delete(abilityId); } const originallyDisabled = (buttonData.options?.disabledOriginal ?? false) || (buttonData.options?.isCostInsufficient ?? false); if(!originallyDisabled) { buttonData.disabled = false; buttonData.element.disabled = false; buttonData.element.removeAttribute('aria-disabled'); } } }
    showRoot(targetOrPosition, builderFn, triggerEl = null) { this.focusedIndex = -1; this.menuStateStack = []; this.triggerElementForCurrentSequence = triggerEl || (document.activeElement instanceof HTMLElement && typeof document.activeElement.focus === 'function' && document.activeElement !== document.body ? document.activeElement : null); this._clearSearchState(null); if (targetOrPosition instanceof HTMLElement) { this.currentSequenceAnchor = targetOrPosition; } else if (typeof targetOrPosition === 'object' && 'x' in targetOrPosition && 'y' in targetOrPosition) { this.currentSequenceAnchor = { x: targetOrPosition.x, y: targetOrPosition.y }; } else { this.currentSequenceAnchor = {x:0, y:0}; console.warn("JSRTSMenu: showRoot called with invalid targetOrPosition for anchor; defaulting to (0,0)."); } this.show(this.currentSequenceAnchor, builderFn, null); }
    show(targetOrPosition, builderFn, indexToFocusInThisMenu = null) { this.currentBuilderFn = builderFn; this.clear(); this.nextItemId = 0; const anchorForThisView = targetOrPosition || this.currentSequenceAnchor || {x:0,y:0}; if (typeof builderFn === 'function') builderFn(); else { console.error("JSRTSMenu Error: show() requires builder."); this.hide(); return; } const menuItems = this.buttonsData.filter(b => b.element && !b.isSeparator); if (menuItems.length === 0 && this.container.id !== 'command-card-menu-actual-container') { this.hide(); return; } if (menuItems.length === 0 && this.container.id === 'command-card-menu-actual-container' && this.menuStateStack.length === 0) { this.hide(); return; } this.container.style.maxHeight = ''; this.container.style.overflowY = ''; this.container.style.visibility = 'hidden'; this.container.style.display = 'block'; this.container.style.opacity = '0'; const menuActualHeight = this.container.scrollHeight; const viewportHeight = window.innerHeight; const maxMenuHeight = viewportHeight * 0.85; if (this.container.id !== 'command-card-menu-actual-container' && menuActualHeight > maxMenuHeight) { this.container.style.maxHeight = `${maxMenuHeight}px`; this.container.style.overflowY = 'auto'; } const menuRect = this.container.getBoundingClientRect(); const menuWidth = menuRect.width; let menuHeightToUse = menuRect.height; if (this.container.id === 'command-card-menu-actual-container') { const panel = document.getElementById('command-card-container'); if (panel) menuHeightToUse = panel.clientHeight > 0 ? Math.min(menuActualHeight, panel.clientHeight) : menuActualHeight; else menuHeightToUse = menuActualHeight; } let idealX, idealY; const vpW = window.innerWidth; const vpH = window.innerHeight; const sX = window.pageXOffset; const sY = window.pageYOffset; const m = 5; if (this.container.id === 'command-card-menu-actual-container') { const panel = document.getElementById('command-card-container'); if(panel) { if (this.container.parentNode !== panel) panel.appendChild(this.container); this.container.style.left = '0px'; this.container.style.top = '0px'; } else { console.error("Command card panel not found for JSRTSMenu!"); this.hide(); return;} } else if (anchorForThisView instanceof HTMLElement) { const tR = anchorForThisView.getBoundingClientRect(); idealX = tR.right + sX + m; idealY = tR.top + sY; if (idealX + menuWidth > vpW + sX - m) { idealX = tR.left + sX - menuWidth - m; } if (idealY + menuHeightToUse > vpH + sY - m) { idealY = vpH + sY - menuHeightToUse - m; } if (idealY < sY + m) idealY = sY + m; if (idealX < sX + m) idealX = sX + m; this.container.style.left = `${Math.max(sX + m, idealX)}px`; this.container.style.top = `${Math.max(sY + m, idealY)}px`; } else if (typeof anchorForThisView === 'object' && 'x' in anchorForThisView && 'y' in anchorForThisView) { idealX = anchorForThisView.x; idealY = anchorForThisView.y; if (idealX + menuWidth > vpW + sX - m) idealX = vpW + sX - menuWidth - m; if (idealY + menuHeightToUse > vpH + sY - m) idealY = vpH + sY - menuHeightToUse - m; if (idealX < sX + m) idealX = sX + m; if (idealY < sY + m) idealY = sY + m; this.container.style.left = `${Math.max(sX + m, idealX)}px`; this.container.style.top = `${Math.max(sY + m, idealY)}px`; } else { console.error("JSRTSMenu Error: show() needs valid anchor for positioning."); this.hide(); return; } this.isVisible = true; this.container.style.visibility = 'visible'; this.container.style.opacity = '1'; this.buttonsData.forEach(bd => { if(bd.options?.abilityId) this._updateButtonCooldownState(bd); }); if (indexToFocusInThisMenu !== null && indexToFocusInThisMenu >= 0 && indexToFocusInThisMenu < this.buttonsData.length && this.buttonsData[indexToFocusInThisMenu].element) { const itemToFocusData = this.buttonsData[indexToFocusInThisMenu]; this._setFocus(indexToFocusInThisMenu); if (itemToFocusData.element.hasAttribute('aria-expanded')) { itemToFocusData.element.setAttribute('aria-expanded', 'false'); } } else { this.navigateToFirst(); } }
    hide() { if (!this.isVisible) return; this._hideTooltip(); const elementToRestoreFocus = this.triggerElementForCurrentSequence; this.focusedIndex = -1; this.visualCooldownTimers.forEach(intervalId => clearInterval(intervalId)); this.visualCooldownTimers.clear(); this.container.style.display = 'none'; this.container.style.opacity = '0'; this.isVisible = false; if (this.container.id === 'command-card-menu-actual-container') {const panel = document.getElementById('command-card-container'); if(panel && panel.contains(this.container)) panel.removeChild(this.container);} if (elementToRestoreFocus && typeof elementToRestoreFocus.focus === 'function') { if (document.body.contains(elementToRestoreFocus) && (elementToRestoreFocus.offsetWidth > 0 || elementToRestoreFocus.offsetHeight > 0 || elementToRestoreFocus.getClientRects().length > 0)) { if (elementToRestoreFocus !== document.body || (this.lastContextMenuTargetIsBody === false && this.triggerElementForCurrentSequence === document.body)) { setTimeout(() => { try { elementToRestoreFocus.focus(); } catch(e) {/*ignore focus error if element became non-focusable*/} }, 0); } } } this.triggerElementForCurrentSequence = null; this.lastContextMenuTargetIsBody = null; this.currentSequenceAnchor = null; this._clearSearchState(null); }
    openSubmenu(submenuBuilderFn) { if(!this.currentBuilderFn) return; const currentFocusedItemIndex = this.focusedIndex; const triggerItemData = (currentFocusedItemIndex !== -1 && this.buttonsData[currentFocusedItemIndex]) ? this.buttonsData[currentFocusedItemIndex] : null; this._clearSearchState(null); let submenuAnchorTarget = this.currentSequenceAnchor; if(triggerItemData && triggerItemData.wrapper) { triggerItemData.element.setAttribute('aria-expanded', 'true'); const triggerWrapperRect = triggerItemData.wrapper.getBoundingClientRect(); submenuAnchorTarget = { x: triggerWrapperRect.right + window.pageXOffset + 2, y: triggerWrapperRect.top + window.pageYOffset }; } this.menuStateStack.push({ builder: this.currentBuilderFn, triggerItemIndexInParent: currentFocusedItemIndex, overallTriggerElement: this.triggerElementForCurrentSequence, parentAnchor: this.currentSequenceAnchor }); this.show(submenuAnchorTarget, submenuBuilderFn, null); }
    addBackButton() { if(this.menuStateStack.length > 0){ this.addButton("Back", () => { const parentState = this.menuStateStack.pop(); if(parentState && parentState.builder){ this.triggerElementForCurrentSequence = parentState.overallTriggerElement; this.currentSequenceAnchor = parentState.parentAnchor; this.show(this.currentSequenceAnchor, parentState.builder, parentState.triggerItemIndexInParent); return true;} }, {isBackButton:true, tooltip:"Go back", iconSrc:RTS_MENU_ICONS.BACK }); } }
}
// --- END OF JSRTSMenu ---

// --- Game Constants ---
const MIN_SCALE = 0.1; 
const MAX_SCALE = 3.0; 
const PAN_SPEED = 25;

const WORLD_WIDTH = 6000; 
const WORLD_HEIGHT = 5000;
const INITIAL_WOOD = 350; 
const INITIAL_COAL = 250; 
let STARTING_FOOD_CAP = 4; 

let MINE_HEALTH_INIT = 30;
let TREE_HARVEST_TIME = 5000; 
let MINE_HARVEST_TIME = 7000;
let UNIT_SPEED = 2.8; 
let COLLISION_PADDING = 5;
let FARM_GRID_DIM = 4; 
let FARM_TILE_SIZE = 45; 
let FARM_TOTAL_SIZE = FARM_GRID_DIM * FARM_TILE_SIZE; // Calculated once, used by FACTION_DATA

let BASE_OFFSET_X = 400; 
let BASE_OFFSET_Y = 400;
let ATTACK_RANGE_TOLERANCE = 10; 
let WORKER_RETREAT_HP_PERCENT = 0.5;

let AI_UPDATE_INTERVAL = 30; 
let AI_TARGET_WORKERS = 5;
let AI_TARGET_SOLDIERS = 7; 
let AI_TARGET_ARCHERS = 4; 
let AI_TARGET_GUARD_TOWERS = 2;

// --- FACTION_DATA Definition ---
// This needs to be defined here so it's available when game-logic.js and main-ui-input.js are parsed.
// It uses the constants defined above.
let FACTION_DATA = { 
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
            barracks: { cost: { wood: 7, coal: 5 }, size: { w: 140, h: 140 }, hp: 800, buildTime: 25000, trains: 'soldier', hotkey: 'x' },
            archer_trainer: { cost: { wood: 15, coal: 10 }, size: { w: 130, h: 130 }, hp: 700, buildTime: 30000, trains: 'archer', hotkey: 'c' },
            guard_tower: { cost: { wood: 20, coal: 15 }, size: { w: 80, h: 100 }, hp: 500, buildTime: 35000, attackRange: 200, attackDamage: 12, attackSpeed: 1800, hotkey: 'v' }
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
        buildings: {
             base: { cost: {}, size: { w: 180, h: 180 }, hp: 1800, buildTime: 1, provides_food: STARTING_FOOD_CAP, isBase: true, trains: 'worker' },
             farm: { cost: { wood: 7, coal: 0 }, size: { w: FARM_TOTAL_SIZE, h: FARM_TOTAL_SIZE }, hp: 250, buildTime: 15000, provides_food: 4, hotkey: 'f' },
             barracks: { cost: { wood: 7, coal: 5 }, size: { w: 140, h: 140 }, hp: 900, buildTime: 25000, trains: 'soldier', hotkey: 'x' },
             archer_trainer: { cost: { wood: 15, coal: 10 }, size: { w: 130, h: 130 }, hp: 800, buildTime: 30000, trains: 'archer', hotkey: 'c' },
             guard_tower: { cost: { wood: 20, coal: 15 }, size: { w: 80, h: 100 }, hp: 600, buildTime: 35000, attackRange: 190, attackDamage: 14, attackSpeed: 1900, hotkey: 'v' }
         }
    }
};

// --- Helper to get emoji ---
function getEmojiForFaction(type, factionKey) {
    const faction = FACTION_DATA[factionKey];
    if (!faction || !faction.emojis || !faction.emojis[type]) {
        // isDebugVisible might not be defined when this file is parsed.
        // console.warn(`Emoji missing: ${type} in ${factionKey}`);
        return '?';
    }
    const emojiData = faction.emojis[type];
    return Array.isArray(emojiData) ? emojiData[Math.floor(Math.random() * emojiData.length)] : emojiData;
}
