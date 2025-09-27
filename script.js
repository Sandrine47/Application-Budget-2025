const STORAGE_KEY = 'budget-app-2025-state';
const MONTHS = [
  'Janvier',
  'Février',
  'Mars',
  'Avril',
  'Mai',
  'Juin',
  'Juillet',
  'Août',
  'Septembre',
  'Octobre',
  'Novembre',
  'Décembre'
];

const state = loadState();

const transactionForm = document.getElementById('transaction-form');
const transactionTable = document.getElementById('transaction-table');
const filterType = document.getElementById('filter-type');
const filterMonth = document.getElementById('filter-month');
const filterCategory = document.getElementById('filter-category');
const monthlyBudgetsContainer = document.getElementById('monthly-budgets');
const budgetForm = document.getElementById('budget-form');
const resetButton = document.getElementById('reset-data');

const totalIncomeEl = document.getElementById('total-income');
const totalExpenseEl = document.getElementById('total-expense');
const currentBalanceEl = document.getElementById('current-balance');
const annualBudgetEl = document.getElementById('annual-budget');
const annualProgressEl = document.getElementById('annual-progress');

let monthlyChart;
let categoryChart;

init();

function init() {
  ensureMonthlyBudgets();
  populateMonthFilter();
  renderMonthlyBudgetInputs();
  updateFilters();
  renderTransactions();
  renderSummary();
  setupEventListeners();
  updateCharts();
}

function loadState() {
  const saved = localStorage.getItem(STORAGE_KEY);
  if (!saved) {
    return {
      transactions: [],
      budgets: {
        annual: 0,
        monthly: {}
      }
    };
  }

  try {
    const parsed = JSON.parse(saved);
    return {
      transactions: Array.isArray(parsed.transactions)
        ? parsed.transactions
        : [],
      budgets: {
        annual: Number(parsed?.budgets?.annual) || 0,
        monthly: parsed?.budgets?.monthly || {}
      }
    };
  } catch (error) {
    console.error('Impossible de charger les données :', error);
    return {
      transactions: [],
      budgets: { annual: 0, monthly: {} }
    };
  }
}

function saveState() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

function ensureMonthlyBudgets() {
  for (let i = 0; i < MONTHS.length; i += 1) {
    if (typeof state.budgets.monthly[i] !== 'number') {
      state.budgets.monthly[i] = 0;
    }
  }
}

function populateMonthFilter() {
  MONTHS.forEach((month, index) => {
    const option = document.createElement('option');
    option.value = String(index);
    option.textContent = month;
    filterMonth.append(option);
  });
}

function renderMonthlyBudgetInputs() {
  monthlyBudgetsContainer.innerHTML = '';

  MONTHS.forEach((month, index) => {
    const card = document.createElement('div');
    card.className = 'month-card';
    card.innerHTML = `
      <label>
        ${month}
        <input
          type="number"
          name="month-${index}"
          min="0"
          step="0.01"
          value="${state.budgets.monthly[index] ?? 0}"
        />
      </label>
      <div class="month-progress" data-month-index="${index}">
        ${buildMonthlyProgressText(index)}
      </div>
    `;
    monthlyBudgetsContainer.append(card);
  });

  budgetForm.elements.annualBudget.value = state.budgets.annual || '';
}

function buildMonthlyProgressText(index) {
  const budget = Number(state.budgets.monthly[index]) || 0;
  const spent = Math.abs(
    state.transactions
      .filter((transaction) => transaction.type === 'expense')
      .filter((transaction) => new Date(transaction.date).getMonth() === index)
      .reduce((total, transaction) => total + Number(transaction.amount || 0), 0)
  );

  if (!budget) {
    return `Aucun budget défini. Dépenses : ${formatCurrency(spent)}`;
  }

  const ratio = Math.min(spent / budget, 1);
  const percent = Math.round((spent / budget) * 100);
  const status = percent > 100 ? 'au-delà du budget' : `utilisé à ${percent}%`;
  return `Budget : ${formatCurrency(budget)} · Dépenses : ${formatCurrency(
    spent
  )} (${status})`;
}

function updateMonthlyProgressDisplay() {
  document
    .querySelectorAll('[data-month-index]')
    .forEach((element) => {
      const index = Number(element.dataset.monthIndex);
      element.textContent = buildMonthlyProgressText(index);
    });
}

function setupEventListeners() {
  transactionForm.addEventListener('submit', handleTransactionSubmit);
  [filterType, filterMonth, filterCategory].forEach((select) =>
    select.addEventListener('change', () => {
      renderTransactions();
      updateCharts();
    })
  );

  budgetForm.addEventListener('submit', handleBudgetSubmit);

  resetButton.addEventListener('click', () => {
    const confirmation = confirm(
      'Voulez-vous vraiment réinitialiser toutes les données ? Cette action est irréversible.'
    );
    if (!confirmation) return;

    localStorage.removeItem(STORAGE_KEY);
    state.transactions = [];
    state.budgets.annual = 0;
    state.budgets.monthly = {};
    ensureMonthlyBudgets();
    renderMonthlyBudgetInputs();
    updateFilters();
    renderTransactions();
    renderSummary();
    updateCharts();
  });
}

function handleTransactionSubmit(event) {
  event.preventDefault();
  const formData = new FormData(transactionForm);
  const amount = Number(formData.get('amount'));
  const type = formData.get('type');
  const date = formData.get('date');

  if (!amount || !date || !type) {
    return;
  }

  const transaction = {
    id: generateId(),
    date,
    type,
    category: formData.get('category'),
    description: formData.get('description')?.trim() || '-',
    amount: amount
  };

  state.transactions.push(transaction);
  saveState();
  transactionForm.reset();
  updateFilters();
  renderTransactions();
  renderSummary();
  updateCharts();
  updateMonthlyProgressDisplay();
}

function handleBudgetSubmit(event) {
  event.preventDefault();
  const formData = new FormData(budgetForm);
  state.budgets.annual = Number(formData.get('annualBudget')) || 0;

  MONTHS.forEach((_, index) => {
    const value = Number(formData.get(`month-${index}`)) || 0;
    state.budgets.monthly[index] = value;
  });

  saveState();
  renderSummary();
  updateMonthlyProgressDisplay();
}

function renderTransactions() {
  transactionTable.innerHTML = '';
  const filtered = getFilteredTransactions();

  if (!filtered.length) {
    const emptyRow = document.createElement('tr');
    emptyRow.innerHTML =
      '<td colspan="6" style="text-align:center;color:var(--color-muted);padding:1.5rem;">Aucune transaction à afficher.</td>';
    transactionTable.append(emptyRow);
    return;
  }

  filtered
    .sort((a, b) => new Date(b.date) - new Date(a.date))
    .forEach((transaction) => {
      const row = document.createElement('tr');
      row.innerHTML = `
        <td>${formatDate(transaction.date)}</td>
        <td>${transaction.type === 'income' ? 'Revenu' : 'Dépense'}</td>
        <td>${transaction.category}</td>
        <td>${transaction.description || '-'}</td>
        <td class="align-right transaction-amount-${transaction.type}">${formatCurrency(
          transaction.amount
        )}</td>
        <td class="align-right">
          <button class="remove-btn" data-id="${transaction.id}">Supprimer</button>
        </td>
      `;
      transactionTable.append(row);
    });

  transactionTable.querySelectorAll('.remove-btn').forEach((button) => {
    button.addEventListener('click', (event) => {
      const id = event.currentTarget.dataset.id;
      removeTransaction(id);
    });
  });
}

function removeTransaction(id) {
  const index = state.transactions.findIndex((transaction) => transaction.id === id);
  if (index === -1) return;

  state.transactions.splice(index, 1);
  saveState();
  updateFilters();
  renderTransactions();
  renderSummary();
  updateCharts();
  updateMonthlyProgressDisplay();
}

function getFilteredTransactions() {
  return state.transactions.filter((transaction) => {
    const typeMatches =
      filterType.value === 'all' || transaction.type === filterType.value;

    const monthMatches =
      filterMonth.value === 'all' ||
      new Date(transaction.date).getMonth() === Number(filterMonth.value);

    const categoryMatches =
      filterCategory.value === 'all' || transaction.category === filterCategory.value;

    return typeMatches && monthMatches && categoryMatches;
  });
}

function updateFilters() {
  const categories = Array.from(
    new Set(state.transactions.map((transaction) => transaction.category))
  ).sort();

  filterCategory.innerHTML = '<option value="all">Toutes les catégories</option>';
  categories.forEach((category) => {
    const option = document.createElement('option');
    option.value = category;
    option.textContent = category;
    filterCategory.append(option);
  });
}

function renderSummary() {
  const totals = state.transactions.reduce(
    (acc, transaction) => {
      if (transaction.type === 'income') {
        acc.income += Number(transaction.amount) || 0;
      } else if (transaction.type === 'expense') {
        acc.expense += Number(transaction.amount) || 0;
      }
      return acc;
    },
    { income: 0, expense: 0 }
  );

  const balance = totals.income - totals.expense;
  totalIncomeEl.textContent = formatCurrency(totals.income);
  totalExpenseEl.textContent = formatCurrency(totals.expense);
  currentBalanceEl.textContent = formatCurrency(balance);
  annualBudgetEl.textContent = formatCurrency(state.budgets.annual || 0);

  if (!state.budgets.annual) {
    annualProgressEl.textContent = 'Aucun budget annuel défini.';
  } else {
    const percent = Math.min((totals.expense / state.budgets.annual) * 100, 999);
    annualProgressEl.textContent = `Dépenses à ${percent.toFixed(1)}% du budget.`;
  }
}

function updateCharts() {
  updateMonthlyChart();
  updateCategoryChart();
}

function updateMonthlyChart() {
  const ctx = document.getElementById('monthly-chart');
  const incomeByMonth = new Array(12).fill(0);
  const expenseByMonth = new Array(12).fill(0);

  state.transactions.forEach((transaction) => {
    const monthIndex = new Date(transaction.date).getMonth();
    if (Number.isNaN(monthIndex)) return;
    if (transaction.type === 'income') {
      incomeByMonth[monthIndex] += Number(transaction.amount) || 0;
    } else if (transaction.type === 'expense') {
      expenseByMonth[monthIndex] += Number(transaction.amount) || 0;
    }
  });

  const data = {
    labels: MONTHS,
    datasets: [
      {
        label: 'Revenus',
        data: incomeByMonth,
        backgroundColor: 'rgba(34, 197, 94, 0.6)',
        borderRadius: 6,
        maxBarThickness: 28
      },
      {
        label: 'Dépenses',
        data: expenseByMonth,
        backgroundColor: 'rgba(239, 68, 68, 0.6)',
        borderRadius: 6,
        maxBarThickness: 28
      }
    ]
  };

  const options = {
    responsive: true,
    maintainAspectRatio: false,
    scales: {
      x: {
        ticks: {
          color: '#cbd5f5'
        },
        grid: {
          color: 'rgba(148, 163, 184, 0.15)'
        }
      },
      y: {
        ticks: {
          color: '#cbd5f5'
        },
        grid: {
          color: 'rgba(148, 163, 184, 0.15)'
        }
      }
    },
    plugins: {
      legend: {
        labels: {
          color: '#f8fafc'
        }
      }
    }
  };

  if (monthlyChart) {
    monthlyChart.data = data;
    monthlyChart.options = options;
    monthlyChart.update();
  } else {
    monthlyChart = new Chart(ctx, {
      type: 'bar',
      data,
      options
    });
  }
}

function updateCategoryChart() {
  const ctx = document.getElementById('category-chart');
  const expenses = state.transactions.filter((transaction) => transaction.type === 'expense');

  const totalsByCategory = expenses.reduce((acc, transaction) => {
    const key = transaction.category || 'Autre';
    acc[key] = (acc[key] || 0) + (Number(transaction.amount) || 0);
    return acc;
  }, {});

  const labels = Object.keys(totalsByCategory);
  const dataValues = Object.values(totalsByCategory);

  const data = {
    labels,
    datasets: [
      {
        data: dataValues,
        backgroundColor: [
          'rgba(14, 165, 233, 0.75)',
          'rgba(249, 115, 22, 0.75)',
          'rgba(99, 102, 241, 0.75)',
          'rgba(16, 185, 129, 0.75)',
          'rgba(236, 72, 153, 0.75)',
          'rgba(250, 204, 21, 0.75)',
          'rgba(20, 184, 166, 0.75)',
          'rgba(148, 163, 184, 0.75)'
        ],
        borderWidth: 0
      }
    ]
  };

  const options = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: 'bottom',
        labels: {
          color: '#f8fafc'
        }
      }
    }
  };

  if (categoryChart) {
    categoryChart.data = data;
    categoryChart.options = options;
    categoryChart.update();
  } else {
    categoryChart = new Chart(ctx, {
      type: 'doughnut',
      data,
      options
    });
  }
}

function formatCurrency(value) {
  return new Intl.NumberFormat('fr-FR', {
    style: 'currency',
    currency: 'EUR'
  }).format(Number(value) || 0);
}

function formatDate(date) {
  const parsed = new Date(date);
  if (Number.isNaN(parsed.getTime())) return date;
  return parsed.toLocaleDateString('fr-FR', {
    year: 'numeric',
    month: 'short',
    day: '2-digit'
  });
}

function generateId() {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `txn-${Date.now()}-${Math.random().toString(16).slice(2, 10)}`;
}
