// backend/models/Course.js
const mongoose = require('mongoose');

const courseSchema = new mongoose.Schema({
  // 1. Multi-language Content
  translations: {
    en: {
      title: { type: String, required: true, trim: true },
      description: { type: String, required: true, trim: true },
      level: { type: String, default: "Beginner" }
    },
    ar: {
      title: { type: String, required: true, trim: true },
      description: { type: String, required: true, trim: true },
      level: { type: String, default: "مبتدئ" }
    },
    he: {
      title: { type: String, required: true, trim: true },
      description: { type: String, required: true, trim: true },
      level: { type: String, default: "מתחיל" }
    }
  },

  // 2. Course Details (Universal)
  price: {
    type: Number,
    default: null,
    min: 0
  },
  currency: {
    type: String,
    enum: ['ILS', 'USD', 'EUR'],
    default: 'ILS'
  },
  duration: {
    type: String,
    required: true,
    trim: true
  },
  instructor: {
    type: String,
    default: "ALL IN Team",
    trim: true
  },
  
  // 3. Media
  image: {
    type: String,
    default: "https://placehold.co/600x400/d4af37/ffffff?text=Course"
  },

  // 4. System Flags
  active: {
    type: Boolean,
    default: true
  },
  order: {
    type: Number,
    default: 0
  }
}, {
  timestamps: true // Adds createdAt and updatedAt
});

// Indexes for faster queries
courseSchema.index({ order: 1 });
courseSchema.index({ active: 1 });
courseSchema.index({ createdAt: -1 });
courseSchema.index({ 'translations.en.title': 'text' });

// Virtual for formatted price
courseSchema.virtual('formattedPrice').get(function () {
  if (!this.price || this.price === null || this.price === 0) return 'Free';
  const symbol = this.currency === 'ILS' ? '₪' : this.currency === 'USD' ? '$' : '€';
  return `${symbol}${this.price.toLocaleString()}`;
});

// Ensure virtuals are included when converting to JSON
courseSchema.set('toJSON', { virtuals: true });
courseSchema.set('toObject', { virtuals: true });

module.exports = mongoose.model('Course', courseSchema);