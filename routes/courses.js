const express = require('express');
const router = express.Router();
const Course = require('../models/Course');
const supabaseService = require('../services/supabaseService');
const { protect, authorize } = require('../middleware/auth');
const multer = require('multer');
const crypto = require('crypto');

// ==========================================
// 🛡️ HELPER FUNCTIONS
// ==========================================

/**
 * Generate unique filename
 */
const generateUniqueFilename = (originalName) => {
  const timestamp = Date.now();
  const randomHash = crypto.randomBytes(8).toString('hex');
  const cleanName = originalName.replace(/\s/g, '_');
  return `courses/${timestamp}_${randomHash}_${cleanName}`;
};

// ==========================================
// 🔧 MULTER CONFIGURATION
// ==========================================
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 10 * 1024 * 1024 // 10MB limit
  },
  fileFilter: (req, file, cb) => {
    if (!file.mimetype.startsWith('image/')) {
      return cb(new Error('Only image files are allowed!'), false);
    }
    cb(null, true);
  }
});

// Error handling wrapper for Multer
const handleMulterError = (err, req, res, next) => {
  if (err instanceof multer.MulterError) {
    if (err.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({ error: 'File too large. Max size is 10MB.' });
    }
    return res.status(400).json({ error: err.message });
  } else if (err) {
    return res.status(400).json({ error: err.message });
  }
  next();
};

// Helper: Sanitize/Parse FormData
const parseCourseData = (body) => {
  const data = { ...body };

  // Parse translations if sent as string
  if (data.translations && typeof data.translations === 'string') {
    try {
      data.translations = JSON.parse(data.translations);
    } catch (e) {
      console.error("Error parsing translations:", e);
    }
  }

  // Convert numbers
  if (data.price) data.price = Number(data.price);
  if (data.order) data.order = Number(data.order);

  // Convert booleans
  if (data.active === 'true') data.active = true;
  if (data.active === 'false') data.active = false;

  return data;
};

// ==================================================
// 1️⃣ GET ALL COURSES (Public)
// ==================================================
router.get('/', async (req, res) => {
  try {
    const { lang = 'en', limit } = req.query;

    // Only admins can see inactive courses if they query for them? 
    // Currently keeping it simple: Public gets active only.
    // You can add admin logic here if needed.
    // ✅ FIX: Allow fetching inactive courses if requested (e.g. by Admin)
    const filter = {};

    // Only hide inactive courses if we didn't specifically ask for them
    if (req.query.includeInactive !== 'true') {
      filter.active = true;
    }

    let query = Course.find(filter).sort({ order: 1 });

    if (limit) {
      query = query.limit(parseInt(limit));
    }

    const courses = await query;

    // Format for frontend
    const formattedCourses = courses.map(course => ({
      id: course._id,
      title: course.translations[lang]?.title || course.translations['en'].title,
      description: course.translations[lang]?.description || course.translations['en'].description,
      level: course.translations[lang]?.level || course.translations['en'].level,
      price: course.price,
      currency: course.currency,
      duration: course.duration,
      instructor: course.instructor,
      image: course.image,
      order: course.order,
      active: course.active
    }));

    res.json(formattedCourses);
  } catch (error) {
    console.error('Error fetching courses:', error);
    res.status(500).json({ error: 'Failed to fetch courses' });
  }
});

// ==================================================
// 2️⃣ GET SINGLE COURSE (Public)
// ==================================================
router.get('/:id', async (req, res) => {
  try {
    const { lang = 'en', includeAllTranslations } = req.query;
    const course = await Course.findById(req.params.id);

    if (!course) {
      return res.status(404).json({ error: 'Course not found' });
    }

    // Admin view: Return full object
    if (includeAllTranslations === 'true') {
      return res.json(course);
    }

    // Public view: Return localized object
    const formattedCourse = {
      id: course._id,
      title: course.translations[lang]?.title || course.translations['en'].title,
      description: course.translations[lang]?.description || course.translations['en'].description,
      level: course.translations[lang]?.level || course.translations['en'].level,
      price: course.price,
      currency: course.currency,
      duration: course.duration,
      instructor: course.instructor,
      image: course.image,
    };

    res.json(formattedCourse);
  } catch (error) {
    console.error('Error fetching course:', error);
    res.status(500).json({ error: 'Failed to fetch course' });
  }
});

// ==================================================
// 3️⃣ CREATE COURSE (Admin Only)
// ==================================================
router.post('/', protect, authorize('admin', 'superadmin'), upload.single('imageFile'), handleMulterError, async (req, res) => {
  try {
    console.log('🔵 BACKEND - POST /courses called');
    console.log('   - req.body:', req.body);
    console.log('   - req.file exists?', !!req.file);

    if (req.file) {
      console.log('   - req.file details:', {
        fieldname: req.file.fieldname,
        originalname: req.file.originalname,
        mimetype: req.file.mimetype,
        size: req.file.size
      });
    }

    const courseData = parseCourseData(req.body);
    console.log('   - Parsed courseData:', courseData);

    // 1. Handle Image Upload
    if (req.file) {
      console.log('✅ File detected, uploading to Supabase...');
      const fileName = generateUniqueFilename(req.file.originalname);
      console.log('   - Generated filename:', fileName);

      try {
        const url = await supabaseService.uploadFile(req.file.buffer, fileName, req.file.mimetype);
        console.log('✅ Supabase upload successful! URL:', url);
        courseData.image = url;
      } catch (uploadError) {
        console.error('❌ Supabase upload FAILED:', uploadError);
        throw uploadError;
      }
    } else if (!courseData.image) {
      console.log('⚠️ No file uploaded, using placeholder');
      courseData.image = "https://placehold.co/600x400/d4af37/ffffff?text=Course";
    }

    // 2. Save
    console.log('💾 Saving to MongoDB...');
    const newCourse = await Course.create(courseData);
    console.log('✅ Course saved successfully:', newCourse._id);
    res.status(201).json({ success: true, data: newCourse });

  } catch (error) {
    console.error('❌ Error creating course:', error);
    res.status(500).json({ error: error.message });
  }
});
// ==================================================
// 4️⃣ UPDATE COURSE (Admin Only)
// ==================================================
router.put('/:id', protect, authorize('admin', 'superadmin'), upload.single('imageFile'), handleMulterError, async (req, res) => {
  try {
    const course = await Course.findById(req.params.id);
    if (!course) return res.status(404).json({ error: 'Course not found' });

    const updates = parseCourseData(req.body);

    // 1. Handle Image Replacement
    if (req.file) {
      // Delete old image if it's hosted on Supabase
      if (course.image && course.image.includes('supabase')) {
        await supabaseService.deleteFile(course.image);
      }

      // Upload new image
      const fileName = generateUniqueFilename(req.file.originalname);
      updates.image = await supabaseService.uploadFile(req.file.buffer, fileName, req.file.mimetype);
    }

    // 2. Update
    const updatedCourse = await Course.findByIdAndUpdate(req.params.id, updates, { new: true });
    res.json({ success: true, data: updatedCourse });

  } catch (error) {
    console.error('Error updating course:', error);
    res.status(500).json({ error: error.message });
  }
});

// ==================================================
// 5️⃣ DELETE COURSE (Admin Only)
// ==================================================
router.delete('/:id', protect, authorize('admin', 'superadmin'), async (req, res) => {
  try {
    const course = await Course.findById(req.params.id);
    if (!course) return res.status(404).json({ error: 'Course not found' });

    // 1. Delete Image from Storage
    if (course.image && course.image.includes('supabase')) {
      await supabaseService.deleteFile(course.image);
    }

    // 2. Delete from Database
    await course.deleteOne();

    res.json({ success: true, message: 'Course deleted successfully' });

  } catch (error) {
    console.error('Error deleting course:', error);
    res.status(500).json({ error: 'Failed to delete course' });
  }
});

module.exports = router;