// backend/models/Lead.js
const mongoose = require('mongoose');

const leadSchema = new mongoose.Schema({
  // ==================== CLIENT INFORMATION (From Contact Form) ====================
  // These fields are submitted by the client and should be READ-ONLY in most cases
  
  fullName: {
    type: String,
    required: [true, 'Full name is required'],
    trim: true
  },

  email: {
    type: String,
    required: [true, 'Email is required'],
    trim: true,
    lowercase: true,
    match: [/^\S+@\S+\.\S+$/, 'Please enter a valid email']
  },

  phoneNumber: {
    type: String,
    required: [true, 'Phone number is required'],
    trim: true
  },

  inquiryType: {
    type: String,
    enum: ['buying', 'selling', 'renting', 'land', 'consulting'],
    required: [true, 'Inquiry type is required']
  },

  message: {
    type: String,
    required: [true, 'Message is required'],
    trim: true
  },

  // ==================== LEAD MANAGEMENT (Admin-editable) ====================
  
  status: {
    type: String,
    enum: ['New', 'Contacted', 'InProgress', 'Closed'],
    default: 'New'
  },

  priority: {
    type: String,
    enum: ['High', 'Medium', 'Low'],
    default: 'Medium'
  },

  notes: {
    type: String,
    trim: true,
    default: ''
  },

  // Reference to TeamMember who is assigned this lead
  assignedTo: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'TeamMember',
    default: null
  },

  // ==================== TRACKING ====================
  
  source: {
    type: String,
    enum: [
      'Website Contact Form',
      'WhatsApp',
      'Phone Call',
      'Referral',
      'Facebook',
      'Instagram',
      'Walk-in',
      'Manual Entry'
    ],
    default: 'Website Contact Form'
  },

  contactedAt: {
    type: Date,
    default: null
  },

  closedAt: {
    type: Date,
    default: null
  },

  // ==================== METADATA ====================
  
  ipAddress: {
    type: String,
    default: null
  },

  isArchived: {
    type: Boolean,
    default: false
  },

  isSpam: {
    type: Boolean,
    default: false
  }

}, {
  timestamps: true // Creates createdAt and updatedAt automatically
});

// ==================== INDEXES ====================
leadSchema.index({ status: 1, createdAt: -1 });
leadSchema.index({ assignedTo: 1, status: 1 });
leadSchema.index({ inquiryType: 1 });
leadSchema.index({ priority: 1 });
leadSchema.index({ createdAt: -1 });

// ==================== VIRTUAL PROPERTIES ====================

// Virtual to check if lead is new (less than 24 hours old)
leadSchema.virtual('isNew').get(function() {
  const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
  return this.createdAt > oneDayAgo;
});

// ==================== INSTANCE METHODS ====================

// Method to mark lead as contacted
leadSchema.methods.markAsContacted = function() {
  this.status = 'Contacted';
  if (!this.contactedAt) {
    this.contactedAt = new Date();
  }
  return this.save();
};

// Method to close lead
leadSchema.methods.closeLead = function() {
  this.status = 'Closed';
  if (!this.closedAt) {
    this.closedAt = new Date();
  }
  return this.save();
};

// Method to assign lead to team member
leadSchema.methods.assignTo = function(teamMemberId) {
  this.assignedTo = teamMemberId;
  return this.save();
};

// ==================== STATIC METHODS ====================

// Get all leads with optional filters
leadSchema.statics.getFilteredLeads = function(filters = {}) {
  const query = {};

  // Filter by status
  if (filters.status && filters.status !== 'all') {
    query.status = filters.status;
  }

  // Filter by inquiry type
  if (filters.inquiryType && filters.inquiryType !== 'all') {
    query.inquiryType = filters.inquiryType;
  }

  // Filter by priority
  if (filters.priority && filters.priority !== 'all') {
    query.priority = filters.priority;
  }

  // Filter by assigned team member
  if (filters.assignedTo) {
    if (filters.assignedTo === 'unassigned') {
      query.assignedTo = null;
    } else {
      query.assignedTo = filters.assignedTo;
    }
  }

  // Filter by date range
  if (filters.startDate || filters.endDate) {
    query.createdAt = {};
    if (filters.startDate) {
      query.createdAt.$gte = new Date(filters.startDate);
    }
    if (filters.endDate) {
      query.createdAt.$lte = new Date(filters.endDate);
    }
  }

  // Exclude archived/spam unless explicitly requested
  if (!filters.includeArchived) {
    query.isArchived = false;
  }
  if (!filters.includeSpam) {
    query.isSpam = false;
  }

  return this.find(query)
    .populate('assignedTo', 'translations.en.name translations.ar.name translations.he.name role email')
    .sort({ createdAt: -1 });
};

// Get lead statistics
leadSchema.statics.getStats = async function(adminId = null) {
  const matchQuery = { isArchived: false, isSpam: false };
  
  // If adminId provided, only count their assigned leads
  if (adminId) {
    matchQuery.assignedTo = adminId;
  }

  const stats = await this.aggregate([
    { $match: matchQuery },
    {
      $group: {
        _id: null,
        total: { $sum: 1 },
        new: {
          $sum: {
            $cond: [{ $eq: ['$status', 'New'] }, 1, 0]
          }
        },
        contacted: {
          $sum: {
            $cond: [{ $eq: ['$status', 'Contacted'] }, 1, 0]
          }
        },
        inProgress: {
          $sum: {
            $cond: [{ $eq: ['$status', 'InProgress'] }, 1, 0]
          }
        },
        closed: {
          $sum: {
            $cond: [{ $eq: ['$status', 'Closed'] }, 1, 0]
          }
        }
      }
    }
  ]);

  return stats[0] || {
    total: 0,
    new: 0,
    contacted: 0,
    inProgress: 0,
    closed: 0
  };
};

// ==================== HOOKS ====================

// Auto-update contactedAt when status changes to Contacted
leadSchema.pre('save', function(next) {
  if (this.isModified('status')) {
    if (this.status === 'Contacted' && !this.contactedAt) {
      this.contactedAt = new Date();
    }
    if (this.status === 'Closed' && !this.closedAt) {
      this.closedAt = new Date();
    }
  }
  next();
});

module.exports = mongoose.model('Lead', leadSchema);