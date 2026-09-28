# Submission Notes

## 1. What I'd Test Next If I Had More Time

1. **Concurrent Request Handling & Race Conditions:**
   - In-memory mutations (`tasks.push`, `tasks.splice`, `tasks[index] = updated`) are synchronous in single-threaded Node.js event loops, but once replaced with an asynchronous database (PostgreSQL/MongoDB), concurrent updates (e.g. concurrent `assign` requests or simultaneous `complete` and `delete` calls) require row locking or atomic operations. I would write concurrency stress tests simulating parallel requests.
2. **Security & Malicious Payloads:**
   - Test payload size limits, prototype pollution via request bodies, deep nested JSON objects, and SQL/NoSQL injection vectors (especially for the search and filter query parameters).
3. **Combined Filters & Complex Pagination:**
   - Thoroughly test combinations of filtering (e.g., status + priority + overdue) combined with pagination to ensure total count headers/metadata (like `X-Total-Count`, `hasMore`, `totalPages`) function correctly.
4. **Timezone & Leap Year Boundaries for Due Dates:**
   - Test date calculations across UTC offset boundaries, daylight saving transitions, and format variations (e.g., ISO 8601 with milliseconds, Zulu time, non-standard offsets).

---

## 2. Anything That Surprised Me in the Codebase

1. **Substring Matching in `getByStatus`:**
   - Using `.includes()` rather than strict equality (`===`) meant that searching for `/tasks?status=do` matched both `todo` and `done`. This was a subtle but risky trap for API consumers.
2. **Off-by-One Pagination Calculation:**
   - The offset formula `page * limit` skipped the first page of results entirely when `page = 1`. Page 1 returned records 10–19 instead of 0–9.
3. **Side-Effect in `completeTask` Resetting Priority:**
   - The `completeTask` service function unexpectedly hardcoded `priority: 'medium'`, which caused high-priority tasks to silently lose their priority classification upon completion.
4. **Lack of Mutability Guards on `PUT`:**
   - The `update` method directly spread the request body over the task object (`{ ...tasks[index], ...fields }`), enabling external clients to overwrite immutable fields like `id` and `createdAt`.

---

## 3. Questions I'd Ask Before Shipping This to Production

1. **Persistence & Scalability:**
   - What database will replace the current in-memory store (e.g., PostgreSQL, MongoDB), and how should indexing be configured for fields frequently queried like `status`, `dueDate`, and `assignee`?
2. **Authentication & Authorization (RBAC):**
   - Who is authorized to create, reassign, or delete tasks? Should assignees only be valid user IDs registered in a user management system rather than arbitrary strings?
3. **Pagination Standard & Response Metadata:**
   - Should paginated responses return an envelope with pagination metadata (e.g., `{ data: [...], pagination: { total, page, limit, totalPages } }`) rather than a raw array?
4. **Audit Logging & History:**
   - When a task changes status, is completed, or is reassigned to another person, do we need an audit trail (e.g., `assignedAt`, `assignedBy`, activity log) for compliance or user history?
5. **Rate Limiting & CORS:**
   - What rate limits and CORS policies need to be enforced at the gateway/reverse proxy or Express middleware level before opening this API to external traffic?
