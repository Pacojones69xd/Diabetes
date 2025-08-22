// Calculadora de Azucarillo - SPA más elaborada

const LS = window.localStorage;
const DB_FOODS_KEY = "azucarillo_foods";
const DB_HISTORY_KEY = "azucarillo_history";
const DB_USER_KEY = "azucarillo_user";
const DB_SESSION_KEY = "azucarillo_session";

// Default user config
const defaultUser = {
  ratio: 12,
  sensitivity: 40,
  target: 110
};

let userConfig = loadUserConfig();
let foodsTable = loadFoodsTable();
let sessionFoods = loadSessionFoods();
let mealHistory = loadHistory();
let currentGlucose = null;

// DOM elements
const foodForm = document.getElementById("food-form");
const foodSelect = document.getElementById("food-select");
const foodName = document.getElementById("food-name");
const carbsPer100g = document.getElementById("carbs-per-100g");
const foodWeight = document.getElementById("food-weight");
const btnAddFoodToTable = document.getElementById("btn-add-food-to-table");
const foodList = document.getElementById("food-list");

const glucoseForm = document.getElementById("glucose-form");
const currentGlucoseInput = document.getElementById("current-glucose");

const totalCarbsSpan = document.getElementById("total-carbs");
const mealBolusSpan = document.getElementById("meal-bolus");
const correctionBolusSpan = document.getElementById("correction-bolus");
const totalInsulinSpan = document.getElementById("total-insulin");

const btnConfig = document.getElementById("btn-config");
const configModal = document.getElementById("config-modal");
const closeConfig = document.getElementById("close-config");
const configForm = document.getElementById("config-form");
const ratioInput = document.getElementById("ratio");
const sensitivityInput = document.getElementById("sensitivity");
const targetInput = document.getElementById("target-glucose");

const btnExport = document.getElementById("btn-export");
const btnShare = document.getElementById("btn-share");

const btnManageFoods = document.getElementById("btn-manage-foods");
const manageFoodsModal = document.getElementById("manage-foods-modal");
const closeManageFoods = document.getElementById("close-manage-foods");
const foodsTableElem = document.getElementById("foods-table").getElementsByTagName("tbody")[0];
const editFoodFormContainer = document.getElementById("edit-food-form-container");
const editFoodForm = document.getElementById("edit-food-form");
const editFoodIndex = document.getElementById("edit-food-index");
const editFoodName = document.getElementById("edit-food-name");
const editFoodCarbs = document.getElementById("edit-food-carbs");

const historyList = document.getElementById("history-list");
const btnClearHistory = document.getElementById("btn-clear-history");

// --- INIT ---
init();

function init() {
  renderFoodsSelect();
  renderSessionFoods();
  renderTotals();
  renderHistory();
  setupConfigModal();
  setupManageFoodsModal();
}

// --- User Config ---
function loadUserConfig() {
  const raw = LS.getItem(DB_USER_KEY);
  try {
    return raw ? JSON.parse(raw) : {...defaultUser};
  } catch {
    return {...defaultUser};
  }
}
function saveUserConfig(cfg) {
  userConfig = {...cfg};
  LS.setItem(DB_USER_KEY, JSON.stringify(userConfig));
}

// --- Foods Table ---
function loadFoodsTable() {
  const raw = LS.getItem(DB_FOODS_KEY);
  try {
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}
function saveFoodsTable() {
  LS.setItem(DB_FOODS_KEY, JSON.stringify(foodsTable));
}

function renderFoodsSelect() {
  foodSelect.innerHTML = `<option value="">Nuevo alimento...</option>`;
  foodsTable.forEach((food, idx) => {
    const opt = document.createElement("option");
    opt.value = idx;
    opt.textContent = `${food.name} (${food.carbsPer100g}g/100g)`;
    foodSelect.appendChild(opt);
  });
}

// --- Session Foods ---
function loadSessionFoods() {
  const raw = LS.getItem(DB_SESSION_KEY);
  try {
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}
function saveSessionFoods() {
  LS.setItem(DB_SESSION_KEY, JSON.stringify(sessionFoods));
}

function renderSessionFoods() {
  foodList.innerHTML = "";
  sessionFoods.forEach((food, idx) => {
    const card = document.createElement("div");
    card.className = "food-card fade-in";
    card.innerHTML = `
      <span><strong>${food.name}</strong></span><br>
      <span>${food.weight}g x ${food.carbsPer100g}g/100g = <b>${food.carbs.toFixed(1)}g hidratos</b></span>
      <button class="food-delete" title="Eliminar alimento">&times;</button>
    `;
    card.querySelector('.food-delete').onclick = () => deleteSessionFood(idx);
    foodList.appendChild(card);
  });
}

// --- Add food to session ---
foodForm.onsubmit = e => {
  e.preventDefault();
  const name = foodName.value.trim();
  const carbs = parseFloat(carbsPer100g.value);
  const weight = parseFloat(foodWeight.value);

  if (!name || isNaN(carbs) || isNaN(weight) || carbs < 0 || weight <= 0) return;

  // Regla de 3
  const totalCarbs = (carbs * weight) / 100;

  // Add to session
  sessionFoods.push({
    name,
    carbsPer100g: carbs,
    weight,
    carbs: totalCarbs
  });
  saveSessionFoods();
  renderSessionFoods();
  foodForm.reset();
  foodSelect.value = "";
  renderTotals();
};

// --- Add food to table ---
btnAddFoodToTable.onclick = () => {
  const name = foodName.value.trim();
  const carbs = parseFloat(carbsPer100g.value);

  if (!name || isNaN(carbs) || carbs < 0) return;

  // If exists, update. Else, add.
  const idx = foodsTable.findIndex(f => f.name.toLowerCase() === name.toLowerCase());
  if (idx >= 0) {
    foodsTable[idx].carbsPer100g = carbs;
  } else {
    foodsTable.push({ name, carbsPer100g: carbs });
  }
  saveFoodsTable();
  renderFoodsSelect();
  foodForm.reset();
  foodSelect.value = "";
};

// --- Select from foods table ---
foodSelect.onchange = () => {
  const idx = foodSelect.value;
  if (idx === "") {
    foodName.value = "";
    carbsPer100g.value = "";
  } else {
    const food = foodsTable[idx];
    foodName.value = food.name;
    carbsPer100g.value = food.carbsPer100g;
  }
};

// --- Delete food from session ---
function deleteSessionFood(idx) {
  sessionFoods.splice(idx, 1);
  saveSessionFoods();
  renderSessionFoods();
  renderTotals();
}

// --- Totals & Insulin ---
function getTotalCarbs() {
  return sessionFoods.reduce((sum, f) => sum + f.carbs, 0);
}
function getMealBolus() {
  return getTotalCarbs() / userConfig.ratio;
}
function getCorrectionBolus() {
  if (!currentGlucose) return 0;
  return (currentGlucose - userConfig.target) / userConfig.sensitivity;
}
function getTotalInsulin() {
  return getMealBolus() + getCorrectionBolus();
}
function renderTotals() {
  const carbs = getTotalCarbs();
  const mealB = getMealBolus();
  const corrB = getCorrectionBolus();
  const totalI = getTotalInsulin();

  totalCarbsSpan.textContent = carbs.toFixed(1);
  mealBolusSpan.textContent = mealB > 0 ? mealB.toFixed(2) : "0";
  correctionBolusSpan.textContent = corrB ? corrB.toFixed(2) : "0";
  totalInsulinSpan.textContent = totalI ? totalI.toFixed(2) : "0";
}

// --- Glucose input ---
glucoseForm.onsubmit = e => {
  e.preventDefault();
  const val = parseFloat(currentGlucoseInput.value);
  if (isNaN(val) || val < 40 || val > 600) return;
  currentGlucose = val;
  renderTotals();
  // Save meal history
  saveMealToHistory();
  renderHistory();
};

// --- Config Modal ---
function setupConfigModal() {
  btnConfig.onclick = () => {
    configModal.classList.remove("hidden");
    // Fill inputs
    ratioInput.value = userConfig.ratio;
    sensitivityInput.value = userConfig.sensitivity;
    targetInput.value = userConfig.target;
  };
  closeConfig.onclick = () => configModal.classList.add("hidden");
  configForm.onsubmit = e => {
    e.preventDefault();
    saveUserConfig({
      ratio: parseFloat(ratioInput.value),
      sensitivity: parseFloat(sensitivityInput.value),
      target: parseFloat(targetInput.value)
    });
    configModal.classList.add("hidden");
    renderTotals();
  };
}

// --- Manage Foods Modal ---
function setupManageFoodsModal() {
  btnManageFoods.onclick = () => {
    renderFoodsTable();
    manageFoodsModal.classList.remove("hidden");
    editFoodFormContainer.classList.add("hidden");
  };
  closeManageFoods.onclick = () => {
    manageFoodsModal.classList.add("hidden");
    editFoodFormContainer.classList.add("hidden");
  };
  editFoodForm.onsubmit = e => {
    e.preventDefault();
    const idx = parseInt(editFoodIndex.value);
    const name = editFoodName.value.trim();
    const carbs = parseFloat(editFoodCarbs.value);
    if (isNaN(idx) || !name || isNaN(carbs) || carbs < 0) return;
    foodsTable[idx] = { name, carbsPer100g: carbs };
    saveFoodsTable();
    renderFoodsTable();
    renderFoodsSelect();
    editFoodFormContainer.classList.add("hidden");
  };
}

function renderFoodsTable() {
  foodsTableElem.innerHTML = "";
  foodsTable.forEach((food, idx) => {
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${food.name}</td>
      <td>${food.carbsPer100g}</td>
      <td>
        <button class="food-edit-btn">Editar</button>
        <button class="food-delete-btn">Eliminar</button>
      </td>
    `;
    tr.querySelector('.food-edit-btn').onclick = () => showEditFoodForm(idx);
    tr.querySelector('.food-delete-btn').onclick = () => {
      if (confirm(`¿Eliminar alimento "${food.name}" de la tabla?`)) {
        foodsTable.splice(idx, 1);
        saveFoodsTable();
        renderFoodsTable();
        renderFoodsSelect();
      }
    };
    foodsTableElem.appendChild(tr);
  });
}

function showEditFoodForm(idx) {
  editFoodFormContainer.classList.remove("hidden");
  editFoodIndex.value = idx;
  editFoodName.value = foodsTable[idx].name;
  editFoodCarbs.value = foodsTable[idx].carbsPer100g;
}

// --- History ---
function loadHistory() {
  const raw = LS.getItem(DB_HISTORY_KEY);
  try {
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}
function saveHistory() {
  LS.setItem(DB_HISTORY_KEY, JSON.stringify(mealHistory));
}
function saveMealToHistory() {
  if (!sessionFoods.length) return;
  const meal = {
    date: new Date().toLocaleString(),
    foods: [...sessionFoods],
    totalCarbs: getTotalCarbs(),
    mealBolus: getMealBolus(),
    correctionBolus: getCorrectionBolus(),
    totalInsulin: getTotalInsulin(),
    glucose: currentGlucose
  };
  mealHistory.unshift(meal);
  if (mealHistory.length > 20) mealHistory.pop();
  saveHistory();
}

function renderHistory() {
  historyList.innerHTML = "";
  mealHistory.forEach((meal, idx) => {
    const item = document.createElement("div");
    item.className = "history-item fade-in";
    item.innerHTML = `
      <span>${meal.date} | Glucemia: ${meal.glucose ?? "-"} mg/dl<br>
      Hidratos: <strong>${meal.totalCarbs.toFixed(1)}g</strong>, Insulina: <strong>${meal.totalInsulin.toFixed(2)}u</strong></span>
      <div>
        ${meal.foods.map(f => `<span>${f.name} (${f.weight}g, ${f.carbs.toFixed(1)}g)</span>`).join(", ")}
      </div>
      <button class="history-delete" title="Eliminar registro">&times;</button>
    `;
    item.querySelector('.history-delete').onclick = () => {
      mealHistory.splice(idx, 1);
      saveHistory();
      renderHistory();
    };
    historyList.appendChild(item);
  });
}

// --- Borrar historial ---
btnClearHistory.onclick = () => {
  if (confirm("¿Seguro que quieres borrar todo el historial?")) {
    mealHistory = [];
    saveHistory();
    renderHistory();
  }
};

// --- Export PDF ---
btnExport.onclick = () => {
  window.print();
};

// --- Share WhatsApp ---
btnShare.onclick = () => {
  const text = `
🍬 Calculadora de Azucarillo 🍬
Hidratos: ${getTotalCarbs().toFixed(1)}g
Bolo comida: ${getMealBolus().toFixed(2)}u
Corrección: ${getCorrectionBolus().toFixed(2)}u
Dosis total insulina: ${getTotalInsulin().toFixed(2)}u
${sessionFoods.map(f => `- ${f.name}: ${f.weight}g (${f.carbs.toFixed(1)}g)`).join('\n')}
  `;
  const url = `https://wa.me/?text=${encodeURIComponent(text)}`;
  window.open(url, "_blank");
};
