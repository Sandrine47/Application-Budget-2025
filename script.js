const STORAGE_KEY = "budget-app-2025-transactions";
const YEAR = 2025;

const form = document.querySelector("#transaction-form");
const typeField = document.querySelector("#type");
const amountField = document.querySelector("#amount");
const categoryField = document.querySelector("#category");
const dateField = document.querySelector("#date");
const descriptionField = document.querySelector("#description");

const filterMonthField = document.querySelector("#filter-month");
const filterTypeField = document.querySelector("#filter-type");
const resetButton = document.querySelector("#reset-data");

const incomeSummary = document.querySelector("#summary-income");
const expenseSummary = document.querySelector("#summary-expense");
const balanceSummary = document.querySelector("#summary-balance");
const transactionsBody = document.querySelector("#transactions-body");
const emptyState = document.querySelector("#empty-state");

let transactions = loadTransactions();
let chartInstance;

initialise();

function initialise() {
  populateMonthFilter();
  prefillDateField();
  render();
  attachEventListeners();
}

function loadTransactions() {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    return stored ? JSON.parse(stored) : [];
  } catch (error) {
    console.error("Impossible de charger les données", error);
    return [];
  }
}

function saveTransactions() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(transactions));
}

function populateMonthFilter() {
  const formatter = new Intl.DateTimeFormat("fr-FR", { month: "long" });
  for (let month = 0; month < 12; month += 1) {
    const option = document.createElement("option");
    option.value = String(month);
    const monthLabel = formatter.format(new Date(YEAR, month, 1));
    option.textContent =
      monthLabel.charAt(0).toUpperCase() + monthLabel.slice(1);
    filterMonthField.append(option);
  }
}

function prefillDateField() {
  const today = new Date();
  if (today.getFullYear() === YEAR) {
    dateField.value = today.toISOString().slice(0, 10);
  } else {
    dateField.value = `${YEAR}-01-01`;
  }
  dateField.min = `${YEAR}-01-01`;
  dateField.max = `${YEAR}-12-31`;
}

function attachEventListeners() {
  form.addEventListener("submit", (event) => {
    event.preventDefault();
    const formData = getFormData();
    if (!formData) return;
    transactions = [formData, ...transactions];
    saveTransactions();
    render();
    form.reset();
    typeField.value = "income";
    prefillDateField();
  });

  filterMonthField.addEventListener("change", render);
  filterTypeField.addEventListener("change", render);

  resetButton.addEventListener("click", () => {
    if (confirm("Voulez-vous effacer toutes les transactions ?")) {
      transactions = [];
      saveTransactions();
      render();
    }
  });
}

function getFormData() {
  const type = typeField.value;
  const amount = parseFloat(amountField.value);
  const category = categoryField.value.trim();
  const date = dateField.value;
  const description = descriptionField.value.trim();

  if (!type || Number.isNaN(amount) || !category || !date) {
    return null;
  }

  if (amount <= 0) {
    alert("Le montant doit être supérieur à zéro.");
    return null;
  }

  const dateObj = new Date(date);
  if (dateObj.getFullYear() !== YEAR) {
    alert("La date doit appartenir à l'année 2025.");
    return null;
  }

  return {
    id: crypto.randomUUID(),
    type,
    amount: Number(amount.toFixed(2)),
    category,
    date,
    description,
    createdAt: new Date().toISOString(),
  };
}

function render() {
  const filtered = filterTransactions();
  renderSummary(filtered);
  renderTable(filtered);
  renderChart(filtered);
}

function filterTransactions() {
  return transactions.filter((transaction) => {
    const matchesType =
      filterTypeField.value === "all" || transaction.type === filterTypeField.value;
    const transactionMonth = new Date(transaction.date).getMonth();
    const matchesMonth =
      filterMonthField.value === "all" || Number(filterMonthField.value) === transactionMonth;
    return matchesType && matchesMonth;
  });
}

function renderSummary(filtered) {
  const totals = filtered.reduce(
    (acc, transaction) => {
      if (transaction.type === "income") {
        acc.income += transaction.amount;
      } else {
        acc.expense += transaction.amount;
      }
      return acc;
    },
    { income: 0, expense: 0 }
  );

  const formatter = new Intl.NumberFormat("fr-FR", {
    style: "currency",
    currency: "EUR",
    minimumFractionDigits: 2,
  });

  incomeSummary.textContent = formatter.format(totals.income);
  expenseSummary.textContent = formatter.format(totals.expense);
  balanceSummary.textContent = formatter.format(totals.income - totals.expense);
}

function renderTable(filtered) {
  transactionsBody.innerHTML = "";

  if (!filtered.length) {
    emptyState.hidden = false;
    return;
  }

  emptyState.hidden = true;

  filtered.forEach((transaction) => {
    const row = document.createElement("tr");
    row.innerHTML = `
      <td>${formatDate(transaction.date)}</td>
      <td>${transaction.description || "—"}</td>
      <td>${transaction.category}</td>
      <td>
        <span class="transaction-type ${transaction.type}">
          ${transaction.type === "income" ? "Revenu" : "Dépense"}
        </span>
      </td>
      <td class="align-right">${formatAmount(transaction.amount)}</td>
      <td class="align-right">
        <button class="action-remove" data-id="${transaction.id}">Supprimer</button>
      </td>
    `;

    row.querySelector(".action-remove").addEventListener("click", () => {
      deleteTransaction(transaction.id);
    });

    transactionsBody.append(row);
  });
}

function deleteTransaction(id) {
  transactions = transactions.filter((transaction) => transaction.id !== id);
  saveTransactions();
  render();
}

function renderChart(filtered) {
  const dataByMonth = Array.from({ length: 12 }, () => ({ income: 0, expense: 0 }));

  filtered.forEach((transaction) => {
    const monthIndex = new Date(transaction.date).getMonth();
    if (transaction.type === "income") {
      dataByMonth[monthIndex].income += transaction.amount;
    } else {
      dataByMonth[monthIndex].expense += transaction.amount;
    }
  });

  const ctx = document.querySelector("#monthly-chart").getContext("2d");
  const labels = [...Array(12)].map((_, index) =>
    new Date(YEAR, index).toLocaleDateString("fr-FR", { month: "short" })
  );

  const datasetIncome = dataByMonth.map((item) => Number(item.income.toFixed(2)));
  const datasetExpense = dataByMonth.map((item) => Number(item.expense.toFixed(2)));

  if (chartInstance) {
    chartInstance.data.labels = labels;
    chartInstance.data.datasets[0].data = datasetIncome;
    chartInstance.data.datasets[1].data = datasetExpense;
    chartInstance.update();
    return;
  }

  chartInstance = new Chart(ctx, {
    type: "bar",
    data: {
      labels,
      datasets: [
        {
          label: "Revenus",
          data: datasetIncome,
          backgroundColor: "rgba(37, 99, 235, 0.6)",
          borderRadius: 8,
          maxBarThickness: 28,
        },
        {
          label: "Dépenses",
          data: datasetExpense,
          backgroundColor: "rgba(220, 38, 38, 0.5)",
          borderRadius: 8,
          maxBarThickness: 28,
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      scales: {
        x: {
          grid: { display: false },
        },
        y: {
          beginAtZero: true,
          ticks: {
            callback: (value) => `${value} €`,
          },
        },
      },
      plugins: {
        legend: {
          labels: { color: getComputedStyle(document.body).color },
        },
      },
    },
  });
}

function formatDate(date) {
  return new Date(date).toLocaleDateString("fr-FR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

function formatAmount(amount) {
  return new Intl.NumberFormat("fr-FR", {
    style: "currency",
    currency: "EUR",
    minimumFractionDigits: 2,
  }).format(amount);
}
