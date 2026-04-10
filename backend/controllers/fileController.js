// Minimal fileController to fix missing module error
const path = require('path');
const fs = require('fs');

// Save file metadata after upload
exports.saveFileMeta = (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'No file uploaded' });
  }
  // You can extend this to save metadata to DB
  res.status(200).json({
    message: 'File uploaded successfully',
    filename: req.file.filename,
    originalname: req.file.originalname,
    size: req.file.size,
    path: req.file.path
  });
};

// List all files in uploads directory
exports.getAllFiles = (req, res) => {
  const uploadsDir = path.join(__dirname, '../uploads');
  fs.readdir(uploadsDir, (err, files) => {
    if (err) {
      return res.status(500).json({ error: 'Unable to list files' });
    }
    res.status(200).json({ files });
  });
};
