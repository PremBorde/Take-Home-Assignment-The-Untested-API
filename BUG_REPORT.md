# Bug Report: The Untested API

During code review, unit testing, and integration testing of the Task Manager API, several bugs and unintended behaviors were discovered across `taskService.js`, `routes/tasks.js`, and `validators.js`.

---

## Bug 1: Off-by-One Pagination Calculation Skips the First Page

### Location
`src/services/taskService.js` — `getPaginated(page, limit)`

### Description
The offset calculation is implemented as:
```javascript
const getPaginated = (page, limit) => {
  const offset = page * limit;
  return tasks.slice(offset, offset + limit);
};
```

### Expected Behavior
In standard 1-indexed pagination (which the route `/tasks?page=1&limit=10` uses), requesting `page = 1` with `limit = 10` should return items from index `0` to `9` (offset = 0).

### What Actually Happens
When `page = 1` and `limit = 10`, `offset = 1 * 10 = 10`. The function slices starting at index 10 (returning items 10 through 19). The first page of tasks is completely inaccessible to API consumers.

### How Discovered
Discovered when asserting that requesting `page=1, limit=5` from an array of 15 tasks should return `Task 1` through `Task 5`. Instead, it returned `Task 6` through `Task 10`.

### Proposed Fix
```javascript
const getPaginated = (page, limit) => {
  const pageNum = Math.max(1, parseInt(page, 10) || 1);
  const limitNum = Math.max(1, parseInt(limit, 10) || 10);
  const offset = (pageNum - 1) * limitNum;
  return tasks.slice(offset, offset + limitNum);
};
```

---

## Bug 2: Completing a Task Silently Resets Its Priority to `'medium'`

### Location
`src/services/taskService.js` — `completeTask(id)`

### Description
In `completeTask`:
```javascript
const updated = {
  ...task,
  priority: 'medium',
  status: 'done',
  completedAt: new Date().toISOString(),
};
```

### Expected Behavior
Marking a task as complete (`PATCH /tasks/:id/complete`) should update `status` to `'done'` and set `completedAt`. It should **preserve** the task's existing priority (e.g., a `high` priority task should remain `high`).

### What Actually Happens
The function hardcodes `priority: 'medium'`, discarding whatever priority the task previously had.

### How Discovered
Discovered by creating a task with `priority: 'high'` and calling `completeTask(id)`. The returned object unexpectedly had `priority: 'medium'`.

### Proposed Fix
Remove `priority: 'medium'` from the object spread:
```javascript
const updated = {
  ...task,
  status: 'done',
  completedAt: new Date().toISOString(),
};
```

---

## Bug 3: Inexact Substring Match in `getByStatus`

### Location
`src/services/taskService.js` — `getByStatus(status)`

### Description
The status filter is implemented with:
```javascript
const getByStatus = (status) => tasks.filter((t) => t.status.includes(status));
```

### Expected Behavior
Filtering by status (e.g., `GET /tasks?status=todo`) should strictly match tasks whose status equals the query parameter. Querying a non-existent or partial status like `do` or `progress` should return an empty array (or 400 Bad Request if validated).

### What Actually Happens
Because `.includes()` performs a substring search:
- Querying `status=do` matches both `'todo'` and `'done'`.
- Querying `status=progress` matches `'in_progress'`.

### How Discovered
Discovered by creating tasks with statuses `todo` and `done`, then running `getByStatus('do')`. Both tasks were returned.

### Proposed Fix
Use exact equality check:
```javascript
const getByStatus = (status) => tasks.filter((t) => t.status === status);
```

---

## Bug 4: Pagination Query Parameters Ignored When Filtering by Status

### Location
`src/routes/tasks.js` — `GET /`

### Description
The route handler evaluates `if (status)` and immediately returns without checking for `page` or `limit`:
```javascript
if (status) {
  const tasks = taskService.getByStatus(status);
  return res.json(tasks);
}

if (page !== undefined || limit !== undefined) {
  ...
}
```

### Expected Behavior
Clients requesting `GET /tasks?status=todo&page=1&limit=5` expect to receive the first page of 5 `todo` tasks.

### What Actually Happens
The status check early-returns all matching tasks, ignoring `page` and `limit`.

### How Discovered
Inspecting route branching and making a request to `GET /tasks?status=todo&page=2&limit=1` returned all `todo` tasks unfiltered by pagination.

### Proposed Fix
Compose filtering and pagination sequentially:
```javascript
router.get('/', (req, res) => {
  const { status, page, limit } = req.query;
  let tasks = status ? taskService.getByStatus(status) : taskService.getAll();

  if (page !== undefined || limit !== undefined) {
    const pageNum = Math.max(1, parseInt(page, 10) || 1);
    const limitNum = Math.max(1, parseInt(limit, 10) || 10);
    const offset = (pageNum - 1) * limitNum;
    tasks = tasks.slice(offset, offset + limitNum);
  }

  res.json(tasks);
});
```

---

## Bug 5: `PUT /tasks/:id` Allows Mutating Immutable Fields (`id`, `createdAt`)

### Location
`src/services/taskService.js` — `update(id, fields)`

### Description
The update method spreads `fields` directly onto the existing task:
```javascript
const updated = { ...tasks[index], ...fields };
```

### Expected Behavior
System-generated metadata (`id`, `createdAt`) should be immutable and protected from client modification.

### What Actually Happens
A client sending `{ id: "spoofed-uuid", createdAt: "1970-01-01" }` can overwrite the primary key and timestamp.

### How Discovered
Discovered by sending a `PUT` request with `{ id: "custom-id" }` and checking that the task's ID had changed.

### Proposed Fix
Sanitize fields or explicitly whitelist allowed fields (`title`, `description`, `status`, `priority`, `dueDate`, `completedAt`):
```javascript
const update = (id, fields) => {
  const index = tasks.findIndex((t) => t.id === id);
  if (index === -1) return null;

  const { id: _id, createdAt: _createdAt, ...allowedUpdates } = fields;
  const updated = { ...tasks[index], ...allowedUpdates };
  tasks[index] = updated;
  return updated;
};
```
