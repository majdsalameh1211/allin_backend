// backend/routes/team.js
const express = require('express');
const router = express.Router();
const multer = require('multer');
const TeamMember = require('../models/TeamMember');
const { protect, authorize } = require('../middleware/auth');
const supabaseService = require('../services/supabaseService');
const crypto = require('crypto');

// ==========================================
// 🛡️ HELPER FUNCTIONS
// ==========================================

/**
 * Generate unique filename with collision prevention
 * Format: team/timestamp_random_filename.jpg
 */
const generateUniqueFilename = (originalName) => {
  const timestamp = Date.now();
  const randomHash = crypto.randomBytes(8).toString('hex');
  const cleanName = originalName.replace(/\s/g, '_');
  return `team/${timestamp}_${randomHash}_${cleanName}`;
};

/**
 * Rollback uploaded image on error
 */
const rollbackUpload = async (imageUrl) => {
  if (imageUrl) {
    console.log(`🔄 Rolling back uploaded image...`);
    await supabaseService.deleteFile(imageUrl).catch(err =>
      console.error('Rollback failed:', err)
    );
  }
};

// ==========================================
// 🔧 MULTER CONFIGURATION (WITH VALIDATION)
// ==========================================

const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB max
    files: 1 // Only 1 profile image
  },
  fileFilter: (req, file, cb) => {
    // Only allow images
    if (!file.mimetype.startsWith('image/')) {
      return cb(new Error(`Invalid file type: ${file.mimetype}. Only images allowed.`), false);
    }

    // Allowed formats
    const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
    if (!allowedTypes.includes(file.mimetype)) {
      return cb(new Error(`Unsupported image format: ${file.mimetype}`), false);
    }

    cb(null, true);
  }
});

// ==========================================
// 🎯 ERROR HANDLER MIDDLEWARE
// ==========================================
const handleMulterError = (err, req, res, next) => {
  if (err instanceof multer.MulterError) {
    if (err.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({
        error: 'File too large. Maximum size is 10MB.'
      });
    }
    return res.status(400).json({ error: err.message });
  }
  next(err);
};

// ==========================================
// PUBLIC ROUTES
// ==========================================
// @route   GET /api/team
// @desc    Get all active team members
// @access  Public
router.get('/', async (req, res) => {
  try {
    const lang = req.query.lang || 'en';

    const members = await TeamMember.find({ active: true })
      .sort({ order: 1 });

    // Map with fallback to English
    const formattedMembers = members.map(member => ({
      id: member._id,
      name: member.translations?.[lang]?.name || member.translations?.en?.name || '',
      title: member.translations?.[lang]?.title || member.translations?.en?.title || '',
      quote: member.translations?.[lang]?.quote || member.translations?.en?.quote || '',
      bio: member.translations?.[lang]?.bio || member.translations?.en?.bio || '',
      specialties: member.translations?.[lang]?.specialties || member.translations?.en?.specialties || [],
      image: member.image,
      role: member.role,
      licenseNumber: member.licenseNumber,
      licenseType: member.licenseType,
      email: member.email,
      phoneNumber: member.phoneNumber,
      socialMedia: member.socialMedia,
      stats: member.stats,
      featured: member.featured,
      order: member.order
    }));

    res.json(formattedMembers);
  } catch (error) {
    console.error('Error fetching team members:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// @route   GET /api/team/:id
// @desc    Get single team member
// @access  Public
router.get('/:id', async (req, res) => {
  try {
    const lang = req.query.lang || 'en';
    const includeAllTranslations = req.query.includeAllTranslations === 'true';

    const member = await TeamMember.findById(req.params.id);

    if (!member) {
      return res.status(404).json({ error: 'Team member not found' });
    }

    // If admin wants all translations
    if (includeAllTranslations) {
      return res.json(member);
    }

    // Public view - single language
    const formattedMember = {
      id: member._id,
      name: member.translations?.[lang]?.name || '',
      title: member.translations?.[lang]?.title || '',
      bio: member.translations?.[lang]?.bio || '',
      specialties: member.translations?.[lang]?.specialties || [],
      image: member.image,
      role: member.role,
      licenseNumber: member.licenseNumber,
      licenseType: member.licenseType,
      email: member.email,
      phoneNumber: member.phoneNumber,
      socialMedia: member.socialMedia,
      stats: member.stats,
      featured: member.featured,
      order: member.order
    };

    res.json(formattedMember);
  } catch (error) {
    console.error('Error fetching team member:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// ==========================================
// ADMIN ROUTES (Protected)
// ==========================================

// @route   GET /api/team/admin/all
// @desc    Get all team members (including inactive) - ADMIN ONLY
// @access  Private/Admin
router.get('/admin/all', protect, authorize('admin', 'superadmin'), async (req, res) => {
  try {
    const lang = req.query.lang || 'en';

    const members = await TeamMember.find()
      .select(`
        translations.${lang}.name
        translations.${lang}.title
        image
        role
        email
        licenseNumber
        featured
        active
        order
      `)
      .sort({ order: 1 });

    const formattedMembers = members.map(member => ({
      id: member._id,
      name: member.translations?.[lang]?.name || '',
      title: member.translations?.[lang]?.title || '',
      image: member.image,
      role: member.role,
      email: member.email,
      licenseNumber: member.licenseNumber,
      featured: member.featured,
      active: member.active,
      order: member.order
    }));

    res.json(formattedMembers);
  } catch (error) {
    console.error('Error fetching team members:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// @route   GET /api/team/admin/:id
// @desc    Get single team member with all translations - ADMIN ONLY
// @access  Private/Admin
router.get('/admin/:id', protect, authorize('admin', 'superadmin'), async (req, res) => {
  try {
    const member = await TeamMember.findById(req.params.id);

    if (!member) {
      return res.status(404).json({ error: 'Team member not found' });
    }

    res.json(member);
  } catch (error) {
    console.error('Error fetching team member:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// @route   POST /api/team
// @desc    Create team member with image upload
// @access  Private/Admin
router.post('/', protect, authorize('admin', 'superadmin'), upload.single('imageFile'), handleMulterError, async (req, res) => {
  let uploadedImageUrl = null;

  try {
    console.log('📦 CREATE - File received:', req.file ? 'YES' : 'NO');
    console.log('📦 CREATE - Body fields:', Object.keys(req.body));

    // Parse JSON fields from FormData
    const translations = JSON.parse(req.body.translations || '{}');
    const socialMedia = JSON.parse(req.body.socialMedia || '{}');
    const stats = JSON.parse(req.body.stats || '[]');

    // Validate required fields in all languages
    const requiredLangs = ['en', 'ar', 'he'];
    for (const lang of requiredLangs) {
      if (!translations[lang]?.name) {
        return res.status(400).json({ error: `${lang.toUpperCase()} name is required` });
      }
    }

    // Validate email
    if (!req.body.email) {
      return res.status(400).json({ error: 'Email is required' });
    }

    // Validate license number uniqueness
    if (req.body.licenseNumber) {
      const existingMember = await TeamMember.findOne({ 
        licenseNumber: req.body.licenseNumber 
      });
      if (existingMember) {
        return res.status(400).json({ error: 'License number already exists' });
      }
    }

    // Handle image upload
    let imageUrl = req.body.image || 'https://via.placeholder.com/400x400/d4af37/ffffff?text=Team+Member';

    if (req.file) {
      console.log('📤 Uploading image to Supabase...');
      const filename = generateUniqueFilename(req.file.originalname);
      uploadedImageUrl = await supabaseService.uploadFile(
        req.file.buffer,
        filename,
        req.file.mimetype
      );
      imageUrl = uploadedImageUrl;
      console.log('✅ Image uploaded:', imageUrl);
    }

    // Create team member
    const memberData = {
      translations,
      email: req.body.email,
      phoneNumber: req.body.phoneNumber || '',
      licenseNumber: req.body.licenseNumber || '',
      licenseType: req.body.licenseType || 'Real Estate Agent',
      role: req.body.role || 'agent',
      image: imageUrl,
      socialMedia,
      stats,
      order: parseInt(req.body.order) || 0,
      featured: req.body.featured === 'true',
      active: req.body.active === 'true'
    };

    const member = await TeamMember.create(memberData);

    console.log('✅ Team member created:', member._id);
    res.status(201).json(member);

  } catch (error) {
    console.error('❌ Error creating team member:', error);
    
    // Rollback uploaded image on error
    if (uploadedImageUrl) {
      await rollbackUpload(uploadedImageUrl);
    }

    res.status(400).json({ 
      error: error.message || 'Failed to create team member' 
    });
  }
});

// @route   PUT /api/team/:id
// @desc    Update team member with optional image upload
// @access  Private/Admin
router.put('/:id', protect, authorize('admin', 'superadmin'), upload.single('imageFile'), handleMulterError, async (req, res) => {
  let newImageUrl = null;
  let oldImageUrl = null;

  try {
    console.log('📦 UPDATE - File received:', req.file ? 'YES' : 'NO');
    console.log('📦 UPDATE - Body fields:', Object.keys(req.body));

    const member = await TeamMember.findById(req.params.id);
    if (!member) {
      return res.status(404).json({ error: 'Team member not found' });
    }

    // Save old image URL for potential deletion
    oldImageUrl = member.image;

    // Parse JSON fields
    const translations = req.body.translations ? JSON.parse(req.body.translations) : member.translations;
    const socialMedia = req.body.socialMedia ? JSON.parse(req.body.socialMedia) : member.socialMedia;
    const stats = req.body.stats ? JSON.parse(req.body.stats) : member.stats;

    // Validate license number uniqueness if changed
    if (req.body.licenseNumber && req.body.licenseNumber !== member.licenseNumber) {
      const existingMember = await TeamMember.findOne({
        licenseNumber: req.body.licenseNumber,
        _id: { $ne: req.params.id }
      });
      if (existingMember) {
        return res.status(400).json({ error: 'License number already exists' });
      }
    }

    // Handle new image upload
    if (req.file) {
      console.log('📤 Uploading new image to Supabase...');
      const filename = generateUniqueFilename(req.file.originalname);
      newImageUrl = await supabaseService.uploadFile(
        req.file.buffer,
        filename,
        req.file.mimetype
      );
      console.log('✅ New image uploaded:', newImageUrl);
    }

    // Update fields
    const updateData = {
      translations,
      socialMedia,
      stats,
      email: req.body.email || member.email,
      phoneNumber: req.body.phoneNumber !== undefined ? req.body.phoneNumber : member.phoneNumber,
      licenseNumber: req.body.licenseNumber !== undefined ? req.body.licenseNumber : member.licenseNumber,
      licenseType: req.body.licenseType || member.licenseType,
      role: req.body.role || member.role,
      order: req.body.order !== undefined ? parseInt(req.body.order) : member.order,
      featured: req.body.featured !== undefined ? req.body.featured === 'true' : member.featured,
      active: req.body.active !== undefined ? req.body.active === 'true' : member.active
    };

    // Set image: new upload > provided URL > keep existing
    if (newImageUrl) {
      updateData.image = newImageUrl;
    } else if (req.body.image) {
      updateData.image = req.body.image;
    } else {
      updateData.image = member.image;
    }

    // Update member
    const updatedMember = await TeamMember.findByIdAndUpdate(
      req.params.id,
      updateData,
      { new: true, runValidators: true }
    );

    // Delete old image if new one was uploaded successfully
    if (newImageUrl && oldImageUrl && oldImageUrl.includes('supabase')) {
      console.log('🗑️ Deleting old image...');
      await supabaseService.deleteFile(oldImageUrl);
    }

    console.log('✅ Team member updated:', updatedMember._id);
    res.json(updatedMember);

  } catch (error) {
    console.error('❌ Error updating team member:', error);

    // Rollback new image if uploaded but update failed
    if (newImageUrl) {
      await rollbackUpload(newImageUrl);
    }

    res.status(400).json({ 
      error: error.message || 'Failed to update team member' 
    });
  }
});

// @route   DELETE /api/team/:id
// @desc    Delete team member and their image
// @access  Private/Admin
router.delete('/:id', protect, authorize('admin', 'superadmin'), async (req, res) => {
  try {
    const member = await TeamMember.findById(req.params.id);

    if (!member) {
      return res.status(404).json({ error: 'Team member not found' });
    }

    // Delete image from Supabase if exists
    if (member.image && member.image.includes('supabase')) {
      console.log('🗑️ Deleting image from Supabase...');
      await supabaseService.deleteFile(member.image);
    }

    // Delete member
    await member.deleteOne();

    console.log('✅ Team member and image deleted');
    res.json({ message: 'Team member deleted successfully' });

  } catch (error) {
    console.error('❌ Error deleting team member:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;