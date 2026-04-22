function isEnabled() {
    if (typeof browser !== "undefined" && browser?.storage?.local) {
        return browser.storage.local.get(["pageSettings", "enabled"])
            .then((result) => {
                if (result?.pageSettings) {
                    return result.enabled !== false && result.pageSettings.favorites !== false;
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
                resolve(result.enabled !== false && result.pageSettings.favorites !== false);
                return;
            }
            resolve(result?.enabled !== false);
        });
    });
}

function cleanAISuggestions() {
    document.querySelectorAll('div[data-testid="partial-optimization-content"]')
        .forEach((el) => el.remove());
}

function findElementByTitle(title) {
    const el = [...document.getElementsByTagName('h2')]
        .find((candidate) => candidate?.textContent?.startsWith(title));
    return el?.parentElement;
}

function removeContainersByTitles(...titles) {
    titles.forEach((title) => findElementByTitle(title)?.remove());
}

function moveCombineItemsButton() {
    let btn = document.querySelector('button[data-analytics-interaction-label="combineShipments"]');
    if (btn) {
        btn.style.width = '17em'
        btn.style.height = '2em'
        btn.style.marginTop = '1em'
        let parent = document.querySelector('button[data-analytics-interaction-label="makeAList"]')?.parentElement
        if (parent) {
            parent.appendChild(btn);
        }
        [...document.querySelectorAll('div[data-testid="optimizer-content"]')].forEach(el => {
            el.childNodes?.forEach(el => el.remove())
            el.style.margin = '10px 0'
        });
    }
}

(async () => {
    if (location.hostname !== "allegro.pl" || location.pathname !== "/moje-allegro/zakupy/obserwowane/ulubione") {
        return;
    }

    const enabled = await isEnabled();
    if (!enabled) {
        return;
    }
    cleanAISuggestions();
    moveCombineItemsButton();
    removeContainersByTitles('Zainspirowane Twoimi ulubionymi', 'Inni klienci kupują również');
    setInterval(() => removeContainersByTitles('Zainspirowane Twoimi ulubionymi', 'Inni klienci kupują również'), 1000);
})();
