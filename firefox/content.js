function findElementByTagNameAndText(tagName, text) {
    const el = [...document.getElementsByTagName(tagName)]
        .find((candidate) => candidate?.textContent?.startsWith(text));
    return el?.parentElement;
}

function isEnabled() {
    if (typeof browser !== "undefined" && browser?.storage?.local) {
        return browser.storage.local.get("enabled")
            .then((result) => result.enabled !== false)
            .catch(() => true);
    }

    return new Promise((resolve) => {
        if (typeof chrome === "undefined" || !chrome?.storage?.local) {
            resolve(true);
            return;
        }
        chrome.storage.local.get("enabled", (result) => {
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
    table.style.fontSize = "18px";
    table.style.lineHeight = "1.4";
    table.style.margin = "12px 0";
    table.style.background = "#fff";

    items.forEach((item) => {
        const tr = document.createElement("tr");

        const tdName = document.createElement("td");
        tdName.textContent = item.name;
        tdName.style.border = "1px solid #ddd";
        tdName.style.padding = "8px 10px";
        tdName.style.verticalAlign = "top";
        tdName.style.fontWeight = "500";
        tdName.style.width = "35%";
        tdName.style.background = "#f7f7f7";

        const tdValue = document.createElement("td");
        tdValue.style.border = "1px solid #ddd";
        tdValue.style.padding = "8px 10px";
        tdValue.style.verticalAlign = "top";
        tdValue.style.fontWeight = "600";

        if (item.url) {
            const a = document.createElement("a");
            a.textContent = item.value;
            a.href = item.url;
            a.target = "_blank";
            a.rel = "noopener noreferrer";
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
        table.appendChild(tr);
    });

    table.style.fontFamily = "Calibri Light, Arial, sans-serif";
    return table;
}

function buildHeader(text) {
    const header = document.createElement("h2");
    header.textContent = text;
    header.style.fontFamily = "Calibri, Arial, sans-serif";
    header.style.fontSize = "1.9em";
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

function removeCommercialContainers() {
    findElementByTitle("Opinie o produkcie")?.parentElement?.parentElement?.parentElement?.parentElement?.parentElement?.parentElement?.parentElement?.remove();
    removeContainersByTitles(['Opinie o produkcie', 'Inni klienci oglądali również', 'Zbuduj swój zestaw', 'Propozycje z gwarancją najniższej ceny', 'Co powiesz na...?', 'Zamów zestaw w jednej przesyłce', 'Zamów w jednej przesyłce', 'Nowości'])
    document.querySelectorAll('div[data-box-name="template-with-offers"]').forEach((el) => el.remove());
}

async function restoreOldLook() {
    await moveItemParams();
    moveProductDescription();
    removeMovedContainers();
    removeCommercialContainers();
    setInterval(() => removeCommercialContainers(), 1000);
}

(async () => {
    if (location.hostname !== "allegro.pl" || !location.pathname.startsWith("/produkt/")) {
        return;
    }

    const enabled = await isEnabled();
    if (!enabled) return;

    restoreOldLook();
})();
