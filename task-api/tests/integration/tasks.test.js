const request = require('supertest');
const app = require('../../src/app');
const taskService = require('../../src/services/taskService');

describe('Task API Integration Tests', () => {
  beforeEach(() => {
    taskService._reset();
  });

  describe('GET /tasks', () => {
    it('should return 200 and an empty array when no tasks exist', async () => {
      const res = await request(app).get('/tasks');
      expect(res.status).toBe(200);
      expect(res.body).toEqual([]);
    });

    it('should return 200 and all tasks (happy path)', async () => {
      taskService.create({ title: 'Task 1' });
      taskService.create({ title: 'Task 2' });

      const res = await request(app).get('/tasks');
      expect(res.status).toBe(200);
      expect(res.body).toHaveLength(2);
      expect(res.body[0].title).toBe('Task 1');
      expect(res.body[1].title).toBe('Task 2');
    });

    describe('Filtering by status', () => {
      beforeEach(() => {
        taskService.create({ title: 'Task Todo', status: 'todo' });
        taskService.create({ title: 'Task In Progress', status: 'in_progress' });
        taskService.create({ title: 'Task Done', status: 'done' });
      });

      it('should filter tasks by status=todo', async () => {
        const res = await request(app).get('/tasks?status=todo');
        expect(res.status).toBe(200);
        expect(res.body).toHaveLength(1);
        expect(res.body[0].title).toBe('Task Todo');
        expect(res.body[0].status).toBe('todo');
      });

      it('should filter tasks by status=in_progress', async () => {
        const res = await request(app).get('/tasks?status=in_progress');
        expect(res.status).toBe(200);
        expect(res.body).toHaveLength(1);
        expect(res.body[0].title).toBe('Task In Progress');
      });

      it('should return empty array if no tasks match status', async () => {
        const res = await request(app).get('/tasks?status=unknown_status');
        expect(res.status).toBe(200);
        expect(res.body).toEqual([]);
      });
    });

    describe('Pagination', () => {
      beforeEach(() => {
        for (let i = 1; i <= 20; i++) {
          taskService.create({ title: `Task ${i}` });
        }
      });

      it('should return the first page of tasks (page=1, limit=5)', async () => {
        const res = await request(app).get('/tasks?page=1&limit=5');
        expect(res.status).toBe(200);
        expect(res.body).toHaveLength(5);
        expect(res.body[0].title).toBe('Task 1');
        expect(res.body[4].title).toBe('Task 5');
      });

      it('should return the second page of tasks (page=2, limit=5)', async () => {
        const res = await request(app).get('/tasks?page=2&limit=5');
        expect(res.status).toBe(200);
        expect(res.body).toHaveLength(5);
        expect(res.body[0].title).toBe('Task 6');
        expect(res.body[4].title).toBe('Task 10');
      });

      it('should fallback to defaults when invalid page/limit are provided', async () => {
        const res = await request(app).get('/tasks?page=invalid&limit=invalid');
        expect(res.status).toBe(200);
        expect(Array.isArray(res.body)).toBe(true);
      });

      it('should handle pagination when page exceeds available records', async () => {
        const res = await request(app).get('/tasks?page=100&limit=10');
        expect(res.status).toBe(200);
        expect(res.body).toEqual([]);
      });
    });
  });

  describe('POST /tasks', () => {
    it('should create a task with valid input and return 201 (happy path)', async () => {
      const payload = {
        title: 'Learn Jest',
        description: 'Practice unit and integration testing',
        status: 'todo',
        priority: 'high',
        dueDate: '2026-12-31T23:59:59.000Z',
      };

      const res = await request(app).post('/tasks').send(payload);

      expect(res.status).toBe(201);
      expect(res.body.id).toBeDefined();
      expect(res.body.title).toBe(payload.title);
      expect(res.body.description).toBe(payload.description);
      expect(res.body.status).toBe('todo');
      expect(res.body.priority).toBe('high');
      expect(res.body.dueDate).toBe(payload.dueDate);
      expect(res.body.completedAt).toBeNull();
      expect(res.body.createdAt).toBeDefined();
    });

    it('should create a task with minimal valid input and use defaults', async () => {
      const res = await request(app).post('/tasks').send({ title: 'Minimal Task' });

      expect(res.status).toBe(201);
      expect(res.body.title).toBe('Minimal Task');
      expect(res.body.description).toBe('');
      expect(res.body.status).toBe('todo');
      expect(res.body.priority).toBe('medium');
      expect(res.body.dueDate).toBeNull();
      expect(res.body.completedAt).toBeNull();
    });

    it('edge case: should return 400 when title is missing', async () => {
      const res = await request(app).post('/tasks').send({ description: 'No title' });
      expect(res.status).toBe(400);
      expect(res.body.error).toContain('title is required');
    });

    it('edge case: should return 400 when title is empty or whitespace only', async () => {
      const resEmpty = await request(app).post('/tasks').send({ title: '' });
      expect(resEmpty.status).toBe(400);

      const resWhitespace = await request(app).post('/tasks').send({ title: '   ' });
      expect(resWhitespace.status).toBe(400);
    });

    it('edge case: should return 400 when status is invalid', async () => {
      const res = await request(app).post('/tasks').send({
        title: 'Invalid Status Task',
        status: 'not_a_valid_status',
      });
      expect(res.status).toBe(400);
      expect(res.body.error).toContain('status must be one of');
    });

    it('edge case: should return 400 when priority is invalid', async () => {
      const res = await request(app).post('/tasks').send({
        title: 'Invalid Priority Task',
        priority: 'super_high',
      });
      expect(res.status).toBe(400);
      expect(res.body.error).toContain('priority must be one of');
    });

    it('edge case: should return 400 when dueDate is an invalid date string', async () => {
      const res = await request(app).post('/tasks').send({
        title: 'Invalid Date Task',
        dueDate: 'yesterday-or-tomorrow',
      });
      expect(res.status).toBe(400);
      expect(res.body.error).toContain('dueDate must be a valid ISO date string');
    });
  });

  describe('PUT /tasks/:id', () => {
    it('should update an existing task and return 200 (happy path)', async () => {
      const task = taskService.create({ title: 'Original Task', priority: 'low' });

      const res = await request(app).put(`/tasks/${task.id}`).send({
        title: 'Updated Task Title',
        priority: 'high',
        status: 'in_progress',
      });

      expect(res.status).toBe(200);
      expect(res.body.id).toBe(task.id);
      expect(res.body.title).toBe('Updated Task Title');
      expect(res.body.priority).toBe('high');
      expect(res.body.status).toBe('in_progress');
    });

    it('edge case: should return 404 when updating non-existent task id', async () => {
      const res = await request(app).put('/tasks/non-existent-id').send({
        title: 'New Title',
      });
      expect(res.status).toBe(404);
      expect(res.body.error).toBe('Task not found');
    });

    it('edge case: should return 400 when update payload has invalid fields', async () => {
      const task = taskService.create({ title: 'Valid Task' });

      const resTitle = await request(app).put(`/tasks/${task.id}`).send({ title: '   ' });
      expect(resTitle.status).toBe(400);

      const resStatus = await request(app).put(`/tasks/${task.id}`).send({ status: 'unknown' });
      expect(resStatus.status).toBe(400);

      const resPriority = await request(app).put(`/tasks/${task.id}`).send({ priority: 'extreme' });
      expect(resPriority.status).toBe(400);

      const resDueDate = await request(app).put(`/tasks/${task.id}`).send({ dueDate: 'invalid-date' });
      expect(resDueDate.status).toBe(400);
    });
  });

  describe('DELETE /tasks/:id', () => {
    it('should delete existing task and return 204 (happy path)', async () => {
      const task = taskService.create({ title: 'Task to delete' });

      const res = await request(app).delete(`/tasks/${task.id}`);
      expect(res.status).toBe(204);
      expect(res.body).toEqual({});

      expect(taskService.findById(task.id)).toBeUndefined();
    });

    it('edge case: should return 404 when task to delete does not exist', async () => {
      const res = await request(app).delete('/tasks/non-existent-id');
      expect(res.status).toBe(404);
      expect(res.body.error).toBe('Task not found');
    });

    it('edge case: should return 404 when deleting an already deleted task', async () => {
      const task = taskService.create({ title: 'Delete twice' });

      const firstRes = await request(app).delete(`/tasks/${task.id}`);
      expect(firstRes.status).toBe(204);

      const secondRes = await request(app).delete(`/tasks/${task.id}`);
      expect(secondRes.status).toBe(404);
    });
  });

  describe('PATCH /tasks/:id/complete', () => {
    it('should mark task as complete and return 200 (happy path)', async () => {
      const task = taskService.create({ title: 'Finish assignment', status: 'todo' });

      const res = await request(app).patch(`/tasks/${task.id}/complete`);
      expect(res.status).toBe(200);
      expect(res.body.id).toBe(task.id);
      expect(res.body.status).toBe('done');
      expect(res.body.completedAt).toBeDefined();
      expect(new Date(res.body.completedAt).toString()).not.toBe('Invalid Date');
    });

    it('edge case: should return 404 when completing non-existent task id', async () => {
      const res = await request(app).patch('/tasks/non-existent-id/complete');
      expect(res.status).toBe(404);
      expect(res.body.error).toBe('Task not found');
    });
  });

  describe('GET /tasks/stats', () => {
    it('should return default zero counts when no tasks exist', async () => {
      const res = await request(app).get('/tasks/stats');
      expect(res.status).toBe(200);
      expect(res.body).toEqual({
        todo: 0,
        in_progress: 0,
        done: 0,
        overdue: 0,
      });
    });

    it('should return correct counts and overdue calculation (happy path)', async () => {
      const pastDate = new Date(Date.now() - 3600000).toISOString();
      const futureDate = new Date(Date.now() + 3600000).toISOString();

      taskService.create({ title: 'Task 1', status: 'todo', dueDate: pastDate });
      taskService.create({ title: 'Task 2', status: 'in_progress', dueDate: pastDate });
      taskService.create({ title: 'Task 3', status: 'done', dueDate: pastDate });
      taskService.create({ title: 'Task 4', status: 'todo', dueDate: futureDate });
      taskService.create({ title: 'Task 5', status: 'done', dueDate: null });

      const res = await request(app).get('/tasks/stats');
      expect(res.status).toBe(200);
      expect(res.body).toEqual({
        todo: 2,
        in_progress: 1,
        done: 2,
        overdue: 2,
      });
    });
  });

  describe('PATCH /tasks/:id/assign', () => {
    it('should assign a task to an assignee and return 200 (happy path)', async () => {
      const task = taskService.create({ title: 'Task to assign' });

      const res = await request(app)
        .patch(`/tasks/${task.id}/assign`)
        .send({ assignee: 'Sarah Connor' });

      expect(res.status).toBe(200);
      expect(res.body.id).toBe(task.id);
      expect(res.body.assignee).toBe('Sarah Connor');

      const found = taskService.findById(task.id);
      expect(found.assignee).toBe('Sarah Connor');
    });

    it('should reassign a task to a different assignee and return 200', async () => {
      const task = taskService.create({ title: 'Task to reassign' });
      taskService.assign(task.id, 'Sarah Connor');

      const res = await request(app)
        .patch(`/tasks/${task.id}/assign`)
        .send({ assignee: 'John Connor' });

      expect(res.status).toBe(200);
      expect(res.body.assignee).toBe('John Connor');
    });

    it('edge case: should return 404 if task does not exist', async () => {
      const res = await request(app)
        .patch('/tasks/non-existent-id/assign')
        .send({ assignee: 'Sarah Connor' });

      expect(res.status).toBe(404);
      expect(res.body.error).toBe('Task not found');
    });

    it('edge case: should return 400 if assignee is missing or not a string', async () => {
      const task = taskService.create({ title: 'Validation test task' });

      const resMissing = await request(app)
        .patch(`/tasks/${task.id}/assign`)
        .send({});
      expect(resMissing.status).toBe(400);
      expect(resMissing.body.error).toContain('assignee is required');

      const resNumber = await request(app)
        .patch(`/tasks/${task.id}/assign`)
        .send({ assignee: 12345 });
      expect(resNumber.status).toBe(400);
      expect(resNumber.body.error).toContain('assignee is required');
    });

    it('edge case: should return 400 if assignee is empty string or only whitespace', async () => {
      const task = taskService.create({ title: 'Whitespace test task' });

      const resEmpty = await request(app)
        .patch(`/tasks/${task.id}/assign`)
        .send({ assignee: '' });
      expect(resEmpty.status).toBe(400);
      expect(resEmpty.body.error).toContain('assignee is required');

      const resWhitespace = await request(app)
        .patch(`/tasks/${task.id}/assign`)
        .send({ assignee: '    ' });
      expect(resWhitespace.status).toBe(400);
      expect(resWhitespace.body.error).toContain('assignee is required');
    });

    it('edge case: should return 400 if task is already assigned to the same assignee', async () => {
      const task = taskService.create({ title: 'Already assigned task' });
      taskService.assign(task.id, 'Sarah Connor');

      const resDuplicate = await request(app)
        .patch(`/tasks/${task.id}/assign`)
        .send({ assignee: 'Sarah Connor' });

      expect(resDuplicate.status).toBe(400);
      expect(resDuplicate.body.error).toBe('Task is already assigned to this assignee');
    });
  });

  describe('Error handling middleware', () => {
    it('should return 500 when an unexpected error occurs', async () => {
      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
      const getAllSpy = jest.spyOn(taskService, 'getAll').mockImplementation(() => {
        throw new Error('Simulated failure');
      });

      const res = await request(app).get('/tasks');
      expect(res.status).toBe(500);
      expect(res.body).toEqual({ error: 'Internal server error' });

      getAllSpy.mockRestore();
      consoleErrorSpy.mockRestore();
    });
  });
});

