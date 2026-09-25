// content.js
let config = null;

async function loadConfig() {
    try {
        const response = await fetch(chrome.runtime.getURL('config.json'));
        config = await response.json();
        updateTheme(true);
    } catch (error) {
        console.error('Terminal Code Error:', error);
    }
}

function updateTheme(isInitialLoad = false) {
    chrome.storage.local.get(['g_crtMode', 'g_fullWidth', 'g_fontSize'], (res) => {
        const isCrtEnabled = res.g_crtMode !== false;
        const isFullWidthEnabled = res.g_fullWidth === true;
        
        const hadAnyClass = document.body.classList.contains('terminal-mode') || document.body.classList.contains('full-width-mode');

        // Aplica as classes de forma independente
        document.body.classList.toggle('terminal-mode', isCrtEnabled);
        document.body.classList.toggle('full-width-mode', isFullWidthEnabled);

        if (isCrtEnabled) {
            injectDynamicStyles();
            applyDynamicFontSize(res.g_fontSize || 16);
            createLoader();
            startObserver();
            forceNativeDarkMode();
            closeNativeMenus();
        } else {
            cleanupRetroTheme();
            
            // Só recarrega se não for carga inicial e se alguma classe estava presente (desativação manual)
            // E se agora não houver nada ativo
            if (!isInitialLoad && hadAnyClass && !isCrtEnabled && !isFullWidthEnabled) {
                const lastReload = sessionStorage.getItem('terminal_last_reload');
                const now = Date.now();
                if (!lastReload || (now - parseInt(lastReload)) > 3000) {
                    sessionStorage.setItem('terminal_last_reload', now.toString());
                    location.reload();
                }
            }
        }
    });
}


function cleanupRetroTheme() {
    closeNativeMenus();
    const dynamicStyle = document.getElementById('terminal-code-styles');
    if (dynamicStyle) dynamicStyle.remove();
    const fontStyle = document.getElementById('terminal-font-size');
    if (fontStyle) fontStyle.remove();
}


function applyDynamicFontSize(size) {
    let fontStyle = document.getElementById('terminal-font-size') || document.createElement('style');
    fontStyle.id = 'terminal-font-size';
    fontStyle.textContent = `
        body.terminal-mode *:not(mat-icon):not(.google-symbols) { 
            font-size: ${size}px !important; 
        }
    `;
    document.head.appendChild(fontStyle);
}

function closeNativeMenus() {
    // Simula um clique no corpo para fechar menus suspensos do Angular/Gemini
    document.body.click();
}

function createLoader() {
    if (document.getElementById('terminal-loader')) return;
    const loader = document.createElement('div');
    loader.id = 'terminal-loader';
    loader.innerHTML = `entrando<span class="dot">.</span><span class="dot">.</span><span class="dot">.</span>`;
    document.body.appendChild(loader);

    let attempts = 0;
    const checkReady = setInterval(() => {
        attempts++;
        // Aguarda elementos de conteúdo real da conversa ou o estado inicial (zero state)
        if (document.querySelector('message-content, structured-content-container, .model-response-text, modular-zero-state, .zero-state-container') || attempts > 20) {
            clearInterval(checkReady);
            setTimeout(() => {
                loader.style.opacity = '0';
                setTimeout(() => loader.remove(), 400);
            }, 500); // Reduzido para 0.5s para ser mais ágil
        }
    }, 100);

    // Timeout de segurança: remove o loader após 5 segundos independente do estado
    setTimeout(() => {
        clearInterval(checkReady);
        if (loader.parentNode) loader.remove();
    }, 5000);
}

function injectDynamicStyles() {
    if (!config) return;
    let styleTag = document.getElementById('terminal-code-styles') || document.createElement('style');
    styleTag.id = 'terminal-code-styles';
    let css = '';
    for (const [selector, color] of Object.entries(config.selectors)) {
        css += `body.terminal-mode ${selector} { color: ${color} !important; }\n`;
    }
    styleTag.textContent = css;
    document.head.appendChild(styleTag);
}

let observerInstance = null;

function startObserver() {
    if (observerInstance) return;

    observerInstance = new MutationObserver(() => {
        if (!document.body.classList.contains('terminal-mode')) return;

        // Logo e Footer agora controlados via CSS ou removidos do observer para performance
        const footerText = document.querySelector('.disclaimer-text, [class*="disclaimer"]');
        if (footerText) {
            footerText.style.setProperty('width', '100%', 'important');
            footerText.style.setProperty('max-width', '100%', 'important');
            footerText.style.setProperty('padding', '0', 'important');
            const desiredHTML = `<div style="display: flex; justify-content: space-between; width: 100%; align-items: center; padding: 0 40px; box-sizing: border-box;"><span>Feito é Melhor que Perfeito!</span><span>Desenvolvido com ☕ por <a href="https://portfolio-ranyeri-klennes.vercel.app/" target="_blank" style="color: #00e5ff !important; text-decoration: underline !important;">Ranyeri Klennes.</a></span></div>`;
            if (footerText.innerHTML !== desiredHTML) {
                footerText.innerHTML = desiredHTML;
            }
        }

        document.querySelectorAll('[data-placeholder], rich-textarea').forEach(el => {
            if (el.getAttribute('data-placeholder') !== 'conta tua história...') {
                el.setAttribute('data-placeholder', 'conta tua história...');
            }
        });

        // Ícones removidos do loop de limpeza para evitar quebra de ligatures (Material Symbols)
    });

    observerInstance.observe(document.body, { childList: true, subtree: true });
}

chrome.storage.onChanged.addListener((changes) => {
    if (changes.g_crtMode || changes.g_fullWidth) {
        updateTheme(false);
    } else if (changes.g_fontSize) {
        applyDynamicFontSize(changes.g_fontSize.newValue);
    }
});


async function forceNativeDarkMode() {
    // 1. Encontra e clica no botão de "Configurações e ajuda"
    const settingsBtn = document.querySelector('[data-test-id="settings-and-help-button"] button, [data-test-id="expanded-button"][aria-label="Settings & help"]');
    if (!settingsBtn) return;
    
    // Clica para abrir o menu base
    settingsBtn.click();
    
    // Espera 150ms para o Angular renderizar o menu na tela
    await new Promise(r => setTimeout(r, 150));
    
    // 2. Encontra e clica no botão "Tema"
    const themeBtn = Array.from(document.querySelectorAll('.mat-mdc-menu-item')).find(el => el.textContent.includes('Tema'));
    if (!themeBtn) {
        document.body.click(); // Fecha se falhar
        return;
    }
    themeBtn.click();
    
    // Espera 150ms para o submenu abrir
    await new Promise(r => setTimeout(r, 150));
    
    // 3. Encontra a opção "Escuro" e clica se não estiver marcada
    const darkBtn = Array.from(document.querySelectorAll('.mat-mdc-menu-item')).find(el => el.textContent.includes('Escuro'));
    
    if (darkBtn) {
        if (darkBtn.getAttribute('aria-checked') !== 'true') {
            darkBtn.click(); // Ativa o modo escuro
            setTimeout(() => location.reload(), 500); // Recarrega para aplicar mudanças
        } else {
            document.body.click(); // Já está escuro, apenas fecha o menu
        }
    } else {
        document.body.click(); // Fecha tudo caso dê erro
    }
}

loadConfig();

// ==========================================
// LEITOR DE VOZ RETRO TERMINAL (TTS)
// ==========================================

let readerBlocks = [];
let readerCurrentIndex = 0;
let readerIsPlaying = false;
let readerIsPaused = false;
let readerRate = 1.25;
let cachedVoices = [];
let currentUtteranceSession = 0;

function loadReaderVoices() {
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
        cachedVoices = window.speechSynthesis.getVoices();
    }
}

if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
    loadReaderVoices();
    window.speechSynthesis.onvoiceschanged = () => {
        loadReaderVoices();
    };
}

// Seleciona a melhor voz natural pt-BR disponível
function getBestVoice() {
    if (!cachedVoices.length) {
        loadReaderVoices();
    }
    const voices = cachedVoices;
    if (!voices.length) return null;

    // 1. Google Português do Brasil (Chrome Neural TTS)
    const googlePtBr = voices.find(v => {
        const lang = v.lang.toLowerCase().replace('_', '-');
        const name = v.name.toLowerCase();
        return lang === 'pt-br' && (name.includes('google') || name.includes('brasil'));
    });
    if (googlePtBr) return googlePtBr;

    // 2. Natural / Neural / Online pt-BR
    const neuralPtBr = voices.find(v => {
        const lang = v.lang.toLowerCase().replace('_', '-');
        const name = v.name.toLowerCase();
        return lang === 'pt-br' && (name.includes('natural') || name.includes('neural') || name.includes('online'));
    });
    if (neuralPtBr) return neuralPtBr;

    // 3. Qualquer voz pt-BR
    const anyPtBr = voices.find(v => v.lang.toLowerCase().replace('_', '-') === 'pt-br');
    if (anyPtBr) return anyPtBr;

    // 4. Qualquer voz em português
    const anyPt = voices.find(v => v.lang.toLowerCase().startsWith('pt'));
    if (anyPt) return anyPt;

    return voices[0];
}

// Extrai blocos legíveis de mensagens do Gemini (ou página atual) de forma estrita e sem repetições
function parseReaderBlocks() {
    const blocks = [];
    let blockId = 0;
    const processedElements = new Set();

    // 1. Seletores específicos de folhas de texto no Gemini (evita selecionar containers pai e filhos simultaneamente)
    const candidateNodes = document.querySelectorAll(
        'message-content p, message-content pre, message-content li, message-content blockquote, ' +
        'message-content h1, message-content h2, message-content h3, message-content h4, ' +
        '.markdown-main-panel p, .markdown-main-panel pre, .markdown-main-panel li, ' +
        '.model-response-text p, .model-response-text li, ' +
        'user-query-content p, .query-content p, .user-query-container p'
    );

    let candidates = Array.from(candidateNodes);

    // Fallback para artigos ou outras páginas genéricas
    if (candidates.length === 0) {
        const root = document.querySelector('article, main, [role="main"]') || document.body;
        candidates = Array.from(root.querySelectorAll('p, pre, li, blockquote, h1, h2, h3, h4, h5, h6'));
    }

    candidates.forEach(el => {
        if (processedElements.has(el)) return;
        if (el.closest('header, footer, nav, aside, .cdk-overlay-container, .response-container-footer, message-actions, bot-banner')) return;

        // Se for um container que possui parágrafos ou itens filhos, não adiciona o pai como bloco duplicado
        if (el.querySelector('p, pre, li, blockquote, h1, h2, h3, h4')) return;

        // Bloco de código
        const isPre = el.tagName.toLowerCase() === 'pre';
        const isCode = el.tagName.toLowerCase() === 'code';
        if (isPre || (isCode && el.parentElement?.tagName.toLowerCase() === 'pre')) {
            const codeEl = isPre ? el : el.closest('pre');
            if (processedElements.has(codeEl)) return;

            const codeText = (codeEl.textContent || '').trim();
            if (codeText.length > 5) {
                blocks.push({
                    id: blockId++,
                    type: 'code',
                    text: 'Trecho de código ignorado.',
                    element: codeEl
                });
            }
            processedElements.add(codeEl);
            codeEl.querySelectorAll('*').forEach(c => processedElements.add(c));
            return;
        }

        if (el.closest('pre')) return;

        const text = (el.textContent || '').replace(/\s+/g, ' ').trim();
        if (text.length >= 2) {
            // Evita adicionar blocos consecutivos com texto idêntico
            if (blocks.length > 0 && blocks[blocks.length - 1].text === text) {
                return;
            }

            blocks.push({
                id: blockId++,
                type: 'text',
                text: text,
                element: el
            });
            processedElements.add(el);
            el.querySelectorAll('*').forEach(c => processedElements.add(c));
        }
    });

    return blocks;
}

// Localiza o primeiro bloco visível na área de visualização atual (viewport)
function findFirstVisibleReaderBlockIndex() {
    if (readerBlocks.length === 0) return 0;
    const viewportHeight = window.innerHeight || document.documentElement.clientHeight;

    for (let i = 0; i < readerBlocks.length; i++) {
        const el = readerBlocks[i].element;
        if (!el) continue;
        const rect = el.getBoundingClientRect();
        if ((rect.top >= 0 && rect.top < viewportHeight * 0.8) || (rect.top < 0 && rect.bottom > 60)) {
            return i;
        }
    }
    return 0;
}

function removeReaderHighlight() {
    document.querySelectorAll('.terminal-reading-highlight').forEach(el => {
        el.classList.remove('terminal-reading-highlight');
    });
}

function applyReaderHighlight(element) {
    removeReaderHighlight();
    if (element) {
        element.classList.add('terminal-reading-highlight');
        element.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
}

function broadcastReaderStatus() {
    try {
        chrome.runtime.sendMessage({
            type: 'READER_STATUS_UPDATE',
            payload: {
                isPlaying: readerIsPlaying,
                isPaused: readerIsPaused,
                rate: readerRate
            }
        });
    } catch (_) {}
}

function speakCurrentReaderBlock() {
    // Incrementa a sessão para invalidar callbacks assíncronos de blocos cancelados
    currentUtteranceSession++;
    const session = currentUtteranceSession;

    if (readerCurrentIndex >= readerBlocks.length || readerCurrentIndex < 0) {
        readerIsPlaying = false;
        readerIsPaused = false;
        removeReaderHighlight();
        broadcastReaderStatus();
        return;
    }

    const block = readerBlocks[readerCurrentIndex];
    if (!block || !block.text) {
        readerCurrentIndex++;
        speakCurrentReaderBlock();
        return;
    }

    applyReaderHighlight(block.element);

    if (window.speechSynthesis.speaking || window.speechSynthesis.pending) {
        window.speechSynthesis.cancel();
    }

    // Delay para garantir que o cancelamento anterior foi processado pelo motor do navegador
    setTimeout(() => {
        if (session !== currentUtteranceSession) return;

        const utterance = new SpeechSynthesisUtterance(block.text);
        utterance.lang = 'pt-BR';
        utterance.rate = readerRate;
        utterance.pitch = 1.0;

        const voice = getBestVoice();
        if (voice) utterance.voice = voice;

        utterance.onstart = () => {
            if (session !== currentUtteranceSession) return;
            readerIsPlaying = true;
            readerIsPaused = false;
            broadcastReaderStatus();
        };

        utterance.onend = () => {
            if (session !== currentUtteranceSession) return;
            readerCurrentIndex++;
            if (readerCurrentIndex < readerBlocks.length && readerIsPlaying) {
                speakCurrentReaderBlock();
            } else {
                readerIsPlaying = false;
                readerIsPaused = false;
                removeReaderHighlight();
                broadcastReaderStatus();
            }
        };

        utterance.onerror = (e) => {
            if (session !== currentUtteranceSession) return;
            if (e.error === 'interrupted' || e.error === 'canceled') return;
            console.warn('[Terminal Code Reader] Speech error:', e);
            readerCurrentIndex++;
            if (readerCurrentIndex < readerBlocks.length && readerIsPlaying) {
                speakCurrentReaderBlock();
            } else {
                readerIsPlaying = false;
                readerIsPaused = false;
                removeReaderHighlight();
                broadcastReaderStatus();
            }
        };

        window.speechSynthesis.resume();
        window.speechSynthesis.speak(utterance);
        readerIsPlaying = true;
        readerIsPaused = false;
        broadcastReaderStatus();
    }, 50);
}

// Carrega velocidade configurada
chrome.storage.local.get(['g_readerRate'], (res) => {
    if (res.g_readerRate) readerRate = res.g_readerRate;
});

// Listener de mensagens da extensão
chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
    if (!message || !message.type) return;

    switch (message.type) {
        case 'READER_GET_STATUS': {
            sendResponse({
                isPlaying: readerIsPlaying,
                isPaused: readerIsPaused,
                rate: readerRate
            });
            break;
        }
        case 'READER_PLAY': {
            if (message.payload?.rate) {
                readerRate = message.payload.rate;
            }
            if (readerIsPaused) {
                window.speechSynthesis.resume();
                readerIsPlaying = true;
                readerIsPaused = false;
            } else {
                readerBlocks = parseReaderBlocks();
                readerCurrentIndex = findFirstVisibleReaderBlockIndex();
                speakCurrentReaderBlock();
            }
            sendResponse({ isPlaying: readerIsPlaying, isPaused: readerIsPaused, rate: readerRate });
            break;
        }
        case 'READER_PAUSE': {
            window.speechSynthesis.pause();
            readerIsPlaying = true;
            readerIsPaused = true;
            sendResponse({ isPlaying: readerIsPlaying, isPaused: readerIsPaused, rate: readerRate });
            break;
        }
        case 'READER_STOP': {
            currentUtteranceSession++;
            window.speechSynthesis.cancel();
            readerIsPlaying = false;
            readerIsPaused = false;
            readerCurrentIndex = 0;
            removeReaderHighlight();
            sendResponse({ isPlaying: readerIsPlaying, isPaused: readerIsPaused, rate: readerRate });
            break;
        }
        case 'READER_PREV': {
            if (message.payload?.rate) {
                readerRate = message.payload.rate;
            }
            if (readerBlocks.length === 0) {
                readerBlocks = parseReaderBlocks();
                readerCurrentIndex = findFirstVisibleReaderBlockIndex();
            }
            readerCurrentIndex = Math.max(0, readerCurrentIndex - 1);
            speakCurrentReaderBlock();
            sendResponse({ isPlaying: readerIsPlaying, isPaused: readerIsPaused, rate: readerRate });
            break;
        }
        case 'READER_NEXT': {
            if (message.payload?.rate) {
                readerRate = message.payload.rate;
            }
            if (readerBlocks.length === 0) {
                readerBlocks = parseReaderBlocks();
                readerCurrentIndex = findFirstVisibleReaderBlockIndex();
            } else if (readerCurrentIndex < readerBlocks.length - 1) {
                readerCurrentIndex++;
            }
            speakCurrentReaderBlock();
            sendResponse({ isPlaying: readerIsPlaying, isPaused: readerIsPaused, rate: readerRate });
            break;
        }
        case 'READER_SET_RATE': {
            if (message.payload?.rate) {
                readerRate = message.payload.rate;
                if (readerIsPlaying && !readerIsPaused) {
                    speakCurrentReaderBlock();
                }
            }
            sendResponse({ isPlaying: readerIsPlaying, isPaused: readerIsPaused, rate: readerRate });
            break;
        }
    }
    return true;
});