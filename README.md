# StockDesk – DevSecOps Security Hardening

## Overview

StockDesk is a small Node.js stock-tracking API used for this DevSecOps security hardening exercise.

The objective is to reduce security risks before the application is exposed to external suppliers by hardening the application, CI/CD pipeline, Docker configuration, and Kubernetes deployment.

## Security Improvements

### Application
- Added `/livez` for application process liveness.
- Kept `/health` as a database connectivity check.
- Added a 16 KB request body limit.
- Prevented database passwords and API keys from appearing in configuration logs.
- Added tests for the new security behavior.

### Docker
- Replaced `node:latest` with a Node.js 24 Alpine image.
- Runs the application as a non-root user.
- Removed the debugging port and Node.js inspector from the production image.
- Copies only the application files required at runtime.
- Added `.dockerignore` to exclude unnecessary and sensitive files from the build context.

### Kubernetes
- Added a dedicated `stockdesk` namespace with restricted Pod Security settings.
- Runs the application with a read-only root filesystem, dropped Linux capabilities, and no privilege escalation.
- Added resource requests and limits.
- Separated liveness and readiness probes.
- Replaced the LoadBalancer Service with an internal ClusterIP Service.
- Added NetworkPolicy and PodDisruptionBudget manifests.
- Added namespace-scoped RBAC for the CI deployment identity.

### CI/CD
- Uses pull request validation without registry or Kubernetes deployment credentials.
- Builds and deploys only after a push to `main`.
- Runs tests, secret scanning, and configuration scanning.
- Scans the built image and generates a Software Bill of Materials (SBOM).
- Uses commit-specific image tags and passes the pushed image digest to Kubernetes.
- Keeps registry and Kubernetes credentials in GitHub Actions Secrets and the protected deployment Environment.
- Configures Dependabot to propose dependency updates.
- Uses version-specific tags for third-party actions and scanner images; immutable SHA/digest pinning remains a recommended improvement.

## Project Structure

```text
.
├── .github/
│   ├── workflows/
│   │   └── ci.yml
│   └── dependabot.yml
├── k8s/
│   ├── admin/
│   │   ├── namespace.yaml
│   │   └── ci-deployer-rbac.yaml
│   ├── deployment.yaml
│   ├── networkpolicy.yaml
│   └── pdb.yaml
├── src/
│   ├── db.js
│   └── server.js
├── test/
│   └── server.test.js
├── .dockerignore
├── .env.example
├── .gitignore
├── Dockerfile
├── docker-compose.yml
├── docker-compose.debug.yml
├── package.json
├── RISKS.md
├── THREAT-NOTE.md
├── DESIGN-NOTE.md
└── README.md
```

## Run Locally

### Run with Docker Compose

Requirements:
- Docker Engine
- Docker Compose

Create a local `.env` file using `.env.example` as a template. Replace the placeholder credentials with local development values. Do not commit the `.env` file.

Start the application and database:

```bash
docker compose up --build
```

The API is available at:

`http://localhost:3000`

To stop the services:

```bash
docker compose down
```

The `.env` file is passed to the application by Docker Compose. Running `node src/server.js` directly does not automatically load `.env`; environment variables must be provided separately.

### Run Tests

Requirements:
- Node.js 18 or newer
- npm

Run:

```bash
npm test
```

## Available Endpoints

| Method | Endpoint | Purpose |
|---|---|---|
| GET | `/livez` | Application process health |
| GET | `/health` | Database TCP connectivity |
| GET | `/api/products` | List products |
| POST | `/api/products/:sku/adjust` | Adjust product stock |

The stock adjustment endpoint requires the `x-api-key` request header.

**Supplier access limitation:** The product-listing endpoint currently has no authentication, while stock adjustment uses a shared API key. Individual supplier identities, authenticated read access, and role-based permissions must be implemented before external supplier access is enabled. The recommended initial supplier permission model is read-only.

## Deployment Prerequisites

Before deploying to Kubernetes, an authorized administrator must:

1. Create the `stockdesk` namespace and configure its Pod Security settings.
2. Create the `ci-deployer` ServiceAccount, Role, and RoleBinding.
3. Create the Kubernetes Secret named `stockdesk-env` with the required application environment variables.
4. Confirm the database address and configure the ingress controller and TLS.
5. Configure GitHub Actions credentials:
   - `DEPLOY_TOKEN`: registry authentication token.
   - `KUBECONFIG`: Kubernetes deployment credentials, stored in the `test-cluster` GitHub Environment.
6. Create and protect the `test-cluster` GitHub Environment.
7. Protect the `main` branch and require successful pull request checks and code review.

The CI workflow assumes that the namespace, deployment identity, application Secret, registry, and Kubernetes cluster are already configured.

## Important Limitations

- The database health check verifies TCP connectivity only; it does not authenticate or execute a SQL query.
- The actual Kubernetes database address and ingress-controller namespace must be confirmed.
- NetworkPolicy enforcement depends on the cluster's CNI plugin.
- The registry, cluster configuration, and deployment permissions must be verified in the target environment.
- The ClusterIP Service requires a suitable ingress or gateway. Existing office and VPN access must be preserved before changing the current LoadBalancer access path.
- Previously exposed credentials require administrator-led rotation and historical exposure review.
- The former contractor's access to the deployment action repository must be revoked or verified, and other uses of that action must be audited.
- Supplier authentication and authorization are not implemented; external supplier access must remain disabled until they are in place.
- Docker builds, security scans, and Kubernetes deployment must be executed and verified in the target environment before production use.

## Security Documentation

- `RISKS.md`: Prioritized risks and remediation actions.
- `THREAT-NOTE.md`: Assets, attackers, attack paths, and residual risks.
- `DESIGN-NOTE.md`: Architecture decisions, assumptions, verification, and limitations.