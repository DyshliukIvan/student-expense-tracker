import { useEffect, useMemo, useState } from "react";
import "./App.css";

import { Doughnut, Line } from "react-chartjs-2";
import {
    Chart as ChartJS,
    ArcElement,
    Tooltip,
    Legend,
    CategoryScale,
    LinearScale,
    PointElement,
    LineElement,
} from "chart.js";

ChartJS.register(
    ArcElement,
    Tooltip,
    Legend,
    CategoryScale,
    LinearScale,
    PointElement,
    LineElement
);

function makeColors(n) {
    const res = [];
    for (let i = 0; i < n; i++) {
        const hue = Math.round((360 / Math.max(n, 1)) * i);
        res.push(`hsl(${hue} 70% 55%)`);
    }
    return res;
}

function App() {
    const [activePage, setActivePage] = useState("dashboard");

    const [expenses, setExpenses] = useState([]);
    const [incomes, setIncomes] = useState([]);

    const [incomeCategory, setIncomeCategory] = useState("");
    const [incomeAmount, setIncomeAmount] = useState("");
    const [incomeNote, setIncomeNote] = useState("");
    const [incomeError, setIncomeError] = useState("");

    const [amount, setAmount] = useState("");
    const [note, setNote] = useState("");
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState("");

    const [editingExpenseId, setEditingExpenseId] = useState(null);
    const [editExpenseCategory, setEditExpenseCategory] = useState("");
    const [editExpenseAmount, setEditExpenseAmount] = useState("");
    const [editExpenseNote, setEditExpenseNote] = useState("");

    const [editingIncomeId, setEditingIncomeId] = useState(null);
    const [editIncomeCategory, setEditIncomeCategory] = useState("");
    const [editIncomeAmount, setEditIncomeAmount] = useState("");
    const [editIncomeNote, setEditIncomeNote] = useState("");

    const [categories, setCategories] = useState([]);
    const [categoryId, setCategoryId] = useState("");

    const [incomeCategories, setIncomeCategories] = useState([]);

    const [budgetMonth, setBudgetMonth] = useState(() => {
        const d = new Date();
        const m = String(d.getMonth() + 1).padStart(2, "0");
        return `${d.getFullYear()}-${m}`;
    });
    const [budgetAmount, setBudgetAmount] = useState("");
    const [budgetStatus, setBudgetStatus] = useState(null);
    const [budgetError, setBudgetError] = useState("");

    const [fromDate, setFromDate] = useState("");
    const [toDate, setToDate] = useState("");

    const [statCat, setStatCat] = useState([]);
    const [statFlow, setStatFlow] = useState([]);
    const colors = makeColors(statCat.length);

    const [token, setToken] = useState(() => localStorage.getItem("token") || "");
    const [currentUser, setCurrentUser] = useState(null);
    const [authEmail, setAuthEmail] = useState("");
    const [authPass, setAuthPass] = useState("");
    const [authError, setAuthError] = useState("");

    const [newCategoryName, setNewCategoryName] = useState("");
    const [newCategoryType, setNewCategoryType] = useState("expense");
    const [categoryError, setCategoryError] = useState("");
    const [editingCategoryId, setEditingCategoryId] = useState(null);
    const [editCategoryName, setEditCategoryName] = useState("");

    async function apiFetch(url, options) {
        const opt = options ? { ...options } : {};
        opt.headers = opt.headers ? { ...opt.headers } : {};

        if (token) {
            opt.headers["Authorization"] = `Bearer ${token}`;
        }

        const r = await fetch(url, opt);
        return r;
    }

    function buildQuery(from, to) {
        const q = [];
        if (from) q.push(`from=${encodeURIComponent(from)}`);
        if (to) q.push(`to=${encodeURIComponent(to)}`);
        return q.length ? "?" + q.join("&") : "";
    }

    function categoryNameById(id) {
        const x = categories.find(c => String(c.id) === String(id));
        return x ? x.name : "";
    }

    async function loadCurrentUser() {
        try {
            const r = await apiFetch("/api/auth/me");
            if (!r.ok) throw new Error("failed to load current user");

            const data = await r.json();
            setCurrentUser(data.user || null);
        } catch (e) {
            setCurrentUser(null);
        }
    }

    async function loadExpenses() {
        setError("");
        let url = "/api/expenses";
        const q = [];
        if (fromDate) q.push(`from=${encodeURIComponent(fromDate)}`);
        if (toDate) q.push(`to=${encodeURIComponent(toDate)}`);
        if (q.length) url += "?" + q.join("&");

        const res = await apiFetch(url);
        if (!res.ok) {
            throw new Error("Failed to load expenses");
        }

        const data = await res.json();
        setExpenses(data);
    }

    async function loadIncomes() {
        try {
            setIncomeError("");
            let url = "/api/incomes";
            const q = [];
            if (fromDate) q.push(`from=${encodeURIComponent(fromDate)}`);
            if (toDate) q.push(`to=${encodeURIComponent(toDate)}`);
            if (q.length) url += "?" + q.join("&");

            const r = await apiFetch(url);
            if (!r.ok) throw new Error("load incomes failed");
            const data = await r.json();
            setIncomes(data);
        } catch (e) {
            setIncomeError("Failed to load incomes");
        }
    }

    async function loadCategories() {
        const r = await apiFetch("/api/categories?type=expense");
        if (!r.ok) throw new Error("Failed to load categories");
        const data = await r.json();
        setCategories(data);

        if (data.length && !categoryId) {
            setCategoryId(String(data[0].id));
        }
    }

    async function loadIncomeCategories() {
        const r = await apiFetch("/api/categories?type=income");
        if (!r.ok) throw new Error("Failed to load income categories");
        const data = await r.json();
        setIncomeCategories(data);

        if (!incomeCategory && data.length) {
            setIncomeCategory(data[0].name);
        }
    }

    async function loadBudget() {
        try {
            setBudgetError("");
            const r = await apiFetch(`/api/budgets/${budgetMonth}`);
            if (!r.ok) throw new Error("load budget failed");
            const data = await r.json();
            setBudgetAmount(data && data.amount != null ? String(data.amount) : "");
        } catch (e) {
            setBudgetError("Failed to load budget");
        }
    }

    async function loadBudgetStatus() {
        try {
            setBudgetError("");
            const r = await apiFetch(`/api/budgets/${budgetMonth}/status`);
            if (!r.ok) throw new Error("load status failed");
            const data = await r.json();
            setBudgetStatus(data);
        } catch (e) {
            setBudgetError("Failed to load budget status");
        }
    }

    async function loadStats() {
        try {
            const q = buildQuery(fromDate, toDate);

            const r1 = await apiFetch("/api/stats/expenses-by-category" + q);
            const r2 = await apiFetch("/api/stats/cashflow-by-day" + q);

            if (!r1.ok || !r2.ok) throw new Error("stats failed");

            setStatCat(await r1.json());
            setStatFlow(await r2.json());
        } catch (e) {
        }
    }

    async function addCategory() {
        try {
            setCategoryError("");

            const r = await apiFetch("/api/categories", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    name: newCategoryName,
                    type: newCategoryType,
                }),
            });

            const data = await r.json();
            if (!r.ok) throw new Error(data.error || "Failed to add category");

            setNewCategoryName("");

            await loadCategories();
            await loadIncomeCategories();
        } catch (e) {
            setCategoryError(String(e.message || e));
        }
    }

    async function deleteCategory(id) {
        try {
            setCategoryError("");

            const r = await apiFetch(`/api/categories/${id}`, {
                method: "DELETE",
            });

            const data = await r.json();
            if (!r.ok) throw new Error(data.error || "Failed to delete category");

            await loadCategories();
            await loadIncomeCategories();
        } catch (e) {
            setCategoryError(String(e.message || e));
        }
    }

    function startEditCategory(c) {
        setEditingCategoryId(c.id);
        setEditCategoryName(c.name);
    }

    function cancelEditCategory() {
        setEditingCategoryId(null);
        setEditCategoryName("");
    }

    async function saveCategory(id) {
        try {
            setCategoryError("");

            const r = await apiFetch(`/api/categories/${id}`, {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ name: editCategoryName }),
            });

            const data = await r.json();
            if (!r.ok) throw new Error(data.error || "Failed to update category");

            setEditingCategoryId(null);
            setEditCategoryName("");

            await loadCategories();
            await loadIncomeCategories();
        } catch (e) {
            setCategoryError(String(e.message || e));
        }
    }

    async function saveBudget() {
        try {
            setBudgetError("");
            const a = Number(budgetAmount);
            if (!Number.isFinite(a) || a <= 0) {
                return setBudgetError("Budget must be a number > 0");
            }

            const r = await apiFetch("/api/budgets", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ month: budgetMonth, amount: a }),
            });

            if (!r.ok) throw new Error("save budget failed");

            await loadBudgetStatus();
        } catch (e) {
            setBudgetError("Failed to save budget");
        }
    }

    async function addExpense() {
        setError("");

        const a = Number(amount);
        if (!Number.isFinite(a) || a <= 0) {
            return setError("Amount must be a number > 0");
        }

        const catName = categoryNameById(categoryId);
        if (!catName) {
            return setError("Select category");
        }

        setLoading(true);
        try {
            const res = await apiFetch("/api/expenses", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    category_id: Number(categoryId),
                    amount: a,
                    note: note.trim(),
                }),
            });

            if (!res.ok) {
                const t = await res.text();
                throw new Error(t || "Failed to add expense");
            }

            setAmount("");
            setNote("");
            await loadExpenses();
            await loadStats();
            await loadBudgetStatus();
        } catch (e) {
            setError(String(e.message || e));
        } finally {
            setLoading(false);
        }
    }

    async function deleteExpense(id) {
        try {
            const res = await apiFetch(`/api/expenses/${id}`, {
                method: "DELETE",
            });

            if (!res.ok) throw new Error("Delete failed");

            setExpenses(expenses.filter(e => e.id !== id));
            loadStats();
            loadBudgetStatus();
        } catch (e) {
            setError("Failed to delete expense");
        }
    }

    function startEditExpense(e) {
        setEditingExpenseId(e.id);
        setEditExpenseCategory(e.category || "");
        setEditExpenseAmount(String(e.amount ?? ""));
        setEditExpenseNote(e.note || "");
    }

    function cancelEditExpense() {
        setEditingExpenseId(null);
    }

    async function saveExpense(id) {
        try {
            setError("");
            const selectedCategory = categories.find(c => c.name === editExpenseCategory.trim());

            const body = {
                category_id: selectedCategory ? selectedCategory.id : null,
                amount: Number(editExpenseAmount),
                note: editExpenseNote.trim(),
            };

            const r = await apiFetch(`/api/expenses/${id}`, {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(body),
            });

            if (!r.ok) throw new Error("update expense failed");

            await r.json();
            await loadExpenses();
            await loadStats();
            await loadBudgetStatus();
            setEditingExpenseId(null);
        } catch (e) {
            setError("Failed to update expense");
        }
    }

    async function addIncome() {
        try {
            setIncomeError("");

            const body = {
                category: incomeCategory,
                amount: Number(incomeAmount),
                note: incomeNote,
            };

            const r = await apiFetch("/api/incomes", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(body),
            });

            if (!r.ok) throw new Error("add income failed");

            setIncomeCategory(incomeCategories.length ? incomeCategories[0].name : "");
            setIncomeAmount("");
            setIncomeNote("");

            await loadIncomes();
            await loadStats();
        } catch (e) {
            setIncomeError("Failed to add income");
        }
    }

    async function deleteIncome(id) {
        try {
            setIncomeError("");
            const r = await apiFetch(`/api/incomes/${id}`, { method: "DELETE" });
            if (!r.ok) throw new Error("delete income failed");
            setIncomes(incomes.filter(i => i.id !== id));
            loadStats();
        } catch (e) {
            setIncomeError("Failed to delete income");
        }
    }

    function startEditIncome(i) {
        setEditingIncomeId(i.id);
        setEditIncomeCategory(i.category || "");
        setEditIncomeAmount(String(i.amount ?? ""));
        setEditIncomeNote(i.note || "");
    }

    function cancelEditIncome() {
        setEditingIncomeId(null);
    }

    async function saveIncome(id) {
        try {
            setIncomeError("");

            const body = {
                category: editIncomeCategory.trim(),
                amount: Number(editIncomeAmount),
                note: editIncomeNote.trim(),
            };

            const r = await apiFetch(`/api/incomes/${id}`, {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(body),
            });

            if (!r.ok) throw new Error("update income failed");

            await loadIncomes();
            await loadStats();
            setEditingIncomeId(null);
        } catch (e) {
            setIncomeError("Failed to update income");
        }
    }

    function downloadExpensesCsv() {
        const q = buildQuery(fromDate, toDate);
        window.location.href = "/api/export/expenses.csv" + q;
    }

    function downloadIncomesCsv() {
        const q = buildQuery(fromDate, toDate);
        window.location.href = "/api/export/incomes.csv" + q;
    }

    function applyFilters() {
        loadExpenses();
        loadIncomes();
        loadBudgetStatus();
        loadStats();
    }

    function clearFilters() {
        setFromDate("");
        setToDate("");
        setTimeout(() => {
            loadExpenses();
            loadIncomes();
            loadBudgetStatus();
            loadStats();
        }, 0);
    }

    function logout() {
        localStorage.removeItem("token");
        setToken("");
        setCurrentUser(null);
        setExpenses([]);
        setIncomes([]);
        setStatCat([]);
        setStatFlow([]);
        setBudgetStatus(null);
        setActivePage("dashboard");
    }

    useEffect(() => {
        if (!token) return;

        loadCurrentUser();
        loadCategories().catch(() => setError("Failed to load categories"));
        loadExpenses().catch(e => setError(String(e.message || e)));
        loadIncomes().catch(() => setIncomeError("Failed to load incomes"));
        loadIncomeCategories().catch(() => setIncomeError("Failed to load income categories"));
        loadBudget().catch(() => setBudgetError("Failed to load budget"));
        loadBudgetStatus().catch(() => setBudgetError("Failed to load budget status"));
        loadStats();
    }, [token]);

    useEffect(() => {
        if (!token) return;
        loadBudget();
        loadBudgetStatus();
    }, [budgetMonth]);




    const totalExpenses = useMemo(
        () => expenses.reduce((sum, item) => sum + Number(item.amount || 0), 0),
        [expenses]
    );

    const totalIncomes = useMemo(
        () => incomes.reduce((sum, item) => sum + Number(item.amount || 0), 0),
        [incomes]
    );

    const currentBalance = totalIncomes - totalExpenses;

    const recentExpenses = expenses.slice(0, 5);
    const selectedPeriodLabel =
        fromDate || toDate ? `${fromDate || "start"} → ${toDate || "today"}` : "All time";

    function getPageMeta() {
        if (!token) {
            return {
                title: "Account",
                text: "Register or log in to access your personal finance dashboard.",
            };
        }

        if (activePage === "dashboard") {
            return {
                title: "Dashboard",
                text: "Track expenses, incomes, categories, budget and reports in one place.",
            };
        }
        if (activePage === "expenses") {
            return {
                title: "Expenses",
                text: "Add, edit and review all expense records.",
            };
        }
        if (activePage === "incomes") {
            return {
                title: "Incomes",
                text: "Add, edit and review all income records.",
            };
        }
        if (activePage === "categories") {
            return {
                title: "Categories",
                text: "Manage expense and income categories.",
            };
        }
        if (activePage === "budget") {
            return {
                title: "Budget",
                text: "Set monthly budget limits and monitor spending status.",
            };
        }
        if (activePage === "statistics") {
            return {
                title: "Statistics",
                text: "Visualize category spending and daily cashflow.",
            };
        }
        return {
            title: "Export",
            text: "Export expenses and incomes to CSV files for backup or reporting.",
        };
    }

    const pageMeta = getPageMeta();

    const doughnutData = {
        labels: statCat.map(x => x.category),
        datasets: [
            {
                data: statCat.map(x => Number(x.total)),
                backgroundColor: colors,
                borderColor: "#ffffff",
                borderWidth: 2,
            },
        ],
    };

    const doughnutOptions = {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
            legend: {
                position: "bottom",
                labels: {
                    boxWidth: 14,
                    padding: 14,
                    font: {
                        size: 12,
                    },
                },
            },
            tooltip: {
                callbacks: {
                    label: (ctx) => `${ctx.label}: ${ctx.raw}€`,
                },
            },
        },
        cutout: "68%",
    };

    const lineData = {
        labels: statFlow.map(x => String(x.day).slice(0, 10)),
        datasets: [
            {
                label: "Incomes",
                data: statFlow.map(x => Number(x.incomes)),
                borderColor: "hsl(152 67% 42%)",
                backgroundColor: "hsla(152 67% 42% / 0.18)",
                tension: 0.3,
            },
            {
                label: "Expenses",
                data: statFlow.map(x => Number(x.expenses)),
                borderColor: "hsl(8 78% 54%)",
                backgroundColor: "hsla(8 78% 54% / 0.18)",
                tension: 0.3,
            },
        ],
    };

    const lineOptions = {
        plugins: { legend: { position: "top" } },
        scales: { y: { beginAtZero: true } },
    };

    return (
        <div className="saas-app">
            <aside className="sidebar">
                <div className="sidebar-brand">
                    <h1>Student Expense Tracker</h1>
                    <p>Personal finance dashboard for students</p>
                </div>

                <nav className="sidebar-nav">
                    <button
                        className={activePage === "dashboard" ? "nav-link active" : "nav-link"}
                        onClick={() => setActivePage("dashboard")}
                    >
                        Dashboard
                    </button>
                    <button
                        className={activePage === "expenses" ? "nav-link active" : "nav-link"}
                        onClick={() => setActivePage("expenses")}
                    >
                        Expenses
                    </button>
                    <button
                        className={activePage === "incomes" ? "nav-link active" : "nav-link"}
                        onClick={() => setActivePage("incomes")}
                    >
                        Incomes
                    </button>
                    <button
                        className={activePage === "categories" ? "nav-link active" : "nav-link"}
                        onClick={() => setActivePage("categories")}
                    >
                        Categories
                    </button>
                    <button
                        className={activePage === "budget" ? "nav-link active" : "nav-link"}
                        onClick={() => setActivePage("budget")}
                    >
                        Budget
                    </button>
                    <button
                        className={activePage === "statistics" ? "nav-link active" : "nav-link"}
                        onClick={() => setActivePage("statistics")}
                    >
                        Statistics
                    </button>
                    <button
                        className={activePage === "export" ? "nav-link active" : "nav-link"}
                        onClick={() => setActivePage("export")}
                    >
                        Export
                    </button>
                </nav>

                {token ? (
                    <div className="sidebar-card">
                        <div className="sidebar-card-label">Monthly budget</div>
                        <div className="sidebar-card-value">
                            {budgetStatus?.budget != null ? `${budgetStatus.budget}€` : "—"}
                        </div>
                        <div className="sidebar-card-note">
                            Spent: {budgetStatus?.spent ?? 0}€
                        </div>
                        <div className="sidebar-card-note">
                            Balance: {currentBalance.toFixed(2)}€
                        </div>
                    </div>
                ) : (
                    <div className="sidebar-card">
                        <div className="sidebar-card-label">Welcome</div>
                        <div className="sidebar-card-value small">Finance app</div>
                        <div className="sidebar-card-note">
                            Log in to start tracking your money.
                        </div>
                    </div>
                )}
            </aside>

            <main className="main-content">
                <header className="topbar">
                    <div>
                        <h2>{pageMeta.title}</h2>
                        <p>{pageMeta.text}</p>
                    </div>

                    <div className="topbar-user">
                        {token ? (
                            <>
                                <div className="topbar-user-info">
                                    <strong>{currentUser?.email || "Logged user"}</strong>
                                    <span>{selectedPeriodLabel}</span>
                                </div>
                                <button className="btn-secondary" onClick={logout}>
                                    Logout
                                </button>
                            </>
                        ) : (
                            <div className="topbar-user-info">
                                <strong>Guest mode</strong>
                                <span>Please sign in</span>
                            </div>
                        )}
                    </div>
                </header>

                {!token ? (
                    <section className="panel auth-panel">
                        <div className="section-head">
                            <div>
                                <div className="section-label">Access</div>
                                <h3 className="section-title">Account</h3>
                                <p className="section-text">
                                    Register a new account or log in to work with your own financial data.
                                </p>
                            </div>
                        </div>

                        <div className="form-row">
                            <input
                                className="input"
                                placeholder="Email"
                                value={authEmail}
                                onChange={e => setAuthEmail(e.target.value)}
                            />
                            <input
                                className="input"
                                type="password"
                                placeholder="Password"
                                value={authPass}
                                onChange={e => setAuthPass(e.target.value)}
                            />
                            <button
                                className="btn-primary"
                                onClick={async () => {
                                    try {
                                        setAuthError("");
                                        const r = await fetch("/api/auth/register", {
                                            method: "POST",
                                            headers: { "Content-Type": "application/json" },
                                            body: JSON.stringify({ email: authEmail, password: authPass }),
                                        });

                                        const data = await r.json();
                                        if (!r.ok) throw new Error(data.error || "Register failed");

                                        localStorage.setItem("token", data.token);
                                        setToken(data.token);
                                        setCurrentUser(data.user || null);
                                        setAuthEmail("");
                                        setAuthPass("");
                                    } catch (e) {
                                        setAuthError(String(e.message || e));
                                    }
                                }}
                            >
                                Register
                            </button>

                            <button
                                className="btn-secondary"
                                onClick={async () => {
                                    try {
                                        setAuthError("");
                                        const r = await fetch("/api/auth/login", {
                                            method: "POST",
                                            headers: { "Content-Type": "application/json" },
                                            body: JSON.stringify({ email: authEmail, password: authPass }),
                                        });

                                        const data = await r.json();
                                        if (!r.ok) throw new Error(data.error || "Login failed");

                                        localStorage.setItem("token", data.token);
                                        setToken(data.token);
                                        setCurrentUser(data.user || null);
                                        setAuthEmail("");
                                        setAuthPass("");
                                    } catch (e) {
                                        setAuthError(String(e.message || e));
                                    }
                                }}
                            >
                                Login
                            </button>
                        </div>

                        {authError ? <p className="error-text">{authError}</p> : null}
                    </section>
                ) : (
                    <>
                        {activePage === "dashboard" && (
                            <>
                                <section className="summary-grid">
                                    <div className="summary-card">
                                        <div className="summary-label">Expenses</div>
                                        <div className="summary-value">{totalExpenses.toFixed(2)}€</div>
                                        <div className="summary-note">Total outgoing amount</div>
                                    </div>

                                    <div className="summary-card">
                                        <div className="summary-label">Incomes</div>
                                        <div className="summary-value">{totalIncomes.toFixed(2)}€</div>
                                        <div className="summary-note">All recorded income entries</div>
                                    </div>

                                    <div className="summary-card">
                                        <div className="summary-label">Balance</div>
                                        <div className={currentBalance >= 0 ? "summary-value positive" : "summary-value negative"}>
                                            {currentBalance.toFixed(2)}€
                                        </div>
                                        <div className="summary-note">Difference between incomes and expenses</div>
                                    </div>

                                    <div className="summary-card">
                                        <div className="summary-label">Budget status</div>
                                        <div className="summary-value">
                                            {budgetStatus?.budget != null ? `${budgetStatus.budget}€` : "—"}
                                        </div>
                                        <div className="summary-note">
                                            {budgetStatus?.exceeded ? "Budget exceeded" : "Budget is still under control"}
                                        </div>
                                    </div>
                                </section>

                                <section className="dashboard-grid">
                                    <div className="panel">
                                        <div className="section-head compact">
                                            <div>
                                                <h3 className="section-title">Quick Add Expense</h3>
                                            </div>
                                        </div>

                                        <div className="form-row">
                                            <select
                                                className="input"
                                                value={categoryId}
                                                onChange={e => setCategoryId(e.target.value)}
                                            >
                                                {categories.map(c => (
                                                    <option key={c.id} value={c.id}>
                                                        {c.name}
                                                    </option>
                                                ))}
                                            </select>

                                            <input
                                                className="input"
                                                placeholder="Amount"
                                                value={amount}
                                                onChange={e => setAmount(e.target.value)}
                                            />

                                            <input
                                                className="input input-wide"
                                                placeholder="Note"
                                                value={note}
                                                onChange={e => setNote(e.target.value)}
                                            />

                                            <button className="btn-primary" onClick={addExpense} disabled={loading}>
                                                {loading ? "Adding..." : "Add Expense"}
                                            </button>
                                        </div>

                                        {error ? <p className="error-text">{error}</p> : null}

                                        <div className="block-space"></div>

                                        <div className="section-head compact">
                                            <div>
                                                <h3 className="section-title">Recent Expenses</h3>
                                            </div>
                                        </div>

                                        {recentExpenses.length === 0 ? (
                                            <div className="empty-box">No expenses yet.</div>
                                        ) : (
                                            <div className="list">
                                                {recentExpenses.map(e => (
                                                    <div key={e.id} className="list-item">
                                                        <div>
                                                            <div className="item-meta">
                                                                <span>{String(e.created_at).slice(0, 10)}</span>
                                                                <span className="pill">{e.category || "No category"}</span>
                                                            </div>
                                                            <div className="item-title">{e.amount}€</div>
                                                            {e.note ? <div className="item-note">{e.note}</div> : null}
                                                        </div>
                                                        <div className="list-actions">
                                                            <button className="btn-small" onClick={() => setActivePage("expenses")}>
                                                                Open
                                                            </button>
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        )}
                                    </div>

                                    <div className="stack-col">
                                        <section className="panel">
                                            <div className="section-head compact">
                                                <div>
                                                    <h3 className="section-title">Monthly Budget</h3>
                                                </div>
                                            </div>

                                            <div className="form-row">
                                                <input
                                                    className="input"
                                                    type="month"
                                                    value={budgetMonth}
                                                    onChange={e => setBudgetMonth(e.target.value)}
                                                />
                                                <input
                                                    className="input"
                                                    placeholder="Budget amount"
                                                    value={budgetAmount}
                                                    onChange={e => setBudgetAmount(e.target.value)}
                                                />
                                                <button className="btn-primary" onClick={saveBudget}>
                                                    Save Budget
                                                </button>
                                            </div>

                                            {budgetError ? <p className="error-text">{budgetError}</p> : null}

                                            <div className="budget-inline">
                                                Month: {budgetMonth} · Budget: {budgetStatus?.budget ?? "—"}€ · Spent: {budgetStatus?.spent ?? 0}€
                                            </div>
                                        </section>

                                        <section className="panel">
                                            <div className="section-head compact">
                                                <div>
                                                    <h3 className="section-title">Statistics Preview</h3>
                                                </div>
                                            </div>

                                            <div className="chart-box">
                                                {statCat.length ? (
                                                    <Doughnut data={doughnutData} options={doughnutOptions} />
                                                ) : (
                                                    <div className="empty-box">No chart data</div>
                                                )}
                                            </div>
                                        </section>
                                    </div>
                                </section>
                            </>
                        )}

                        {activePage === "expenses" && (
                            <section className="panel">
                                <div className="section-head">
                                    <div>
                                        <div className="section-label">Transactions</div>
                                        <h3 className="section-title">Expenses</h3>
                                        <p className="section-text">
                                            Add, filter, edit and delete expense records.
                                        </p>
                                    </div>
                                </div>

                                <div className="form-row">
                                    <select
                                        className="input"
                                        value={categoryId}
                                        onChange={e => setCategoryId(e.target.value)}
                                    >
                                        {categories.map(c => (
                                            <option key={c.id} value={c.id}>
                                                {c.name}
                                            </option>
                                        ))}
                                    </select>

                                    <input
                                        className="input"
                                        placeholder="Amount"
                                        value={amount}
                                        onChange={e => setAmount(e.target.value)}
                                    />
                                    <input
                                        className="input input-wide"
                                        placeholder="Note"
                                        value={note}
                                        onChange={e => setNote(e.target.value)}
                                    />
                                    <button className="btn-primary" onClick={addExpense} disabled={loading}>
                                        {loading ? "Adding..." : "Add Expense"}
                                    </button>
                                </div>

                                <div className="form-row form-row-top">
                                    <input
                                        className="input"
                                        type="date"
                                        value={fromDate}
                                        onChange={e => setFromDate(e.target.value)}
                                    />
                                    <input
                                        className="input"
                                        type="date"
                                        value={toDate}
                                        onChange={e => setToDate(e.target.value)}
                                    />
                                    <button className="btn-secondary" onClick={applyFilters}>
                                        Apply
                                    </button>
                                    <button className="btn-secondary" onClick={clearFilters}>
                                        Clear
                                    </button>
                                </div>

                                {error ? <p className="error-text">{error}</p> : null}

                                {expenses.length === 0 ? (
                                    <div className="empty-box">No expenses found.</div>
                                ) : (
                                    <div className="list">
                                        {expenses.map(e => (
                                            <div key={e.id} className="list-item">
                                                {editingExpenseId === e.id ? (
                                                    <div className="form-row">
                                                        <select
                                                            className="input"
                                                            value={editExpenseCategory}
                                                            onChange={x => setEditExpenseCategory(x.target.value)}
                                                        >
                                                            {categories.map(c => (
                                                                <option key={c.id} value={c.name}>
                                                                    {c.name}
                                                                </option>
                                                            ))}
                                                        </select>
                                                        <input
                                                            className="input"
                                                            value={editExpenseAmount}
                                                            onChange={x => setEditExpenseAmount(x.target.value)}
                                                        />
                                                        <input
                                                            className="input input-wide"
                                                            value={editExpenseNote}
                                                            onChange={x => setEditExpenseNote(x.target.value)}
                                                        />
                                                        <button className="btn-primary" onClick={() => saveExpense(e.id)}>
                                                            Save
                                                        </button>
                                                        <button className="btn-secondary" onClick={cancelEditExpense}>
                                                            Cancel
                                                        </button>
                                                    </div>
                                                ) : (
                                                    <div className="list-row">
                                                        <div>
                                                            <div className="item-meta">
                                                                <span>{String(e.created_at).slice(0, 10)}</span>
                                                                <span className="pill">{e.category || "No category"}</span>
                                                            </div>
                                                            <div className="item-title">{e.amount}€</div>
                                                            {e.note ? <div className="item-note">{e.note}</div> : null}
                                                        </div>
                                                        <div className="list-actions">
                                                            <button className="btn-small" onClick={() => startEditExpense(e)}>
                                                                Edit
                                                            </button>
                                                            <button className="btn-danger" onClick={() => deleteExpense(e.id)}>
                                                                Delete
                                                            </button>
                                                        </div>
                                                    </div>
                                                )}
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </section>
                        )}

                        {activePage === "incomes" && (
                            <section className="panel">
                                <div className="section-head">
                                    <div>
                                        <div className="section-label">Transactions</div>
                                        <h3 className="section-title">Incomes</h3>
                                        <p className="section-text">
                                            Add, filter, edit and delete income records.
                                        </p>
                                    </div>
                                </div>

                                <div className="form-row">
                                    <select
                                        className="input"
                                        value={incomeCategory}
                                        onChange={e => setIncomeCategory(e.target.value)}
                                    >
                                        {incomeCategories.map(c => (
                                            <option key={c.id} value={c.name}>
                                                {c.name}
                                            </option>
                                        ))}
                                    </select>

                                    <input
                                        className="input"
                                        placeholder="Amount"
                                        value={incomeAmount}
                                        onChange={e => setIncomeAmount(e.target.value)}
                                    />
                                    <input
                                        className="input input-wide"
                                        placeholder="Note"
                                        value={incomeNote}
                                        onChange={e => setIncomeNote(e.target.value)}
                                    />
                                    <button className="btn-primary" onClick={addIncome}>
                                        Add Income
                                    </button>
                                </div>

                                <div className="form-row form-row-top">
                                    <input
                                        className="input"
                                        type="date"
                                        value={fromDate}
                                        onChange={e => setFromDate(e.target.value)}
                                    />
                                    <input
                                        className="input"
                                        type="date"
                                        value={toDate}
                                        onChange={e => setToDate(e.target.value)}
                                    />
                                    <button className="btn-secondary" onClick={applyFilters}>
                                        Apply
                                    </button>
                                    <button className="btn-secondary" onClick={clearFilters}>
                                        Clear
                                    </button>
                                </div>

                                {incomeError ? <p className="error-text">{incomeError}</p> : null}

                                {incomes.length === 0 ? (
                                    <div className="empty-box">No incomes found.</div>
                                ) : (
                                    <div className="list">
                                        {incomes.map(i => (
                                            <div key={i.id} className="list-item">
                                                {editingIncomeId === i.id ? (
                                                    <div className="form-row">
                                                        <select
                                                            className="input"
                                                            value={editIncomeCategory}
                                                            onChange={e => setEditIncomeCategory(e.target.value)}
                                                        >
                                                            {incomeCategories.map(c => (
                                                                <option key={c.id} value={c.name}>
                                                                    {c.name}
                                                                </option>
                                                            ))}
                                                        </select>
                                                        <input
                                                            className="input"
                                                            value={editIncomeAmount}
                                                            onChange={x => setEditIncomeAmount(x.target.value)}
                                                        />
                                                        <input
                                                            className="input input-wide"
                                                            value={editIncomeNote}
                                                            onChange={x => setEditIncomeNote(x.target.value)}
                                                        />
                                                        <button className="btn-primary" onClick={() => saveIncome(i.id)}>
                                                            Save
                                                        </button>
                                                        <button className="btn-secondary" onClick={cancelEditIncome}>
                                                            Cancel
                                                        </button>
                                                    </div>
                                                ) : (
                                                    <div className="list-row">
                                                        <div>
                                                            <div className="item-meta">
                                                                <span>{String(i.created_at).slice(0, 10)}</span>
                                                                <span className="pill income-pill">{i.category || "No category"}</span>
                                                            </div>
                                                            <div className="item-title income">{i.amount}€</div>
                                                            {i.note ? <div className="item-note">{i.note}</div> : null}
                                                        </div>
                                                        <div className="list-actions">
                                                            <button className="btn-small" onClick={() => startEditIncome(i)}>
                                                                Edit
                                                            </button>
                                                            <button className="btn-danger" onClick={() => deleteIncome(i.id)}>
                                                                Delete
                                                            </button>
                                                        </div>
                                                    </div>
                                                )}
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </section>
                        )}

                        {activePage === "categories" && (
                            <section className="panel">
                                <div className="section-head">
                                    <div>
                                        <div className="section-label">Setup</div>
                                        <h3 className="section-title">Categories</h3>
                                        <p className="section-text">
                                            Manage separate categories for expenses and incomes.
                                        </p>
                                    </div>
                                </div>

                                <div className="form-row">
                                    <input
                                        className="input"
                                        placeholder="Category name"
                                        value={newCategoryName}
                                        onChange={e => setNewCategoryName(e.target.value)}
                                    />
                                    <select
                                        className="input"
                                        value={newCategoryType}
                                        onChange={e => setNewCategoryType(e.target.value)}
                                    >
                                        <option value="expense">expense</option>
                                        <option value="income">income</option>
                                    </select>
                                    <button className="btn-primary" onClick={addCategory}>
                                        Add Category
                                    </button>
                                </div>

                                {categoryError ? <p className="error-text">{categoryError}</p> : null}

                                <div className="two-col-grid">
                                    <div className="sub-panel">
                                        <h4 className="sub-title">Expense categories</h4>
                                        {categories.length === 0 ? (
                                            <div className="empty-box">No expense categories yet.</div>
                                        ) : (
                                            <div className="list">
                                                {categories.map(c => (
                                                    <div key={c.id} className="list-item">
                                                        {editingCategoryId === c.id ? (
                                                            <div className="form-row">
                                                                <input
                                                                    className="input"
                                                                    value={editCategoryName}
                                                                    onChange={e => setEditCategoryName(e.target.value)}
                                                                />
                                                                <button className="btn-primary" onClick={() => saveCategory(c.id)}>
                                                                    Save
                                                                </button>
                                                                <button className="btn-secondary" onClick={cancelEditCategory}>
                                                                    Cancel
                                                                </button>
                                                            </div>
                                                        ) : (
                                                            <div className="list-row">
                                                                <div className="item-title small">{c.name}</div>
                                                                <div className="list-actions">
                                                                    <button className="btn-small" onClick={() => startEditCategory(c)}>
                                                                        Edit
                                                                    </button>
                                                                    <button className="btn-danger" onClick={() => deleteCategory(c.id)}>
                                                                        Delete
                                                                    </button>
                                                                </div>
                                                            </div>
                                                        )}
                                                    </div>
                                                ))}
                                            </div>
                                        )}
                                    </div>

                                    <div className="sub-panel">
                                        <h4 className="sub-title">Income categories</h4>
                                        {incomeCategories.length === 0 ? (
                                            <div className="empty-box">No income categories yet.</div>
                                        ) : (
                                            <div className="list">
                                                {incomeCategories.map(c => (
                                                    <div key={c.id} className="list-item">
                                                        {editingCategoryId === c.id ? (
                                                            <div className="form-row">
                                                                <input
                                                                    className="input"
                                                                    value={editCategoryName}
                                                                    onChange={e => setEditCategoryName(e.target.value)}
                                                                />
                                                                <button className="btn-primary" onClick={() => saveCategory(c.id)}>
                                                                    Save
                                                                </button>
                                                                <button className="btn-secondary" onClick={cancelEditCategory}>
                                                                    Cancel
                                                                </button>
                                                            </div>
                                                        ) : (
                                                            <div className="list-row">
                                                                <div className="item-title small">{c.name}</div>
                                                                <div className="list-actions">
                                                                    <button className="btn-small" onClick={() => startEditCategory(c)}>
                                                                        Edit
                                                                    </button>
                                                                    <button className="btn-danger" onClick={() => deleteCategory(c.id)}>
                                                                        Delete
                                                                    </button>
                                                                </div>
                                                            </div>
                                                        )}
                                                    </div>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </section>
                        )}

                        {activePage === "budget" && (
                            <section className="panel">
                                <div className="section-head">
                                    <div>
                                        <div className="section-label">Planning</div>
                                        <h3 className="section-title">Monthly Budget</h3>
                                        <p className="section-text">
                                            Set budget limits and check whether the current month is exceeded.
                                        </p>
                                    </div>
                                </div>

                                <div className="budget-layout">
                                    <div className="sub-panel">
                                        <h4 className="sub-title">Set Budget</h4>
                                        <div className="form-row">
                                            <input
                                                className="input"
                                                type="month"
                                                value={budgetMonth}
                                                onChange={e => setBudgetMonth(e.target.value)}
                                            />
                                            <input
                                                className="input"
                                                placeholder="Budget amount"
                                                value={budgetAmount}
                                                onChange={e => setBudgetAmount(e.target.value)}
                                            />
                                            <button className="btn-primary" onClick={saveBudget}>
                                                Save Budget
                                            </button>
                                            <button
                                                className="btn-secondary"
                                                onClick={() => {
                                                    loadBudget();
                                                    loadBudgetStatus();
                                                }}
                                            >
                                                Refresh
                                            </button>
                                        </div>

                                        {budgetError ? <p className="error-text">{budgetError}</p> : null}
                                    </div>

                                    <div className="sub-panel">
                                        <h4 className="sub-title">Budget Status</h4>

                                        <div className="budget-stats">
                                            <div className="budget-stat">
                                                <span>Month</span>
                                                <strong>{budgetMonth}</strong>
                                            </div>
                                            <div className="budget-stat">
                                                <span>Budget</span>
                                                <strong>{budgetStatus?.budget ?? "—"}€</strong>
                                            </div>
                                            <div className="budget-stat">
                                                <span>Spent</span>
                                                <strong>{budgetStatus?.spent ?? 0}€</strong>
                                            </div>
                                            <div className="budget-stat">
                                                <span>Status</span>
                                                <strong className={budgetStatus?.exceeded ? "danger-text" : "success-text"}>
                                                    {budgetStatus?.exceeded ? "Exceeded" : "OK"}
                                                </strong>
                                            </div>
                                        </div>

                                        <div className="budget-progress-track">
                                            <div
                                                className={budgetStatus?.exceeded ? "budget-progress-bar over" : "budget-progress-bar"}
                                                style={{
                                                    width:
                                                        budgetStatus?.budget && budgetStatus.budget > 0
                                                            ? `${Math.min(100, (Number(budgetStatus.spent) / Number(budgetStatus.budget)) * 100)}%`
                                                            : "0%",
                                                }}
                                            ></div>
                                        </div>
                                    </div>
                                </div>
                            </section>
                        )}

                        {activePage === "statistics" && (
                            <section className="panel">
                                <div className="section-head">
                                    <div>
                                        <div className="section-label">Analytics</div>
                                        <h3 className="section-title">Statistics</h3>
                                        <p className="section-text">
                                            Analyze expenses by category and compare daily incomes and expenses.
                                        </p>
                                    </div>
                                </div>

                                <div className="form-row form-row-top">
                                    <input
                                        className="input"
                                        type="date"
                                        value={fromDate}
                                        onChange={e => setFromDate(e.target.value)}
                                    />
                                    <input
                                        className="input"
                                        type="date"
                                        value={toDate}
                                        onChange={e => setToDate(e.target.value)}
                                    />
                                    <button className="btn-secondary" onClick={applyFilters}>
                                        Apply
                                    </button>
                                    <button className="btn-secondary" onClick={clearFilters}>
                                        Clear
                                    </button>
                                </div>

                                <div className="chart-grid">
                                    <div className="chart-panel">
                                        <h4 className="sub-title">Expenses by Category</h4>
                                        <div className="chart-box">
                                            {statCat.length ? (
                                                <Doughnut data={doughnutData} options={doughnutOptions} />
                                            ) : (
                                                <div className="empty-box">No category data available.</div>
                                            )}
                                        </div>
                                    </div>

                                    <div className="chart-panel">
                                        <h4 className="sub-title">Cashflow by Day</h4>
                                        <div className="chart-box">
                                            {statFlow.length ? (
                                                <Line data={lineData} options={lineOptions} />
                                            ) : (
                                                <div className="empty-box">No cashflow data available.</div>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            </section>
                        )}

                        {activePage === "export" && (
                            <section className="panel">
                                <div className="section-head">
                                    <div>
                                        <div className="section-label">Reports</div>
                                        <h3 className="section-title">Export CSV</h3>
                                        <p className="section-text">
                                            Export filtered expenses and incomes for backup or reporting.
                                        </p>
                                    </div>
                                </div>

                                <div className="sub-panel">
                                    <div className="form-row">
                                        <input
                                            className="input"
                                            type="date"
                                            value={fromDate}
                                            onChange={e => setFromDate(e.target.value)}
                                        />
                                        <input
                                            className="input"
                                            type="date"
                                            value={toDate}
                                            onChange={e => setToDate(e.target.value)}
                                        />
                                        <button className="btn-secondary" onClick={applyFilters}>
                                            Apply
                                        </button>
                                        <button className="btn-secondary" onClick={clearFilters}>
                                            Clear
                                        </button>
                                    </div>

                                    <div className="export-actions">
                                        <button className="btn-primary" onClick={downloadExpensesCsv}>
                                            Export Expenses CSV
                                        </button>
                                        <button className="btn-secondary" onClick={downloadIncomesCsv}>
                                            Export Incomes CSV
                                        </button>
                                    </div>

                                    <div className="export-note">
                                        Selected period: {selectedPeriodLabel}
                                    </div>
                                </div>
                            </section>
                        )}
                    </>
                )}
            </main>
        </div>
    );
}

export default App;