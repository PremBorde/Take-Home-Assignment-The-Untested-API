const taskService = require('../../src/services/taskService');

describe('taskService Unit Tests', () => {
  beforeEach(() => {
    taskService._reset();
  });

  describe('create', () => {
    it('should create a task with default values', () => {
      const task = taskService.create({ title: 'Test Task' });

      expect(task).toBeDefined();
      expect(task.id).toBeDefined();
      expect(typeof task.id).toBe('string');
      expect(task.title).toBe('Test Task');
      expect(task.description).toBe('');
      expect(task.status).toBe('todo');
      expect(task.priority).toBe('medium');
      expect(task.dueDate).toBeNull();
      expect(task.completedAt).toBeNull();
      expect(task.createdAt).toBeDefined();
      expect(new Date(task.createdAt).toString()).not.toBe('Invalid Date');
    });

    it('should create a task with custom fields', () => {
      const dueDate = '2026-11-01T10:00:00.000Z';
      const task = taskService.create({
        title: 'Custom Task',
        description: 'Custom description',
        status: 'in_progress',
        priority: 'high',
        dueDate,
      });

      expect(task.title).toBe('Custom Task');
      expect(task.description).toBe('Custom description');
      expect(task.status).toBe('in_progress');
      expect(task.priority).toBe('high');
      expect(task.dueDate).toBe(dueDate);
    });
  });

  describe('getAll', () => {
    it('should return an empty array when no tasks exist', () => {
      expect(taskService.getAll()).toEqual([]);
    });

    it('should return all created tasks', () => {
      taskService.create({ title: 'Task 1' });
      taskService.create({ title: 'Task 2' });

      const all = taskService.getAll();
      expect(all).toHaveLength(2);
      expect(all[0].title).toBe('Task 1');
      expect(all[1].title).toBe('Task 2');
    });

    it('should return a shallow copy so modifying the returned array does not affect store', () => {
      taskService.create({ title: 'Task 1' });
      const list = taskService.getAll();
      list.pop();
      expect(taskService.getAll()).toHaveLength(1);
    });
  });

  describe('findById', () => {
    it('should find a task by id', () => {
      const created = taskService.create({ title: 'Task to find' });
      const found = taskService.findById(created.id);
      expect(found).toBeDefined();
      expect(found.id).toBe(created.id);
      expect(found.title).toBe('Task to find');
    });

    it('should return undefined if task does not exist', () => {
      const found = taskService.findById('non-existent-id');
      expect(found).toBeUndefined();
    });
  });

  describe('getByStatus', () => {
    it('should return tasks matching given status', () => {
      taskService.create({ title: 'Task 1', status: 'todo' });
      taskService.create({ title: 'Task 2', status: 'in_progress' });
      taskService.create({ title: 'Task 3', status: 'done' });

      const todos = taskService.getByStatus('todo');
      expect(todos).toHaveLength(1);
      expect(todos[0].title).toBe('Task 1');

      const inProgress = taskService.getByStatus('in_progress');
      expect(inProgress).toHaveLength(1);
      expect(inProgress[0].title).toBe('Task 2');
    });

    it('should return an empty array when no tasks match the status', () => {
      taskService.create({ title: 'Task 1', status: 'todo' });
      const doneTasks = taskService.getByStatus('done');
      expect(doneTasks).toEqual([]);
    });
  });

  describe('getPaginated', () => {
    beforeEach(() => {
      for (let i = 1; i <= 15; i++) {
        taskService.create({ title: `Task ${i}` });
      }
    });

    it('should return the first page of tasks starting from index 0', () => {
      const page1 = taskService.getPaginated(1, 5);
      expect(page1).toHaveLength(5);
      expect(page1[0].title).toBe('Task 1');
      expect(page1[4].title).toBe('Task 5');
    });

    it('should return the second page of tasks correctly', () => {
      const page2 = taskService.getPaginated(2, 5);
      expect(page2).toHaveLength(5);
      expect(page2[0].title).toBe('Task 6');
      expect(page2[4].title).toBe('Task 10');
    });

    it('should return empty array if page is beyond available items', () => {
      const result = taskService.getPaginated(10, 10);
      expect(result).toEqual([]);
    });
  });

  describe('getStats', () => {
    it('should return zero counts when store is empty', () => {
      const stats = taskService.getStats();
      expect(stats).toEqual({
        todo: 0,
        in_progress: 0,
        done: 0,
        overdue: 0,
      });
    });

    it('should calculate counts by status correctly', () => {
      taskService.create({ title: 'Task 1', status: 'todo' });
      taskService.create({ title: 'Task 2', status: 'todo' });
      taskService.create({ title: 'Task 3', status: 'in_progress' });
      taskService.create({ title: 'Task 4', status: 'done' });

      const stats = taskService.getStats();
      expect(stats.todo).toBe(2);
      expect(stats.in_progress).toBe(1);
      expect(stats.done).toBe(1);
      expect(stats.overdue).toBe(0);
    });

    it('should count overdue tasks accurately', () => {
      const pastDate = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
      const futureDate = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();

      // Overdue: past due date and not done
      taskService.create({ title: 'Overdue Todo', status: 'todo', dueDate: pastDate });
      taskService.create({ title: 'Overdue In Progress', status: 'in_progress', dueDate: pastDate });

      // Not overdue: completed even though due date passed
      taskService.create({ title: 'Done in past', status: 'done', dueDate: pastDate });

      // Not overdue: future due date
      taskService.create({ title: 'Future task', status: 'todo', dueDate: futureDate });

      // Not overdue: no due date
      taskService.create({ title: 'No due date', status: 'todo' });

      const stats = taskService.getStats();
      expect(stats.todo).toBe(3);
      expect(stats.in_progress).toBe(1);
      expect(stats.done).toBe(1);
      expect(stats.overdue).toBe(2);
    });

    it('should handle tasks with non-standard statuses without breaking counts', () => {
      taskService.create({ title: 'Task with custom status' });
      // mutate status directly in internal task to test edge case
      const tasks = taskService.getAll();
      tasks[0].status = 'archived';

      const stats = taskService.getStats();
      expect(stats.todo).toBe(0);
      expect(stats.in_progress).toBe(0);
      expect(stats.done).toBe(0);
    });
  });

  describe('update', () => {
    it('should update existing task fields', () => {
      const created = taskService.create({ title: 'Original Title' });
      const updated = taskService.update(created.id, {
        title: 'New Title',
        priority: 'high',
      });

      expect(updated).toBeDefined();
      expect(updated.id).toBe(created.id);
      expect(updated.title).toBe('New Title');
      expect(updated.priority).toBe('high');

      const found = taskService.findById(created.id);
      expect(found.title).toBe('New Title');
    });

    it('should return null when updating a non-existent task', () => {
      const result = taskService.update('non-existent-id', { title: 'New Title' });
      expect(result).toBeNull();
    });
  });

  describe('remove', () => {
    it('should delete an existing task and return true', () => {
      const created = taskService.create({ title: 'Task to delete' });
      const success = taskService.remove(created.id);

      expect(success).toBe(true);
      expect(taskService.findById(created.id)).toBeUndefined();
      expect(taskService.getAll()).toHaveLength(0);
    });

    it('should return false when deleting a non-existent task', () => {
      const success = taskService.remove('non-existent-id');
      expect(success).toBe(false);
    });
  });

  describe('completeTask', () => {
    it('should mark task as done and set completedAt', () => {
      const created = taskService.create({ title: 'Task to complete' });
      const completed = taskService.completeTask(created.id);

      expect(completed).toBeDefined();
      expect(completed.status).toBe('done');
      expect(completed.completedAt).toBeDefined();
      expect(new Date(completed.completedAt).toString()).not.toBe('Invalid Date');
    });

    it('should return null when completing a non-existent task', () => {
      const result = taskService.completeTask('non-existent-id');
      expect(result).toBeNull();
    });
  });

  describe('assign', () => {
    it('should assign a task to an assignee and return updated task', () => {
      const created = taskService.create({ title: 'Task to assign' });
      const assigned = taskService.assign(created.id, 'Alice');

      expect(assigned).toBeDefined();
      expect(assigned.id).toBe(created.id);
      expect(assigned.assignee).toBe('Alice');

      const found = taskService.findById(created.id);
      expect(found.assignee).toBe('Alice');
    });

    it('should reassign a task to a different assignee', () => {
      const created = taskService.create({ title: 'Reassign task' });
      taskService.assign(created.id, 'Alice');

      const reassigned = taskService.assign(created.id, 'Bob');
      expect(reassigned.assignee).toBe('Bob');
    });

    it('should return null when assigning a non-existent task', () => {
      const result = taskService.assign('non-existent-id', 'Alice');
      expect(result).toBeNull();
    });
  });

  describe('_reset', () => {
    it('should clear all tasks from the store', () => {
      taskService.create({ title: 'Task 1' });
      taskService.create({ title: 'Task 2' });
      expect(taskService.getAll()).toHaveLength(2);

      taskService._reset();
      expect(taskService.getAll()).toHaveLength(0);
    });
  });
});

