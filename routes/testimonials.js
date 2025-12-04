// backend/routes/testimonials.js
const express = require('express');
const router = express.Router();
const Testimonial = require('../models/Testimonial');

/**
 * @route   GET /api/testimonials
 * @desc    Get all active testimonials
 * @query   lang - Language (en, ar, he) - default: en
 * @query   featured - Filter featured testimonials only
 * @access  Public
 */
router.get('/', async (req, res) => {
  try {
    let { lang = 'en', featured } = req.query;

    // ✅ Normalize language code
    lang = lang.split('-')[0].toLowerCase();

    // Validate language
    if (!['en', 'ar', 'he'].includes(lang)) {
      return res.status(400).json({
        error: 'Invalid language. Must be: en, ar, or he'
      });
    }

    // Build query
    let query = {};
    if (featured === 'true') {
      query.featured = true;
    }

    // Find testimonials, sorted by order
    const testimonials = await Testimonial.find(query).sort({ order: 1 });

    // Format testimonials with selected language
    const formattedTestimonials = testimonials.map(testimonial => ({
      id: testimonial._id,
      text: testimonial.translations[lang].text,
      author: testimonial.translations[lang].author,
      location: testimonial.translations[lang].location,
      rating: testimonial.rating,
      order: testimonial.order,
      active: testimonial.active,
      featured: testimonial.featured,
      createdAt: testimonial.createdAt
    }));

    res.json(formattedTestimonials);

  } catch (error) {
    console.error('Error fetching testimonials:', error);
    res.status(500).json({
      error: 'Failed to fetch testimonials',
      message: error.message
    });
  }
});

/**
 * @route   GET /api/testimonials/:id
 * @desc    Get single testimonial by ID
 * @query   lang - Language (en, ar, he) - default: en
 * @query   includeAllTranslations - Return full translations (true/false)
 * @access  Public
 */
router.get('/:id', async (req, res) => {
  try {
    let { lang = 'en', includeAllTranslations } = req.query;

    // ✅ Normalize language code
    const normalizedLang = lang.split('-')[0].toLowerCase();

    // Validate language
    if (!['en', 'ar', 'he'].includes(normalizedLang)) {
      return res.status(400).json({
        error: 'Invalid language. Must be: en, ar, or he'
      });
    }

    const testimonial = await Testimonial.findById(req.params.id);

    if (!testimonial) {
      return res.status(404).json({ error: 'Testimonial not found' });
    }

    // ✅ If includeAllTranslations is requested, return full translations object
    if (includeAllTranslations === 'true') {
      const response = {
        id: testimonial._id,
        translations: testimonial.translations,  // ← ALL 3 LANGUAGES
        rating: testimonial.rating,
        order: testimonial.order,
        active: testimonial.active,
        featured: testimonial.featured,
        createdAt: testimonial.createdAt,
        updatedAt: testimonial.updatedAt
      };
      return res.json(response);
    }

    // ✅ Format response with selected language (for public viewing)
    const response = {
      id: testimonial._id,
      text: testimonial.translations[normalizedLang].text,
      author: testimonial.translations[normalizedLang].author,
      location: testimonial.translations[normalizedLang].location,
      rating: testimonial.rating,
      order: testimonial.order,
      active: testimonial.active,
      featured: testimonial.featured,
      createdAt: testimonial.createdAt,
      updatedAt: testimonial.updatedAt
    };

    res.json(response);

  } catch (error) {
    console.error('Error fetching testimonial:', error);

    if (error.kind === 'ObjectId') {
      return res.status(404).json({ error: 'Testimonial not found' });
    }

    res.status(500).json({
      error: 'Failed to fetch testimonial',
      message: error.message
    });
  }
});

/**
 * @route   POST /api/testimonials
 * @desc    Create new testimonial
 * @access  Private (Admin only - add auth middleware later)
 */
router.post('/', async (req, res) => {
  try {
    const testimonialData = req.body;

    // Validate required fields
    if (!testimonialData.translations) {
      return res.status(400).json({
        error: 'Missing required field: translations'
      });
    }

    // Create new testimonial
    const newTestimonial = new Testimonial(testimonialData);
    await newTestimonial.save();

    console.log(`✅ Testimonial created: ${testimonialData.translations.en.author}`);

    res.status(201).json({
      success: true,
      testimonial: newTestimonial,
      message: 'Testimonial created successfully'
    });

  } catch (error) {
    console.error('Error creating testimonial:', error);

    if (error.name === 'ValidationError') {
      return res.status(400).json({
        error: 'Validation failed',
        details: error.errors
      });
    }

    res.status(500).json({
      error: 'Failed to create testimonial',
      message: error.message
    });
  }
});

/**
 * @route   PUT /api/testimonials/:id
 * @desc    Update testimonial
 * @access  Private (Admin only - add auth middleware later)
 */
router.put('/:id', async (req, res) => {
  try {
    const testimonialData = req.body;

    const testimonial = await Testimonial.findByIdAndUpdate(
      req.params.id,
      testimonialData,
      {
        new: true,
        runValidators: true
      }
    );

    if (!testimonial) {
      return res.status(404).json({ error: 'Testimonial not found' });
    }

    console.log(`✅ Testimonial updated: ${testimonial.translations.en.author}`);

    res.json({
      success: true,
      testimonial,
      message: 'Testimonial updated successfully'
    });

  } catch (error) {
    console.error('Error updating testimonial:', error);

    if (error.kind === 'ObjectId') {
      return res.status(404).json({ error: 'Testimonial not found' });
    }

    if (error.name === 'ValidationError') {
      return res.status(400).json({
        error: 'Validation failed',
        details: error.errors
      });
    }

    res.status(500).json({
      error: 'Failed to update testimonial',
      message: error.message
    });
  }
});

/**
 * @route   DELETE /api/testimonials/:id
 * @desc    Delete testimonial
 * @access  Private (Admin only - add auth middleware later)
 */
router.delete('/:id', async (req, res) => {
  try {
    const testimonial = await Testimonial.findByIdAndDelete(req.params.id);

    if (!testimonial) {
      return res.status(404).json({ error: 'Testimonial not found' });
    }

    console.log(`✅ Testimonial deleted: ${testimonial.translations.en.author}`);

    res.json({
      success: true,
      message: 'Testimonial deleted successfully'
    });

  } catch (error) {
    console.error('Error deleting testimonial:', error);

    if (error.kind === 'ObjectId') {
      return res.status(404).json({ error: 'Testimonial not found' });
    }

    res.status(500).json({
      error: 'Failed to delete testimonial',
      message: error.message
    });
  }
});

module.exports = router;