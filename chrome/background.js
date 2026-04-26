const ICONS_ENABLED = {
    16: "icons/icon-16.png",
    32: "icons/icon-32.png",
    48: "icons/icon-48.png",
    128: "icons/icon-128.png"
};

const ICONS_DISABLED = {
    16: "icons/icon-gray-16.png",
    32: "icons/icon-gray-32.png",
    48: "icons/icon-gray-48.png",
    128: "icons/icon-gray-128.png"
};

const DEFAULT_SETTINGS = {
    product: true,
    cart: true,
    favorites: true,
    productSections: {
        othersAlsoViewed: true,
        buildYourSet: true,
        lowestPriceProposals: true,
        priceDealsForYou: true,
        singleShipmentOrder: true,
        singleShipmentSetOrder: true,
        newArrivals: true,
        ourProductSeries: true,
        proposalsForYou: true
    }
};

const DEFAULT_GLOBAL_ENABLED = true;

function getPageKeyFromPath(pathname) {
    if (pathname.startsWith("/produkt/") || pathname.startsWith("/oferta/")) {
        return "product";
    }
    if (pathname === "/koszyk") {
        return "cart";
    }
    if (pathname === "/moje-allegro/zakupy/obserwowane/ulubione") {
        return "favorites";
    }
    return null;
}

function getPageKeyFromUrl(url) {
    if (!url) return null;
    try {
        const parsed = new URL(url);
        if (parsed.hostname !== "allegro.pl") {
            return null;
        }
        return getPageKeyFromPath(parsed.pathname);
    } catch (_) {
        return null;
    }
}

function isTargetUrl(url) {
    return getPageKeyFromUrl(url) !== null;
}

function normalizeSettings(raw) {
    const hasStoredProductSections = raw && typeof raw.productSections === "object";
    let productSections = normalizeProductSections(raw?.productSections);
    if (!hasStoredProductSections && raw?.product === false) {
        productSections = mapProductSections(false);
    }
    const hasAnyProductSectionEnabled = Object.values(productSections).some(Boolean);

    return {
        product: raw?.product !== false && hasAnyProductSectionEnabled,
        cart: raw?.cart !== false,
        favorites: raw?.favorites !== false,
        productSections
    };
}

function mapProductSections(value) {
    return Object.keys(DEFAULT_SETTINGS.productSections).reduce((acc, key) => {
        acc[key] = Boolean(value);
        return acc;
    }, {});
}

function normalizeProductSections(raw) {
    const defaults = DEFAULT_SETTINGS.productSections;
    return Object.keys(defaults).reduce((acc, key) => {
        acc[key] = raw?.[key] !== false;
        return acc;
    }, {});
}

function getSettings() {
    if (typeof browser !== "undefined" && browser?.storage?.local) {
        return browser.storage.local.get(["pageSettings", "enabled"])
            .then((result) => {
                if (result?.pageSettings) {
                    return normalizeSettings(result.pageSettings);
                }
                if (result?.enabled === false) {
                    return { product: false, cart: false, favorites: false };
                }
                return { ...DEFAULT_SETTINGS };
            })
            .catch(() => ({ ...DEFAULT_SETTINGS }));
    }

    return new Promise((resolve) => {
        chrome.storage.local.get(["pageSettings", "enabled"], (result) => {
            if (result?.pageSettings) {
                resolve(normalizeSettings(result.pageSettings));
                return;
            }
            if (result?.enabled === false) {
                resolve({ product: false, cart: false, favorites: false });
                return;
            }
            resolve({ ...DEFAULT_SETTINGS });
        });
    });
}

function setSettings(settings) {
    const normalized = normalizeSettings(settings);
    if (typeof browser !== "undefined" && browser?.storage?.local) {
        return browser.storage.local.set({ pageSettings: normalized });
    }

    return new Promise((resolve) => {
        chrome.storage.local.set({ pageSettings: normalized }, () => resolve());
    });
}

function getGlobalEnabled() {
    if (typeof browser !== "undefined" && browser?.storage?.local) {
        return browser.storage.local.get(["enabled"])
            .then((result) => result?.enabled !== false)
            .catch(() => DEFAULT_GLOBAL_ENABLED);
    }

    return new Promise((resolve) => {
        chrome.storage.local.get(["enabled"], (result) => {
            resolve(result?.enabled !== false);
        });
    });
}

function setGlobalEnabled(enabled) {
    if (typeof browser !== "undefined" && browser?.storage?.local) {
        return browser.storage.local.set({ enabled: Boolean(enabled) });
    }

    return new Promise((resolve) => {
        chrome.storage.local.set({ enabled: Boolean(enabled) }, () => resolve());
    });
}

async function isEnabledForUrl(url) {
    const pageKey = getPageKeyFromUrl(url);
    if (!pageKey) return false;
    const globalEnabled = await getGlobalEnabled();
    if (!globalEnabled) return false;
    const settings = await getSettings();
    return settings[pageKey] !== false;
}

function setActionIcon(enabled, tabId) {
    const actionApi = (typeof browser !== "undefined" && browser?.action) ? browser.action : chrome.action;
    const details = { path: enabled ? ICONS_ENABLED : ICONS_DISABLED };
    if (typeof tabId === "number") details.tabId = tabId;

    if (typeof browser !== "undefined" && browser?.action) {
        return actionApi.setIcon(details);
    }
    return new Promise((resolve) => {
        actionApi.setIcon(details, () => resolve());
    });
}

function setActionTitle(enabled, tabId) {
    const actionApi = (typeof browser !== "undefined" && browser?.action) ? browser.action : chrome.action;
    const details = {
        title: enabled ? "Allegro Clean View: ON" : "Allegro Clean View: OFF"
    };
    if (typeof tabId === "number") details.tabId = tabId;

    if (typeof browser !== "undefined" && browser?.action) {
        return actionApi.setTitle(details);
    }
    return new Promise((resolve) => {
        actionApi.setTitle(details, () => resolve());
    });
}

async function refreshIconForTab(tabId) {
    const tabsApi = (typeof browser !== "undefined" && browser?.tabs) ? browser.tabs : chrome.tabs;
    let tab = null;
    if (typeof browser !== "undefined" && browser?.tabs) {
        tab = await tabsApi.get(tabId).catch(() => null);
    } else {
        tab = await new Promise((resolve) => tabsApi.get(tabId, (value) => resolve(value || null)));
    }

    const enabled = await isEnabledForUrl(tab?.url);
    await setActionIcon(enabled, tabId);
    await setActionTitle(enabled, tabId);
}

function getActiveTab() {
    if (typeof browser !== "undefined" && browser?.tabs) {
        return browser.tabs.query({ active: true, currentWindow: true }).then((tabs) => tabs?.[0] || null);
    }

    return new Promise((resolve) => {
        chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => resolve(tabs?.[0] || null));
    });
}

function reloadTab(tabId) {
    if (typeof browser !== "undefined" && browser?.tabs) {
        return browser.tabs.reload(tabId);
    }
    return new Promise((resolve) => {
        chrome.tabs.reload(tabId, () => resolve());
    });
}

async function applyPageSetting(pageKey, enabled) {
    const settings = await getSettings();
    settings[pageKey] = enabled;
    if (pageKey === "product") {
        settings.productSections = mapProductSections(enabled);
    }
    await setSettings(settings);

    const activeTab = await getActiveTab();
    if (activeTab?.id && getPageKeyFromUrl(activeTab.url) === pageKey) {
        await reloadTab(activeTab.id);
    }
    if (activeTab?.id) {
        await refreshIconForTab(activeTab.id);
    }
}

async function applyProductSectionSetting(sectionKey, enabled) {
    const settings = await getSettings();
    settings.productSections = normalizeProductSections(settings.productSections);
    settings.productSections[sectionKey] = enabled;
    settings.product = Object.values(settings.productSections).some(Boolean);
    await setSettings(settings);

    const activeTab = await getActiveTab();
    if (activeTab?.id && getPageKeyFromUrl(activeTab.url) === "product") {
        await reloadTab(activeTab.id);
    }
    if (activeTab?.id) {
        await refreshIconForTab(activeTab.id);
    }
}

async function applyEnabledState(enabled) {
    await setGlobalEnabled(enabled);
    const activeTab = await getActiveTab();
    if (activeTab?.id && isTargetUrl(activeTab.url)) {
        await reloadTab(activeTab.id);
    }
    if (activeTab?.id) {
        await refreshIconForTab(activeTab.id);
    } else {
        await setActionIcon(enabled);
        await setActionTitle(enabled);
    }
}

const runtimeApi = (typeof browser !== "undefined" && browser?.runtime) ? browser.runtime : chrome.runtime;
const tabsApi = (typeof browser !== "undefined" && browser?.tabs) ? browser.tabs : chrome.tabs;

runtimeApi.onInstalled.addListener(async () => {
    const settings = await getSettings();
    await setSettings(settings);
    const globalEnabled = await getGlobalEnabled();
    await setGlobalEnabled(globalEnabled);
    const activeTab = await getActiveTab();
    if (activeTab?.id) {
        await refreshIconForTab(activeTab.id);
        return;
    }
    await setActionIcon(globalEnabled);
    await setActionTitle(globalEnabled);
});

runtimeApi.onStartup?.addListener(async () => {
    const activeTab = await getActiveTab();
    if (activeTab?.id) {
        await refreshIconForTab(activeTab.id);
    }
});

runtimeApi.onMessage?.addListener((message, _sender, sendResponse) => {
    if (!message?.type) return;

    if (message.type === "GET_SETTINGS") {
        getSettings()
            .then((settings) => sendResponse({ settings }))
            .catch(() => sendResponse({ settings: { ...DEFAULT_SETTINGS } }));
        return true;
    }

    if (message.type === "SET_PAGE_ENABLED") {
        const pageKey = message.page;
        if (!["product", "cart", "favorites"].includes(pageKey)) {
            sendResponse({ ok: false, error: "INVALID_PAGE" });
            return;
        }
        applyPageSetting(pageKey, Boolean(message.enabled))
            .then(() => sendResponse({ ok: true }))
            .catch((error) => sendResponse({ ok: false, error: String(error) }));
        return true;
    }

    if (message.type === "SET_PRODUCT_SECTION_ENABLED") {
        const sectionKey = message.section;
        if (!Object.prototype.hasOwnProperty.call(DEFAULT_SETTINGS.productSections, sectionKey)) {
            sendResponse({ ok: false, error: "INVALID_SECTION" });
            return;
        }
        applyProductSectionSetting(sectionKey, Boolean(message.enabled))
            .then(() => sendResponse({ ok: true }))
            .catch((error) => sendResponse({ ok: false, error: String(error) }));
        return true;
    }

    if (message.type === "GET_ENABLED") {
        getGlobalEnabled()
            .then((enabled) => sendResponse({ enabled }))
            .catch(() => sendResponse({ enabled: DEFAULT_GLOBAL_ENABLED }));
        return true;
    }

    if (message.type === "SET_ENABLED") {
        applyEnabledState(Boolean(message.enabled))
            .then(() => sendResponse({ ok: true }))
            .catch((error) => sendResponse({ ok: false, error: String(error) }));
        return true;
    }
});

tabsApi.onActivated?.addListener((activeInfo) => {
    refreshIconForTab(activeInfo.tabId);
});

tabsApi.onUpdated?.addListener((tabId, changeInfo) => {
    if (changeInfo.status === "loading" || changeInfo.status === "complete") {
        refreshIconForTab(tabId);
    }
});
