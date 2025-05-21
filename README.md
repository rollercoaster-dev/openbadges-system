# OpenBadges System

> **Note:** This project is currently a Work In Progress (WIP).

An implementation of the OpenBadges standard for managing digital credentials.

## Tech Stack

- **Frontend**: Vue 3 with Vue Router, Pinia, and TailwindCSS
- **Backend**: Bun runtime with Hono framework
- **Package Management**: pnpm
- **Build Tool**: Vite

## Getting Started

### Prerequisites

- [Bun](https://bun.sh) (v1.2.10+) 
- [pnpm](https://pnpm.io/)
- [Docker](https://www.docker.com/) (optional, for containerized development)

### Installation

Clone the repository and install dependencies:

```bash
git clone https://github.com/rollercoaster-dev/openbadges-system.git
cd openbadges-system
pnpm install
```

### Running the Development Environment

Start both the client and server in development mode:

```bash
pnpm dev
```

This will start:
- Backend server using Bun (with hot reloading) at `http://localhost:3000`
- Frontend Vue app using Vite at `http://localhost:5173`

### Alternative Run Commands

Run only the server:

```bash
pnpm server
```

Run only the client:

```bash
pnpm client
```

### Docker Support

Start the containerized environment:

```bash
pnpm docker:up
```

Stop containers:

```bash
pnpm docker:down
```

View logs:

```bash
pnpm docker:logs
```

### Building for Production

Build the frontend for production:

```bash
pnpm build
```

Preview the production build:

```bash
pnpm preview
```

## Project Structure

```
openbadges-system/
├── src/
│   ├── client/           # Vue frontend
│   │   ├── assets/       # Static assets
│   │   ├── components/   # Vue components
│   │   ├── composables/  # Vue composables
│   │   ├── layouts/      # Page layouts
│   │   ├── pages/        # Vue pages/routes
│   │   └── stores/       # Pinia stores
│   └── server/           # Bun + Hono backend
├── docker-compose.yml    # Docker configuration
├── package.json          # Project dependencies & scripts
└── vite.config.js        # Vite configuration
```

## License

[MIT](LICENSE)
