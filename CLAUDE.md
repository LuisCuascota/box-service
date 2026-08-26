# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
# Local development
npm run dev              # Start serverless offline (localhost)

# Linting & formatting
npm run lint             # Run lint:fix + format + eslint
npm run lint:fix         # Auto-fix ESLint errors
npm run format           # Run Prettier

# Deploy
npm run deploy           # Deploy to AWS via Serverless Framework
```

There is no configured test runner script — `jest.config.js` is empty. Tests use Jest + ts-jest and can be run with `npx jest` or `npx jest <path>`.

Node.js >= 24 is required.

## Architecture

This is a **savings cooperative management backend** (Caja de Oro) built as AWS Lambda functions using the Serverless Framework. It manages members (Person), savings deposits (Entry), loans, and withdrawals (Egress).

### Request flow

```
HTTP → Lambda Handler → Service (via Inversify DI) → MySQL Gateway → DB
```

1. **`src/handler/`** — Thin Lambda handlers. Each exported function calls `processResponse()` which wraps a service Observable and adds CORS headers.
2. **`src/service/`** — Business logic. All methods return RxJS `Observable<T>`. Uses Knex for SQL query building.
3. **`src/repository/`** — TypeScript interfaces that services implement (IPersonService, IEntryService, etc.).
4. **`src/gateway/MySQLGateway.ts`** — Single injectable gateway. Opens a MySQL connection, runs a query, returns `Observable<T[]>`, destroys connection.
5. **`src/infraestructure/Container.ts`** — Inversify IoC container. Binds all service interfaces to implementations and the gateway. Import from here to get service instances.

### Dependency injection pattern

All services and the gateway are decorated with `@injectable()`. The container in `src/infraestructure/Container.ts` binds everything. Handlers import the container and call `.get<IService>(IDENTIFIERS.ServiceName)`.

### Reactive pattern

All async operations use RxJS Observables (not Promises). Services use Knex to build SQL, pass it to the gateway, and pipe through RxJS operators. `rxjs-spy` tags are used throughout for debugging.

### Database

MySQL via `promise-mysql` + Knex query builder. Table names are defined in `src/infraestructure/Tables.enum.ts`. Local DB config is at `src/environment/DBConfig.env.dev.ts` (localhost, user: root, db: `cepo_de_oro`).

### Authentication

AWS Cognito JWT verification via `aws-jwt-verify`. The verifier is in `src/utils/Verifier.utils.ts`. Auth is bypassed in local development (`isOffline = true`).

### Business configuration

Fixed business constants (contribution amount, penalty rates, etc.) live in `src/environment/BoxConfig.env.ts`.

## Available skills and agents

**Skills** (invoke with `/skill-name`):

- `/modify-domain` — guide for modifying existing domain functionality (services, handlers, interfaces)

**Agents** (in `.claude/agents/`):

- `financial-calculator` — validates financial formulas: contributions, penalties, loan fees, participation rates
- `business-rules-validator` — validates business rules: entity invariants, flow constraints, edge cases
- `code-generator` — generates TypeScript code following the project architecture

## Workflow rules

When implementing any feature that changes domain logic, business rules, or financial calculations, **always update the affected agents** in `.claude/agents/` as part of the same implementation:

- `financial-calculator` — if formulas, amounts, or calculation logic change
- `business-rules-validator` — if invariants, states, or flow rules change
- `code-generator` — if new tables, enums, or architectural patterns are introduced

Agents must always reflect the current state of the system, not a past version.

## Code style

- Double quotes, semicolons, 2-space indent (enforced by ESLint + Prettier)
- Unused variables must be prefixed with `_`
- TypeScript strict mode enabled; experimental decorators and decorator metadata are on (required for Inversify)
- ESLint uses the flat config format (`eslint.config.js`)
