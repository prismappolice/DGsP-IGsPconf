require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const fileRoutes = require('./routes/fileRoutes');
const path = require('path');
const adminRoutes = require('./routes/adminRoutes');
const multer = require('multer');
const FileMeta = require('./models/FileMeta');
const upload = multer({ dest: 'uploads/' });

const app = express();
app.use(cors());
app.use(express.json());

const recRoutes = require('./routes/recs');
const authRoutes = require('./routes/auth');
const userManagementRoutes = require('./routes/userManagement');
app.use('/api/recs', recRoutes);
app.use('/api/auth', authRoutes);
app.use('/api/users', userManagementRoutes);
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

mongoose.connect('mongodb://localhost:27017/recommendation_system');
app.use('/api', fileRoutes);
app.use('/api/admin', adminRoutes);

app.post('/upload', upload.single('file'), async (req, res) => {
  try {
    const newFile = new FileMeta({
      originalname: req.file.originalname,
      path: req.file.path,
      mimetype: req.file.mimetype,
      size: req.file.size
    });
    await newFile.save();
    res.send("File uploaded and saved to DB");
  } catch (err) {
    res.status(500).send(err.message);
  }
});

app.listen(5000, () => console.log('Server running on port 5000'));