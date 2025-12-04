// backend/routes/admin.js
const express = require('express');
const router = express.Router();
const Admin = require('../models/Admin');
const { protect, authorize } = require('../middleware/auth'); // Import middleware

/**
 * Helper function to send token response
 */
const sendTokenResponse = (admin, statusCode, res) => {
  const token = admin.getSignedJwtToken();

  // Determine display name: use worker profile name if linked
  const name = admin.workerProfile
    ? admin.workerProfile.translations.en.name
    : `${admin.firstName} ${admin.lastName}`;

  res.status(statusCode).json({
    success: true,
    token,
    admin: {
      id: admin._id,
      email: admin.email,
      firstName: admin.firstName,
      lastName: admin.lastName,
      name: name, // Display name for UI
      role: admin.role,
      createdAt: admin.createdAt,
      workerProfile: admin.workerProfile || null // Send full worker data if linked
    }
  });
};

// ===================================
// PUBLIC ROUTES
// ===================================

/**
 * @route   POST /api/admin/register
 * @desc    Register a new Admin (Initial setup only)
 * @access  Public (Only if no admins exist)
 */
router.post('/register', async (req, res) => {
  try {
    // Check if any SUPERADMIN exists
    const adminCount = await Admin.countDocuments({ role: 'superadmin' });

    if (adminCount > 0) {
      return res.status(403).json({
        success: false,
        error: 'Registration is closed. A Superadmin user already exists.'
      });
    }

    const { email, password, firstName = "Super", lastName = "Admin" } = req.body;

    const admin = await Admin.create({
      email,
      password,
      role: 'superadmin',
      firstName,
      lastName
    });

    // Must re-fetch with populate (even if workerProfile is null)
    const populatedAdmin = await Admin.findById(admin._id).populate('workerProfile');

    sendTokenResponse(populatedAdmin, 201, res);

  } catch (error) {
    if (error.name === 'ValidationError' || error.code === 11000) {
      return res.status(400).json({ success: false, error: error.message || 'Validation failed.' });
    }

    res.status(500).json({ success: false, error: 'Server error during registration' });
  }
});

/**
 * @route   POST /api/admin/login
 * @desc    Log in an Admin
 * @access  Public
 */
router.post('/login', async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({
      success: false,
      error: 'Please provide an email and password'
    });
  }

  try {
    const admin = await Admin.findOne({ email }).select('+password').populate('workerProfile');

    if (!admin) {
      return res.status(401).json({ success: false, error: 'Invalid credentials' });
    }

    const isMatch = await admin.matchPassword(password);

    if (!isMatch) {
      return res.status(401).json({ success: false, error: 'Invalid credentials' });
    }

    sendTokenResponse(admin, 200, res);

  } catch (error) {
    res.status(500).json({ success: false, error: 'Server error during login' });
  }
});

// ===================================
// ME ROUTE
// ===================================

/**
 * @route   GET /api/admin/me
 * @desc    Get current logged in admin details
 * @access  Private
 */
router.get('/me', protect, async (req, res) => {
  try {
    // Populate workerProfile to get the image
    const admin = await Admin.findById(req.admin.id).populate('workerProfile');
    
    if (!admin) {
      return res.status(404).json({ success: false, error: 'Admin not found' });
    }

    // Reuse the helper to ensure consistent format
    sendTokenResponse(admin, 200, res);
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, error: 'Server Error' });
  }
});





// ===================================
// PROTECTED ROUTES (Admin Management)
// ===================================

/**
 * @route   GET /api/admin/users
 * @desc    Get all Admin Users (Superadmin only)
 * @access  Private/Superadmin
 */
router.get('/users', protect, authorize('superadmin'), async (req, res) => {
  try {
    // Only return non-sensitive fields
    const users = await Admin.find()
      .select('-password -__v')
      .populate('workerProfile');

    res.status(200).json({ success: true, count: users.length, data: users });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to fetch admin users' });
  }
});

/**
 * @route   POST /api/admin/users
 * @desc    Create a new Admin User (Superadmin only)
 * @access  Private/Superadmin
 */
router.post('/users', protect, authorize('superadmin'), async (req, res) => {
  try {
    const { firstName, lastName, email, phoneNumber, role, password, workerProfile } = req.body;

    // Validate workerProfile if provided
    if (workerProfile) {
      const TeamMember = require('../models/TeamMember');
      const workerExists = await TeamMember.findById(workerProfile);
      if (!workerExists) {
        return res.status(400).json({
          success: false,
          error: 'Invalid workerProfile ID - TeamMember not found'
        });
      }
    }

    const newAdmin = await Admin.create({
      firstName,
      lastName,
      email,
      phoneNumber,
      role: role || 'admin',
      password,
      workerProfile: workerProfile || null // Add this field
    });

    // Populate before returning
    const populatedAdmin = await Admin.findById(newAdmin._id)
      .select('-password')
      .populate('workerProfile');

    res.status(201).json({ success: true, data: populatedAdmin });
  } catch (error) {
    if (error.name === 'ValidationError' || error.code === 11000) {
      return res.status(400).json({ success: false, error: error.message });
    }
    res.status(500).json({ success: false, error: 'Failed to create admin user' });
  }
});
/**
 * @route   GET /api/admin/users/:id
 * @desc    Get single Admin User (Superadmin only)
 * @access  Private/Superadmin
 */
router.get('/users/:id', protect, authorize('superadmin'), async (req, res) => {
  try {
    const user = await Admin.findById(req.params.id)
      .select('-password -__v')
      .populate('workerProfile');

    if (!user) {
      return res.status(404).json({ success: false, error: 'Admin user not found' });
    }

    res.status(200).json({ success: true, data: user });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to fetch admin user' });
  }
});

/**
 * @route   PUT /api/admin/users/:id
 * @desc    Update Admin User data (Superadmin only)
 * @access  Private/Superadmin
 */
router.put('/users/:id', protect, authorize('superadmin'), async (req, res) => {
  try {
    const updateFields = { ...req.body };
    delete updateFields.password; // Handle separately

    // Validate workerProfile if being updated
    if (updateFields.workerProfile) {
      const TeamMember = require('../models/TeamMember');
      const workerExists = await TeamMember.findById(updateFields.workerProfile);
      if (!workerExists) {
        return res.status(400).json({ 
          success: false, 
          error: 'Invalid workerProfile ID - TeamMember not found' 
        });
      }
    }

    const admin = await Admin.findByIdAndUpdate(req.params.id, updateFields, {
      new: true,
      runValidators: true,
      select: '-password'
    }).populate('workerProfile'); // Add populate

    if (!admin) {
      return res.status(404).json({ 
        success: false, 
        error: `Admin with ID ${req.params.id} not found` 
      });
    }

    // Handle password update if included
    if (req.body.password) {
      admin.password = req.body.password;
      await admin.save();
    }

    res.status(200).json({ success: true, data: admin });
  } catch (error) {
    if (error.name === 'ValidationError') {
      return res.status(400).json({ success: false, error: error.message });
    }
    res.status(500).json({ success: false, error: 'Failed to update admin user' });
  }
});


/**
 * @route   DELETE /api/admin/users/:id
 * @desc    Delete an Admin User (Superadmin only)
 * @access  Private/Superadmin
 */
router.delete('/users/:id', protect, authorize('superadmin'), async (req, res) => {
  try {
    // Prevent a superadmin from deleting themselves
    if (req.params.id.toString() === req.admin.id.toString()) {
      return res.status(403).json({ success: false, error: 'Cannot delete your own superadmin account' });
    }

    const admin = await Admin.findByIdAndDelete(req.params.id);

    if (!admin) {
      return res.status(404).json({ success: false, error: `Admin with ID ${req.params.id} not found` });
    }

    res.status(200).json({ success: true, data: {} });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to delete admin user' });
  }
});

module.exports = router;