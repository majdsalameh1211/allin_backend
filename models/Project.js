// backend/models/Project.js
const mongoose = require('mongoose');

const projectSchema = new mongoose.Schema({
  // Multi-language content
  translations: {
    en: {
      title: {
        type: String,
        required: [true, 'English title is required'],
        trim: true
      },
      location: {
        type: String,
        required: [true, 'English location is required'],
        trim: true
      },
      shortDesc: {
        type: String,
        trim: true
      },
      fullDesc: {
        type: String,
        trim: true
      },
      features: [{
        type: String,
        trim: true
      }]
    },
    ar: {
      title: {
        type: String,
        required: [true, 'Arabic title is required'],
        trim: true
      },
      location: {
        type: String,
        required: [true, 'Arabic location is required'],
        trim: true
      },
      shortDesc: {
        type: String,
        trim: true
      },
      fullDesc: {
        type: String,
        trim: true
      },
      features: [{
        type: String,
        trim: true
      }]
    },
    he: {
      title: {
        type: String,
        required: [true, 'Hebrew title is required'],
        trim: true
      },
      location: {
        type: String,
        required: [true, 'Hebrew location is required'],
        trim: true
      },
      shortDesc: {
        type: String,
        trim: true
      },
      fullDesc: {
        type: String,
        trim: true
      },
      features: [{
        type: String,
        trim: true
      }]
    }
  },

  // Pricing
  price: {
    type: Number,
    min: 0,
    default: null
  },
  currency: {
    type: String,
    default: 'ILS',
    enum: ['ILS', 'USD', 'EUR']
  },
  pricePerMonth: {
    type: Number,
    min: 0
  },

  // Property specifications
  bedrooms: {
    type: Number,
    min: 0
  },
  bathrooms: {
    type: Number,
    min: 0
  },
  area: {
    type: Number,
    min: 0
  },
  areaUnit: {
    type: String,
    default: 'sqm',
    enum: ['sqm', 'sqft']
  },

  // Property type
  type: {
    type: String,
    required: [true, 'Property type is required'],
    enum: ['forSale', 'forRent', 'sold'],
    default: 'forSale'
  },

  // Status
  status: {
    type: String,
    enum: ['active', 'draft', 'sold', 'deleted'],
    default: 'active'
  },

  // Display options
  featured: {
    type: Boolean,
    default: false
  },
  badge: {
    type: String,
    enum: ['new', 'exclusive', 'sold', null],
    default: null
  },

  images: {
    type: [String],
    default: [] // Allow empty array
  },

  mainImage: {
    type: String,
    default: "https://placehold.co/800x600?text=Property+Image" // Allow empty string
  }
}, {
  timestamps: true // Adds createdAt and updatedAt
});

// Indexes for faster queries
projectSchema.index({ type: 1, status: 1 });
projectSchema.index({ featured: 1 });
projectSchema.index({ createdAt: -1 });
projectSchema.index({ price: 1 });
projectSchema.index({ 'translations.en.title': 'text' }); // Text search

// Virtual for image count
projectSchema.virtual('imageCount').get(function () {
  return this.images ? this.images.length : 0;
});

// Virtual for formatted price
projectSchema.virtual('formattedPrice').get(function () {
  if (!this.price || this.price === null) return '--';  // ✅ Handle null price
  const symbol = this.currency === 'ILS' ? '₪' : this.currency === 'USD' ? '$' : '€';
  return `${symbol}${this.price.toLocaleString()}`;
});

// Ensure virtuals are included when converting to JSON
projectSchema.set('toJSON', { virtuals: true });
projectSchema.set('toObject', { virtuals: true });

// Pre-save middleware: Set mainImage if not provided
projectSchema.pre('save', function (next) {
  if (!this.mainImage && this.images && this.images.length > 0) {
    this.mainImage = this.images[0];
  }
  next();
});

module.exports = mongoose.model('Project', projectSchema);