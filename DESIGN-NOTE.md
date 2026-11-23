# StockDesk – Security Design Note

## 1. Objective and Scope

The objective was to reduce security risks in the existing StockDesk application and delivery pipeline before external supplier access.

The work focused on credential exposure, CI/CD security, container hardening, Kubernetes isolation, and application access.

## 2. Assumptions and Constraints

The design follows the company's clarifications:

- Repository credentials may have been used in production and are treated as compromised.
- Approximately 40 people, including an external contractor, can read the repository and open pull requests. Forks are also permitted.
- Existing Kubernetes credential permissions and LoadBalancer Internet reachability are unknown.
- Staff use the office network and VPN to access StockDesk.
- An internal script uses the shared API key.
- Docker Compose is still running on a shared developer test server with undocumented user permissions.
- Supplier permissions and the final deployment architecture are undecided.
- The former contractor may still have access to the original deployment action repository.
- The actual database address and ingress-controller namespace are unknown.

No production cluster or registry access, or authority to rotate credentials, was provided. Unknown infrastructure details are documented as assumptions rather than invented.

## 3. Main Design Decisions

**CI/CD separation:** Replaced the original privileged pull request workflow with `pull_request` validation using minimal permissions. Registry publishing and Kubernetes deployment are separated into trusted jobs triggered by pushes to `main`. This prevents deployment credentials from being exposed to pull request validation. Branch protection and code review remain administrative requirements.

**Deployment supply chain:** Removed `corvane-labs/k8s-deploy-action@main` and replaced it with explicit `kubectl` commands because the former contractor may still be able to modify the action. Organisation access and other workflows using it still require review.

**Kubernetes exposure:** Replaced the LoadBalancer Service with ClusterIP and proposed a controlled ingress or gateway with TLS. Existing office and VPN access must be preserved before migration. Supplier access should use a separately controlled path.

**Application and container hardening:** Added `/livez` for process liveness and retained `/health` for database connectivity. The container runs as non-root, while Kubernetes applies a read-only root filesystem, dropped capabilities, disabled privilege escalation, and RuntimeDefault seccomp.

**Supplier access:** Recommended individual supplier identities and authenticated read-only access initially. The current GET endpoint is unauthenticated, and stock adjustment uses a shared API key. Supplier authentication and authorization must be implemented before external exposure.

# StockDesk – Security Design Note

## 1. Objective and Scope

The objective was to reduce security risks in the existing StockDesk application and delivery pipeline before external supplier access.

The work focused on credential exposure, CI/CD security, container hardening, Kubernetes isolation, and application access.

## 2. Assumptions and Constraints

The design follows the company's clarifications:

- Repository credentials may have been used in production and are treated as compromised.
- Approximately 40 people, including an external contractor, can read the repository and open pull requests. Forks are also permitted.
- Existing Kubernetes credential permissions and LoadBalancer Internet reachability are unknown.
- Staff use the office network and VPN to access StockDesk.
- An internal script uses the shared API key.
- Docker Compose is still running on a shared developer test server with undocumented user permissions.
- Supplier permissions and the final deployment architecture are undecided.
- The former contractor may still have access to the original deployment action repository.
- The actual database address and ingress-controller namespace are unknown.

No production cluster or registry access, or authority to rotate credentials, was provided. Unknown infrastructure details are documented as assumptions rather than invented.

## 3. Main Design Decisions

**CI/CD separation:** Replaced the original privileged pull request workflow with `pull_request` validation using minimal permissions. Registry publishing and Kubernetes deployment are separated into trusted jobs triggered by pushes to `main`. This prevents deployment credentials from being exposed to pull request validation. Branch protection and code review remain administrative requirements.

**Deployment supply chain:** Removed `corvane-labs/k8s-deploy-action@main` and replaced it with explicit `kubectl` commands because the former contractor may still be able to modify the action. Organisation access and other workflows using it still require review.

**Kubernetes exposure:** Replaced the LoadBalancer Service with ClusterIP and proposed a controlled ingress or gateway with TLS. Existing office and VPN access must be preserved before migration. Supplier access should use a separately controlled path.

**Application and container hardening:** Added `/livez` for process liveness and retained `/health` for database connectivity. The container runs as non-root, while Kubernetes applies a read-only root filesystem, dropped capabilities, disabled privilege escalation, and RuntimeDefault seccomp.

**Supplier access:** Recommended individual supplier identities and authenticated read-only access initially. The current GET endpoint is unauthenticated, and stock adjustment uses a shared API key. Supplier authentication and authorization must be implemented before external exposure.

## 4. Verification

The application tests were executed locally using Node.js 18.20.8 and npm 10.8.2.

**Result: 10 tests passed, 0 failed.**

Tests cover product retrieval, liveness, database connectivity responses, API-key validation, stock adjustment validation, oversized requests, and safe configuration logging.

The GitHub Actions workflow and Kubernetes deployment were not verified against company infrastructure. Docker builds, security scans, and cluster-level NetworkPolicy enforcement also require target-environment verification.

## 5. Remaining Work and Limitations

Before production use, administrators must:

- Revoke and rotate exposed credentials, review historical copies, and coordinate API key replacement with the internal script owner.
- Review shared test-server access, stored credentials, containers, and persistent data.
- Verify Kubernetes RBAC, database connectivity, ingress configuration, and NetworkPolicy enforcement.
- Protect the `main` branch and GitHub deployment Environment.
- Revoke or verify the former contractor's access to the deployment action repository.
- Preserve staff office and VPN access.
- Implement supplier authentication, authorization, TLS, and rate limiting.

Dependabot is configured to propose dependency updates. Third-party actions and scanner images still use version-specific tags rather than verified immutable SHAs or digests; immutable pinning remains follow-up work. The database health check verifies TCP connectivity only, not database authentication or SQL execution.

## 6. Responsible Use of AI

AI tools were used as engineering assistants to review configurations, explore mitigation strategies, and understand unfamiliar Kubernetes and CI/CD concepts. Suggestions were reviewed rather than accepted automatically. I retained responsibility for the technical decisions and final changes and ran the application tests locally.

No real credentials were intentionally included in AI prompts or generated deliverables.

## 5. Remaining Work and Limitations

Before production use, administrators must:

- Revoke and rotate exposed credentials, review historical copies, and coordinate API key replacement with the internal script owner.
- Review shared test-server access, stored credentials, containers, and persistent data.
- Verify Kubernetes RBAC, database connectivity, ingress configuration, and NetworkPolicy enforcement.
- Protect the `main` branch and GitHub deployment Environment.
- Revoke or verify the former contractor's access to the deployment action repository.
- Preserve staff office and VPN access.
- Implement supplier authentication, authorization, TLS, and rate limiting.

Dependabot is configured to propose dependency updates. Third-party actions and scanner images still use version-specific tags rather than verified immutable SHAs or digests; immutable pinning remains follow-up work. The database health check verifies TCP connectivity only, not database authentication or SQL execution.

## 6. Responsible Use of AI

AI tools were used as engineering assistants to review configurations, explore mitigation strategies, and understand unfamiliar Kubernetes and CI/CD concepts. Suggestions were reviewed rather than accepted automatically. I retained responsibility for the technical decisions and final changes and ran the application tests locally.

No real credentials were intentionally included in AI prompts or generated deliverables.
