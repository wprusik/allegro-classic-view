function findElementByTagNameAndText(tagName, text) {
    const el = [...document.getElementsByTagName(tagName)]
        .find((candidate) => candidate?.textContent?.startsWith(text));
    return el?.parentElement;
}

function isEnabled() {
    if (typeof browser !== "undefined" && browser?.storage?.local) {
        return browser.storage.local.get(["pageSettings", "enabled"])
            .then((result) => {
                if (result?.pageSettings) {
                    return result.enabled !== false && result.pageSettings.product !== false;
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
                resolve(result.enabled !== false && result.pageSettings.product !== false);
                return;
            }
            resolve(result?.enabled !== false);
        });
    });
}

function findElementByTitle(title) {
    return findElementByTagNameAndText("h2", title);
}

function replaceContainerContent(title, elements) {
    const targetEl = findElementByTitle(title);
    if (!targetEl) return;
    targetEl.childNodes?.forEach((el) => el?.remove());
    elements.forEach((el) => {
        if (el) targetEl.appendChild(el);
    });
}

async function initializeItemParams() {
    document.querySelector('a[data-analytics-interaction-custom-url="#parametry"]')?.click();
    await new Promise((r) => setTimeout(r, 200));
    const paramsModal = document.querySelector('div[aria-labelledby="Parametry"]');
    if (paramsModal?.parentElement?.parentElement) {
        paramsModal.parentElement.parentElement.hidden = true;
    }
    await new Promise((r) => setTimeout(r, 500));
    document.querySelector('button[aria-label="Zamknij"]')?.click();
}

function getItemData() {
    const rawJson = [...document.querySelectorAll('script[type="application/json"]')]
        .map((el) => el.textContent || el.innerHTML || "")
        .find((text) =>
            text.includes('"dynamicBottomMargin"') ||
            text.includes('"keyParameters"') ||
            text.includes(':"Stan"')
        );

    if (!rawJson) {
        return null;
    }

    let parsed;
    try {
        parsed = JSON.parse(rawJson);
    } catch (e) {
        console.error("Nie udało się sparsować JSON-a", e);
        return null;
    }

    let items = [];

    if (Array.isArray(parsed.groups)) {
        items = parsed.groups.flatMap((group) => [
            ...(group.firstSubGroup || []),
            ...(group.secondSubGroup || [])
        ]).map((item) => ({
            name: item.name || "",
            value: item.value?.name || "",
            description: item.value?.description || "",
            url: item.value?.url || ""
        }));
    } else {
        if (Array.isArray(parsed.keyParameters)) {
            items.push(...parsed.keyParameters.map((p) => ({
                name: p.name || "",
                value: p.value || "",
                description: "",
                url: ""
            })));
        }

        if (parsed.brand) {
            items.push({
                name: (parsed.brand.label || "Marka").replace(/:$/, ""),
                value: parsed.brand.name || "",
                description: "",
                url: parsed.brand.url || ""
            });
        }

        if (parsed.rating) {
            items.push({
                name: "Ocena",
                value: `${parsed.rating.averageLabel || parsed.rating.ratingValue || ""} (${parsed.rating.countLabel || parsed.rating.ratingCountLabel || ""})`,
                description: "",
                url: ""
            });
        }

        if (parsed.productPopularityLabel?.label) {
            items.push({
                name: "Popularność",
                value: parsed.productPopularityLabel.label,
                description: parsed.productPopularityLabel.tooltipText || "",
                url: ""
            });
        }

        if (parsed.offerName) {
            items.push({
                name: "Nazwa oferty",
                value: parsed.offerName,
                description: "",
                url: ""
            });
        }

        if (parsed.productName) {
            items.push({
                name: "Nazwa produktu",
                value: parsed.productName,
                description: "",
                url: ""
            });
        }
    }

    if (!items.length) {
        return null;
    }

    const table = document.createElement("table");
    table.style.width = "100%";
    table.style.borderCollapse = "collapse";
    table.style.fontSize = ".875rem";
    table.style.lineHeight = "1.45";
    table.style.margin = "12px 0";
    table.style.background = "#fff";

    const appendParamCells = (tr, item, options = {}) => {
        const { rowBg = "#fff" } = options;
        const tdName = document.createElement("td");
        tdName.textContent = item?.name || "";
        tdName.style.border = "none";
        tdName.style.padding = "8px 10px";
        tdName.style.verticalAlign = "top";
        tdName.style.fontWeight = "400";
        tdName.style.color = "#757575";
        tdName.style.width = "25%";
        tdName.style.background = rowBg;


        const tdValue = document.createElement("td");
        tdValue.style.border = "none";
        tdValue.style.padding = "8px 10px";
        tdValue.style.verticalAlign = "top";
        tdValue.style.fontWeight = "400";
        tdValue.style.width = "75%";
        tdValue.style.background = rowBg;


        if (!item) {
            tr.appendChild(tdName);
            tr.appendChild(tdValue);
            return;
        }

        if (item.url) {
            const a = document.createElement("a");
            a.textContent = item.value;
            a.href = item.url;
            a.target = "_blank";
            a.rel = "noopener noreferrer";
            a.style.color = "#008673";
            a.addEventListener("mouseenter", () => { a.style.color = "#136355"; });
            a.addEventListener("mouseleave", () => { a.style.color = "#008673"; });
            if (item.description) a.title = item.description;
            tdValue.appendChild(a);
        } else {
            const span = document.createElement("span");
            span.textContent = item.value;
            if (item.description) {
                span.title = item.description;
                span.style.cursor = "help";
                span.style.textDecoration = "underline dotted";
            }
            tdValue.appendChild(span);
        }

        tr.appendChild(tdName);
        tr.appendChild(tdValue);
    };

    for (let i = 0; i < items.length; i += 1) {
        const tr = document.createElement("tr");
        const rowIndex = i;
        const rowBg = rowIndex % 2 === 0 ? "#F6F7F8" : "#fff";
        appendParamCells(tr, items[i], { rowBg });
        table.appendChild(tr);
    }

    table.style.fontFamily = "\"Open Sans\", sans-serif";
    return table;
}

function buildHeader(text) {
    const header = document.createElement("h2");
    header.textContent = text;
    header.style.fontFamily = "Calibri, Arial, sans-serif";
    header.style.fontSize = "1.5em";
    header.style.fontWeight = "500";
    return header;
}

async function moveItemParams() {
    await initializeItemParams();
    const h2 = buildHeader("Parametry");
    let table = getItemData();
    if (!table) {
        table = document.querySelector("div.app-container > table");
        if (table) {
            table.hidden = false;
        }
    }
    replaceContainerContent("Podobne oferty", [h2, table]);
    findElementByTagNameAndText("span", "Sponsorowane")?.parentElement?.remove();
}

function moveProductDescription() {
    const el = document.querySelector('div[data-box-name="Sidebar Description"]');
    replaceContainerContent("Propozycje dla Ciebie", [el]);
}

function removeMovedContainers() {
    document.querySelectorAll('a[name="product-info-content-columns"]')
        .forEach((el) => el.parentElement?.remove());
}

function removeContainersByTitles(titles) {
    titles.forEach((title) => findElementByTitle(title)?.remove());
}

function removeAds() {
    if (!isItemParamsVisible()) {
        findElementByTitle('Opinie o produkcie')?.parentElement?.parentElement?.parentElement?.parentElement?.parentElement?.parentElement?.parentElement?.remove();
    }
    removeContainersByTitles(['Opinie o produkcie', 'Inni klienci oglądali również', 'Zbuduj swój zestaw', 'Propozycje z gwarancją najniższej ceny', 'Co powiesz na...?', 'Zamów zestaw w jednej przesyłce', 'Zamów w jednej przesyłce', 'Nowości', 'Nasze serie produktów', 'Okazje cenowe dla Ciebie',  'Propozycje dla Ciebie']);
    document.querySelectorAll('div[data-box-name="template-with-offers"]').forEach((el) => el.remove());
    document.querySelector('div[data-box-name="Container carousel_reco_same_seller"]')?.remove();
    document.querySelector('div[data-box-name="Product Series Title"]')?.parentElement?.remove();
    document.querySelectorAll('img[alt="Reklama banerowa"]').forEach((el) => el?.parentElement?.parentElement?.parentElement?.remove());
    document.querySelectorAll('div[aria-labelledby="P0-0"]').forEach(el => el?.parentElement?.remove())
}

async function restoreOldLook() {
    if (!isItemParamsVisible()) {
        await moveItemParams();
        moveProductDescription();
        removeMovedContainers();
    }
    removeAds();
    setInterval(() => removeAds(), 1000);
}

function isOutdatedItemPage() {
    return [...document.querySelectorAll('h6')].filter(el => el.textContent === 'Sprzedaż zakończona').length > 0
}

function isItemParamsVisible() {
    return document.querySelectorAll('div[data-box-name="Container Parameters Card"]').length > 0
}

(async () => {
    if (location.hostname !== "allegro.pl" || (!location.pathname.startsWith("/produkt/") && !location.pathname.startsWith("/oferta/"))) {
        return;
    }

    const enabled = await isEnabled();
    if (!enabled) {
        return;
    }
    if (!isOutdatedItemPage()) {
        restoreOldLook();
    }
})();



