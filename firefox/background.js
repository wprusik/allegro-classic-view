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

function isTargetUrl(url) {
    if (!url) return false;
    try {
        const parsed = new URL(url);
        return parsed.hostname === "allegro.pl" && (parsed.pathname.startsWith("/produkt/") || parsed.pathname.startsWith("/oferta/"));
    } catch (_) {
        return false;
    }
}

function getEnabledState() {
    if (typeof browser !== "undefined" && browser?.storage?.local) {
        return browser.storage.local.get("enabled")
            .then((result) => result.enabled !== false)
            .catch(() => true);
    }
    return new Promise((resolve) => {
        chrome.storage.local.get("enabled", (result) => {
            resolve(result?.enabled !== false);
        });
    });
}

function setEnabledState(enabled) {
    if (typeof browser !== "undefined" && browser?.storage?.local) {
        return browser.storage.local.set({ enabled });
    }
    return new Promise((resolve) => {
        chrome.storage.local.set({ enabled }, () => resolve());
    });
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
        title: enabled ? "allegro-classic-view: ON" : "allegro-classic-view: OFF"
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
    const enabled = await getEnabledState();
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

async function applyEnabledState(enabled) {
    await setEnabledState(enabled);
    await setActionIcon(enabled);
    await setActionTitle(enabled);
    const activeTab = await getActiveTab();
    if (activeTab?.id && isTargetUrl(activeTab.url)) {
        if (typeof browser !== "undefined" && browser?.tabs) {
            await browser.tabs.reload(activeTab.id);
        } else {
            chrome.tabs.reload(activeTab.id);
        }
    }
}

const runtimeApi = (typeof browser !== "undefined" && browser?.runtime) ? browser.runtime : chrome.runtime;
const actionApi = (typeof browser !== "undefined" && browser?.action) ? browser.action : chrome.action;
const tabsApi = (typeof browser !== "undefined" && browser?.tabs) ? browser.tabs : chrome.tabs;

runtimeApi.onInstalled.addListener(async () => {
    const enabled = await getEnabledState();
    await setActionIcon(enabled);
    await setActionTitle(enabled);
});

runtimeApi.onStartup?.addListener(async () => {
    const enabled = await getEnabledState();
    await setActionIcon(enabled);
    await setActionTitle(enabled);
});

runtimeApi.onMessage?.addListener((message, _sender, sendResponse) => {
    if (!message?.type) return;

    if (message.type === "GET_ENABLED") {
        getEnabledState()
            .then((enabled) => sendResponse({ enabled }))
            .catch(() => sendResponse({ enabled: true }));
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
