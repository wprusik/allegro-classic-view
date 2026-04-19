function sendMessage(message) {
    if (typeof browser !== "undefined" && browser?.runtime) {
        return browser.runtime.sendMessage(message);
    }

    return new Promise((resolve, reject) => {
        chrome.runtime.sendMessage(message, (response) => {
            const lastError = chrome.runtime.lastError;
            if (lastError) {
                reject(new Error(lastError.message));
                return;
            }
            resolve(response);
        });
    });
}

function setToggleLabel(button, enabled) {
    button.classList.remove("toggle-on", "toggle-off");
    button.classList.add(enabled ? "toggle-on" : "toggle-off");
    button.textContent = enabled ? "\u26A1 Wy\u0142\u0105cz wtyczk\u0119" : "\u26A1 W\u0142\u0105cz wtyczk\u0119";
}

async function initPopup() {
    const toggleBtn = document.getElementById("toggle-btn");
    let enabled = true;

    try {
        const response = await sendMessage({ type: "GET_ENABLED" });
        enabled = response?.enabled !== false;
    } catch (_) {
        enabled = true;
    }

    setToggleLabel(toggleBtn, enabled);

    toggleBtn.addEventListener("click", async () => {
        toggleBtn.disabled = true;
        const next = !enabled;

        try {
            await sendMessage({ type: "SET_ENABLED", enabled: next });
            enabled = next;
            setToggleLabel(toggleBtn, enabled);
        } finally {
            toggleBtn.disabled = false;
        }
    });
}

document.addEventListener("DOMContentLoaded", initPopup);


