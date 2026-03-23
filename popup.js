// popup.js
document.getElementById('ext-crt-toggle').addEventListener('change', (e) => {
    chrome.storage.local.set({ g_crtMode: e.target.checked });
});

chrome.storage.local.get(['g_crtMode'], (res) => {
    document.getElementById('ext-crt-toggle').checked = res.g_crtMode !== false;
});

let currentFS = 16;
chrome.storage.local.get(['g_fontSize'], (r) => { 
    if(r.g_fontSize) { 
        currentFS = r.g_fontSize; 
        document.getElementById('font-size-display').textContent = currentFS + 'px'; 
    } 
});

document.getElementById('btn-font-minus').onclick = () => { 
    if(currentFS > 10) { 
        currentFS--; 
        updateFS(currentFS); 
    } 
};

document.getElementById('btn-font-plus').onclick = () => { 
    if(currentFS < 30) { 
        currentFS++; 
        updateFS(currentFS); 
    } 
};

function updateFS(s) { 
    document.getElementById('font-size-display').textContent = s + 'px'; 
    chrome.storage.local.set({ g_fontSize: s }); 
}