const express = require('express');
const router = express.Router();
const certificateController = require('../controllers/certificateController');

// POST /api/admin/send-certificate - Send certificate via email
router.post('/send-certificate', certificateController.sendCertificateEmail);

// POST /api/admin/certificate-template - Get certificate HTML template
router.post('/certificate-template', certificateController.getCertificateTemplate);

module.exports = router;