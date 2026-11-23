# StockDesk – Security Risk Assessment

## 1. Scope and Assumptions

This assessment is based on the supplied project and the company's clarifications.

- Repository credentials are treated as compromised because they may have been used in production.
- Approximately 40 people, including an external contractor, can read the repository, open pull requests, and create permitted forks.
- The former contractor may still be able to push to `corvane-labs/k8s-deploy-action`.
- Existing Kubernetes credential permissions have not been verified.
- Staff currently access StockDesk through the office network and VPN using the LoadBalancer address. Its external Internet reachability is unknown.
- An internal script also calls the API using the shared API key.
- The Docker Compose stack is still running on a shared developer test server, but its other users and access permissions are undocumented.
- Supplier permissions are undecided. The proposed initial model is read-only access.
- The actual database address and ingress-controller namespace are unknown.

## 2. Prioritized Risks

| ID | Risk | Severity | Status |
|---|---|---|---|
| R1 | Exposed application credentials and historical copies | Critical | Rotation required |
| R2 | Privileged execution of untrusted pull request code | Critical | Addressed in proposed workflow |
| R3 | Former contractor may modify deployment action | Critical | Removed from our workflow; organisation action required |
| R4 | Supplier authorization and shared API key model undefined | High / Critical | Recommendation documented; implementation required |
| R5 | Kubernetes deployment permissions unverified | High | Namespace-scoped RBAC proposed |
| R6 | Potentially exposed application endpoint | High | ClusterIP introduced; replacement access path required |
| R7 | Shared test-server access and stored credentials | High | Review required |
| R8 | Internal script depends on shared API key | High | Coordinated credential rotation required |
| R9 | Container privileges and debugging exposure | High | Hardened |
| R10 | Kubernetes network restrictions incomplete | High | Partially addressed |
| R11 | Mutable base images and third-party action references | Medium / High | Partially addressed |
| R12 | Application availability and request-handling weaknesses | Medium | Improved; limitations remain |

## 3. Key Risks and Mitigations

### R1 – Exposed Credentials

**Impact:** Repository readers could retrieve the committed database password and API key. The Kubernetes Secret values were Base64-encoded, not encrypted.

**Changes:** Added environment-file exclusions, restricted the Docker build context, and removed the committed Kubernetes Secret manifest.

**Remaining action:** Administrators must revoke and rotate exposed credentials, update legitimate systems, review access logs, and address Git history, forks, clones, and CI logs. Removing files does not invalidate old credentials.

### R2 – Privileged Pull Request Execution

**Impact:** The original workflow combined `pull_request_target` with execution of pull request code, broad `write-all` permissions, and a hardcoded registry token. Malicious code could potentially misuse workflow permissions or steal the registry credential.

**Changes:** Replaced it with `pull_request`, limited workflow permissions to `contents: read`, and separated validation from trusted build and deployment jobs. Deployment credentials are not available to pull request validation.

**Remaining action:** Protect `main`, require reviews and successful checks, and review workflow changes carefully. Pull request code is still untrusted and can compromise its runner.

### R3 – Deployment Action Supply-Chain Risk

**Impact:** The original workflow used `corvane-labs/k8s-deploy-action@main`. The former contractor may still be able to push to that repository. A malicious modification could execute during deployment, where Kubernetes credentials are available.

**Changes:** Removed the third-party deployment action from the proposed workflow and replaced it with explicit `kubectl` commands.

**Remaining action:** Revoke the former contractor's access, audit the action's history, and check whether other workflows still use it. Any retained third-party action should be pinned to a verified full commit SHA.

### R4 – Supplier Authorization and Shared API Key

**Impact:** Supplier permissions are undecided. A shared key makes individual accountability and isolated revocation difficult. If it permits stock modifications, a compromised key could affect inventory integrity.

**Recommendation:** Start with read-only supplier access. Give suppliers individual identities and credentials. Enable stock adjustments only after explicit business approval and implementation of separate permissions and audit logging.

**Remaining action:** The current `GET /api/products` endpoint has no authentication, while stock adjustment uses one shared `API_KEY`. Supplier access controls must be implemented before external exposure.

### R5 – Kubernetes Deployment Permissions

**Impact:** Excessive CI permissions could allow a compromised pipeline to modify workloads beyond its intended scope.

**Changes:** Added a namespace-scoped `ci-deployer` Role and RoleBinding, separate from the application's runtime ServiceAccount.

**Remaining risk:** The CI identity can modify Deployments. Although it has no direct Secret-read permission, it may gain indirect access by changing a workload to mount a Secret. Actual permissions must be reviewed.

### R6 – Existing Application Exposure and Access Paths

**Impact:** Staff currently depend on the LoadBalancer address through the office network and VPN. Its Internet reachability has not been checked. Changing the Service to ClusterIP without an alternative access path could interrupt existing staff access.

**Changes:** Replaced the LoadBalancer Service with ClusterIP and proposed a controlled ingress or gateway with TLS.

**Remaining action:** Verify current reachability and preserve staff access through an appropriate internal ingress or gateway before rollout. Supplier access should use a separately controlled path. A separate production environment is preferable to exposing the shared test cluster directly.

### R7 – Shared Developer Test Server

**Impact:** The Docker Compose stack remains on a shared developer test server. Other users and their access permissions are undocumented. Users with access to the server or Docker daemon may be able to inspect environment variables, containers, configuration files, or persistent database data.

**Changes:** Hardened the Compose configuration by binding the application port to localhost, removing the published database port, and moving debugging to an optional local override.

**Remaining action:** Identify server users, restrict administrative and Docker daemon access, inspect environment files, containers and volumes, and rotate credentials that may have been exposed.

### R8 – Internal Script Depends on Shared API Key

**Impact:** The shared API key is also used by an internal script. Rotating it without updating the script could interrupt the integration. Continuing to use a shared key also limits individual accountability.

**Recommendation:** Identify the script owner and provision a replacement credential. Update and verify the script before revoking the old key. Longer term, use a dedicated credential with only the permissions the script requires.

**Remaining action:** The script's owner, execution environment, and required permissions must be confirmed. Credential separation has not yet been implemented.

## 4. Other Important Risks

| Risk | Changes and Remaining Limitations |
|---|---|
| Root container and debugger | Runs as non-root; production inspector removed; Kubernetes privilege escalation disabled and capabilities dropped. |
| Network access | Added default-deny NetworkPolicy and explicit rules. Ingress namespace and database destination remain assumptions; database egress is still broad on port 5432. CNI enforcement must be verified. |
| Mutable references | Application image uses a commit-specific tag and deployment digest. Base image and third-party actions still need verified immutable pinning. |
| Request body size | Added a 16 KB limit; oversized requests receive HTTP 413. |
| Health checks | Separated `/livez` and `/health`. Database health currently tests TCP connectivity only, not authentication or SQL queries. |
| Availability | Increased replicas to two and added a PDB with `minAvailable: 1`. These do not prevent involuntary failures. |
| Compose exposure | Application port bound to localhost, database port no longer published, debugging moved to an optional local override. |
| CI reliability | Removed `npm test || true` and unsafe pull-request-title interpolation. |

## 5. Required Administrative Actions

Before production use:

1. **Revoke exposed credentials.** Disable the old privileged workflow and revoke the exposed registry token. Inspect relevant CI logs and registry activity.
2. **Replace Kubernetes deployment credentials.** Revoke the existing `KUBECONFIG` credential and provision a new namespace-scoped CI identity. Verify its effective permissions.
3. **Rotate the database password.** Update the database and every legitimate consumer, including the Kubernetes Secret and any active Compose environment.
4. **Coordinate API key replacement.** Identify the internal script owner, issue a replacement credential, update and test the script and other legitimate clients, then revoke the old shared key.
5. **Review historical exposure.** Inspect Git history, forks, clones, CI logs, and relevant audit logs. History cleanup does not replace credential rotation.
6. **Review the shared test server.** Identify users, Docker permissions, environment files, containers, and persistent volumes.
7. **Revoke former contractor access.** Review organisation and action-repository permissions, audit the deployment action's history, and check other workflows that reference it.
8. **Protect `main`.** Require reviews and successful checks.
9. **Verify Kubernetes networking.** Confirm the database destination, ingress namespace, and NetworkPolicy enforcement.
10. **Implement supplier authentication and authorization.** Start with individual read-only identities and credentials.
11. **Preserve staff access.** Configure and verify the replacement internal access path before removing the existing LoadBalancer path.
12. **Configure ingress security.** Use TLS, controlled access, and appropriate rate limiting.
13. **Verify the target environment.** Run the workflow and deployment tests against the actual registry and cluster before production use.

Credential rotation must be coordinated with the owners of dependent services to avoid unnecessary outages. The sequence above is an administrative remediation plan, not work completed by this exercise.

## 6. Overall Assessment

The highest-priority risks are exposed credentials, privileged pull request execution, and the potentially compromised deployment action. The shared test server and internal script also introduce operational risks that must be addressed before credential rotation and external exposure.

The proposed changes reduce these risks in the project configuration. However, credential rotation, access revocation, supplier authorization, shared-server review, and cluster-specific verification require administrator involvement.

StockDesk should not be exposed to suppliers until these actions are completed.