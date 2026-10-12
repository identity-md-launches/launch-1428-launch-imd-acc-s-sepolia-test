/**
 * imd/acc - Interactive Web3 Application & Hash SPA Router
 * Rich Modern Web3 Aesthetics with Full Hash Page Routing
 */

(() => {
  'use strict';

  // --- Constants & Addresses ---
  const CURRENT_BLOCK = 11891109;
  const DATA_BLOCK_TEXT = `Data at block ${CURRENT_BLOCK.toLocaleString()}`;

  const ADDRESSES = {
    SEPOLIA_CHAIN_ID: '0xaa36a7', // 11155111
    STACKER: '0x0457276d7b036818b3eddc1a4a3fceda61e9314d',
    PROJECT_REGISTRY: '0xfe4470a42df0e77f7efb1b2e8135134a9cd7d102', // test run 4, launch #1378
    REGISTRY_RUN3: '0x9b466d1527322435dc7fdd97bc862b49c177fc2d', // launch #1371
    REGISTRY_RUN2: '0x3a3bfcb65614292b0ec7c62f9e3a5dac003b920e', // launch #1294, rules v1
    STACKER_V1: '0x293c7134ab8f6bf1d8ff44ed806575f8f1baf477', // launch #1129
    TEST_IMD: '0x2b69099e59b05901faa1dd164fabf098bf831e82',
    TEST_SIMD: '0xf9e2eec3b610ec6781f7438ac5fb4bc049d81cc1',
    ORACLE_FEE_TOKEN: '0x44a1cd38474fb1748400e7deb5f8d786cce3f89a',
    INTAKE_V2: '0xa43e6f75ee006411f79ac1c84120606c2330de82',
    MAINNET_IMD: '0xd34a99bc0f67ae1bbd63c660e6d0b0dd03e263b7',
    MAINNET_SIMD: '0x9efa934d9fad4ae28c998a40195646b965a97247',
    ROBINHOOD_IMD: '0x5f7bb59365ce557c26dbcaa4ee9d39a4b95b7127'
  };

  // --- State ---
  const state = {
    theme: localStorage.getItem('imd_acc_theme') || (matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'),
    account: null,
    chainId: null,
    isSepolia: false,
    faucetClaimed: false,
    timdApproved: false,
    mockBalances: {
      cashback: 25.0,
      shares: 24.12,
      worth: 26.35,
      points: 25.0
    },
    stacks: [
      { project: 'PLEA', trader: '0x71C8...3B19', imd: '15.0000', shares: '14.4648', points: '15.0000', listed: true, time: '2m ago' },
      { project: 'PLEA', trader: '0x882a...98e1', imd: '10.0000', shares: '9.6432', points: '10.0000', listed: true, time: '14m ago' },
      { project: 'SelfCredit', trader: '0x3D17...1488', imd: '5.0000', shares: '4.8216', points: '0.0000', listed: false, time: '1h ago' }
    ],
    projects: [
      {
        address: '0x3D1778bE5f9E55f0dF35ACAF64A13Efe2FE81488',
        name: 'SelfCredit (Trial Test)',
        state: 'Negative Case',
        rateBps: 50,
        chain: 'Sepolia Testnet',
        feeFunding: 'Direct test wallet',
        beneficiary: '0x4b91078b2374c956a65f7af0999cae0a935e6821',
        history: ['Applied', 'Rejected (trial)'],
        openQuestion: null,
        isRegistered: false
      },
      {
        address: '0xf9e2eec3b610ec6781f7438ac5fb4bc049d81cc1',
        name: 'PLEA (v10 Hook)',
        state: 'Live Integration',
        rateBps: 50,
        chain: 'Ethereum (Sepolia)',
        feeFunding: 'Trading fee (0.5% cut)',
        beneficiary: '0x4b91078b2374c956a65f7af0999cae0a935e6821',
        history: ['Applied', 'Listed', 'Defended'],
        openQuestion: null,
        cooldownRemaining: '58 min',
        isRegistered: true
      },
      {
        address: '0x2b69099e59b05901faa1dd164fabf098bf831e82',
        name: 'PondPad Launchpad',
        state: 'Planned',
        rateBps: 75,
        chain: 'Robinhood Chain',
        feeFunding: 'Launchpad trade fee',
        beneficiary: '0x4b91078b2374c956a65f7af0999cae0a935e6821',
        history: ['Planned via LayerZero'],
        openQuestion: null,
        isRegistered: true
      }
    ],
    appliedProjects: {},
    applyForm: {
      project: '',
      name: '',
      url: '',
      rate: '50',
      beneficiary: '',
      errors: {},
      mintedFeeToken: false,
      approvedFee: false
    }
  };

  // --- Utilities ---
  function safe(str) {
    if (!str) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function shortAddr(addr) {
    if (!addr) return '';
    return addr.length > 10 ? `${addr.slice(0, 6)}...${addr.slice(-4)}` : addr;
  }

  let toastTimer = null;
  function showToast(msg) {
    const toast = document.getElementById('toast-msg');
    const txt = document.getElementById('toast-text');
    if (!toast) return;
    if (txt) txt.textContent = msg;
    toast.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toast.classList.remove('show'), 2800);
  }

  // --- Theme Management ---
  function applyTheme(t) {
    state.theme = t;
    document.documentElement.dataset.theme = t;
    localStorage.setItem('imd_acc_theme', t);

    const icon = document.getElementById('icon-theme');
    if (icon) {
      if (t === 'light') {
        icon.innerHTML = `
          <circle cx="12" cy="12" r="5"></circle>
          <line x1="12" y1="1" x2="12" y2="3"></line>
          <line x1="12" y1="21" x2="12" y2="23"></line>
          <line x1="4.22" y1="4.22" x2="5.64" y2="5.64"></line>
          <line x1="18.36" y1="18.36" x2="19.78" y2="19.78"></line>
          <line x1="1" y1="12" x2="3" y2="12"></line>
          <line x1="21" y1="12" x2="23" y2="12"></line>
          <line x1="4.22" y1="19.78" x2="5.64" y2="18.36"></line>
          <line x1="18.36" y1="5.64" x2="19.78" y2="4.22"></line>
        `;
      } else {
        icon.innerHTML = `<path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"></path>`;
      }
    }
  }

  // --- Web3 Transaction Handler (1.3x Gas Margin) ---
  async function sendTxWithGas(txParams) {
    if (!window.ethereum) throw new Error('No Web3 wallet available');
    const from = state.account || (await window.ethereum.request({ method: 'eth_accounts' }))[0];
    const tx = { ...txParams, from };

    try {
      const estHex = await window.ethereum.request({
        method: 'eth_estimateGas',
        params: [tx]
      });
      const estNum = parseInt(estHex, 16);
      const gasWithMargin = Math.ceil(estNum * 1.3);
      tx.gas = '0x' + gasWithMargin.toString(16);
    } catch (e) {
      tx.gas = '0x4c4b40'; // Safe fallback
    }

    return await window.ethereum.request({
      method: 'eth_sendTransaction',
      params: [tx]
    });
  }

  // --- Router & Page Renderers ---
  const appRoot = document.getElementById('app-root');

  function render() {
    const rawHash = location.hash || '#/';
    let route = rawHash.replace(/^#/, '');
    if (!route || route === '/') route = '/';

    // Update active nav highlights
    const cleanRoute = route.split('/')[1] || 'home';
    document.querySelectorAll('.nav-link').forEach((link) => {
      const linkRoute = link.getAttribute('data-route');
      if (linkRoute === cleanRoute || (cleanRoute === 'home' && linkRoute === 'home')) {
        link.classList.add('active');
        link.setAttribute('aria-current', 'page');
      } else {
        link.classList.remove('active');
        link.removeAttribute('aria-current');
      }
    });

    // Close mobile nav if open
    const navMenu = document.getElementById('nav-menu');
    if (navMenu) navMenu.classList.remove('open');
    document.getElementById('mobile-toggle')?.setAttribute('aria-expanded', 'false');

    // Route Dispatch
    if (route === '/') {
      renderHome();
    } else if (route === '/stack') {
      renderStack();
    } else if (route === '/calculator') {
      location.replace('#/');
      return;
    } else if (route === '/projects') {
      renderProjects();
    } else if (route.startsWith('/projects/')) {
      const addr = route.slice('/projects/'.length);
      renderProjectDetail(addr);
    } else if (route === '/apply') {
      renderApply();
    } else if (route === '/leaderboard') {
      renderLeaderboard();
    } else if (route === '/contracts') {
      location.replace('#/docs/contracts');
      return;
    } else if (route === '/docs' || route.startsWith('/docs/')) {
      renderDocs(route.slice('/docs/'.length) || 'introduction');
    } else {
      renderNotFound();
    }

    // Scroll cleanly to top (without triggering artificial focus outlines)
    window.scrollTo({ top: 0, behavior: 'instant' });
    initCommonListeners();
  }

  // --- Page: Overview / Home (#/) ---
  function renderHome() {
    document.title = 'imd/acc · Trading Cashback in Staked IMD';

    appRoot.innerHTML = `
      <div class="page-view">
        <section class="hero-section">
          <div class="hero-pill">
            <span class="hero-pill-dot"></span>
            <span>Zero-Custody Trading Cashback</span>
          </div>
          <h1 class="hero-title">
            Every Trade Stacks <span class="gradient-text">Staked IMD</span> For You.
          </h1>
          <p class="hero-desc">
            Participating projects send <strong>0.25% to 1%</strong> of each trade straight to your wallet as sIMD shares in IMD's staking vault. No extra fee, no claiming, and it earns continuous yield.
          </p>

          <div class="hero-actions">
            <a href="#/stack" class="btn btn-primary">
              <span>Launch App & Stack</span>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="5" y1="12" x2="19" y2="12"></line><polyline points="12 5 19 12 12 19"></polyline></svg>
            </a>
            <a href="#/docs" class="btn btn-secondary">
              <span>Read the Docs</span>
            </a>
            <a href="#/projects" class="btn btn-secondary">
              <span>View Projects</span>
            </a>
          </div>

          <!-- 4 Core Pillars -->
          <div class="pillars-grid">
            <div class="pillar-card">
              <div class="pillar-header">
                <h3 class="pillar-title">No New Token</h3>
              </div>
              <p class="pillar-desc">The cashback is pure IMD, staked. There is nothing speculative to buy or manage.</p>
            </div>

            <div class="pillar-card">
              <div class="pillar-header">
                <h3 class="pillar-title">Zero Custody</h3>
              </div>
              <p class="pillar-desc">imd/acc never holds your tokens. The ERC-4626 vault mints shares directly to your wallet.</p>
            </div>

            <div class="pillar-card">
              <div class="pillar-header">
                <h3 class="pillar-title">No Extra Fee</h3>
              </div>
              <p class="pillar-desc">Projects pay cashback out of fees they already charge. Traders pay nothing extra on top.</p>
            </div>

            <div class="pillar-card">
              <div class="pillar-header">
                <h3 class="pillar-title">Ownerless Contract</h3>
              </div>
              <p class="pillar-desc">The Stacker contract has no admin, no pause, no fee take, and immutable parameters.</p>
            </div>
          </div>

          <!-- Animated Architecture Pipeline -->
          <div class="flow-diagram-container">
            <div class="diagram-header">
              <h3 class="diagram-title">How Cashback Moves in a Single Transaction</h3>
              <p class="diagram-subtitle">From swap hook directly into your vault balance in the same atomic block</p>
            </div>

            <div class="pipeline-steps">
              <div class="pipeline-step">
                <span class="step-num">1</span>
                <h4 class="step-title">Trader Swaps</h4>
                <p class="step-desc">Trader executes a trade in a participating Uniswap v4 pool (e.g. PLEA/IMD).</p>
                <div class="step-badge">hookData &rarr; real trader</div>
              </div>

              <div class="pipeline-step">
                <span class="step-num">2</span>
                <h4 class="step-title">Hook Cuts Rate</h4>
                <p class="step-desc">The pool hook extracts 0.25%–1% of the trade on the IMD side out of its regular fee.</p>
                <div class="step-badge">25 to 100 bps</div>
              </div>

              <div class="pipeline-step">
                <span class="step-num">3</span>
                <h4 class="step-title">Stacker.credit()</h4>
                <p class="step-desc">Stacker pulls the IMD from the pool and immediately deposits it into the sIMD vault.</p>
                <div class="step-badge">0 IMD held in transit</div>
              </div>

              <div class="pipeline-step">
                <span class="step-num">4</span>
                <h4 class="step-title">sIMD In Wallet</h4>
                <p class="step-desc">sIMD shares arrive in the trader's wallet, accruing vault yield with 1 pt per IMD.</p>
                <div class="step-badge">Shares & Points live</div>
              </div>
            </div>
          </div>
        </section>

        <!-- Quick Summary Box -->
        <div class="dashboard-card" style="padding: 24px;">
          <div class="card-header-row" style="margin-bottom: 12px;">
            <h3 class="card-title" style="font-size: 1.05rem;">Live Sepolia Network Status</h3>
            <span class="pill pill-live">Test Run 2 Live</span>
          </div>
          <p class="secondary" style="margin-bottom: 16px;">${DATA_BLOCK_TEXT} &middot; Stacker and ProjectRegistry verified and operational.</p>
          <div style="display: flex; gap: 12px; flex-wrap: wrap;">
            <a href="#/stack" class="btn btn-primary btn-sm">Your Stack Console</a>
            <a href="#/docs" class="btn btn-secondary btn-sm">Read the Docs</a>
            <a href="#/projects" class="btn btn-secondary btn-sm">View Projects</a>
          </div>
        </div>
      </div>
    `;
  }

  // --- Page: Stack & Test Tools (#/stack) ---
  function renderStack() {
    document.title = 'Stack - imd/acc';
    const b = state.mockBalances;

    appRoot.innerHTML = `
      <div class="page-view">
        <div class="page-header-block">
          <div class="page-tag"><span class="status-indicator"></span> Sepolia Testnet &middot; ${DATA_BLOCK_TEXT}</div>
          <h1 class="page-title">Your Stack & Testnet Console</h1>
          <p class="page-desc">Track accumulated cashback, sIMD vault shares, and use the Sepolia testnet tools.</p>
        </div>

        <div class="app-grid">
          <!-- Stack Dashboard -->
          <div class="dashboard-card">
            <div class="card-header-row">
              <h3 class="card-title">Your Stack Dashboard</h3>
              <div class="badge-status ${state.account ? 'connected' : 'disconnected'}">
                <span class="status-indicator"></span>
                <span>${state.account ? `Connected: ${shortAddr(state.account)}` : 'Demo Mode (Connect Wallet for on-chain reads)'}</span>
              </div>
            </div>

            <div class="stats-grid">
              <div class="stat-box">
                <span class="stat-label">Cashback Received</span>
                <span class="stat-val" id="stat-cashback">${b.cashback.toFixed(4)} IMD</span>
                <span class="stat-change">From 5 listed trades</span>
              </div>

              <div class="stat-box">
                <span class="stat-label">sIMD Shares Held</span>
                <span class="stat-val" id="stat-shares">${b.shares.toFixed(4)} sIMD</span>
                <span class="stat-change">Live in ERC-4626 vault</span>
              </div>

              <div class="stat-box">
                <span class="stat-label">Current Value</span>
                <span class="stat-val" id="stat-worth">${b.worth.toFixed(4)} IMD</span>
                <span class="stat-change">+${(b.worth - b.cashback).toFixed(4)} IMD yield</span>
              </div>

              <div class="stat-box">
                <span class="stat-label">Total Points</span>
                <span class="stat-val" id="stat-points">${b.points.toFixed(4)} PTS</span>
                <span class="stat-change">1 PT per IMD stacked</span>
              </div>
            </div>

            <h4 style="font-size: 0.95rem; margin-bottom: 12px;">Recent Cashback Events</h4>
            <div class="projects-table-wrap">
              <table class="data-table">
                <thead>
                  <tr>
                    <th>Project</th>
                    <th>Cashback</th>
                    <th>Shares</th>
                    <th>Points</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody id="events-table-body">
                  ${state.stacks.map(s => `
                    <tr>
                      <td><strong class="mono">${safe(s.project)}</strong></td>
                      <td class="mono">${safe(s.imd)} IMD</td>
                      <td class="mono">${safe(s.shares)} sIMD</td>
                      <td class="mono">${safe(s.points)}</td>
                      <td><span class="pill ${s.listed ? 'pill-live' : 'pill-test'}">${s.listed ? 'Listed' : 'Direct'}</span></td>
                    </tr>
                  `).join('')}
                </tbody>
              </table>
            </div>
          </div>

          <!-- Test Tools -->
          <div class="test-tools-box">
            <div class="tool-card">
              <h4 class="tool-title">Sepolia Test IMD Faucet</h4>
              <p class="tool-desc">Request 10,000 TestIMD per address every 24 hours to test trades and crediting.</p>
              <button class="btn btn-primary btn-sm" id="btn-faucet" style="width: 100%;">
                <span>Request 10,000 TestIMD</span>
              </button>
            </div>

            <div class="tool-card">
              <h4 class="tool-title">Test "Stack to Myself"</h4>
              <p class="tool-desc">Approve TestIMD and call <code>Stacker.credit(self, amount)</code> to test the vault minting path.</p>
              <div class="tool-input-row" style="margin-bottom: 10px;">
                <input type="number" class="input-text" id="self-stack-amt" value="5" min="1" step="1" placeholder="Amount">
                <button class="btn btn-secondary btn-sm" id="btn-approve-imd">${state.timdApproved ? 'Approved' : 'Approve'}</button>
                <button class="btn btn-primary btn-sm" id="btn-self-stack">Stack</button>
              </div>
              <div class="secondary" style="font-size: 0.78rem;">Self-stacks are direct, no points.</div>
            </div>

            <div class="tool-card" style="background: var(--bg-card);">
              <h4 class="tool-title">Sepolia Verification Status</h4>
              <p class="tool-desc" style="margin-bottom: 8px;">Stacker v2 deployed at block <code>11,891,109</code>.</p>
              <div style="font-size: 0.8rem; color: var(--text-muted); line-height: 1.5;">
                • Vault status: <span style="color: var(--status-live);">Active (Unpaused)</span><br>
                • Challenge bond: <span class="mono">5 TestIMD</span><br>
                • Cooldown: <span class="mono">1 Hour</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    `;

    document.getElementById('btn-faucet')?.addEventListener('click', async () => {
      try {
        await sendTxWithGas({
          to: ADDRESSES.TEST_IMD,
          data: '0xde5f72fd'
        });
        showToast('Faucet transaction sent on Sepolia!');
      } catch (e) {
        showToast('Simulated +10,000 tIMD added in demo!');
      }
      state.faucetClaimed = true;
    });

    document.getElementById('btn-approve-imd')?.addEventListener('click', async () => {
      try {
        await sendTxWithGas({
          to: ADDRESSES.TEST_IMD,
          data: '0x095ea7b3000000000000000000000000' + ADDRESSES.STACKER.slice(2).toLowerCase() + 'ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff'
        });
        showToast('TestIMD approved for Stacker!');
      } catch (e) {
        showToast('TestIMD approved in demo mode!');
      }
      state.timdApproved = true;
      document.getElementById('btn-approve-imd').textContent = 'Approved';
    });

    document.getElementById('btn-self-stack')?.addEventListener('click', async () => {
      const amt = parseFloat(document.getElementById('self-stack-amt')?.value) || 5;
      try {
        const addrPadded = (state.account || '0xa987ef2aa4d2c0558cc6405f1a8253507274dc5d').slice(2).padStart(64, '0');
        const amtHex = (amt * 1e18).toString(16).padStart(64, '0');
        await sendTxWithGas({
          to: ADDRESSES.STACKER,
          data: '0x8b1a8be6' + addrPadded + amtHex
        });
        showToast(`Stacked ${amt} tIMD to yourself!`);
      } catch (e) {
        showToast(`Stacked ${amt} tIMD (simulated in demo)!`);
      }
      state.mockBalances.cashback += amt;
      state.mockBalances.shares += (amt / 1.037);
      state.mockBalances.worth += amt * 1.04;
      state.stacks.unshift({
        project: 'SelfCredit',
        trader: shortAddr(state.account || '0xa987ef2aa4d2c0558cc6405f1a8253507274dc5d'),
        imd: amt.toFixed(4),
        shares: (amt / 1.037).toFixed(4),
        points: '0.0000',
        listed: false,
        time: 'just now'
      });
      renderStack();
    });
  }

  // --- Page: Projects (#/projects) ---
  let activeFilter = 'all';

  function renderProjects() {
    document.title = 'Projects - imd/acc';
    const allProjs = [...state.projects, ...Object.values(state.appliedProjects)];

    const filtered = allProjs.filter(p => {
      if (activeFilter === 'all') return true;
      if (activeFilter === 'live') return p.state.toLowerCase().includes('live') || p.state.toLowerCase().includes('listed');
      if (activeFilter === 'planned') return p.state.toLowerCase().includes('planned') || p.state.toLowerCase().includes('applied');
      return true;
    });

    appRoot.innerHTML = `
      <div class="page-view">
        <div class="page-header-block">
          <div class="page-tag">Ecosystem Registry &middot; ${DATA_BLOCK_TEXT}</div>
          <h1 class="page-title">Participating Projects</h1>
          <p class="page-desc">Only credits from listed projects earn points. Every project selects its rate between 0.25% and 1.0%.</p>
        </div>

        <div class="filter-tabs">
          <button class="filter-tab ${activeFilter === 'all' ? 'active' : ''}" data-filter="all">All Projects</button>
          <button class="filter-tab ${activeFilter === 'live' ? 'active' : ''}" data-filter="live">Live on Sepolia</button>
          <button class="filter-tab ${activeFilter === 'planned' ? 'active' : ''}" data-filter="planned">Planned Mainnet</button>
        </div>

        <div class="projects-table-wrap">
          <table class="data-table">
            <thead>
              <tr>
                <th>Project</th>
                <th>Chain</th>
                <th>Cashback Rate</th>
                <th>Fee Funding</th>
                <th>Registry Status</th>
                <th>Details</th>
              </tr>
            </thead>
            <tbody>
              ${filtered.map(p => `
                <tr style="cursor: pointer;" onclick="location.hash='#/projects/${p.address}'">
                  <td>
                    <div style="font-weight: 700; color: var(--text-primary);">${safe(p.name)}</div>
                    <div class="secondary mono" style="font-size: 0.76rem;">${shortAddr(p.address)}</div>
                  </td>
                  <td><span class="mono">${safe(p.chain || 'Sepolia')}</span></td>
                  <td><strong class="mono" style="color: var(--accent-light);">${(p.rateBps / 100).toFixed(2)}% (${p.rateBps} bps)</strong></td>
                  <td>${safe(p.feeFunding || 'Trading fee cut')}</td>
                  <td><span class="pill ${p.state.includes('Live') || p.state.includes('Listed') ? 'pill-live' : p.state.includes('Planned') ? 'pill-planned' : 'pill-test'}">${safe(p.state)}</span></td>
                  <td><a href="#/projects/${p.address}" class="btn btn-secondary btn-sm">&rarr; View</a></td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
      </div>
    `;

    document.querySelectorAll('.filter-tab').forEach(btn => {
      btn.addEventListener('click', (e) => {
        activeFilter = e.currentTarget.getAttribute('data-filter');
        renderProjects();
      });
    });
  }

  // --- Page: Project Detail (#/projects/<address>) ---
  function renderProjectDetail(rawAddr) {
    const addr = rawAddr.toLowerCase();
    document.title = `Project ${shortAddr(rawAddr)} - imd/acc`;
    const allProjs = [...state.projects, ...Object.values(state.appliedProjects)];
    const p = allProjs.find(x => x.address.toLowerCase() === addr);

    if (!p) {
      appRoot.innerHTML = `
        <div class="page-view">
          <div class="page-header-block">
            <h1 class="page-title">Project Not Found</h1>
          </div>
          <div class="dashboard-card">
            <p class="secondary">Contract ${safe(rawAddr)} has not been applied to the ProjectRegistry, or has no recorded events.</p>
            <div style="margin-top: 16px;">
              <a href="#/projects" class="btn btn-secondary btn-sm">&larr; Back to Projects</a>
              <a href="#/apply" class="btn btn-primary btn-sm">Apply for Listing</a>
            </div>
          </div>
        </div>
      `;
      return;
    }

    appRoot.innerHTML = `
      <div class="page-view">
        <div class="page-header-block">
          <div class="page-tag"><a href="#/projects">&larr; Projects Directory</a></div>
          <h1 class="page-title">${safe(p.name)}</h1>
          <p class="page-desc mono" style="font-size: 0.88rem;">${safe(p.address)}</p>
        </div>

        <div class="grid-2">
          <div class="dashboard-card">
            <div class="card-header-row">
              <h3 class="card-title">Project Details</h3>
              <span class="pill ${p.state.includes('Live') || p.state.includes('Listed') ? 'pill-live' : 'pill-planned'}">${safe(p.state)}</span>
            </div>
            <p style="margin-bottom: 8px;">Applied rate: <strong class="mono" style="color: var(--accent-light);">${(p.rateBps / 100).toFixed(2)}% (${p.rateBps} bps) (historical)</strong></p>
            <p style="margin-bottom: 8px;">Beneficiary: <span class="mono">${safe(p.beneficiary)}</span></p>
            <p>Fee Funding: ${safe(p.feeFunding || 'Trading fee cut')}</p>

            <h4 style="font-size: 0.95rem; margin-top: 20px; margin-bottom: 10px;">Registry Event Log</h4>
            <ul style="list-style: none; display: flex; flex-direction: column; gap: 6px; font-size: 0.85rem;" class="secondary">
              ${(p.history || []).map(h => `<li>&bull; ${safe(h)}</li>`).join('')}
            </ul>
          </div>

          <div class="dashboard-card">
            <div class="card-header-row">
              <h3 class="card-title">Challenge Listing</h3>
            </div>
            <p class="secondary" style="margin-bottom: 14px;">Anyone can challenge a listed project with a 5 test IMD bond + 0.5 fee. If the project meets the rules, the bond goes to its beneficiary; otherwise it is delisted.</p>
            ${p.cooldownRemaining ? `<p class="secondary" style="color: var(--status-pending); margin-bottom: 12px;">Cooldown active. Challenge opens in ${p.cooldownRemaining}.</p>` : ''}
            
            <div class="form-group">
              <label class="form-label" for="ch-reason">Reason for Challenge</label>
              <input type="text" id="ch-reason" class="form-input" placeholder="State reason (max 280 chars)...">
              <div id="ch-reason-error" class="field-error"></div>
            </div>

            <button class="btn btn-secondary btn-sm" id="btn-submit-challenge">Submit Challenge (5.5 tIMD)</button>
          </div>
        </div>
      </div>
    `;

    document.getElementById('btn-submit-challenge')?.addEventListener('click', () => {
      const reason = document.getElementById('ch-reason')?.value?.trim();
      const err = document.getElementById('ch-reason-error');
      if (!reason) {
        if (err) err.textContent = 'Reason is required';
        return;
      }
      showToast('Challenge submitted (simulated on Sepolia)!');
      p.history.push('Challenged');
      renderProjectDetail(rawAddr);
    });
  }

  // --- Page: Apply (#/apply) ---
  function renderApply() {
    document.title = 'Apply - imd/acc';
    const f = state.applyForm;

    const panelQ = f.project && f.name && f.url && f.rate
      ? `imd/acc listing review: Is project ${f.project} (${f.name}) at ${f.url} a genuine trading pool/contract with fee >= cashback rate (${f.rate} bps)?`
      : 'imd/acc listing review: Fill out the application form to generate the exact oracle question.';

    appRoot.innerHTML = `
      <div class="page-view">
        <div class="page-header-block">
          <div class="page-tag">On-Chain Registry &middot; ${DATA_BLOCK_TEXT}</div>
          <h1 class="page-title">Apply for Project Listing</h1>
          <p class="page-desc">List your project on the ownerless ProjectRegistry so your traders' cashback credits earn points.</p>
        </div>

        <div class="app-grid">
          <div class="dashboard-card">
            <h3 class="card-title" style="margin-bottom: 20px;">Application Form</h3>

            <div class="form-group">
              <label class="form-label" for="apply-project">Contract Address</label>
              <input type="text" id="apply-project" class="form-input" value="${safe(f.project)}" placeholder="0x...">
              <div id="apply-project-error" class="field-error">${safe(f.errors.project || '')}</div>
            </div>

            <div class="form-group">
              <label class="form-label" for="apply-name">Project Name (1-48 chars)</label>
              <input type="text" id="apply-name" class="form-input" value="${safe(f.name)}" placeholder="e.g. PLEA v11">
              <div id="apply-name-error" class="field-error">${safe(f.errors.name || '')}</div>
            </div>

            <div class="form-group">
              <label class="form-label" for="apply-url">Verified Source URL (https://)</label>
              <input type="text" id="apply-url" class="form-input" value="${safe(f.url)}" placeholder="https://github.com/...">
              <div id="apply-url-error" class="field-error">${safe(f.errors.url || '')}</div>
            </div>

            <div class="form-group">
              <label class="form-label" for="apply-rate">Cashback Rate (25 to 100 bps)</label>
              <input type="number" id="apply-rate" class="form-input" value="${safe(f.rate)}" placeholder="50">
              <div id="apply-rate-error" class="field-error">${safe(f.errors.rate || '')}</div>
            </div>

            <div class="form-group">
              <label class="form-label" for="apply-beneficiary">Beneficiary Address</label>
              <input type="text" id="apply-beneficiary" class="form-input" value="${safe(f.beneficiary)}" placeholder="0x...">
              <div id="apply-beneficiary-error" class="field-error">${safe(f.errors.beneficiary || '')}</div>
            </div>

            <div style="display: flex; gap: 10px; flex-wrap: wrap; margin-top: 20px;">
              <button class="btn btn-secondary btn-sm" id="btn-get-feetoken">Get 10 test IMD</button>
              <button class="btn btn-secondary btn-sm" id="btn-approve-fee">Approve fee</button>
              <button class="btn btn-primary btn-sm" id="btn-apply-listing">Apply for listing</button>
            </div>
            <div id="step-apply-disabled" class="disabled-reason">
              ${!f.mintedFeeToken ? 'Need 0.5 test IMD fee token to apply.' : !f.approvedFee ? 'Approve 0.5 test IMD fee to registry.' : ''}
            </div>

            <!-- Panel Preview -->
            <div id="apply-panel" style="margin-top: 24px;">
              <label class="form-label">Oracle Panel Question Preview</label>
              <div class="code-container" style="margin-top: 6px;">
                <pre class="code-block" style="font-size: 0.8rem; white-space: pre-wrap; overflow-wrap: anywhere;"><code>${safe(panelQ)}</code></pre>
              </div>
            </div>
          </div>

          <!-- Open Questions & Recent Outcomes -->
          <div class="test-tools-box">
            <div class="dashboard-card" style="padding: 24px;">
              <h3 class="card-title" style="margin-bottom: 14px;">Open Questions</h3>
              <div style="display: flex; flex-direction: column; gap: 12px;">
                ${Object.values(state.appliedProjects).map(ap => `
                  <div style="border-bottom: 1px solid var(--border-subtle); padding-bottom: 8px;">
                    <strong>${safe(ap.name)}</strong> (${safe(ap.state)})<br>
                    <span class="secondary mono" style="font-size: 0.78rem;">${shortAddr(ap.address)}</span>
                  </div>
                `).join('')}
                <div style="border-bottom: 1px solid var(--border-subtle); padding-bottom: 8px;">
                  <strong>TestIMD Hook</strong> (Applied)<br>
                  <span class="secondary mono" style="font-size: 0.78rem;">0x2b69...1e82 &middot; 12 min ago</span>
                </div>
              </div>

              <h3 class="card-title" style="margin-top: 24px; margin-bottom: 12px;">Recent Outcomes</h3>
              <p class="secondary" style="font-size: 0.84rem; line-height: 1.6;">
                &bull; SelfCredit trial: Rejected (negative test case)<br>
                &bull; TestSIMD Pool: Defended (bond to beneficiary)
              </p>
            </div>
          </div>
        </div>
      </div>
    `;

    function validate(id, val) {
      val = (val || '').trim();
      if (id === 'project') {
        if (!/^0x[a-fA-F0-9]{40}$/.test(val)) return 'not an address';
        if (val.toLowerCase() === '0x0000000000000000000000000000000000000001') return 'no contract code';
        if (val.toLowerCase() === ADDRESSES.TEST_SIMD.toLowerCase()) return 'Already listed';
        if (val.toLowerCase() === ADDRESSES.TEST_IMD.toLowerCase()) return 'This project already has an open question';
      }
      if (id === 'name') {
        if (!val) return 'name is required';
        if (val.length > 48) return 'name too long (maximum 48 characters)';
        if (val.includes('"')) return 'disallowed character: double quote';
        if (val.includes('\\')) return 'disallowed character: backslash';
        if (/[[\]]/.test(val)) return 'disallowed character: square bracket';
        if (/[^\x20-\x7E]/.test(val)) return 'disallowed character: non-ASCII';
      }
      if (id === 'url') {
        if (!val.startsWith('https://')) return 'URL must start with https://';
        if (val.length < 12) return 'URL too short (minimum 12 characters)';
        if (val.length > 200) return 'URL too long (maximum 200 characters)';
      }
      if (id === 'rate') {
        const r = parseInt(val, 10);
        if (isNaN(r) || r < 25 || r > 100) return 'rate must be between 25 to 100 bps';
      }
      if (id === 'beneficiary') {
        if (!/^0x[a-fA-F0-9]{40}$/.test(val)) return 'not an address';
        if (val.toLowerCase() === '0x0000000000000000000000000000000000000000') return 'beneficiary cannot be zero address';
      }
      return '';
    }

    ['project', 'name', 'url', 'rate', 'beneficiary'].forEach((id) => {
      const el = document.getElementById(`apply-${id}`);
      const errEl = document.getElementById(`apply-${id}-error`);
      if (el) {
        if (f.errors[id]) {
          el.setAttribute('aria-invalid', 'true');
        }
        el.addEventListener('blur', () => {
          const err = validate(id, el.value);
          f.errors[id] = err;
          f[id] = el.value;
          if (err) {
            errEl.textContent = err;
            el.setAttribute('aria-invalid', 'true');
          } else {
            errEl.textContent = '';
            el.removeAttribute('aria-invalid');
          }
        });
      }
    });

    document.getElementById('btn-get-feetoken')?.addEventListener('click', () => {
      f.mintedFeeToken = true;
      showToast('Minted 10 test IMD fee token!');
      renderApply();
    });

    document.getElementById('btn-approve-fee')?.addEventListener('click', () => {
      f.approvedFee = true;
      showToast('Approved fee for ProjectRegistry!');
      renderApply();
    });

    document.getElementById('btn-apply-listing')?.addEventListener('click', () => {
      let hasErr = false;
      ['project', 'name', 'url', 'rate', 'beneficiary'].forEach((id) => {
        const val = document.getElementById(`apply-${id}`)?.value || '';
        const err = validate(id, val);
        f.errors[id] = err;
        if (err) hasErr = true;
      });
      if (hasErr) {
        renderApply();
        return;
      }

      state.appliedProjects[f.project.toLowerCase()] = {
        address: f.project,
        name: f.name,
        state: 'Applied',
        rateBps: parseInt(f.rate, 10),
        beneficiary: f.beneficiary,
        chain: 'Sepolia Testnet',
        feeFunding: 'Contract fee split',
        history: ['Applied'],
        openQuestion: {
          kind: 'Listing Application',
          age: 'just now',
          asker: shortAddr(state.account || '0xa987ef2aa4d2c0558cc6405f1a8253507274dc5d')
        },
        isRegistered: true
      };

      showToast('Application submitted to ProjectRegistry!');
      renderApply();
    });
  }

  // --- Page: Leaderboard (#/leaderboard) ---
  function renderLeaderboard() {
    document.title = 'Leaderboard - imd/acc';

    appRoot.innerHTML = `
      <div class="page-view">
        <div class="page-header-block">
          <div class="page-tag">Cumulative Points &middot; ${DATA_BLOCK_TEXT}</div>
          <h1 class="page-title">Leaderboards</h1>
          <p class="page-desc">Points are earned at 1 point per IMD stacked across all listed participating projects.</p>
        </div>

        <div class="grid-2">
          <div class="dashboard-card">
            <h3 class="card-title" style="margin-bottom: 16px;">Top Stackers</h3>
            <div class="projects-table-wrap">
              <table class="data-table">
                <thead>
                  <tr>
                    <th>Rank</th>
                    <th>Trader</th>
                    <th>Points</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td><strong>#1</strong></td>
                    <td><span class="mono">0x71C8...3B19</span></td>
                    <td><strong class="mono" style="color: var(--accent-light);">1,450.00</strong></td>
                  </tr>
                  <tr>
                    <td><strong>#2</strong></td>
                    <td><span class="mono">0x882a...98e1</span></td>
                    <td><strong class="mono" style="color: var(--accent-light);">980.00</strong></td>
                  </tr>
                  <tr>
                    <td><strong>#3</strong></td>
                    <td><span class="mono">0x4b91...6821</span></td>
                    <td><strong class="mono" style="color: var(--accent-light);">320.00</strong></td>
                  </tr>
                  ${state.account ? `
                    <tr style="background: var(--bg-elevated);">
                      <td>-</td>
                      <td><span class="mono">${shortAddr(state.account)}</span> (You)</td>
                      <td><strong class="mono" style="color: var(--accent-light);">${state.mockBalances.points.toFixed(2)}</strong></td>
                    </tr>
                  ` : ''}
                </tbody>
              </table>
            </div>
          </div>

          <div class="dashboard-card">
            <h3 class="card-title" style="margin-bottom: 16px;">Top Projects by Volume</h3>
            <div class="projects-table-wrap">
              <table class="data-table">
                <thead>
                  <tr>
                    <th>Project</th>
                    <th>IMD Stacked</th>
                    <th>Traders</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td><strong>PLEA</strong> (v10 Hook)</td>
                    <td class="mono" style="color: var(--accent-light);">124,500 IMD</td>
                    <td class="mono">42</td>
                  </tr>
                  <tr>
                    <td><strong>PondPad</strong> (Planned)</td>
                    <td class="mono">0 IMD</td>
                    <td class="mono">0</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    `;
  }

  // --- Docs (#/docs and #/docs/<section>): GitBook-style sections ---
  const EXPLORER = {
    sepolia: 'https://sepolia.etherscan.io/address/',
    mainnet: 'https://etherscan.io/address/'
  };

  function docTable(headers, rows) {
    return `
      <div class="projects-table-wrap">
        <table class="data-table">
          <thead><tr>${headers.map(h => `<th>${h}</th>`).join('')}</tr></thead>
          <tbody>${rows.map(r => `<tr>${r.map(c => `<td>${c}</td>`).join('')}</tr>`).join('')}</tbody>
        </table>
      </div>`;
  }

  function docCode(title, code, id) {
    return `
      <div class="code-container">
        <div class="code-header">
          <span class="code-title">${title}</span>
          <button class="btn btn-secondary btn-sm copy-btn" data-clipboard-target="#${id}">Copy</button>
        </div>
        <pre class="code-block" id="${id}"><code>${safe(code)}</code></pre>
      </div>`;
  }

  function docAddr(addr) {
    return `<a class="mono" style="white-space: nowrap;" href="${EXPLORER.sepolia}${addr}" target="_blank" rel="noopener noreferrer" title="${addr}">${shortAddr(addr)} &nearr;</a>`;
  }

  function docContract(name, pill, pillClass, addr, desc, explorer) {
    return `
      <div class="contract-card">
        <div class="contract-card-header">
          <span class="contract-name">${name}</span>
          <span class="pill ${pillClass}">${pill}</span>
        </div>
        ${addr ? `
          <div class="address-row">
            <span class="address-text">${addr}</span>
            <button class="btn btn-secondary btn-sm copy-btn" data-clipboard="${addr}">Copy</button>
          </div>` : ''}
        <p class="secondary">${desc}${addr && explorer ? ` <a href="${explorer}${addr}" target="_blank" rel="noopener noreferrer">Explorer &nearr;</a>` : ''}</p>
      </div>`;
  }

  const INTEGRATION_SNIPPET = `// Once: let the Stacker pull IMD from your contract.
IERC20(imd).approve(address(stacker), type(uint256).max);

// On each trade, for the real trader (hookData, else sender).
// Your rate: 25-100 bps, out of the fee you already charge.
uint256 cashback = imdSideAmount * RATE_BPS / 10_000;

// Check gas first, so no wallet estimate skips the cashback.
require(gasleft() >= CREDIT_GAS, "gas for cashback");

try stacker.credit(trader, cashback) {
    // the trader now holds the sIMD
} catch {
    // plain IMD instead: the trade never reverts
    IERC20(imd).transfer(trader, cashback);
}`;

  const STACKER_ABI = `function credit(address trader, uint256 imdAmount)
    external
    returns (uint256 shares);

function IMD() external view returns (address);
function SIMD() external view returns (address);
function projectStacked(address) external view returns (uint256);
function projectShares(address) external view returns (uint256);
function totalStacked() external view returns (uint256);

event Stacked(
    address indexed project,
    address indexed trader,
    uint256 imd,
    uint256 shares
);

error ZeroTrader();
error AssetMismatch(address vaultAsset, address imd);
error ZeroShares();`;

  const DOCS = [
    {
      group: 'Getting started',
      pages: [
        {
          slug: 'introduction',
          title: 'Introduction',
          summary: 'imd/acc pays trading cashback as staked IMD (sIMD), straight into the trader\'s wallet.',
          keywords: 'overview what is sIMD cashback staked IMD btc/acc',
          body: `
            <p>Every trade in a participating project sends part of the trade, <strong>between 0.25% and 1%</strong> at the project's choice, back to the trader as <strong>sIMD</strong>: shares of IMD's staking vault, minted directly to the trader's wallet, where they keep earning the vault's yield. Nothing to claim, no new token, and no extra fee for the trader.</p>
            <div class="docs-features">
              <div class="docs-feature"><h4>No new token</h4><p>The cashback is IMD, staked. There is nothing else to buy.</p></div>
              <div class="docs-feature"><h4>No custody</h4><p>imd/acc never holds the cashback. The vault mints the shares directly to the trader.</p></div>
              <div class="docs-feature"><h4>No extra fee</h4><p>Projects pay out of fees they already charge, so traders pay nothing on top.</p></div>
              <div class="docs-feature"><h4>No owner</h4><p>The shared contracts have no admin, no fee, no pause and no upgrade.</p></div>
            </div>
            <h2 id="pieces">The pieces</h2>
            <ul>
              <li><strong>Stacker</strong>: one shared, ownerless contract every project calls with <code>credit(trader, amount)</code>. It pulls the IMD and deposits it into the sIMD vault for the trader.</li>
              <li><strong>ProjectRegistry</strong>: an ownerless list of the projects whose cashback earns <a href="#/docs/points">points</a>, decided by an IdentityMD oracle panel.</li>
              <li><strong>sIMD vault</strong>: IMD's own ERC-4626 staking vault. imd/acc only deposits into it.</li>
            </ul>
            <h2 id="status">Where it stands</h2>
            <p>The Stacker and the ProjectRegistry are live on Sepolia (latest: test run 4, launch #1378). The mainnet Stacker launch is ready, against the real IMD and sIMD. See <a href="#/docs/contracts">Contracts</a> for every address and <a href="#/docs/roadmap">Roadmap</a> for what comes next.</p>
            <div class="docs-callout"><p>imd/acc is inspired by TokenWorks' btc/acc: the same idea of turning trading activity into a growing stack, here in staked IMD.</p></div>`
        },
        {
          slug: 'how-it-works',
          title: 'How it works',
          summary: 'One trade, one transaction: the cashback is staked for the trader inside the swap itself.',
          keywords: 'flow hook credit deposit vault shares stacked event',
          body: `
            <h2 id="flow">The flow</h2>
            ${docCode('Flow', `trader --trades--> project's pool and hook
                     |  takes 0.25%-1% of the trade in IMD,
                     |  out of the fee it already charges
                     v
          Stacker.credit(trader, amount)
                     |  pulls the IMD from the project
                     v
          sIMD.deposit(amount, trader)
                     |  shares minted to the trader
                     v
          Stacked(project, trader, imd, shares) --> points`, 'doc-flow')}
            <ol>
              <li>A trader trades in a participating pool, for example PLEA/IMD.</li>
              <li>The project's hook takes its cashback rate (0.25%&ndash;1%) of the trade on the IMD side, out of the fee it already charges, so IMD-paired pools need no extra swap.</li>
              <li>The hook calls <code>Stacker.credit(trader, amount)</code>. The Stacker pulls the IMD and calls <code>sIMD.deposit(amount, trader)</code>, so the vault mints the shares straight to the trader.</li>
              <li>The Stacker emits <code>Stacked(project, trader, imd, shares)</code>. That event is the record behind every figure and every point.</li>
            </ol>
            <h2 id="atomic">All in one transaction</h2>
            <p>The cashback is staked inside the trader's own swap. The Stacker keeps 0 IMD and 0 sIMD between calls; if the vault refuses the deposit, the credit reverts and moves nothing, and the project pays plain IMD instead (see <a href="#/docs/integration">Integration guide</a>).</p>
            <div class="docs-callout"><p><strong>One-block hold.</strong> The vault stamps any wallet that receives new shares, and that wallet can't redeem in the same block. Anyone can already deposit into the vault for someone else, so the Stacker adds nothing new here.</p></div>`
        },
        {
          slug: 'cashback-rate',
          title: 'Cashback rate',
          summary: 'Each project picks its rate between 0.25% and 1% of each trade, funded from its existing fees.',
          keywords: 'rate bps 25 100 basis points fee change',
          body: `
            <h2 id="range">0.25% to 1%, chosen by each project</h2>
            <p>Projects with thin fees can still join at 0.25%; others can offer up to 1% to attract traders. PLEA pays 0.5%. The rate is taken on the IMD side of each trade, <strong>out of the fee the project already charges</strong>: traders never pay extra.</p>
            ${docTable(['Rate', 'Basis points', 'Cashback on a 1,000 IMD trade'], [
              ['0.25%', '25', '2.5 IMD'],
              ['0.50%', '50', '5 IMD'],
              ['0.75%', '75', '7.5 IMD'],
              ['1.00%', '100', '10 IMD']
            ])}
            <h2 id="changes">Changing the rate</h2>
            <p>A listed project may change its rate later, as long as its code keeps every allowed rate between 0.25% and 1% and keeps the <a href="#/docs/fee-guard">fee guard</a> for every allowed setting. A change inside those limits keeps the listing.</p>
            <h2 id="per-credit">Checked per credit</h2>
            <p>Points count only credits within 25&ndash;100 bps of their own trade. A credit outside that range, or with no trade on the project's pool in that transaction, earns no points.</p>`
        },
        {
          slug: 'points',
          title: 'Points',
          summary: '1 point per IMD stacked, for traders of listed projects. Nothing is promised.',
          keywords: 'points leaderboard airdrop listed fromBlock dashboard',
          body: `
            <p>Every <code>Stacked</code> event is kept as a record. Points are the basis for the leaderboards and maybe a later airdrop; <strong>nothing is promised</strong>.</p>
            <h2 id="rules">How points work</h2>
            <ul>
              <li><strong>Trader points:</strong> 1 point per IMD stacked for the trader. A project with a higher rate gives its traders more cashback, so more points.</li>
              <li><strong>Project points:</strong> the IMD its traders stacked.</li>
              <li><strong>Listed projects only.</strong> Anyone can call <code>credit</code> with their own IMD; that's just staking for someone, so it earns no points. Only credits from a listed project count, from the block it was listed, never before.</li>
              <li><strong>Counted from events</strong>, which can't be changed or deleted. An indexer keeps the totals ready for the site; project totals are also on chain.</li>
            </ul>
            <h2 id="dashboard">What a trader sees</h2>
            ${docTable(['Figure', 'Where it comes from'], [
              ['Cashback received, points, split per project', 'their <code>Stacked</code> events'],
              ['sIMD held now', 'the vault, live'],
              ['What their cashback is worth today', 'the shares in their events, priced by the vault, live'],
              ['Earned on top (vault yield)', 'worth today minus cashback received']
            ])}
            <p>The all-traders dashboard and leaderboards (top traders, top projects, 7-day and 30-day views) come from the same events.</p>`
        }
      ]
    },
    {
      group: 'For traders',
      pages: [
        {
          slug: 'your-simd',
          title: 'Your sIMD',
          summary: 'What lands in your wallet, how it earns, and how to unstake.',
          keywords: 'trader sIMD vault yield redeem withdraw unstake erc-4626 decimals',
          body: `
            <h2 id="what">What you receive</h2>
            <p>Cashback arrives as <strong>sIMD</strong>, the share token of IMD's ERC-4626 staking vault on Ethereum (<code>0x9efa…7247</code>, 24 decimals). It is minted to your wallet in the same transaction as your trade. There is nothing to claim.</p>
            <h2 id="yield">How it earns</h2>
            <p>Each sIMD share is worth a growing amount of IMD as the vault earns, so your cashback keeps growing while you hold it. The vault's owner is renounced: nobody can pause it or sweep its funds.</p>
            <h2 id="unstake">Unstaking</h2>
            <p>You can redeem sIMD for IMD in the vault at any time, except in the block where new shares arrive (the vault's one-block hold).</p>
            <h2 id="points">Points</h2>
            <p>Trades in a <a href="#/docs/listing">listed</a> project also earn you 1 point per IMD of cashback. Check the <a href="#/leaderboard">Leaderboard</a> and <a href="#/stack">Your stack</a>.</p>
            <div class="docs-callout"><p><strong>On other chains</strong> (planned, Robinhood Chain first), your cashback waits on that chain and is delivered to Ethereum as sIMD. See <a href="#/docs/multichain">Multichain</a>.</p></div>`
        }
      ]
    },
    {
      group: 'For projects',
      pages: [
        {
          slug: 'integration',
          title: 'Integration guide',
          summary: 'Seven rules for paying cashback from your hook or pool without ever breaking a trade.',
          keywords: 'integrate hook uniswap v4 try catch fallback gasleft hookData tx.origin approve',
          body: `
            ${docCode('Solidity &middot; inside your hook', INTEGRATION_SNIPPET, 'doc-integration')}
            <h2 id="rules">The rules</h2>
            <div class="docs-grid">
              <div class="doc-rule-card"><span class="rule-number">1</span><div class="rule-content"><h4>Fund it from your fee</h4><p>Pick a rate from 0.25% to 1% and take it on the IMD side of the trade, out of the fee you already charge. The part of your fee that leaves you must be at least as large as the cashback (the <a href="#/docs/fee-guard">fee guard</a>).</p></div></div>
              <div class="doc-rule-card"><span class="rule-number">2</span><div class="rule-content"><h4>Never break a trade</h4><p>Wrap <code>credit</code> in <code>try/catch</code> and pay plain IMD to the trader if it fails.</p></div></div>
              <div class="doc-rule-card"><span class="rule-number">3</span><div class="rule-content"><h4>Pay the real trader</h4><p>Read it from the router's <code>hookData</code>, fall back to <code>sender</code>, never use <code>tx.origin</code>.</p></div></div>
              <div class="doc-rule-card"><span class="rule-number">4</span><div class="rule-content"><h4>Check gas first</h4><p>Require enough gas for <code>credit</code> up front with <code>gasleft()</code>. Otherwise a wallet's gas estimate picks the cheaper path without cashback.</p></div></div>
              <div class="doc-rule-card"><span class="rule-number">5</span><div class="rule-content"><h4>Budget the gas</h4><p>About 136k gas for a new trader and 102k for a repeat one on mainnet (whole transactions). Wallets should send estimates &times; 1.3. See <a href="#/docs/gas">Gas &amp; costs</a>.</p></div></div>
              <div class="doc-rule-card"><span class="rule-number">6</span><div class="rule-content"><h4>Uniswap v4 hooks</h4><p>Include the <code>afterSwap</code> logic Uniswap's frontend whitelisting expects, support the router's <code>msgSender</code>, and warn users about copycat pools.</p></div></div>
              <div class="doc-rule-card"><span class="rule-number">7</span><div class="rule-content"><h4>Test the failure path</h4><p>On Sepolia, TestSIMD's owner can pause it; your hook should then pay plain IMD. See <a href="#/docs/testing">Testing on Sepolia</a>.</p></div></div>
            </div>
            <h2 id="approve">Approve once</h2>
            <p>The Stacker pulls IMD from <code>msg.sender</code>, so your contract approves it once. The Stacker's IMD and vault addresses are immutable, so the approval never needs to move.</p>
            <h2 id="after">After integrating</h2>
            <p>Verify your contract's source (Etherscan, Blockscout or Sourcify), then <a href="#/docs/listing">apply for listing</a> so your traders' cashback earns points.</p>`
        },
        {
          slug: 'fee-guard',
          title: 'Fee guard',
          summary: 'Why the part of your fee that really leaves must be at least as large as the cashback.',
          keywords: 'fee guard farming owner leaves burn locked liquidity prizes',
          body: `
            <p>A normal trader can't farm points: they pay the whole fee and get back only the cashback, which is smaller. A project owner also gets back their own share of the fee, so trading with themselves could be nearly free. The fee guard closes that.</p>
            <h2 id="parts">Split the fee into three parts</h2>
            ${docTable(['Part', 'Examples', 'Counts as "leaves"?'], [
              ['Cashback', 'the trader\'s sIMD', 'no'],
              ['Comes back to the owner', 'owner share, team treasury, liquidity the owner can withdraw', 'no'],
              ['Really leaves', 'burned tokens, liquidity locked forever, prizes paid to other people, fees to third parties', '<strong>yes</strong>']
            ])}
            <div class="docs-callout"><p><strong>Rule: "really leaves" &ge; cashback.</strong> Then every point an owner farms costs at least as much as it returns, plus price impact and gas. If the rate or the fee split can change, the code must keep this true for every allowed setting.</p></div>
            <h2 id="examples">Examples</h2>
            <ul>
              <li><strong>PLEA passes:</strong> fee 1.75% = 0.5% cashback + 0.5% owner + 0.25% locked liquidity + 0.25% burn + 0.25% season prizes. Leaves 0.75% &ge; 0.5%.</li>
              <li><strong>Fails:</strong> fee 1.25% = 1% cashback + 0.25% owner. Nothing leaves, so points are almost free. Such a project can still use imd/acc, unlisted.</li>
            </ul>`
        },
        {
          slug: 'listing',
          title: 'Listing & the registry',
          summary: 'How a project gets listed, challenged or delisted by an IdentityMD oracle panel, with no owner.',
          keywords: 'apply listing registry oracle panel challenge bond cooldown beneficiary handoff claimBond owed expire rules',
          body: `
            <p>Any project can use imd/acc: its traders get real sIMD from the first credit. <strong>Listing</strong> decides which projects' credits also earn points. The <strong>ProjectRegistry</strong> has no owner: an IdentityMD oracle panel answers each question.</p>
            <h2 id="steps">Steps</h2>
            <ol>
              <li><strong>Integrate</strong> following the <a href="#/docs/integration">integration guide</a>, and verify your source.</li>
              <li><strong>Apply.</strong> Anyone calls <code>applyListing(project, name, sourceUrl, rateBps, beneficiary)</code> (or uses the <a href="#/apply">Apply</a> page) and pays the oracle fee, read live from the Intake: 0.5 IMD today.</li>
              <li><strong>The panel answers</strong> within minutes. 15 seats, 11 must agree. <strong>Yes</strong> lists the project from that block; <strong>no</strong> rejects it, and it can apply again.</li>
              <li><strong>No answer</strong> (a split panel or a refused question) clears the application; it can be sent again at once. Nothing is listed.</li>
            </ol>
            <h2 id="rules">What the panel checks</h2>
            ${docTable(['Rule', 'In short'], [
              ['trading', 'Every credit happens inside a trade, for that trade\'s trader, with IMD from that trade\'s fees.'],
              ['trader', 'The project never picks who is credited; the hookData address (else the sender) counts as the trader.'],
              ['otherPayouts', 'Cashback paid outside the Stacker (for example the plain-IMD fallback) is allowed and simply earns no points.'],
              ['rate', 'Each credit is the stated rate of its trade, between 25 and 100 bps.'],
              ['feeGuard', 'The parts of the fee that leave for good add up to at least the cashback, for every allowed setting.'],
              ['lockedValue', 'Value no owner or team wallet can ever withdraw counts as leaving for good.'],
              ['beneficiary', 'The beneficiary is the project\'s owner, or a wallet its source or website names as team or treasury.'],
              ['evidence', 'Judged from verified source on Etherscan, Blockscout or Sourcify, and on-chain reads.']
            ])}
            <h2 id="challenges">Challenges</h2>
            <p>Anyone can challenge a listed project after its cooldown with <code>challengeForBeneficiary(project, reason, beneficiary)</code>, paying the oracle fee plus a bond. If the panel says it still meets the rules, it stays listed and <strong>the bond goes to its beneficiary</strong> (the cooldown doesn't restart); if not, it is delisted from that block, earlier points stay, and the challenger gets the bond back.</p>
            <h2 id="beneficiary">Beneficiary and bonds</h2>
            <ul>
              <li>The <strong>beneficiary</strong> holds the project's points, since a hook contract can't receive an airdrop. It can hand them to another wallet with <code>setBeneficiary</code>, at most once per day and never while a question is open.</li>
              <li>If the token ever refuses to pay a bond, the question still settles and the bond is recorded as owed; its owner takes it with <code>claimBond(to)</code>, to any wallet.</li>
              <li><code>expire(project)</code> lets anyone clear a question that can no longer be answered, after a day or once the Intake completed it.</li>
            </ul>
            <h2 id="settings">Settings</h2>
            ${docTable(['Setting', 'Sepolia', 'Ethereum (planned)'], [
              ['Oracle fee', '0.5 test IMD', '0.5 IMD'],
              ['Challenge bond', '5 test IMD', '20 IMD'],
              ['Challenge cooldown', '1 hour', '7 days'],
              ['Panel', '15 seats, 11 agree', '15 seats, 11 agree'],
              ['Open question expires', '1 day', '1 day'],
              ['Beneficiary handoff', 'once per day', 'once per day']
            ])}`
        },
        {
          slug: 'testing',
          title: 'Testing on Sepolia',
          summary: 'Test IMD from a faucet, a pausable test vault, and the live Stacker and registry.',
          keywords: 'sepolia testnet faucet testimd testsimd pause fallback mint self stack',
          body: `
            <h2 id="tokens">Get test tokens</h2>
            <ul>
              <li><strong>TestIMD</strong> (<code>0x2b69…1e82</code>): call <code>faucet()</code> for 10,000 tIMD per address every 24 hours, or use <a href="#/stack">Your stack</a>.</li>
              <li><strong>Oracle test IMD</strong> (<code>0x44a1…f89a</code>): pays the registry's oracle fee; anyone can <code>mint(to, amount)</code>.</li>
            </ul>
            <h2 id="credit">Try a credit</h2>
            <p>Approve the Stacker for TestIMD, then call <code>credit(yourAddress, amount)</code>. The TestSIMD vault mints you shares. Credits from your own wallet are direct, so they earn no points.</p>
            <h2 id="fallback">Test your fallback</h2>
            <p>TestSIMD is a copy of StakedIMD whose owner can pause it, so integrators can check that their hook pays plain IMD when <code>credit</code> reverts. The mainnet vault can't be paused (its owner is renounced).</p>
            <h2 id="gas">Sepolia gas</h2>
            <p>Sepolia charges much more for new storage than mainnet: a first credit for a new trader has used 0.7M&ndash;1.2M gas there. Always use estimates &times; 1.3.</p>`
        }
      ]
    },
    {
      group: 'Reference',
      pages: [
        {
          slug: 'contracts',
          title: 'Contracts',
          summary: 'Every imd/acc deployment and the IMD contracts it works with.',
          keywords: 'addresses deployments stacker registry testimd testsimd mainnet sepolia explorer copy',
          body: `
            <h2 id="sepolia">Sepolia (chain 11155111)</h2>
            <div class="contracts-grid">
              ${docContract('Stacker', 'Live', 'pill-live', ADDRESSES.STACKER, 'The cashback funnel every project calls. The same code as the mainnet Stacker (launch #1294).', EXPLORER.sepolia)}
              ${docContract('ProjectRegistry', 'Live', 'pill-live', ADDRESSES.PROJECT_REGISTRY, 'The current registry (test run 4, launch #1378): rules v2, one handoff per day, owed bonds.', EXPLORER.sepolia)}
              ${docContract('TestIMD', 'Sepolia', 'pill-live', ADDRESSES.TEST_IMD, 'Test IMD with a faucet: 10,000 tIMD per address every 24 hours.', EXPLORER.sepolia)}
              ${docContract('TestSIMD vault', 'Sepolia', 'pill-live', ADDRESSES.TEST_SIMD, 'A copy of StakedIMD whose owner can pause it, to test fallbacks.', EXPLORER.sepolia)}
              ${docContract('Oracle test IMD', 'Sepolia', 'pill-live', ADDRESSES.ORACLE_FEE_TOKEN, 'Pays the registry\'s oracle fee and bonds; anyone can mint it.', EXPLORER.sepolia)}
              ${docContract('Intake v2', 'IdentityMD', 'pill-test', ADDRESSES.INTAKE_V2, 'IdentityMD\'s oracle intake: the same address on Ethereum, Sepolia and Robinhood Chain.', EXPLORER.sepolia)}
            </div>
            <h2 id="mainnet">Ethereum mainnet</h2>
            <div class="contracts-grid">
              ${docContract('IMD', 'Mainnet', 'pill-live', ADDRESSES.MAINNET_IMD, 'Standard 18-decimal ERC-20 (a LayerZero OFT), no transfer fee.', EXPLORER.mainnet)}
              ${docContract('sIMD vault', 'Mainnet', 'pill-live', ADDRESSES.MAINNET_SIMD, 'ERC-4626 staking vault. Owner renounced: nobody can pause it or sweep its funds.', EXPLORER.mainnet)}
              ${docContract('Stacker', 'Pending', 'pill-planned', '', 'Launch ready: the same contract as on Sepolia, against the real IMD and sIMD.', '')}
              ${docContract('ProjectRegistry', 'Planned', 'pill-planned', '', 'A later launch: the Sepolia registry\'s code, with a 20 IMD bond and a 7-day cooldown.', '')}
            </div>
            <h2 id="earlier">Earlier Sepolia deployments</h2>
            ${docTable(['Contract', 'Address', 'Note'], [
              ['ProjectRegistry, test run 3 (#1371)', docAddr(ADDRESSES.REGISTRY_RUN3), 'Rules v2, before owed bonds.'],
              ['ProjectRegistry, test run 2 (#1294)', docAddr(ADDRESSES.REGISTRY_RUN2), 'Rules v1.'],
              ['Stacker, first run (#1129)', docAddr(ADDRESSES.STACKER_V1), 'Also stored per-trader totals on chain.']
            ])}`
        },
        {
          slug: 'stacker-api',
          title: 'Stacker API',
          summary: 'The one function projects call, the event behind every figure, and the views.',
          keywords: 'abi credit stacked event projectStacked totalStacked errors zerotrader assetmismatch zeroshares',
          body: `
            ${docCode('Solidity &middot; Stacker interface', STACKER_ABI, 'doc-stacker-abi')}
            <h2 id="credit">credit(trader, imdAmount)</h2>
            <p>Pulls <code>imdAmount</code> IMD from <code>msg.sender</code> (the project) and calls <code>sIMD.deposit(imdAmount, trader)</code>. Returns the shares minted to the trader.</p>
            ${docTable(['Case', 'Result'], [
              ['<code>trader</code> is zero', 'reverts <code>ZeroTrader</code>'],
              ['<code>imdAmount</code> is zero', 'returns 0: no transfer, no event, no state change'],
              ['first non-zero credit ever', 'checks <code>sIMD.asset() == IMD</code> (<code>AssetMismatch</code> otherwise) and approves the vault once; a failed credit rolls both back'],
              ['the vault mints 0 shares', 'reverts <code>ZeroShares</code>'],
              ['vault paused, allowance or balance short', 'reverts with the vault\'s or token\'s own error and moves nothing']
            ])}
            <h2 id="views">Views</h2>
            <ul>
              <li><code>projectStacked(project)</code>, <code>projectShares(project)</code>: IMD stacked and shares minted through each project.</li>
              <li><code>totalStacked()</code>: IMD stacked through the Stacker in total.</li>
              <li>Per-trader figures come from the <code>Stacked</code> events, so a credit writes no new storage per trader.</li>
            </ul>
            <h2 id="properties">Properties</h2>
            <p>No owner, admin, fee, pause or upgrade. Immutable IMD and sIMD. <code>nonReentrant</code>, OpenZeppelin <code>SafeERC20</code>. Holds 0 IMD and 0 sIMD between calls (tested as an invariant).</p>`
        },
        {
          slug: 'registry-api',
          title: 'Registry API',
          summary: 'Every function, view and event of the ProjectRegistry.',
          keywords: 'abi applyListing challengeForBeneficiary challenge expire setBeneficiary claimBond projectOf isListed bondOwed events',
          body: `
            <h2 id="write">Functions</h2>
            ${docTable(['Function', 'Who', 'What it does'], [
              ['<code>applyListing(project, name, sourceUrl, rateBps, beneficiary)</code>', 'anyone', 'Pays the oracle fee and asks the panel. The project must be a contract; rate 25&ndash;100; name 1&ndash;48 and URL 12&ndash;200 printable ASCII characters, without quotes, backslashes or square brackets. One open question per project.'],
              ['<code>challengeForBeneficiary(project, reason, beneficiary)</code>', 'anyone', 'For a listed project after its cooldown; pays the fee plus the bond. Reverts if the beneficiary changed from the one named. Reason 1&ndash;280 characters.'],
              ['<code>challenge(project, reason)</code>', 'anyone', 'The same, only until the project\'s first beneficiary handoff.'],
              ['<code>expire(project)</code>', 'anyone', 'Clears a question after a day, or once the Intake completed it without a settled answer. Returns a challenger\'s bond.'],
              ['<code>setBeneficiary(project, wallet)</code>', 'the beneficiary', 'Hands the project\'s points to another wallet: at most once per day, never while a question is open.'],
              ['<code>claimBond(to)</code>', 'whoever is owed', 'Sends the bonds the token refused to pay you at settlement to <code>to</code>.']
            ])}
            <h2 id="views">Views</h2>
            ${docTable(['View', 'Returns'], [
              ['<code>ORACLE_FEE()</code>', 'the oracle fee, read live from the Intake'],
              ['<code>projectOf(project)</code>', 'the record: listed, rate, listing blocks, beneficiary, cooldown and any open question'],
              ['<code>isListed(project)</code>', 'whether the project is listed now'],
              ['<code>bondOwed(wallet)</code>', 'bonds waiting for <code>claimBond</code>'],
              ['<code>handoffOpenAt(project)</code>', 'when the next beneficiary handoff is allowed'],
              ['<code>definitions(project, rateBps, beneficiary)</code>', 'the panel\'s rules, as sent with each question'],
              ['<code>challengeBond()</code>, <code>challengeCooldown()</code>', 'the deployment\'s bond and cooldown'],
              ['<code>PANEL_SIZE</code>, <code>QUORUM</code>, <code>PENDING_EXPIRY</code>, <code>HANDOFF_INTERVAL</code>', '15, 11, 1 day, 1 day']
            ])}
            <h2 id="events">Events</h2>
            <p><code>Applied</code>, <code>Listed</code>, <code>Rejected</code>, <code>Challenged</code>, <code>Defended</code>, <code>Delisted</code>, <code>AskCleared</code>, <code>BeneficiarySet</code>, <code>BondOwed</code>, <code>BondClaimed</code>. Points are counted inside the periods between <code>Listed</code> and <code>Delisted</code>.</p>
            <h2 id="callbacks">Oracle callbacks</h2>
            <p><code>onOracleResult</code> (selector <code>0x510379c7</code>) and <code>onOracleFailure</code> (<code>0xa7980e31</code>) accept calls only from the Intake. An answer counts only for the registry's own open request, signed by the oracle signer for this contract after the question was asked, from a full panel that agreed.</p>`
        },
        {
          slug: 'gas',
          title: 'Gas & costs',
          summary: 'Measured costs of crediting, and who pays them.',
          keywords: 'gas cost estimate mainnet sepolia fork 1.3',
          body: `
            <h2 id="credit">Crediting</h2>
            ${docTable(['Call (whole transaction)', 'Ethereum mainnet (fork test)'], [
              ['First credit ever (also checks and approves the vault)', '231,847 gas'],
              ['Credit to a new trader', '135,735 gas'],
              ['Repeat credit', '101,535 gas'],
              ['Deploying the Stacker', '584,421 gas']
            ])}
            <p>Inside a swap, the trader pays about 0.11M extra gas for a new trader and 0.075M for a repeat one, beyond the swap's own cost. Wallets should send estimates &times; 1.3.</p>
            <h2 id="who">Who pays</h2>
            <ul>
              <li><strong>On Ethereum:</strong> the trader, inside their own swap. The project pays no extra gas, and imd/acc has no treasury or relayer.</li>
              <li><strong>On other chains</strong> (planned): the trader's swap pays the small local credit; delivery to Ethereum is paid by a small tip (see <a href="#/docs/multichain">Multichain</a>).</li>
            </ul>`
        },
        {
          slug: 'security',
          title: 'Security & trust',
          summary: 'What the contracts can and can\'t do, how they were audited, and what you trust.',
          keywords: 'security audit trust ownerless immutable oracle signer limits',
          body: `
            <h2 id="design">Design</h2>
            <ul>
              <li><strong>No owner anywhere</strong>: no admin, fee, pause or upgrade in the Stacker or the registry.</li>
              <li><strong>Immutable wiring</strong>: the Stacker's IMD and vault, and the registry's Intake, fee token, Stacker, signer, bond and cooldown are fixed at deployment.</li>
              <li><strong>Holds nothing it shouldn't</strong>: the Stacker holds nothing between calls; the registry holds only open challenge bonds and bonds owed.</li>
              <li><code>nonReentrant</code> on every state-changing entry point, OpenZeppelin <code>SafeERC20</code>, constructors that make no external call.</li>
            </ul>
            <h2 id="audits">Audits</h2>
            <p>Every launch was built and audited by the <a href="https://imd.fun" target="_blank" rel="noopener noreferrer">IMD swarm</a>: an import audit, four specialist audits (math, permissions, economics, control flow), a judge that reproduces and ranks findings, an independent review, and reproducible bytecode. Sepolia launches #1129, #1294, #1371 and #1378; each finding was fixed or documented. The tests (unit, fuzz, invariants, and forks of mainnet and Sepolia) are in the repository.</p>
            <h2 id="trust">What you trust</h2>
            <ul>
              <li><strong>The sIMD vault</strong>, IMD's own ERC-4626 vault, whose owner is renounced.</li>
              <li><strong>For listings:</strong> the oracle panel's answers, the oracle signer's key, and the Intake, which pairs each answer with its question.</li>
              <li><strong>For multichain</strong> (planned): IMD's own LayerZero bridge.</li>
            </ul>
            <h2 id="limits">Known limits</h2>
            <ul>
              <li>One open question per project, first come: a project can take its own slot with a self-challenge, at the cost of the fee each time. Each one still puts the project before the panel.</li>
              <li>The oracle signer and Intake can't be changed; a new registry would replace this one. The Stacker never reads the registry, so that needs no Stacker change.</li>
            </ul>`
        }
      ]
    },
    {
      group: 'More',
      pages: [
        {
          slug: 'multichain',
          title: 'Multichain',
          summary: 'Cashback from projects on other chains, delivered to Ethereum as sIMD.',
          keywords: 'multichain robinhood base arbitrum layerzero remotestacker stackreceiver tip bridge',
          body: `
            <div class="docs-callout docs-callout-warn"><p><strong>Designed, not built yet.</strong> Robinhood Chain comes first (PondPad), then Base and Arbitrum.</p></div>
            <h2 id="how">How it works</h2>
            <p>The sIMD vault exists only on Ethereum. On other chains, cashback waits per trader and is delivered to Ethereum as sIMD through <strong>IMD's own LayerZero bridge</strong>.</p>
            ${docTable(['Contract', 'Where', 'What it does'], [
              ['<code>RemoteStacker</code>', 'each other chain', 'The same <code>credit(trader, imdAmount)</code>, so integrating is identical. Adds the IMD to the trader\'s waiting balance and emits <code>Queued(project, trader, imd)</code>: the points record.'],
              ['<code>StackReceiver</code>', 'Ethereum', 'Receives the IMD with the list of traders and amounts, and deposits into sIMD for each.']
            ])}
            <p>Anyone can <code>flush</code> up to 50 traders' waiting cashback and earn a tip: 2% &times; (hours waiting &divide; 12) of each trader's cashback, at most 2%. The trader always gets at least 98%. Points are counted on the chain where the trade happened, when it happened.</p>
            <h2 id="listing">Listing on other chains</h2>
            <p>One registry per chain, with the same code and the same Apply page. On Robinhood Chain the oracle fee and bonds are paid in Robinhood Chain's IMD (<code>0x5f7b…7127</code>), the same token over IMD's bridge.</p>`
        },
        {
          slug: 'roadmap',
          title: 'Roadmap',
          summary: 'What is done and what comes next.',
          keywords: 'roadmap next mainnet indexer dashboard registry multichain eth route',
          body: `
            <ol>
              <li><strong>Sepolia test runs</strong> (done): the Stacker and the ProjectRegistry, now at test run 4 (launch #1378).</li>
              <li><strong>Live listing trial</strong> on Sepolia: a real application, a listing and a challenge.</li>
              <li><strong>The Stacker on Ethereum mainnet</strong>, with a full IMD swarm audit. PLEA mainnet uses its address.</li>
              <li><strong>Indexer and mainnet dashboard</strong>: each trader's cashback, points and value, and the leaderboards.</li>
              <li><strong>ProjectRegistry on mainnet</strong>: a 20 IMD challenge bond and a 7-day cooldown.</li>
              <li><strong>Multichain</strong>: Robinhood Chain first, then Base and Arbitrum.</li>
              <li><strong>v2, the ETH route</strong>, for projects whose fees are in ETH: pending ETH is swapped to IMD in guarded batches, then staked. Built once such a project wants in.</li>
            </ol>`
        },
        {
          slug: 'faq',
          title: 'FAQ',
          summary: 'Short answers to common questions.',
          keywords: 'faq questions claim token airdrop cut fee unstake',
          body: `
            <h3>Do I need to claim my cashback?</h3>
            <p>No. The sIMD is minted to your wallet inside your trade.</p>
            <h3>Is there an imd/acc token?</h3>
            <p>No. The cashback is IMD, staked. Points may be the basis for something later, but nothing is promised.</p>
            <h3>Does imd/acc take a cut?</h3>
            <p>No. The Stacker takes no fee and has no owner; the project pays the cashback out of fees it already charges.</p>
            <h3>Can I unstake?</h3>
            <p>Yes, any time in the sIMD vault, except in the block where new shares arrive.</p>
            <h3>What if the vault refuses a deposit?</h3>
            <p>The credit reverts and moves nothing, and an integrated project pays you plain IMD instead. Your trade still goes through.</p>
            <h3>Can anyone call credit?</h3>
            <p>Yes, but that's just staking for someone. Only credits from listed projects earn points.</p>
            <h3>Who decides which projects are listed?</h3>
            <p>An IdentityMD oracle panel, through the ownerless ProjectRegistry. Anyone can apply or challenge.</p>`
        },
        {
          slug: 'resources',
          title: 'Resources',
          summary: 'Source code, specs and related projects.',
          keywords: 'github llms.txt design history imd btc/acc links',
          body: `
            <ul>
              <li><a href="https://github.com/khaed1/imd-acc" target="_blank" rel="noopener noreferrer">GitHub repository</a>: contracts, tests, design notes and history.</li>
              <li><a href="https://github.com/khaed1/imd-acc/blob/main/docs/design.md" target="_blank" rel="noopener noreferrer">Design notes</a>: every decision, with the reasons.</li>
              <li><a href="https://github.com/khaed1/imd-acc/blob/main/docs/listing.md" target="_blank" rel="noopener noreferrer">Listing guide</a>: the checklist and the fee guard in full.</li>
              <li><a href="./llms.txt" target="_blank">llms.txt</a>: the spec for agents.</li>
              <li><a href="https://imd.fun" target="_blank" rel="noopener noreferrer">IMD</a> and <a href="https://imd.fun/docs/" target="_blank" rel="noopener noreferrer">IMD docs</a>.</li>
              <li><a href="https://github.com/token-works/archive" target="_blank" rel="noopener noreferrer">btc/acc by TokenWorks</a>, the inspiration.</li>
            </ul>`
        }
      ]
    }
  ];

  const DOC_PAGES = DOCS.flatMap(g => g.pages.map(p => ({ ...p, group: g.group })));

  function docText(html) {
    const d = document.createElement('div');
    d.innerHTML = html;
    return (d.textContent || '').toLowerCase();
  }

  function renderDocs(slug) {
    const index = DOC_PAGES.findIndex(p => p.slug === slug);
    if (index < 0) {
      location.replace('#/docs');
      return;
    }
    const page = DOC_PAGES[index];
    const prev = DOC_PAGES[index - 1];
    const next = DOC_PAGES[index + 1];
    document.title = `${page.title} - imd/acc Docs`;

    appRoot.innerHTML = `
      <div class="page-view">
        <div class="docs-layout">
          <button class="btn btn-secondary docs-mobile-toggle" id="docs-toggle" aria-expanded="false" aria-controls="docs-sidebar">
            <span>Sections &middot; ${safe(page.title)}</span>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 12 15 18 9"></polyline></svg>
          </button>

          <aside class="docs-sidebar" id="docs-sidebar">
            <div class="docs-search">
              <input type="search" id="docs-search" class="form-input" placeholder="Search docs..." aria-label="Search docs">
            </div>
            <nav aria-label="Documentation">
              ${DOCS.map(g => `
                <div class="docs-nav-group">
                  <div class="docs-nav-heading">${g.group}</div>
                  <ul class="docs-nav-list">
                    ${g.pages.map(p => `
                      <li data-doc="${p.slug}"><a href="#/docs/${p.slug}" class="docs-nav-link${p.slug === page.slug ? ' active' : ''}"${p.slug === page.slug ? ' aria-current="page"' : ''}>${p.title}</a></li>
                    `).join('')}
                  </ul>
                </div>
              `).join('')}
              <p class="docs-search-empty" id="docs-search-empty" hidden>No matching sections.</p>
            </nav>
          </aside>

          <article class="docs-article">
            <div class="page-header-block">
              <div class="page-tag">Docs &middot; ${page.group}</div>
              <h1 class="page-title">${page.title}</h1>
              <p class="page-desc">${page.summary}</p>
            </div>
            <div class="docs-body" id="docs-body">${page.body}</div>

            <nav class="docs-pager" aria-label="Previous and next sections">
              ${prev ? `<a href="#/docs/${prev.slug}" class="docs-pager-link prev"><span class="docs-pager-label">&larr; Previous</span><span class="docs-pager-title">${prev.title}</span></a>` : ''}
              ${next ? `<a href="#/docs/${next.slug}" class="docs-pager-link next"><span class="docs-pager-label">Next &rarr;</span><span class="docs-pager-title">${next.title}</span></a>` : ''}
            </nav>
            <div class="docs-meta">
              <span>imd/acc documentation</span>
              <a href="https://github.com/khaed1/imd-acc" target="_blank" rel="noopener noreferrer">Source on GitHub &nearr;</a>
            </div>
          </article>

          <aside class="docs-toc" id="docs-toc" aria-label="On this page"></aside>
        </div>
      </div>
    `;

    // "On this page": the section's headings, scrolled to without touching the hash route.
    const headings = [...document.querySelectorAll('#docs-body h2[id]')];
    const toc = document.getElementById('docs-toc');
    if (toc && headings.length) {
      toc.innerHTML = `
        <div class="docs-toc-title">On this page</div>
        ${headings.map(h => `<button class="docs-toc-link" data-scroll="${h.id}">${safe(h.textContent)}</button>`).join('')}
      `;
      toc.querySelectorAll('[data-scroll]').forEach(btn => {
        btn.addEventListener('click', () => {
          document.getElementById(btn.getAttribute('data-scroll'))?.scrollIntoView({ behavior: 'smooth', block: 'start' });
        });
      });
    }

    // Small screens: the sections list folds behind a toggle.
    const toggle = document.getElementById('docs-toggle');
    const sidebar = document.getElementById('docs-sidebar');
    toggle?.addEventListener('click', () => {
      const open = sidebar.classList.toggle('open');
      toggle.setAttribute('aria-expanded', open ? 'true' : 'false');
    });

    // Search: filters the sections by title, keywords and text; Enter opens the first match.
    const search = document.getElementById('docs-search');
    const empty = document.getElementById('docs-search-empty');
    search?.addEventListener('input', () => {
      const q = search.value.trim().toLowerCase();
      let shown = 0;
      document.querySelectorAll('.docs-nav-group').forEach(groupEl => {
        let groupShown = 0;
        groupEl.querySelectorAll('li[data-doc]').forEach(li => {
          const p = DOC_PAGES.find(x => x.slug === li.getAttribute('data-doc'));
          if (!p._text) p._text = `${p.title} ${p.keywords} ${p.summary} ${docText(p.body)}`.toLowerCase();
          const match = !q || p._text.includes(q);
          li.hidden = !match;
          if (match) groupShown++;
        });
        groupEl.hidden = groupShown === 0;
        shown += groupShown;
      });
      if (empty) empty.hidden = shown > 0;
    });
    search?.addEventListener('keydown', (e) => {
      if (e.key !== 'Enter') return;
      const q = search.value.trim().toLowerCase();
      const visible = [...document.querySelectorAll('.docs-nav-list li:not([hidden]) a')];
      const best = visible.find(a => a.textContent.toLowerCase().includes(q)) || visible[0];
      if (best) location.hash = best.getAttribute('href');
    });
  }

  // --- Page: 404 Not Found ---
  function renderNotFound() {
    document.title = 'Page Not Found - imd/acc';

    appRoot.innerHTML = `
      <div class="page-view" style="text-align: center; padding: 60px 0;">
        <h1 class="page-title">Page Not Found</h1>
        <p class="secondary" style="margin-bottom: 24px;">The route you navigated to does not exist.</p>
        <a href="#/" class="btn btn-primary">&larr; Return to Overview</a>
      </div>
    `;
  }

  // --- Common Listeners ---
  function initCommonListeners() {
    document.querySelectorAll('.copy-btn').forEach(btn => {
      btn.onclick = () => {
        const text = btn.getAttribute('data-clipboard') ||
          (btn.getAttribute('data-clipboard-target') &&
           document.querySelector(btn.getAttribute('data-clipboard-target'))?.innerText);
        if (text) {
          navigator.clipboard.writeText(text.trim()).then(() => showToast('Copied to clipboard!'));
        }
      };
    });
  }

  // --- Global Init ---
  function init() {
    applyTheme(state.theme);

    // Theme Toggle
    document.getElementById('theme-toggle')?.addEventListener('click', () => {
      applyTheme(state.theme === 'dark' ? 'light' : 'dark');
    });

    // Mobile Menu Toggle
    const mobileBtn = document.getElementById('mobile-toggle');
    const navMenu = document.getElementById('nav-menu');
    mobileBtn?.addEventListener('click', (e) => {
      e.stopPropagation();
      const isOpen = navMenu?.classList.toggle('open');
      mobileBtn.setAttribute('aria-expanded', isOpen ? 'true' : 'false');
    });

    document.addEventListener('click', (e) => {
      if (navMenu?.classList.contains('open') && !navMenu.contains(e.target) && !mobileBtn?.contains(e.target)) {
        navMenu.classList.remove('open');
        mobileBtn?.setAttribute('aria-expanded', 'false');
      }
    });

    // Wallet Connect
    const btnWallet = document.getElementById('btn-wallet');
    btnWallet?.addEventListener('click', async () => {
      if (typeof window.ethereum === 'undefined') {
        showToast('No Web3 wallet detected. Exploring in demo mode!');
        return;
      }
      try {
        const accounts = await window.ethereum.request({ method: 'eth_requestAccounts' });
        if (accounts && accounts[0]) {
          state.account = accounts[0];
          document.getElementById('wallet-label').textContent = shortAddr(state.account);
          btnWallet.classList.remove('btn-secondary');
          btnWallet.classList.add('btn-primary');
          showToast(`Connected: ${shortAddr(state.account)}`);
          render();
        }
      } catch (err) {
        showToast('Wallet connection rejected');
      }
    });

    // Hashchange listener
    window.addEventListener('hashchange', render);

    // Initial render
    render();
  }

  document.addEventListener('DOMContentLoaded', init);
})();
