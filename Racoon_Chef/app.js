// ---------- SUPABASE CONFIG ----------
const SUPABASE_URL = "https://bvldhsszthnlnmzfmsrp.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_DUZhP1FQedSI-mM4bAAsGw_OIfPGGlQ";
const STORAGE_KEY = "racoon_chef_fridge";
const DEVICE_KEY = "racoon_device_id";

const supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

function getDeviceId() {
    let id = localStorage.getItem(DEVICE_KEY);
    if (id) return id;
    id = document.cookie.split('; ').find(r => r.startsWith(DEVICE_KEY + '='));
    if (id) {
        id = decodeURIComponent(id.split('=')[1]);
        localStorage.setItem(DEVICE_KEY, id);
        return id;
    }
    id = crypto.randomUUID();
    localStorage.setItem(DEVICE_KEY, id);
    document.cookie = `${DEVICE_KEY}=${id};path=/;max-age=${60 * 60 * 24 * 365};SameSite=Lax`;
    return id;
}
const DEVICE_ID = getDeviceId();

async function loadIngredients() {
    try {
        const { data, error } = await supabaseClient
            .from("user_fridge")
            .select("ingredients")
            .eq("device_id", DEVICE_ID)
            .single();
        if (!error && data && Array.isArray(data.ingredients)) {
            localStorage.setItem(STORAGE_KEY, JSON.stringify(data.ingredients));
            return data.ingredients;
        }
    } catch (_) {}
    try {
        const stored = localStorage.getItem(STORAGE_KEY);
        if (stored) {
            const parsed = JSON.parse(stored);
            if (Array.isArray(parsed)) return parsed;
        }
    } catch (_) {}
    return ["cabbage", "onion", "potato", "carrot", "frozen fish", "sausage"];
}

async function saveIngredients() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(ingredients));
    try {
        await supabaseClient
            .from("user_fridge")
            .upsert({ device_id: DEVICE_ID, ingredients, updated_at: new Date().toISOString() });
    } catch (_) {}
}

// ---------- HELPERS ----------
function extractIngredients(meal) {
    const items = [];
    for (let i = 1; i <= 20; i++) {
        const ing = meal[`strIngredient${i}`];
        const measure = meal[`strMeasure${i}`];
        if (ing && ing.trim()) {
            items.push({ name: ing.trim(), measure: measure ? measure.trim() : '' });
        }
    }
    return items;
}

function formatInstructions(text) {
    let steps = text.split(/\r\n\s*\r\n/).filter(s => s.trim());
    if (steps.length <= 1) steps = text.split(/\r\n/).filter(s => s.trim());
    if (steps.length <= 1) steps = text.split(/\.\s+(?=[A-Z])/).filter(s => s.trim());
    if (steps.length <= 1) return `<p>${text}</p>`;
    return `<ol class="step-list">${steps.map(s => `<li>${s.trim()}${!s.trim().endsWith('.') ? '.' : ''}</li>`).join('')}</ol>`;
}

function switchTab(e, name) {
    document.querySelectorAll(".recipe-tab-btn").forEach(b => b.classList.remove("active"));
    e.target.classList.add("active");
    document.querySelectorAll(".tab-panel").forEach(p => p.classList.remove("active"));
    document.getElementById(`tab-${name}`).classList.add("active");
}

// ---------- LOCAL CLASSIC RECIPES (offline) ----------
const CLASSIC_RECIPES = [
    { required: ["sausage", "potato", "carrot"], optional: ["onion"], name: "🍲 Sausage, Potato & Carrot Rice", cook: "1. Slice sausage, dice potato & carrot; 2. Sauté sausage, add onion, potato, carrot; 3. Add rice & water, cook; 4. Mix well." },
    { required: ["sausage", "potato"], optional: ["onion", "carrot"], name: "🥘 Speedy Sausage & Potato Rice", cook: "1. Chop sausage, potato, onion; 2. Fry onion & sausage, add potato; 3. Add water, soy sauce, sugar; 4. Mix with cooked rice." },
    { required: ["frozen fish", "cabbage"], optional: [], name: "🐟 Pan-fried Fish + Tangy Cabbage", cook: "1. Thaw fish, pat dry, marinate with salt & pepper, fry golden; 2. Sauté cabbage with garlic, vinegar, soy sauce; 3. Serve with rice." },
    { required: ["sausage", "potato", "onion"], optional: ["carrot"], name: "🥔 German Sausage & Potato Soup", cook: "1. Slice sausage, dice potato, chop onion; 2. Sauté, add water, boil 15 min; 3. Season with salt & pepper." },
    { required: ["potato", "carrot", "onion"], optional: ["sausage"], name: "🍛 Curry-ish Veg Stew", cook: "1. Sauté onion, add potato, carrot, sausage; 2. Add water, simmer 10 min; 3. Season with soy sauce & ketchup." },
    { required: ["cabbage", "sausage", "potato"], optional: [], name: "🥬 Cabbage Sausage + Mashed Potato", cook: "1. Steam & mash potato; 2. Fry sausage, add cabbage, salt, water; 3. Serve with mash." },
    { required: ["onion", "potato", "carrot", "sausage"], optional: [], name: "🧅 One-Pot Trash Stew", cook: "1. Chop everything; 2. Brown sausage, add onion, potato, carrot; 3. Add water, soy sauce, simmer 15 min." },
    { required: ["frozen fish", "cabbage", "onion"], optional: ["potato"], name: "🐟 Fish & Cabbage Hot Pot", cook: "1. Pan-fry fish; 2. Sauté onion & cabbage, add water & potato; 3. Add fish, simmer 5 min, salt & pepper." },
    { required: ["sausage", "potato"], optional: ["onion"], name: "🥔 Sausage & Potato Pancake", cook: "1. Grate potato, dice sausage & onion; 2. Mix with salt, flour (or egg); 3. Pan-fry until crispy." },
    { required: ["frozen fish", "carrot", "onion"], optional: [], name: "🥕 Stir-fried Fish with Carrot & Onion", cook: "1. Cook fish, set aside; 2. Sauté carrot & onion; 3. Return fish, add soy sauce & sugar." }
];

// current ingredients (all lower case)
let ingredients = [];

// DOM elements
const ingredientsDiv = document.getElementById("ingredientsList");
const newInput = document.getElementById("newIngredient");
const addBtn = document.getElementById("addBtn");
const localBtn = document.getElementById("localBtn");
const onlineBtn = document.getElementById("onlineBtn");
const resultBox = document.getElementById("resultBox");

// Helper: render ingredient tags
function renderIngredients() {
    ingredientsDiv.innerHTML = "";
    if (ingredients.length === 0) {
        const emptyMsg = document.createElement("div");
        emptyMsg.className = "tags";
        emptyMsg.style.width = "100%";
        emptyMsg.style.color = "#9aa86a";
        emptyMsg.innerText = "🍂 fridge is empty... add some scraps!";
        ingredientsDiv.appendChild(emptyMsg);
        return;
    }
    ingredients.forEach((ing, idx) => {
        const tag = document.createElement("div");
        tag.className = "tag";
        tag.innerHTML = `${ing} <button data-idx="${idx}">✕</button>`;
        ingredientsDiv.appendChild(tag);
    });
    document.querySelectorAll(".tag button").forEach(btn => {
        btn.addEventListener("click", (e) => {
            const idx = parseInt(btn.getAttribute("data-idx"));
            if (!isNaN(idx)) {
                ingredients.splice(idx, 1);
                saveIngredients();
                renderIngredients();
            }
            e.stopPropagation();
        });
    });
}

// add ingredient (lowercase)
function addIngredient() {
    let raw = newInput.value.trim().toLowerCase();
    if (!raw) return;
    if (!ingredients.includes(raw)) {
        ingredients.push(raw);
        saveIngredients();
        renderIngredients();
        newInput.value = "";
    } else {
        alert(`"${raw}" is already rotting in the fridge!`);
        newInput.value = "";
    }
}

// ---------- OFFLINE MODE (classic matching) ----------
function getBestClassicRecipe() {
    if (ingredients.length === 0) return null;
    let best = null;
    let bestScore = -1;
    for (let recipe of CLASSIC_RECIPES) {
        let requiredMatch = 0;
        let missing = [];
        for (let req of recipe.required) {
            if (ingredients.includes(req)) requiredMatch++;
            else missing.push(req);
        }
        if (requiredMatch === 0) continue;
        let optionalBonus = 0;
        if (recipe.optional) {
            for (let opt of recipe.optional) {
                if (ingredients.includes(opt)) optionalBonus += 0.4;
            }
        }
        if (missing.length > 1 && requiredMatch === 1 && recipe.required.length >= 3) continue;
        let score = requiredMatch + optionalBonus;
        if (requiredMatch === recipe.required.length) score += 10;
        if (score > bestScore) {
            bestScore = score;
            best = { ...recipe, missing };
        }
    }
    return best;
}

function showOfflineRecommendation() {
    if (ingredients.length === 0) {
        resultBox.innerHTML = `<div class="empty-message">🦝 fridge empty! add some scraps first.</div>`;
        return;
    }
    const recipe = getBestClassicRecipe();
    if (!recipe) {
        resultBox.innerHTML = `<div class="empty-message">😭 no classic match found. try "potato + sausage" or "fish + cabbage"</div>`;
        return;
    }
    const used = [...recipe.required];
    if (recipe.optional) {
        recipe.optional.forEach(opt => {
            if (ingredients.includes(opt) && !used.includes(opt)) used.push(opt);
        });
    }
    let missingHtml = "";
    if (recipe.missing && recipe.missing.length) {
        missingHtml = `<div class="missing-note">⚠️ missing: ${recipe.missing.join(', ')} — substitute or ignore</div>`;
    }
    resultBox.innerHTML = `
        <div class="recipe-title">
            <span class="badge">🦝 OFFLINE FIND</span> ${recipe.name}
        </div>
        <div class="used-list">${used.map(i => `<span>🥫 ${i}</span>`).join('')}</div>
        <div class="steps">📖 ${recipe.cook}</div>
        ${missingHtml}
        <hr><div class="footnote" style="margin-top:0.5rem;">✨ raccoon classic database</div>
    `;
}

// ---------- ONLINE MODE (TheMealDB) ----------
async function searchOnline() {
    if (ingredients.length === 0) {
        resultBox.innerHTML = `<div class="empty-message">🌐 fridge empty, nothing to search online.</div>`;
        return;
    }
    resultBox.innerHTML = `<div class="empty-message">🌐 raccoon is digging the internet...</div>`;
    try {
        let allMeals = [];
        for (const ing of ingredients) {
            const searchUrl = `https://www.themealdb.com/api/json/v1/1/filter.php?i=${encodeURIComponent(ing)}`;
            const res = await fetch(searchUrl);
            const data = await res.json();
            if (data.meals) allMeals.push(...data.meals);
        }
        const seen = new Set();
        const uniqueMeals = allMeals.filter(m => {
            if (seen.has(m.idMeal)) return false;
            seen.add(m.idMeal);
            return true;
        });
        if (uniqueMeals.length === 0) {
            resultBox.innerHTML = `<div class="empty-message">😭 no online recipe found.<br>try simpler ingredients or use offline mode.</div>`;
            return;
        }
        const first = uniqueMeals[Math.floor(Math.random() * uniqueMeals.length)];
        const detailUrl = `https://www.themealdb.com/api/json/v1/1/lookup.php?i=${first.idMeal}`;
        const detailRes = await fetch(detailUrl);
        const detailData = await detailRes.json();
        const meal = detailData.meals[0];
        const instructions = meal.strInstructions || "No instructions.";
        const mealIngredients = extractIngredients(meal);
        const ingredientsHtml = mealIngredients.length > 0
            ? `<ul class="ingredient-list">${mealIngredients.map(i => `<li>${i.measure ? `<span class="measure">${i.measure}</span> ` : ''}${i.name}</li>`).join('')}</ul>`
            : `<p>No ingredient list available.</p>`;
        resultBox.innerHTML = `
            <div class="recipe-title">
                <span class="badge">🌐 ONLINE SCRAP</span> ${meal.strMeal}
            </div>
            ${meal.strMealThumb ? `<img class="meal-img" src="${meal.strMealThumb}" alt="recipe image">` : ""}
            <div class="recipe-tabs">
                <button class="recipe-tab-btn active" onclick="switchTab(event, 'ingredients')">🥫 Ingredients</button>
                <button class="recipe-tab-btn" onclick="switchTab(event, 'instructions')">📖 Instructions</button>
            </div>
            <div class="tab-content">
                <div class="tab-panel active" id="tab-ingredients">${ingredientsHtml}</div>
                <div class="tab-panel" id="tab-instructions">${formatInstructions(instructions)}</div>
            </div>
            <hr>
            <div class="footnote" style="margin-top:0.5rem;">🦝 fetched from TheMealDB · found ${uniqueMeals.length} recipe(s) across your scraps</div>
        `;
    } catch (err) {
        console.error(err);
        resultBox.innerHTML = `<div class="empty-message">❌ internet fail: ${err.message}</div>`;
    }
}

// event binding
addBtn.addEventListener("click", addIngredient);
newInput.addEventListener("keypress", (e) => { if (e.key === "Enter") addIngredient(); });
localBtn.addEventListener("click", showOfflineRecommendation);
onlineBtn.addEventListener("click", searchOnline);

// initial render
(async function init() {
    ingredients = await loadIngredients();
    renderIngredients();
    showOfflineRecommendation();
})();
