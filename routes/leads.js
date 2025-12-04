// backend/routes/leads.js
const express = require('express');
const router = express.Router();
const Lead = require('../models/Lead');
const { protect, authorize } = require('../middleware/auth');

// ==================== PUBLIC ROUTES ====================

/**
 * @route   POST /api/leads
 * @desc    Create new lead from contact form (PUBLIC)
 * @access  Public
 */
router.post('/', async (req, res) => {
  try {
    const {
      fullName,
      email,
      phoneNumber,
      inquiryType,
      message
    } = req.body;

    // Validate required fields
    if (!fullName || !email || !phoneNumber || !inquiryType || !message) {
      return res.status(400).json({
        success: false,
        error: 'All fields are required'
      });
    }

    // Validate inquiry type
    const validInquiryTypes = ['buying', 'selling', 'renting', 'land', 'consulting'];
    if (!validInquiryTypes.includes(inquiryType)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid inquiry type'
      });
    }

    // Validate email format
    const emailRegex = /^\S+@\S+\.\S+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid email format'
      });
    }

    // Get IP address (optional)
    const ipAddress = req.headers['x-forwarded-for'] || req.connection.remoteAddress;

    // Create new lead
    const lead = await Lead.create({
      fullName,
      email,
      phoneNumber,
      inquiryType,
      message,
      source: 'Website Contact Form',
      ipAddress: ipAddress || null
    });

    res.status(201).json({
      success: true,
      message: 'Your message has been received! We will contact you soon.',
      data: {
        id: lead._id,
        fullName: lead.fullName,
        email: lead.email,
        inquiryType: lead.inquiryType
      }
    });
  } catch (error) {
    console.error('Error creating lead:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to submit your message. Please try again.'
    });
  }
});

// ==================== ADMIN ROUTES ====================

/**
 * @route   GET /api/leads/admin/all
 * @desc    Get all leads for admin (with role-based filtering)
 * @access  Private/Admin
 */
router.get('/admin/all', protect, authorize('admin', 'superadmin'), async (req, res) => {
  try {
    const {
      status,
      inquiryType,
      priority,
      assignedTo,
      startDate,
      endDate,
      view
    } = req.query;

    // Build filter object
    const filters = {
      status,
      inquiryType,
      priority,
      startDate,
      endDate,
      includeArchived: false,
      includeSpam: false
    };

    // Handle view filter and worker profile filtering
    if (view === 'mine' && req.admin) {
      // Show only leads assigned to current admin's worker profile
      const adminWorkerId = req.admin.workerProfile?._id || req.admin._id;
      filters.assignedTo = adminWorkerId;
    } else if (view === 'unassigned') {
      filters.assignedTo = 'unassigned';
    } else if (view && view !== 'all') {
      // Specific team member ID
      filters.assignedTo = view;
    } else if (assignedTo) {
      // Frontend explicitly passing assignedTo (for agent admins auto-filtering)
      filters.assignedTo = assignedTo;
    }

    // 🆕 AUTO-FILTER: If admin has workerProfile and is NOT superadmin, only show their leads
    if (req.admin.workerProfile && req.admin.role !== 'superadmin' && !assignedTo && view !== 'all') {
      filters.assignedTo = req.admin.workerProfile._id;
    }

    const leads = await Lead.getFilteredLeads(filters);

    res.status(200).json({
      success: true,
      count: leads.length,
      data: leads
    });
  } catch (error) {
    console.error('Error fetching leads:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch leads'
    });
  }
});

/**
 * @route   GET /api/leads/admin/stats
 * @desc    Get lead statistics
 * @access  Private/Admin
 */
router.get('/admin/stats', protect, authorize('admin', 'superadmin'), async (req, res) => {
  try {
    const { view } = req.query;

    let adminId = null;

    // If regular admin viewing "mine", filter stats by their ID
    if (view === 'mine' && req.admin.role === 'admin') {
      adminId = req.admin._id;
    }

    const stats = await Lead.getStats(adminId);

    res.status(200).json({
      success: true,
      data: stats
    });
  } catch (error) {
    console.error('Error fetching stats:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch statistics'
    });
  }
});

/**
 * @route   GET /api/leads/admin/:id
 * @desc    Get single lead by ID
 * @access  Private/Admin
 */
router.get('/admin/:id', protect, authorize('admin', 'superadmin'), async (req, res) => {
  try {
    const lead = await Lead.findById(req.params.id)
      .populate('assignedTo', 'translations.en.name translations.ar.name translations.he.name role email phoneNumber');

    if (!lead) {
      return res.status(404).json({
        success: false,
        error: 'Lead not found'
      });
    }

    res.status(200).json({
      success: true,
      data: lead
    });
  } catch (error) {
    console.error('Error fetching lead:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch lead'
    });
  }
});

/**
 * @route   POST /api/leads/admin/create
 * @desc    Create new lead manually (Admin/Superadmin)
 * @access  Private/Superadmin only
 */
router.post('/admin/create', protect, authorize('superadmin'), async (req, res) => {
  try {
    const {
      fullName,
      email,
      phoneNumber,
      inquiryType,
      message,
      status,
      priority,
      assignedTo,
      source,
      notes
    } = req.body;

    // Validate required fields
    if (!fullName || !email || !phoneNumber || !inquiryType || !message) {
      return res.status(400).json({
        success: false,
        error: 'All required fields must be provided'
      });
    }

    const lead = await Lead.create({
      fullName,
      email,
      phoneNumber,
      inquiryType,
      message,
      status: status || 'New',
      priority: priority || 'Medium',
      assignedTo: assignedTo || null,
      source: source || 'Manual Entry',
      notes: notes || ''
    });

    // Populate assignedTo before sending response
    await lead.populate('assignedTo', 'translations.en.name translations.ar.name translations.he.name role email');

    res.status(201).json({
      success: true,
      data: lead
    });
  } catch (error) {
    console.error('Error creating lead:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to create lead'
    });
  }
});

/**
 * @route   PUT /api/leads/admin/:id
 * @desc    Update lead (with permission checks)
 * @access  Private/Admin
 */
router.put('/admin/:id', protect, authorize('admin', 'superadmin'), async (req, res) => {
  try {
    let lead = await Lead.findById(req.params.id);

    if (!lead) {
      return res.status(404).json({
        success: false,
        error: 'Lead not found'
      });
    }


    // Permission check for regular admin
    if (req.admin.role === 'admin') {
      const adminWorkerId = req.admin.workerProfile?._id || req.admin._id;
      const isAssignedToAdmin = lead.assignedTo && lead.assignedTo.toString() === adminWorkerId.toString();

      if (!isAssignedToAdmin) {
        return res.status(403).json({
          success: false,
          error: 'You can only update leads assigned to you'
        });
      }

      // 🆕 Regular admin can only update certain fields
      const allowedFields = ['status', 'priority', 'notes'];
      const updateData = {};

      allowedFields.forEach(field => {
        if (req.body[field] !== undefined) {
          updateData[field] = req.body[field];
        }
      });

      lead = await Lead.findByIdAndUpdate(
        req.params.id,
        updateData,
        { new: true, runValidators: true }
      ).populate('assignedTo', 'translations.en.name translations.ar.name translations.he.name role email');

    } else {
      // Superadmin can edit everything
      const {
        fullName,
        email,
        phoneNumber,
        inquiryType,
        message,
        status,
        priority,
        notes,
        assignedTo,
        source,
        contactedAt,
        closedAt,
        isArchived,
        isSpam
      } = req.body;

      lead = await Lead.findByIdAndUpdate(
        req.params.id,
        {
          fullName,
          email,
          phoneNumber,
          inquiryType,
          message,
          status,
          priority,
          notes,
          assignedTo,
          source,
          contactedAt,
          closedAt,
          isArchived,
          isSpam
        },
        { new: true, runValidators: true }
      ).populate('assignedTo', 'translations.en.name translations.ar.name translations.he.name role email');
    }

    res.status(200).json({
      success: true,
      data: lead
    });
  } catch (error) {
    console.error('Error updating lead:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to update lead'
    });
  }
});

/**
 * @route   DELETE /api/leads/admin/:id
 * @desc    Delete lead (Superadmin only)
 * @access  Private/Superadmin
 */
router.delete('/admin/:id', protect, authorize('superadmin'), async (req, res) => {
  try {
    const lead = await Lead.findById(req.params.id);

    if (!lead) {
      return res.status(404).json({
        success: false,
        error: 'Lead not found'
      });
    }

    await lead.deleteOne();

    res.status(200).json({
      success: true,
      data: {},
      message: 'Lead deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting lead:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to delete lead'
    });
  }
});

/**
 * @route   PATCH /api/leads/admin/:id/assign
 * @desc    Assign/Reassign lead to team member
 * @access  Private/Superadmin
 */
router.patch('/admin/:id/assign', protect, authorize('superadmin'), async (req, res) => {
  try {
    const { assignedTo } = req.body;

    const lead = await Lead.findByIdAndUpdate(
      req.params.id,
      { assignedTo: assignedTo || null },
      { new: true, runValidators: true }
    ).populate('assignedTo', 'translations.en.name translations.ar.name translations.he.name role email');

    if (!lead) {
      return res.status(404).json({
        success: false,
        error: 'Lead not found'
      });
    }

    res.status(200).json({
      success: true,
      data: lead,
      message: assignedTo ? 'Lead assigned successfully' : 'Lead unassigned successfully'
    });
  } catch (error) {
    console.error('Error assigning lead:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to assign lead'
    });
  }
});

/**
 * @route   PATCH /api/leads/admin/:id/contact
 * @desc    Mark lead as contacted
 * @access  Private/Admin
 */
router.patch('/admin/:id/contact', protect, authorize('admin', 'superadmin'), async (req, res) => {
  try {
    const lead = await Lead.findById(req.params.id);

    if (!lead) {
      return res.status(404).json({
        success: false,
        error: 'Lead not found'
      });
    }

    // Permission check for regular admin
    if (req.admin.role === 'admin') {
      const adminWorkerId = req.admin.workerProfile?._id || req.admin._id;
      const isAssignedToAdmin = lead.assignedTo && lead.assignedTo.toString() === adminWorkerId.toString();

      if (!isAssignedToAdmin) {
        return res.status(403).json({
          success: false,
          error: 'You can only close leads assigned to you'
        });
      }
    }

    await lead.markAsContacted();
    await lead.populate('assignedTo', 'translations.en.name translations.ar.name translations.he.name role email');

    res.status(200).json({
      success: true,
      data: lead,
      message: 'Lead marked as contacted'
    });
  } catch (error) {
    console.error('Error marking lead as contacted:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to update lead'
    });
  }
});

/**
 * @route   PATCH /api/leads/admin/:id/close
 * @desc    Close lead
 * @access  Private/Admin
 */
router.patch('/admin/:id/close', protect, authorize('admin', 'superadmin'), async (req, res) => {
  try {
    const lead = await Lead.findById(req.params.id);

    if (!lead) {
      return res.status(404).json({
        success: false,
        error: 'Lead not found'
      });
    }

    // Permission check for regular admin
    if (req.admin.role === 'admin') {
      const adminWorkerId = req.admin.workerProfile?._id || req.admin._id;
      const isAssignedToAdmin = lead.assignedTo && lead.assignedTo.toString() === adminWorkerId.toString();

      if (!isAssignedToAdmin) {
        return res.status(403).json({
          success: false,
          error: 'You can only close leads assigned to you'
        });
      }
    }

    await lead.closeLead();
    await lead.populate('assignedTo', 'translations.en.name translations.ar.name translations.he.name role email');

    res.status(200).json({
      success: true,
      data: lead,
      message: 'Lead closed successfully'
    });
  } catch (error) {
    console.error('Error closing lead:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to close lead'
    });
  }
});

module.exports = router;