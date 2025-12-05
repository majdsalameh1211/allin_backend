// backend/routes/projects.js
const express = require('express');
const router = express.Router();
const Project = require('../models/Project');
const supabaseService = require('../services/supabaseService');
const multer = require('multer');
const crypto = require('crypto'); // ✅ IMPROVEMENT #2: For unique filenames

// ==========================================
// 🛡️ HELPER FUNCTIONS
// ==========================================

/**
 * Generate unique filename with collision prevention
 * Format: projects/timestamp_random_filename.jpg
 */
const generateUniqueFilename = (originalName, type = 'img') => {
  const timestamp = Date.now();
  const randomHash = crypto.randomBytes(8).toString('hex');
  const cleanName = originalName.replace(/\s/g, '_');
  return `projects/${timestamp}_${type}_${randomHash}_${cleanName}`;
};

/**
 * Rollback uploaded files on error
 */
const rollbackUploads = async (uploadedUrls) => {
  if (uploadedUrls.length > 0) {
    console.log(`🔄 Rolling back ${uploadedUrls.length} uploaded files...`);
    await supabaseService.deleteFiles(uploadedUrls).catch(err =>
      console.error('Rollback failed:', err)
    );
  }
};

// ==========================================
// 🔧 MULTER CONFIGURATION (WITH VALIDATION)
// ==========================================

// ✅ IMPROVEMENT #3: File validation
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB per file
    files: 11 // Max 11 files (1 main + 10 gallery)
  },
  fileFilter: (req, file, cb) => {
    // Only allow images
    if (!file.mimetype.startsWith('image/')) {
      return cb(new Error(`Invalid file type: ${file.mimetype}. Only images allowed.`), false);
    }

    // Allowed formats
    const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/gif'];
    if (!allowedTypes.includes(file.mimetype)) {
      return cb(new Error(`Unsupported image format: ${file.mimetype}`), false);
    }

    cb(null, true);
  }
});

// Configuration for accepting multiple fields
const projectUpload = upload.fields([
  { name: 'mainImageFile', maxCount: 1 },
  { name: 'galleryFiles', maxCount: 10 }
]);

// ==========================================
// 🎯 ERROR HANDLER MIDDLEWARE
// ==========================================
const handleMulterError = (err, req, res, next) => {
  if (err instanceof multer.MulterError) {
    if (err.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({
        error: 'File too large. Maximum size is 10MB per file.'
      });
    }
    if (err.code === 'LIMIT_FILE_COUNT') {
      return res.status(400).json({
        error: 'Too many files. Maximum is 11 files (1 main + 10 gallery).'
      });
    }
    return res.status(400).json({ error: err.message });
  }
  next(err);
};

// ==========================================
// 1️⃣ CREATE PROJECT (POST)
// ==========================================
router.post('/', projectUpload, handleMulterError, async (req, res) => {
  const uploadedUrls = []; // ✅ IMPROVEMENT #1: Track for rollback

  try {

    // ✅ ADD THIS DEBUG
    console.log('📦 CREATE - Files received:', {
      mainImageFile: req.files?.mainImageFile ? 'YES' : 'NO',
      galleryFiles: req.files?.galleryFiles?.length || 0,
      bodyKeys: Object.keys(req.body)
    });

    // A. Parse text fields (FormData sends JSON strings for objects)
    // Parse FormData fields (handle arrays)
    const projectData = {};

    if (req.body.translations) {
      projectData.translations = JSON.parse(
        Array.isArray(req.body.translations)
          ? req.body.translations[0]
          : req.body.translations
      );
    }

    const fields = ['price', 'currency', 'bedrooms', 'bathrooms', 'area', 'areaUnit', 'type', 'status', 'badge'];
    fields.forEach(field => {
      if (req.body[field] !== undefined) {
        const value = Array.isArray(req.body[field]) ? req.body[field][0] : req.body[field];

        if (field === 'currency' || field === 'type' || field === 'status' || field === 'areaUnit') {
          updates[field] = value || (field === 'currency' ? 'ILS' : field === 'type' ? 'forSale' : field === 'status' ? 'active' : 'sqm');
        } else if (field === 'price') {
          updates[field] = value && Number(value) > 0 ? Number(value) : null;
        } else {
          // ✅ FIX: Save 'badge' and any other text fields directly
          updates[field] = value;
        }
      }
    });

    if (req.body.featured !== undefined) {
      const featured = Array.isArray(req.body.featured) ? req.body.featured[0] : req.body.featured;
      projectData.featured = featured === 'true' || featured === true;
    }

    // B. Upload Main Image
    if (req.files && req.files['mainImageFile']) {
      const file = req.files['mainImageFile'][0];
      const fileName = generateUniqueFilename(file.originalname, 'main'); // ✅ IMPROVEMENT #2

      const url = await supabaseService.uploadFile(file.buffer, fileName, file.mimetype);
      projectData.mainImage = url;
      uploadedUrls.push(url); // Track for rollback
    }

    // C. Upload Gallery Images (with error recovery)
    projectData.images = [];
    if (req.files && req.files['galleryFiles']) {
      const files = req.files['galleryFiles'];

      // ✅ IMPROVEMENT #1: Upload with rollback on failure
      for (const file of files) {
        try {
          const fileName = generateUniqueFilename(file.originalname, 'gal'); // ✅ IMPROVEMENT #2
          const url = await supabaseService.uploadFile(file.buffer, fileName, file.mimetype);
          projectData.images.push(url);
          uploadedUrls.push(url); // Track for rollback
        } catch (uploadError) {
          console.error(`Failed to upload ${file.originalname}:`, uploadError);
          // Rollback all uploaded files
          await rollbackUploads(uploadedUrls);
          throw new Error(`Image upload failed: ${uploadError.message}`);
        }
      }
    }

    // D. Save to MongoDB
    const newProject = new Project(projectData);
    await newProject.save();

    console.log(`✅ Project Created: ${newProject._id}`);
    res.status(201).json({ success: true, data: newProject });

  } catch (error) {
    console.error('Error creating project:', error);

    // ✅ IMPROVEMENT #1: Cleanup on error
    await rollbackUploads(uploadedUrls);

    res.status(500).json({
      error: error.message || 'Failed to create project'
    });
  }
});

// ==========================================
// 2️⃣ UPDATE PROJECT (PUT)
// ==========================================
router.put('/:id', projectUpload, handleMulterError, async (req, res) => {
  const uploadedUrls = []; // Track new uploads for rollback

  try {
    const project = await Project.findById(req.params.id);
    if (!project) return res.status(404).json({ error: 'Project not found' });


    // ✅ ADD THIS DEBUG
    console.log('📦 UPDATE - Files received:', {
      mainImageFile: req.files?.mainImageFile ? 'YES' : 'NO',
      galleryFiles: req.files?.galleryFiles?.length || 0,
      existingImages: req.body.existingImages
    });

    // A. Prepare Updates
    // A. Parse text fields and handle arrays from FormData
    const updates = {};

    // Parse translations
    if (req.body.translations) {
      updates.translations = JSON.parse(
        Array.isArray(req.body.translations)
          ? req.body.translations[0]
          : req.body.translations
      );
    }

    const fields = ['price', 'currency', 'bedrooms', 'bathrooms', 'area', 'areaUnit', 'type', 'status', 'badge'];
    fields.forEach(field => {
      if (req.body[field] !== undefined) {
        const value = Array.isArray(req.body[field]) ? req.body[field][0] : req.body[field];

        if (field === 'currency' || field === 'type' || field === 'status' || field === 'areaUnit') {
          updates[field] = value || (field === 'currency' ? 'ILS' : field === 'type' ? 'forSale' : field === 'status' ? 'active' : 'sqm');
        } else if (field === 'price') {
          updates[field] = value && Number(value) > 0 ? Number(value) : null;
        } else {
          // ✅ FIX: Save all other fields (badge, bedrooms, bathrooms, area, etc.)
          updates[field] = value;
        }
      }
    });

    // Handle boolean
    if (req.body.featured !== undefined) {
      const featured = Array.isArray(req.body.featured) ? req.body.featured[0] : req.body.featured;
      updates.featured = featured === 'true' || featured === true;
    }

    // B. Handle Main Image Replacement
    let oldMainImage = null;
    if (req.files && req.files['mainImageFile']) {
      const file = req.files['mainImageFile'][0];
      const fileName = generateUniqueFilename(file.originalname, 'main'); // ✅ IMPROVEMENT #2

      try {
        // Upload new image first
        const newUrl = await supabaseService.uploadFile(file.buffer, fileName, file.mimetype);
        uploadedUrls.push(newUrl);

        // Store old image for deletion (delete after successful DB update)
        oldMainImage = project.mainImage;
        updates.mainImage = newUrl;
      } catch (uploadError) {
        await rollbackUploads(uploadedUrls);
        throw new Error(`Main image upload failed: ${uploadError.message}`);
      }
    }

    // C. Handle Gallery Logic (Merge Old + New)
    let finalImages = [];
    const imagesToDeleteLater = [];

    // 1. Keep "Existing" images sent from frontend
    if (req.body.existingImages) {
      finalImages = Array.isArray(req.body.existingImages)
        ? req.body.existingImages
        : [req.body.existingImages];
    }

    // 2. Identify removed images (delete after DB update)
    const imagesToDelete = project.images.filter(url => !finalImages.includes(url));
    if (imagesToDelete.length > 0) {
      imagesToDeleteLater.push(...imagesToDelete);
    }

    // 3. Upload "New" Gallery Files
    if (req.files && req.files['galleryFiles']) {
      const files = req.files['galleryFiles'];

      // ✅ IMPROVEMENT #1: Upload with rollback
      for (const file of files) {
        try {
          const fileName = generateUniqueFilename(file.originalname, 'gal'); // ✅ IMPROVEMENT #2
          const url = await supabaseService.uploadFile(file.buffer, fileName, file.mimetype);
          finalImages.push(url);
          uploadedUrls.push(url);
        } catch (uploadError) {
          console.error(`Failed to upload ${file.originalname}:`, uploadError);
          await rollbackUploads(uploadedUrls);
          throw new Error(`Gallery upload failed: ${uploadError.message}`);
        }
      }
    }

    updates.images = finalImages;

    // D. Update MongoDB
    const updatedProject = await Project.findByIdAndUpdate(req.params.id, updates, { new: true });

    // E. Async cleanup of old images (don't wait)
    // ✅ IMPROVEMENT #5: Async delete for faster response
    if (oldMainImage) {
      imagesToDeleteLater.push(oldMainImage);
    }
    if (imagesToDeleteLater.length > 0) {
      supabaseService.deleteFiles(imagesToDeleteLater)
        .then(() => console.log(`🗑️ Cleaned up ${imagesToDeleteLater.length} old images`))
        .catch(err => console.error('Async cleanup failed:', err));
    }

    console.log(`✅ Project Updated: ${updatedProject._id}`);
    res.json({ success: true, data: updatedProject });

  } catch (error) {
    console.error('Error updating project:', error);

    // Rollback new uploads
    await rollbackUploads(uploadedUrls);

    res.status(500).json({
      error: error.message || 'Failed to update project'
    });
  }
});

// ==========================================
// 3️⃣ DELETE PROJECT (DELETE)
// ==========================================
router.delete('/:id', async (req, res) => {
  try {
    const { permanent } = req.query;

    if (permanent === 'true') {
      // HARD DELETE: Remove data + images

      // 1. Find project (needed to get image URLs)
      const project = await Project.findById(req.params.id);
      if (!project) return res.status(404).json({ error: 'Project not found' });

      // 2. Collect ALL images to delete
      const imagesToDelete = [];
      if (project.mainImage) imagesToDelete.push(project.mainImage);
      if (project.images && project.images.length > 0) {
        imagesToDelete.push(...project.images);
      }

      // 3. Delete from MongoDB first (safer)
      await project.deleteOne();

      // 4. Async delete from Supabase (don't wait)
      // ✅ IMPROVEMENT #5: Async delete for faster response
      if (imagesToDelete.length > 0) {
        supabaseService.deleteFiles(imagesToDelete)
          .then(() => console.log(`🗑️ Permanently deleted ${imagesToDelete.length} images`))
          .catch(err => console.error('Image deletion failed:', err));
      }

      console.log(`🗑️ Project Permanently Deleted: ${req.params.id}`);
      res.json({ success: true, message: 'Project and images deleted permanently' });

    } else {
      // SOFT DELETE: Just update status
      await Project.findByIdAndUpdate(req.params.id, { status: 'deleted' });
      res.json({ success: true, message: 'Project marked as deleted' });
    }

  } catch (error) {
    console.error('Error deleting project:', error);
    res.status(500).json({ error: error.message });
  }
});

// ==========================================
// 4️⃣ GET ROUTES
// ==========================================

router.get('/', async (req, res) => {
  try {
    let {
      lang = 'en',
      type = 'all',
      featured,
      limit,
      page = 1
    } = req.query;

    lang = lang.split('-')[0].toLowerCase();

    if (!['en', 'ar', 'he'].includes(lang)) {
      return res.status(400).json({
        error: 'Invalid language. Must be: en, ar, or he'
      });
    }

    let query = { status: { $ne: 'deleted' } };

    if (type && type !== 'all') {
      if (!['forSale', 'forRent', 'sold'].includes(type)) {
        return res.status(400).json({
          error: 'Invalid type. Must be: forSale, forRent, sold, or all'
        });
      }
      query.type = type;
    }

    if (featured === 'true') {
      query.featured = true;
    }

    let projectsQuery = Project.find(query).sort({ createdAt: -1 });

    if (limit) {
      const limitNum = parseInt(limit);
      const pageNum = parseInt(page);
      const skip = (pageNum - 1) * limitNum;
      projectsQuery = projectsQuery.limit(limitNum).skip(skip);
    }

    const projects = await projectsQuery;
    const totalCount = await Project.countDocuments(query);

    const formattedProjects = projects.map(project => ({
      id: project._id,
      title: project.translations[lang].title,
      location: project.translations[lang].location,
      shortDesc: project.translations[lang].shortDesc,
      price: project.price,
      currency: project.currency,
      formattedPrice: project.formattedPrice,
      pricePerMonth: project.pricePerMonth,
      bedrooms: project.bedrooms,
      bathrooms: project.bathrooms,
      area: project.area,
      areaUnit: project.areaUnit,
      type: project.type,
      status: project.status,
      featured: project.featured,
      badge: project.badge,
      mainImage: project.mainImage,
      images: project.images,
      imageCount: project.imageCount,
      createdAt: project.createdAt
    }));

    const response = {
      projects: formattedProjects,
      pagination: {
        total: totalCount,
        page: parseInt(page),
        limit: limit ? parseInt(limit) : totalCount,
        pages: limit ? Math.ceil(totalCount / parseInt(limit)) : 1
      }
    };

    res.json(response);

  } catch (error) {
    console.error('Error fetching projects:', error);
    res.status(500).json({
      error: 'Failed to fetch projects',
      message: error.message
    });
  }
});

router.get('/:id', async (req, res) => {
  try {
    const { lang = 'en', includeAllTranslations } = req.query;

    // Normalize language code
    const normalizedLang = lang.split('-')[0].toLowerCase();

    // Validate language
    if (!['en', 'ar', 'he'].includes(normalizedLang)) {
      return res.status(400).json({
        error: 'Invalid language. Must be: en, ar, or he'
      });
    }

    const project = await Project.findById(req.params.id);

    if (!project) {
      return res.status(404).json({ error: 'Project not found' });
    }

    // Check if project is deleted
    if (project.status === 'deleted') {
      return res.status(404).json({ error: 'Project not found' });
    }

    // If includeAllTranslations is requested, return full translations object
    if (includeAllTranslations === 'true') {
      const response = {
        id: project._id,
        translations: project.translations,
        price: project.price,
        currency: project.currency,
        formattedPrice: project.formattedPrice,
        pricePerMonth: project.pricePerMonth,
        bedrooms: project.bedrooms,
        bathrooms: project.bathrooms,
        area: project.area,
        areaUnit: project.areaUnit,
        type: project.type,
        status: project.status,
        featured: project.featured,
        badge: project.badge,
        images: project.images,
        mainImage: project.mainImage,
        imageCount: project.imageCount,
        createdAt: project.createdAt,
        updatedAt: project.updatedAt
      };
      return res.json(response);
    }

    // Format response with selected language
    const response = {
      id: project._id,
      title: project.translations[normalizedLang].title,
      location: project.translations[normalizedLang].location,
      shortDesc: project.translations[normalizedLang].shortDesc,
      fullDesc: project.translations[normalizedLang].fullDesc,
      features: project.translations[normalizedLang].features,
      price: project.price,
      currency: project.currency,
      formattedPrice: project.formattedPrice,
      pricePerMonth: project.pricePerMonth,
      bedrooms: project.bedrooms,
      bathrooms: project.bathrooms,
      area: project.area,
      areaUnit: project.areaUnit,
      type: project.type,
      status: project.status,
      featured: project.featured,
      badge: project.badge,
      images: project.images,
      mainImage: project.mainImage,
      imageCount: project.imageCount,
      createdAt: project.createdAt,
      updatedAt: project.updatedAt
    };

    res.json(response);

  } catch (error) {
    console.error('Error fetching project:', error);

    if (error.kind === 'ObjectId') {
      return res.status(404).json({ error: 'Project not found' });
    }

    res.status(500).json({
      error: 'Failed to fetch project',
      message: error.message
    });
  }
});

/**
 * @route   GET /api/projects/search/:query
 * @desc    Search projects by title or location
 * @query   lang - Language (en, ar, he) - default: en
 * @access  Public
 */
router.get('/search/:query', async (req, res) => {
  try {
    const { query } = req.params;
    let { lang = 'en' } = req.query; // ✅ IMPROVEMENT #4: Fixed - Changed const to let

    // Normalize language code
    lang = lang.split('-')[0].toLowerCase();

    // Validate language
    if (!['en', 'ar', 'he'].includes(lang)) {
      return res.status(400).json({
        error: 'Invalid language. Must be: en, ar, or he'
      });
    }

    // Search in title and location
    const projects = await Project.find({
      status: { $ne: 'deleted' },
      $or: [
        { [`translations.${lang}.title`]: { $regex: query, $options: 'i' } },
        { [`translations.${lang}.location`]: { $regex: query, $options: 'i' } }
      ]
    }).sort({ createdAt: -1 });

    // Format results
    const formattedProjects = projects.map(project => ({
      id: project._id,
      title: project.translations[lang].title,
      location: project.translations[lang].location,
      shortDesc: project.translations[lang].shortDesc,
      price: project.price,
      mainImage: project.mainImage,
      type: project.type,
      featured: project.featured
    }));

    res.json({
      results: formattedProjects,
      count: formattedProjects.length,
      query: query
    });

  } catch (error) {
    console.error('Error searching projects:', error);
    res.status(500).json({
      error: 'Failed to search projects',
      message: error.message
    });
  }
});

module.exports = router;