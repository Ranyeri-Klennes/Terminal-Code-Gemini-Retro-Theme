document.addEventListener('DOMContentLoaded', () => {
    // Elements
    const themeBtn = document.getElementById('btn-theme-toggle');
    const fullWidthBtn = document.getElementById('btn-fullwidth-toggle');
    const fontMinus = document.getElementById('btn-font-minus');
    const fontPlus = document.getElementById('btn-font-plus');
    const fontSizeDisplay = document.getElementById('font-size-display');

    // Reader Elements
    const readerToggleBtn = document.getElementById('btn-reader-toggle');
    const readerPrevBtn = document.getElementById('btn-reader-prev');
    const readerNextBtn = document.getElementById('btn-reader-next');
    const readerStopBtn = document.getElementById('btn-reader-stop');
    const readerRateBtn = document.getElementById('btn-reader-rate');

    let currentFS = 16;
    let isReaderPlaying = false;
    let isReaderPaused = false;
    const availableRates = [1.0, 1.25, 1.5, 1.8];
    let currentRateIndex = 1; // Default 1.25x

    function showTemporaryStatus(text) {
        if (!readerToggleBtn) return;
        const oldText = readerToggleBtn.textContent;
        readerToggleBtn.textContent = text;
        setTimeout(() => {
            if (readerToggleBtn && readerToggleBtn.textContent === text) {
                readerToggleBtn.textContent = oldText;
            }
        }, 2200);
    }

    // Helper: Safe messaging to active tab com injeção automática caso a aba precise ser atualizada
    function sendTabMessage(msg, callback) {
        chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
            const tab = tabs?.[0];
            if (!tab?.id) {
                if (callback) callback(null);
                return;
            }

            if (tab.url && (tab.url.startsWith('chrome://') || tab.url.startsWith('edge://') || tab.url.startsWith('chrome-extension://'))) {
                showTemporaryStatus('[PÁGINA INVÁLIDA]');
                if (callback) callback(null);
                return;
            }

            chrome.tabs.sendMessage(tab.id, msg, (res) => {
                if (chrome.runtime.lastError) {
                    if (chrome.scripting && chrome.scripting.executeScript) {
                        chrome.scripting.executeScript({
                            target: { tabId: tab.id },
                            files: ['content.js']
                        }).then(() => {
                            setTimeout(() => {
                                chrome.tabs.sendMessage(tab.id, msg, (res2) => {
                                    if (chrome.runtime.lastError) {
                                        showTemporaryStatus('[F5 NA PÁGINA]');
                                        if (callback) callback(null);
                                        return;
                                    }
                                    if (callback) callback(res2);
                                });
                            }, 120);
                        }).catch(() => {
                            showTemporaryStatus('[F5 NA PÁGINA]');
                            if (callback) callback(null);
                        });
                    } else {
                        showTemporaryStatus('[F5 NA PÁGINA]');
                        if (callback) callback(null);
                    }
                    return;
                }
                if (callback) callback(res);
            });
        });
    }

    // --- LÓGICA DO TEMA (ON/OFF) ---
    chrome.storage.local.get(['g_crtMode', 'g_fullWidth', 'g_fontSize', 'g_readerRate'], (res) => {
        const isThemeEnabled = res.g_crtMode !== false;
        const isFullWidthEnabled = res.g_fullWidth === true;
        updateThemeButton(isThemeEnabled);
        updateFullWidthButton(isFullWidthEnabled);

        if (res.g_fontSize) {
            currentFS = res.g_fontSize;
            fontSizeDisplay.textContent = currentFS + 'px';
        }

        if (res.g_readerRate) {
            const idx = availableRates.indexOf(res.g_readerRate);
            if (idx !== -1) currentRateIndex = idx;
        }
        if (readerRateBtn) {
            readerRateBtn.textContent = availableRates[currentRateIndex] + 'x';
        }

        // Verifica estado do leitor na aba ativa
        sendTabMessage({ type: 'READER_GET_STATUS' }, (status) => {
            if (status) updateReaderUI(status);
        });
    });

    themeBtn.addEventListener('click', () => {
        chrome.storage.local.get(['g_crtMode'], (res) => {
            const nextState = !(res.g_crtMode || false);
            const updates = { g_crtMode: nextState };
            if (nextState) updates.g_fullWidth = false;
            
            chrome.storage.local.set(updates, () => {
                updateThemeButton(nextState);
                if (nextState) updateFullWidthButton(false);
            });
        });
    });

    fullWidthBtn.addEventListener('click', () => {
        chrome.storage.local.get(['g_fullWidth'], (res) => {
            const nextState = !(res.g_fullWidth || false);
            const updates = { g_fullWidth: nextState };
            if (nextState) updates.g_crtMode = false;

            chrome.storage.local.set(updates, () => {
                updateFullWidthButton(nextState);
                if (nextState) updateThemeButton(false);
            });
        });
    });

    function updateThemeButton(isEnabled) {
        if (isEnabled) {
            themeBtn.textContent = '[ ON ]';
            themeBtn.classList.add('active');
        } else {
            themeBtn.textContent = '[OFF]';
            themeBtn.classList.remove('active');
        }
    }

    function updateFullWidthButton(isEnabled) {
        if (isEnabled) {
            fullWidthBtn.textContent = '[ ON ]';
            fullWidthBtn.classList.add('active');
        } else {
            fullWidthBtn.textContent = '[OFF]';
            fullWidthBtn.classList.remove('active');
        }
    }

    // --- FONTE ---
    fontMinus.addEventListener('click', () => {
        if (currentFS > 10) {
            currentFS -= 1;
            updateFontScale(currentFS);
        }
    });

    fontPlus.addEventListener('click', () => {
        if (currentFS < 30) {
            currentFS += 1;
            updateFontScale(currentFS);
        }
    });

    function updateFontScale(size) {
        fontSizeDisplay.textContent = size + 'px';
        chrome.storage.local.set({ g_fontSize: size });
    }

    // --- LEITOR DE VOZ (MINIMALISTA E SUTIL) ---
    function updateReaderUI(status) {
        if (!status || !readerToggleBtn) return;
        isReaderPlaying = !!status.isPlaying;
        isReaderPaused = !!status.isPaused;

        if (status.rate) {
            const idx = availableRates.indexOf(status.rate);
            if (idx !== -1) currentRateIndex = idx;
            if (readerRateBtn) readerRateBtn.textContent = status.rate + 'x';
        }

        if (isReaderPlaying && !isReaderPaused) {
            readerToggleBtn.textContent = '[⏸ PAUSA]';
            readerToggleBtn.classList.add('playing');
            if (readerStopBtn) readerStopBtn.style.display = 'inline-block';
        } else if (isReaderPaused) {
            readerToggleBtn.textContent = '[▶ LER]';
            readerToggleBtn.classList.remove('playing');
            if (readerStopBtn) readerStopBtn.style.display = 'inline-block';
        } else {
            readerToggleBtn.textContent = '[▶ LER]';
            readerToggleBtn.classList.remove('playing');
            if (readerStopBtn) readerStopBtn.style.display = 'none';
        }
    }

    if (readerPrevBtn) {
        readerPrevBtn.addEventListener('click', () => {
            sendTabMessage({ 
                type: 'READER_PREV',
                payload: { rate: availableRates[currentRateIndex] }
            }, updateReaderUI);
        });
    }

    if (readerToggleBtn) {
        readerToggleBtn.addEventListener('click', () => {
            if (isReaderPlaying && !isReaderPaused) {
                sendTabMessage({ type: 'READER_PAUSE' }, updateReaderUI);
            } else {
                sendTabMessage({ 
                    type: 'READER_PLAY', 
                    payload: { rate: availableRates[currentRateIndex] } 
                }, updateReaderUI);
            }
        });
    }

    if (readerNextBtn) {
        readerNextBtn.addEventListener('click', () => {
            sendTabMessage({ 
                type: 'READER_NEXT',
                payload: { rate: availableRates[currentRateIndex] }
            }, updateReaderUI);
        });
    }

    if (readerStopBtn) {
        readerStopBtn.addEventListener('click', () => {
            sendTabMessage({ type: 'READER_STOP' }, updateReaderUI);
        });
    }

    if (readerRateBtn) {
        readerRateBtn.addEventListener('click', () => {
            currentRateIndex = (currentRateIndex + 1) % availableRates.length;
            const newRate = availableRates[currentRateIndex];
            readerRateBtn.textContent = newRate + 'x';
            chrome.storage.local.set({ g_readerRate: newRate });
            sendTabMessage({ type: 'READER_SET_RATE', payload: { rate: newRate } }, updateReaderUI);
        });
    }

    // Escuta atualizações de status emitidas pelo content script
    chrome.runtime.onMessage.addListener((message) => {
        if (message && message.type === 'READER_STATUS_UPDATE') {
            updateReaderUI(message.payload);
        }
    });
});