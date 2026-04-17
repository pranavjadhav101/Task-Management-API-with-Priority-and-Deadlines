const Task = require('../models/Task');

// @desc    Create Task
// @route   POST /api/tasks
// @access  Public
exports.createTask = async (req, res) => {
  try {
    const { title, priority, status } = req.body;

    // Basic validation
    if (!title) {
      return res.status(400).json({ error: 'Title is required' });
    }

    if (priority && !['Low', 'Medium', 'High'].includes(priority)) {
      return res.status(400).json({ error: 'Invalid priority value' });
    }

    if (status && !['Pending', 'In Progress', 'Completed'].includes(status)) {
      return res.status(400).json({ error: 'Invalid status value' });
    }

    const task = await Task.create(req.body);

    res.status(201).json({
      success: true,
      data: task
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};


// @desc    Get All Tasks (with filtering & sorting)
// @route   GET /api/tasks
exports.getTasks = async (req, res) => {
  try {
    const { status, priority, sortBy } = req.query;

    let query = {};

    if (status) query.status = status;
    if (priority) query.priority = priority;

    let tasksQuery = Task.find(query).populate('dependencies');

    // Sorting
    if (sortBy === 'dueDate') {
      tasksQuery = tasksQuery.sort({ dueDate: 1 });
    } else if (sortBy === 'priority') {
      tasksQuery = tasksQuery.sort({ priority: 1 });
    } else {
      tasksQuery = tasksQuery.sort({ createdAt: -1 });
    }

    const tasks = await tasksQuery;

    res.status(200).json({
      success: true,
      count: tasks.length,
      data: tasks
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};


// @desc    Get Single Task
// @route   GET /api/tasks/:id
exports.getTaskById = async (req, res) => {
  try {
    const task = await Task.findById(req.params.id).populate('dependencies');

    if (!task) {
      return res.status(404).json({ error: 'Task not found' });
    }

    res.status(200).json({
      success: true,
      data: task
    });
  } catch (error) {
    res.status(400).json({ error: 'Invalid task ID' });
  }
};


// @desc    Update Task
// @route   PUT /api/tasks/:id
exports.updateTask = async (req, res) => {
  try {
    const updates = req.body;

    const task = await Task.findByIdAndUpdate(
      req.params.id,
      updates,
      {
        new: true,
        runValidators: true
      }
    );

    if (!task) {
      return res.status(404).json({ error: 'Task not found' });
    }

    res.status(200).json({
      success: true,
      data: task
    });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};


// @desc    Delete Task
// @route   DELETE /api/tasks/:id
exports.deleteTask = async (req, res) => {
  try {
    const task = await Task.findByIdAndDelete(req.params.id);

    if (!task) {
      return res.status(404).json({ error: 'Task not found' });
    }

    res.status(200).json({
      success: true,
      message: 'Task deleted successfully'
    });
  } catch (error) {
    res.status(400).json({ error: 'Invalid task ID' });
  }
};