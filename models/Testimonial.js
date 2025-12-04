// backend/models/Testimonial.js
const mongoose = require('mongoose');

const testimonialSchema = new mongoose.Schema({
  // Multi-language content
  translations: {
    en: {
      text: { 
        type: String, 
        required: [true, 'English testimonial text is required'],
        trim: true
      },
      author: { 
        type: String, 
        required: [true, 'English author name is required'],
        trim: true
      },
      location: { 
        type: String, 
        required: [true, 'English location is required'],
        trim: true
      }
    },
    ar: {
      text: { 
        type: String, 
        required: [true, 'Arabic testimonial text is required'],
        trim: true
      },
      author: { 
        type: String, 
        required: [true, 'Arabic author name is required'],
        trim: true
      },
      location: { 
        type: String, 
        required: [true, 'Arabic location is required'],
        trim: true
      }
    },
    he: {
      text: { 
        type: String, 
        required: [true, 'Hebrew testimonial text is required'],
        trim: true
      },
      author: { 
        type: String, 
        required: [true, 'Hebrew author name is required'],
        trim: true
      },
      location: { 
        type: String, 
        required: [true, 'Hebrew location is required'],
        trim: true
      }
    }
  },
  
  // Display order
  order: {
    type: Number,
    default: 0
  },
  
  // Rating (optional)
  rating: {
    type: Number,
    min: 1,
    max: 5,
    default: 5
  },
  
  // Active status
  active: {
    type: Boolean,
    default: true
  },
  
  // Featured testimonial
  featured: {
    type: Boolean,
    default: false
  }
}, {
  timestamps: true
});

// Indexes
testimonialSchema.index({ active: 1, order: 1 });
testimonialSchema.index({ featured: 1 });

module.exports = mongoose.model('Testimonial', testimonialSchema);