---
name: k8s-controller
description: >
  Expert guidance for writing high-performance, reliable Kubernetes controllers and operators using
  controller-runtime and Kubebuilder. Use this skill whenever the user is:
  - Writing or reviewing a Kubernetes controller or operator
  - Working with controller-runtime, Kubebuilder, or reconcilers
  - Designing CRDs (CustomResourceDefinitions)
  - Asking about finalizers, watches, predicates, or RBAC markers
  - Writing tests for a Kubernetes controller
  - Debugging reconciliation issues, missed events, or conflict errors
  - Asking about operator patterns, ownership, or concurrent reconciliation
  Invoke this skill even if the user doesn't say "controller" explicitly — questions about
  reconcile loops, kubebuilder markers, or operator testing all belong here.
---

# Kubernetes Controller Best Practices

This skill encodes production-proven patterns for building reliable, high-performance Kubernetes
controllers with controller-runtime and Kubebuilder.

## How to structure responses

For every topic you address — whether reviewing code, explaining a pattern, or guiding
implementation — always end with two things:

1. **Flow summary**: a short sequential diagram or bullet list showing the happy path and the
   deletion path (if applicable). This gives the reader a mental model of how the pieces connect.
   Example for finalizers:
   ```
   Object created → reconcileNormal: add finalizer → re-reconcile
   kubectl delete → Kubernetes sets DeletionTimestamp → reconcileDelete: cleanup → RemoveFinalizer → object gone
   ```

2. **Key rules checklist**: 4–8 bullet points that capture the must-follow constraints for the
   topic. Make them actionable and specific (e.g. "Remove the finalizer only after cleanup is
   confirmed, not before"). These help the reader self-review their own code.

When *reviewing* code, additionally produce a severity-tagged issues table (Critical / Important /
Moderate) with a corrected code snippet at the end.

---

## 1. Reconciler Fundamentals

### Level-based, not edge-based

Reconciliation is **level-based**: the controller reacts to the *current* cluster state, not to
individual change events. An event just wakes the reconciler; it must always re-read state from
the API server or local cache.

Consequences:
- Multiple rapid changes to the same object are coalesced into one reconcile call.
- If the object is deleted before the reconciler runs, `Get` returns `NotFound` — handle it.
- Never make decisions based on the event payload; always re-fetch.

```go
func (r *MyReconciler) Reconcile(ctx context.Context, req ctrl.Request) (ctrl.Result, error) {
    logger := ctrl.LoggerFrom(ctx)
    logger.Info("Reconciling")

    obj := &myv1.MyKind{}
    if err := r.Get(ctx, req.NamespacedName, obj); err != nil {
        if apierrors.IsNotFound(err) {
            return ctrl.Result{}, nil  // already gone, nothing to do
        }
        return ctrl.Result{}, err
    }
    // work from obj, not from the event
```

### Idempotency

The reconcile loop must be safe to run multiple times with the same inputs — Kubernetes will call
it repeatedly (retries, re-queues, restarts). Design every action so that running it twice produces
the same result as running it once.

### Deletions and finalizers

When a resource has finalizers, Kubernetes sets `metadata.deletionTimestamp` instead of deleting
immediately. Check this at the top of `Reconcile`:

```go
if !obj.DeletionTimestamp.IsZero() {
    return r.reconcileDelete(ctx, obj)
}
return r.reconcileNormal(ctx, obj)
```

Finalizer lifecycle:
1. **Add** the finalizer on the *first* reconcile, before creating any owned resources.
2. During deletion, perform cleanup (delete owned resources, external state, etc.).
3. **Remove** the finalizer only after cleanup is fully confirmed.

```go
// Adding
if !controllerutil.ContainsFinalizer(obj, myFinalizer) {
    controllerutil.AddFinalizer(obj, myFinalizer)
    return ctrl.Result{}, r.Update(ctx, obj)
}

// Removing (after cleanup)
controllerutil.RemoveFinalizer(obj, myFinalizer)
return ctrl.Result{}, r.Update(ctx, obj)
```

Even though `finalizers` isn't a real API sub-resource, add an RBAC marker so intent is clear:

```go
//+kubebuilder:rbac:groups=mygroup.io,resources=mykinds/finalizers,verbs=update
```

---

## 2. SetupWithManager

```go
func (r *MyReconciler) SetupWithManager(mgr ctrl.Manager) error {
    return ctrl.NewControllerManagedBy(mgr).
        For(&myv1.MyKind{}).
        WithEventFilter(predicate.GenerationChangedPredicate{}).
        WithOptions(controller.Options{
            MaxConcurrentReconciles: r.ConcurrentReconciles,
        }).
        Complete(r)
}
```

Key choices:

**`GenerationChangedPredicate`** — skips reconciliation when only `metadata` or `status` changes.
`metadata.generation` increments only on spec changes. This prevents the controller from
re-reconciling its own status updates in an infinite loop.

You can combine predicates:
```go
WithEventFilter(predicate.Or(
    predicate.GenerationChangedPredicate{},
    predicate.AnnotationChangedPredicate{},
))
```

**`MaxConcurrentReconciles`** — different instances of the same kind can be reconciled in
parallel; client-go's workqueue guarantees the *same* instance is never processed concurrently.

### Watching secondary resources

When your controller needs to react to changes in other resources (ConfigMaps, Secrets, child CRDs):

```go
ctrl.NewControllerManagedBy(mgr).
    For(&myv1.MyKind{}).
    Watches(&corev1.ConfigMap{},
        handler.EnqueueRequestsFromMapFunc(r.requeueForConfigMap),
        builder.WithPredicates(configMapPredicate()),
    ).
    Watches(&corev1.Secret{},
        handler.EnqueueRequestsFromMapFunc(r.requeueForSecret),
    ).
    Complete(r)
```

**Predicates on watches** filter which events trigger the reconcile — use them to avoid noise.

**Transformation functions** (`EnqueueRequestsFromMapFunc`) map a changed secondary resource back
to the primary resources that need reconciling. **Critical**: these functions must never return
an error — a failure means the event is silently dropped, causing missed reconciliations.

```go
func (r *MyReconciler) requeueForConfigMap(
    ctx context.Context, obj client.Object,
) []reconcile.Request {
    // Cannot call r.List() here if it might fail — use in-memory state instead
    r.mu.RLock()
    requests := r.mapConfigMapToOwners(obj.GetName(), obj.GetNamespace())
    r.mu.RUnlock()
    return requests
}
```

Maintain an in-memory index (protected by a mutex) of which primary resources depend on which
secondary resources. Update this index during normal reconciliation.

---

## 3. Error Handling and Retries

Return values control re-queue behaviour:

| Return value | Effect |
|---|---|
| `ctrl.Result{}, err` | Retry with **per-item exponential backoff** (independent per resource) |
| `ctrl.Result{RequeueAfter: d}, nil` | Re-queue after fixed duration `d` |
| `ctrl.Result{Requeue: true}, nil` | Re-queue with exponential backoff (no error logged) |
| `ctrl.Result{}, nil` | Done until next event |

Use `RequeueAfter` for scheduled work (e.g., re-evaluate every 10 minutes):
```go
return ctrl.Result{RequeueAfter: 10 * time.Minute}, nil
```

### Conflict errors (optimistic concurrency)

Kubernetes uses `resourceVersion` for optimistic concurrency. If two writers update an object
simultaneously, the second gets a conflict error. The correct pattern is **re-fetch then retry**:

```go
err = retry.RetryOnConflict(retry.DefaultRetry, func() error {
    current := &myv1.MyKind{}
    if err := r.Get(ctx, req.NamespacedName, current); err != nil {
        return err
    }
    current.Status.Phase = "Ready"
    return r.Status().Update(ctx, current)
})
```

Never retry a write with a stale object — re-read first.

---

## 4. RBAC Markers

Use `//+kubebuilder:rbac` markers to declare permissions. Run `make manifests` after any change.

```go
//+kubebuilder:rbac:groups=mygroup.io,resources=mykinds,verbs=get;list;watch;patch
//+kubebuilder:rbac:groups=mygroup.io,resources=mykinds/status,verbs=get;update;patch
//+kubebuilder:rbac:groups=mygroup.io,resources=mykinds/finalizers,verbs=update
```

- `patch` on the main resource is needed to add/remove finalizers.
- Status and main resource have separate endpoints — define RBAC for each independently.

---

## 5. CRD Design

### Scope

```go
//+kubebuilder:resource:path=mykinds,scope=Cluster   // cluster-wide
//+kubebuilder:resource:path=mykinds,scope=Namespaced // namespace-scoped
```

### Status subresource

Always enable it — this gives status its own API endpoint and lets you control RBAC separately:

```go
//+kubebuilder:subresource:status
```

Updates to `spec` won't overwrite `status`, and vice versa. The controller always updates status
via `r.Status().Update(ctx, obj)`, never via the main `r.Update()`.

### Validation markers

```go
// Immutable field
//+kubebuilder:validation:XValidation:rule="self == oldSelf",message="Value is immutable"
Schedule string `json:"schedule"`

// Enum (exhaustive list)
//+kubebuilder:validation:Enum:=Install;Uninstall
type Action string

// Default value
//+kubebuilder:default:=Delete
Action Action `json:"action,omitempty"`

// Optional field
// +optional
Transform string `json:"transform,omitempty"`

// String constraints
//+kubebuilder:validation:MinLength=1
RepositoryURL string `json:"repositoryURL"`

// Cross-field constraint (CEL)
//+kubebuilder:validation:XValidation:rule="self.minReplicas <= self.replicas"
type MySpec struct { ... }

// Unique-key list (no duplicates by identifier)
//+listType=map
//+listMapKey=identifier
// +optional
TemplateRefs []TemplateRef `json:"templateRefs,omitempty"`
```

### Printer columns

```go
//+kubebuilder:printcolumn:name="Ready",type="boolean",JSONPath=".status.ready"
//+kubebuilder:printcolumn:name="Phase",type="string",JSONPath=".status.phase"
```

Run `make generate` after changing types, `make manifests` after changing markers.

---

## 6. Ownership and Garbage Collection

When the controller creates child resources, set `ownerReferences` so Kubernetes garbage-collects
them when the parent is deleted:

```go
if err := ctrl.SetControllerReference(parent, child, r.Scheme); err != nil {
    return err
}
```

One controller should own a resource's status — don't split status updates across multiple
controllers. Follow single-ownership: if `ClusterProfile` creates `ClusterSummary`, let a
dedicated `ClusterSummary` controller manage its own status.

---

## 7. Logging

Use `ctrl.LoggerFrom(ctx)` — it automatically includes `controller`, `controllerKind`, `name`,
`namespace`, and a unique `reconcileID` per reconcile call:

```go
func (r *MyReconciler) Reconcile(ctx context.Context, req ctrl.Request) (ctrl.Result, error) {
    logger := ctrl.LoggerFrom(ctx)
    logger.Info("Reconciling")
    // ...
    logger.Error(err, "Failed to update status", "phase", desired)
```

---

## 8. Performance and Workqueue Anti-patterns

The reconcile goroutine is a shared worker — blocking it stalls all other objects waiting on that
worker slot. Keep reconcile loops fast and non-blocking.

### Anti-patterns to flag in code review

**Blocking I/O inside Reconcile** — network calls, retries with `time.Sleep`, or polling loops
inside the reconcile function starve the workqueue. Instead, return `RequeueAfter` and let the
workqueue re-schedule:

```go
// WRONG: polling inside reconcile
for !resourceReady() {
    time.Sleep(5 * time.Second)
}

// RIGHT: exit and come back
if !resourceReady() {
    return ctrl.Result{RequeueAfter: 5 * time.Second}, nil
}
```

**Unbounded goroutines without tracking** — spawning a goroutine to do work and not tracking it
means the controller has no visibility into failures and no way to retry. Use the workqueue for
retries, not raw goroutines.

**Fetching the entire list on every reconcile** — listing all instances of a resource type on
every reconcile call adds O(N) API server load. Use label selectors, field selectors, or
in-memory indexes to narrow the query.

**Not using predicates on watches** — watching a high-frequency resource (like Pods) without
predicates floods the reconcile queue with irrelevant events. Always add predicates to secondary
watches.

**Re-listing in transformation functions** — as covered in §2, calling `r.List()` inside
`EnqueueRequestsFromMapFunc` is a correctness bug (failures silently drop events) and a
performance problem (list on every secondary resource change).

### Workqueue deduplication

client-go's workqueue deduplicates: if the same object is enqueued multiple times before a
worker picks it up, it is reconciled only once. This means rapid bursts of changes are naturally
rate-limited — you don't need to throttle manually. Reconciliation catches up to the *current*
state in one pass rather than replaying every intermediate state.

### Tuning MaxConcurrentReconciles

Start with 1 (safe default). Increase when you have many independent instances and reconcile
latency is the bottleneck. Watch for thundering-herd on API server when all workers hit it
simultaneously on startup.

---

## 9. Testing Strategy

### Unit tests (fast, isolated)

Use the controller-runtime fake client — it mimics the Kubernetes API in memory:

```go
import "sigs.k8s.io/controller-runtime/pkg/client/fake"

fakeClient := fake.NewClientBuilder().
    WithScheme(scheme).
    WithObjects(existingObj).
    Build()
```

Good for: reconcile logic, state machine correctness, error paths.
Not good for: RBAC validation, real watch behaviour.

### Functional verification (integration, with Kind)

Run the actual controller in a real (but ephemeral) Kubernetes cluster:

1. `kind create cluster --config test/kind-cluster.yaml` — spins up a local cluster in Docker
2. Build and load the Docker image: `kind load docker-image mycontroller:dev`
3. Deploy controller + CRDs: `kubectl apply -f config/`
4. Write Ginkgo + Gomega tests; use `Eventually` for async assertions:

```go
// Create the custom resource
Expect(k8sClient.Create(ctx, myObj)).To(Succeed())

// Assert controller took action (async — poll until true or timeout)
Eventually(func() bool {
    result := &myv1.MyKind{}
    _ = k8sClient.Get(ctx, key, result)
    return result.Status.Phase == "Ready"
}, timeout, pollingInterval).Should(BeTrue())
```

Functional tests validate RBAC correctness — unit tests cannot.

### Multi-cluster testing

For controllers that manage remote clusters:

```bash
kind create cluster --name mgmt  --config mgmt.yaml   # pod CIDR: 10.10.0.0/16
kind create cluster --name workload --config wl.yaml  # pod CIDR: 10.20.0.0/16
docker network create test-net
docker network connect test-net mgmt-control-plane
docker network connect test-net workload-control-plane
```

Use different Pod CIDRs to avoid IP conflicts. The control plane nodes can then reach each other's
API servers directly.

### Recommended CI pipeline

```
golangci-lint → go test ./... → kind functional tests → (optional) E2E on real cluster
```

---

## Common Mistakes Checklist

When reviewing controller code, check for:

- [ ] Does `Reconcile` re-fetch the object from the API (not use event data)?
- [ ] Is `IsNotFound` handled gracefully at the top?
- [ ] Is `DeletionTimestamp` checked before normal reconciliation?
- [ ] Is the reconcile loop idempotent?
- [ ] Is `GenerationChangedPredicate` applied to avoid status-update loops?
- [ ] Are finalizers added before creating owned resources?
- [ ] Are finalizers removed only after confirmed cleanup?
- [ ] Do transformation functions avoid API calls that could fail?
- [ ] Are status updates done via `r.Status().Update()`, not `r.Update()`?
- [ ] Are conflict errors retried with a re-fetch (`RetryOnConflict`)?
- [ ] Is `ctrl.LoggerFrom(ctx)` used for logging?
- [ ] Are `//+kubebuilder:rbac` markers present for all required verbs?
- [ ] Has `make manifests` been run after marker changes?
- [ ] Does `Reconcile` avoid blocking I/O or `time.Sleep` (use `RequeueAfter` instead)?
- [ ] Do secondary resource watches have predicates to avoid noise?
- [ ] Are list queries using label/field selectors rather than fetching everything?
- [ ] Is `MaxConcurrentReconciles` set, and appropriate for the workload?
