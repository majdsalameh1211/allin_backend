// backend/routes/services.js
const express = require('express');
const router = express.Router();
const multer = require('multer');
const Service = require('../models/Service');

const crypto = require('crypto');
const sharp = require('sharp');

// ==================== MULTER CONFIGURATION ====================
const storage = multer.memoryStorage();

const upload = multer({
  storage,
  limits: {
    fileSize: 10 * 1024 * 1024 // 10MB max
  },
  fileFilter: (req, file, cb) => {
    const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Invalid file type. Only JPEG, PNG, and WebP are allowed.'));
    }
  }
});

// ==================== HELPER FUNCTIONS ====================

/**
 * Generate unique filename
 */
const generateUniqueFilename = (originalName) => {
  const ext = originalName.split('.').pop();
  const timestamp = Date.now();
  const randomString = crypto.randomBytes(8).toString('hex');
  return `service_icon_${timestamp}_${randomString}.${ext}`;
};

/**
 * Upload single image to Supabase
 */
const uploadImageToSupabase = async (supabase, file, filePath) => {
  if (!supabase) {
    throw new Error('Supabase client not provided to uploadImageToSupabase');
  }

  try {
    const compressedBuffer = await sharp(file.buffer)
      .resize(800, 800, { fit: 'inside', withoutEnlargement: true })
      .jpeg({ quality: 85 })
      .toBuffer();

    const { error } = await supabase.storage
      .from('media') // ✅ use media bucket
      .upload(filePath, compressedBuffer, {
        contentType: 'image/jpeg',
        cacheControl: '3600',
        upsert: false
      });

    if (error) {
      console.error('Supabase upload error:', error);
      throw new Error(`Failed to upload image: ${error.message}`);
    }

    const { data: { publicUrl } } = supabase.storage
      .from('media')
      .getPublicUrl(filePath);

    return publicUrl;

  } catch (error) {
    console.error('Supabase upload failed:', error);
    throw error;
  }
};


/**
 * Delete image from Supabase
 */
const deleteImageFromSupabase = async (supabase, imageUrl, context = '') => {
  try {
    console.log('🧹 [deleteImageFromSupabase] Called', {
      context,
      hasSupabase: !!supabase,
      imageUrl
    });

    if (!supabase) {
      console.warn('⚠️ Supabase client not provided to deleteImageFromSupabase');
      return;
    }

    if (!imageUrl || !imageUrl.includes('supabase')) {
      console.warn('⚠️ Image URL is not a Supabase URL or is empty. Skipping delete.');
      return; // Skip if not a Supabase URL
    }

    // Example public URL:
    // https://.../storage/v1/object/public/media/services/xxx.jpg
    const splitToken = '/media/';
    const urlParts = imageUrl.split(splitToken);

    console.log('🧹 [deleteImageFromSupabase] urlParts:', urlParts);

    if (urlParts.length < 2) {
      console.warn('⚠️ Could not extract file path from URL. Skipping delete.');
      return;
    }

    const filePath = urlParts[1]; // "services/xxx.jpg"
    console.log('🧹 [deleteImageFromSupabase] filePath to delete:', filePath);

    const { error } = await supabase.storage
      .from('media')
      .remove([filePath]);

    if (error) {
      console.warn('❌ Failed to delete image from Supabase:', error.message);
    } else {
      console.log(`✅ Deleted image from Supabase: ${filePath}`);
    }

  } catch (error) {
    console.warn('❌ Error deleting image from Supabase:', error.message);
  }
};


// ==================== ROUTES ====================

/**
 * @route   GET /api/services
 * @desc    Get all active services
 * @query   lang - Language (en, ar, he) - default: en
 * @access  Public
 */
router.get('/', async (req, res) => {
  try {
    let { lang = 'en' } = req.query;

    // Normalize language code
    lang = lang.split('-')[0].toLowerCase();

    // Validate language
    if (!['en', 'ar', 'he'].includes(lang)) {
      return res.status(400).json({
        error: 'Invalid language. Must be: en, ar, or he'
      });
    }

    // ✅ FIX: Allow fetching inactive services if requested (e.g. by Admin)
    const query = {};
    if (req.query.includeInactive !== 'true') {
      query.active = true; // Default behavior (Public site): Active only
    }

    const services = await Service.find(query)
      .sort({ order: 1 })
      .populate('relatedProjects', 'translations.en.title translations.ar.title translations.he.title mainImage price type');
    // Format services with selected language
// Format services with selected language
    const formattedServices = services.map(service => ({
      id: service._id,
      title: service.translations[lang].title,
      description: service.translations[lang].description,
      icon: service.icon,
      order: service.order,
      // ✅ FIX: Include the active status in the response
      active: service.active, 
      projectCount: service.relatedProjects.length,
      relatedProjects: service.relatedProjects.map(project => ({
        id: project._id,
        title: project.translations[lang].title,
        mainImage: project.mainImage,
        price: project.price,
        type: project.type
      })),
      createdAt: service.createdAt
    }));

    res.json(formattedServices);

  } catch (error) {
    console.error('Error fetching services:', error);
    res.status(500).json({
      error: 'Failed to fetch services',
      message: error.message
    });
  }
});

/**
 * @route   GET /api/services/:id
 * @desc    Get single service by ID
 * @query   lang - Language (en, ar, he) - default: en
 * @query   includeAllTranslations - Return full translations (true/false)
 * @access  Public
 */
router.get('/:id', async (req, res) => {
  try {
    let { lang = 'en', includeAllTranslations } = req.query;

    // Normalize language code
    const normalizedLang = lang.split('-')[0].toLowerCase();

    // Validate language
    if (!['en', 'ar', 'he'].includes(normalizedLang)) {
      return res.status(400).json({
        error: 'Invalid language. Must be: en, ar, or he'
      });
    }

    const service = await Service.findById(req.params.id)
      .populate('relatedProjects');

    if (!service) {
      return res.status(404).json({ error: 'Service not found' });
    }

    // If includeAllTranslations is requested, return full translations object
    if (includeAllTranslations === 'true') {
      const response = {
        id: service._id,
        translations: service.translations,
        icon: service.icon,
        order: service.order,
        active: service.active,
        relatedProjects: service.relatedProjects || [],
        createdAt: service.createdAt,
        updatedAt: service.updatedAt
      };
      return res.json(response);
    }

    // Format response with selected language (for public viewing)
    const response = {
      id: service._id,
      title: service.translations[normalizedLang].title,
      description: service.translations[normalizedLang].description,
      icon: service.icon,
      order: service.order,
      active: service.active,
      relatedProjects: service.relatedProjects.map(project => ({
        id: project._id,
        title: project.translations[normalizedLang].title,
        location: project.translations[normalizedLang].location,
        mainImage: project.mainImage,
        price: project.price,
        type: project.type
      })),
      createdAt: service.createdAt,
      updatedAt: service.updatedAt
    };

    res.json(response);

  } catch (error) {
    console.error('Error fetching service:', error);

    // Handle invalid ObjectId
    if (error.kind === 'ObjectId') {
      return res.status(404).json({ error: 'Service not found' });
    }

    res.status(500).json({
      error: 'Failed to fetch service',
      message: error.message
    });
  }
});

/**
 * @route   POST /api/services
 * @desc    Create new service with file upload
 * @access  Private (Admin only)
 */
router.post('/', upload.single('iconFile'), async (req, res) => {
  let uploadedIconUrl = null;

  try {
    console.log('📥 Creating service...');
    console.log('   Has icon file:', !!req.file);
    console.log('   Icon URL:', req.body.icon);

    // Parse translations if sent as JSON string
    let translations = req.body.translations;
    if (typeof translations === 'string') {
      translations = JSON.parse(translations);
    }

    // Handle icon upload
    let iconUrl = req.body.icon || ''; // Use provided URL if exists

    if (req.file) {
      console.log('   Uploading icon file to Supabase...');

      const filePath = `services/${Date.now()}_${req.file.originalname}`;


      uploadedIconUrl = await uploadImageToSupabase(req.app.get('supabase'), req.file, filePath);

      iconUrl = uploadedIconUrl;

      console.log('   ✅ Icon uploaded:', iconUrl);
    }


    // Create service data
    const serviceData = {
      order: Number(req.body.order),
      icon: iconUrl || 'https://via.placeholder.com/64',
      translations,
      active: req.body.active === 'true' || req.body.active === true,
      relatedProjects: req.body.relatedProjects || []
    };

    // Validate required fields
    if (!serviceData.translations || !serviceData.order) {
      throw new Error('Missing required fields: translations, order');
    }

    // Create new service
    const newService = new Service(serviceData);
    await newService.save();

    console.log(`✅ Service created: ${serviceData.translations.en.title}`);

    res.status(201).json({
      success: true,
      service: newService,
      message: 'Service created successfully'
    });

  } catch (error) {
    console.error('❌ Error creating service:', error);

    // Rollback: Delete uploaded icon if service creation failed
    if (uploadedIconUrl) {
      console.log('🔄 Rolling back icon upload...', uploadedIconUrl);
      await deleteImageFromSupabase(
        req.app.get('supabase'),
        uploadedIconUrl,
        'POST /api/services rollback'
      );
    }


    // Handle validation errors
    if (error.name === 'ValidationError') {
      return res.status(400).json({
        error: 'Validation failed',
        details: error.errors
      });
    }

    res.status(500).json({
      error: 'Failed to create service',
      message: error.message
    });
  }
});

/**
 * @route   PUT /api/services/:id
 * @desc    Update service with optional file upload
 * @access  Private (Admin only)
 */
router.put('/:id', upload.single('iconFile'), async (req, res) => {
  let uploadedIconUrl = null;
  let oldIconUrl = null;

  try {
    console.log('📝 Updating service:', req.params.id);
    console.log('   Has new icon file:', !!req.file);

    const service = await Service.findById(req.params.id);
    if (!service) {
      return res.status(404).json({ error: 'Service not found' });
    }

    // Store old icon URL for potential deletion
    oldIconUrl = service.icon;

    // Parse translations if sent as JSON string
    let translations = req.body.translations;
    if (typeof translations === 'string') {
      translations = JSON.parse(translations);
    }

    // Handle icon upload
    let iconUrl = req.body.icon || service.icon; // Keep existing if no new one
    if (req.file) {
      console.log('   Uploading new icon file...');

      const filePath = `services/${Date.now()}_${req.file.originalname}`;

      uploadedIconUrl = await uploadImageToSupabase(
        req.app.get('supabase'),
        req.file,
        filePath
      );

      iconUrl = uploadedIconUrl;
      console.log('   ✅ New icon uploaded:', iconUrl);
    }


    // Update service data
    const serviceData = {
      order: Number(req.body.order),
      icon: iconUrl,
      translations,
      active: req.body.active === 'true' || req.body.active === true,
      relatedProjects: req.body.relatedProjects || service.relatedProjects
    };


    // ✅ Decide final icon value that will be saved
    const finalIcon = iconUrl;

    // ✅ Delete old icon if actually changed
    if (oldIconUrl && finalIcon && oldIconUrl !== finalIcon) {

      console.log('🗑️ Deleting old icon:', {
        old: oldIconUrl,
        new: finalIcon
      });

      await deleteImageFromSupabase(
        req.app.get('supabase'),
        oldIconUrl,
        'PUT replace icon'
      );
    }


    const updatedService = await Service.findByIdAndUpdate(
      req.params.id,
      serviceData,
      {
        new: true,
        runValidators: true
      }
    );




    console.log(`✅ Service updated: ${updatedService.translations.en.title}`);

    res.json({
      success: true,
      service: updatedService,
      message: 'Service updated successfully'
    });

  } catch (error) {
    console.error('❌ Error updating service:', error);

    // Rollback: Delete new icon if update failed
    if (uploadedIconUrl) {
      console.log('🔄 Rolling back new icon upload...', uploadedIconUrl);
      await deleteImageFromSupabase(
        req.app.get('supabase'),
        uploadedIconUrl,
        'PUT /api/services/:id rollback'
      );
    }

    if (error.kind === 'ObjectId') {
      return res.status(404).json({ error: 'Service not found' });
    }

    if (error.name === 'ValidationError') {
      return res.status(400).json({
        error: 'Validation failed',
        details: error.errors
      });
    }

    res.status(500).json({
      error: 'Failed to update service',
      message: error.message
    });
  }
});

/**
 * @route   DELETE /api/services/:id
 * @desc    Delete service and its icon
 * @access  Private (Admin only)
 */
router.delete('/:id', async (req, res) => {
  try {
    const service = await Service.findById(req.params.id);

    if (!service) {
      return res.status(404).json({ error: 'Service not found' });
    }

    // Delete icon from Supabase
    if (service.icon) {
      console.log('🗑️  Deleting service icon...', service.icon);
      await deleteImageFromSupabase(
        req.app.get('supabase'),
        service.icon,
        'DELETE /api/services/:id'
      );


    }

    // Delete service from database
    await Service.findByIdAndDelete(req.params.id);

    console.log(`✅ Service deleted: ${service.translations.en.title}`);

    res.json({
      success: true,
      message: 'Service deleted successfully'
    });

  } catch (error) {
    console.error('Error deleting service:', error);

    if (error.kind === 'ObjectId') {
      return res.status(404).json({ error: 'Service not found' });
    }

    res.status(500).json({
      error: 'Failed to delete service',
      message: error.message
    });
  }
});

module.exports = router;