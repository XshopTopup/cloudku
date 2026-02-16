require('dotenv').config();
const express = require('express');
const { createClient } = require('@libsql/client');
const multer = require('multer');
const { v4: uuidv4 } = require('uuid');
const path = require('path');
const crypto = require('crypto');
const bodyParser = require('body-parser');
const { uploadToCloudKu } = require('./CloudKu');

const app = express();

app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static('public'));

app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, './views'));

let dbClient = null;
const getDB = () => {
    if (!dbClient) {
        dbClient = createClient({
            url: process.env.TURSO_DATABASE_URL,
            authToken: process.env.TURSO_AUTH_TOKEN,
        });
    }
    return dbClient;
};

// Konfigurasi multer untuk temporary upload
const upload = multer({ 
    dest: '/tmp/uploads/',
    limits: { fileSize: 200 * 1024 * 1024 } // 200MB max
});

const getFetch = async () => {
    const fetchModule = await import('node-fetch');
    return fetchModule.default;
};

function generateRandomString(length = 6) {
    const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
    let result = '';
    const randomBytes = crypto.randomBytes(length);
    for (let i = 0; i < length; i++) {
        result += chars[randomBytes[i] % chars.length];
    }
    return result;
}

const initDB = async () => {
    const db = getDB();
    try {
        await db.execute(`
            CREATE TABLE IF NOT EXISTS files (
                id TEXT PRIMARY KEY,
                filename TEXT UNIQUE NOT NULL,
                originalName TEXT NOT NULL,
                size INTEGER NOT NULL,
                mimetype TEXT,
                uploadDate DATETIME DEFAULT CURRENT_TIMESTAMP,
                cloudKuUrl TEXT NOT NULL,
                cloudKuFilename TEXT NOT NULL,
                publicUrl TEXT NOT NULL
            )
        `);
        console.log('✅ Database initialized successfully');
    } catch (err) {
        console.error('❌ DB Init Error:', err);
    }
};

let isInitialized = false;
app.use(async (req, res, next) => {
    if (!isInitialized) {
        await initDB();
        isInitialized = true;
    }
    next();
});

// ==========================================
// ROUTES
// ==========================================

// Route: Home Page
app.get('/', (req, res) => {
    res.render('index', { uploadedUrl: null, uploadedFile: null });
});

// Route: Documentation Page
app.get('/docs', (req, res) => {
    res.render('docs');
});

// Route: Serve File dengan URL Custom Domain
app.get('/f/:filename', async (req, res) => {
    const db = getDB();
    try {
        const result = await db.execute({
            sql: 'SELECT * FROM files WHERE filename = ?',
            args: [req.params.filename]
        });
        const file = result.rows[0];
        
        if (!file) {
            return res.status(404).send('File not found');
        }
        
        console.log(`📥 Fetching file: ${file.filename} from CloudKu CDN`);
        console.log(`   CloudKu URL: ${file.cloudKuUrl}`);
        
        // Fetch file dari CloudKu CDN
        const fetch = await getFetch();
        const response = await fetch(file.cloudKuUrl);
        
        if (!response.ok) {
            console.error(`❌ CloudKu CDN failed for ${file.filename}`);
            return res.status(502).send('Error fetching file from CloudKu CDN');
        }
        
        console.log(`✅ File served successfully: ${file.filename}`);
        
        // Set headers
        res.setHeader('Content-Type', file.mimetype || 'application/octet-stream');
        res.setHeader('Content-Disposition', `inline; filename="${file.originalName}"`);
        res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
        res.setHeader('Accept-Ranges', 'bytes');
        res.setHeader('X-Content-Source', 'cloudku-cdn');
        res.setHeader('X-Original-Filename', file.originalName);
        
        // Stream file ke response
        response.body.pipe(res);
        
    } catch (err) {
        console.error('❌ Error serving file:', err);
        res.status(500).send('Internal server error');
    }
});

// ==========================================
// FUNGSI UPLOAD
// ==========================================

async function processUpload(file, req) {
    const fs = require('fs');
    const db = getDB();
    const fileExt = path.extname(file.originalname);
    
    // Validasi ukuran file
    if (file.size > 200 * 1024 * 1024) {
        if (fs.existsSync(file.path)) fs.unlinkSync(file.path);
        throw new Error('Upload limit exceeded (200MB max)');
    }

    // Baca file sebagai buffer
    const buffer = fs.readFileSync(file.path);
    
    // Upload ke CloudKu CDN
    let cloudKuResult;
    try {
        console.log('📤 Uploading to CloudKu CDN...');
        console.log(`   File: ${file.originalname}`);
        console.log(`   Size: ${(file.size / 1024 / 1024).toFixed(2)} MB`);
        
        cloudKuResult = await uploadToCloudKu(buffer, {
            filename: file.originalname
        });
        
        if (cloudKuResult.status === 'error') {
            throw new Error(cloudKuResult.message);
        }
        
        console.log('✅ CloudKu CDN upload success!');
        console.log(`   CloudKu URL: ${cloudKuResult.url}`);
        console.log(`   CloudKu Filename: ${cloudKuResult.filename}`);
        
    } catch (err) {
        if (fs.existsSync(file.path)) fs.unlinkSync(file.path);
        throw new Error(`CloudKu CDN upload failed: ${err.message}`);
    }
    
    // Hapus file temporary
    if (fs.existsSync(file.path)) {
        fs.unlinkSync(file.path);
        console.log('🗑️  Temporary file deleted');
    }

    const fileId = uuidv4();
    let customFilename;
    let publicUrl;
    let success = false;
    let attempts = 0;
    const maxAttempts = 10;

    // Generate unique filename dan simpan ke database
    while (!success && attempts < maxAttempts) {
        customFilename = `${generateRandomString(6)}${fileExt}`;
        publicUrl = `${req.protocol}://${req.get('host')}/f/${customFilename}`;

        try {
            await db.execute({
                sql: `INSERT INTO files 
                      (id, filename, originalName, size, mimetype, cloudKuUrl, cloudKuFilename, publicUrl) 
                      VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
                args: [
                    fileId, 
                    customFilename,
                    file.originalname, 
                    file.size, 
                    file.mimetype, 
                    cloudKuResult.url,
                    cloudKuResult.filename,
                    publicUrl
                ]
            });
            
            success = true;
            console.log('✅ File saved to database successfully!');
            console.log(`   Custom Filename: ${customFilename}`);
            console.log(`   Public URL: ${publicUrl}`);
            console.log('');
            
        } catch (err) {
            if (err.message && (err.message.includes('UNIQUE') || err.message.includes('constraint'))) {
                attempts++;
                console.warn(`⚠️  Filename collision detected. Retry ${attempts}/${maxAttempts}...`);
                
                // Gunakan filename yang lebih panjang setelah 5 attempts
                if (attempts >= 5) {
                    customFilename = `${generateRandomString(8)}${fileExt}`;
                }
            } else {
                throw err;
            }
        }
    }

    if (!success) {
        throw new Error('Failed to generate unique filename after maximum attempts');
    }

    return { 
        url: publicUrl,
        filename: customFilename,
        originalName: file.originalname,
        cloudKuUrl: cloudKuResult.url,
        cloudKuFilename: cloudKuResult.filename,
        size: file.size,
        mimetype: file.mimetype
    };
}

function sendUploadResponse(req, res, result, uploadedFile) {
    const acceptsJson = req.headers.accept && req.headers.accept.includes('application/json');
    
    if (acceptsJson || req.path.includes('api.php')) {
        return res.status(200).json({
            status: 'success',
            url: result.url,
            filename: result.filename,
            originalName: uploadedFile,
            cloudKuUrl: result.cloudKuUrl,
            size: result.size,
            mimetype: result.mimetype
        });
    }
    
    res.render('index', { 
        uploadedUrl: result.url, 
        uploadedFile: uploadedFile
    });
}

// ==========================================
// UPLOAD ROUTES
// ==========================================

// Route: Upload Regular (Form Upload dengan HTML)
app.post('/upload', upload.single('file'), async (req, res) => {
    if (!req.file) {
        const acceptsJson = req.headers.accept && req.headers.accept.includes('application/json');
        if (acceptsJson) {
            return res.status(400).json({ status: 'error', message: 'No file provided' });
        }
        return res.status(400).send('No file provided');
    }
    
    try {
        const result = await processUpload(req.file, req);
        sendUploadResponse(req, res, result, req.file.originalname);
    } catch (err) {
        console.error('❌ Upload error:', err.message);
        const acceptsJson = req.headers.accept && req.headers.accept.includes('application/json');
        if (acceptsJson) {
            return res.status(500).json({ status: 'error', message: err.message });
        }
        res.status(500).send(`Error: ${err.message}`);
    }
});

// Route: API Upload (JSON Response)
app.post('/cdn/api.php', upload.single('file'), async (req, res) => {
    if (!req.file) {
        return res.status(400).json({ 
            status: 'error', 
            message: 'No file provided' 
        });
    }
    
    try {
        const result = await processUpload(req.file, req);
        res.status(200).json({
            status: 'success',
            url: result.url,
            filename: result.filename,
            originalName: req.file.originalname,
            cloudKuUrl: result.cloudKuUrl,
            cloudKuFilename: result.cloudKuFilename,
            size: result.size,
            mimetype: result.mimetype
        });
    } catch (err) {
        console.error('❌ API Upload error:', err.message);
        res.status(500).json({ 
            status: 'error', 
            message: err.message 
        });
    }
});

// ==========================================
// API ROUTES
// ==========================================

// Route: Get File Info
app.get('/api/file/:filename', async (req, res) => {
    const db = getDB();
    try {
        const result = await db.execute({
            sql: 'SELECT * FROM files WHERE filename = ?',
            args: [req.params.filename]
        });
        const file = result.rows[0];
        
        if (!file) {
            return res.status(404).json({ 
                status: 'error', 
                message: 'File not found' 
            });
        }
        
        res.json({
            status: 'success',
            data: {
                id: file.id,
                filename: file.filename,
                originalName: file.originalName,
                size: file.size,
                mimetype: file.mimetype,
                uploadDate: file.uploadDate,
                publicUrl: file.publicUrl,
                cloudKuUrl: file.cloudKuUrl,
                cloudKuFilename: file.cloudKuFilename
            }
        });
    } catch (err) {
        console.error('Error getting file info:', err);
        res.status(500).json({ 
            status: 'error', 
            message: 'Internal server error' 
        });
    }
});

// Route: List All Files
app.get('/api/files', async (req, res) => {
    const db = getDB();
    try {
        const limit = parseInt(req.query.limit) || 50;
        const offset = parseInt(req.query.offset) || 0;
        
        const result = await db.execute({
            sql: 'SELECT * FROM files ORDER BY uploadDate DESC LIMIT ? OFFSET ?',
            args: [limit, offset]
        });
        
        res.json({
            status: 'success',
            data: result.rows,
            count: result.rows.length,
            limit: limit,
            offset: offset
        });
    } catch (err) {
        console.error('Error listing files:', err);
        res.status(500).json({ 
            status: 'error', 
            message: 'Internal server error' 
        });
    }
});

// Route: Delete File
app.delete('/api/file/:filename', async (req, res) => {
    const db = getDB();
    try {
        const result = await db.execute({
            sql: 'DELETE FROM files WHERE filename = ?',
            args: [req.params.filename]
        });
        
        if (result.rowsAffected === 0) {
            return res.status(404).json({ 
                status: 'error', 
                message: 'File not found' 
            });
        }
        
        res.json({
            status: 'success',
            message: 'File deleted successfully'
        });
    } catch (err) {
        console.error('Error deleting file:', err);
        res.status(500).json({ 
            status: 'error', 
            message: 'Internal server error' 
        });
    }
});

// Route: Get Statistics
app.get('/api/stats', async (req, res) => {
    const db = getDB();
    try {
        const totalFiles = await db.execute('SELECT COUNT(*) as count FROM files');
        const totalSize = await db.execute('SELECT SUM(size) as total FROM files');
        
        res.json({
            status: 'success',
            data: {
                totalFiles: totalFiles.rows[0].count,
                totalSize: totalSize.rows[0].total || 0,
                totalSizeMB: ((totalSize.rows[0].total || 0) / 1024 / 1024).toFixed(2)
            }
        });
    } catch (err) {
        console.error('Error getting stats:', err);
        res.status(500).json({ 
            status: 'error', 
            message: 'Internal server error' 
        });
    }
});

// ==========================================
// ERROR HANDLER
// ==========================================

app.use((err, req, res, next) => {
    console.error('❌ Global error:', err);
    res.status(500).json({ 
        status: 'error', 
        message: err.message || 'Internal server error' 
    });
});

// ==========================================
// START SERVER
// ==========================================

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log('');
    console.log('═══════════════════════════════════════════════════════');
    console.log('🚀 CloudKu CDN Uploader Server Started!');
    console.log('═══════════════════════════════════════════════════════');
    console.log(`📍 Server: http://localhost:${PORT}`);
    console.log(`📤 Upload: http://localhost:${PORT}/upload`);
    console.log(`🔌 API: http://localhost:${PORT}/cdn/api.php`);
    console.log(`📖 Docs: http://localhost:${PORT}/docs`);
    console.log(`📊 Stats: http://localhost:${PORT}/api/stats`);
    console.log('═══════════════════════════════════════════════════════');
    console.log('');
});

module.exports = app;