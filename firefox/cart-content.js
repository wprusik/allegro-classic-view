function isEnabled() {
    if (typeof browser !== "undefined" && browser?.storage?.local) {
        return browser.storage.local.get(["pageSettings", "enabled"])
            .then((result) => {
                if (result?.pageSettings) {
                    return result.enabled !== false && result.pageSettings.cart !== false;
                }
                return result?.enabled !== false;
            })
            .catch(() => true);
    }

    return new Promise((resolve) => {
        if (typeof chrome === "undefined" || !chrome?.storage?.local) {
            resolve(true);
            return;
        }
        chrome.storage.local.get(["pageSettings", "enabled"], (result) => {
            if (result?.pageSettings) {
                resolve(result.enabled !== false && result.pageSettings.cart !== false);
                return;
            }
            resolve(result?.enabled !== false);
        });
    });
}

function cleanCartSuggestions() {
    [...document.querySelectorAll('h4[data-role="replaceable-title"]')]
        .filter((el) => el.textContent?.startsWith("Dorzu\u0107 do przesy\u0142ki!"))
        .forEach((el) => el.parentElement?.parentElement?.remove());
}

function watchCartChanges() {
    if (!document.body || typeof MutationObserver === "undefined") {
        return;
    }

    const observer = new MutationObserver(() => cleanCartSuggestions());
    observer.observe(document.body, { childList: true, subtree: true });
}

(async () => {
    if (location.hostname !== "allegro.pl" || location.pathname !== "/koszyk") {
        return;
    }

    const enabled = await isEnabled();
    if (!enabled) return;

    cleanCartSuggestions();
    watchCartChanges();
})();



