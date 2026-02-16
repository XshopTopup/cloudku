/**
 * CloudKu CDN Upload Module
 * Upload file ke CloudKu CDN API
 */

const FormData = require('form-data');
const axios = require('axios');
const fs = require('fs');

const API_URL = 'https://api.cloudku.sbs/cdn/api.php';
const MAX_FILE_SIZE = 200 * 1024 * 1024; // 200MB

/**
 * Upload file ke CloudKu CDN
 * @param {string|Buffer|Stream} file - Path file, Buffer, atau Stream
 * @param {Object} options - Options tambahan
 * @param {string} options.filename - Custom filename (opsional)
 * @returns {Promise<Object>} Response dari API
 */
async function uploadToCloudKu(file, options = {}) {
  try {
    const formData = new FormData();

    // Handle berbagai tipe input
    if (typeof file === 'string') {
      // File path
      if (!fs.existsSync(file)) {
        return {
          status: 'error',
          message: 'File not found: ' + file
        };
      }

      const stats = fs.statSync(file);
      if (stats.size > MAX_FILE_SIZE) {
        return {
          status: 'error',
          message: 'Upload limit exceeded (200MB max)'
        };
      }

      const fileStream = fs.createReadStream(file);
      const filename = options.filename || file.split('/').pop();
      formData.append('file', fileStream, filename);
    } else if (Buffer.isBuffer(file)) {
      // Buffer
      if (file.length > MAX_FILE_SIZE) {
        return {
          status: 'error',
          message: 'Upload limit exceeded (200MB max)'
        };
      }

      const filename = options.filename || 'file';
      formData.append('file', file, filename);
    } else if (file && typeof file.pipe === 'function') {
      // Stream
      const filename = options.filename || 'file';
      formData.append('file', file, filename);
    } else {
      return {
        status: 'error',
        message: 'Invalid file type. Expected: file path, Buffer, or Stream'
      };
    }

    // Upload ke API
    const response = await axios.post(API_URL, formData, {
      headers: {
        ...formData.getHeaders()
      },
      maxBodyLength: Infinity,
      maxContentLength: Infinity
    });

    // Return response dari API
    return response.data;
  } catch (error) {
    if (error.response && error.response.data) {
      return {
        status: 'error',
        message: error.response.data.message || 'Upload failed'
      };
    }
    return {
      status: 'error',
      message: error.message || 'Upload failed'
    };
  }
}

/**
 * Upload file dengan progress callback
 * @param {string|Buffer|Stream} file - Path file, Buffer, atau Stream
 * @param {Function} onProgress - Callback untuk progress (0-100)
 * @param {Object} options - Options tambahan
 * @returns {Promise<Object>} Response dari API
 */
async function uploadToCloudKuWithProgress(file, onProgress, options = {}) {
  try {
    const formData = new FormData();

    // Handle berbagai tipe input
    if (typeof file === 'string') {
      if (!fs.existsSync(file)) {
        return {
          status: 'error',
          message: 'File not found: ' + file
        };
      }

      const stats = fs.statSync(file);
      if (stats.size > MAX_FILE_SIZE) {
        return {
          status: 'error',
          message: 'Upload limit exceeded (200MB max)'
        };
      }

      const fileStream = fs.createReadStream(file);
      const filename = options.filename || file.split('/').pop();
      formData.append('file', fileStream, filename);
    } else if (Buffer.isBuffer(file)) {
      if (file.length > MAX_FILE_SIZE) {
        return {
          status: 'error',
          message: 'Upload limit exceeded (200MB max)'
        };
      }

      const filename = options.filename || 'file';
      formData.append('file', file, filename);
    } else if (file && typeof file.pipe === 'function') {
      const filename = options.filename || 'file';
      formData.append('file', file, filename);
    } else {
      return {
        status: 'error',
        message: 'Invalid file type'
      };
    }

    // Upload dengan progress tracking
    const response = await axios.post(API_URL, formData, {
      headers: {
        ...formData.getHeaders()
      },
      maxBodyLength: Infinity,
      maxContentLength: Infinity,
      onUploadProgress: (progressEvent) => {
        if (progressEvent.total) {
          const percentCompleted = Math.round(
            (progressEvent.loaded * 100) / progressEvent.total
          );
          if (onProgress && typeof onProgress === 'function') {
            onProgress(percentCompleted);
          }
        }
      }
    });

    return response.data;
  } catch (error) {
    if (error.response && error.response.data) {
      return {
        status: 'error',
        message: error.response.data.message || 'Upload failed'
      };
    }
    return {
      status: 'error',
      message: error.message || 'Upload failed'
    };
  }
}

/**
 * Upload multiple files
 * @param {Array<string|Buffer>} files - Array of file paths atau buffers
 * @param {Object} options - Options tambahan
 * @returns {Promise<Array<Object>>} Array of responses
 */
async function uploadMultipleFiles(files, options = {}) {
  const results = [];
  
  for (let i = 0; i < files.length; i++) {
    const file = files[i];
    try {
      console.log(`Uploading file ${i + 1}/${files.length}...`);
      const result = await uploadToCloudKu(file, options);
      results.push(result);
    } catch (error) {
      results.push({
        status: 'error',
        message: error.message || 'Upload failed',
        file: typeof file === 'string' ? file : 'buffer'
      });
    }
  }
  
  return results;
}

/**
 * Upload multiple files dengan progress untuk setiap file
 * @param {Array<string|Buffer>} files - Array of file paths atau buffers
 * @param {Function} onFileProgress - Callback(fileIndex, progress, totalFiles)
 * @param {Object} options - Options tambahan
 * @returns {Promise<Array<Object>>} Array of responses
 */
async function uploadMultipleFilesWithProgress(files, onFileProgress, options = {}) {
  const results = [];
  const totalFiles = files.length;
  
  for (let i = 0; i < totalFiles; i++) {
    const file = files[i];
    try {
      console.log(`Uploading file ${i + 1}/${totalFiles}...`);
      
      const result = await uploadToCloudKuWithProgress(
        file,
        (progress) => {
          if (onFileProgress && typeof onFileProgress === 'function') {
            onFileProgress(i, progress, totalFiles);
          }
        },
        options
      );
      
      results.push(result);
    } catch (error) {
      results.push({
        status: 'error',
        message: error.message || 'Upload failed',
        file: typeof file === 'string' ? file : 'buffer'
      });
    }
  }
  
  return results;
}

// Export functions
module.exports = {
  uploadToCloudKu,
  uploadToCloudKuWithProgress,
  uploadMultipleFiles,
  uploadMultipleFilesWithProgress,
  API_URL,
  MAX_FILE_SIZE
};