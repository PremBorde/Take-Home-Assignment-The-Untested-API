const { validateCreateTask, validateUpdateTask, validateAssignTask } = require('../../src/utils/validators');

describe('Validators Unit Tests', () => {
  describe('validateCreateTask', () => {
    it('should return null for valid task data with only title', () => {
      const error = validateCreateTask({ title: 'New Task' });
      expect(error).toBeNull();
    });

    it('should return null for valid task data with all fields', () => {
      const error = validateCreateTask({
        title: 'Complete task',
        description: 'Detailed description',
        status: 'in_progress',
        priority: 'high',
        dueDate: '2026-12-31T23:59:59.000Z',
      });
      expect(error).toBeNull();
    });

    it('should return error when title is missing', () => {
      const error = validateCreateTask({});
      expect(error).toBe('title is required and must be a non-empty string');
    });

    it('should return error when title is not a string', () => {
      expect(validateCreateTask({ title: 123 })).toBe('title is required and must be a non-empty string');
      expect(validateCreateTask({ title: null })).toBe('title is required and must be a non-empty string');
      expect(validateCreateTask({ title: true })).toBe('title is required and must be a non-empty string');
    });

    it('should return error when title is empty or only whitespace', () => {
      expect(validateCreateTask({ title: '' })).toBe('title is required and must be a non-empty string');
      expect(validateCreateTask({ title: '   ' })).toBe('title is required and must be a non-empty string');
    });

    it('should return error when status is invalid', () => {
      const error = validateCreateTask({ title: 'Task', status: 'pending' });
      expect(error).toBe('status must be one of: todo, in_progress, done');
    });

    it('should return error when priority is invalid', () => {
      const error = validateCreateTask({ title: 'Task', priority: 'urgent' });
      expect(error).toBe('priority must be one of: low, medium, high');
    });

    it('should return error when dueDate is not a valid date string', () => {
      const error = validateCreateTask({ title: 'Task', dueDate: 'invalid-date' });
      expect(error).toBe('dueDate must be a valid ISO date string');
    });
  });

  describe('validateUpdateTask', () => {
    it('should return null for empty update body', () => {
      const error = validateUpdateTask({});
      expect(error).toBeNull();
    });

    it('should return null for valid partial updates', () => {
      expect(validateUpdateTask({ title: 'Updated Title' })).toBeNull();
      expect(validateUpdateTask({ status: 'done' })).toBeNull();
      expect(validateUpdateTask({ priority: 'low' })).toBeNull();
      expect(validateUpdateTask({ dueDate: '2026-10-15T00:00:00.000Z' })).toBeNull();
    });

    it('should return error when title is present but empty or whitespace', () => {
      expect(validateUpdateTask({ title: '' })).toBe('title must be a non-empty string');
      expect(validateUpdateTask({ title: '   ' })).toBe('title must be a non-empty string');
    });

    it('should return error when title is not a string', () => {
      expect(validateUpdateTask({ title: 456 })).toBe('title must be a non-empty string');
    });

    it('should return error when status is invalid', () => {
      const error = validateUpdateTask({ status: 'archived' });
      expect(error).toBe('status must be one of: todo, in_progress, done');
    });

    it('should return error when priority is invalid', () => {
      const error = validateUpdateTask({ priority: 'critical' });
      expect(error).toBe('priority must be one of: low, medium, high');
    });

    it('should return error when dueDate is invalid', () => {
      const error = validateUpdateTask({ dueDate: 'not-a-date' });
      expect(error).toBe('dueDate must be a valid ISO date string');
    });
  });

  describe('validateAssignTask', () => {
    it('should return null for valid assignee name', () => {
      const error = validateAssignTask({ assignee: 'Alice' }, { assignee: null });
      expect(error).toBeNull();
    });

    it('should return null when body is provided without currentTask', () => {
      const error = validateAssignTask({ assignee: 'Bob' }, null);
      expect(error).toBeNull();
    });

    it('should allow reassigning to a different assignee', () => {
      const error = validateAssignTask({ assignee: 'Charlie' }, { assignee: 'Alice' });
      expect(error).toBeNull();
    });

    it('should return error if body is undefined or null', () => {
      expect(validateAssignTask(null, null)).toBe('assignee is required and must be a non-empty string');
      expect(validateAssignTask(undefined, null)).toBe('assignee is required and must be a non-empty string');
    });

    it('should return error when assignee is missing from body', () => {
      const error = validateAssignTask({}, { assignee: null });
      expect(error).toBe('assignee is required and must be a non-empty string');
    });

    it('should return error when assignee is not a string', () => {
      expect(validateAssignTask({ assignee: 123 }, null)).toBe('assignee is required and must be a non-empty string');
      expect(validateAssignTask({ assignee: true }, null)).toBe('assignee is required and must be a non-empty string');
      expect(validateAssignTask({ assignee: {} }, null)).toBe('assignee is required and must be a non-empty string');
    });

    it('should return error when assignee is empty or only whitespace', () => {
      expect(validateAssignTask({ assignee: '' }, null)).toBe('assignee is required and must be a non-empty string');
      expect(validateAssignTask({ assignee: '   ' }, null)).toBe('assignee is required and must be a non-empty string');
    });

    it('should return error when task is already assigned to the same assignee', () => {
      const error = validateAssignTask({ assignee: 'Alice' }, { assignee: 'Alice' });
      expect(error).toBe('Task is already assigned to this assignee');
    });

    it('should trim assignee before checking if already assigned', () => {
      const error = validateAssignTask({ assignee: '  Alice  ' }, { assignee: 'Alice' });
      expect(error).toBe('Task is already assigned to this assignee');
    });
  });
});

