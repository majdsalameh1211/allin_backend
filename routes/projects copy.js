// backend/routes/projects.js
const express = require('express');
const router = express.Router();
const Project = require('../models/Project');


/**
 * @route   GET /api/projects
 * @desc    Get all projects with filtering
 * @query   lang - Language (en, ar, he) - default: en
 * @query   type - Filter by type (forSale, forRent, sold, all) - default: all
 * @query   featured - Filter featured projects (true/false)
 * @query   limit - Number of results - default: all
 * @query   page - Page number for pagination - default: 1
 * @access  Public
 */
/*
router.get('/', async (req, res) => {
  try {
    let { 
      lang = 'en', 
      type = 'all', 
      featured,
      limit,
      page = 1
    } = req.query;

    // ✅ Normalize language code (en-US -> en, ar-SA -> ar, he-IL -> he)
    lang = lang.split('-')[0].toLowerCase();

    // Validate language
    if (!['en', 'ar', 'he'].includes(lang)) {
      return res.status(400).json({ 
        error: 'Invalid language. Must be: en, ar, or he' 
      });
    }

    // Build query
    let query = { status: { $ne: 'deleted' } }; // Exclude deleted projects
    
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

    // Build query with pagination
    let projectsQuery = Project.find(query).sort({ createdAt: -1 });

    // Apply pagination if limit is provided
    if (limit) {
      const limitNum = parseInt(limit);
      const pageNum = parseInt(page);
      const skip = (pageNum - 1) * limitNum;
      
      projectsQuery = projectsQuery.limit(limitNum).skip(skip);
    }

    // Execute query
    const projects = await projectsQuery;

    // Get total count for pagination
    const totalCount = await Project.countDocuments(query);

    // Format projects with selected language
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
      imageCount: project.imageCount,
      createdAt: project.createdAt
    }));

    // Response with pagination info
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
*/
// backend/routes/projects.js - Update the GET / route

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
      images: project.images, // <--- ADDED THIS LINE
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
/**
 * @route   GET /api/projects/:id
 * @desc    Get single project by ID
 * @query   lang - Language (en, ar, he) - default: en
 * @access  Public
 */
/*
router.get('/:id', async (req, res) => {
  try {
    const { lang = 'en' } = req.query;

    // ✅ Normalize language code
    lang = lang.split('-')[0].toLowerCase();

    // Validate language
    if (!['en', 'ar', 'he'].includes(lang)) {
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

    // Format response with selected language
    const response = {
      id: project._id,
      title: project.translations[lang].title,
      location: project.translations[lang].location,
      shortDesc: project.translations[lang].shortDesc,
      fullDesc: project.translations[lang].fullDesc,
      features: project.translations[lang].features,
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
    
    // Handle invalid ObjectId
    if (error.kind === 'ObjectId') {
      return res.status(404).json({ error: 'Project not found' });
    }
    
    res.status(500).json({ 
      error: 'Failed to fetch project',
      message: error.message 
    });
  }
});
*/
// In projects.js, update the GET /:id route (around line 117)

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
        translations: project.translations,  // ← ALL 3 languages
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

    // Format response with selected language (existing code)
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
 * @route   POST /api/projects
 * @desc    Create new project
 * @access  Private (Admin only - add auth middleware later)
 */
router.post('/', async (req, res) => {
  try {
    const projectData = req.body;

    // Validate required fields - ONLY English is required
    if (!projectData.translations?.en?.title || !projectData.translations?.en?.location) {
      return res.status(400).json({ 
        error: 'Missing required fields',
        message: 'English title and location are required'
      });
    }

    // Fill missing translations with English content
    const translations = {
      en: projectData.translations.en,
      ar: projectData.translations.ar || {
        title: projectData.translations.en.title,
        location: projectData.translations.en.location,
        shortDesc: projectData.translations.en.shortDesc || '',
        fullDesc: projectData.translations.en.fullDesc || '',
        features: projectData.translations.en.features || []
      },
      he: projectData.translations.he || {
        title: projectData.translations.en.title,
        location: projectData.translations.en.location,
        shortDesc: projectData.translations.en.shortDesc || '',
        fullDesc: projectData.translations.en.fullDesc || '',
        features: projectData.translations.en.features || []
      }
    };

    const newProject = new Project({
      ...projectData,
      translations
    });

    await newProject.save();

    console.log(`✅ Project created: ${projectData.translations.en.title}`);

    res.status(201).json({
      success: true,
      project: newProject,
      message: 'Project created successfully'
    });

  } catch (error) {
    console.error('Error creating project:', error);
    
    if (error.name === 'ValidationError') {
      return res.status(400).json({ 
        error: 'Validation failed',
        message: error.message,
        details: error.errors
      });
    }
    
    res.status(500).json({ 
      error: 'Failed to create project',
      message: error.message 
    });
  }
});

/**
 * @route   PUT /api/projects/:id
 * @desc    Update project
 * @access  Private (Admin only - add auth middleware later)
 */
router.put('/:id', async (req, res) => {
  try {
    const projectData = req.body;

    const project = await Project.findByIdAndUpdate(
      req.params.id,
      projectData,
      { 
        new: true, // Return updated document
        runValidators: true // Run schema validators
      }
    );

    if (!project) {
      return res.status(404).json({ error: 'Project not found' });
    }

    console.log(`✅ Project updated: ${project.translations.en.title}`);

    res.json({
      success: true,
      project,
      message: 'Project updated successfully'
    });

  } catch (error) {
    console.error('Error updating project:', error);
    
    // Handle invalid ObjectId
    if (error.kind === 'ObjectId') {
      return res.status(404).json({ error: 'Project not found' });
    }
    
    // Handle validation errors
    if (error.name === 'ValidationError') {
      return res.status(400).json({ 
        error: 'Validation failed',
        details: error.errors
      });
    }
    
    res.status(500).json({ 
      error: 'Failed to update project',
      message: error.message 
    });
  }
});

/**
 * @route   DELETE /api/projects/:id
 * @desc    Delete project (soft delete - marks as deleted)
 * @access  Private (Admin only - add auth middleware later)
 */
router.delete('/:id', async (req, res) => {
  try {
    const { permanent } = req.query; // ?permanent=true for hard delete

    if (permanent === 'true') {
      // Hard delete - completely remove from database
      const project = await Project.findByIdAndDelete(req.params.id);

      if (!project) {
        return res.status(404).json({ error: 'Project not found' });
      }

      console.log(`🗑️  Project permanently deleted: ${project.translations.en.title}`);

      return res.json({
        success: true,
        message: 'Project permanently deleted'
      });
    } else {
      // Soft delete - mark as deleted
      const project = await Project.findByIdAndUpdate(
        req.params.id,
        { status: 'deleted' },
        { new: true }
      );

      if (!project) {
        return res.status(404).json({ error: 'Project not found' });
      }

      console.log(`✅ Project marked as deleted: ${project.translations.en.title}`);

      return res.json({
        success: true,
        message: 'Project marked as deleted'
      });
    }

  } catch (error) {
    console.error('Error deleting project:', error);
    
    // Handle invalid ObjectId
    if (error.kind === 'ObjectId') {
      return res.status(404).json({ error: 'Project not found' });
    }
    
    res.status(500).json({ 
      error: 'Failed to delete project',
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
    const { lang = 'en' } = req.query;

       // ✅ Normalize language code
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
