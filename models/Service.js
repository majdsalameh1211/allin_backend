// backend/models/Service.js
const mongoose = require('mongoose');

const serviceSchema = new mongoose.Schema({
  // Display order (1, 2, 3...)
  order: {
    type: Number,
    required: [true, 'Order is required'],
    min: 1
  },
  
  // Icon URL
  icon: {
    type: String,
    required: [true, 'Icon URL is required']
  },
  
  // Multi-language content
  translations: {
    en: {
      title: { 
        type: String, 
        required: [true, 'English title is required'],
        trim: true
      },
      description: { 
        type: String, 
        required: [true, 'English description is required'],
        trim: true
      }
    },
    ar: {
      title: { 
        type: String, 
        required: [true, 'Arabic title is required'],
        trim: true
      },
      description: { 
        type: String, 
        required: [true, 'Arabic description is required'],
        trim: true
      }
    },
    he: {
      title: { 
        type: String, 
        required: [true, 'Hebrew title is required'],
        trim: true
      },
      description: { 
        type: String, 
        required: [true, 'Hebrew description is required'],
        trim: true
      }
    }
  },
  
  // Related projects (references to Project model)
  relatedProjects: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Project'
  }],
  
  // Active status
  active: {
    type: Boolean,
    default: true
  }
}, {
  timestamps: true // Adds createdAt and updatedAt
});

// Indexes for faster queries
serviceSchema.index({ order: 1 });
serviceSchema.index({ active: 1 });

// Virtual for getting related projects count
serviceSchema.virtual('projectCount').get(function() {
  return this.relatedProjects.length;
});

// Ensure virtuals are included when converting to JSON
serviceSchema.set('toJSON', { virtuals: true });
serviceSchema.set('toObject', { virtuals: true });

module.exports = mongoose.model('Service', serviceSchema);