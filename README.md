# Student Expense Tracker

Full-stack personal finance application for recording income and expenses, organizing transactions by category, setting a budget, and reviewing spending statistics. Built as a course project with a containerized local environment.

## Features

- Record income and expense transactions
- Organize transactions by category
- Track a personal budget
- Review financial statistics
- Run the complete stack with one Docker Compose command

## Tech stack

- **Frontend:** React, Vite, JavaScript
- **Backend:** Node.js, Express
- **Database:** PostgreSQL
- **Infrastructure:** Docker, Docker Compose

## Run locally

From the project root:

    docker compose up --build

The services will be available at:

- Frontend: http://localhost:5173
- Backend API: http://localhost:3000
- PostgreSQL: localhost:5432

Stop the stack with:

    docker compose down
