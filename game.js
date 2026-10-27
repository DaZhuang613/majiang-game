/**
 * 麻将消除游戏 - 网页版
 * 逻辑完全移植自 Java 桌面版
 */

// ==================== 常量 ====================
const SUIT_NAMES = ["万", "条", "筒"];
const ZI_NAMES = ["东", "南", "西", "北", "中", "白","发"];
const IMAGE_DIR = "images";

// ==================== 游戏状态 ====================
let luckyNumber = 0;
let drawCount = 0;
let totalDrawn = 0;
let roundCount = 0;
// 清台次数（消除瞬间手牌与癞子同时清空，触发重新发牌）
let clearTableCount = 0;

// 癞子模式：字牌（东南西北中白发）当癞子使用。
// 规则：不产生奖励牌；必须搭配数字牌一起打出；单次消除最多使用 1 张。
let isJokerMode = false;
// 本局是否已结束（结束后癞子不再可点选）
let isGameOver = false;

// counts[suit][number]  suit:0=万,1=条,2=筒  number:1-9
let counts = Array.from({length: 3}, () => new Array(10).fill(0));

// 第1排
let topZi = {};      // { ziName: count }
let topLucky = {};   // { key: count }

// 全局统计
let drawnCounts = Array.from({length: 3}, () => new Array(10).fill(0));
let drawnZi = new Array(7).fill(0);

// 交互状态
let selectedCounts = {}; // { key: 选中张数 }
let isManualMode = false;
let currentCombos = [];
let currentMaxReward = 0;
let bestCombos = [];

// 第一排手动结算
let isSettlingTopRow = false;
let selectedTopZi = new Set();
let selectedTopLucky = new Set();

// 癞子模式下当前选中的字牌（单选，单次最多用 1 张）
let selectedJoker = "";

// 日志
let gameLog = [];

// ==================== DOM 引用 ====================
const scoreEl = document.getElementById("score");
const handCountEl = document.getElementById("hand-count");
const logContentEl = document.getElementById("log-content");
const msgBarEl = document.getElementById("msg-bar");
const comboHintEl = document.getElementById("combo-hint");
const topRowTitleEl = document.getElementById("top-row-title");
const topRowEl = document.getElementById("top-row");
const submitBtn = document.getElementById("submit-btn");
const newGameBtn = document.getElementById("new-game-btn");
const modalOverlay = document.getElementById("modal-overlay");
const modalTitle = document.getElementById("modal-title");
const modalContent = document.getElementById("modal-content");
const modalButtons = document.getElementById("modal-buttons");
const setupOverlay = document.getElementById("setup-overlay");
const rulesOverlay = document.getElementById("rules-overlay");
const rulesCloseBtn = document.getElementById("rules-close-btn");

// ==================== 初始化 ====================
function init() {
    // 创建下面3排的牌
    for (let s = 0; s < 3; s++) {
        const rowEl = document.getElementById("row-" + s);
        for (let n = 1; n <= 9; n++) {
            const key = keyFor(s, n);
            const tile = document.createElement("div");
            tile.className = "tile hidden";
            tile.dataset.key = key;
            tile.dataset.suit = s;
            tile.dataset.number = n;
            tile.innerHTML = `
                <img src="${IMAGE_DIR}/${imageName(s, n)}" alt="${n}${SUIT_NAMES[s]}" onerror="this.style.display='none';this.nextElementSibling.style.display='block';">
                <div class="tile-text" style="display:none">${n}${SUIT_NAMES[s]}</div>
                <div class="count-badge"></div>
            `;
            tile.addEventListener("click", () => onTileClicked(key));
            rowEl.appendChild(tile);
        }
    }

    document.getElementById("start-btn").addEventListener("click", onStartClick);
    submitBtn.addEventListener("click", onSubmit);
    newGameBtn.addEventListener("click", () => showSetupDialog());
    document.getElementById("rules-btn").addEventListener("click", showRules);
    rulesCloseBtn.addEventListener("click", hideRules);

    showSetupDialog();
}

function imageName(suit, number) {
    if (suit === 0) return "wan" + number + ".png";
    if (suit === 1) return "tiao" + number + ".png";
    return "tong" + number + ".png";
}

function ziImageName(ziName) {
    const map = { "东": "dong.png", "南": "nan.png", "西": "xi.png", "北": "bei.png", "中": "zhong.png", "白": "bai.png" , "发": "fa.png"};
    return map[ziName] || "";
}

// ==================== 核心工具 ====================
function keyFor(suit, number) {
    const prefix = suit === 0 ? "wan" : (suit === 1 ? "tiao" : "tong");
    return prefix + "_" + number;
}

function suitFromKey(key) {
    if (key.startsWith("wan")) return 0;
    if (key.startsWith("tiao")) return 1;
    if (key.startsWith("tong")) return 2;
    return -1;
}

function numberFromKey(key) {
    const idx = key.lastIndexOf("_");
    if (idx < 0) return -1;
    return parseInt(key.substring(idx + 1), 10);
}

function getCount(key) {
    const s = suitFromKey(key);
    const n = numberFromKey(key);
    if (s >= 0 && n >= 1 && n <= 9) return counts[s][n];
    return 0;
}

function log(msg) {
    gameLog.push(msg);
    const line = document.createElement("div");
    line.textContent = msg;
    logContentEl.appendChild(line);
    logContentEl.scrollTop = logContentEl.scrollHeight;
}

// ==================== 游戏启动 ====================
function showSetupDialog() {
    setupOverlay.classList.remove("hidden");
}

function onStartClick() {
    const drawVal = parseInt(document.getElementById("draw-input").value, 10);
    const luckyVal = parseInt(document.getElementById("lucky-input").value, 10);
    if (isNaN(drawVal) || drawVal <= 0 || isNaN(luckyVal) || luckyVal < 1 || luckyVal > 9) {
        showModal("错误", "输入错误！拆牌数必须是正整数，幸运数字必须是1-9。", [{text: "确定", action: () => {}}]);
        return;
    }
    drawCount = drawVal;
    luckyNumber = luckyVal;
    isJokerMode = document.getElementById("joker-input").checked;
    setupOverlay.classList.add("hidden");
    resetGame();
    startGame();
}

function resetGame() {
    counts = Array.from({length: 3}, () => new Array(10).fill(0));
    topZi = {};
    topLucky = {};
    totalDrawn = 0;
    roundCount = 0;
    clearTableCount = 0;
    selectedCounts = {};
    isManualMode = false;
    currentCombos = [];
    bestCombos = [];
    isSettlingTopRow = false;
    selectedTopZi.clear();
    selectedTopLucky.clear();
    selectedJoker = "";
    isGameOver = false;
    gameLog = [];
    drawnCounts = Array.from({length: 3}, () => new Array(10).fill(0));
    drawnZi = new Array(7).fill(0);
    logContentEl.innerHTML = "";
    newGameBtn.style.display = "none";
    submitBtn.disabled = true;
    refreshUI();
}

function startGame() {
    const now = new Date();
    const timeStr = now.getFullYear() + "-" + pad(now.getMonth()+1) + "-" + pad(now.getDate()) + " " + pad(now.getHours()) + ":" + pad(now.getMinutes()) + ":" + pad(now.getSeconds());
    gameLog.push("========== 麻将消除游戏日志 ==========");
    gameLog.push("开始时间：" + timeStr);
    gameLog.push("玩法模式：" + (isJokerMode ? "癞子模式（字牌当癞子）" : "经典模式"));
    gameLog.push("拆牌数：" + drawCount);
    gameLog.push("幸运数字：" + luckyNumber);
    gameLog.push("");
    gameLog.push("===== 初始发牌 =====");

    log("===== 游戏开始 =====");
    log("玩法模式：" + (isJokerMode ? "癞子模式" : "经典模式") + "，拆牌数：" + drawCount + "，幸运数字：" + luckyNumber);
    topRowTitleEl.textContent = (isJokerMode ? "癞子 / 幸运牌" : "幸运牌 / 字牌") + "（幸运数字：" + luckyNumber + "）";
    msgBarEl.textContent = "初始发牌 " + drawCount + " 张，幸运数字：" + luckyNumber;

    for (let i = 0; i < drawCount; i++) {
        const card = drawCard();
        log("初始摸牌：" + rewardDesc(card));
        placeCardToRow(card);
    }

    // 开局保护：初始发的牌若一张数字牌都没有（全都摸到了字牌），补摸到有数字牌为止，
    // 否则玩家一步未走就因「手牌为空」被判负。
    let topUpGuard = 0;
    while (countHandTiles() === 0 && topUpGuard++ < 100) {
        const card = drawCard();
        log("开局补发：" + rewardDesc(card));
        placeCardToRow(card);
    }
    refreshUI();

    settleTopRow().then(() => {
        if (isSettlingTopRow) return;
        // 统一走 playRound 的牌型枚举判定，不再按模式分支
        checkHandEmptyAndContinue();
    });
}

function pad(n) { return n < 10 ? "0" + n : n; }

// ==================== 牌库与发牌 ====================
function drawCard() {
    totalDrawn++;
    const type = Math.floor(Math.random() * 34);
    const card = { suit: 0, number: 0, lucky: false, ziName: "" };
    if (type < 27) {
        card.suit = Math.floor(type / 9);
        card.number = (type % 9) + 1;
    } else {
        card.suit = 3;
        card.number = type - 27 + 1;
        card.ziName = ZI_NAMES[card.number - 1];
    }
    card.lucky = (card.suit !== 3 && card.number === luckyNumber);
    if (card.suit === 3) {
        drawnZi[card.number - 1]++;
    } else {
        drawnCounts[card.suit][card.number]++;
    }
    return card;
}

function rewardDesc(card) {
    if (card.suit === 3) return card.ziName;
    return card.number + SUIT_NAMES[card.suit] + (card.lucky ? "(幸)" : "");
}

function placeCardToRow(card) {
    if (card.suit === 3) {
        topZi[card.ziName] = (topZi[card.ziName] || 0) + 1;
    } else if (card.lucky) {
        const key = keyFor(card.suit, card.number);
        topLucky[key] = (topLucky[key] || 0) + 1;
    } else {
        counts[card.suit][card.number]++;
    }
}

// 第一排可用的癞子总数（癞子模式下字牌即癞子）
function jokerTotal() {
    let t = 0;
    for (const c of Object.values(topZi)) t += c;
    return t;
}

// ==================== 第1排结算 ====================
function settleTopRow() {
    // 癞子模式：字牌留在第一排当癞子用，不参与结算、也不阻塞流程
    const hasZi = isJokerMode ? false : Object.values(topZi).some(c => c > 0);
    const hasLucky = Object.keys(topLucky).length > 0;
    if (!hasZi && !hasLucky) {
        return Promise.resolve();
    }

    // 进入手动结算模式，不再弹框
    isSettlingTopRow = true;
    selectedCounts = {};
    submitBtn.disabled = false;

    let hint = "第一排有待结算的牌：";
    if (hasZi) {
        hint += " 字牌";
        for (const [zi, cnt] of Object.entries(topZi)) {
            if (cnt > 0) hint += " " + zi + "x" + cnt;
        }
    }
    if (hasLucky) {
        hint += " 幸运牌";
        for (const [key, cnt] of Object.entries(topLucky)) {
            if (cnt > 0) {
                const s = suitFromKey(key);
                const n = numberFromKey(key);
                hint += " " + n + SUIT_NAMES[s] + "x" + cnt;
            }
        }
    }
    hint += "，请点击选中后提交结算";
    if (isJokerMode) {
        hint += "（癞子不参与结算、不发奖励，可随时点选）";
    }
    msgBarEl.textContent = hint;
    comboHintEl.innerHTML = "";
    refreshUI();
    return Promise.resolve();
}

// ==================== UI 刷新 ====================
function refreshUI() {
    scoreEl.textContent = "分数（累计发牌）：" + totalDrawn;

    let handCount = 0;
    for (let s = 0; s < 3; s++) {
        for (let n = 1; n <= 9; n++) {
            handCount += counts[s][n];
        }
    }
    if (isJokerMode) {
        handCountEl.textContent = "手牌：" + handCount + " 张 ｜ 癞子：" + jokerTotal() + " 张";
    } else {
        handCountEl.textContent = "手牌：" + handCount + " 张";
    }

    // 下面3排
    for (let s = 0; s < 3; s++) {
        for (let n = 1; n <= 9; n++) {
            const cnt = counts[s][n];
            const key = keyFor(s, n);
            const tile = document.querySelector(`.tile[data-key="${key}"]`);
            if (!tile) continue;
            const badge = tile.querySelector(".count-badge");
            badge.textContent = cnt > 1 ? "x" + cnt : "";
            tile.classList.toggle("hidden", cnt <= 0);
            tile.classList.toggle("disabled", cnt <= 0);
            tile.classList.remove("selected", "highlight");
        }
    }

    // 第一排
    topRowEl.innerHTML = "";
    for (const [ziName, cnt] of Object.entries(topZi)) {
        if (cnt <= 0) continue;
        const ziSelected = isJokerMode ? (selectedJoker === ziName) : selectedTopZi.has(ziName);
        let cls = "top-tile";
        if (isJokerMode) cls += " joker";
        if (ziSelected) cls += " selected";
        const div = document.createElement("div");
        div.className = cls;
        if (isJokerMode) {
            // 癞子随时可点选：即使第一排有幸运牌待结算也不锁死，
            // 选中的癞子会一直保留到真正打出为止
            if (!isGameOver) {
                div.style.cursor = "pointer";
                div.onclick = () => onJokerClicked(ziName);
            }
        } else if (isSettlingTopRow) {
            div.style.cursor = "pointer";
            div.onclick = () => onTopZiClicked(ziName);
        }
        div.innerHTML = `
            <img src="${IMAGE_DIR}/${ziImageName(ziName)}" alt="${ziName}" onerror="this.style.display='none';this.nextElementSibling.style.display='block';">
            <div class="tile-text" style="display:none">${ziName}</div>
            ${cnt > 1 ? `<div class="count-badge">x${cnt}</div>` : ""}
        `;
        topRowEl.appendChild(div);
    }
    for (const [key, cnt] of Object.entries(topLucky)) {
        if (cnt <= 0) continue;
        const s = suitFromKey(key);
        const n = numberFromKey(key);
        const name = n + SUIT_NAMES[s] + "(幸)";
        const div = document.createElement("div");
        div.className = "top-tile lucky" + (selectedTopLucky.has(key) ? " selected" : "");
        if (isSettlingTopRow) {
            div.style.cursor = "pointer";
            div.onclick = () => onTopLuckyClicked(key);
        }
        div.innerHTML = `
            <img src="${IMAGE_DIR}/${imageName(s, n)}" alt="${name}" onerror="this.style.display='none';this.nextElementSibling.style.display='block';">
            <div class="tile-text" style="display:none">${name}</div>
            ${cnt > 1 ? `<div class="count-badge">x${cnt}</div>` : ""}
        `;
        topRowEl.appendChild(div);
    }

    // 清理无效选中
    for (const key of Object.keys(selectedCounts)) {
        if (getCount(key) <= 0) delete selectedCounts[key];
    }
    if (selectedJoker && !(topZi[selectedJoker] > 0)) selectedJoker = "";
    updateSelectionBorder();
}

// ==================== 点击交互 ====================
function onTileClicked(key) {
    if (isSettlingTopRow) return;
    if (!isManualMode) return;
    const handCount = getCount(key);
    if (handCount <= 0) return;

    const current = selectedCounts[key] || 0;
    if (current >= handCount) {
        delete selectedCounts[key];
    } else {
        selectedCounts[key] = current + 1;
    }
    updateSelectionBorder();
}

function updateSelectionBorder() {
    document.querySelectorAll(".tile").forEach(t => {
        t.classList.remove("selected");
        const sb = t.querySelector(".select-badge");
        if (sb) sb.remove();
    });
    for (const [key, count] of Object.entries(selectedCounts)) {
        const tile = document.querySelector(`.tile[data-key="${key}"]`);
        if (tile) {
            tile.classList.add("selected");
            if (count > 1) {
                let sb = tile.querySelector(".select-badge");
                if (!sb) {
                    sb = document.createElement("div");
                    sb.className = "select-badge";
                    tile.appendChild(sb);
                }
                sb.textContent = "选x" + count;
            }
        }
    }
}

function onTopZiClicked(ziName) {
    if (!isSettlingTopRow) return;
    if (selectedTopZi.has(ziName)) {
        selectedTopZi.delete(ziName);
    } else {
        selectedTopZi.add(ziName);
    }
    refreshUI();
}

function onTopLuckyClicked(key) {
    if (!isSettlingTopRow) return;
    if (selectedTopLucky.has(key)) {
        selectedTopLucky.delete(key);
    } else {
        selectedTopLucky.add(key);
    }
    refreshUI();
}

// 癞子模式下点选/取消第一排的癞子（单次最多 1 张，点击另一张会自动替换）
function onJokerClicked(ziName) {
    if (!isJokerMode || isGameOver) return;
    if (selectedJoker === ziName) {
        selectedJoker = "";
    } else {
        selectedJoker = ziName;
        // 结算幸运牌阶段也能预选癞子，这里只提示、不改动结算流程
        if (isSettlingTopRow) {
            msgBarEl.textContent = "已选中癞子「" + ziName + "」，先结算幸运牌，随后用它与数字牌组成牌型打出";
        }
    }
    refreshUI();
}

function highlightCombo(combo) {
    clearHighlight();
    for (const key of combo.keys) {
        const tile = document.querySelector(`.tile[data-key="${key}"]`);
        if (tile) tile.classList.add("highlight");
    }
}

function clearHighlight() {
    document.querySelectorAll(".tile").forEach(t => t.classList.remove("highlight"));
}

// ==================== 消除逻辑 ====================
// joker=true 表示该组合需要用 1 张癞子补位（keys/need 只描述数字牌部分）
function Combo(reward, keys, need, desc, joker) {
    this.reward = reward;
    this.keys = keys;
    this.need = need;
    this.desc = desc;
    this.joker = !!joker;
}

function findAllCombos() {
    const list = [];

    // 奖励7：一条龙 1-9 同花色
    for (let s = 0; s < 3; s++) {
        let ok = true;
        const ks = [];
        for (let n = 1; n <= 9; n++) {
            if (counts[s][n] < 1) { ok = false; break; }
            ks.push(keyFor(s, n));
        }
        if (ok) list.push(new Combo(7, ks, [1,1,1,1,1,1,1,1,1], SUIT_NAMES[s] + "1-9一条龙，奖励7张"));
    }

    // 同花色同数字：3张奖励2张，4张及以上n张奖励n张（封顶7张）
    for (let s = 0; s < 3; s++) {
        for (let n = 1; n <= 9; n++) {
            const c = counts[s][n];
            const k = keyFor(s, n);
            if (c >= 3) list.push(new Combo(2, [k], [3], n + SUIT_NAMES[s] + " x3，奖励2张"));
            for (let need = 4; need <= c; need++) {
                const reward = Math.min(need, 7);
                list.push(new Combo(reward, [k], [need], n + SUIT_NAMES[s] + " x" + need + "，奖励" + reward + "张"));
            }
        }
    }

    // 奖励2：同花色顺子3张
    for (let s = 0; s < 3; s++) {
        for (let start = 1; start <= 7; start++) {
            if (counts[s][start] >= 1 && counts[s][start+1] >= 1 && counts[s][start+2] >= 1) {
                const ks = [keyFor(s, start), keyFor(s, start+1), keyFor(s, start+2)];
                list.push(new Combo(2, ks, [1,1,1], SUIT_NAMES[s] + start + "-" + (start+2) + "顺子，奖励2张"));
            }
        }
    }

    // 数字牌列表
    const numKeys = [];
    for (let s = 0; s < 3; s++) {
        for (let n = 1; n <= 9; n++) {
            if (counts[s][n] >= 1) numKeys.push(keyFor(s, n));
        }
    }

    // 奖励1：2张和为10
    let hasTwoSum10 = false;
    for (let i = 0; i < numKeys.length; i++) {
        for (let j = i + 1; j < numKeys.length; j++) {
            const a = numKeys[i];
            const b = numKeys[j];
            if (numberFromKey(a) + numberFromKey(b) === 10) {
                list.push(new Combo(1, [a, b], [1,1], numberFromKey(a) + " + " + numberFromKey(b) + " = 10，奖励1张"));
                hasTwoSum10 = true;
            }
        }
    }

    // 同一key两张凑10（仅5+5）
    for (const key of numKeys) {
        const n = numberFromKey(key);
        if (n === 5 && getCount(key) >= 2) {
            list.push(new Combo(1, [key, key], [1,1], n + " + " + n + " = 10，奖励1张"));
            hasTwoSum10 = true;
        }
    }

    // 奖励1：3张和为10（仅当没有2张和为10时）
    if (!hasTwoSum10) {
        for (let i = 0; i < numKeys.length; i++) {
            for (let j = i + 1; j < numKeys.length; j++) {
                for (let k = j + 1; k < numKeys.length; k++) {
                    const a = numKeys[i];
                    const b = numKeys[j];
                    const c = numKeys[k];
                    if (numberFromKey(a) + numberFromKey(b) + numberFromKey(c) === 10) {
                        list.push(new Combo(1, [a, b, c], [1,1,1], numberFromKey(a) + " + " + numberFromKey(b) + " + " + numberFromKey(c) + " = 10，奖励1张"));
                    }
                }
            }
        }
    }

    return list;
}

// ==================== 癞子模式：牌型枚举 ====================
// 规则要点：
//   1. 单次消除最多使用 1 张癞子；
//   2. 癞子不能单独打出，必须搭配数字牌；
//   3. 癞子计入张数，奖励按原规则计算（同数字 3 张→2 张，4~7 张→n 张，≥8 张→7 张）。
function findAllCombosWithJoker() {
    // 不含癞子的常规组合照旧
    const list = findAllCombos();
    if (jokerTotal() <= 0) return list;

    // 1) 一条龙：9 个数字位齐全、只缺 1 位 → 癞子补缺
    for (let s = 0; s < 3; s++) {
        const ks = [];
        const missing = [];
        for (let n = 1; n <= 9; n++) {
            if (counts[s][n] >= 1) ks.push(keyFor(s, n));
            else missing.push(n);
        }
        if (missing.length === 1) {
            list.push(new Combo(7, ks, ks.map(() => 1),
                SUIT_NAMES[s] + "1-9一条龙（癞子当" + missing[0] + SUIT_NAMES[s] + "），奖励7张", true));
        }
    }

    // 2) 同花色同数字：use 张 + 1 张癞子
    for (let s = 0; s < 3; s++) {
        for (let n = 1; n <= 9; n++) {
            const c = counts[s][n];
            if (c < 2) continue;
            const k = keyFor(s, n);
            const seenReward = new Set(); // 同一档奖励只保留最省牌的方案，避免提示刷屏
            for (let use = 2; use <= c; use++) {
                const total = use + 1;
                const reward = total === 3 ? 2 : Math.min(total, 7);
                if (seenReward.has(reward)) continue;
                seenReward.add(reward);
                list.push(new Combo(reward, [k], [use],
                    n + SUIT_NAMES[s] + " x" + use + " + 癞子 = " + total + "张，奖励" + reward + "张", true));
            }
        }
    }

    // 3) 顺子：同花色连续 3 张中缺 1 张 → 癞子补位
    for (let s = 0; s < 3; s++) {
        for (let start = 1; start <= 7; start++) {
            const ks = [];
            const need = [];
            const missing = [];
            for (let i = 0; i < 3; i++) {
                const n = start + i;
                if (counts[s][n] >= 1) {
                    ks.push(keyFor(s, n));
                    need.push(1);
                } else {
                    missing.push(n);
                }
            }
            if (missing.length === 1) {
                list.push(new Combo(2, ks, need,
                    SUIT_NAMES[s] + start + "-" + (start + 2) + "顺子（癞子当" + missing[0] + SUIT_NAMES[s] + "），奖励2张", true));
            }
        }
    }

    // 4) 两张合 10：1 张数字牌 + 癞子（可跨花色，癞子当 10-n 点）
    const numKeys = [];
    for (let s = 0; s < 3; s++) {
        for (let n = 1; n <= 9; n++) {
            if (counts[s][n] >= 1) numKeys.push(keyFor(s, n));
        }
    }
    for (const key of numKeys) {
        const s = suitFromKey(key);
        const n = numberFromKey(key);
        list.push(new Combo(1, [key], [1],
            n + SUIT_NAMES[s] + " + 癞子当" + (10 - n) + " = 10，奖励1张", true));
    }

    // 注：三张合 10 的癞子版不单独生成。
    // 因为有癞子时「1 张数字牌 + 癞子」必然能凑 10，按原规则「两张合 10 优先于三张合 10」，
    // 三张合 10 不会再作为可选牌型出现。

    return list;
}

// ==================== 回合控制 ====================
function playRound() {
    currentCombos = isJokerMode ? findAllCombosWithJoker() : findAllCombos();
    if (currentCombos.length === 0) {
        gameOver();
        return;
    }

    roundCount++;
    gameLog.push("");
    gameLog.push("----- 第 " + roundCount + " 轮 -----");
    gameLog.push("手牌状态：" + formatHandState());

    currentMaxReward = Math.max(...currentCombos.map(c => c.reward));
    bestCombos = currentCombos.filter(c => c.reward === currentMaxReward);

    const comboSb = "可消除组合：" + bestCombos.map(c => c.desc).join("；");
    gameLog.push(comboSb);

    // 统一进入手动模式，不再自动弹框
    isManualMode = true;
    selectedCounts = {};
    updateSelectionBorder();
    submitBtn.disabled = false;
    msgBarEl.textContent = isJokerMode
        ? "请选择牌型后提交（最高奖励 " + currentMaxReward + " 张，可搭配 1 张癞子）"
        : "请手动选择牌型后点击提交（当前最高奖励 " + currentMaxReward + " 张）";
    updateComboHint(bestCombos);
}

function updateComboHint(combos) {
    const MAX_SHOW = 12;
    let html = '<div class="hint-title">可消除牌型（奖励 ' + currentMaxReward + ' 张）：</div>';
    for (const combo of combos.slice(0, MAX_SHOW)) {
        html += '<span class="hint-item">' + combo.desc + '</span>';
    }
    if (combos.length > MAX_SHOW) {
        html += '<span class="hint-item">…等共 ' + combos.length + ' 种</span>';
    }
    comboHintEl.innerHTML = html;
}

function formatHandState() {
    let sb = "";
    for (let s = 0; s < 3; s++) {
        sb += SUIT_NAMES[s] + "[";
        let first = true;
        for (let n = 1; n <= 9; n++) {
            if (counts[s][n] > 0) {
                if (!first) sb += ",";
                sb += n + "x" + counts[s][n];
                first = false;
            }
        }
        sb += "] ";
    }
    return sb;
}

function onSubmit() {
    if (isSettlingTopRow) {
        if (selectedTopZi.size === 0 && selectedTopLucky.size === 0) {
            showModal("提示", isJokerMode
                ? "请先选中第一排的幸运牌进行结算！（癞子不参与结算，已选中的癞子会保留）"
                : "请先选中第一排的字牌或幸运牌进行结算！",
                [{text: "确定", action: () => {}}]);
            return;
        }
        executeTopRowSettlement();
        return;
    }

    const hasAnySelection = Object.keys(selectedCounts).length > 0 || (isJokerMode && selectedJoker !== "");
    if (!isManualMode || !hasAnySelection) {
        showModal("提示", "请先点击选择要消除的牌！", [{text: "确定", action: () => {}}]);
        return;
    }

    let matched = null;
    for (const combo of bestCombos) {
        if (matchesSelection(combo)) {
            matched = combo;
            break;
        }
    }

    if (!matched) {
        let tip = "选择不合法！\n当前最高奖励级别为 " + currentMaxReward + " 张，\n您的选择不符合任何可用组合，请重新选择。";
        if (isJokerMode) {
            tip += "\n\n癞子规则：每次消除最多用 1 张，且必须与数字牌组成牌型一起打出，不能单独使用。";
        }
        showModal("非法选择", tip,
            [{text: "确定", action: () => {
                selectedCounts = {};
                selectedJoker = "";
                refreshUI();
            }}]
        );
        return;
    }

    executeElimination(matched);
}

function executeTopRowSettlement() {
    // 结算选中的字牌（癞子模式下字牌不发奖励，直接跳过）
    if (!isJokerMode) {
        for (const ziName of Array.from(selectedTopZi)) {
            const cnt = topZi[ziName] || 0;
            if (cnt > 0) {
                delete topZi[ziName];
                log("手动结算字牌：" + ziName + " x" + cnt + "，奖励 " + cnt + " 张");
                for (let i = 0; i < cnt; i++) {
                    const reward = drawCard();
                    log("  字牌奖励牌：" + rewardDesc(reward));
                    placeCardToRow(reward);
                }
            }
        }
    }

    // 结算选中的幸运牌
    for (const key of Array.from(selectedTopLucky)) {
        const cnt = topLucky[key] || 0;
        if (cnt > 0) {
            delete topLucky[key];
            const s = suitFromKey(key);
            const n = numberFromKey(key);
            const name = n + SUIT_NAMES[s];
            log("手动结算幸运牌：" + name + " x" + cnt + "，奖励 " + cnt + " 张，并移到手牌区");
            const luckyRewards = [];
            for (let i = 0; i < cnt; i++) {
                luckyRewards.push(drawCard());
            }
            for (const reward of luckyRewards) {
                log("  幸运牌奖励牌：" + rewardDesc(reward));
                placeCardToRow(reward);
            }
            if (s >= 0 && n >= 0) {
                counts[s][n] += cnt;
            }
        }
    }

    selectedTopZi.clear();
    selectedTopLucky.clear();
    refreshUI();

    // 检查第一排是否还有牌
    const hasZi = isJokerMode ? false : Object.keys(topZi).length > 0;
    const hasLucky = Object.keys(topLucky).length > 0;
    if (hasZi || hasLucky) {
        msgBarEl.textContent = "第一排还有未结算的牌，请继续选中并提交";
    } else {
        isSettlingTopRow = false;
        submitBtn.disabled = true;
        checkHandEmptyAndContinue();
    }
}

// 统计手牌中的数字牌总数（不含第一排癞子）
function countHandTiles() {
    let n = 0;
    for (let s = 0; s < 3; s++) {
        for (let i = 1; i <= 9; i++) n += counts[s][i];
    }
    return n;
}

// 清台判定：手牌、癞子、待结算的幸运牌全都为 0，即整张牌桌被彻底清空
function isBoardCleared() {
    if (countHandTiles() > 0) return false;
    if (jokerTotal() > 0) return false;
    for (const c of Object.values(topLucky)) {
        if (c > 0) return false;
    }
    return true;
}

// 统一的结束判定入口：先确认牌桌是否彻底清空，其余一律交给 playRound 枚举牌型决定
function checkHandEmptyAndContinue() {
    // 兜底：手牌与癞子都被清空（正常由消除时的清台判定抢先处理，这里仅作保险）
    if (countHandTiles() === 0 && jokerTotal() === 0) {
        clearTableCount++;
        showModal("清台", "牌桌已清空，按初始设置重新发牌！", [
            { text: "重新发牌", action: () => { continueNextRound(); } }
        ]);
        return;
    }
    // 有牌但枚举不出任何牌型时，由 playRound 调用 gameOver，结束判定只有这一处出口
    setTimeout(() => playRound(), 200);
}

// 续开一轮：沿用当前模式与拆牌数重新发牌，累计分数与统计不清零
function continueNextRound() {
    isGameOver = false;
    isManualMode = false;
    isSettlingTopRow = false;
    selectedCounts = {};
    selectedJoker = "";
    selectedTopZi.clear();
    selectedTopLucky.clear();
    currentCombos = [];
    bestCombos = [];
    submitBtn.disabled = true;
    comboHintEl.innerHTML = "";

    log("===== 清台重开（第 " + clearTableCount + " 次）：按初始设置重新发牌 =====");
    for (let i = 0; i < drawCount; i++) {
        const card = drawCard();
        log("续发摸牌：" + rewardDesc(card));
        placeCardToRow(card);
    }

    // 同样需要开局保护，避免续发的一轮又是全字牌
    let topUpGuard = 0;
    while (countHandTiles() === 0 && topUpGuard++ < 100) {
        const card = drawCard();
        log("开局补发：" + rewardDesc(card));
        placeCardToRow(card);
    }
    refreshUI();

    settleTopRow().then(() => {
        if (isSettlingTopRow) return;
        checkHandEmptyAndContinue();
    });
}

function matchesSelection(combo) {
    const needJoker = combo.joker ? 1 : 0;
    let totalSelected = selectedJoker ? 1 : 0;
    for (const v of Object.values(selectedCounts)) totalSelected += v;

    const totalNeed = combo.need.reduce((a, b) => a + b, 0) + needJoker;
    if (totalSelected !== totalNeed) return false;

    // 癞子必须与牌型严格对应：需要癞子的组合必须选中 1 张，不需要的不能多选
    if (needJoker === 1 && !selectedJoker) return false;
    if (needJoker === 0 && selectedJoker) return false;

    const comboNeed = {};
    for (let i = 0; i < combo.keys.length; i++) {
        const key = combo.keys[i];
        comboNeed[key] = (comboNeed[key] || 0) + combo.need[i];
    }

    // 每个需要的key张数必须正好匹配，且不能多选其他牌
    for (const [key, need] of Object.entries(comboNeed)) {
        if ((selectedCounts[key] || 0) !== need) return false;
    }
    for (const [key, count] of Object.entries(selectedCounts)) {
        if (!comboNeed[key]) return false;
    }
    return true;
}

function executeElimination(combo) {
    log("消除：" + combo.desc);
    for (let i = 0; i < combo.keys.length; i++) {
        const key = combo.keys[i];
        const s = suitFromKey(key);
        const n = numberFromKey(key);
        if (s >= 0 && n >= 1 && n <= 9) {
            counts[s][n] -= combo.need[i];
            if (counts[s][n] < 0) counts[s][n] = 0;
        }
    }

    // 消耗 1 张癞子
    if (combo.joker && selectedJoker) {
        const left = (topZi[selectedJoker] || 0) - 1;
        if (left > 0) {
            topZi[selectedJoker] = left;
        } else {
            delete topZi[selectedJoker];
        }
        log("  消耗癞子：" + selectedJoker + "，第一排剩余癞子 " + jokerTotal() + " 张");
        selectedJoker = "";
    }

    selectedCounts = {};
    refreshUI();

    // 清台判定：消除完成、奖励牌尚未发放的这一刻，手牌与癞子已被同时吃光
    if (isBoardCleared()) {
        clearTableCount++;
        isManualMode = false;
        submitBtn.disabled = true;
        comboHintEl.innerHTML = "";
        log("★ 清台！手牌与癞子同时清空，本手奖励不再发放，按初始设置重新发牌");
        refreshUI();
        showModal("清台", "手牌与癞子同时清空，算作清台！\n本手奖励不再发放，直接按初始设置重新发牌（拆 " + drawCount + " 张，幸运数字 " + luckyNumber + " 不变）。", [
            { text: "重新发牌", action: () => { continueNextRound(); } }
        ]);
        return;
    }

    log("消除成功！" + combo.desc + "，获得奖励 " + combo.reward + " 张牌");
    log("发放奖励牌 " + combo.reward + " 张：");
    for (let i = 0; i < combo.reward; i++) {
        const c = drawCard();
        log("  奖励牌：" + rewardDesc(c));
        placeCardToRow(c);
    }
    refreshUI();

    settleTopRow().then(() => {
        if (isSettlingTopRow) {
            // 第一排还有牌需要手动结算，不继续playRound
            return;
        }
        checkHandEmptyAndContinue();
    });
}

function gameOver() {
    isManualMode = false;
    isGameOver = true;
    submitBtn.disabled = true;
    newGameBtn.style.display = "inline-block";
    msgBarEl.textContent = "游戏结束！";
    comboHintEl.innerHTML = "";
    const handLeft = countHandTiles();
    const handEmpty = handLeft === 0;
    log(handEmpty
        ? "===== 游戏结束（手牌已打空），最终分数：" + totalDrawn + " 张 ====="
        : "===== 游戏结束，最终分数：" + totalDrawn + " 张 =====");

    gameLog.push("");
    gameLog.push("===== 游戏统计 =====");
    gameLog.push("结束原因：" + (handEmpty ? "手牌已打空（数字牌为 0）" : "无可消除牌型"));
    gameLog.push("玩法模式：" + (isJokerMode ? "癞子模式" : "经典模式"));
    gameLog.push("清台次数：" + clearTableCount);
    gameLog.push("本轮游戏共摸牌 " + totalDrawn + " 张");
    gameLog.push("万：" + formatDrawnSuit(0));
    gameLog.push("条：" + formatDrawnSuit(1));
    gameLog.push("筒：" + formatDrawnSuit(2));
    gameLog.push("字：" + formatDrawnZi());

    const logText = gameLog.join("\n");
    const blob = new Blob([logText], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);

    const now = new Date();
    const fileFmt = "" + now.getFullYear() + pad(now.getMonth()+1) + pad(now.getDate()) + "_" + pad(now.getHours()) + pad(now.getMinutes()) + pad(now.getSeconds());
    const filename = fileFmt + "_" + totalDrawn + ".txt";

    let endMsg;
    if (handEmpty) {
        endMsg = "手牌已打空！\n";
        if (isJokerMode && jokerTotal() > 0) {
            endMsg += "第一排还剩 " + jokerTotal() + " 张癞子，但癞子必须搭配数字牌，无法单独消除。\n";
        }
        endMsg += "\n";
    } else {
        endMsg = "没有可消除的牌型了！\n";
    }
    endMsg += "您的最终分数（累计发牌）：" + totalDrawn + " 张\n" +
        (clearTableCount > 0 ? "清台重开：" + clearTableCount + " 次\n" : "") + "\n" +
        "万：" + formatDrawnSuit(0) + "\n" +
        "条：" + formatDrawnSuit(1) + "\n" +
        "筒：" + formatDrawnSuit(2) + "\n" +
        "字：" + formatDrawnZi();

    showModal("游戏结束", endMsg, [
            { text: "确定", action: () => { /* 只是关闭弹窗 */ } },
            { text: "下载日志", action: () => {
                    const a = document.createElement("a");
                    a.href = url;
                    a.download = filename;
                    a.click();
                }},
            { text: "再玩一次", action: () => { showSetupDialog(); } }
        ]
    );
}

function formatDrawnSuit(suit) {
    let sb = "";
    let hasAny = false;
    for (let n = 1; n <= 9; n++) {
        if (drawnCounts[suit][n] > 0) {
            if (hasAny) sb += "、";
            sb += drawnCounts[suit][n] + "张" + n + SUIT_NAMES[suit];
            hasAny = true;
        }
    }
    return hasAny ? sb : "无";
}

function formatDrawnZi() {
    let sb = "";
    let hasAny = false;
    for (let i = 0; i < 7; i++) {
        if (drawnZi[i] > 0) {
            if (hasAny) sb += "、";
            sb += drawnZi[i] + "张" + ZI_NAMES[i];
            hasAny = true;
        }
    }
    return hasAny ? sb : "无";
}

function showRules() {
    rulesOverlay.classList.remove("hidden");
}

function hideRules() {
    rulesOverlay.classList.add("hidden");
}

// ==================== 弹窗系统 ====================
function showModal(title, content, buttons) {
    modalTitle.textContent = title;
    modalContent.textContent = content;
    modalButtons.innerHTML = "";
    for (const btn of buttons) {
        const b = document.createElement("button");
        b.textContent = btn.text;
        if (btn.secondary) b.classList.add("secondary");
        b.addEventListener("click", () => {
            modalOverlay.classList.add("hidden");
            btn.action();
        });
        modalButtons.appendChild(b);
    }
    modalOverlay.classList.remove("hidden");
}

// ==================== 启动 ====================
window.addEventListener("DOMContentLoaded", init);
