/**
 * 麻将消除游戏 - 网页版
 * 逻辑完全移植自 Java 桌面版
 */

// ==================== 常量 ====================
const SUIT_NAMES = ["万", "条", "筒"];
const ZI_NAMES = ["东", "南", "西", "北", "中", "白"];
const IMAGE_DIR = "images";

// ==================== 游戏状态 ====================
let luckyNumber = 0;
let drawCount = 0;
let totalDrawn = 0;
let roundCount = 0;

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

// 日志
let gameLog = [];

// ==================== DOM 引用 ====================
const scoreEl = document.getElementById("score");
const logContentEl = document.getElementById("log-content");
const msgBarEl = document.getElementById("msg-bar");
const topRowEl = document.getElementById("top-row");
const submitBtn = document.getElementById("submit-btn");
const newGameBtn = document.getElementById("new-game-btn");
const modalOverlay = document.getElementById("modal-overlay");
const modalTitle = document.getElementById("modal-title");
const modalContent = document.getElementById("modal-content");
const modalButtons = document.getElementById("modal-buttons");
const setupOverlay = document.getElementById("setup-overlay");

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

    showSetupDialog();
}

function imageName(suit, number) {
    if (suit === 0) return "wan" + number + ".png";
    if (suit === 1) return "tiao" + number + ".png";
    return "tong" + number + ".png";
}

function ziImageName(ziName) {
    const map = { "东": "dong.png", "南": "nan.png", "西": "xi.png", "北": "bei.png", "中": "zhong.png", "白": "bai.png" };
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
    selectedCounts = {};
    isManualMode = false;
    currentCombos = [];
    bestCombos = [];
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
    gameLog.push("拆牌数：" + drawCount);
    gameLog.push("幸运数字：" + luckyNumber);
    gameLog.push("");
    gameLog.push("===== 初始发牌 =====");

    log("===== 游戏开始 =====");
    log("拆牌数：" + drawCount + "，幸运数字：" + luckyNumber);
    msgBarEl.textContent = "初始发牌 " + drawCount + " 张，幸运数字：" + luckyNumber;

    for (let i = 0; i < drawCount; i++) {
        const card = drawCard();
        log("初始摸牌：" + rewardDesc(card));
        placeCardToRow(card);
    }
    refreshUI();

    settleTopRow().then(() => {
        playRound();
    });
}

function pad(n) { return n < 10 ? "0" + n : n; }

// ==================== 牌库与发牌 ====================
function drawCard() {
    totalDrawn++;
    const type = Math.floor(Math.random() * 33);
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

// ==================== 第1排结算 ====================
function settleTopRow() {
    const hasZi = Object.values(topZi).some(c => c > 0);
    const hasLucky = Object.keys(topLucky).length > 0;
    if (!hasZi && !hasLucky) {
        return Promise.resolve();
    }

    let sb = "第1排有待结算的牌：\n";
    if (hasZi) {
        sb += "字牌：";
        for (const [zi, cnt] of Object.entries(topZi)) {
            if (cnt > 0) sb += zi + "x" + cnt + " ";
        }
        sb += "（将自动消除并奖励）\n";
    }
    if (hasLucky) {
        sb += "幸运牌：";
        for (const [key, cnt] of Object.entries(topLucky)) {
            if (cnt > 0) {
                const s = suitFromKey(key);
                const n = numberFromKey(key);
                sb += n + SUIT_NAMES[s] + "x" + cnt + " ";
            }
        }
        sb += "（将移到手牌区）\n";
    }
    sb += "\n是否确认结算？";

    return new Promise(resolve => {
        showModal("第1排结算确认", sb, [
            { text: "确认", action: () => { doSettle(); resolve(); } },
            { text: "取消", action: () => resolve(), secondary: true }
        ]);
    });

    function doSettle() {
        while (Object.keys(topZi).length > 0 || Object.keys(topLucky).length > 0) {
            // 结算字牌
            let changed = true;
            while (changed) {
                changed = false;
                const ziRewards = [];
                const ziEntries = Object.entries(topZi);
                for (const [ziName, cnt] of ziEntries) {
                    if (cnt > 0) {
                        delete topZi[ziName];
                        changed = true;
                        log("结算字牌：" + ziName + " x" + cnt + "，奖励 " + cnt + " 张");
                        for (let i = 0; i < cnt; i++) {
                            ziRewards.push(drawCard());
                        }
                    }
                }
                for (const reward of ziRewards) {
                    log("  字牌奖励牌：" + rewardDesc(reward));
                    placeCardToRow(reward);
                }
            }
            // 结算幸运牌
            if (Object.keys(topLucky).length > 0) {
                const copy = { ...topLucky };
                topLucky = {};
                for (const [key, cnt] of Object.entries(copy)) {
                    const s = suitFromKey(key);
                    const n = numberFromKey(key);
                    const name = n + SUIT_NAMES[s];
                    log("结算幸运牌：" + name + " x" + cnt + "，奖励 " + cnt + " 张，并移到手牌区");
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
        }
        refreshUI();
    }
}

// ==================== UI 刷新 ====================
function refreshUI() {
    scoreEl.textContent = "分数（累计发牌）：" + totalDrawn;

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
        const div = document.createElement("div");
        div.className = "top-tile";
        div.innerHTML = `
            <img src="${IMAGE_DIR}/${ziImageName(ziName)}" alt="${ziName}" onerror="this.style.display='none';this.parentElement.insertAdjacentHTML('beforeend','<div class=\'tile-text\' style=\'font-size:14px\'>${ziName}</div>')">
            ${cnt > 1 ? `<div class="count-badge">x${cnt}</div>` : ""}
            <div class="tile-name">${ziName}</div>
        `;
        topRowEl.appendChild(div);
    }
    for (const [key, cnt] of Object.entries(topLucky)) {
        if (cnt <= 0) continue;
        const s = suitFromKey(key);
        const n = numberFromKey(key);
        const name = n + SUIT_NAMES[s] + "(幸)";
        const div = document.createElement("div");
        div.className = "top-tile lucky";
        div.innerHTML = `
            <img src="${IMAGE_DIR}/${imageName(s, n)}" alt="${name}" onerror="this.style.display='none';this.parentElement.insertAdjacentHTML('beforeend','<div class=\'tile-text\' style=\'font-size:12px\'>${name}</div>')">
            ${cnt > 1 ? `<div class="count-badge">x${cnt}</div>` : ""}
            <div class="tile-name">${name}</div>
        `;
        topRowEl.appendChild(div);
    }

    // 清理无效选中
    for (const key of Object.keys(selectedCounts)) {
        if (getCount(key) <= 0) delete selectedCounts[key];
    }
    updateSelectionBorder();
}

// ==================== 点击交互 ====================
function onTileClicked(key) {
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
function Combo(reward, keys, need, desc) {
    this.reward = reward;
    this.keys = keys;
    this.need = need;
    this.desc = desc;
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

    // 奖励6/5/2：同花色同数字 5/4/3 张
    for (let s = 0; s < 3; s++) {
        for (let n = 1; n <= 9; n++) {
            const c = counts[s][n];
            const k = keyFor(s, n);
            if (c >= 5) list.push(new Combo(6, [k], [5], n + SUIT_NAMES[s] + " x5，奖励6张"));
            if (c >= 4) list.push(new Combo(5, [k], [4], n + SUIT_NAMES[s] + " x4，奖励5张"));
            if (c >= 3) list.push(new Combo(2, [k], [3], n + SUIT_NAMES[s] + " x3，奖励2张"));
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

// ==================== 回合控制 ====================
function playRound() {
    currentCombos = findAllCombos();
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

    if (bestCombos.length === 1) {
        isManualMode = false;
        submitBtn.disabled = true;
        const combo = bestCombos[0];
        msgBarEl.textContent = "【自动消除】" + combo.desc;
        highlightCombo(combo);

        setTimeout(() => {
            showModal("自动消除确认",
                "系统发现可消除牌型：\n" + combo.desc + "\n\n是否确认消除？",
                [
                    { text: "确认", action: () => { clearHighlight(); executeElimination(combo); } },
                    { text: "取消", action: () => {
                        clearHighlight();
                        msgBarEl.textContent = "自动消除已取消，请手动选择牌后点击提交";
                        isManualMode = true;
                        submitBtn.disabled = false;
                    }, secondary: true }
                ]
            );
        }, 300);
    } else {
        isManualMode = true;
        selectedCounts = {};
        updateSelectionBorder();
        submitBtn.disabled = false;
        msgBarEl.textContent = "【手动选择】发现 " + bestCombos.length + " 种奖励 " + currentMaxReward + " 张的组合，请点击牌后提交";
    }
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
    if (!isManualMode || Object.keys(selectedCounts).length === 0) {
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
        showModal("非法选择",
            "选择不合法！\n当前最高奖励级别为 " + currentMaxReward + " 张，\n您的选择不符合任何可用组合，请重新选择。",
            [{text: "确定", action: () => {}}]
        );
        return;
    }

    executeElimination(matched);
}

function matchesSelection(combo) {
    const totalSelected = Object.values(selectedCounts).reduce((a, b) => a + b, 0);
    if (totalSelected !== combo.keys.length) return false;

    const comboNeed = {};
    for (let i = 0; i < combo.keys.length; i++) {
        const key = combo.keys[i];
        comboNeed[key] = (comboNeed[key] || 0) + combo.need[i];
    }

    for (const [key, need] of Object.entries(comboNeed)) {
        if ((selectedCounts[key] || 0) < need) return false;
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
    selectedCounts = {};
    refreshUI();

    showModal("消除成功", "消除成功！\n" + combo.desc + "\n获得奖励 " + combo.reward + " 张牌！", [
        { text: "确定", action: () => {
            log("发放奖励牌 " + combo.reward + " 张：");
            for (let i = 0; i < combo.reward; i++) {
                const c = drawCard();
                log("  奖励牌：" + rewardDesc(c));
                placeCardToRow(c);
            }
            refreshUI();

            settleTopRow().then(() => {
                let empty = true;
                for (let s = 0; s < 3; s++) {
                    for (let n = 1; n <= 9; n++) {
                        if (counts[s][n] > 0) { empty = false; break; }
                    }
                }
                if (empty) {
                    showModal("提示", "手牌已空，按初始设置重新发牌！", [
                        { text: "确定", action: () => { startGame(); } }
                    ]);
                } else {
                    setTimeout(() => playRound(), 200);
                }
            });
        }}
    ]);
}

function gameOver() {
    isManualMode = false;
    submitBtn.disabled = true;
    newGameBtn.style.display = "inline-block";
    msgBarEl.textContent = "游戏结束！";
    log("===== 游戏结束，最终分数：" + totalDrawn + " 张 =====");

    gameLog.push("");
    gameLog.push("===== 游戏统计 =====");
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

    showModal("游戏结束",
        "没有可消除的牌型了！\n您的最终分数（累计发牌）：" + totalDrawn + " 张",
        [
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
    for (let i = 0; i < 6; i++) {
        if (drawnZi[i] > 0) {
            if (hasAny) sb += "、";
            sb += drawnZi[i] + "张" + ZI_NAMES[i];
            hasAny = true;
        }
    }
    return hasAny ? sb : "无";
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
