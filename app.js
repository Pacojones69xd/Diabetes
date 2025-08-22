// Calculadora de Azucarillo - main JS
const LS = window.localStorage;
const DB_FOODS_KEY = "azucarillo_foods";
const DB_HISTORY_KEY = "azucarillo_history";
const DB_USER_KEY = "azucarillo_user";
const DB_SESSION_KEY = "azucarillo_session";

// Default user config
const defaultUser = {
  ratio: 12, // 1u/12g
  sensitivity: 40, // 1u baja 40 mg/dl
  target: 110
};

let userConfig = loadUserConfig();
let foodsDB = loadFoodsDB();
let sessionFoods = loadSessionFoods();
let mealHistory = loadHistory();
let currentGlucose = null;

// --- DOM Elements ---
const foodForm = document.getElementById("food-form");
const foodName = document.getElementById("food-name");
const carbsPer100g = document.getElementById("carbs-per-100g");
const foodWeight = document.getElementById("food-weight");
const foodList = document.getElementById("food-list");
const foodSuggestions = document.getElementById("food-suggestions");

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

const historyList = document.getElementById("history-list");

// --- INIT ---
init();

function init() {
  renderFoodSuggestions();
  renderSessionFoods();
  renderTotals();
  renderHistory();
  setupConfigModal();
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

// --- Foods DB ---
function loadFoodsDB() {
  const raw = LS.getItem(DB_FOODS_KEY);
  try {
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}
function saveFoodsDB() {
  LS.setItem(DB_FOODS_KEY, JSON.stringify(foodsDB));
}

function renderFoodSuggestions() {
  foodSuggestions.innerHTML = "";
  foodsDB.forEach(food => {
    const opt = document.createElement("option");
    opt.value = food.name;
    foodSuggestions.appendChild(opt);
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

  // Add to food DB if not exists
  if (!foodsDB.some(f => f.name.toLowerCase() === name.toLowerCase())) {
    foodsDB.push({ name, carbsPer100g: carbs });
    saveFoodsDB();
    renderFoodSuggestions();
  }
  foodForm.reset();
  renderTotals();
};

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
    // Save new config
    saveUserConfig({
      ratio: parseFloat(ratioInput.value),
      sensitivity: parseFloat(sensitivityInput.value),
      target: parseFloat(targetInput.value)
    });
    configModal.classList.add("hidden");
    renderTotals();
  };
}

// --- Foods DB: Delete food ---
foodName.oninput = () => {
  const val = foodName.value.trim().toLowerCase();
  const found = foodsDB.find(f => f.name.toLowerCase() === val);
  if (found) carbsPer100g.value = found.carbsPer100g;
};

foodSuggestions.oncontextmenu = e => {
  e.preventDefault();
  const val = e.target.value;
  if (!val) return;
  if (confirm(`¿Eliminar alimento "${val}" de la base de datos?`)) {
    foodsDB = foodsDB.filter(f => f.name !== val);
    saveFoodsDB();
    renderFoodSuggestions();
  }
};

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
    `;
    historyList.appendChild(item);
  });
}

// --- Export PDF ---
btnExport.onclick = () => {
  // Simple PDF export using window.print
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