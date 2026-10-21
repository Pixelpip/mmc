/**
 * Linux MMC/SD Card Detection Flow Explorer - Interactive Application Logic
 * Integrates Pan/Zoom Canvas, SVG Hotspots, Bootlin Elixir Deep-Links, 
 * Sequential Flow Player, and Inspector Drawer.
 */

(function () {
  'use strict';

  // Constants
  const DIAGRAM_WIDTH = 2665;
  const DIAGRAM_HEIGHT = 1203;
  const MIN_SCALE = 0.2;
  const MAX_SCALE = 3.5;

  // Application State
  const state = {
    scale: 1,
    panX: 0,
    panY: 0,
    isDragging: false,
    dragStartX: 0,
    dragStartY: 0,
    selectedId: null,
    currentStepIndex: 0,
    activePhase: 'all',
    searchQuery: '',
    currentEngine: localStorage.getItem('mmc_explorer_engine') || 'bootlin_v66',
    currentTheme: localStorage.getItem('mmc_explorer_theme') || 'dark',
    viewMode: 'diagram', // 'diagram' | 'sequence' | 'split'
    isPlaying: false,
    playInterval: null,
    playSpeed: 2500 // ms per step
  };

  // DOM Elements
  const elements = {
    viewport: document.getElementById('canvas-viewport'),
    stage: document.getElementById('canvas-stage'),
    svgOverlay: document.getElementById('diagram-svg-overlay'),
    drawer: document.getElementById('inspector-drawer'),
    drawerCloseBtn: document.getElementById('drawer-close-btn'),
    zoomLevelText: document.getElementById('hud-zoom-level'),
    btnZoomIn: document.getElementById('btn-zoom-in'),
    btnZoomOut: document.getElementById('btn-zoom-out'),
    btnZoomFit: document.getElementById('btn-zoom-fit'),
    btnZoomReset: document.getElementById('btn-zoom-reset'),
    btnInvertDiagram: document.getElementById('btn-invert-diagram'),
    engineSelect: document.getElementById('engine-select'),
    themeToggleBtn: document.getElementById('btn-theme-toggle'),
    searchInput: document.getElementById('search-input'),
    searchClear: document.getElementById('search-clear'),
    filterPills: document.querySelectorAll('.filter-pill'),
    viewModeTabs: document.querySelectorAll('.view-mode-tab'),
    sequenceContainer: document.getElementById('sequence-view-container'),
    sequenceGrid: document.getElementById('sequence-list-grid'),
    tooltip: document.getElementById('floating-tooltip'),
    toast: document.getElementById('toast-notice'),
    minimapCanvas: document.getElementById('minimap-canvas'),
    minimapLens: document.getElementById('minimap-lens'),
    // Walkthrough controls
    dockPlayBtn: document.getElementById('dock-play-btn'),
    dockPrevBtn: document.getElementById('dock-prev-btn'),
    dockNextBtn: document.getElementById('dock-next-btn'),
    dockStepNum: document.getElementById('dock-step-num'),
    dockStepName: document.getElementById('dock-step-name'),
    dockSpeedSelect: document.getElementById('dock-speed-select'),
    // Drawer elements
    drawerStepBadge: document.getElementById('drawer-step-badge'),
    drawerPhaseText: document.getElementById('drawer-phase-text'),
    drawerFuncTitle: document.getElementById('drawer-func-title'),
    drawerFilePath: document.getElementById('drawer-file-path'),
    btnCopyPath: document.getElementById('btn-copy-path'),
    drawerPrimaryAction: document.getElementById('drawer-primary-action-btn'),
    btnSecondaryGh: document.getElementById('btn-secondary-gh'),
    btnSecondaryFile: document.getElementById('btn-secondary-file'),
    btnSecondarySearch: document.getElementById('btn-secondary-search'),
    btnSecondaryCopySymbol: document.getElementById('btn-secondary-copy-symbol'),
    drawerProtocolBadge: document.getElementById('drawer-protocol-badge'),
    drawerDescription: document.getElementById('drawer-description'),
    drawerCodeSnippet: document.getElementById('drawer-code-snippet'),
    drawerPrevBtn: document.getElementById('drawer-prev-btn'),
    drawerNextBtn: document.getElementById('drawer-next-btn')
  };

  /**
   * Initialize Application
   */
  function init() {
    applyTheme(state.currentTheme);
    elements.engineSelect.value = state.currentEngine;
    
    renderSvgHotspots();
    renderSequenceList();
    initMinimap();
    setupEventListeners();
    
    // Fit diagram nicely into view after layout settles
    requestAnimationFrame(() => {
      fitToViewport();
      // Select step 1 by default
      selectBox('box-1', false);
    });
  }

  /**
   * Build URLs for current engine
   */
  function getUrlsForBox(box) {
    const engineConfig = KERNEL_EXPLORERS[state.currentEngine] || KERNEL_EXPLORERS.bootlin_v66;
    const symbolUrl = engineConfig.buildSymbolUrl(box);
    const fileUrl = engineConfig.buildFileUrl(box);
    const githubUrl = `https://github.com/torvalds/linux/search?q=${box.symbol}`;
    const bootlinSearchUrl = `https://elixir.bootlin.com/linux/v6.6/A/ident/${box.symbol}`;

    return {
      primaryUrl: symbolUrl,
      fileUrl: fileUrl,
      githubUrl: githubUrl,
      searchUrl: bootlinSearchUrl,
      engineName: engineConfig.name
    };
  }

  /**
   * Single-pass tokenizer for Linux Kernel C code syntax highlighting
   */
  function highlightKernelCode(raw) {
    if (!raw) return '';

    // Regex tokens: comments, strings, preprocessor, keywords, numbers, functions, whitespace, other
    const regex = /(\/\*[\s\S]*?\*\/|\/\/.*)|("(?:\\.|[^"\\])*")|(#\w+)|(\b(?:static|inline|void|int|u8|u16|u32|u64|bool|return|if|else|for|while|struct|const|unsigned|long|sizeof|extern)\b)|(\b\d+\b|0x[0-9a-fA-F]+)|(\b[a-zA-Z_]\w*\b(?=\s*\())|([^\s\w]+)|(\s+)|([a-zA-Z_]\w*)/g;

    let result = '';
    let match;

    while ((match = regex.exec(raw)) !== null) {
      const [full, comment, str, preproc, keyword, number, func] = match;
      if (comment) {
        result += `<span class="tok-comment">${escapeHtml(comment)}</span>`;
      } else if (str) {
        result += `<span class="tok-str">${escapeHtml(str)}</span>`;
      } else if (preproc) {
        result += `<span class="tok-kw">${escapeHtml(preproc)}</span>`;
      } else if (keyword) {
        result += `<span class="tok-kw">${escapeHtml(keyword)}</span>`;
      } else if (number) {
        result += `<span class="tok-num">${escapeHtml(number)}</span>`;
      } else if (func) {
        result += `<span class="tok-fn">${escapeHtml(func)}</span>`;
      } else {
        result += escapeHtml(full);
      }
    }
    return result;
  }

  /**
   * Available Viewport helper accounting for sidebar drawer
   */
  function getAvailableViewport() {
    const vRect = elements.viewport.getBoundingClientRect();
    const isDrawerOpen = !elements.drawer.classList.contains('collapsed');
    const isDesktop = window.innerWidth > 900;
    const drawerW = isDrawerOpen && isDesktop ? elements.drawer.offsetWidth : 0;

    return {
      width: Math.max(vRect.width - drawerW, 300),
      height: vRect.height
    };
  }

  /**
   * Render SVG Hotspot Boxes with Badges and Direct Bootlin Links
   */
  function renderSvgHotspots() {
    elements.svgOverlay.innerHTML = '';

    SD_FLOW_DATA.forEach((box) => {
      const urls = getUrlsForBox(box);

      // Wrap in anchor tag for native browser link support (Ctrl+click, middle click, right click)
      const a = document.createElementNS('http://www.w3.org/2000/svg', 'a');
      a.setAttributeNS('http://www.w3.org/1999/xlink', 'xlink:href', urls.primaryUrl);
      a.setAttribute('href', urls.primaryUrl);
      a.setAttribute('target', '_blank');
      a.setAttribute('rel', 'noopener noreferrer');
      a.setAttribute('class', 'box-link');

      const g = document.createElementNS('http://www.w3.org/2000/svg', 'g');
      g.setAttribute('class', 'box-hotspot');
      g.setAttribute('id', `hotspot-${box.id}`);
      g.setAttribute('data-id', box.id);
      g.setAttribute('data-phase', box.phase);
      g.setAttribute('tabindex', '0');

      // Main clickable rectangle
      const rect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
      rect.setAttribute('class', 'hit-box');
      rect.setAttribute('x', box.x);
      rect.setAttribute('y', box.y);
      rect.setAttribute('width', box.width);
      rect.setAttribute('height', box.height);
      g.appendChild(rect);

      // Step Number Badge (Circle)
      const badgeCircle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
      badgeCircle.setAttribute('class', 'box-badge-bg');
      badgeCircle.setAttribute('cx', box.x + 15);
      badgeCircle.setAttribute('cy', box.y + 15);
      badgeCircle.setAttribute('r', '11');
      g.appendChild(badgeCircle);

      // Step Number Text
      const badgeText = document.createElementNS('http://www.w3.org/2000/svg', 'text');
      badgeText.setAttribute('class', 'box-badge-text');
      badgeText.setAttribute('x', box.x + 15);
      badgeText.setAttribute('y', box.y + 15);
      badgeText.textContent = box.step;
      g.appendChild(badgeText);

      // External link indicator icon pill on right
      const linkPillGroup = document.createElementNS('http://www.w3.org/2000/svg', 'g');
      linkPillGroup.setAttribute('class', 'box-link-pill');

      const pillBg = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
      pillBg.setAttribute('class', 'box-pill-bg');
      pillBg.setAttribute('x', box.x + box.width - 56);
      pillBg.setAttribute('y', box.y + 6);
      pillBg.setAttribute('width', '50');
      pillBg.setAttribute('height', '18');
      pillBg.setAttribute('rx', '4');
      linkPillGroup.appendChild(pillBg);

      const pillText = document.createElementNS('http://www.w3.org/2000/svg', 'text');
      pillText.setAttribute('class', 'box-pill-text');
      pillText.setAttribute('x', box.x + box.width - 31);
      pillText.setAttribute('y', box.y + 16);
      pillText.textContent = 'Bootlin ↗';
      linkPillGroup.appendChild(pillText);

      g.appendChild(linkPillGroup);

      // Left-click selects box & opens drawer; Ctrl/Cmd/Shift click allows default browser link opening
      g.addEventListener('click', (e) => {
        if (!e.ctrlKey && !e.metaKey && !e.shiftKey) {
          e.preventDefault();
          selectBox(box.id, true);
        }
      });

      // Double-click opens Bootlin directly in new tab
      g.addEventListener('dblclick', (e) => {
        e.preventDefault();
        openBoxInBootlin(box);
      });

      // Tooltip handlers
      g.addEventListener('mouseenter', (e) => showTooltip(e, box));
      g.addEventListener('mousemove', (e) => positionTooltip(e));
      g.addEventListener('mouseleave', hideTooltip);

      a.appendChild(g);
      elements.svgOverlay.appendChild(a);
    });
  }

  /**
   * Render Sequence Pipeline Cards
   */
  function renderSequenceList() {
    elements.sequenceGrid.innerHTML = '';

    SD_FLOW_DATA.forEach((box) => {
      const card = document.createElement('div');
      card.className = `sequence-card phase-${box.phase}`;
      card.setAttribute('data-id', box.id);
      card.setAttribute('data-phase', box.phase);

      const urls = getUrlsForBox(box);

      card.innerHTML = `
        <div class="seq-left">
          <div class="seq-step-badge">${box.step}</div>
          <div class="seq-info">
            <h3>${escapeHtml(box.label)}</h3>
            <p>${escapeHtml(box.summary)}</p>
          </div>
        </div>
        <div class="seq-right">
          <span class="seq-file-pill">${box.file}</span>
          <a href="${urls.primaryUrl}" target="_blank" rel="noopener noreferrer" class="seq-bootlin-btn" title="Open in ${urls.engineName}">
            <span>Bootlin</span>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"></path><polyline points="15 3 21 3 21 9"></polyline><line x1="10" y1="14" x2="21" y2="3"></line></svg>
          </a>
        </div>
      `;

      card.addEventListener('click', () => {
        selectBox(box.id, true);
        if (state.viewMode === 'sequence') {
          // Open drawer directly
          openDrawer();
        }
      });

      elements.sequenceGrid.appendChild(card);
    });
  }

  /**
   * Select a box by ID and update Inspector & Dock
   */
  function selectBox(boxId, shouldPan = false) {
    const box = SD_FLOW_DATA.find((b) => b.id === boxId);
    if (!box) return;

    state.selectedId = boxId;
    state.currentStepIndex = box.step - 1;

    // Update active class on SVG hotspots
    document.querySelectorAll('.box-hotspot').forEach((el) => {
      el.classList.toggle('active', el.getAttribute('data-id') === boxId);
    });

    // Update active class on sequence cards
    document.querySelectorAll('.sequence-card').forEach((el) => {
      el.classList.toggle('active', el.getAttribute('data-id') === boxId);
    });

    // Update Walkthrough Dock Info
    elements.dockStepNum.textContent = `STEP ${String(box.step).padStart(2, '0')} / ${SD_FLOW_DATA.length}`;
    elements.dockStepName.textContent = box.label;

    // Update Inspector Drawer
    updateDrawerContent(box);
    openDrawer();

    // Optionally center the viewport on this box
    if (shouldPan && state.viewMode !== 'sequence') {
      zoomToBox(box);
    }

    updateMinimapLens();
  }

  /**
   * Update Inspector Drawer Content
   */
  function updateDrawerContent(box) {
    const urls = getUrlsForBox(box);

    elements.drawerStepBadge.textContent = `STEP ${box.step} OF ${SD_FLOW_DATA.length}`;
    elements.drawerPhaseText.textContent = box.phaseName;
    elements.drawerFuncTitle.textContent = box.label;
    elements.drawerFilePath.querySelector('span') 
      ? (elements.drawerFilePath.querySelector('span').textContent = `${box.file}#L${box.line || 1}`)
      : (elements.drawerFilePath.innerHTML = `<span>${box.file}#L${box.line || 1}</span> <button class="btn-copy-mini" id="btn-copy-path" title="Copy file path">📋</button>`);

    // Primary Action Link to Bootlin
    elements.drawerPrimaryAction.href = urls.primaryUrl;
    elements.drawerPrimaryAction.innerHTML = `
      <span>Open Symbol in ${urls.engineName}</span>
      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
        <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"></path>
        <polyline points="15 3 21 3 21 9"></polyline>
        <line x1="10" y1="14" x2="21" y2="3"></line>
      </svg>
    `;

    // Secondary Actions
    elements.btnSecondaryGh.href = urls.githubUrl;
    elements.btnSecondaryFile.href = urls.fileUrl;
    elements.btnSecondarySearch.href = urls.searchUrl;

    // Protocol badge & descriptions
    elements.drawerProtocolBadge.textContent = box.protocol;
    elements.drawerDescription.innerHTML = `<strong>Role:</strong> ${escapeHtml(box.summary)}<br><br>${escapeHtml(box.details)}`;

    // Call Hierarchy rendering (Caller & Callees)
    const hierarchyEl = document.getElementById('drawer-call-hierarchy');
    if (hierarchyEl) {
      const callerBox = box.callerId ? SD_FLOW_DATA.find((b) => b.id === box.callerId) : null;
      const calleeBoxes = (box.calleeIds || []).map((id) => SD_FLOW_DATA.find((b) => b.id === id)).filter(Boolean);

      let callerHtml = callerBox 
        ? `<button class="hierarchy-chip" data-jump-id="${callerBox.id}"><span class="chip-step">Step ${callerBox.step}</span> ${escapeHtml(callerBox.symbol || callerBox.label)}</button>`
        : `<span class="hierarchy-none">Root Entry Point (Hardware Interrupt)</span>`;

      let calleesHtml = calleeBoxes.length > 0
        ? calleeBoxes.map((c) => `<button class="hierarchy-chip" data-jump-id="${c.id}"><span class="chip-step">Step ${c.step}</span> ${escapeHtml(c.symbol || c.label)}</button>`).join('')
        : `<span class="hierarchy-none">Leaf function (End of call branch)</span>`;

      hierarchyEl.innerHTML = `
        <div class="hierarchy-flow-row">
          <span class="hierarchy-label">Called by:</span>
          ${callerHtml}
        </div>
        <div class="hierarchy-flow-row">
          <span class="hierarchy-label">Calls:</span>
          ${calleesHtml}
        </div>
      `;

      hierarchyEl.querySelectorAll('[data-jump-id]').forEach((btn) => {
        btn.addEventListener('click', (e) => {
          e.preventDefault();
          selectBox(btn.getAttribute('data-jump-id'), true);
        });
      });
    }

    // Code snippet with basic syntax highlighting
    elements.drawerCodeSnippet.innerHTML = highlightKernelCode(box.code);

    // Navigation buttons state
    elements.drawerPrevBtn.disabled = box.step <= 1;
    elements.drawerNextBtn.disabled = box.step >= SD_FLOW_DATA.length;
  }

  /**
   * Open / Close Inspector Drawer
   */
  function openDrawer() {
    elements.drawer.classList.remove('collapsed');
  }

  function closeDrawer() {
    elements.drawer.classList.add('collapsed');
  }

  /**
   * Open Box Directly in Bootlin
   */
  function openBoxInBootlin(box) {
    const urls = getUrlsForBox(box);
    window.open(urls.primaryUrl, '_blank', 'noopener,noreferrer');
    showToast(`Opening ${box.symbol} in ${urls.engineName}...`);
  }



  /**
   * Pan & Zoom Engine
   */
  function updateTransform(animate = false) {
    if (animate) {
      elements.stage.style.transition = 'transform 0.3s cubic-bezier(0.16, 1, 0.3, 1)';
    } else {
      elements.stage.style.transition = 'none';
    }

    elements.stage.style.transform = `translate(${state.panX}px, ${state.panY}px) scale(${state.scale})`;
    elements.zoomLevelText.textContent = `${Math.round(state.scale * 100)}%`;
    updateMinimapLens();
  }

  function setZoom(newScale, focalX, focalY, animate = false) {
    const clampedScale = Math.min(Math.max(newScale, MIN_SCALE), MAX_SCALE);
    if (clampedScale === state.scale) return;

    const viewportRect = elements.viewport.getBoundingClientRect();
    const centerX = focalX !== undefined ? focalX - viewportRect.left : viewportRect.width / 2;
    const centerY = focalY !== undefined ? focalY - viewportRect.top : viewportRect.height / 2;

    const scaleDiff = clampedScale / state.scale;
    state.panX = centerX - (centerX - state.panX) * scaleDiff;
    state.panY = centerY - (centerY - state.panY) * scaleDiff;
    state.scale = clampedScale;

    updateTransform(animate);
  }

  function fitToViewport(animate = false) {
    const avail = getAvailableViewport();
    const scaleX = (avail.width - 40) / DIAGRAM_WIDTH;
    const scaleY = (avail.height - 40) / DIAGRAM_HEIGHT;
    const targetScale = Math.min(scaleX, scaleY, 1.2);

    state.scale = Math.max(targetScale, 0.2);
    state.panX = (avail.width - DIAGRAM_WIDTH * state.scale) / 2;
    state.panY = (avail.height - DIAGRAM_HEIGHT * state.scale) / 2;

    updateTransform(animate);
  }

  function zoomToBox(box) {
    const avail = getAvailableViewport();
    const targetScale = 1.05;
    state.scale = targetScale;

    const boxCenterX = box.x + box.width / 2;
    const boxCenterY = box.y + box.height / 2;

    state.panX = (avail.width / 2) - (boxCenterX * state.scale);
    state.panY = (avail.height / 2) - (boxCenterY * state.scale);

    updateTransform(true);
  }

  /**
   * Mini-map Implementation
   */
  function initMinimap() {
    const ctx = elements.minimapCanvas.getContext('2d');
    const mW = elements.minimapCanvas.width = 220;
    const mH = elements.minimapCanvas.height = 100;

    const ratioX = mW / DIAGRAM_WIDTH;
    const ratioY = mH / DIAGRAM_HEIGHT;

    ctx.fillStyle = '#070b14';
    ctx.fillRect(0, 0, mW, mH);

    // Draw miniature boxes
    SD_FLOW_DATA.forEach((box) => {
      ctx.fillStyle = getPhaseColor(box.phase);
      ctx.fillRect(box.x * ratioX, box.y * ratioY, Math.max(box.width * ratioX, 2), Math.max(box.height * ratioY, 2));
    });

    // Click on minimap to jump
    elements.minimapCanvas.addEventListener('click', (e) => {
      const rect = elements.minimapCanvas.getBoundingClientRect();
      const clickX = (e.clientX - rect.left) / mW * DIAGRAM_WIDTH;
      const clickY = (e.clientY - rect.top) / mH * DIAGRAM_HEIGHT;

      const vRect = elements.viewport.getBoundingClientRect();
      state.panX = (vRect.width / 2) - (clickX * state.scale);
      state.panY = (vRect.height / 2) - (clickY * state.scale);
      updateTransform(true);
    });
  }

  function updateMinimapLens() {
    if (!elements.minimapLens) return;

    const mW = 220;
    const mH = 100;
    const ratioX = mW / DIAGRAM_WIDTH;
    const ratioY = mH / DIAGRAM_HEIGHT;

    const vRect = elements.viewport.getBoundingClientRect();

    const viewX = -state.panX / state.scale;
    const viewY = -state.panY / state.scale;
    const viewW = vRect.width / state.scale;
    const viewH = vRect.height / state.scale;

    const lensX = Math.max(0, viewX * ratioX);
    const lensY = Math.max(0, viewY * ratioY);
    const lensW = Math.min(mW - lensX, viewW * ratioX);
    const lensH = Math.min(mH - lensY, viewH * ratioY);

    elements.minimapLens.style.left = `${lensX}px`;
    elements.minimapLens.style.top = `${lensY}px`;
    elements.minimapLens.style.width = `${Math.max(lensW, 6)}px`;
    elements.minimapLens.style.height = `${Math.max(lensH, 6)}px`;
  }

  function getPhaseColor(phase) {
    switch (phase) {
      case 'isr': return '#f43f5e';
      case 'rescan': return '#fb923c';
      case 'power': return '#fbbf24';
      case 'protocol': return '#38bdf8';
      case 'card_init': return '#818cf8';
      case 'block': return '#34d399';
      default: return '#60a5fa';
    }
  }

  /**
   * Flow Player & Walkthrough Controller
   */
  function togglePlayFlow() {
    if (state.isPlaying) {
      stopPlayFlow();
    } else {
      startPlayFlow();
    }
  }

  function startPlayFlow() {
    state.isPlaying = true;
    elements.dockPlayBtn.innerHTML = `
      <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
        <rect x="6" y="4" width="4" height="16"></rect>
        <rect x="14" y="4" width="4" height="16"></rect>
      </svg>
    `;
    elements.dockPlayBtn.title = "Pause Flow";
    showToast("Starting automated flow playback...");

    state.playInterval = setInterval(() => {
      let nextIndex = state.currentStepIndex + 1;
      if (nextIndex >= SD_FLOW_DATA.length) {
        nextIndex = 0; // loop
      }
      selectBox(SD_FLOW_DATA[nextIndex].id, true);
    }, state.playSpeed);
  }

  function stopPlayFlow() {
    state.isPlaying = false;
    clearInterval(state.playInterval);
    elements.dockPlayBtn.innerHTML = `
      <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
        <polygon points="5 3 19 12 5 21 5 3"></polygon>
      </svg>
    `;
    elements.dockPlayBtn.title = "Play Flow Walkthrough";
  }

  function nextStep() {
    stopPlayFlow();
    const nextIdx = Math.min(state.currentStepIndex + 1, SD_FLOW_DATA.length - 1);
    selectBox(SD_FLOW_DATA[nextIdx].id, true);
  }

  function prevStep() {
    stopPlayFlow();
    const prevIdx = Math.max(state.currentStepIndex - 1, 0);
    selectBox(SD_FLOW_DATA[prevIdx].id, true);
  }

  /**
   * Search & Filtering
   */
  function handleSearch(query) {
    state.searchQuery = query.trim().toLowerCase();
    elements.searchClear.classList.toggle('visible', query.length > 0);
    applyFilters();
  }

  function setPhaseFilter(phase) {
    state.activePhase = phase;
    elements.filterPills.forEach((p) => {
      p.classList.toggle('active', p.getAttribute('data-phase') === phase);
    });
    applyFilters();
  }

  function applyFilters() {
    let matchCount = 0;

    SD_FLOW_DATA.forEach((box) => {
      const matchesPhase = state.activePhase === 'all' || box.phase === state.activePhase;
      const matchesSearch = !state.searchQuery || 
        box.label.toLowerCase().includes(state.searchQuery) ||
        box.symbol.toLowerCase().includes(state.searchQuery) ||
        box.file.toLowerCase().includes(state.searchQuery) ||
        box.protocol.toLowerCase().includes(state.searchQuery) ||
        box.summary.toLowerCase().includes(state.searchQuery);

      const isVisible = matchesPhase && matchesSearch;
      if (isVisible) matchCount++;

      // SVG hotspot
      const hotspot = document.getElementById(`hotspot-${box.id}`);
      if (hotspot) {
        hotspot.classList.toggle('dimmed', !isVisible);
      }

      // Sequence Card
      const card = document.querySelector(`.sequence-card[data-id="${box.id}"]`);
      if (card) {
        card.style.display = isVisible ? 'flex' : 'none';
      }
    });

    if (state.searchQuery && matchCount === 0) {
      showToast(`No matches found for "${state.searchQuery}"`);
    }
  }

  /**
   * Tooltip System
   */
  function showTooltip(e, box) {
    const urls = getUrlsForBox(box);
    elements.tooltip.innerHTML = `
      <div class="tooltip-title">${box.step}. ${escapeHtml(box.label)}</div>
      <div class="tooltip-file">${escapeHtml(box.file)}</div>
      <div class="tooltip-action">
        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"></path><polyline points="15 3 21 3 21 9"></polyline><line x1="10" y1="14" x2="21" y2="3"></line></svg>
        Click to inspect • Double-click to open ${urls.engineName}
      </div>
    `;
    elements.tooltip.classList.add('visible');
    positionTooltip(e);
  }

  function positionTooltip(e) {
    const offset = 14;
    let x = e.clientX + offset;
    let y = e.clientY + offset;

    const tRect = elements.tooltip.getBoundingClientRect();
    if (x + tRect.width > window.innerWidth - 10) {
      x = e.clientX - tRect.width - offset;
    }
    if (y + tRect.height > window.innerHeight - 10) {
      y = e.clientY - tRect.height - offset;
    }

    elements.tooltip.style.left = `${x}px`;
    elements.tooltip.style.top = `${y}px`;
  }

  function hideTooltip() {
    elements.tooltip.classList.remove('visible');
  }

  /**
   * Theme Switcher
   */
  function applyTheme(theme) {
    state.currentTheme = theme;
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('mmc_explorer_theme', theme);
    if (elements.themeToggleBtn) {
      elements.themeToggleBtn.innerHTML = theme === 'dark' ? '🌙' : (theme === 'cyber' ? '⚡' : '☀️');
    }
  }

  function cycleTheme() {
    const themes = ['dark', 'cyber', 'light'];
    const nextTheme = themes[(themes.indexOf(state.currentTheme) + 1) % themes.length];
    applyTheme(nextTheme);
    showToast(`Switched theme to ${nextTheme.toUpperCase()}`);
  }

  /**
   * Toast Notice
   */
  function showToast(msg) {
    elements.toast.textContent = msg;
    elements.toast.classList.add('show');
    clearTimeout(elements.toast._timer);
    elements.toast._timer = setTimeout(() => {
      elements.toast.classList.remove('show');
    }, 2400);
  }

  /**
   * Event Listeners Registration
   */
  function setupEventListeners() {
    // Mouse Drag Pan
    elements.viewport.addEventListener('mousedown', (e) => {
      if (e.button !== 0) return; // Only left-click
      state.isDragging = true;
      state.dragStartX = e.clientX - state.panX;
      state.dragStartY = e.clientY - state.panY;
      elements.viewport.classList.add('dragging');
    });

    window.addEventListener('mousemove', (e) => {
      if (!state.isDragging) return;
      state.panX = e.clientX - state.dragStartX;
      state.panY = e.clientY - state.dragStartY;
      updateTransform(false);
    });

    window.addEventListener('mouseup', () => {
      state.isDragging = false;
      elements.viewport.classList.remove('dragging');
    });

    // Mouse Wheel Zoom
    elements.viewport.addEventListener('wheel', (e) => {
      e.preventDefault();
      const zoomFactor = e.deltaY < 0 ? 1.15 : 0.85;
      setZoom(state.scale * zoomFactor, e.clientX, e.clientY, false);
    }, { passive: false });

    // Touch Support for Mobile & Tablets
    let touchStartDist = 0;
    let initialTouchScale = 1;

    elements.viewport.addEventListener('touchstart', (e) => {
      if (e.touches.length === 1) {
        state.isDragging = true;
        state.dragStartX = e.touches[0].clientX - state.panX;
        state.dragStartY = e.touches[0].clientY - state.panY;
      } else if (e.touches.length === 2) {
        state.isDragging = false;
        touchStartDist = Math.hypot(
          e.touches[0].clientX - e.touches[1].clientX,
          e.touches[0].clientY - e.touches[1].clientY
        );
        initialTouchScale = state.scale;
      }
    });

    elements.viewport.addEventListener('touchmove', (e) => {
      if (e.touches.length === 1 && state.isDragging) {
        state.panX = e.touches[0].clientX - state.dragStartX;
        state.panY = e.touches[0].clientY - state.dragStartY;
        updateTransform(false);
      } else if (e.touches.length === 2) {
        const currentDist = Math.hypot(
          e.touches[0].clientX - e.touches[1].clientX,
          e.touches[0].clientY - e.touches[1].clientY
        );
        const factor = currentDist / touchStartDist;
        setZoom(initialTouchScale * factor, undefined, undefined, false);
      }
    });

    elements.viewport.addEventListener('touchend', () => {
      state.isDragging = false;
    });

    // Zoom Buttons
    elements.btnZoomIn.addEventListener('click', () => setZoom(state.scale * 1.25, undefined, undefined, true));
    elements.btnZoomOut.addEventListener('click', () => setZoom(state.scale / 1.25, undefined, undefined, true));
    elements.btnZoomFit.addEventListener('click', () => fitToViewport(true));
    elements.btnZoomReset.addEventListener('click', () => {
      state.scale = 1;
      const vRect = elements.viewport.getBoundingClientRect();
      state.panX = (vRect.width - DIAGRAM_WIDTH) / 2;
      state.panY = (vRect.height - DIAGRAM_HEIGHT) / 2;
      updateTransform(true);
    });

    if (elements.btnInvertDiagram) {
      if (localStorage.getItem('mmc_diagram_inverted') === 'true') {
        elements.stage.classList.add('inverted');
      }
      elements.btnInvertDiagram.addEventListener('click', () => {
        const isInverted = elements.stage.classList.toggle('inverted');
        localStorage.setItem('mmc_diagram_inverted', isInverted);
        showToast(isInverted ? 'Diagram inverted (Dark Mode)' : 'Diagram reset (Original Light)');
      });
    }

    // Engine Selector Switcher
    elements.engineSelect.addEventListener('change', (e) => {
      state.currentEngine = e.target.value;
      localStorage.setItem('mmc_explorer_engine', state.currentEngine);
      showToast(`Explorer engine switched to ${elements.engineSelect.options[elements.engineSelect.selectedIndex].text}`);
      if (state.selectedId) {
        const box = SD_FLOW_DATA.find((b) => b.id === state.selectedId);
        if (box) updateDrawerContent(box);
      }
      renderSequenceList();
    });

    // Theme Switch
    elements.themeToggleBtn.addEventListener('click', cycleTheme);

    // Search Input
    elements.searchInput.addEventListener('input', (e) => handleSearch(e.target.value));
    elements.searchClear.addEventListener('click', () => {
      elements.searchInput.value = '';
      handleSearch('');
      elements.searchInput.focus();
    });

    // Phase Filter Pills
    elements.filterPills.forEach((pill) => {
      pill.addEventListener('click', () => {
        setPhaseFilter(pill.getAttribute('data-phase'));
      });
    });

    // View Mode Tabs
    elements.viewModeTabs.forEach((tab) => {
      tab.addEventListener('click', () => {
        const mode = tab.getAttribute('data-mode');
        state.viewMode = mode;
        elements.viewModeTabs.forEach((t) => t.classList.toggle('active', t === tab));

        if (mode === 'diagram') {
          elements.viewport.style.display = 'block';
          elements.sequenceContainer.classList.remove('active');
        } else if (mode === 'sequence') {
          elements.viewport.style.display = 'none';
          elements.sequenceContainer.classList.add('active');
        } else if (mode === 'split') {
          elements.viewport.style.display = 'block';
          elements.sequenceContainer.classList.add('active');
        }
      });
    });

    // Walkthrough Dock Controls
    elements.dockPlayBtn.addEventListener('click', togglePlayFlow);
    elements.dockPrevBtn.addEventListener('click', prevStep);
    elements.dockNextBtn.addEventListener('click', nextStep);
    elements.dockSpeedSelect.addEventListener('change', (e) => {
      state.playSpeed = parseInt(e.target.value, 10);
      if (state.isPlaying) {
        stopPlayFlow();
        startPlayFlow();
      }
    });

    // Drawer Controls
    elements.drawerCloseBtn.addEventListener('click', closeDrawer);
    elements.drawerPrevBtn.addEventListener('click', prevStep);
    elements.drawerNextBtn.addEventListener('click', nextStep);

    // Copy Path and Symbol
    elements.drawerFilePath.addEventListener('click', (e) => {
      if (e.target.closest('#btn-copy-path') || e.target.tagName === 'SPAN') {
        const box = SD_FLOW_DATA[state.currentStepIndex];
        copyToClipboard(box.file, `Copied ${box.file} to clipboard!`);
      }
    });

    elements.btnSecondaryCopySymbol.addEventListener('click', (e) => {
      e.preventDefault();
      const box = SD_FLOW_DATA[state.currentStepIndex];
      copyToClipboard(box.symbol, `Copied function '${box.symbol}' to clipboard!`);
    });

    // Keyboard Shortcuts
    window.addEventListener('keydown', (e) => {
      // Don't trigger if user is typing in search input
      if (e.target === elements.searchInput) return;

      if (e.key === 'ArrowRight' || e.key === 'l') {
        nextStep();
      } else if (e.key === 'ArrowLeft' || e.key === 'h') {
        prevStep();
      } else if (e.key === ' ' || e.key === 'Spacebar') {
        e.preventDefault();
        togglePlayFlow();
      } else if (e.key === '+' || e.key === '=') {
        setZoom(state.scale * 1.2, undefined, undefined, true);
      } else if (e.key === '-' || e.key === '_') {
        setZoom(state.scale / 1.2, undefined, undefined, true);
      } else if (e.key === '0') {
        fitToViewport(true);
      } else if (e.key === 'Escape') {
        closeDrawer();
      }
    });

    // Window Resize Handler
    window.addEventListener('resize', () => {
      updateMinimapLens();
    });
  }

  /**
   * Clipboard Helper
   */
  function copyToClipboard(text, successMsg) {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(() => {
        showToast(successMsg);
      }).catch(() => {
        fallbackCopy(text, successMsg);
      });
    } else {
      fallbackCopy(text, successMsg);
    }
  }

  function fallbackCopy(text, successMsg) {
    const ta = document.createElement('textarea');
    ta.value = text;
    document.body.appendChild(ta);
    ta.select();
    document.execCommand('copy');
    document.body.removeChild(ta);
    showToast(successMsg);
  }

  /**
   * HTML Escape Utility
   */
  function escapeHtml(str) {
    if (!str) return '';
    return str
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  // Start app when DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

})();
