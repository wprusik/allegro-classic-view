const DEFAULT_PRODUCT_SECTIONS = {
    othersAlsoViewed: true,
    buildYourSet: true,
    lowestPriceProposals: true,
    priceDealsForYou: true,
    singleShipmentOrder: true,
    singleShipmentSetOrder: true,
    newArrivals: true,
    ourProductSeries: true,
    proposalsForYou: true
};

const PRODUCT_SECTION_CHECKBOXES = {
    othersAlsoViewed: "setting-product-others-also-viewed",
    buildYourSet: "setting-product-build-your-set",
    lowestPriceProposals: "setting-product-lowest-price-proposals",
    priceDealsForYou: "setting-product-price-deals-for-you",
    singleShipmentOrder: "setting-product-single-shipment-order",
    singleShipmentSetOrder: "setting-product-single-shipment-set-order",
    newArrivals: "setting-product-new-arrivals",
    ourProductSeries: "setting-product-our-product-series",
    proposalsForYou: "setting-product-proposals-for-you"
};

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

function normalizeProductSections(raw) {
    return Object.keys(DEFAULT_PRODUCT_SECTIONS).reduce((acc, key) => {
        acc[key] = raw?.[key] !== false;
        return acc;
    }, {});
}

function syncProductMasterCheckbox(product, sectionCheckboxes) {
    const values = Object.values(sectionCheckboxes).map((checkbox) => checkbox.checked);
    const enabledCount = values.filter(Boolean).length;

    product.checked = enabledCount === values.length;
    product.indeterminate = enabledCount > 0 && enabledCount < values.length;
}

function setProductSectionExpanded(expanded, subsettings, toggleButton) {
    subsettings.classList.toggle("is-collapsed", !expanded);
    toggleButton.textContent = expanded ? "▴" : "▾";
    toggleButton.setAttribute("aria-expanded", String(expanded));
    toggleButton.setAttribute("aria-label", expanded ? "Zwiń ustawienia strony produktu" : "Rozwiń ustawienia strony produktu");
}

async function updateSetting(page, enabled) {
    setDisabled(true);
    try {
        await sendMessage({ type: "SET_PAGE_ENABLED", page, enabled });
    } finally {
        setDisabled(false);
    }
}

async function updateProductSectionSetting(section, enabled) {
    setDisabled(true);
    try {
        await sendMessage({ type: "SET_PRODUCT_SECTION_ENABLED", section, enabled });
    } finally {
        setDisabled(false);
    }
}

async function initPopup() {
    const product = document.getElementById("setting-product");
    const cart = document.getElementById("setting-cart");
    const favorites = document.getElementById("setting-favorites");
    const toggleExtension = document.getElementById("toggle-extension");
    const toggleProductSections = document.getElementById("toggle-product-sections");
    const productSubsettings = document.getElementById("product-subsettings");
    const productSectionCheckboxes = Object.keys(PRODUCT_SECTION_CHECKBOXES).reduce((acc, key) => {
        acc[key] = document.getElementById(PRODUCT_SECTION_CHECKBOXES[key]);
        return acc;
    }, {});

    let settings = {
        product: true,
        cart: true,
        favorites: true,
        productSections: { ...DEFAULT_PRODUCT_SECTIONS }
    };
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

    const productSections = normalizeProductSections(settings.productSections);

    cart.checked = settings.cart !== false;
    favorites.checked = settings.favorites !== false;

    Object.keys(productSectionCheckboxes).forEach((key) => {
        productSectionCheckboxes[key].checked = productSections[key];
    });
    syncProductMasterCheckbox(product, productSectionCheckboxes);

    setProductSectionExpanded(false, productSubsettings, toggleProductSections);

    document.querySelectorAll('input[type="checkbox"]').forEach((el) => {
        el.disabled = !extensionEnabled;
    });

    toggleExtension.textContent = extensionEnabled ? "Wyłącz wtyczkę" : "Włącz wtyczkę";
    toggleExtension.classList.toggle("is-disabled", !extensionEnabled);

    toggleProductSections.addEventListener("click", () => {
        const expanded = productSubsettings.classList.contains("is-collapsed");
        setProductSectionExpanded(expanded, productSubsettings, toggleProductSections);
    });

    product.addEventListener("change", async () => {
        await updateSetting("product", product.checked);
        Object.values(productSectionCheckboxes).forEach((checkbox) => {
            checkbox.checked = product.checked;
        });
        product.indeterminate = false;
    });

    cart.addEventListener("change", () => updateSetting("cart", cart.checked));
    favorites.addEventListener("change", () => updateSetting("favorites", favorites.checked));

    Object.keys(productSectionCheckboxes).forEach((key) => {
        const checkbox = productSectionCheckboxes[key];
        checkbox.addEventListener("change", async () => {
            await updateProductSectionSetting(key, checkbox.checked);
            syncProductMasterCheckbox(product, productSectionCheckboxes);
        });
    });

    toggleExtension.addEventListener("click", async () => {
        setDisabled(true);
        try {
            extensionEnabled = !extensionEnabled;
            await sendMessage({ type: "SET_ENABLED", enabled: extensionEnabled });
            toggleExtension.textContent = extensionEnabled ? "Wyłącz wtyczkę" : "Włącz wtyczkę";
            toggleExtension.classList.toggle("is-disabled", !extensionEnabled);
        } finally {
            setDisabled(false);
            if (!extensionEnabled) {
                document.querySelectorAll('input[type="checkbox"]').forEach((el) => {
                    el.disabled = true;
                });
            }
        }
    });
}

document.addEventListener("DOMContentLoaded", initPopup);
