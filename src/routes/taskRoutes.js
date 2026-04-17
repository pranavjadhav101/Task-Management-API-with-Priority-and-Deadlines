const express = require('express');
const router = express.Router();
const taskController = require('../controllers/taskController');

// CRUD Routes
router.route('/')
  .post(taskController.createTask)
  .get(taskController.getTasks);

router.route('/:id')
  .get(taskController.getTaskById)
  .put(taskController.updateTask)
  .delete(taskController.deleteTask);

module.exports = router;