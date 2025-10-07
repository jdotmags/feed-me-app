// Data storage
let recipes = [];
let mealPlan = {};
let mealHistory = [];
let activeFilters = [];
let editingRecipeId = null;
let recipeTags = [];
let selectedRating = 0;
let currentTab = 'planner';
let selectedMood = null;
let selectedShoppingItems = new Set();

const daysOfWeek = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

const ingredientPatterns = {
  'Chicken': ['chicken', 'poultry'],
  'Beef': ['beef', 'steak', 'ground beef', 'brisket'],
  'Pork': ['pork', 'bacon', 'ham', 'sausage'],
  'Fish': ['fish', 'salmon', 'tuna', 'cod', 'tilapia', 'halibut'],
  'Seafood': ['shrimp', 'crab', 'lobster', 'scallops', 'clams', 'mussels'],
  'Pasta': ['pasta', 'spaghetti', 'penne', 'linguine', 'fettuccine', 'macaroni', 'noodles'],
  'Rice': ['rice', 'jasmine rice', 'basmati', 'arborio'],
  'Vegetarian': [],
  'Soup': ['soup', 'broth', 'stock'],
  'Comfort Food': ['cheese', 'cream', 'butter', 'casserole'],
  'Grilled': ['grill', 'grilled', 'bbq', 'barbecue'],
  'Baked': ['bake', 'baked', 'roast', 'roasted'],
  'Salad': ['salad', 'lettuce', 'greens']
};

const moodPreferences = {
  'cold': ['Soup', 'Comfort Food', 'Baked', 'Beef', 'Pork'],
  'hot': ['Salad', 'Grilled', 'Fish', 'Seafood'],
  'rainy': ['Soup', 'Comfort Food', 'Baked', 'Pasta'],
  'fall': ['Pork', 'Baked', 'Comfort Food', 'Soup']
};

function autoTagRecipe(ingredients) {
  const autoTags = [];
  const ingredientText = ingredients.join(' ').toLowerCase();
  
  let hasMeat = false;
  for (const [tag, patterns] of Object.entries(ingredientPatterns)) {
    if (tag === 'Vegetarian') continue;
    
    for (const pattern of patterns) {
      if (ingredientText.includes(pattern.toLowerCase())) {
        if (!autoTags.includes(tag)) {
          autoTags.push(tag);
        }
        if (['Chicken', 'Beef', 'Pork', 'Fish', 'Seafood'].includes(tag)) {
          hasMeat = true;
        }
      }
    }
  }
  
  if (!hasMeat && ingredients.length > 0) {
    autoTags.push('Vegetarian');
  }
  
  return autoTags;
}

function getRecipeSource(url) {
  if (!url) return null;
  try {
    const hostname = new URL(url).hostname.replace('www.', '');
    return hostname.split('.')[0];
  } catch {
    return null;
  }
}

function getRecommendations() {
  if (!selectedMood || recipes.length === 0) return [];
  
  const preferredTags = moodPreferences[selectedMood];
  const scored = recipes.map(recipe => {
    const allTags = [...(recipe.tags || []), ...(recipe.autoTags || [])];
    let score = 0;
    
    for (const tag of allTags) {
      if (preferredTags.includes(tag)) {
        score++;
      }
    }
    
    return { recipe, score, matchedTag: allTags.find(t => preferredTags.includes(t)) };
  });
  
  return scored
    .filter(item => item.score > 0)
    .sort((a, b) => b.score - a.score || b.recipe.rating - a.recipe.rating)
    .slice(0, 5);
}

function loadData() {
  try {
    const savedRecipes = localStorage.getItem('feedme_recipes');
    const savedMealPlan = localStorage.getItem('feedme_mealPlan');
    const savedHistory = localStorage.getItem('feedme_history');
    
    recipes = savedRecipes ? JSON.parse(savedRecipes) : [];
    let loadedMealPlan = savedMealPlan ? JSON.parse(savedMealPlan) : {};
    mealHistory = savedHistory ? JSON.parse(savedHistory) : [];
    
    mealPlan = {};
    for (const [day, value] of Object.entries(loadedMealPlan)) {
      if (Array.isArray(value)) {
        mealPlan[day] = value;
      } else if (typeof value === 'number') {
        mealPlan[day] = [value];
      }
    }
    
    console.log('Data loaded:', { recipes: recipes.length, mealPlan, historyCount: mealHistory.length });
  } catch (e) {
    console.error('Error loading data:', e);
    recipes = [];
    mealPlan = {};
    mealHistory = [];
  }
}

function saveData() {
  try {
    localStorage.setItem('feedme_recipes', JSON.stringify(recipes));
    localStorage.setItem('feedme_mealPlan', JSON.stringify(mealPlan));
    localStorage.setItem('feedme_history', JSON.stringify(mealHistory));
    console.log('Data saved');
  } catch (e) {
    console.error('Error saving data:', e);
  }
}

function render() {
  if (currentTab === 'planner') {
    renderPlanner();
  } else if (currentTab === 'recipes') {
    renderRecipes();
  } else if (currentTab === 'shopping') {
    renderShopping();
  } else if (currentTab === 'history') {
    renderHistory();
  }
}

function renderPlanner() {
  const plannerContent = document.getElementById('plannerContent');
  const recommendationsContainer = document.getElementById('recommendationsContainer');
  
  const recommendations = getRecommendations();
  if (recommendations.length > 0 && selectedMood) {
    let recoHtml = '<div class="recommendations-card">';
    recoHtml += '<h3>✨ Perfect for This Week</h3>';
    recoHtml += '<div class="recommendations-list">';
    
    recommendations.forEach(item => {
      recoHtml += '<div class="recommendation-item" data-recipe-id="' + item.recipe.id + '">';
      recoHtml += '<div>';
      recoHtml += '<div class="recommendation-name">' + escapeHtml(item.recipe.name) + '</div>';
      recoHtml += '<div class="recommendation-match">Great for ' + escapeHtml(item.matchedTag) + '</div>';
      recoHtml += '</div>';
      recoHtml += '<div>' + '⭐'.repeat(item.recipe.rating || 3) + '</div>';
      recoHtml += '</div>';
    });
    
    recoHtml += '</div></div>';
    recommendationsContainer.innerHTML = recoHtml;
    
    document.querySelectorAll('.recommendation-item').forEach(item => {
      item.addEventListener('click', function() {
        const recipeId = parseInt(this.dataset.recipeId);
        quickAddToWeek(recipeId);
      });
    });
  } else {
    recommendationsContainer.innerHTML = '';
  }
  
  let html = '<div class="week-grid">';
  
  daysOfWeek.forEach(day => {
    const dayRecipes = mealPlan[day] || [];
    
    html += '<div class="day-card-multi">';
    html += '<div class="day-header">';
    html += '<div class="day-name">' + escapeHtml(day) + '</div>';
    html += '<button class="btn btn-small add-recipe-day-btn" data-day="' + day + '">+ Add Recipe</button>';
    html += '</div>';
    
    if (dayRecipes.length === 0) {
      html += '<div class="day-empty">No recipes planned</div>';
    } else {
      html += '<div class="day-recipes">';
      dayRecipes.forEach((recipeId, index) => {
        const recipe = recipes.find(r => r.id === recipeId);
        if (recipe) {
          html += '<div class="day-recipe-item">';
          html += '<div class="day-recipe-info recipe-clickable" data-recipe-id="' + recipeId + '" style="cursor: pointer;">';
          html += '<span class="day-recipe-name">' + escapeHtml(recipe.name) + '</span>';
          html += '<span class="day-recipe-rating">' + '⭐'.repeat(recipe.rating || 0) + '</span>';
          html += '</div>';
          html += '<button class="btn-icon remove-recipe-btn" data-day="' + day + '" data-index="' + index + '" title="Remove">×</button>';
          html += '</div>';
        }
      });
      html += '</div>';
    }
    
    html += '</div>';
  });
  
  html += '</div>';
  
  html += '<div style="margin-top: 32px; display: flex; gap: 12px;">';
  html += '<button class="btn btn-success" id="archiveWeekBtn">📦 Archive This Week</button>';
  html += '<button class="btn btn-secondary" id="clearWeekBtn">🗑️ Clear Week</button>';
  html += '</div>';
  
  plannerContent.innerHTML = html;
  
  // Add event listeners for clickable recipes
  document.querySelectorAll('.recipe-clickable').forEach(item => {
    item.addEventListener('click', function() {
      const recipeId = parseInt(this.dataset.recipeId);
      viewRecipeDetails(recipeId);
    });
  });
  
  document.querySelectorAll('.add-recipe-day-btn').forEach(btn => {
    btn.addEventListener('click', function() {
      openRecipeSelectorForDay(this.dataset.day);
    });
  });
  
  document.querySelectorAll('.remove-recipe-btn').forEach(btn => {
    btn.addEventListener('click', function() {
      removeRecipeFromDay(this.dataset.day, parseInt(this.dataset.index));
    });
  });
  
  const archiveBtn = document.getElementById('archiveWeekBtn');
  if (archiveBtn) archiveBtn.addEventListener('click', archiveWeek);
  
  const clearBtn = document.getElementById('clearWeekBtn');
  if (clearBtn) clearBtn.addEventListener('click', clearWeek);
}

function renderRecipes() {
  const content = document.getElementById('recipesContent');
  
  const allTags = [...new Set(recipes.flatMap(r => [...(r.tags || []), ...(r.autoTags || [])]))];
  
  let html = '';
  
  if (allTags.length > 0) {
    html += '<div class="category-pills">';
    allTags.forEach(tag => {
      const active = activeFilters.includes(tag) ? 'active' : '';
      html += '<div class="category-pill ' + active + '" data-tag="' + escapeHtml(tag) + '">';
      html += '<span class="category-icon">' + getCategoryIcon(tag) + '</span>';
      html += escapeHtml(tag);
      html += '</div>';
    });
    
    if (activeFilters.length > 0) {
      html += '<button class="btn btn-small" id="clearFiltersBtn">Clear Filters</button>';
    }
    html += '</div>';
  }

  let filteredRecipes = recipes;
  if (activeFilters.length > 0) {
    filteredRecipes = recipes.filter(recipe => {
      const allRecipeTags = [...(recipe.tags || []), ...(recipe.autoTags || [])];
      return activeFilters.some(filter => allRecipeTags.includes(filter));
    });
  }

  if (filteredRecipes.length === 0) {
    html += '<div class="empty-state"><div class="empty-icon">👨‍🍳</div><p>' + (activeFilters.length > 0 ? 'No recipes match your filters.' : 'No recipes yet.<br>Click "Add Recipe" to get started!') + '</p></div>';
  } else {
    html += '<div class="recipes-grid">';
    filteredRecipes.forEach(recipe => {
      html += '<div class="recipe-card">';
      
      if (recipe.image) {
        html += '<div class="recipe-image"><img src="' + escapeHtml(recipe.image) + '" alt="' + escapeHtml(recipe.name) + '" onerror="this.parentElement.innerHTML=\'🍽️\'"></div>';
      } else {
        html += '<div class="recipe-image">🍽️</div>';
      }
      
      html += '<div class="recipe-content">';
      html += '<div class="recipe-title">' + escapeHtml(recipe.name) + '</div>';
      
      const source = getRecipeSource(recipe.url);
      if (source) {
        html += '<div class="recipe-source">From ' + escapeHtml(source) + '</div>';
      }
      
      if (recipe.url) {
        html += '<a href="' + escapeHtml(recipe.url) + '" target="_blank" style="color: var(--primary); text-decoration: none; font-size: 14px;">View original recipe →</a>';
      }
      
      html += '<div class="recipe-rating">';
      for (let i = 0; i < 5; i++) {
        html += i < recipe.rating ? '★' : '☆';
      }
      html += '</div>';
      
      const allTags = [...(recipe.tags || []), ...(recipe.autoTags || [])];
      if (allTags.length > 0) {
        html += '<div class="recipe-tags">';
        (recipe.tags || []).forEach(tag => {
          html += '<span class="tag">' + getCategoryIcon(tag) + ' ' + escapeHtml(tag) + '</span>';
        });
        (recipe.autoTags || []).forEach(tag => {
          html += '<span class="tag auto-tag">' + getCategoryIcon(tag) + ' ' + escapeHtml(tag) + '</span>';
        });
        html += '</div>';
      }
      
      if (recipe.notes) {
        html += '<div class="recipe-notes">📝 ' + escapeHtml(recipe.notes) + '</div>';
      }
      
      html += '<details class="details">';
      html += '<summary>View Details →</summary>';
      html += '<div class="details-content">';
      if (recipe.ingredients && recipe.ingredients.length > 0) {
        html += '<strong>Ingredients:</strong>';
        html += '<ul class="ingredient-list">';
        recipe.ingredients.forEach(ing => {
          html += '<li>' + escapeHtml(ing) + '</li>';
        });
        html += '</ul>';
      }
      if (recipe.instructions) {
        html += '<strong>Instructions:</strong><p>' + escapeHtml(recipe.instructions) + '</p>';
      }
      html += '</div></details>';
      
      html += '<div class="recipe-actions">';
      html += '<button class="btn btn-small add-to-menu-btn" data-recipe-id="' + recipe.id + '">📅 Add to Menu</button>';
      html += '<button class="btn btn-secondary btn-small edit-recipe-btn" data-recipe-id="' + recipe.id + '">Edit</button>';
      html += '<button class="btn btn-secondary btn-small delete-recipe-btn" data-recipe-id="' + recipe.id + '">Delete</button>';
      html += '</div>';
      html += '</div></div>';
    });
    html += '</div>';
  }

  content.innerHTML = html;
  
  // CRITICAL: Attach event listeners AFTER rendering
  document.querySelectorAll('.category-pill').forEach(pill => {
    pill.addEventListener('click', function() {
      console.log('Filter clicked:', this.dataset.tag);
      toggleFilter(this.dataset.tag);
    });
  });
  
  const clearFiltersBtn = document.getElementById('clearFiltersBtn');
  if (clearFiltersBtn) {
    clearFiltersBtn.addEventListener('click', clearFilters);
  }
  
  document.querySelectorAll('.add-to-menu-btn').forEach(btn => {
    btn.addEventListener('click', function(e) {
      e.stopPropagation();
      const recipeId = parseInt(this.dataset.recipeId);
      console.log('Add to Menu clicked for recipe:', recipeId);
      quickAddToWeek(recipeId);
    });
  });
  
  document.querySelectorAll('.edit-recipe-btn').forEach(btn => {
    btn.addEventListener('click', function(e) {
      e.stopPropagation();
      editRecipe(parseInt(this.dataset.recipeId));
    });
  });
  
  document.querySelectorAll('.delete-recipe-btn').forEach(btn => {
    btn.addEventListener('click', function(e) {
      e.stopPropagation();
      deleteRecipe(parseInt(this.dataset.recipeId));
    });
  });
}

function renderShopping() {
  const content = document.getElementById('shoppingContent');
  const shoppingList = generateShoppingList();

  if (shoppingList.length === 0) {
    content.innerHTML = '<div class="empty-state"><div class="empty-icon">🛒</div><p>Your shopping list is empty.<br>Plan some meals first!</p></div>';
  } else {
    let html = '<div class="shopping-section">';
    
    html += '<div class="shopping-list">';
    html += '<div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px;">';
    html += '<h3>🛒 Shopping List</h3>';
    html += '<div style="display: flex; gap: 8px;">';
    html += '<button class="btn btn-small" id="selectAllShoppingBtn">Select All</button>';
    html += '<button class="btn btn-small" id="exportShoppingBtn" disabled>📧 Email List</button>';
    html += '</div>';
    html += '</div>';
    html += '<p style="color: var(--text-light); margin-bottom: 16px; font-size: 14px;">✓ Check items you need to buy</p>';
    
    shoppingList.forEach((item, index) => {
      const itemId = `shop-${index}`;
      const isSelected = selectedShoppingItems.has(itemId);
      html += '<div class="shopping-item' + (isSelected ? ' selected' : '') + '">';
      html += '<div class="shopping-item-left">';
      html += '<input type="checkbox" class="shopping-checkbox" data-item-id="' + itemId + '"' + (isSelected ? ' checked' : '') + '>';
      html += '<span class="shopping-item-name">' + escapeHtml(item.ingredient) + '</span>';
      html += '</div>';
      html += '<div class="shopping-item-actions">';
      if (item.count > 1) {
        html += '<span class="badge">x' + item.count + '</span>';
      }
      html += '</div>';
      html += '</div>';
    });
    html += '</div>';
    
    html += '<div class="shopping-list">';
    html += '<h3>📋 Recipes This Week</h3>';
    const allRecipeIds = Object.values(mealPlan).flat();
    const plannedRecipes = [...new Set(allRecipeIds)].map(id => recipes.find(r => r.id === id)).filter(r => r);
    if (plannedRecipes.length === 0) {
      html += '<p style="text-align: center; color: var(--text-light); padding: 20px;">No recipes planned yet</p>';
    } else {
      plannedRecipes.forEach(recipe => {
        html += '<div class="shopping-item">';
        html += '<span class="shopping-item-name">' + escapeHtml(recipe.name) + '</span>';
        html += '<span style="font-size: 18px;">' + '⭐'.repeat(recipe.rating || 0) + '</span>';
        html += '</div>';
      });
    }
    html += '</div>';
    
    html += '</div>';
    content.innerHTML = html;
    
    document.querySelectorAll('.shopping-checkbox').forEach(checkbox => {
      checkbox.addEventListener('change', function() {
        toggleShoppingItem(this.dataset.itemId);
        updateExportButton();
      });
    });
    
    const selectAllBtn = document.getElementById('selectAllShoppingBtn');
    if (selectAllBtn) {
      selectAllBtn.addEventListener('click', selectAllShoppingItems);
    }
    
    const exportBtn = document.getElementById('exportShoppingBtn');
    if (exportBtn) {
      exportBtn.addEventListener('click', exportShoppingList);
      updateExportButton();
    }
  }
}

function updateExportButton() {
  const exportBtn = document.getElementById('exportShoppingBtn');
  if (exportBtn) {
    exportBtn.disabled = selectedShoppingItems.size === 0;
  }
}

function selectAllShoppingItems() {
  const shoppingList = generateShoppingList();
  shoppingList.forEach((item, index) => {
    const itemId = `shop-${index}`;
    selectedShoppingItems.add(itemId);
  });
  render();
}

function renderHistory() {
  const content = document.getElementById('historyContent');

  if (mealHistory.length === 0) {
    content.innerHTML = '<div class="empty-state"><div class="empty-icon">📁</div><p>No archived weeks yet.<br>Complete a week and archive it!</p></div>';
  } else {
    let html = '';
    mealHistory.forEach(week => {
      html += '<div class="history-card">';
      html += '<h3>Week of ' + escapeHtml(week.weekOf) + '</h3>';
      week.meals.forEach(meal => {
        html += '<div class="history-meal">';
        html += '<strong>' + escapeHtml(meal.day) + '</strong>';
        html += '<span>' + escapeHtml(meal.recipeName) + '</span>';
        html += '</div>';
      });
      html += '</div>';
    });
    content.innerHTML = html;
  }
}

function generateShoppingList() {
  const ingredientsMap = {};
  Object.values(mealPlan).forEach(recipeIds => {
    if (Array.isArray(recipeIds)) {
      recipeIds.forEach(recipeId => {
        const recipe = recipes.find(r => r.id === recipeId);
        if (recipe && recipe.ingredients) {
          recipe.ingredients.forEach(ingredient => {
            const basicIngredient = extractBasicIngredient(ingredient);
            ingredientsMap[basicIngredient] = (ingredientsMap[basicIngredient] || 0) + 1;
          });
        }
      });
    }
  });
  return Object.entries(ingredientsMap)
    .map(([ingredient, count]) => ({ ingredient, count }))
    .sort((a, b) => a.ingredient.localeCompare(b.ingredient));
}

function extractBasicIngredient(ingredient) {
  return ingredient.replace(/^\d+\s*(cups?|tbsp|tsp|oz|lbs?|g|kg|ml|l)?\s*/i, '').trim();
}

function getCategoryIcon(category) {
  const icons = {
    'Chicken': '🐔', 'Beef': '🥩', 'Pork': '🥓', 'Fish': '🐟', 'Seafood': '🦐',
    'Pasta': '🍝', 'Rice': '🍚', 'Vegetarian': '🥗', 'Soup': '🍲',
    'Comfort Food': '🧈', 'Grilled': '🔥', 'Baked': '🔥', 'Salad': '🥗',
    'Quick': '⚡', 'Healthy': '💪'
  };
  return icons[category] || '🍽️';
}

function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

function addRecipeToDay(day, recipeId) {
  if (!mealPlan[day]) {
    mealPlan[day] = [];
  }
  mealPlan[day].push(recipeId);
  saveData();
  render();
}

function removeRecipeFromDay(day, index) {
  if (mealPlan[day] && mealPlan[day][index] !== undefined) {
    mealPlan[day].splice(index, 1);
    if (mealPlan[day].length === 0) {
      delete mealPlan[day];
    }
    saveData();
    render();
  }
}

function clearWeek() {
  if (confirm('Clear all meals for this week?')) {
    mealPlan = {};
    saveData();
    render();
  }
}

function archiveWeek() {
  const weekMeals = daysOfWeek.flatMap(day => {
    const recipeIds = mealPlan[day] || [];
    return recipeIds.map(recipeId => ({
      day,
      recipeId,
      recipeName: recipes.find(r => r.id === recipeId)?.name || 'Unknown recipe'
    }));
  });

  if (weekMeals.length > 0) {
    mealHistory.unshift({ weekOf: new Date().toLocaleDateString(), meals: weekMeals });
    mealPlan = {};
    saveData();
    alert('Week archived! 🎉');
    render();
  } else {
    alert('Plan some meals first before archiving!');
  }
}

function openRecipeSelectorForDay(day) {
  window.selectedDay = day;
  
  const modal = document.getElementById('recipeSelectorModal');
  if (!modal) {
    console.error('Recipe selector modal not found!');
    return;
  }
  
  document.getElementById('recipeSelectorTitle').textContent = `Add Recipe to ${day}`;
  document.getElementById('recipeSelectorSearch').value = '';
  
  renderRecipeSearchResults('');
  
  modal.classList.add('active');
}

function renderRecipeSearchResults(searchTerm) {
  const container = document.getElementById('recipeSearchResults');
  const term = searchTerm.toLowerCase();
  
  const filtered = recipes.filter(recipe => 
    recipe.name.toLowerCase().includes(term) ||
    (recipe.tags || []).some(tag => tag.toLowerCase().includes(term)) ||
    (recipe.autoTags || []).some(tag => tag.toLowerCase().includes(term))
  );
  
  if (filtered.length === 0) {
    container.innerHTML = '<div style="text-align: center; padding: 40px; color: var(--text-light);">No recipes found</div>';
    return;
  }
  
  let html = '';
  filtered.forEach(recipe => {
    html += '<div class="recipe-search-item" data-recipe-id="' + recipe.id + '">';
    html += '<div style="flex: 1;">';
    html += '<div style="font-weight: 600; margin-bottom: 4px;">' + escapeHtml(recipe.name) + '</div>';
    const allTags = [...(recipe.tags || []), ...(recipe.autoTags || [])];
    if (allTags.length > 0) {
      html += '<div style="font-size: 12px; color: var(--text-light);">';
      html += allTags.slice(0, 3).map(tag => getCategoryIcon(tag) + ' ' + escapeHtml(tag)).join(', ');
      html += '</div>';
    }
    html += '</div>';
    html += '<div>' + '⭐'.repeat(recipe.rating || 0) + '</div>';
    html += '</div>';
  });
  
  container.innerHTML = html;
  
  document.querySelectorAll('.recipe-search-item').forEach(item => {
    item.addEventListener('click', function() {
      const recipeId = parseInt(this.dataset.recipeId);
      const day = window.selectedDay;
      addRecipeToDay(day, recipeId);
      closeRecipeSelectorModal();
      
      const recipe = recipes.find(r => r.id === recipeId);
      alert(`✓ Added "${recipe.name}" to ${day}!`);
    });
  });
}

function closeRecipeSelectorModal() {
  const modal = document.getElementById('recipeSelectorModal');
  if (modal) {
    modal.classList.remove('active');
  }
  window.selectedDay = null;
}

function viewRecipeDetails(recipeId) {
  const recipe = recipes.find(r => r.id === recipeId);
  if (!recipe) return;
  
  const modal = document.getElementById('recipeViewModal');
  if (!modal) {
    console.error('Recipe view modal not found!');
    return;
  }
  
  document.getElementById('recipeViewTitle').textContent = recipe.name;
  
  const source = getRecipeSource(recipe.url);
  let html = '';
  
  if (source) {
    html += '<p style="color: var(--text-light); font-style: italic; margin-bottom: 16px;">From ' + escapeHtml(source) + '</p>';
  }
  
  if (recipe.url) {
    html += '<a href="' + escapeHtml(recipe.url) + '" target="_blank" class="btn btn-small" style="margin-bottom: 20px;">🔗 View Original Recipe</a>';
  }
  
  html += '<div style="margin: 20px 0;">';
  html += '<strong style="font-size: 18px;">Rating:</strong> ';
  html += '<span style="font-size: 24px;">' + '⭐'.repeat(recipe.rating || 0) + '</span>';
  html += '</div>';
  
  const allTags = [...(recipe.tags || []), ...(recipe.autoTags || [])];
  if (allTags.length > 0) {
    html += '<div style="margin: 20px 0;">';
    html += '<strong>Tags:</strong><br>';
    html += '<div style="display: flex; flex-wrap: wrap; gap: 8px; margin-top: 8px;">';
    (recipe.tags || []).forEach(tag => {
      html += '<span class="tag">' + getCategoryIcon(tag) + ' ' + escapeHtml(tag) + '</span>';
    });
    (recipe.autoTags || []).forEach(tag => {
      html += '<span class="tag auto-tag">' + getCategoryIcon(tag) + ' ' + escapeHtml(tag) + '</span>';
    });
    html += '</div></div>';
  }
  
  if (recipe.notes) {
    html += '<div class="recipe-notes" style="margin: 20px 0;">📝 ' + escapeHtml(recipe.notes) + '</div>';
  }
  
  if (recipe.ingredients && recipe.ingredients.length > 0) {
    html += '<div style="margin: 20px 0;">';
    html += '<strong style="font-size: 18px;">Ingredients:</strong>';
    html += '<ul class="ingredient-list">';
    recipe.ingredients.forEach(ing => {
      html += '<li>' + escapeHtml(ing) + '</li>';
    });
    html += '</ul></div>';
  }
  
  if (recipe.instructions) {
    html += '<div style="margin: 20px 0;">';
    html += '<strong style="font-size: 18px;">Instructions:</strong>';
    html += '<p style="margin-top: 12px; line-height: 1.8; white-space: pre-wrap;">' + escapeHtml(recipe.instructions) + '</p>';
    html += '</div>';
  }
  
  html += '<div style="margin-top: 24px; display: flex; gap: 12px;">';
  html += '<button class="btn edit-from-view-btn" data-recipe-id="' + recipe.id + '">Edit Recipe</button>';
  html += '<button class="btn btn-secondary close-view-btn">Close</button>';
  html += '</div>';
  
  document.getElementById('recipeViewContent').innerHTML = html;
  
  // Add event listeners for the buttons in the modal
  const editBtn = document.querySelector('#recipeViewModal .edit-from-view-btn');
  if (editBtn) {
    editBtn.addEventListener('click', function() {
      const recipeId = parseInt(this.dataset.recipeId);
      closeRecipeViewModal();
      editRecipe(recipeId);
    });
  }
  
  const closeBtn = document.querySelector('#recipeViewModal .close-view-btn');
  if (closeBtn) {
    closeBtn.addEventListener('click', closeRecipeViewModal);
  }
  
  modal.classList.add('active');
}

function closeRecipeViewModal() {
  const modal = document.getElementById('recipeViewModal');
  if (modal) {
    modal.classList.remove('active');
  }
}

function quickAddToWeek(recipeId) {
  console.log('quickAddToWeek called with recipeId:', recipeId);
  
  const modal = document.getElementById('daySelectorModal');
  if (!modal) {
    console.error('Day selector modal not found in HTML!');
    alert('Error: Day selector not available. Please add the modal to your HTML.');
    return;
  }
  
  window.pendingRecipeId = recipeId;
  
  const recipe = recipes.find(r => r.id === recipeId);
  if (!recipe) return;
  
  document.getElementById('daySelectorTitle').textContent = `Add "${recipe.name}" to Menu`;
  
  const dayButtonsContainer = document.getElementById('dayButtons');
  dayButtonsContainer.innerHTML = '';
  
  daysOfWeek.forEach(day => {
    const dayRecipes = mealPlan[day] || [];
    const recipeNames = dayRecipes.map(id => recipes.find(r => r.id === id)?.name).filter(n => n);
    const isOccupied = dayRecipes.length > 0;
    
    const button = document.createElement('button');
    button.className = 'day-button' + (isOccupied ? ' occupied' : '');
    button.type = 'button';
    
    const dayText = document.createElement('div');
    dayText.textContent = day;
    button.appendChild(dayText);
    
    if (isOccupied) {
      const currentText = document.createElement('div');
      currentText.className = 'day-button-current';
      currentText.textContent = `Currently: ${recipeNames.join(', ')}`;
      button.appendChild(currentText);
    }
    
    button.addEventListener('click', function() {
      addRecipeToDay(day, recipeId);
      closeDaySelectorModal();
      alert(`✓ Added "${recipe.name}" to ${day}!`);
    });
    
    dayButtonsContainer.appendChild(button);
  });
  
  modal.classList.add('active');
  console.log('Day selector modal opened');
}

function closeDaySelectorModal() {
  const modal = document.getElementById('daySelectorModal');
  if (modal) {
    modal.classList.remove('active');
  }
  window.pendingRecipeId = null;
}

function toggleShoppingItem(itemId) {
  if (selectedShoppingItems.has(itemId)) {
    selectedShoppingItems.delete(itemId);
  } else {
    selectedShoppingItems.add(itemId);
  }
  render();
}

function exportShoppingList() {
  const shoppingList = generateShoppingList();
  
  if (selectedShoppingItems.size === 0) {
    alert('Please select items to export');
    return;
  }
  
  const selectedItems = shoppingList.filter((item, index) => {
    const itemId = `shop-${index}`;
    return selectedShoppingItems.has(itemId);
  });
  
  let body = 'Shopping List:%0D%0A%0D%0A';
  selectedItems.forEach(item => {
    const count = item.count > 1 ? ` (x${item.count})` : '';
    body += `• ${encodeURIComponent(item.ingredient)}${encodeURIComponent(count)}%0D%0A`;
  });
  
  const allRecipeIds = Object.values(mealPlan).flat();
  const plannedRecipes = [...new Set(allRecipeIds)].map(id => recipes.find(r => r.id === id)).filter(r => r);
  if (plannedRecipes.length > 0) {
    body += '%0D%0AThis Week\'s Recipes:%0D%0A';
    plannedRecipes.forEach(recipe => {
      body += `• ${encodeURIComponent(recipe.name)}%0D%0A`;
    });
  }
  
  const subject = encodeURIComponent('Shopping List - ' + new Date().toLocaleDateString());
  window.location.href = `mailto:?subject=${subject}&body=${body}`;
}

function toggleFilter(tag) {
  if (activeFilters.includes(tag)) {
    activeFilters = activeFilters.filter(t => t !== tag);
  } else {
    activeFilters.push(tag);
  }
  render();
}

function clearFilters() {
  activeFilters = [];
  render();
}

function editRecipe(id) {
  const recipe = recipes.find(r => r.id === id);
  if (!recipe) return;

  editingRecipeId = id;
  recipeTags = [...(recipe.tags || [])];
  selectedRating = recipe.rating || 0;

  document.getElementById('modalTitle').textContent = 'Edit Recipe';
  document.getElementById('recipeName').value = recipe.name;
  document.getElementById('recipeUrl').value = recipe.url || '';
  document.getElementById('recipeImage').value = recipe.image || '';
  document.getElementById('recipeIngredients').value = (recipe.ingredients || []).join('\n');
  document.getElementById('recipeInstructions').value = recipe.instructions || '';
  document.getElementById('recipeNotes').value = recipe.notes || '';
  
  updateTagsDisplay();
  updateStarDisplay();
  attachStarListeners();
  
  document.getElementById('recipeModal').classList.add('active');
}

function deleteRecipe(id) {
  if (!confirm('Are you sure you want to delete this recipe?')) return;

  recipes = recipes.filter(r => r.id !== id);
  
  Object.keys(mealPlan).forEach(day => {
    if (Array.isArray(mealPlan[day])) {
      mealPlan[day] = mealPlan[day].filter(recipeId => recipeId !== id);
      if (mealPlan[day].length === 0) {
        delete mealPlan[day];
      }
    }
  });

  saveData();
  render();
}

function openAddRecipeModal() {
  editingRecipeId = null;
  recipeTags = [];
  selectedRating = 0;
  document.getElementById('modalTitle').textContent = 'Add Recipe';
  document.getElementById('recipeForm').reset();
  document.getElementById('tagsDisplay').innerHTML = '';
  updateStarDisplay();
  attachStarListeners();
  document.getElementById('recipeModal').classList.add('active');
}

function closeModal() {
  document.getElementById('recipeModal').classList.remove('active');
}

function saveRecipe(e) {
  e.preventDefault();

  const name = document.getElementById('recipeName').value.trim();
  if (!name) {
    alert('Please enter a recipe name');
    return;
  }

  const ingredients = document.getElementById('recipeIngredients').value.split('\n').filter(i => i.trim());
  const autoTags = autoTagRecipe(ingredients);

  const recipe = {
    id: editingRecipeId || Date.now(),
    name: name,
    url: document.getElementById('recipeUrl').value.trim(),
    image: document.getElementById('recipeImage').value.trim(),
    ingredients: ingredients,
    instructions: document.getElementById('recipeInstructions').value.trim(),
    notes: document.getElementById('recipeNotes').value.trim(),
    tags: recipeTags,
    autoTags: autoTags,
    rating: selectedRating
  };

  if (editingRecipeId) {
    const index = recipes.findIndex(r => r.id === editingRecipeId);
    recipes[index] = recipe;
  } else {
    recipes.push(recipe);
  }

  saveData();
  closeModal();
  
  currentTab = 'recipes';
  document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
  document.querySelector('[data-tab="recipes"]').classList.add('active');
  document.querySelectorAll('.content').forEach(c => c.classList.remove('active'));
  document.getElementById('recipes').classList.add('active');
  
  render();
  alert(editingRecipeId ? 'Recipe updated! 🎉' : 'Recipe saved! 🎉');
}

function addTag() {
  const input = document.getElementById('tagInput');
  const tag = input.value.trim();
  
  if (tag && !recipeTags.includes(tag)) {
    recipeTags.push(tag);
    updateTagsDisplay();
    input.value = '';
  }
}

function removeTag(tag) {
  recipeTags = recipeTags.filter(t => t !== tag);
  updateTagsDisplay();
}

function updateTagsDisplay() {
  const display = document.getElementById('tagsDisplay');
  display.innerHTML = '';
  
  recipeTags.forEach(tag => {
    const span = document.createElement('span');
    span.className = 'tag-removable';
    span.textContent = getCategoryIcon(tag) + ' ' + tag + ' ×';
    span.addEventListener('click', () => removeTag(tag));
    display.appendChild(span);
  });
}

function updateStarDisplay() {
  document.querySelectorAll('.star-input').forEach((star, index) => {
    if (index < selectedRating) {
      star.classList.add('filled');
    } else {
      star.classList.remove('filled');
    }
  });
}

function attachStarListeners() {
  console.log('Attaching star listeners...');
  document.querySelectorAll('.star-input').forEach(star => {
    star.addEventListener('click', function() {
      selectedRating = parseInt(this.dataset.rating);
      console.log('Star clicked! New rating:', selectedRating);
      updateStarDisplay();
    });
  });
}

document.addEventListener('DOMContentLoaded', function() {
  console.log('🚀 Feed Me initializing...');
  
  const logoImg = document.getElementById('logoImg');
  if (logoImg) {
    const imagePaths = ['logo.png', 'icon48.png', 'icon128.png'];
    function tryLoadImage(index) {
      if (index >= imagePaths.length) {
        logoImg.parentElement.innerHTML = '🍽️';
        console.log('Logo: using emoji fallback');
        return;
      }
      logoImg.src = imagePaths[index];
      logoImg.onload = () => console.log('Logo loaded:', imagePaths[index]);
      logoImg.onerror = () => tryLoadImage(index + 1);
    }
    tryLoadImage(0);
  }
  
  loadData();

  document.querySelectorAll('.tab').forEach(tab => {
    tab.addEventListener('click', () => {
      currentTab = tab.dataset.tab;
      document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
      document.querySelectorAll('.content').forEach(c => c.classList.remove('active'));
      document.getElementById(tab.dataset.tab).classList.add('active');
      render();
    });
  });

  document.querySelectorAll('.weather-option').forEach(option => {
    option.addEventListener('click', () => {
      document.querySelectorAll('.weather-option').forEach(o => o.classList.remove('selected'));
      option.classList.add('selected');
      selectedMood = option.dataset.mood;
      render();
    });
  });

  document.getElementById('headerAddRecipe').addEventListener('click', openAddRecipeModal);
  document.getElementById('closeModal').addEventListener('click', closeModal);
  document.getElementById('recipeModal').addEventListener('click', (e) => {
    if (e.target.id === 'recipeModal') closeModal();
  });
  
  const closeDaySelector = document.getElementById('closeDaySelector');
  if (closeDaySelector) {
    closeDaySelector.addEventListener('click', closeDaySelectorModal);
  }
  
  const daySelectorModal = document.getElementById('daySelectorModal');
  if (daySelectorModal) {
    daySelectorModal.addEventListener('click', (e) => {
      if (e.target.id === 'daySelectorModal') closeDaySelectorModal();
    });
  }
  
  const closeRecipeSelector = document.getElementById('closeRecipeSelector');
  if (closeRecipeSelector) {
    closeRecipeSelector.addEventListener('click', closeRecipeSelectorModal);
  }
  
  const recipeSelectorModal = document.getElementById('recipeSelectorModal');
  if (recipeSelectorModal) {
    recipeSelectorModal.addEventListener('click', (e) => {
      if (e.target.id === 'recipeSelectorModal') closeRecipeSelectorModal();
    });
  }
  
  const closeRecipeView = document.getElementById('closeRecipeView');
  if (closeRecipeView) {
    closeRecipeView.addEventListener('click', closeRecipeViewModal);
  }
  
  const recipeViewModal = document.getElementById('recipeViewModal');
  if (recipeViewModal) {
    recipeViewModal.addEventListener('click', (e) => {
      if (e.target.id === 'recipeViewModal') closeRecipeViewModal();
    });
  }
  
  const recipeSearchInput = document.getElementById('recipeSelectorSearch');
  if (recipeSearchInput) {
    recipeSearchInput.addEventListener('input', (e) => {
      renderRecipeSearchResults(e.target.value);
    });
  }

  document.getElementById('recipeForm').addEventListener('submit', saveRecipe);
  document.getElementById('addTagBtn').addEventListener('click', addTag);
  document.getElementById('tagInput').addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      addTag();
    }
  });

  attachStarListeners();

  render();
  console.log('✓ Feed Me ready!');
});