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
    chrome.storage.local.get(['g_crtMode', 'g_fontSize'], (res) => {
        const isEnabled = res.g_crtMode !== false;
        const hasTerminalClass = document.body.classList.contains('terminal-mode');

        if (isEnabled) {
            document.body.classList.add('terminal-mode');
            injectDynamicStyles();
            applyDynamicFontSize(res.g_fontSize || 16);
            createLoader();
            startObserver();
        } else {
            document.body.classList.remove('terminal-mode');
            const dynamicStyle = document.getElementById('terminal-code-styles');
            if (dynamicStyle) dynamicStyle.remove();
            const fontStyle = document.getElementById('terminal-font-size');
            if (fontStyle) fontStyle.remove();

            // Só recarrega se não for carga inicial e se a classe estava presente (desativação manual)
            if (!isInitialLoad && hasTerminalClass) {
                // Safeguard contra loops infinitos
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

function applyDynamicFontSize(size) {
    let fontStyle = document.getElementById('terminal-font-size') || document.createElement('style');
    fontStyle.id = 'terminal-font-size';
    fontStyle.textContent = `
        body.terminal-mode .model-response-text p, 
        body.terminal-mode .model-response-text li, 
        body.terminal-mode .query-text { 
            font-size: ${size}px !important; 
        }
        body.terminal-mode pre, 
        body.terminal-mode code, 
        body.terminal-mode .code-block { 
            font-size: 13px !important; 
        }
    `;
    document.head.appendChild(fontStyle);
}

function createLoader() {
    if (document.getElementById('terminal-loader')) return;
    const loader = document.createElement('div');
    loader.id = 'terminal-loader';
    loader.innerHTML = `inicializando<span class="dot">.</span><span class="dot">.</span><span class="dot">.</span>`;
    document.body.appendChild(loader);

    const checkReady = setInterval(() => {
        if (document.querySelector('chat-window, rich-textarea, .input-area-container')) {
            clearInterval(checkReady);
            setTimeout(() => {
                loader.style.opacity = '0';
                setTimeout(() => loader.remove(), 400);
            }, 500);
        }
    }, 500);
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
        const footerText = document.querySelector('.disclaimer-text, div[class*="disclaimer"]');
        if (footerText && footerText.textContent !== 'Feito é Melhor que Perfeito!') {
            footerText.textContent = 'Feito é Melhor que Perfeito!';
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
    if (changes.g_crtMode || changes.g_fontSize) updateTheme(false);
});

loadConfig();