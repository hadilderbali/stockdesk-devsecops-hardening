# StockDesk – Threat Model

## 1. Scope and Assets

StockDesk is a Node.js stock-tracking API planned for external supplier access.

The main assets to protect are:
- Database credentials, API keys, and application data.
- Supplier identities and stock integrity.
- Kubernetes and registry credentials.
- Application images and the CI/CD pipeline.
- Staff access through the office network and VPN.
- The internal script using the shared API key.
- The shared developer test server and its persistent data.

## 2. Potential Attackers

- **Repository readers and former contractors:** May access committed credentials, historical files, or modify the original deployment action if access remains.
- **Malicious pull request authors:** Can submit attacker-controlled code through permitted pull requests.
- **Shared-server users:** May inspect application configuration, containers, environment variables, or stored data depending on their permissions.
- **External attackers and compromised dependencies:** May target exposed endpoints, infrastructure, or the software supply chain.

## 3. Main Attack Paths

### 1. Credential Theft and Repository Exposure

**Attack:** A repository reader extracts credentials from committed `.env`, Compose, or Kubernetes files, or retrieves historical copies.

**Impact:** Unauthorized database access or API operations while the credentials remain valid.

**Mitigations:**
- Exclude environment files from Git and Docker build contexts.
- Remove the committed Kubernetes Secret manifest.
- Keep application secrets outside the repository.
- Rotate exposed credentials and review historical exposure.

**Residual risk:** Credentials may remain in Git history, forks, clones, and CI logs. Administrative rotation and access-log review are still required.

### 2. Malicious CI Execution and Deployment Supply-Chain Compromise

**Attack:** An attacker submits malicious pull request code or modifies the original `corvane-labs/k8s-deploy-action` if former contractor access remains.

**Impact:** The original privileged workflow could expose registry credentials or misuse workflow permissions. A compromised deployment action could potentially steal Kubernetes credentials.

**Mitigations:**
- Use `pull_request` for validation with restricted permissions.
- Keep deployment credentials out of pull request jobs.
- Build and deploy only after a push to `main`.
- Remove the third-party deployment action and use explicit `kubectl` commands.

**Residual risk:** Pull request code can still compromise its runner. Branch protection, code review, required checks, contractor access revocation, and action-history review remain necessary.

### 3. Application, Container, and Shared-Server Compromise

**Attack:** An attacker exploits the application or a dependency, or a user with access to the shared developer test server inspects its Compose stack, environment variables, containers, or persistent volumes.

**Impact:** Exposure of credentials and application data, unauthorized container operations, or further access to internal services.

**Mitigations:**
- Run containers as non-root with a read-only root filesystem.
- Drop Linux capabilities and disable privilege escalation.
- Remove the production debugger.
- Restrict pod network traffic and disable automatic application ServiceAccount token mounting.
- Bind the local application port to localhost and avoid publishing the database port.

**Residual risk:** These controls reduce impact but do not eliminate application exploits or container escape. Shared-server permissions, Docker daemon access, stored credentials, database egress, and NetworkPolicy enforcement must be reviewed.

### 4. Unauthorized API Operations and Integration Disruption

**Attack:** A supplier or attacker obtains the shared API key and attempts stock adjustments. Alternatively, administrators rotate the key without updating the internal script that depends on it.

**Impact:** Unauthorized inventory changes, limited accountability, or interruption of the internal integration.

**Mitigations:**
- Begin with authenticated, read-only supplier access.
- Give each supplier an individual identity and credential.
- Deny supplier stock adjustments initially.
- Identify the internal script owner, issue a replacement credential, update and test the script, then revoke the old key.
- Introduce audit logging for authorized stock modifications.

**Residual risk:** `GET /api/products` currently has no authentication, while stock adjustment uses a shared API key. Supplier authentication, authorization, and credential separation are not implemented. External supplier access must remain disabled until these controls are ready.

## 4. Supplier Access Recommendation

| Operation | Initial recommendation |
|---|---|
| `GET /api/products` | Authenticated read-only access |
| `POST /api/products/:sku/adjust` | Deny supplier access initially |

Stock adjustments should only be enabled after explicit business approval, individual permissions, and audit logging.

## 5. Operational Consideration: Staff Access

Replacing the existing LoadBalancer with ClusterIP without configuring an alternative access path could interrupt staff access through the office network and VPN.

A controlled internal ingress or gateway should preserve staff access. Supplier access should use a separately controlled path. The existing LoadBalancer's Internet reachability and the final network architecture must be verified before migration.

## 6. Conclusion

The main threats are credential theft, malicious CI execution, deployment supply-chain compromise, application and shared-server compromise, and unauthorized API operations.

The proposed changes reduce the attack surface and limit the privileges available to compromised components. Production exposure still depends on credential rotation, access revocation, verified infrastructure configuration, preservation of existing integrations, and an approved supplier authorization model.