const mongoose = require('mongoose');

const taskSchema = new mongoose.Schema(
  {
    // 📝 Basic Info
    title: {
      type: String,
      required: true,
      trim: true,
      maxlength: 150,
    },

    description: {
      type: String,
      trim: true,
      maxlength: 1000,
    },

    // 🎯 Priority System
    priority: {
      type: String,
      enum: ['low', 'medium', 'high'],
      default: 'medium',
      index: true,
    },

    // ⏰ Deadline
    dueDate: {
      type: Date,
      required: true,
      index: true,
    },

    // 📌 Status Tracking
    status: {
      type: String,
      enum: ['pending', 'in-progress', 'completed'],
      default: 'pending',
      index: true,
    },

    // 🔗 Self-referencing Dependencies
    dependencies: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Task',
      },
    ],

    // 🕒 Completion timestamp
    completedAt: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: true, // createdAt, updatedAt
  }
);

//
// ⚡ Virtual Fields
//

// 🚨 Check if task is overdue
taskSchema.virtual('isOverdue').get(function () {
  return (
    this.dueDate < new Date() &&
    this.status !== 'completed'
  );
});

// Enable virtuals in JSON output
taskSchema.set('toJSON', { virtuals: true });
taskSchema.set('toObject', { virtuals: true });

//
// ⚡ Indexing for Performance
//

taskSchema.index({ priority: 1, status: 1, dueDate: 1 });

module.exports = mongoose.model('Task', taskSchema);