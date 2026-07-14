require("dotenv").config({ path: require("path").join(__dirname, "..", ".env") });
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
if (!process.env.JWT_SECRET) {
    console.error("JWT_SECRET is missing in .env");
    process.exit(1);
}
const express = require("express");
const pool = require("./db");
const cors = require("cors");

const app = express();

app.use(cors());
app.use(express.json());

function positiveAmount(value) {
    const amount = Number(value);
    return Number.isFinite(amount) && amount > 0 ? amount : null;
}

async function ensureDatabaseSchema() {
    // Older local volumes used INTEGER for money. Keep existing installations
    // compatible with the current UI, which supports cents.
    await pool.query(`
        ALTER TABLE expenses
            ALTER COLUMN amount TYPE NUMERIC(12, 2) USING amount::NUMERIC(12, 2);
        ALTER TABLE incomes
            ALTER COLUMN amount TYPE NUMERIC(12, 2) USING amount::NUMERIC(12, 2);
        ALTER TABLE budgets
            ALTER COLUMN amount TYPE NUMERIC(12, 2) USING amount::NUMERIC(12, 2);
    `);
}

// проверить что сервер работает
app.get("/", (req, res) => {
    res.send("Student Expense Tracker server works!");
});


app.get("/categories", auth, async (req, res) => {
    const type = req.query.type;

    if (type) {
        const r = await pool.query(
            "SELECT * FROM categories WHERE type=$1 AND user_id=$2 ORDER BY name",
            [type, req.user.id]
        );
        return res.json(r.rows);
    }

    const r = await pool.query(
        "SELECT * FROM categories WHERE user_id=$1 ORDER BY type, name",
        [req.user.id]
    );
    res.json(r.rows);
});

app.post("/categories", auth, async (req, res) => {
    const { name, type } = req.body;

    if (!name || !type) {
        return res.status(400).json({ error: "Name and type are required" });
    }

    try {
        const r = await pool.query(
            "INSERT INTO categories (name, type, user_id) VALUES ($1, $2, $3) RETURNING *",
            [name.trim(), type.trim(), req.user.id]
        );

        res.json(r.rows[0]);
    } catch (e) {
        return res.status(400).json({ error: "Category with this name already exists" });
    }
});

app.put("/categories/:id", auth, async (req, res) => {
    const id = Number(req.params.id);
    const { name } = req.body;

    if (!name || !name.trim()) {
        return res.status(400).json({ error: "Category name is required" });
    }

    try {
        const r = await pool.query(
            "UPDATE categories SET name = $1 WHERE id = $2 AND user_id = $3 RETURNING *",
            [name.trim(), id, req.user.id]
        );

        if (!r.rows.length) {
            return res.status(404).json({ error: "Category not found" });
        }

        res.json(r.rows[0]);
    } catch (e) {
        return res.status(400).json({ error: "Category with this name already exists" });
    }
});

app.delete("/categories/:id", auth, async (req, res) => {
    const id = Number(req.params.id);

    const used = await pool.query(
        `SELECT 1
         FROM expenses
         WHERE category_id = $1 AND user_id = $2
         LIMIT 1`,
        [id, req.user.id]
    );

    if (used.rows.length) {
        return res.status(400).json({ error: "Category is used in expenses and cannot be deleted" });
    }

    const r = await pool.query(
        "DELETE FROM categories WHERE id = $1 AND user_id = $2 RETURNING *",
        [id, req.user.id]
    );

    if (!r.rows.length) {
        return res.status(404).json({ error: "Category not found" });
    }

    res.json({ status: "deleted" });
});

app.get("/budgets/:month", auth, async (req, res) => {
    const month = req.params.month + "-01";

    const r = await pool.query(
        "SELECT * FROM budgets WHERE month = $1 AND user_id = $2",
        [month, req.user.id]
    );

    if (r.rows.length === 0) return res.json(null);
    res.json(r.rows[0]);
});


app.post("/budgets", auth, async (req, res) => {
    const { month, amount } = req.body;
    const parsedAmount = positiveAmount(amount);
    if (!month || parsedAmount === null) {
        return res.status(400).json({ error: "Month and a positive amount are required" });
    }
    const m = month + "-01";

    const r = await pool.query(
        `INSERT INTO budgets (month, amount, user_id)
         VALUES ($1, $2, $3)
             ON CONFLICT (user_id, month) DO UPDATE SET amount = EXCLUDED.amount
                                                 RETURNING *`,
        [m, parsedAmount, req.user.id]
    );

    res.json(r.rows[0]);
});


app.get("/budgets/:month/status", auth, async (req, res) => {
    const m = req.params.month + "-01";

    const b = await pool.query(
        "SELECT amount FROM budgets WHERE month=$1 AND user_id=$2",
        [m, req.user.id]
    );
    const budgetAmount = b.rows.length ? b.rows[0].amount : null;

    const s = await pool.query(
        `SELECT COALESCE(SUM(amount),0) AS sum
         FROM expenses
         WHERE user_id = $2
           AND created_at >= $1::date
           AND created_at < ($1::date + INTERVAL '1 month')`,
        [m, req.user.id]
    );

    const spent = Number(s.rows[0].sum || 0);

    res.json({
        month: req.params.month,
        budget: budgetAmount,
        spent,
        exceeded: budgetAmount !== null ? spent > budgetAmount : false
    });
});

function auth(req, res, next) {
    const h = req.headers.authorization || "";
    const m = h.match(/^Bearer (.+)$/);
    if (!m) return res.status(401).json({ error: "No token" });

    try {
        const payload = jwt.verify(m[1], process.env.JWT_SECRET);
        req.user = payload; // { id, email }
        next();
    } catch (e) {
        return res.status(401).json({ error: "Bad token" });
    }
}

app.post("/auth/register", async (req, res) => {
    try {
        const username = String(req.body.username || "").trim();
        const email = String(req.body.email || "").trim().toLowerCase();
        const password = String(req.body.password || "");

        if (!username || username.length < 3) {
            return res.status(400).json({ error: "Username must have at least 3 characters" });
        }

        const emailOk = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
        if (!emailOk) {
            return res.status(400).json({ error: "Bad email" });
        }

        if (password.length < 6) {
            return res.status(400).json({ error: "Password too short (min 6)" });
        }

        const existsEmail = await pool.query(
            "SELECT id FROM users WHERE email = $1",
            [email]
        );
        if (existsEmail.rows.length) {
            return res.status(409).json({ error: "Email already used" });
        }

        const existsUsername = await pool.query(
            "SELECT id FROM users WHERE username = $1",
            [username]
        );
        if (existsUsername.rows.length) {
            return res.status(409).json({ error: "Username already used" });
        }

        const hash = await bcrypt.hash(password, 10);

        const r = await pool.query(
            "INSERT INTO users (username, email, password_hash) VALUES ($1, $2, $3) RETURNING id, username, email",
            [username, email, hash]
        );

        const user = r.rows[0];
        const token = jwt.sign(
            { id: user.id, email: user.email, username: user.username },
            process.env.JWT_SECRET,
            { expiresIn: "7d" }
        );

        res.json({ user, token });
    } catch (e) {
        res.status(500).json({ error: "Register failed" });
    }
});

app.post("/auth/login", async (req, res) => {
    try {
        const login = String(req.body.login || "").trim();
        const password = String(req.body.password || "");

        if (!login || !password) {
            return res.status(400).json({ error: "Missing data" });
        }

        const r = await pool.query(
            "SELECT id, username, email, password_hash FROM users WHERE email = $1 OR username = $1",
            [login.toLowerCase()]
        );

        if (!r.rows.length) {
            const r2 = await pool.query(
                "SELECT id, username, email, password_hash FROM users WHERE username = $1",
                [login]
            );

            if (!r2.rows.length) {
                return res.status(401).json({ error: "Wrong login or password" });
            }

            const u2 = r2.rows[0];
            const ok2 = await bcrypt.compare(password, u2.password_hash);
            if (!ok2) {
                return res.status(401).json({ error: "Wrong login or password" });
            }

            const token2 = jwt.sign(
                { id: u2.id, email: u2.email, username: u2.username },
                process.env.JWT_SECRET,
                { expiresIn: "7d" }
            );

            return res.json({
                user: { id: u2.id, username: u2.username, email: u2.email },
                token: token2
            });
        }

        const u = r.rows[0];
        const ok = await bcrypt.compare(password, u.password_hash);
        if (!ok) {
            return res.status(401).json({ error: "Wrong login or password" });
        }

        const token = jwt.sign(
            { id: u.id, email: u.email, username: u.username },
            process.env.JWT_SECRET,
            { expiresIn: "7d" }
        );

        res.json({
            user: { id: u.id, username: u.username, email: u.email },
            token
        });
    } catch (e) {
        res.status(500).json({ error: "Login failed" });
    }
});

app.get("/auth/me", auth, async (req, res) => {
    const r = await pool.query(
        "SELECT id, username, email FROM users WHERE id = $1",
        [req.user.id]
    );

    if (!r.rows.length) {
        return res.status(404).json({ error: "User not found" });
    }

    res.json({ user: r.rows[0] });
});

// ===== EXPENSES =====

// получить все расходы
app.get("/expenses", auth, async (req, res) => {
    const { from, to } = req.query;

    let sql = `
        SELECT e.id, c.name AS category, e.amount, e.note, e.created_at, e.category_id
        FROM expenses e
                 LEFT JOIN categories c ON e.category_id = c.id
    `;
    const params = [];
    const where = [];

    params.push(req.user.id);
    where.push(`e.user_id = $${params.length}`);

    if (from) {
        params.push(from);
        where.push(`e.created_at >= $${params.length}::date`);
    }
    if (to) {
        params.push(to);
        where.push(`e.created_at < ($${params.length}::date + INTERVAL '1 day')`);
    }

    sql += " WHERE " + where.join(" AND ");
    sql += " ORDER BY e.created_at DESC, e.id DESC";

    const r = await pool.query(sql, params);
    res.json(r.rows);
});

// добавить расход
app.post("/expenses", auth, async (req, res) => {
    const { category_id, amount, note } = req.body;

    const parsedCategoryId = Number(category_id);
    const parsedAmount = positiveAmount(amount);
    if (!Number.isInteger(parsedCategoryId) || parsedAmount === null) {
        return res.status(400).json({ error: "A category and a positive amount are required" });
    }

    const result = await pool.query(
        "INSERT INTO expenses (user_id, category_id, amount, note) VALUES ($1, $2, $3, $4) RETURNING *",
        [req.user.id, parsedCategoryId, parsedAmount, note]
    );

    res.json(result.rows[0]);
});

app.delete("/expenses/:id", auth, async (req, res) => {
    const id = Number(req.params.id);

    const r = await pool.query(
        "DELETE FROM expenses WHERE id = $1 AND user_id = $2",
        [id, req.user.id]
    );

    res.json({ status: r.rowCount ? "deleted" : "not_found" });
});

app.put("/expenses/:id", auth, async (req, res) => {
    const id = Number(req.params.id);
    const { category_id, amount, note } = req.body;
    const parsedCategoryId = Number(category_id);
    const parsedAmount = positiveAmount(amount);

    if (!Number.isInteger(parsedCategoryId) || parsedAmount === null) {
        return res.status(400).json({ error: "A category and a positive amount are required" });
    }

    const result = await pool.query(
        `UPDATE expenses
         SET category_id=$1, amount=$2, note=$3
         WHERE id=$4 AND user_id=$5
             RETURNING *`,
        [parsedCategoryId, parsedAmount, note, id, req.user.id]
    );

    if (!result.rows.length) {
        return res.status(404).json({ error: "Expense not found" });
    }

    res.json(result.rows[0]);
});


app.get("/incomes", auth, async (req, res) => {
    const { from, to } = req.query;

    let sql = `SELECT id, category, amount, note, created_at FROM incomes`;
    const params = [];
    const where = [];

    params.push(req.user.id);
    where.push(`user_id = $${params.length}`);

    if (from) {
        params.push(from);
        where.push(`created_at >= $${params.length}::date`);
    }
    if (to) {
        params.push(to);
        where.push(`created_at < ($${params.length}::date + INTERVAL '1 day')`);
    }

    sql += " WHERE " + where.join(" AND ");
    sql += " ORDER BY created_at DESC, id DESC";

    const r = await pool.query(sql, params);
    res.json(r.rows);
});

app.post("/incomes", auth, async (req, res) => {
    const { category, amount, note } = req.body;
    const parsedAmount = positiveAmount(amount);

    if (!category || parsedAmount === null) {
        return res.status(400).json({ error: "A category and a positive amount are required" });
    }

    const result = await pool.query(
        "INSERT INTO incomes (user_id, category, amount, note) VALUES ($1, $2, $3, $4) RETURNING *",
        [req.user.id, category, parsedAmount, note]
    );

    res.json(result.rows[0]);
});

app.delete("/incomes/:id", auth, async (req, res) => {
    const id = Number(req.params.id);

    const r = await pool.query(
        "DELETE FROM incomes WHERE id = $1 AND user_id = $2",
        [id, req.user.id]
    );

    res.json({ status: r.rowCount ? "deleted" : "not_found" });
});

app.put("/incomes/:id", auth, async (req, res) => {
    const id = Number(req.params.id);
    const { category, amount, note } = req.body;
    const parsedAmount = positiveAmount(amount);

    if (!category || parsedAmount === null) {
        return res.status(400).json({ error: "A category and a positive amount are required" });
    }

    const result = await pool.query(
        "UPDATE incomes SET category=$1, amount=$2, note=$3 WHERE id=$4 AND user_id=$5 RETURNING *",
        [category, parsedAmount, note, id, req.user.id]
    );

    if (!result.rows.length) {
        return res.status(404).json({ error: "Income not found" });
    }

    res.json(result.rows[0]);
});

app.get("/stats/expenses-by-category", auth, async (req, res) => {
    const { from, to } = req.query;

    let sql = `
        SELECT c.name AS category, COALESCE(SUM(e.amount),0) AS total
        FROM expenses e
                 JOIN categories c ON e.category_id = c.id
    `;
    const params = [];
    const where = [];

    params.push(req.user.id);
    where.push(`e.user_id = $${params.length}`);

    if (from) {
        params.push(from);
        where.push(`e.created_at >= $${params.length}::date`);
    }
    if (to) {
        params.push(to);
        where.push(`e.created_at < ($${params.length}::date + INTERVAL '1 day')`);
    }

    sql += " WHERE " + where.join(" AND ");
    sql += " GROUP BY c.name ORDER BY total DESC";

    const r = await pool.query(sql, params);
    res.json(r.rows);
});

app.get("/stats/cashflow-by-day", auth, async (req, res) => {
    const { from, to } = req.query;

    const params = [];
    const whereE = [];
    const whereI = [];

    params.push(req.user.id);
    whereE.push(`e.user_id = $${params.length}`);
    whereI.push(`i.user_id = $${params.length}`);

    if (from) {
        params.push(from);
        whereE.push(`e.created_at >= $${params.length}::date`);
        whereI.push(`i.created_at >= $${params.length}::date`);
    }
    if (to) {
        params.push(to);
        whereE.push(`e.created_at < ($${params.length}::date + INTERVAL '1 day')`);
        whereI.push(`i.created_at < ($${params.length}::date + INTERVAL '1 day')`);
    }

    const whereExpenses = "WHERE " + whereE.join(" AND ");
    const whereIncomes = "WHERE " + whereI.join(" AND ");

    const expenses = await pool.query(
        `SELECT DATE(e.created_at) AS day, COALESCE(SUM(e.amount),0) AS total
         FROM expenses e
         ${whereExpenses}
         GROUP BY DATE(e.created_at)
         ORDER BY day`,
        params
    );

    const incomes = await pool.query(
        `SELECT DATE(i.created_at) AS day, COALESCE(SUM(i.amount),0) AS total
         FROM incomes i
         ${whereIncomes}
         GROUP BY DATE(i.created_at)
         ORDER BY day`,
        params
    );

    const map = {};
    for (const x of expenses.rows) map[x.day] = { day: x.day, expenses: Number(x.total), incomes: 0 };
    for (const x of incomes.rows) {
        if (!map[x.day]) map[x.day] = { day: x.day, expenses: 0, incomes: 0 };
        map[x.day].incomes = Number(x.total);
    }

    const data = Object.values(map).sort((a, b) => String(a.day).localeCompare(String(b.day)));
    res.json(data);
});

function csvEscape(v) {
    if (v === null || v === undefined) return "";
    const s = String(v);
    // если есть запятая/кавычка/перевод строки — оборачиваем в "..."
    if (/[",\n\r]/.test(s)) return '"' + s.replace(/"/g, '""') + '"';
    return s;
}

function toCsv(headers, rows) {
    const lines = [];
    lines.push(headers.map(csvEscape).join(","));
    for (const r of rows) {
        lines.push(headers.map(h => csvEscape(r[h])).join(","));
    }
    return lines.join("\n");
}

app.get("/export/expenses.csv", auth, async (req, res) => {
    const { from, to } = req.query;

    let sql = `
        SELECT
            e.id,
            COALESCE(c.name, '') AS category,
            e.amount,
            COALESCE(e.note, '') AS note,
            e.created_at
        FROM expenses e
                 LEFT JOIN categories c ON e.category_id = c.id
    `;

    const params = [];
    const where = [];

    params.push(req.user.id);
    where.push(`e.user_id = $${params.length}`);

    if (from) {
        params.push(from);
        where.push(`e.created_at >= $${params.length}::date`);
    }
    if (to) {
        params.push(to);
        where.push(`e.created_at < ($${params.length}::date + INTERVAL '1 day')`);
    }

    sql += " WHERE " + where.join(" AND ");
    sql += " ORDER BY e.created_at DESC, e.id DESC";

    const r = await pool.query(sql, params);

    const headers = ["id", "category", "amount", "note", "created_at"];
    const csv = toCsv(headers, r.rows);

    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    res.setHeader("Content-Disposition", `attachment; filename="expenses.csv"`);
    res.send(csv);
});

app.get("/export/incomes.csv", auth, async (req, res) => {
    const { from, to } = req.query;

    let sql = `
        SELECT
            id,
            COALESCE(category, '') AS category,
            amount,
            COALESCE(note, '') AS note,
            created_at
        FROM incomes
    `;

    const params = [];
    const where = [];

    params.push(req.user.id);
    where.push(`user_id = $${params.length}`);

    if (from) {
        params.push(from);
        where.push(`created_at >= $${params.length}::date`);
    }
    if (to) {
        params.push(to);
        where.push(`created_at < ($${params.length}::date + INTERVAL '1 day')`);
    }

    sql += " WHERE " + where.join(" AND ");
    sql += " ORDER BY created_at DESC, id DESC";

    const r = await pool.query(sql, params);

    const headers = ["id", "category", "amount", "note", "created_at"];
    const csv = toCsv(headers, r.rows);

    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    res.setHeader("Content-Disposition", `attachment; filename="incomes.csv"`);
    res.send(csv);
});

const port = Number(process.env.PORT || 3000);

ensureDatabaseSchema()
    .then(() => {
        app.listen(port, () => {
            console.log(`Server started on port ${port}`);
        });
    })
    .catch((error) => {
        console.error("Database migration failed", error);
        process.exit(1);
    });
