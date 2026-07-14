CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,
    username TEXT NOT NULL UNIQUE,
    email TEXT NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE users ADD COLUMN IF NOT EXISTS username TEXT;

UPDATE users
SET username = split_part(email, '@', 1) || '_' || id
WHERE username IS NULL OR username = '';

CREATE UNIQUE INDEX IF NOT EXISTS idx_users_username_unique
    ON users(username);

ALTER TABLE users ALTER COLUMN username SET NOT NULL;

CREATE TABLE IF NOT EXISTS categories (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    type TEXT NOT NULL CHECK (type IN ('expense', 'income')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (user_id, type, name)
);

CREATE TABLE IF NOT EXISTS expenses (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    category_id INTEGER REFERENCES categories(id) ON DELETE SET NULL,
    amount NUMERIC(12, 2) NOT NULL CHECK (amount >= 0),
    note TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE expenses
    ALTER COLUMN amount TYPE NUMERIC(12, 2) USING amount::NUMERIC(12, 2);

CREATE INDEX IF NOT EXISTS idx_expenses_user_created_at
    ON expenses(user_id, created_at DESC);

CREATE TABLE IF NOT EXISTS incomes (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    category TEXT NOT NULL,
    amount NUMERIC(12, 2) NOT NULL CHECK (amount >= 0),
    note TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE incomes
    ALTER COLUMN amount TYPE NUMERIC(12, 2) USING amount::NUMERIC(12, 2);

CREATE INDEX IF NOT EXISTS idx_incomes_user_created_at
    ON incomes(user_id, created_at DESC);

CREATE TABLE IF NOT EXISTS budgets (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    month DATE NOT NULL,
    amount NUMERIC(12, 2) NOT NULL CHECK (amount >= 0),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (user_id, month)
);

ALTER TABLE budgets
    ALTER COLUMN amount TYPE NUMERIC(12, 2) USING amount::NUMERIC(12, 2);
