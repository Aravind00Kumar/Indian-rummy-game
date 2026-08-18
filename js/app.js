// Main Application Controller & UI Binder

(function() {
    let currentUser = null;
    let currentRoom = null;
    let selectedCardIndex = -1;
    let selectedCardIds = new Set();
    let draggedCardIndex = null;
    let draggedGroupIdx = null;
    let cardGroups = []; // Array of card arrays e.g. [[c1, c2, c3], [c4, c5, c6]]
    let currentRoundNumber = null; // Track round changes for resetting groups on restart
    let previousTurnPlayerId = null; // Track turn changes for playing turn sound

    // Dynamic DOM Elements (Resolved lazily or in init to support all WebView lifecycle states)
    let screenAuth, screenLobby, screenGame;
    let modalCreate, modalJoin, modalDeclare, modalSettings, modalAbout;
    let userAvatar, userName;
    let displayRoomCode, opponentsRow, drawDeckCard, wildJokerCard, openDiscardCard, handCardsRow;

    function refreshDomElements() {
        screenAuth = document.getElementById('screen-auth');
        screenLobby = document.getElementById('screen-lobby');
        screenGame = document.getElementById('screen-game');

        modalCreate = document.getElementById('modal-create-room');
        modalJoin = document.getElementById('modal-join-room');
        modalDeclare = document.getElementById('modal-declare-result');
        modalSettings = document.getElementById('modal-settings');
        modalAbout = document.getElementById('modal-about');

        userAvatar = document.getElementById('user-avatar');
        userName = document.getElementById('user-name');

        displayRoomCode = document.getElementById('display-room-code');
        opponentsRow = document.getElementById('opponents-row');
        drawDeckCard = document.getElementById('draw-deck-card');
        wildJokerCard = document.getElementById('wild-joker-card');
        openDiscardCard = document.getElementById('open-discard-card');
        handCardsRow = document.getElementById('hand-cards-row');
    }

    // Local Application Version Details (Embedded in APK build)
    const LOCAL_APP_VERSION = {
        versionCode: 1,
        versionName: "1.0.1",
        buildNumber: 1
    };

    function updateUserCoinsDisplay(coins) {
        if (currentUser) {
            if (typeof coins === 'number') currentUser.coins = coins;
            const userCoinsDisplay = document.getElementById('user-coins-display');
            if (userCoinsDisplay) {
                userCoinsDisplay.textContent = typeof currentUser.coins === 'number' ? currentUser.coins : 500;
            }
            const btnClaimBonus = document.getElementById('btn-claim-bonus');
            if (btnClaimBonus) {
                if ((currentUser.coins || 0) < 10) {
                    btnClaimBonus.classList.remove('hidden');
                } else {
                    btnClaimBonus.classList.add('hidden');
                }
            }
        }
    }

    // Initialize App
    function init() {
        refreshDomElements();
        setScreenOrientation('portrait');
        setupEventListeners();
        setupAndroidInstallBanners();

        // Load packaged version info and check server for APK updates
        fetch('version.json')
            .then(r => r.json())
            .then(v => {
                if (v && v.versionCode) {
                    LOCAL_APP_VERSION.versionCode = v.versionCode;
                    LOCAL_APP_VERSION.versionName = v.versionName || '1.0.1';
                    LOCAL_APP_VERSION.buildNumber = v.buildNumber || 1;
                }
                checkForAppUpdates();
            })
            .catch(() => {
                checkForAppUpdates();
            });

        // Re-check updates when returning to app
        document.addEventListener('visibilitychange', () => {
            if (document.visibilityState === 'visible') {
                checkForAppUpdates();
            }
        });

        AUTH_SERVICE.onAuthChange(user => {
            currentUser = user;
            refreshDomElements();
            if (currentUser) {
                currentUser.coins = typeof currentUser.coins === 'number' ? currentUser.coins : 500;
                showScreen(screenLobby);
                if (userAvatar) {
                    userAvatar.src = currentUser.photoUrl || `https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(currentUser.name)}`;
                }
                if (userName) {
                    userName.textContent = currentUser.name;
                }
                updateUserCoinsDisplay(currentUser.coins);
                renderAvailableRooms();
            } else {
                showScreen(screenAuth);
            }
        });

        MULTIPLAYER_SERVICE.onRoomUpdate(roomState => {
            if (!roomState || !currentUser) return;
            
            // Sync currentUser.coins from roomState.players if present
            if (roomState.players && roomState.players.length > 0) {
                const myP = roomState.players.find(p => String(p.id) === String(currentUser.id));
                if (myP && typeof myP.coins === 'number') {
                    currentUser.coins = myP.coins;
                    AUTH_SERVICE.updateCachedCoins(myP.coins);
                    updateUserCoinsDisplay(myP.coins);
                }
            }

            // Detect game start or game restart across all room participants
            const isNewRound = roomState.roundNumber && roomState.roundNumber !== currentRoundNumber;
            const isRestartAfterDeclaration = currentRoom && currentRoom.lastDeclaration && !roomState.lastDeclaration;
            
            if (isNewRound || isRestartAfterDeclaration) {
                currentRoundNumber = roomState.roundNumber || null;
                cardGroups = [];
                selectedCardIds.clear();
                if (modalDeclare) modalDeclare.classList.add('hidden');
            }

            // Play Win/Lose Music to all players in the room upon declaration
            if (roomState.lastDeclaration) {
                handleDeclarationAudio(roomState.lastDeclaration);
            }

            currentRoom = roomState;

            // Only render game table and show declare modal if user is actively in the game screen
            if (screenGame && !screenGame.classList.contains('hidden')) {
                renderGameTable();
            } else if (modalDeclare) {
                modalDeclare.classList.add('hidden');
            }
        });

        MULTIPLAYER_SERVICE.onGameDeclared(declaration => {
            if (declaration) {
                handleDeclarationAudio(declaration);
            }
        });
    }

    function setupAndroidInstallBanners() {
        const isCapacitorNative = (typeof window.Capacitor !== 'undefined' && typeof window.Capacitor.isNativePlatform === 'function' && window.Capacitor.isNativePlatform());

        const authBanner = document.getElementById('auth-apk-install-banner');
        const lobbyBanner = document.getElementById('lobby-apk-install-banner');

        // Always show install APK button/banner whenever accessing from any web browser
        if (!isCapacitorNative) {
            if (authBanner) {
                authBanner.classList.remove('hidden');
                authBanner.style.display = 'flex';
            }
            if (lobbyBanner) {
                lobbyBanner.classList.remove('hidden');
                lobbyBanner.style.display = 'flex';
            }
        }

        const downloadHandler = () => {
            const serverUrl = localStorage.getItem('rummy_server_url') || (window.APP_CONFIG && window.APP_CONFIG.SERVER_URL) || window.location.origin || 'http://192.168.29.56:3000';
            window.location.href = `${serverUrl.replace(/\/$/, '')}/api/download_apk`;
        };

        const btnAuthInstall = document.getElementById('btn-auth-install-apk');
        if (btnAuthInstall) btnAuthInstall.addEventListener('click', downloadHandler);

        const btnLobbyInstall = document.getElementById('btn-lobby-install-apk');
        if (btnLobbyInstall) btnLobbyInstall.addEventListener('click', downloadHandler);

        const btnAboutInstall = document.getElementById('btn-about-install-apk');
        if (btnAboutInstall) btnAboutInstall.addEventListener('click', downloadHandler);
    }

    async function checkForAppUpdates() {
        // ONLY check and display update modal when running inside the native Android APK container
        const isCapacitorNative = (typeof window.Capacitor !== 'undefined' && typeof window.Capacitor.isNativePlatform === 'function' && window.Capacitor.isNativePlatform());
        if (!isCapacitorNative) {
            return; // NEVER show in web browsers (mobile Chrome, desktop Chrome, Safari, etc.)
        }

        try {
            const serverUrl = localStorage.getItem('rummy_server_url') || (window.APP_CONFIG && window.APP_CONFIG.SERVER_URL) || '';
            const res = await fetch(`${serverUrl}/api/version_check`);
            if (!res.ok) return;
            const serverVer = await res.json();

            if (serverVer && serverVer.versionCode && serverVer.versionCode > LOCAL_APP_VERSION.versionCode) {
                showUpdateModal(serverVer);
            }
        } catch (e) {
            console.warn('Update check failed:', e);
        }
    }

    function showUpdateModal(serverVer) {
        const modal = document.getElementById('modal-app-update');
        const versionLabel = document.getElementById('update-version-label');
        const notesText = document.getElementById('update-notes-text');
        const btnUpdateNow = document.getElementById('btn-update-now');
        const btnUpdateLater = document.getElementById('btn-update-later');

        if (!modal) return;

        if (versionLabel) {
            versionLabel.textContent = `New Version: v${serverVer.versionName} (Build #${serverVer.buildNumber}) | Current: v${LOCAL_APP_VERSION.versionName}`;
        }
        if (notesText && serverVer.releaseNotes) {
            notesText.textContent = serverVer.releaseNotes;
        }

        if (btnUpdateNow) {
            btnUpdateNow.onclick = () => {
                const serverUrl = localStorage.getItem('rummy_server_url') || (window.APP_CONFIG && window.APP_CONFIG.SERVER_URL) || 'http://192.168.29.56:3000';
                const downloadUrl = `${serverUrl}${serverVer.apkUrl || '/api/download_apk'}`;
                
                showToast("⬇️ Downloading update APK... Installer will launch automatically.", "success");
                
                // 1. Direct native download and install via JavascriptInterface
                if (window.AndroidApp && typeof window.AndroidApp.downloadAndInstallApk === 'function') {
                    try {
                        window.AndroidApp.downloadAndInstallApk(downloadUrl);
                    } catch(e) {
                        console.error('Native downloadAndInstallApk failed:', e);
                    }
                } else {
                    // 2. Direct window navigation for WebView DownloadListener
                    try {
                        window.location.href = downloadUrl;
                    } catch(e) {}
                    
                    // 3. Open external browser system intent fallback
                    try {
                        window.open(downloadUrl, '_system');
                    } catch(e) {}
                }

                modal.classList.add('hidden');
            };
        }

        if (btnUpdateLater) {
            btnUpdateLater.onclick = () => {
                modal.classList.add('hidden');
            };
        }

        modal.classList.remove('hidden');
    }

    async function renderAvailableRooms() {
        const roomsContainer = document.getElementById('rooms-list-container');
        if (!roomsContainer) return;

        roomsContainer.innerHTML = '<span style="font-size: 0.75rem; color: #a0aec0; text-align: center; display: block; padding: 10px 0;">Loading rooms...</span>';

        const rooms = await MULTIPLAYER_SERVICE.listRooms();
        
        // Sort rooms: Tournament 9999 first, then WAITING status, then PLAYING status
        const sortedRooms = (rooms || []).sort((a, b) => {
            if (a.code === '9999') return -1;
            if (b.code === '9999') return 1;
            if (a.status === 'WAITING' && b.status === 'PLAYING') return -1;
            if (a.status === 'PLAYING' && b.status === 'WAITING') return 1;
            return 0;
        });

        roomsContainer.innerHTML = '';
        if (sortedRooms.length === 0) {
            roomsContainer.innerHTML = '<span style="font-size: 0.75rem; color: #718096; text-align: center; display: block; padding: 10px 0;">No active rooms. Create one!</span>';
            return;
        }

        sortedRooms.forEach(room => {
            const row = document.createElement('div');
            row.style.cssText = 'display: flex; flex-direction: column; padding: 12px; background: rgba(255, 255, 255, 0.05); border-radius: 8px; border: 1px solid rgba(255,255,255,0.1); cursor: pointer; transition: background 0.2s; gap: 8px;';
            
            row.addEventListener('mouseover', () => row.style.background = 'rgba(255,255,255,0.1)');
            row.addEventListener('mouseout', () => row.style.background = 'rgba(255, 255, 255, 0.05)');

            const isTour = room.code === '9999';
            
            // Header area
            const header = document.createElement('div');
            header.style.cssText = 'display: flex; justify-content: space-between; align-items: center; width: 100%;';
            header.innerHTML = `
                <div style="display: flex; flex-direction: column; gap: 2px;">
                    <span style="font-size: 0.85rem; font-weight: bold; color: ${isTour ? '#ecc94b' : '#fff'};">${isTour ? '🏆 Tournament' : `Room #${room.code}`}</span>
                    <span style="font-size: 0.7rem; color: #a0aec0;">Decks: ${room.numDecks} | Timer: ${room.turnTimerSec}s</span>
                    <span style="font-size: 0.72rem; color: #ecc94b; font-weight: bold;">🪙 Stake: ${room.entryCoins || 10} Coins</span>
                </div>
                <div style="display: flex; flex-direction: column; align-items: flex-end; gap: 4px;">
                    <span style="font-size: 0.75rem; color: #48bb78; font-weight: bold;">${room.playersCount} Players</span>
                    <span style="font-size: 0.6rem; padding: 2px 6px; border-radius: 4px; font-weight: bold; background: ${room.status === 'WAITING' ? '#2f855a' : '#c53030'}; color: #fff;">${room.status}</span>
                </div>
            `;
            row.appendChild(header);

            // Add action click handler to the header/row (for opening stats modal)
            row.addEventListener('click', (e) => {
                // Ignore clicks on buttons inside the card
                if (e.target.tagName === 'BUTTON') return;
                
                // Show tournament statistics
                showTournamentStatsModal();
            });

            if (isTour) {
                const registeredList = room.registeredPlayers || [];
                const isRegistered = registeredList.map(String).includes(currentUser.id.toString());
                const registeredCount = registeredList.length;
                const joinedCount = room.playersCount || 0;

                // Update subheader with registered & joined counts
                const subheader = header.querySelector('div:first-child');
                if (subheader) {
                    subheader.innerHTML = `
                        <span style="font-size: 0.85rem; font-weight: bold; color: #ecc94b;">🏆 Tournament #9999</span>
                        <span style="font-size: 0.7rem; color: #a0aec0;">Decks: ${room.numDecks || 2} | Timer: ${room.turnTimerSec || 60}s</span>
                        <span style="font-size: 0.7rem; color: #68d391; font-weight: 600;">📝 ${registeredCount} Registered | 👥 ${joinedCount}/${registeredCount || 0} Joined</span>
                    `;
                }

                const actions = document.createElement('div');
                actions.style.cssText = 'display: flex; gap: 8px; width: 100%; margin-top: 6px;';
                
                // Button 1: Register / Unregister Button
                const btnRegister = document.createElement('button');
                btnRegister.className = 'btn';
                if (isRegistered) {
                    btnRegister.style.cssText = 'flex: 1; padding: 7px 8px; font-size: 0.72rem; background: rgba(229, 62, 62, 0.15); color: #fc8181; border: 1px solid #e53e3e; border-radius: 6px; font-weight: bold; cursor: pointer; transition: transform 0.1s;';
                    btnRegister.innerHTML = `❌ Unregister (${registeredCount})`;
                    btnRegister.title = 'Click to cancel your registration for this tournament.';
                    btnRegister.addEventListener('click', async (evt) => {
                        evt.stopPropagation();
                        btnRegister.disabled = true;
                        btnRegister.textContent = 'Unregistering...';
                        const state = await MULTIPLAYER_SERVICE.unregisterTournamentPlayer(currentUser.id);
                        if (state) {
                            showToast('Unregistered from Tournament.', 'info');
                            renderAvailableRooms();
                        } else {
                            btnRegister.disabled = false;
                            btnRegister.innerHTML = `❌ Unregister (${registeredCount})`;
                            showToast('Failed to unregister.', 'error');
                        }
                    });
                } else {
                    btnRegister.style.cssText = 'flex: 1; padding: 7px 8px; font-size: 0.72rem; background: linear-gradient(135deg, #d69e2e, #ecc94b); color: #1a202c; border: none; border-radius: 6px; font-weight: 800; cursor: pointer; box-shadow: 0 2px 6px rgba(236,201,75,0.3); transition: transform 0.1s;';
                    btnRegister.innerHTML = `📝 Register (${registeredCount})`;
                    btnRegister.addEventListener('click', async (evt) => {
                        evt.stopPropagation();
                        btnRegister.disabled = true;
                        btnRegister.textContent = 'Registering...';
                        const state = await MULTIPLAYER_SERVICE.registerTournamentPlayer(currentUser.id);
                        if (state) {
                            showToast('Successfully registered for Tournament!', 'success');
                            renderAvailableRooms();
                        } else {
                            btnRegister.disabled = false;
                            btnRegister.innerHTML = `📝 Register (${registeredCount})`;
                            showToast('Failed to register.', 'error');
                        }
                    });
                }

                // Button 2: Join Button
                const btnJoin = document.createElement('button');
                btnJoin.className = 'btn';
                if (isRegistered) {
                    btnJoin.style.cssText = 'flex: 1; padding: 7px 10px; font-size: 0.75rem; background: #3182ce; color: #fff; border: none; border-radius: 6px; font-weight: bold; cursor: pointer; box-shadow: 0 2px 6px rgba(49, 130, 206, 0.4); transition: transform 0.1s;';
                    btnJoin.innerHTML = '🚪 Join Tournament';
                    btnJoin.addEventListener('click', async (evt) => {
                        evt.stopPropagation();
                        btnJoin.disabled = true;
                        btnJoin.textContent = 'Joining...';
                        const result = await MULTIPLAYER_SERVICE.joinRoom(room.code, currentUser);
                        if (result && result.success) {
                            currentRoom = result.roomState;
                            showScreen(screenGame);
                            renderGameTable();
                        } else {
                            btnJoin.disabled = false;
                            btnJoin.innerHTML = '🚪 Join Tournament';
                            showToast(result ? result.message : 'Unable to join tournament.', 'error');
                        }
                    });
                } else {
                    btnJoin.style.cssText = 'flex: 1; padding: 7px 10px; font-size: 0.75rem; background: rgba(255, 255, 255, 0.08); color: #718096; border: 1px solid rgba(255, 255, 255, 0.1); border-radius: 6px; font-weight: 600; cursor: not-allowed;';
                    btnJoin.innerHTML = '🚪 Join (Register First)';
                    btnJoin.disabled = true;
                    btnJoin.title = 'Please click Register first to participate in the Tournament!';
                }

                actions.appendChild(btnRegister);
                actions.appendChild(btnJoin);
                row.appendChild(actions);
            } else {
                const actions = document.createElement('div');
                actions.style.cssText = 'display: flex; gap: 8px; width: 100%; margin-top: 4px;';

                const btnJoin = document.createElement('button');
                btnJoin.className = 'btn';
                btnJoin.style.cssText = 'flex: 1; padding: 7px 12px; font-size: 0.75rem; background: #3182ce; color: #fff; border: none; border-radius: 6px; font-weight: bold; cursor: pointer;';
                btnJoin.textContent = '🚪 Join Room';
                btnJoin.addEventListener('click', async (evt) => {
                    evt.stopPropagation();
                    const result = await MULTIPLAYER_SERVICE.joinRoom(room.code, currentUser);
                    if (result.success) {
                        currentRoom = result.roomState;
                        showScreen(screenGame);
                        renderGameTable();
                    }
                });
                actions.appendChild(btnJoin);

                const isHost = currentUser && (String(room.hostId) === String(currentUser.id));
                if (isHost) {
                    const btnDelete = document.createElement('button');
                    btnDelete.className = 'btn';
                    btnDelete.style.cssText = 'padding: 7px 12px; font-size: 0.75rem; background: #9b2c2c; color: #fff; border: 1px solid #e53e3e; border-radius: 6px; font-weight: bold; cursor: pointer;';
                    btnDelete.textContent = '🗑️ Delete';
                    btnDelete.title = 'Delete this room';
                    btnDelete.addEventListener('click', async (evt) => {
                        evt.stopPropagation();
                        if (confirm(`Delete Room #${room.code}? All connected players will return to the lobby.`)) {
                            const success = await MULTIPLAYER_SERVICE.deleteRoom(room.code, currentUser.id);
                            if (success) {
                                showToast(`Room #${room.code} deleted.`, 'info');
                                renderAvailableRooms();
                            }
                        }
                    });
                    actions.appendChild(btnDelete);
                }

                row.appendChild(actions);
            }

            roomsContainer.appendChild(row);
        });
    }

    async function showTournamentStatsModal() {
        const modalStats = document.getElementById('modal-tournament-stats');
        const statsTableBody = document.getElementById('stats-table-body');
        if (!modalStats || !statsTableBody) return;

        statsTableBody.innerHTML = '<tr><td colspan="3" style="text-align: center; padding: 15px; color: #a0aec0;">Loading player stats...</td></tr>';
        modalStats.classList.remove('hidden');

        const stats = await MULTIPLAYER_SERVICE.listPlayerStats();
        statsTableBody.innerHTML = '';

        if (!stats || stats.length === 0) {
            statsTableBody.innerHTML = '<tr><td colspan="4" style="text-align: center; padding: 15px; color: #718096;">No player stats recorded yet.</td></tr>';
            return;
        }

        // Sort by wins descending
        const sortedStats = stats.sort((a, b) => (b.wins || 0) - (a.wins || 0));

        sortedStats.forEach(p => {
            const tr = document.createElement('tr');
            tr.style.cssText = 'border-bottom: 1px solid rgba(255,255,255,0.05);';
            tr.innerHTML = `
                <td style="padding: 8px; display: flex; align-items: center; gap: 8px;">
                    <img src="${p.photoUrl}" style="width: 28px; height: 28px; border-radius: 50%; background: rgba(255,255,255,0.1);" alt="avatar">
                    <span style="font-weight: bold;">${p.username}</span>
                </td>
                <td style="padding: 8px; text-align: center; font-weight: bold; color: #ecc94b;">🪙 ${typeof p.coins === 'number' ? p.coins : 500}</td>
                <td style="padding: 8px; text-align: center; font-weight: bold; color: #48bb78;">${p.wins}</td>
                <td style="padding: 8px; text-align: center; font-weight: bold; color: #e53e3e;">${p.losses}</td>
            `;
            statsTableBody.appendChild(tr);
        });
    }

    // Screen Orientation & Wake Lock Controller
    let wakeLock = null;

    // Toast Notification System (Non-blocking & Android friendly)
    function showToast(message, type = 'info') {
        let toast = document.getElementById('app-toast-msg');
        if (!toast) {
            toast = document.createElement('div');
            toast.id = 'app-toast-msg';
            toast.className = 'fixed top-3 left-1/2 -translate-x-1/2 z-[300] px-4 py-2 rounded-xl text-xs sm:text-sm font-bold shadow-2xl transition-all duration-300 pointer-events-none text-center max-w-[90vw]';
            document.body.appendChild(toast);
        }
        toast.textContent = message;
        toast.style.background = type === 'error' ? 'rgba(229, 62, 62, 0.96)' : (type === 'success' ? 'rgba(56, 161, 105, 0.96)' : 'rgba(214, 158, 46, 0.96)');
        toast.style.color = '#fff';
        toast.style.opacity = '1';
        toast.style.transform = 'translate(-50%, 0)';
        clearTimeout(toast._timer);
        toast._timer = setTimeout(() => {
            toast.style.opacity = '0';
            toast.style.transform = 'translate(-50%, -20px)';
        }, 2500);
    }

    async function requestWakeLock() {
        try {
            if ('wakeLock' in navigator) {
                wakeLock = await navigator.wakeLock.request('screen');
                wakeLock.addEventListener('release', () => {
                    wakeLock = null;
                });
                console.log('⚡ [Wake Lock] Active - Screen will not sleep during game');
            }
        } catch (err) {
            console.warn('Wake Lock error:', err);
        }
    }

    function releaseWakeLock() {
        if (wakeLock) {
            wakeLock.release().catch(() => {});
            wakeLock = null;
            console.log('⚡ [Wake Lock] Released');
        }
    }

    // Re-acquire wake lock if app resumes while game is active
    document.addEventListener('visibilitychange', async () => {
        if (document.visibilityState === 'visible') {
            if (screenGame && !screenGame.classList.contains('hidden')) {
                await requestWakeLock();
            }
        }
    });

    async function setScreenOrientation(mode) {
        // mode: 'portrait' | 'landscape'
        try {
            // 1. Capacitor ScreenOrientation Plugin
            if (window.Capacitor && window.Capacitor.Plugins && window.Capacitor.Plugins.ScreenOrientation) {
                if (mode === 'landscape') {
                    await window.Capacitor.Plugins.ScreenOrientation.lock({ orientation: 'landscape' }).catch(() => {});
                } else {
                    await window.Capacitor.Plugins.ScreenOrientation.lock({ orientation: 'portrait' }).catch(() => {});
                }
                return;
            }

            // 2. Standard Web Screen Orientation API
            if (screen.orientation && typeof screen.orientation.lock === 'function') {
                if (mode === 'landscape') {
                    await screen.orientation.lock('landscape').catch(() => {});
                } else {
                    await screen.orientation.lock('portrait').catch(() => {});
                }
            }
        } catch (e) {
            console.warn('Screen orientation change:', e);
        }
    }

    async function showScreen(screen) {
        if (!screen) return;
        [screenAuth, screenLobby, screenGame].forEach(s => {
            if (s) s.classList.add('hidden');
        });
        screen.classList.remove('hidden');

        // Always hide in-game declare result modal if not on game table
        if (screen !== screenGame && modalDeclare) {
            modalDeclare.classList.add('hidden');
        }

        if (screen === screenGame) {
            // Game screen: Landscape orientation + Keep Screen Awake
            await setScreenOrientation('landscape');
            await requestWakeLock();
        } else {
            // Auth / Lobby screens: Portrait orientation + Release Wake Lock
            await setScreenOrientation('portrait');
            releaseWakeLock();
        }
    }


    // Synthesized Web Audio API Turn Chime
    let audioCtx = null;
    function getAudioContext() {
        if (!audioCtx) {
            const AudioContextClass = window.AudioContext || window.webkitAudioContext;
            if (AudioContextClass) {
                audioCtx = new AudioContextClass();
            }
        }
        if (audioCtx && audioCtx.state === 'suspended') {
            audioCtx.resume().catch(() => {});
        }
        return audioCtx;
    }

    function playTurnSound() {
        try {
            const ctx = getAudioContext();
            if (!ctx) return;

            const now = ctx.currentTime;
            
            // Dual chime chords: D5 (587.33Hz) -> A5 (880Hz) -> D6 (1174.66Hz)
            const notes = [
                { freq: 587.33, start: now, duration: 0.22 },
                { freq: 880.00, start: now + 0.08, duration: 0.30 },
                { freq: 1174.66, start: now + 0.16, duration: 0.48 }
            ];

            notes.forEach(note => {
                const osc = ctx.createOscillator();
                const gain = ctx.createGain();

                osc.type = 'triangle'; // pleasant soft melodic chime
                osc.frequency.setValueAtTime(note.freq, note.start);

                gain.gain.setValueAtTime(0, note.start);
                gain.gain.linearRampToValueAtTime(0.22, note.start + 0.02);
                gain.gain.exponentialRampToValueAtTime(0.0001, note.start + note.duration);

                osc.connect(gain);
                gain.connect(ctx.destination);

                osc.start(note.start);
                osc.stop(note.start + note.duration);
            });

            // Optional subtle haptic vibration on supported devices
            if (navigator.vibrate) {
                navigator.vibrate([80, 40, 80]);
            }
        } catch (e) {
            console.warn('Audio playback error:', e);
        }
    }

    // Synthesized Web Audio API Victory & Celebration Music (Played to all players on Valid Declaration)
    function playWinSound() {
        try {
            const ctx = getAudioContext();
            if (!ctx) return;

            const now = ctx.currentTime;
            
            // Joyful, multi-note Celebration Fanfare & Victory Anthem:
            // Intro fanfare arpeggio: G4 -> C5 -> E5 -> G5 -> C6 -> E6 -> G6 -> C7
            // Followed by sparkling celebratory harmonics and sustained major celebration chord
            const fanfareNotes = [
                // Fast rising celebratory fanfare
                { freq: 392.00, start: now + 0.00, duration: 0.12, gain: 0.22, type: 'triangle' }, // G4
                { freq: 523.25, start: now + 0.10, duration: 0.12, gain: 0.24, type: 'triangle' }, // C5
                { freq: 659.25, start: now + 0.20, duration: 0.12, gain: 0.24, type: 'triangle' }, // E5
                { freq: 783.99, start: now + 0.30, duration: 0.14, gain: 0.26, type: 'triangle' }, // G5
                { freq: 1046.50, start: now + 0.42, duration: 0.18, gain: 0.28, type: 'triangle' },// C6
                { freq: 1318.51, start: now + 0.58, duration: 0.22, gain: 0.30, type: 'triangle' },// E6
                { freq: 1567.98, start: now + 0.78, duration: 0.35, gain: 0.32, type: 'triangle' },// G6
                
                // Grand Celebration Multi-Harmonic Chord (C6 + E6 + G6 + C7)
                { freq: 1046.50, start: now + 1.10, duration: 1.20, gain: 0.25, type: 'triangle' },// C6
                { freq: 1318.51, start: now + 1.10, duration: 1.20, gain: 0.22, type: 'sine' },    // E6
                { freq: 1567.98, start: now + 1.10, duration: 1.20, gain: 0.22, type: 'triangle' },// G6
                { freq: 2093.00, start: now + 1.10, duration: 1.20, gain: 0.20, type: 'sine' },    // C7

                // Sparkling celebration confetti chimes
                { freq: 2093.00, start: now + 1.25, duration: 0.25, gain: 0.18, type: 'sine' },
                { freq: 2637.02, start: now + 1.45, duration: 0.30, gain: 0.18, type: 'sine' },
                { freq: 3135.96, start: now + 1.65, duration: 0.45, gain: 0.16, type: 'sine' }
            ];

            fanfareNotes.forEach(note => {
                const osc = ctx.createOscillator();
                const gain = ctx.createGain();

                osc.type = note.type || 'triangle';
                osc.frequency.setValueAtTime(note.freq, note.start);

                gain.gain.setValueAtTime(0, note.start);
                gain.gain.linearRampToValueAtTime(note.gain, note.start + 0.02);
                gain.gain.exponentialRampToValueAtTime(0.0001, note.start + note.duration);

                osc.connect(gain);
                gain.connect(ctx.destination);

                osc.start(note.start);
                osc.stop(note.start + note.duration);
            });

            // Celebratory celebratory rhythm vibration pattern
            if (navigator.vibrate) {
                navigator.vibrate([100, 60, 100, 60, 150, 80, 300]);
            }
        } catch (e) {
            console.warn('Celebration win audio playback error:', e);
        }
    }

    // Synthesized Web Audio API Defeat / Womp-Womp Music (Played to all players on Invalid Declaration)
    function playLoseSound() {
        try {
            const ctx = getAudioContext();
            if (!ctx) return;

            const now = ctx.currentTime;
            
            // Classic comic descending blunder: Eb4 -> D4 -> Db4 -> C3 (slid down)
            const notes = [
                { startFreq: 311.13, endFreq: 298.00, start: now, duration: 0.30, gain: 0.28 },         // Eb4
                { startFreq: 293.66, endFreq: 280.00, start: now + 0.28, duration: 0.30, gain: 0.28 },  // D4
                { startFreq: 277.18, endFreq: 260.00, start: now + 0.56, duration: 0.32, gain: 0.30 },  // Db4
                { startFreq: 138.59, endFreq: 105.00, start: now + 0.86, duration: 0.90, gain: 0.35 }   // Low slide drop
            ];

            notes.forEach(note => {
                const osc = ctx.createOscillator();
                const gain = ctx.createGain();

                osc.type = 'sawtooth'; // brassy comic defeat timbre
                osc.frequency.setValueAtTime(note.startFreq, note.start);
                osc.frequency.exponentialRampToValueAtTime(note.endFreq, note.start + note.duration);

                gain.gain.setValueAtTime(0, note.start);
                gain.gain.linearRampToValueAtTime(note.gain, note.start + 0.03);
                gain.gain.exponentialRampToValueAtTime(0.0001, note.start + note.duration);

                osc.connect(gain);
                gain.connect(ctx.destination);

                osc.start(note.start);
                osc.stop(note.start + note.duration);
            });

            if (navigator.vibrate) {
                navigator.vibrate([200, 100, 300]);
            }
        } catch (e) {
            console.warn('Lose audio playback error:', e);
        }
    }

    let lastPlayedDeclarationTimestamp = null;

    function handleDeclarationAudio(decl) {
        if (!decl || !decl.timestamp) return;
        if (lastPlayedDeclarationTimestamp === decl.timestamp) return;
        lastPlayedDeclarationTimestamp = decl.timestamp;

        if (decl.valid) {
            playWinSound();
        } else {
            playLoseSound();
        }
    }

    function handleReturnToLobby() {
        if (modalDeclare) modalDeclare.classList.add('hidden');
        if (currentRoom && currentUser) {
            MULTIPLAYER_SERVICE.leaveRoom(currentRoom.code, currentUser.id);
        }
        currentRoom = null;
        selectedCardIds.clear();
        cardGroups = [];
        showScreen(screenLobby);
        renderAvailableRooms();
        if (AUTH_SERVICE.refreshProfile) {
            AUTH_SERVICE.refreshProfile().catch(() => {});
        }
    }

    function renderGameTable() {
        if (!currentRoom || !currentUser) return;

        displayRoomCode.textContent = currentRoom.code;

        // Check if game is in WAITING state and update overlay
        const waitingBanner = document.getElementById('waiting-game-banner');
        const waitingRoomCode = document.getElementById('waiting-room-code');
        const btnWaitingDelete = document.getElementById('btn-waiting-delete-room');
        const btnStartGameNow = document.getElementById('btn-start-game-now');
        if (waitingBanner) {
            if (currentRoom.status === 'WAITING') {
                if (waitingRoomCode) waitingRoomCode.textContent = currentRoom.code;
                waitingBanner.classList.remove('hidden');
                waitingBanner.style.display = 'flex';

                const waitingTitle = waitingBanner.querySelector('h3');
                const waitingDesc = waitingBanner.querySelector('p');
                const isTour = currentRoom.code === '9999' || !!currentRoom.isTournament;

                if (isTour) {
                    const regCount = (currentRoom.registeredPlayers || []).length;
                    const joinedCount = (currentRoom.players || []).length;
                    if (waitingTitle) waitingTitle.innerHTML = '🏆 Tournament Waiting Arena';
                    if (waitingDesc) {
                        waitingDesc.innerHTML = `
                            Room Code: <strong class="text-gold-400 font-bold tracking-wider text-sm">9999</strong><br>
                            <span class="text-xs text-amber-300 font-semibold">Registered: ${regCount} Players | Joined: ${joinedCount}/${regCount}</span><br>
                            <span class="text-[11px] text-emerald-400 font-bold mt-1 block">⚡ Tournament automatically starts once all registered players join!</span>
                        `;
                    }
                    if (btnStartGameNow) {
                        btnStartGameNow.classList.add('hidden');
                        btnStartGameNow.style.display = 'none';
                    }
                } else {
                    if (waitingTitle) waitingTitle.innerHTML = 'Waiting for Opponent...';
                    if (waitingDesc) {
                        waitingDesc.innerHTML = `
                            Room Code: <strong class="text-gold-400 font-bold tracking-wider text-sm">${currentRoom.code}</strong><br>
                            <span class="text-[11px] text-slate-400">Game will start automatically when an opponent joins, or click Start Game now.</span>
                        `;
                    }
                    if (btnStartGameNow) {
                        btnStartGameNow.classList.remove('hidden');
                        btnStartGameNow.style.display = 'inline-flex';
                    }
                }
                
                if (btnWaitingDelete) {
                    const isHost = currentRoom && currentUser && String(currentRoom.hostId) === String(currentUser.id) && !isTour;
                    if (isHost) {
                        btnWaitingDelete.classList.remove('hidden');
                        btnWaitingDelete.style.display = 'inline-flex';
                    } else {
                        btnWaitingDelete.classList.add('hidden');
                        btnWaitingDelete.style.display = 'none';
                    }
                }
            } else {
                waitingBanner.classList.add('hidden');
                waitingBanner.style.display = 'none';
            }
        }

        // Update Pot Badge Value
        const potEl = document.getElementById('pot-coins-val');
        if (potEl) {
            const potVal = currentRoom.pot || (currentRoom.players.length * (currentRoom.entryCoins || 10));
            potEl.textContent = potVal;
        }

        // Render All Game Players (Local Player & Opponents) in the Top Status Row
        opponentsRow.innerHTML = '';
        currentRoom.players.forEach(player => {
            const isActive = String(currentRoom.currentTurnPlayerId) === String(player.id);
            const isLocal = String(player.id) === String(currentUser.id);
            const playerCoins = typeof player.coins === 'number' ? player.coins : 500;
            
            const box = document.createElement('div');
            box.className = `player-box ${isActive ? 'active-turn' : ''}`;
            box.innerHTML = `
                <div class="relative flex flex-col items-center">
                    <img class="avatar-img w-6 h-6 sm:w-8 sm:h-8 rounded-full border border-gold-500 object-cover shadow" src="${player.photoUrl}" alt="${player.name}">
                    <div class="avatar-badge-online absolute bottom-0 right-0 w-2 h-2 bg-green-500 border border-black rounded-full"></div>
                </div>
                <span class="player-name text-[10px] sm:text-xs text-slate-200 font-bold truncate max-w-[76px] sm:max-w-[90px] text-center mt-0.5">${player.name} ${isLocal ? '(You)' : ''}</span>
                <div class="player-coins-badge text-[9px] sm:text-[10px] text-amber-300 font-extrabold flex items-center gap-0.5 justify-center mt-0.5">
                    <span>🪙</span><span>${playerCoins}</span>
                </div>
                <div class="opponent-cards-badge text-[8px] sm:text-[9px] bg-blue-950/90 border border-blue-400/80 text-blue-100 px-1.5 py-0.5 rounded-full mt-0.5 whitespace-nowrap">
                    ${isLocal ? '👁️ Hand' : `🎴 ${player.cardsCount} Cards`}
                </div>
            `;
            opponentsRow.appendChild(box);
        });

        // Render Closed Deck
        drawDeckCard.innerHTML = SVG_CARDS.getCardSvg(null, { faceDown: true, width: 70, height: 98 });

        // Render Wild Joker
        if (currentRoom.wildJoker) {
            wildJokerCard.innerHTML = SVG_CARDS.getCardSvg(currentRoom.wildJoker, { isWild: true, width: 70, height: 98 });
        }

        // Render Open Discard Pile
        if (currentRoom.discardPile && currentRoom.discardPile.length > 0) {
            const topDiscard = currentRoom.discardPile[currentRoom.discardPile.length - 1];
            openDiscardCard.innerHTML = SVG_CARDS.getCardSvg(topDiscard, { width: 70, height: 98 });
        } else {
            openDiscardCard.innerHTML = `<div class="w-[51px] h-[71px] sm:w-[58px] sm:h-[81px] border-2 border-dashed border-slate-400/50 rounded-lg"></div>`;
        }

        // Play Sound and Render Local Player Hand Container Turn State Glow
        const isLocalTurn = String(currentRoom.currentTurnPlayerId) === String(currentUser.id);
        if (isLocalTurn && String(previousTurnPlayerId) !== String(currentUser.id)) {
            playTurnSound();
        }
        previousTurnPlayerId = currentRoom.currentTurnPlayerId;

        const localPlayer = currentRoom.players.find(p => String(p.id) === String(currentUser.id));
        const canDraw = isLocalTurn && localPlayer && localPlayer.handCards && localPlayer.handCards.length < 14;

        // Visual Turn Highlighting on Decks
        const drawDeckContainer = document.getElementById('slot-closed-deck');
        const discardDeckContainer = document.getElementById('slot-open-discard');
        if (drawDeckContainer) {
            drawDeckContainer.style.filter = canDraw ? 'drop-shadow(0 0 10px rgba(246, 173, 85, 0.95))' : 'none';
        }
        if (discardDeckContainer) {
            discardDeckContainer.style.filter = (canDraw && currentRoom.discardPile && currentRoom.discardPile.length > 0) ? 'drop-shadow(0 0 10px rgba(72, 187, 120, 0.95))' : 'none';
        }

        const playerHandContainer = document.querySelector('.player-hand-container');
        if (playerHandContainer) {
            if (isLocalTurn) {
                playerHandContainer.classList.add('active-turn');
                let banner = document.getElementById('local-turn-banner');
                if (!banner) {
                    banner = document.createElement('div');
                    banner.id = 'local-turn-banner';
                    banner.className = 'turn-indicator-badge absolute top-[-10px] bg-gold-400 text-black font-extrabold text-[10px] sm:text-xs px-2.5 py-0.5 rounded-full shadow-lg tracking-wider uppercase z-30';
                    playerHandContainer.appendChild(banner);
                }
                banner.textContent = canDraw ? '⚡ YOUR TURN: TAP DRAW DECK OR DISCARD PILE ⚡' : '👉 DRAG A CARD TO DISCARD OR DECLARE';
            } else {
                playerHandContainer.classList.remove('active-turn');
                const banner = document.getElementById('local-turn-banner');
                if (banner) banner.remove();
            }
        }

        // Render Local Player Hand
        renderLocalHand();

        // Check if there is an active declaration / round completion to show to all players
        if (currentRoom.lastDeclaration) {
            const decl = currentRoom.lastDeclaration;
            const isLocalWinner = decl.winnerId === currentUser.id;
            const isLocalDeclarer = decl.declarerId === currentUser.id;

            const resultTitle = document.getElementById('result-title');
            const resultMsg = document.getElementById('result-message');
            const scoreboardList = document.getElementById('scoreboard-list');
            const btnRestart = document.getElementById('btn-restart-game');

            if (resultTitle) {
                if (isLocalWinner) {
                    if (decl.isAllTriplets) {
                        resultTitle.innerHTML = `🌟 ${decl.isTournament ? '🏆 Tournament Double Coins Win!' : '🎉 All Triplets Double Coins Win!'}`;
                    } else {
                        resultTitle.innerHTML = `🎉 ${decl.isTournament ? '🏆 Tournament Won!' : 'You Won the Game!'}`;
                    }
                } else {
                    if (decl.isAllTriplets) {
                        resultTitle.innerHTML = `🌟 ${decl.winnerName} Won (All Triplets Double Coins)!`;
                    } else {
                        resultTitle.innerHTML = `🏆 ${decl.winnerName} Won the Game!`;
                    }
                }
            }

            if (resultMsg) {
                const declarerText = isLocalDeclarer ? 'You' : decl.declarerName;
                const winnerText = isLocalWinner ? 'You' : decl.winnerName;
                const validityText = decl.valid 
                    ? (decl.isAllTriplets 
                        ? '<span class="text-amber-300 font-extrabold px-1.5 py-0.5 rounded bg-amber-950/70 border border-gold-400">🌟 All Triplets (Double Coins)</span>' 
                        : '<span class="text-green-400 font-bold">Valid Declaration</span>')
                    : '<span class="text-red-400 font-bold">Invalid Declaration</span>';
                
                resultMsg.innerHTML = `
                    <div class="bg-black/40 p-3 rounded-xl border-l-4 ${decl.isAllTriplets ? 'border-amber-400 bg-amber-950/20' : 'border-gold-400'} text-left mb-3">
                        <div class="text-xs sm:text-sm text-slate-200">📢 <strong>${declarerText}</strong> declared the game (${validityText}).</div>
                        <div class="mt-1 text-sm sm:text-base text-gold-400 font-extrabold flex items-center justify-between">
                            <span>👑 Winner: ${winnerText}</span>
                            <span class="text-xs text-amber-300 font-extrabold bg-amber-950/80 border border-gold-500/50 px-2 py-0.5 rounded-full">
                                🪙 Pot Won: +${decl.pot || (decl.entryCoins * 2)} Coins
                            </span>
                        </div>
                        <div class="text-xs text-slate-400 mt-1">${decl.reason || ''}</div>
                    </div>
                `;
            }

            // Render All Players' Hand Cards & Details
            const declaredCardsContainer = document.getElementById('declared-cards-container');
            const declaredCardsSection = document.getElementById('declared-cards-section');

            if (declaredCardsContainer && declaredCardsSection) {
                declaredCardsContainer.innerHTML = '';
                declaredCardsSection.style.display = 'block';

                // Source players from declaration allPlayers or currentRoom.players
                const playersToRender = decl.allPlayers || currentRoom.players || [];

                playersToRender.forEach(p => {
                    const isWin = p.id === decl.winnerId;
                    const isDecl = p.id === decl.declarerId;
                    const isMe = currentUser && String(p.id) === String(currentUser.id);
                    const pCoinsChg = typeof p.coinsChange === 'number' ? p.coinsChange : 0;

                    const playerBlock = document.createElement('div');
                    playerBlock.className = `p-2.5 rounded-xl border ${isWin ? 'bg-amber-950/50 border-gold-400/80 shadow-lg' : 'bg-black/50 border-white/10'} text-left`;

                    // Player Info Header
                    const header = document.createElement('div');
                    header.className = 'flex items-center justify-between mb-1.5 pb-1 border-b border-white/10';
                    header.innerHTML = `
                        <div class="flex items-center gap-2">
                            <img class="w-6 h-6 rounded-full border ${isWin ? 'border-gold-400' : 'border-slate-500'} object-cover shadow" src="${p.photoUrl || `https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(p.name)}`}" alt="${p.name}">
                            <span class="text-xs font-bold ${isWin ? 'text-gold-300' : 'text-white'} truncate max-w-[130px] sm:max-w-[180px]">
                                ${p.name} ${isMe ? '(You)' : ''}
                            </span>
                            ${isWin ? (decl.isAllTriplets ? '<span class="text-[10px] bg-gradient-to-r from-amber-400 to-yellow-500 text-black font-extrabold px-1.5 py-0.5 rounded-full">🌟 Double Winner</span>' : '<span class="text-[10px] bg-gold-500 text-black font-extrabold px-1.5 py-0.5 rounded-full">👑 Winner</span>') : ''}
                            ${isDecl && !isWin ? '<span class="text-[10px] bg-blue-600 text-white font-bold px-1.5 py-0.5 rounded-full">📢 Declarer</span>' : ''}
                        </div>
                        <div class="flex items-center gap-2">
                            <span class="text-xs font-extrabold ${pCoinsChg >= 0 ? 'text-amber-300' : 'text-red-400'}">
                                ${pCoinsChg >= 0 ? `+${pCoinsChg}` : pCoinsChg} 🪙
                            </span>
                            <span class="text-[10px] text-slate-300 font-semibold">
                                (🪙 ${typeof p.coins === 'number' ? p.coins : 500})
                            </span>
                        </div>
                    `;
                    playerBlock.appendChild(header);

                    // Player Hand Groups / Cards
                    const cardsRow = document.createElement('div');
                    cardsRow.className = 'flex flex-wrap gap-2 items-center overflow-x-auto py-1';

                    // Source groups directly from declaration payload for 100% fidelity across all players
                    let groupsToDisplay = (p.groups && p.groups.length > 0) ? p.groups : [];
                    if (groupsToDisplay.length === 0 && isMe && cardGroups && cardGroups.length > 0) {
                        groupsToDisplay = cardGroups.filter(g => g.length > 0);
                    } else if (groupsToDisplay.length === 0 && p.handCards && p.handCards.length > 0) {
                        groupsToDisplay = [ p.handCards ];
                    }

                    // For the declarer, strictly filter out the 14th discard card from all group combinations
                    if (isDecl && decl.discardCard) {
                        groupsToDisplay = groupsToDisplay.map(group => 
                            group.filter(c => c.id !== decl.discardCard.id)
                        ).filter(group => group.length > 0);
                    }

                    if (groupsToDisplay.length > 0) {
                        groupsToDisplay.forEach(group => {
                            const valInfo = getGroupValidationInfo(group);
                            const groupEl = document.createElement('div');
                            groupEl.className = 'flex flex-col items-center bg-black/40 border border-white/10 rounded-lg p-1 relative min-w-[52px]';

                            // Group status badge: Pure Seq, 2nd Seq, Triplet, Invalid
                            const badge = document.createElement('span');
                            badge.className = `text-[8px] sm:text-[9px] font-extrabold px-1.5 py-0.5 rounded mb-1 text-center whitespace-nowrap ${valInfo.className}`;
                            badge.textContent = valInfo.label;
                            groupEl.appendChild(badge);

                            const cardsInner = document.createElement('div');
                            cardsInner.className = 'flex items-end';

                            group.forEach((card, cIdx) => {
                                const cardWrap = document.createElement('div');
                                cardWrap.style.cssText = `margin-right: ${cIdx === group.length - 1 ? '0' : '-22px'}; position: relative; z-index: ${cIdx + 1};`;
                                const isWild = currentRoom.wildJoker && card.rank === currentRoom.wildJoker.rank;
                                cardWrap.innerHTML = SVG_CARDS.getCardSvg(card, { isWild, width: 38, height: 53 });
                                cardsInner.appendChild(cardWrap);
                            });
                            groupEl.appendChild(cardsInner);
                            cardsRow.appendChild(groupEl);
                        });
                    } else {
                        cardsRow.innerHTML = '<span class="text-[10px] text-slate-500 italic">No cards to display</span>';
                    }

                    // Render separate dedicated 14th Discard Slot for the Declarer
                    if (isDecl && decl.discardCard) {
                        const discardEl = document.createElement('div');
                        discardEl.className = 'flex flex-col items-center bg-red-950/40 border border-red-500/50 rounded-lg p-1 relative min-w-[52px]';
                        const discardBadge = document.createElement('span');
                        discardBadge.className = 'text-[8px] sm:text-[9px] font-extrabold px-1.5 py-0.5 rounded mb-1 text-center whitespace-nowrap bg-red-900/80 text-red-200';
                        discardBadge.textContent = '🎯 DISCARD (14th)';
                        discardEl.appendChild(discardBadge);

                        const cardInner = document.createElement('div');
                        const isWild = currentRoom.wildJoker && decl.discardCard.rank === currentRoom.wildJoker.rank;
                        cardInner.innerHTML = SVG_CARDS.getCardSvg(decl.discardCard, { isWild, width: 38, height: 53 });
                        discardEl.appendChild(cardInner);
                        cardsRow.appendChild(discardEl);
                    }

                    playerBlock.appendChild(cardsRow);
                    declaredCardsContainer.appendChild(playerBlock);
                });
            }

            if (scoreboardList) {
                scoreboardList.innerHTML = '';
                const scores = decl.scores || [];
                scores.forEach(s => {
                    const isWin = s.isWinner || s.id === decl.winnerId;
                    const coinsChg = typeof s.coinsChange === 'number' ? s.coinsChange : 0;
                    const row = document.createElement('div');
                    row.className = 'flex justify-between items-center px-3 py-1.5 rounded-lg bg-white/5 text-white text-xs sm:text-sm';
                    row.innerHTML = `
                        <div class="flex items-center gap-2">
                            <span class="font-medium ${isWin ? 'text-gold-400 font-bold' : 'text-slate-300'}">
                                ${s.name} ${isWin ? '👑 (Winner)' : ''}
                            </span>
                            <span class="text-xs ${coinsChg >= 0 ? 'text-amber-300 font-extrabold' : 'text-red-400 font-extrabold'}">
                                (${coinsChg >= 0 ? `+${coinsChg}` : coinsChg} 🪙)
                            </span>
                        </div>
                        <div class="flex items-center gap-1.5">
                            <span class="text-xs text-amber-300 font-extrabold">
                                🪙 ${typeof s.coins === 'number' ? s.coins : 500}
                            </span>
                        </div>
                    `;
                    scoreboardList.appendChild(row);
                });
            }

            // Sync updated local player coin balance
            if (decl.scores && currentUser) {
                const myScore = decl.scores.find(s => String(s.id) === String(currentUser.id));
                if (myScore && typeof myScore.coins === 'number') {
                    currentUser.coins = myScore.coins;
                    AUTH_SERVICE.updateCachedCoins(currentUser.coins);
                    updateUserCoinsDisplay(currentUser.coins);
                }
            }

            if (btnRestart) {
                btnRestart.textContent = '🔄 Confirm & Restart Game';
            }

            // Only show modal if player is currently in game screen
            if (screenGame && !screenGame.classList.contains('hidden')) {
                modalDeclare.classList.remove('hidden');
            } else {
                modalDeclare.classList.add('hidden');
            }
        } else {
            modalDeclare.classList.add('hidden');
        }
    }

    function requestAppFullscreen() {
        const docEl = document.documentElement;
        const isFullscreen = document.fullscreenElement || document.webkitFullscreenElement || document.mozFullScreenElement || document.msFullscreenElement;
        if (!isFullscreen) {
            const requestMethod = docEl.requestFullscreen || docEl.webkitRequestFullscreen || docEl.mozRequestFullScreen || docEl.msRequestFullscreen;
            if (requestMethod) {
                requestMethod.call(docEl).catch(() => {});
            }
        }
    }

    function toggleAppFullscreen() {
        const isFullscreen = document.fullscreenElement || document.webkitFullscreenElement || document.mozFullScreenElement || document.msFullscreenElement;
        if (!isFullscreen) {
            requestAppFullscreen();
        } else {
            const exitMethod = document.exitFullscreen || document.webkitExitFullscreen || document.mozCancelFullScreen || document.msExitFullscreen;
            if (exitMethod) {
                exitMethod.call(document).catch(() => {});
            }
        }
    }

    function setupEventListeners() {
        // About App Modal Triggers
        const modalAbout = document.getElementById('modal-about');
        const aboutVersionEl = document.getElementById('about-build-version');
        const openAboutModal = () => {
            if (aboutVersionEl) {
                aboutVersionEl.textContent = `v${LOCAL_APP_VERSION.versionName} (Build #${LOCAL_APP_VERSION.buildNumber})`;
            }
            if (modalAbout) {
                modalAbout.classList.remove('hidden');
                modalAbout.style.display = 'flex';
            }
        };
        const closeAboutModal = () => {
            if (modalAbout) {
                modalAbout.classList.add('hidden');
                modalAbout.style.display = 'none';
            }
        };

        const aboutBtns = ['btn-auth-about', 'btn-lobby-about'];
        aboutBtns.forEach(id => {
            const btn = document.getElementById(id);
            if (btn) btn.addEventListener('click', (e) => {
                e.stopPropagation();
                openAboutModal();
            });
        });

        const btnCloseAbout = document.getElementById('btn-close-about');
        if (btnCloseAbout) btnCloseAbout.addEventListener('click', closeAboutModal);

        const btnAboutOk = document.getElementById('btn-about-ok');
        if (btnAboutOk) btnAboutOk.addEventListener('click', closeAboutModal);

        // Return to Lobby Button Triggers
        const btnReturnLobby = document.getElementById('btn-return-lobby');
        if (btnReturnLobby) {
            btnReturnLobby.addEventListener('click', () => {
                if (confirm("Return to Lobby?")) {
                    handleReturnToLobby();
                }
            });
        }

        const btnWaitingReturn = document.getElementById('btn-waiting-return-lobby');
        if (btnWaitingReturn) {
            btnWaitingReturn.addEventListener('click', handleReturnToLobby);
        }

        // Start Game Now Button (inside Waiting overlay)
        const btnStartGameNow = document.getElementById('btn-start-game-now');
        if (btnStartGameNow) {
            btnStartGameNow.addEventListener('click', async () => {
                if (currentRoom) {
                    await MULTIPLAYER_SERVICE.startNewGame(currentRoom.code);
                }
            });
        }

        // Trigger fullscreen and unlock audio context on first user touch/tap anywhere
        const triggerInteractionOnce = () => {
            requestAppFullscreen();
            getAudioContext();
        };
        document.addEventListener('touchstart', triggerInteractionOnce, { passive: true });
        document.addEventListener('click', triggerInteractionOnce, { passive: true });

        // When rotating device to landscape, trigger fullscreen
        window.addEventListener('orientationchange', () => {
            if (window.orientation === 90 || window.orientation === -90) {
                requestAppFullscreen();
            }
        });

        // Auth Tab Switching
        const tabLogin = document.getElementById('tab-login');
        const tabRegister = document.getElementById('tab-register');
        const formLogin = document.getElementById('form-login');
        const formRegister = document.getElementById('form-register');

        if (tabLogin && tabRegister && formLogin && formRegister) {
            tabLogin.addEventListener('click', () => {
                tabLogin.classList.add('active');
                tabLogin.style.borderBottom = '3px solid #f6ad55';
                tabLogin.style.color = '#fff';
                tabRegister.classList.remove('active');
                tabRegister.style.borderBottom = '3px solid transparent';
                tabRegister.style.color = '#a0aec0';
                formLogin.classList.remove('hidden');
                formLogin.style.display = 'flex';
                formRegister.classList.add('hidden');
                formRegister.style.display = 'none';
            });

            tabRegister.addEventListener('click', () => {
                tabRegister.classList.add('active');
                tabRegister.style.color = '#fff';
                tabRegister.style.borderBottomColor = '#f6ad55';
                tabLogin.classList.remove('active');
                tabLogin.style.color = '#a0aec0';
                tabLogin.style.borderBottomColor = 'transparent';
                formRegister.classList.remove('hidden');
                formRegister.style.display = 'flex';
                formLogin.classList.add('hidden');
                formLogin.style.display = 'none';
            });
        }

        // Submit buttons
        const btnLoginSubmit = document.getElementById('btn-login-submit');
        if (btnLoginSubmit) {
            btnLoginSubmit.addEventListener('click', async () => {
                const usernameInput = document.getElementById('login-username');
                const passwordInput = document.getElementById('login-password');
                const username = usernameInput ? usernameInput.value.trim() : '';
                const password = passwordInput ? passwordInput.value : '';

                if (!username || !password) {
                    alert('Please enter username and password.');
                    return;
                }

                const res = await AUTH_SERVICE.login(username, password);
                if (!res.success) {
                    alert(res.message);
                } else {
                    if (usernameInput) usernameInput.value = '';
                    if (passwordInput) passwordInput.value = '';
                }
            });
        }

        const btnRegisterSubmit = document.getElementById('btn-register-submit');
        if (btnRegisterSubmit) {
            btnRegisterSubmit.addEventListener('click', async () => {
                const usernameInput = document.getElementById('register-username');
                const passwordInput = document.getElementById('register-password');
                const genderSelect = document.getElementById('register-gender');
                const username = usernameInput ? usernameInput.value.trim() : '';
                const password = passwordInput ? passwordInput.value : '';
                const gender = genderSelect ? genderSelect.value : 'Male';

                if (!username || !password || !gender) {
                    alert('All fields are required.');
                    return;
                }

                const res = await AUTH_SERVICE.register(username, password, gender);
                if (!res.success) {
                    alert(res.message);
                } else {
                    if (usernameInput) usernameInput.value = '';
                    if (passwordInput) passwordInput.value = '';
                }
            });
        }

        const btnRefreshRooms = document.getElementById('btn-refresh-rooms');
        if (btnRefreshRooms) {
            btnRefreshRooms.addEventListener('click', () => {
                renderAvailableRooms();
            });
        }

        // Settings Modal event bindings
        const settingsServerUrlInput = document.getElementById('settings-server-url');
        const settingsUsernameInput = document.getElementById('settings-username');
        const settingsPasswordInput = document.getElementById('settings-password');
        const settingsGenderSelect = document.getElementById('settings-gender');
        const settingsUserSection = document.getElementById('settings-user-section');

        const AVATAR_PRESETS = [
            'https://api.dicebear.com/10.x/toon-head/svg?backgroundColor=16161c&seed=17',
            'https://api.dicebear.com/10.x/adventurer/svg?backgroundColor=16161c&seed=10',
            'https://api.dicebear.com/10.x/toon-head/svg?backgroundColor=16161c&seed=56',
            'https://api.dicebear.com/7.x/avataaars/svg?seed=Aravind&backgroundColor=16161c',
            'https://api.dicebear.com/7.x/avataaars/svg?seed=Spoo&backgroundColor=16161c',
            'https://api.dicebear.com/7.x/avataaars/svg?seed=Deepu&backgroundColor=16161c',
            'https://api.dicebear.com/10.x/adventurer/svg?backgroundColor=16161c&seed=42',
            'https://api.dicebear.com/10.x/adventurer/svg?backgroundColor=16161c&seed=99',
            'https://api.dicebear.com/10.x/toon-head/svg?backgroundColor=16161c&seed=88',
            'https://api.dicebear.com/7.x/bottts/svg?seed=RummyPro&backgroundColor=16161c',
            'https://api.dicebear.com/7.x/bottts/svg?seed=AcePlayer&backgroundColor=16161c',
            'https://api.dicebear.com/10.x/lorelei/svg?seed=Lucky&backgroundColor=16161c'
        ];

        let selectedAvatarUrl = null;

        function openSettingsModal() {
            refreshDomElements();
            if (settingsServerUrlInput) {
                settingsServerUrlInput.value = localStorage.getItem('rummy_server_url') || (window.APP_CONFIG && window.APP_CONFIG.SERVER_URL) || '';
            }
            if (currentUser && settingsUserSection) {
                settingsUserSection.style.display = 'block';
                if (settingsUsernameInput) settingsUsernameInput.value = currentUser.name;
                if (settingsPasswordInput) settingsPasswordInput.value = '';
                if (settingsGenderSelect) settingsGenderSelect.value = currentUser.gender || 'Male';
                selectedAvatarUrl = currentUser.photoUrl || AVATAR_PRESETS[0];

                const avatarPreview = document.getElementById('settings-avatar-preview');
                if (avatarPreview) avatarPreview.src = selectedAvatarUrl;

                const grid = document.getElementById('avatar-presets-grid');
                if (grid) {
                    grid.innerHTML = '';
                    AVATAR_PRESETS.forEach(url => {
                        const img = document.createElement('img');
                        img.src = url;
                        img.alt = 'Avatar';
                        const isSelected = selectedAvatarUrl === url;
                        img.className = `w-10 h-10 rounded-full border-2 cursor-pointer transition-transform hover:scale-110 object-cover bg-[#091a12] p-0.5 ${isSelected ? 'border-gold-400 ring-2 ring-gold-400/80 scale-105' : 'border-white/20 opacity-80 hover:opacity-100'}`;
                        img.addEventListener('click', () => {
                            selectedAvatarUrl = url;
                            if (avatarPreview) avatarPreview.src = url;
                            grid.querySelectorAll('img').forEach(el => {
                                el.className = `w-10 h-10 rounded-full border-2 cursor-pointer transition-transform hover:scale-110 object-cover bg-[#091a12] p-0.5 ${el.src === url ? 'border-gold-400 ring-2 ring-gold-400/80 scale-105' : 'border-white/20 opacity-80 hover:opacity-100'}`;
                            });
                        });
                        grid.appendChild(img);
                    });
                }
            } else if (settingsUserSection) {
                settingsUserSection.style.display = 'none';
            }
            if (modalSettings) modalSettings.classList.remove('hidden');
        }

        const btnRandomAvatar = document.getElementById('btn-random-avatar');
        if (btnRandomAvatar) {
            btnRandomAvatar.addEventListener('click', () => {
                const seed = Math.floor(1000 + Math.random() * 9000);
                const styles = ['adventurer', 'toon-head', 'avataaars', 'bottts'];
                const style = styles[Math.floor(Math.random() * styles.length)];
                selectedAvatarUrl = `https://api.dicebear.com/10.x/${style}/svg?backgroundColor=16161c&seed=${seed}`;
                const avatarPreview = document.getElementById('settings-avatar-preview');
                if (avatarPreview) avatarPreview.src = selectedAvatarUrl;
            });
        }



        // Pre-login settings icon click handler
        const btnAuthSettings = document.getElementById('btn-auth-settings');
        if (btnAuthSettings) {
            btnAuthSettings.addEventListener('click', openSettingsModal);
        }

        const btnAvatarProfile = document.getElementById('btn-avatar-profile');
        if (btnAvatarProfile) {
            btnAvatarProfile.addEventListener('click', openSettingsModal);
        }

        const btnSettings = document.getElementById('btn-settings');
        if (btnSettings) {
            btnSettings.addEventListener('click', openSettingsModal);
        }

        const btnCancelSettings = document.getElementById('btn-cancel-settings');
        if (btnCancelSettings) {
            btnCancelSettings.addEventListener('click', () => {
                if (modalSettings) modalSettings.classList.add('hidden');
            });
        }

        const btnCloseStats = document.getElementById('btn-close-stats');
        if (btnCloseStats) {
            btnCloseStats.addEventListener('click', () => {
                const modalStats = document.getElementById('modal-tournament-stats');
                if (modalStats) modalStats.classList.add('hidden');
            });
        }

        const btnSettingsSubmit = document.getElementById('btn-settings-submit');
        if (btnSettingsSubmit) {
            btnSettingsSubmit.addEventListener('click', async () => {
                const serverUrl = settingsServerUrlInput ? settingsServerUrlInput.value.trim() : '';

                // Save server URL first
                if (serverUrl) {
                    localStorage.setItem('rummy_server_url', serverUrl);
                }

                // If not logged in yet, we only update server URL and close
                if (!currentUser) {
                    if (modalSettings) modalSettings.classList.add('hidden');
                    return;
                }

                const username = settingsUsernameInput ? settingsUsernameInput.value.trim() : '';
                const password = settingsPasswordInput ? settingsPasswordInput.value : '';
                const gender = settingsGenderSelect ? settingsGenderSelect.value : 'Male';

                if (!username || !password) {
                    alert('Username and password are required to update profile.');
                    return;
                }

                const res = await AUTH_SERVICE.updateSettings(username, password, gender, selectedAvatarUrl);
                if (!res.success) {
                    showToast(res.message, 'error');
                } else {
                    if (modalSettings) modalSettings.classList.add('hidden');
                    if (currentUser && selectedAvatarUrl) {
                        currentUser.photoUrl = selectedAvatarUrl;
                        if (userAvatar) userAvatar.src = selectedAvatarUrl;
                    }
                    showToast('✅ Profile & avatar updated successfully!', 'success');
                    renderAvailableRooms();
                }
            });
        }

        const btnLogout = document.getElementById('btn-logout');
        if (btnLogout) {
            btnLogout.addEventListener('click', () => {
                AUTH_SERVICE.logout();
            });
        }

        const btnShowCreate = document.getElementById('btn-show-create');
        if (btnShowCreate) {
            btnShowCreate.addEventListener('click', () => {
                if (modalCreate) modalCreate.classList.remove('hidden');
            });
        }

        const btnCancelCreate = document.getElementById('btn-cancel-create');
        if (btnCancelCreate) {
            btnCancelCreate.addEventListener('click', () => {
                if (modalCreate) modalCreate.classList.add('hidden');
            });
        }

        const btnShowJoin = document.getElementById('btn-show-join');
        if (btnShowJoin) {
            btnShowJoin.addEventListener('click', () => {
                if (modalJoin) modalJoin.classList.remove('hidden');
            });
        }

        const btnCancelJoin = document.getElementById('btn-cancel-join');
        if (btnCancelJoin) {
            btnCancelJoin.addEventListener('click', () => {
                if (modalJoin) modalJoin.classList.add('hidden');
            });
        }

        const btnClaimBonus = document.getElementById('btn-claim-bonus');
        if (btnClaimBonus) {
            btnClaimBonus.addEventListener('click', async (e) => {
                e.stopPropagation();
                if (!currentUser) return;
                try {
                    const serverUrl = MULTIPLAYER_SERVICE.getServerUrl ? MULTIPLAYER_SERVICE.getServerUrl() : 'http://192.168.29.56:3000';
                    const res = await fetch(`${serverUrl}/api/claim_bonus`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ userId: currentUser.id })
                    });
                    const data = await res.json();
                    if (data && data.success) {
                        currentUser.coins = data.coins;
                        updateUserCoinsDisplay(data.coins);
                        showToast('🎁 Claimed +100 Free Bonus Coins!', 'success');
                    }
                } catch (err) {
                    currentUser.coins = (currentUser.coins || 0) + 100;
                    updateUserCoinsDisplay(currentUser.coins);
                    showToast('🎁 Claimed +100 Free Bonus Coins!', 'success');
                }
            });
        }

        const btnCreateSubmit = document.getElementById('btn-create-submit');
        if (btnCreateSubmit) {
            btnCreateSubmit.addEventListener('click', async () => {
                const selectDecks = document.getElementById('select-decks');
                const selectTimer = document.getElementById('select-timer');
                const coinsEl = document.getElementById('select-coins');
                const decks = selectDecks ? selectDecks.value : '2';
                const timer = selectTimer ? selectTimer.value : '30';
                const entryCoins = coinsEl ? (parseInt(coinsEl.value, 10) || 10) : 10;

                if ((currentUser.coins || 0) < entryCoins) {
                    showToast(`Insufficient coins! You need at least ${entryCoins} coins to create this room.`, 'error');
                    return;
                }

                const roomState = await MULTIPLAYER_SERVICE.createRoom(currentUser, {
                    numDecks: decks,
                    turnTimerSec: timer,
                    entryCoins: entryCoins
                });

                if (roomState) {
                    currentRoom = roomState;
                    if (modalCreate) modalCreate.classList.add('hidden');
                    showScreen(screenGame);
                    renderGameTable();
                }
            });
        }

        const btnJoinSubmit = document.getElementById('btn-join-submit');
        if (btnJoinSubmit) {
            btnJoinSubmit.addEventListener('click', async () => {
                const inputJoin = document.getElementById('input-join-code');
                const code = inputJoin ? inputJoin.value.trim() : '';
                if (code.length !== 4) {
                    alert('Please enter a 4-digit code.');
                    return;
                }

                const result = await MULTIPLAYER_SERVICE.joinRoom(code, currentUser);
                if (result.success) {
                    currentRoom = result.roomState;
                    if (modalJoin) modalJoin.classList.add('hidden');
                    showScreen(screenGame);
                    renderGameTable();
                }
            });
        }

        const btnInvite = document.getElementById('btn-invite');
        if (btnInvite) {
            btnInvite.addEventListener('click', () => {
                if (currentRoom) {
                    navigator.clipboard.writeText(currentRoom.code);
                    alert(`Room 4-Digit Code copied to clipboard: ${currentRoom.code}\nShare this code with your friends to join!`);
                }
            });
        }

        // Group & Reorder buttons
        const btnGroup = document.getElementById('btn-group');
        if (btnGroup) {
            btnGroup.addEventListener('click', () => {
                handleCreateGroup();
            });
        }

        const btnSort = document.getElementById('btn-sort');
        if (btnSort) {
            btnSort.addEventListener('click', () => {
                autoSortHand();
            });
        }

        const btnRestartGame = document.getElementById('btn-restart-game');
        if (btnRestartGame) {
            btnRestartGame.addEventListener('click', () => {
                if (currentRoom) {
                    modalDeclare.classList.add('hidden');
                    cardGroups = [];
                    selectedCardIds.clear();
                    if (currentRoom.status !== 'PLAYING') {
                        MULTIPLAYER_SERVICE.startNewGame(currentRoom.code);
                    }
                }
            });
        }

        const btnLeaveRoom = document.getElementById('btn-leave-room');
        if (btnLeaveRoom) {
            btnLeaveRoom.addEventListener('click', () => {
                handleReturnToLobby();
            });
        }

        // Draw card triggers for both desktop click and mobile touch
        const closedDeckSlot = document.getElementById('slot-closed-deck');
        const discardSlot = document.getElementById('slot-open-discard');

        if (closedDeckSlot) {
            closedDeckSlot.style.cursor = 'pointer';
            closedDeckSlot.onclick = (e) => {
                if (e) e.stopPropagation();
                handleDrawFromDeck(false);
            };
        }

        if (discardSlot) {
            discardSlot.style.cursor = 'pointer';
            discardSlot.onclick = (e) => {
                if (e) e.stopPropagation();
                handleDrawFromDeck(true);
            };

            // HTML5 drag and drop discard behavior on Discard Slot
            discardSlot.addEventListener('dragover', (e) => {
                if (!currentRoom || currentRoom.currentTurnPlayerId !== currentUser.id) {
                    return;
                }
                e.preventDefault();
                discardSlot.style.borderColor = '#e53e3e';
                discardSlot.style.boxShadow = '0 0 14px rgba(229, 62, 62, 0.7)';
            });

            discardSlot.addEventListener('dragleave', () => {
                discardSlot.style.borderColor = 'transparent';
                discardSlot.style.boxShadow = 'none';
            });

            discardSlot.addEventListener('drop', (e) => {
                e.preventDefault();
                discardSlot.style.borderColor = 'transparent';
                discardSlot.style.boxShadow = 'none';

                if (!currentRoom || currentRoom.currentTurnPlayerId !== currentUser.id) {
                    return;
                }

                if (draggedCardIndex !== null) {
                    handleDiscardByIndex(draggedCardIndex);
                }
            });
        }

        // HTML5 drag and drop declare behavior on Declare slot
        const declareSlot = document.getElementById('slot-declare');
        const declareArea = document.getElementById('declare-drop-area');

        if (declareSlot && declareArea) {
            declareSlot.addEventListener('dragover', (e) => {
                if (!currentRoom || currentRoom.currentTurnPlayerId !== currentUser.id) {
                    return;
                }
                const localPlayer = currentRoom.players.find(p => p.id === currentUser.id);
                if (!localPlayer || !localPlayer.handCards || localPlayer.handCards.length !== 14) {
                    return;
                }
                e.preventDefault();
                declareArea.style.borderColor = '#48bb78';
                declareArea.style.background = 'rgba(72, 187, 120, 0.15)';
                declareArea.style.boxShadow = '0 0 14px rgba(72, 187, 120, 0.7)';
            });

            declareSlot.addEventListener('dragleave', () => {
                declareArea.style.borderColor = '#ecc94b';
                declareArea.style.background = 'rgba(236, 201, 75, 0.05)';
                declareArea.style.boxShadow = 'none';
            });

            declareSlot.addEventListener('drop', (e) => {
                e.preventDefault();
                declareArea.style.borderColor = '#ecc94b';
                declareArea.style.background = 'rgba(236, 201, 75, 0.05)';
                declareArea.style.boxShadow = 'none';

                if (!currentRoom || currentRoom.currentTurnPlayerId !== currentUser.id) {
                    return;
                }
                
                const localPlayer = currentRoom.players.find(p => p.id === currentUser.id);
                if (!localPlayer || !localPlayer.handCards || localPlayer.handCards.length !== 14) {
                    return;
                }

                if (draggedCardIndex !== null) {
                    const flatCards = [];
                    cardGroups.forEach(g => flatCards.push(...g));
                    const cardToDeclare = flatCards[draggedCardIndex];
                    if (cardToDeclare) {
                        selectedCardIds.clear();
                        selectedCardIds.add(cardToDeclare.id);
                        handleDeclareHand();
                    }
                } else if (selectedCardIds.size > 0) {
                    handleDeclareHand();
                }
            });
        }

        // Waiting Room Delete Button Handler
        const btnWaitingDelete = document.getElementById('btn-waiting-delete-room');
        if (btnWaitingDelete) {
            btnWaitingDelete.addEventListener('click', async () => {
                if (!currentRoom || !currentUser) return;
                if (confirm(`Delete Room #${currentRoom.code}? All connected players will return to the lobby.`)) {
                    await MULTIPLAYER_SERVICE.deleteRoom(currentRoom.code, currentUser.id);
                    handleReturnToLobby();
                }
            });
        }

        // Global Socket Event: Room Deleted by Host -> Return players to lobby
        MULTIPLAYER_SERVICE.onRoomDeleted((data) => {
            if (currentRoom && data && (String(data.roomCode) === String(currentRoom.code) || !data.roomCode)) {
                showToast(`⚠️ Room #${currentRoom.code} was deleted by the host. Returned to lobby.`, 'warning');
                handleReturnToLobby();
            }
        });

        // Global Socket Event: Room List Updated -> Refresh lobby rooms automatically
        MULTIPLAYER_SERVICE.onRoomListUpdate(() => {
            if (screenLobby && !screenLobby.classList.contains('hidden')) {
                renderAvailableRooms();
            }
        });
    }

    let targetDrawGroupIdx = null;

    function syncCardGroupsWithHand(localHand) {
        if (!cardGroups || cardGroups.length === 0) {
            cardGroups = [ [...localHand] ];
            targetDrawGroupIdx = null;
            return;
        }

        // Flatten existing groups and merge new drawn card if any
        let groupedFlat = cardGroups.flat();
        let missingCards = localHand.filter(c => !groupedFlat.some(gc => gc.id === c.id));
        if (missingCards.length > 0) {
            // Drop targeting: insert drawn card into the specific group where it was dropped
            if (targetDrawGroupIdx !== null && cardGroups[targetDrawGroupIdx]) {
                cardGroups[targetDrawGroupIdx].push(...missingCards);
            } else {
                cardGroups[cardGroups.length - 1].push(...missingCards);
            }
        }
        targetDrawGroupIdx = null; // Reset target track

        // Remove cards no longer in hand (after discard)
        cardGroups.forEach((g, gIdx) => {
            cardGroups[gIdx] = g.filter(c => localHand.some(lh => lh.id === c.id));
        });

        // Do NOT automatically delete/collapse empty groups here. Keep groups intact.
        if (cardGroups.length === 0 && localHand.length > 0) {
            cardGroups = [ [...localHand] ];
        }

        // Restrict maximum card groups to 6: merge any overflow into the 6th group
        while (cardGroups.length > 6) {
            const extra = cardGroups.pop();
            if (extra && extra.length > 0) {
                if (cardGroups.length > 0) {
                    cardGroups[cardGroups.length - 1].push(...extra);
                } else {
                    cardGroups.push(extra);
                }
            }
        }
    }



    function getGroupValidationInfo(groupCards) {
        if (!groupCards || groupCards.length === 0) {
            return { label: 'EMPTY', className: 'invalid-group' };
        }
        const wildRank = (currentRoom && currentRoom.wildJoker) ? currentRoom.wildJoker.rank : null;

        const isPure = RUMMY_RULES.isPureSequence(groupCards, wildRank);
        if (isPure) return { label: '🟢 PURE SEQUENCE', className: 'pure-seq' };

        const isImpure = RUMMY_RULES.isImpureSequence(groupCards, wildRank);
        if (isImpure) return { label: '🟡 2ND SEQUENCE', className: 'impure-seq' };

        const isNatSet = RUMMY_RULES.isNaturalSet(groupCards);
        if (isNatSet) return { label: '🔵 NATURAL TRIPLET', className: 'valid-set' };

        const isAset = RUMMY_RULES.isSet(groupCards, wildRank);
        if (isAset) return { label: '🟣 JOKER SET', className: 'valid-set' };

        return { label: '🔴 INVALID', className: 'invalid-group' };
    }

    // Hand state variables (selectedCardIds declared at top scope)

    function renderLocalHand() {
        const localPlayer = currentRoom.players.find(p => p.id === currentUser.id);
        if (!localPlayer || !localPlayer.handCards) return;

        syncCardGroupsWithHand(localPlayer.handCards);

        // Delete any group if it is empty
        cardGroups = cardGroups.filter(g => g.length > 0);

        // If all cards got ungrouped or deleted somehow, fallback to single group
        if (cardGroups.length === 0 && localPlayer.handCards.length > 0) {
            cardGroups = [ [...localPlayer.handCards] ];
        }

        // Restrict maximum groups to 6
        while (cardGroups.length > 6) {
            const extra = cardGroups.pop();
            if (extra && extra.length > 0) {
                cardGroups[cardGroups.length - 1].push(...extra);
            }
        }

        // Enable/Disable Group button dynamically based on selected cards count & 6-group limit
        const btnGroup = document.getElementById('btn-group');
        if (btnGroup) {
            if (selectedCardIds.size > 1) {
                btnGroup.disabled = false;
                btnGroup.style.opacity = '1';
                btnGroup.style.cursor = 'pointer';
            } else {
                btnGroup.disabled = true;
                btnGroup.style.opacity = '0.5';
                btnGroup.style.cursor = 'not-allowed';
            }
        }

        handCardsRow.innerHTML = '';
        let globalCardIdx = 0;

        cardGroups.forEach((group, groupIdx) => {
            const groupContainer = document.createElement('div');
            groupContainer.className = `hand-group-box ${draggedGroupIdx === groupIdx ? 'dragging-group' : ''}`;
            groupContainer.dataset.groupIdx = groupIdx;

            // Group Type Auto Label Badge (Pure Seq, 2nd Seq, Triplet, Invalid)
            const validationInfo = getGroupValidationInfo(group);
            const groupTitle = document.createElement('div');
            groupTitle.className = `hand-group-title ${validationInfo.className}`;
            groupTitle.textContent = `${validationInfo.label}`;
            groupTitle.draggable = true; // Draggable group header

            // Group Header Dragging
            groupTitle.addEventListener('dragstart', (e) => {
                e.stopPropagation();
                draggedGroupIdx = groupIdx;
                draggedCardIndex = null;
                groupContainer.classList.add('dragging-group');
                e.dataTransfer.setData('text/group', groupIdx);
            });

            groupTitle.addEventListener('dragend', () => {
                groupContainer.classList.remove('dragging-group');
                draggedGroupIdx = null;
            });

            // Dragover group highlight feedback
            groupContainer.addEventListener('dragover', (e) => {
                e.preventDefault();
                groupContainer.classList.add('drag-over-target');
            });

            groupContainer.addEventListener('dragleave', () => {
                groupContainer.classList.remove('drag-over-target');
            });

            groupContainer.addEventListener('drop', (e) => {
                e.preventDefault();
                groupContainer.classList.remove('drag-over-target');

                // Group Header dropped -> Reorder entire group
                if (draggedGroupIdx !== null && draggedGroupIdx !== groupIdx) {
                    reorderEntireGroup(draggedGroupIdx, groupIdx);
                    return;
                }

                // Card dropped into group
                if (draggedCardIndex !== null) {
                    moveCardToGroup(draggedCardIndex, groupIdx);
                }
            });

            group.forEach((card) => {
                const currentIdx = globalCardIdx;
                const wrapper = document.createElement('div');
                wrapper.className = `playing-card-wrapper ${selectedCardIds.has(card.id) ? 'selected' : ''}`;
                wrapper.draggable = true;
                wrapper.dataset.cardIdx = currentIdx;

                const isWild = currentRoom.wildJoker && card.rank === currentRoom.wildJoker.rank;
                // +20% enlarged player hand card SVG (78x109)
                wrapper.innerHTML = SVG_CARDS.getCardSvg(card, { isWild, width: 78, height: 109 });
                
                // Multi-selection click handler by unique Card ID
                wrapper.addEventListener('click', (e) => {
                    e.stopPropagation();
                    if (selectedCardIds.has(card.id)) {
                        selectedCardIds.delete(card.id);
                    } else {
                        selectedCardIds.add(card.id);
                    }
                    renderLocalHand();
                });

                // HTML5 Drag and Drop events
                wrapper.addEventListener('dragstart', (e) => {
                    e.stopPropagation();
                    draggedCardIndex = currentIdx;
                    draggedGroupIdx = null;
                    wrapper.classList.add('dragging');
                    e.dataTransfer.setData('text/card', currentIdx);
                });

                wrapper.addEventListener('dragend', () => {
                    wrapper.classList.remove('dragging');
                    draggedCardIndex = null;
                    document.querySelectorAll('.hand-group-box').forEach(el => el.classList.remove('drag-over-target'));
                    document.querySelectorAll('.playing-card-wrapper').forEach(el => el.classList.remove('drop-target-card'));
                });

                wrapper.addEventListener('dragover', (e) => {
                    e.preventDefault();
                    if (draggedCardIndex !== null && draggedCardIndex !== currentIdx) {
                        wrapper.classList.add('drop-target-card');
                    }
                });

                wrapper.addEventListener('dragleave', () => {
                    wrapper.classList.remove('drop-target-card');
                });

                wrapper.addEventListener('drop', (e) => {
                    e.stopPropagation();
                    e.preventDefault();
                    wrapper.classList.remove('drop-target-card');
                    if (draggedCardIndex !== null && draggedCardIndex !== currentIdx) {
                        reorderCardToPosition(draggedCardIndex, currentIdx);
                    }
                });

                groupContainer.appendChild(wrapper);
                globalCardIdx++;
            });

            groupContainer.insertBefore(groupTitle, groupContainer.firstChild);
            handCardsRow.appendChild(groupContainer);
        });

        emitSyncGroups();
    }

    function emitSyncGroups() {
        if (currentRoom && currentUser && cardGroups && cardGroups.length > 0) {
            MULTIPLAYER_SERVICE.syncHandGroups(currentRoom.code, currentUser.id, cardGroups);
        }
    }

    // Grouping & Drag-and-Drop Functions (Capped at 6 Groups Maximum without Errors)
    function handleCreateGroup() {
        if (selectedCardIds.size < 2) {
            return; // Silently ignore without error message
        }

        const selectedCards = [];
        const newCardGroups = [];

        // Remove selected cards from their existing groups, preserving non-selected card groups
        cardGroups.forEach(group => {
            const unselectedInGroup = [];
            group.forEach(card => {
                if (selectedCardIds.has(card.id)) {
                    selectedCards.push(card);
                } else {
                    unselectedInGroup.push(card);
                }
            });
            if (unselectedInGroup.length > 0) {
                newCardGroups.push(unselectedInGroup);
            }
        });

        // Add the newly formed group of selected cards at the LEFT side (start)
        if (selectedCards.length > 0) {
            newCardGroups.unshift(selectedCards);
        }

        // Restrict maximum card groups to 6: stop creating beyond 6 silently without showing any error message
        if (newCardGroups.length > 6) {
            selectedCardIds.clear();
            renderLocalHand();
            return;
        }

        cardGroups = newCardGroups;
        selectedCardIds.clear();
        renderLocalHand();
    }

    function handleUngroup() {
        let flatCards = [];
        cardGroups.forEach(g => flatCards.push(...g));
        cardGroups = [ flatCards ];
        selectedCardIds.clear();
        renderLocalHand();
    }



    function reorderCardToPosition(fromGlobalIdx, toGlobalIdx) {
        // Find card matching fromGlobalIdx in nested cardGroups
        let fromCard = null;
        let fromGIdx = -1;
        let fromCIdx = -1;
        let currGlobal = 0;

        for (let gIdx = 0; gIdx < cardGroups.length; gIdx++) {
            for (let cIdx = 0; cIdx < cardGroups[gIdx].length; cIdx++) {
                if (currGlobal === fromGlobalIdx) {
                    fromCard = cardGroups[gIdx][cIdx];
                    fromGIdx = gIdx;
                    fromCIdx = cIdx;
                    break;
                }
                currGlobal++;
            }
            if (fromCard) break;
        }

        if (!fromCard) return;

        // Find drop location details
        let targetGIdx = -1;
        let targetCIdx = -1;
        currGlobal = 0;

        for (let gIdx = 0; gIdx < cardGroups.length; gIdx++) {
            for (let cIdx = 0; cIdx < cardGroups[gIdx].length; cIdx++) {
                if (currGlobal === toGlobalIdx) {
                    targetGIdx = gIdx;
                    targetCIdx = cIdx;
                    break;
                }
                currGlobal++;
            }
            if (targetGIdx !== -1) break;
        }

        // Default to last group if target not found
        if (targetGIdx === -1) {
            targetGIdx = cardGroups.length - 1;
            targetCIdx = cardGroups[targetGIdx].length;
        }

        // Perform splice in structured nested group array
        cardGroups[fromGIdx].splice(fromCIdx, 1);
        cardGroups[targetGIdx].splice(targetCIdx, 0, fromCard);

        selectedCardIds.clear();
        renderLocalHand();
    }

    function reorderEntireGroup(fromGroupIdx, toGroupIdx) {
        if (fromGroupIdx === toGroupIdx || fromGroupIdx < 0 || toGroupIdx < 0) return;
        if (!cardGroups[fromGroupIdx] || !cardGroups[toGroupIdx]) return;

        const groupToMove = cardGroups.splice(fromGroupIdx, 1)[0];
        cardGroups.splice(toGroupIdx, 0, groupToMove);

        selectedCardIds.clear();
        renderLocalHand();
    }

    function moveCardToGroup(fromGlobalIdx, targetGroupIdx) {
        let flatCards = [];
        cardGroups.forEach(g => flatCards.push(...g));

        const cardToMove = flatCards[fromGlobalIdx];
        if (!cardToMove) return;

        // Remove card from its current group
        cardGroups.forEach((g, gIdx) => {
            cardGroups[gIdx] = g.filter(c => c.id !== cardToMove.id);
        });

        if (!cardGroups[targetGroupIdx]) cardGroups[targetGroupIdx] = [];
        cardGroups[targetGroupIdx].push(cardToMove);

        selectedCardIds.clear();
        renderLocalHand();
    }

    function handleDrawFromDeck(fromDiscard) {
        if (!currentRoom || !currentUser) return;

        if (currentRoom.status === 'WAITING') {
            showToast("The game is waiting for another player to join. (Or click 'Start Game' on table).", "warning");
            return;
        }

        if (String(currentRoom.currentTurnPlayerId) !== String(currentUser.id)) {
            const activePlayer = currentRoom.players.find(p => String(p.id) === String(currentRoom.currentTurnPlayerId));
            const activeName = activePlayer ? activePlayer.name : "Opponent";
            showToast(`⏳ It's ${activeName}'s turn right now. Please wait!`, "warning");
            return;
        }

        const localPlayer = currentRoom.players.find(p => String(p.id) === String(currentUser.id));
        if (localPlayer && localPlayer.handCards && localPlayer.handCards.length >= 14) {
            showToast("You already drew a card (14 cards)! Please drag a card to discard or declare.", "warning");
            return;
        }

        MULTIPLAYER_SERVICE.drawCard(currentRoom.code, currentUser.id, fromDiscard);
    }

    function handleDiscardByIndex(globalIndex) {
        if (!currentRoom || !currentUser) return;

        if (String(currentRoom.currentTurnPlayerId) !== String(currentUser.id)) {
            const activePlayer = currentRoom.players.find(p => String(p.id) === String(currentRoom.currentTurnPlayerId));
            const activeName = activePlayer ? activePlayer.name : "Opponent";
            showToast(`⏳ It's ${activeName}'s turn right now. Please wait!`, "warning");
            return;
        }

        const localPlayer = currentRoom.players.find(p => String(p.id) === String(currentUser.id));
        if (!localPlayer || !localPlayer.handCards || localPlayer.handCards.length < 14) {
            showToast("⚠️ You must draw a card from the deck or discard pile before discarding!", "warning");
            return;
        }

        // Find the card ID matching the global hand index
        let flatCards = [];
        cardGroups.forEach(g => flatCards.push(...g));

        const cardToDiscard = flatCards[globalIndex];
        if (!cardToDiscard) return;

        const cardIdxToDiscard = localPlayer.handCards.findIndex(c => c.id === cardToDiscard.id);
        if (cardIdxToDiscard >= 0) {
            MULTIPLAYER_SERVICE.discardCard(currentRoom.code, currentUser.id, cardIdxToDiscard);
            selectedCardIds.clear();
        }
    }

    function autoSortHand() {
        const suitOrder = { 'H': 1, 'D': 2, 'C': 3, 'S': 4, 'JOKER': 5 };
        const rankOrder = ['2','3','4','5','6','7','8','9','10','J','Q','K','A','JOKER'];

        // Sort cards within each group independently
        cardGroups.forEach(group => {
            group.sort((a, b) => {
                if (a.suit !== b.suit) return suitOrder[a.suit] - suitOrder[b.suit];
                return rankOrder.indexOf(a.rank) - rankOrder.indexOf(b.rank);
            });
        });

        renderLocalHand();
    }

    async function handleDeclareHand() {
        const localPlayer = currentRoom.players.find(p => p.id === currentUser.id);
        if (!localPlayer) return;

        // Prevent declaration if player does not have exactly 14 cards (13 cards in hand + 1 card drawn to declare/discard)
        if (!localPlayer.handCards || localPlayer.handCards.length !== 14) {
            alert("To declare, you must first draw a card to have 14 cards, then drop one onto the DECLARE slot!");
            return;
        }

        const wildRank = currentRoom.wildJoker ? currentRoom.wildJoker.rank : null;

        // DUAL ACTION: If a card is selected when hitting 'Declare', it is treated as the final discard.
        let finalDeclarationGroups = [];
        let finalDiscardCard = null;

        if (selectedCardIds.size === 1) {
            const discardedId = Array.from(selectedCardIds)[0];
            
            // Rebuild final declaration groups omitting the selected discard card
            cardGroups.forEach(group => {
                const groupMinusDiscard = group.filter(c => c.id !== discardedId);
                if (groupMinusDiscard.length > 0) {
                    finalDeclarationGroups.push(groupMinusDiscard);
                }
            });

            // Locate the card object to send for the final discard
            finalDiscardCard = localPlayer.handCards.find(c => c.id === discardedId);
        } else {
            // Find 1-card group or the last card in the last group as the 14th discard
            let foundDiscard = null;
            for (let gIdx = cardGroups.length - 1; gIdx >= 0; gIdx--) {
                if (cardGroups[gIdx].length === 1) {
                    foundDiscard = cardGroups[gIdx][0];
                    break;
                }
            }
            if (!foundDiscard && cardGroups.length > 0) {
                const lastGroup = cardGroups[cardGroups.length - 1];
                if (lastGroup && lastGroup.length > 0) {
                    foundDiscard = lastGroup[lastGroup.length - 1];
                }
            }

            if (foundDiscard) {
                finalDiscardCard = foundDiscard;
                cardGroups.forEach(group => {
                    const groupMinusDiscard = group.filter(c => c.id !== foundDiscard.id);
                    if (groupMinusDiscard.length > 0) {
                        finalDeclarationGroups.push(groupMinusDiscard);
                    }
                });
            } else {
                finalDeclarationGroups = cardGroups.filter(g => g.length > 0);
            }
        }
        
        // Use user's real cardGroups directly for declaration validation
        const result = RUMMY_RULES.validateDeclaration(finalDeclarationGroups, wildRank);

        if (result.valid) {
            // Update local card groups to match declared combinations
            cardGroups = finalDeclarationGroups;
            renderLocalHand();
        }
        selectedCardIds.clear();

        // Broadcast the declaration to all room participants via the server
        await MULTIPLAYER_SERVICE.declareGame(currentRoom.code, currentUser.id, {
            valid: result.valid,
            isAllTriplets: result.isAllTriplets === true,
            reason: result.reason,
            groups: finalDeclarationGroups,
            discardCard: finalDiscardCard
        });
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();
