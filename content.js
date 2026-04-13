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

    const checkReady = setInterval(() => {
        // Aguarda elementos de conteúdo real da conversa estarem presentes
        if (document.querySelector('message-content, structured-content-container, .model-response-text')) {
            clearInterval(checkReady);
            setTimeout(() => {
                loader.style.opacity = '0';
                setTimeout(() => loader.remove(), 400);
            }, 1000); // 1.0s extra para garantir que a transição seja suave e o conteúdo esteja renderizado
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