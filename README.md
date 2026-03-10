# Student Expense Tracker

Project for the course **Extrémne programovanie**.

Stack:
- React (Vite)
- Node.js + Express
- PostgreSQL
- Docker Compose

Features:
- Track expenses
- Track income
- Categories
- Budget
- Statistics

## Run Full Project With Docker Compose

From the project root:

```bash
docker compose up --build
```

Services:
- Frontend: http://localhost:5173
- Backend API: http://localhost:3000
- PostgreSQL: localhost:5432 (`app` / `app`, DB `expenses`)

Stop all containers:

```bash
docker compose down
```
