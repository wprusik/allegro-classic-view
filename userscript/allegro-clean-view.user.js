// ==UserScript==
// @name         Allegro Clean View (UserScript)
// @namespace    https://github.com/wprusik/allegro-clean-view
// @version      1.2.1
// @description  Przywraca bardziej czytelny widok Allegro: parametry/opis oferty + usuwanie rekomendacji.
// @author       allegro-clean-view
// @homepageURL  https://github.com/wprusik/allegro-clean-view
// @supportURL   https://github.com/wprusik/allegro-clean-view/issues
// @updateURL    https://raw.githubusercontent.com/wprusik/allegro-clean-view/main/userscript/allegro-clean-view.user.js
// @downloadURL  https://raw.githubusercontent.com/wprusik/allegro-clean-view/main/userscript/allegro-clean-view.user.js
// @match        https://allegro.pl/produkt/*
// @match        https://allegro.pl/oferta/*
// @match        https://allegro.pl/koszyk
// @match        https://allegro.pl/moje-allegro/zakupy/obserwowane/*
// @run-at       document-idle
// @grant        none
// ==/UserScript==

(function () {
    "use strict";

    // ------------------------------------------------------------
    // Konfiguracja (zamiast panelu sterowania)
    // ------------------------------------------------------------
    const CONFIG = {
        pageSettings: {
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
        },
        productCleanupIntervalMs: 1000,
        favoritesCleanupIntervalMs: 1000
    };

    function normalizeProductSections(raw) {
        const defaults = CONFIG.pageSettings.productSections;
        return Object.keys(defaults).reduce((acc, key) => {
            acc[key] = raw?.[key] !== false;
            return acc;
        }, {});
    }

    function wait(ms) {
        return new Promise((resolve) => setTimeout(resolve, ms));
    }

    function findElementByTagNameAndText(tagName, text) {
        const el = [...document.getElementsByTagName(tagName)]
            .find((candidate) => candidate?.textContent?.startsWith(text));
        return el?.parentElement;
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
        await wait(200);

        const paramsModal = document.querySelector('div[aria-labelledby="Parametry"]');
        if (paramsModal?.parentElement?.parentElement) {
            paramsModal.parentElement.parentElement.hidden = true;
        }
        document.querySelector('a[href="#parametry"]')?.parentElement?.parentElement?.remove();

        await wait(500);
        document.querySelector('div[data-box-name="Sidebar Parameters Container"] button[aria-label="Zamknij"]')?.click();
    }

    function getItemDataTable() {
        const rawJson = [...document.querySelectorAll('script[type="application/json"]')]
            .map((el) => el.textContent || el.innerHTML || "")
            .find((text) =>
                text.includes('"dynamicBottomMargin"') ||
                text.includes('"keyParameters"') ||
                text.includes(':"Stan"')
            );

        if (!rawJson) return null;

        let parsed;
        try {
            parsed = JSON.parse(rawJson);
        } catch (error) {
            console.error("[Allegro Clean View] Nie udalo sie sparsowac JSON:", error);
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
                    name: "Popularn\u015b\u0107",
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

        if (!items.length) return null;

        const table = document.createElement("table");
        table.style.width = "100%";
        table.style.borderCollapse = "collapse";
        table.style.fontSize = ".875rem";
        table.style.lineHeight = "1.45";
        table.style.margin = "12px 0";
        table.style.background = "#fff";
        table.style.fontFamily = '"Open Sans", sans-serif';

        const appendParamCells = (tr, item, rowBg) => {
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
            const rowBg = i % 2 === 0 ? "#F6F7F8" : "#fff";
            appendParamCells(tr, items[i], rowBg);
            table.appendChild(tr);
        }

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
        let table = getItemDataTable();
        if (!table) {
            table = document.querySelector("div.app-container > table");
            if (table) table.hidden = false;
        }
        replaceContainerContent("Podobne oferty", [h2, table]);
        findElementByTagNameAndText("span", "Sponsorowane")?.parentElement?.remove();
    }

    function moveProductDescription() {
        const el = document.querySelector('div[data-box-name="Sidebar Description"]');
        replaceContainerContent("Propozycje dla Ciebie", [el]);
        document.querySelector('div[data-box-name="Product Description Bar"]')?.remove();
    }

    function removeMovedContainers() {
        document.querySelectorAll('a[name="product-info-content-columns"]')
            .forEach((el) => el.parentElement?.remove());
    }

    function removeContainersByTitles(titles) {
        titles.forEach((title) => findElementByTitle(title)?.remove());
    }

    function isItemParamsVisible() {
        return document.querySelectorAll('div[data-box-name="Container Parameters Card"]').length > 0;
    }

    function removeProductAds(sectionSettings) {
        const sections = normalizeProductSections(sectionSettings);

        if (!isItemParamsVisible()) {
            findElementByTitle("Opinie o produkcie")
                ?.parentElement?.parentElement?.parentElement?.parentElement
                ?.parentElement?.parentElement?.parentElement?.remove();
        }

        const titlesToRemove = [
            "Opinie o produkcie",
            "Co powiesz na...?"
        ];
        if (sections.othersAlsoViewed) titlesToRemove.push("Inni klienci ogl\u0105dali r\u00f3wnie\u017c");
        if (sections.buildYourSet) titlesToRemove.push("Zbuduj sw\u00f3j zestaw");
        if (sections.lowestPriceProposals) titlesToRemove.push("Propozycje z gwarancj\u0105 najni\u017cszej ceny");
        if (sections.singleShipmentSetOrder) titlesToRemove.push("Zam\u00f3w zestaw w jednej przesy\u0142ce");
        if (sections.singleShipmentOrder) titlesToRemove.push("Zam\u00f3w w jednej przesy\u0142ce");
        if (sections.newArrivals) titlesToRemove.push("Nowo\u015bci");
        if (sections.ourProductSeries) titlesToRemove.push("Nasze serie produkt\u00f3w");
        if (sections.priceDealsForYou) titlesToRemove.push("Okazje cenowe dla Ciebie");
        if (sections.proposalsForYou) titlesToRemove.push("Propozycje dla Ciebie");
        removeContainersByTitles(titlesToRemove);

        document.querySelectorAll('div[data-box-name="template-with-offers"]').forEach((el) => el.remove());
        if (sections.othersAlsoViewed) {
            document.querySelector('div[data-box-name="Container carousel_reco_same_seller"]')?.remove();
        }
        if (sections.ourProductSeries) {
            document.querySelector('div[data-box-name="Product Series Title"]')?.parentElement?.remove();
        }
        document.querySelectorAll('img[alt="Reklama banerowa"]')
            .forEach((el) => el?.parentElement?.parentElement?.parentElement?.remove());
        document.querySelectorAll('div[aria-labelledby="P0-0"]')
            .forEach((el) => el?.parentElement?.remove());
    }

    function isOutdatedItemPage() {
        return [...document.querySelectorAll("h6")]
            .some((el) => el.textContent === "Sprzeda\u017c zako\u0144czona");
    }

    async function runProductPage() {
        const sections = normalizeProductSections(CONFIG.pageSettings.productSections);
        const hasEnabledSection = Object.values(sections).some(Boolean);
        if (CONFIG.pageSettings.product === false || !hasEnabledSection) return;
        if (isOutdatedItemPage()) return;

        if (!isItemParamsVisible()) {
            await moveItemParams();
            if (sections.proposalsForYou) {
                moveProductDescription();
            }
            removeMovedContainers();
        }

        removeProductAds(sections);
        setInterval(() => removeProductAds(sections), CONFIG.productCleanupIntervalMs);
        removeContainersByTitles(["Podobne oferty"]);
    }

    function cleanCartSuggestions() {
        [...document.querySelectorAll('h4[data-role="replaceable-title"]')]
            .filter((el) => el.textContent?.startsWith("Dorzu\u0107 do przesy\u0142ki!"))
            .forEach((el) => el.parentElement?.parentElement?.remove());
    }

    function watchCartChanges() {
        if (!document.body || typeof MutationObserver === "undefined") return;
        const observer = new MutationObserver(cleanCartSuggestions);
        observer.observe(document.body, { childList: true, subtree: true });
    }

    function runCartPage() {
        if (CONFIG.pageSettings.cart === false) return;
        cleanCartSuggestions();
        watchCartChanges();
    }

    function cleanAISuggestions() {
        document.querySelectorAll('div[data-testid="partial-optimization-content"]')
            .forEach((el) => el.remove());
    }

    function removeFavoritesContainersByTitles(...titles) {
        titles.forEach((title) => findElementByTitle(title)?.remove());
    }

    function moveCombineItemsButton() {
        const btn = document.querySelector('button[data-analytics-interaction-label="combineShipments"]');
        if (!btn) return;

        btn.style.width = "17em";
        btn.style.height = "2em";
        btn.style.marginTop = "1em";

        const parent = document.querySelector('button[data-analytics-interaction-label="makeAList"]')?.parentElement;
        if (parent) parent.appendChild(btn);

        [...document.querySelectorAll('div[data-testid="optimizer-content"]')].forEach((el) => {
            el.childNodes?.forEach((child) => child.remove());
            el.style.margin = "10px 0";
        });
    }

    function runFavoritesPage() {
        if (CONFIG.pageSettings.favorites === false) return;

        const cleanup = () => {
            cleanAISuggestions();
            moveCombineItemsButton();
            removeFavoritesContainersByTitles(
                "Zainspirowane Twoimi ulubionymi",
                "Inni klienci kupuj\u0105 r\u00f3wnie\u017c"
            );
        };

        cleanup();
        setInterval(cleanup, CONFIG.favoritesCleanupIntervalMs);
    }

    const pathnameNoTrailingSlash = location.pathname.replace(/\/+$/, "");
    const isProductPage = location.pathname.startsWith("/produkt/") || location.pathname.startsWith("/oferta/");
    const isCartPage = location.pathname === "/koszyk";
    const isFavoritesPage = pathnameNoTrailingSlash === "/moje-allegro/zakupy/obserwowane/ulubione";

    if (location.hostname !== "allegro.pl") return;

    if (isProductPage) {
        runProductPage();
        return;
    }
    if (isCartPage) {
        runCartPage();
        return;
    }
    if (isFavoritesPage) {
        runFavoritesPage();
    }
})();
