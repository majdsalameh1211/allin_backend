// backend/models/TeamMember.js
const mongoose = require('mongoose');

const teamMemberSchema = new mongoose.Schema({
  // Multi-language support for name
  translations: {
    en: {
      name: {
        type: String,
        required: [true, 'English name is required'],
        trim: true
      },
      title: {
        type: String,
        required: [true, 'English title is required'],
        trim: true
      },
      quote: {
        type: String,
        trim: true,
        default: ''
      },
      bio: {
        type: String,
        required: [true, 'English bio is required'],
        trim: true
      },
      specialties: {
        type: [String],
        default: []
      }
    },
    ar: {
      name: {
        type: String,
        required: [true, 'Arabic name is required'],
        trim: true
      },
      title: {
        type: String,
        required: [true, 'Arabic title is required'],
        trim: true
      },
      quote: {
        type: String,
        trim: true,
        default: ''
      },
      bio: {
        type: String,
        required: [true, 'Arabic bio is required'],
        trim: true
      },
      specialties: {
        type: [String],
        default: []
      }
    },
    he: {
      name: {
        type: String,
        required: [true, 'Hebrew name is required'],
        trim: true
      },
      title: {
        type: String,
        required: [true, 'Hebrew title is required'],
        trim: true
      },
      quote: {
        type: String,
        trim: true,
        default: ''
      },
      bio: {
        type: String,
        required: [true, 'Hebrew bio is required'],
        trim: true
      },
      specialties: {
        type: [String],
        default: []
      }
    }
  },

  // Contact Information
  email: {
    type: String,
    required: [true, 'Email is required'],
    trim: true,
    lowercase: true,
    match: [/^\S+@\S+\.\S+$/, 'Please enter a valid email']
  },

  phoneNumber: {
    type: String,
    trim: true,
    default: ''
  },

  // License Information
  licenseNumber: {
    type: String,
    required: [true, 'License number (מספר רשיון) is required'],
    trim: true,
    unique: true
  },

  licenseType: {
    type: String,
    enum: ['Real Estate Agent', 'Broker', 'Appraiser', 'Other'],
    default: 'Real Estate Agent'
  },

  // Image
  image: {
    type: String,
    default: ''
  },

  // Display Settings
  order: {
    type: Number,
    default: 0,
    min: 0
  },

  role: {
    type: String,
    enum: ['Founder', 'Partner', 'Agent', 'Consultant', 'Manager', 'Other'],
    default: 'Agent'
  },

  featured: {
    type: Boolean,
    default: false
  },

  active: {
    type: Boolean,
    default: true
  },

  // Social Media (Optional)
  socialMedia: {
    linkedin: {
      type: String,
      trim: true,
      default: ''
    },
    facebook: {
      type: String,
      trim: true,
      default: ''
    },
    instagram: {
      type: String,
      trim: true,
      default: ''
    },
    twitter: {
      type: String,
      trim: true,
      default: ''
    }
  },

  // Stats (Optional - for display purposes)
  stats: {
    yearsExperience: {
      type: Number,
      min: 0,
      default: 0
    },
    projectsCompleted: {
      type: Number,
      min: 0,
      default: 0
    },
    clientsSatisfied: {
      type: Number,
      min: 0,
      default: 0
    }
  }
}, {
  timestamps: true
});

// Indexes for performance
teamMemberSchema.index({ order: 1, active: 1 });
teamMemberSchema.index({ featured: -1, order: 1 });
teamMemberSchema.index({ licenseNumber: 1 });

// Virtual for full name (uses English by default)
teamMemberSchema.virtual('fullName').get(function() {
  return this.translations.en.name;
});

// Method to get team member by language
teamMemberSchema.methods.getByLanguage = function(lang = 'en') {
  const validLangs = ['en', 'ar', 'he'];
  const language = validLangs.includes(lang) ? lang : 'en';
  
  return {
    _id: this._id,
    name: this.translations[language].name,
    title: this.translations[language].title,
    quote: this.translations[language].quote,
    bio: this.translations[language].bio,
    specialties: this.translations[language].specialties,
    email: this.email,
    phoneNumber: this.phoneNumber,
    licenseNumber: this.licenseNumber,
    licenseType: this.licenseType,
    image: this.image,
    order: this.order,
    role: this.role,
    featured: this.featured,
    active: this.active,
    socialMedia: this.socialMedia,
    stats: this.stats,
    createdAt: this.createdAt,
    updatedAt: this.updatedAt
  };
};

// Static method to get all active team members
teamMemberSchema.statics.getActiveMembers = function(lang = 'en') {
  return this.find({ active: true })
    .sort({ order: 1, createdAt: -1 })
    .then(members => members.map(member => member.getByLanguage(lang)));
};

// Static method to get featured team members
teamMemberSchema.statics.getFeaturedMembers = function(lang = 'en') {
  return this.find({ active: true, featured: true })
    .sort({ order: 1 })
    .then(members => members.map(member => member.getByLanguage(lang)));
};

module.exports = mongoose.model('TeamMember', teamMemberSchema);