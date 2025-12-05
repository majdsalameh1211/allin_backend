// backend/services/supabaseService.js
const connectSupabase = require('../config/supabase');
const supabase = connectSupabase(); // Initialize the client
const sharp = require('sharp');
const fetch = (...args) => import('node-fetch').then(({ default: fetch }) => fetch(...args));

class SupabaseService {
constructor() {
    // 1. Get bucket from env
    const envBucket = process.env.SUPABASE_BUCKET;

    // 2. Validate & Sanitize:
    // - If it exists, trim spaces (common .env error)
    // - If it's missing or empty, default to 'media'
    this.bucket = (envBucket && envBucket.trim() !== '') 
      ? envBucket.trim() 
      : 'media';

    console.log(`🔧 Supabase Service initialized. Using bucket: "${this.bucket}"`);
  }

  // ==========================================
  // 🛠️ HELPER FUNCTIONS (Internal Logic)
  // ==========================================

  /**
   * Smart Compression: Reduces size if > 100KB
   */
  async _compressImage(imageBuffer) {
    try {
      const originalKB = imageBuffer.length / 1024;

      // If small enough, return original
      if (originalKB < 100) return imageBuffer;

      // Otherwise compress
      return await sharp(imageBuffer)
        .resize({ width: 1200, withoutEnlargement: true })
        .jpeg({ quality: 70, mozjpeg: true })
        .toBuffer();
    } catch (error) {
      console.warn('Compression failed, using original:', error.message);
      return imageBuffer;
    }
  }

  // ==========================================
  // 🚀 MAIN PUBLIC FUNCTIONS
  // ==========================================

  /**
   * 1. Upload File (Standard Upload)
   * Compresses and uploads a file buffer to Supabase.
   * @param {Buffer} fileBuffer - The file data
   * @param {string} fileName - Full path (e.g. 'projects/img1.jpg')
   * @param {string} mimeType - e.g. 'image/jpeg'
   */
  async uploadFile(fileBuffer, fileName, mimeType, retries = 3) {
    for (let attempt = 1; attempt <= retries; attempt++) {
      try {
        console.log(`📤 Upload attempt ${attempt}/${retries}...`);

        const processedBuffer = await this._compressImage(fileBuffer);

        const { error } = await supabase.storage
          .from(this.bucket)
          .upload(fileName, processedBuffer, {
            contentType: mimeType,
            upsert: true
          });

        if (error) throw error;

        const { data: urlData } = supabase.storage
          .from(this.bucket)
          .getPublicUrl(fileName);

        console.log(`✅ Upload successful on attempt ${attempt}`);
        return urlData.publicUrl;

      } catch (error) {
        console.error(`❌ Upload attempt ${attempt} failed:`, error.message);

        if (attempt === retries) {
          console.error('❌ All retry attempts failed');
          throw error;
        }

        // Wait before retry (exponential backoff)
        const waitTime = Math.pow(2, attempt) * 1000; // 2s, 4s, 8s
        console.log(`⏳ Waiting ${waitTime / 1000}s before retry...`);
        await new Promise(resolve => setTimeout(resolve, waitTime));
      }
    }
  }

  /**
   * 2. Delete Single File
   */
  async deleteFile(fileUrl) {
    try {
      if (!fileUrl) return;
      const path = fileUrl.split(`${this.bucket}/`).pop(); // Extract path

      const { error } = await supabase.storage
        .from(this.bucket)
        .remove([path]);

      if (error) console.error('⚠️ Delete warning:', error.message);
    } catch (error) {
      console.error('❌ Delete failed:', error.message);
    }
  }

  /**
   * 3. Batch Delete Files
   * Takes an array of public URLs and deletes them all at once.
   */
  async deleteFiles(urls) {
    if (!urls || urls.length === 0) return;

    try {
      // Extract clean paths from full URLs
      const paths = urls
        .map(url => {
          const parts = url.split(`${this.bucket}/`);
          return parts.length > 1 ? parts[1] : null;
        })
        .filter(path => path !== null);

      if (paths.length > 0) {
        const { error } = await supabase.storage
          .from(this.bucket)
          .remove(paths);

        if (error) throw error;
        console.log(`🗑️ Deleted ${paths.length} images from Supabase`);
      }
    } catch (error) {
      console.error('❌ Batch delete failed:', error.message);
    }
  }
}

module.exports = new SupabaseService();