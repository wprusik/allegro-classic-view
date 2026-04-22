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

function setDisabled(disabled) {
    document.querySelectorAll('input[type="checkbox"], button').forEach((el) => {
        el.disabled = disabled;
    });
}

async function updateSetting(page, enabled) {
    setDisabled(true);
    try {
        await sendMessage({ type: "SET_PAGE_ENABLED", page, enabled });
    } finally {
        setDisabled(false);
    }
}

async function initPopup() {
    const product = document.getElementById("setting-product");
    const cart = document.getElementById("setting-cart");
    const favorites = document.getElementById("setting-favorites");
    const toggleExtension = document.getElementById("toggle-extension");

    let settings = { product: true, cart: true, favorites: true };
    let extensionEnabled = true;
    try {
        const [settingsResponse, enabledResponse] = await Promise.all([
            sendMessage({ type: "GET_SETTINGS" }),
            sendMessage({ type: "GET_ENABLED" })
        ]);
        settings = settingsResponse?.settings || settings;
        extensionEnabled = enabledResponse?.enabled !== false;
    } catch (_) {
    }

    product.checked = settings.product !== false;
    cart.checked = settings.cart !== false;
    favorites.checked = settings.favorites !== false;
    product.disabled = !extensionEnabled;
    cart.disabled = !extensionEnabled;
    favorites.disabled = !extensionEnabled;
    toggleExtension.textContent = extensionEnabled ? "Wyłącz wtyczkę" : "Włącz wtyczkę";
    toggleExtension.classList.toggle("is-disabled", !extensionEnabled);

    product.addEventListener("change", () => updateSetting("product", product.checked));
    cart.addEventListener("change", () => updateSetting("cart", cart.checked));
    favorites.addEventListener("change", () => updateSetting("favorites", favorites.checked));
    toggleExtension.addEventListener("click", async () => {
        setDisabled(true);
        try {
            extensionEnabled = !extensionEnabled;
            await sendMessage({ type: "SET_ENABLED", enabled: extensionEnabled });
            product.disabled = !extensionEnabled;
            cart.disabled = !extensionEnabled;
            favorites.disabled = !extensionEnabled;
            toggleExtension.textContent = extensionEnabled ? "Wyłącz wtyczkę" : "Włącz wtyczkę";
            toggleExtension.classList.toggle("is-disabled", !extensionEnabled);
        } finally {
            setDisabled(false);
            if (!extensionEnabled) {
                product.disabled = true;
                cart.disabled = true;
                favorites.disabled = true;
            }
        }
    });
}

document.addEventListener("DOMContentLoaded", initPopup);
