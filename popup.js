document.addEventListener('DOMContentLoaded', () => {
    // Elements
    const themeBtn = document.getElementById('btn-theme-toggle');
    const fullWidthBtn = document.getElementById('btn-fullwidth-toggle');
    const fontMinus = document.getElementById('btn-font-minus');
    const fontPlus = document.getElementById('btn-font-plus');
    const fontSizeDisplay = document.getElementById('font-size-display');


    let currentFS = 16; // Default Font Scale

    // --- LÓGICA DO TEMA (ON/OFF) ---
    // 1. Carrega estado inicial
    chrome.storage.local.get(['g_crtMode', 'g_fullWidth'], (res) => {
        const isThemeEnabled = res.g_crtMode || false;
        const isFullWidthEnabled = res.g_fullWidth || false;
        updateThemeButton(isThemeEnabled);
        updateFullWidthButton(isFullWidthEnabled);
    });


    // 2. Lógica do clique no botão retrô
    themeBtn.addEventListener('click', () => {
        chrome.storage.local.get(['g_crtMode'], (res) => {
            const nextState = !(res.g_crtMode || false);
            // Se ativar um, desativa o outro
            const updates = { g_crtMode: nextState };
            if (nextState) updates.g_fullWidth = false;
            
            chrome.storage.local.set(updates, () => {
                updateThemeButton(nextState);
                if (nextState) updateFullWidthButton(false);
            });
        });
    });

    // 3. Lógica do clique no botão Full Width
    fullWidthBtn.addEventListener('click', () => {
        chrome.storage.local.get(['g_fullWidth'], (res) => {
            const nextState = !(res.g_fullWidth || false);
            // Se ativar um, desativa o outro
            const updates = { g_fullWidth: nextState };
            if (nextState) updates.g_crtMode = false;

            chrome.storage.local.set(updates, () => {
                updateFullWidthButton(nextState);
                if (nextState) updateThemeButton(false);
            });
        });
    });


    // 4. Atualiza aparência dos botões
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


    // --- LÓGICA DO AJUSTADOR DE FONTE (IMPLEMENTAÇÃO) ---
    // 1. Carrega tamanho inicial do storage
    chrome.storage.local.get(['g_fontSize'], (res) => {
        if (res.g_fontSize) {
            currentFS = res.g_fontSize;
            fontSizeDisplay.textContent = currentFS + 'px';
        }
    });

    // 2. Lógica do botão Menos (limite min 10px)
    fontMinus.addEventListener('click', () => {
        if (currentFS > 10) {
            currentFS -= 1;
            updateFontScale(currentFS);
        }
    });

    // 3. Lógica do botão Mais (limite max 30px)
    fontPlus.addEventListener('click', () => {
        if (currentFS < 30) {
            currentFS += 1;
            updateFontScale(currentFS);
        }
    });

    // 4. Salva e atualiza o display
    function updateFontScale(size) {
        fontSizeDisplay.textContent = size + 'px';
        chrome.storage.local.set({ g_fontSize: size });
    }
});