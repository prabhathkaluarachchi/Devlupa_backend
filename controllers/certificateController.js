const sgMail = require('@sendgrid/mail');

// Set your SendGrid API key
sgMail.setApiKey(process.env.SENDGRID_API_KEY);

// Helper function to format dates
const formatDate = (dateString) => {
  if (!dateString) return 'N/A';
  
  try {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  } catch (error) {
    return dateString;
  }
};

// Generate certificate HTML
const generateCertificateHTML = (certificateData) => {
  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Internship Certificate - ${certificateData.studentName}</title>
      <style>
        body {
          font-family: 'Times New Roman', serif;
          margin: 0;
          padding: 40px;
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          min-height: 100vh;
          display: flex;
          align-items: center;
          justify-content: center;
        }
        .certificate {
          background: white;
          padding: 60px 40px;
          border: 20px solid #f4d03f;
          border-radius: 10px;
          box-shadow: 0 20px 40px rgba(0,0,0,0.1);
          text-align: center;
          max-width: 800px;
          position: relative;
        }
        .header {
          margin-bottom: 40px;
        }
        .title {
          font-size: 48px;
          font-weight: bold;
          color: #2c3e50;
          margin-bottom: 10px;
          text-transform: uppercase;
        }
        .subtitle {
          font-size: 24px;
          color: #7f8c8d;
          margin-bottom: 40px;
          font-style: italic;
        }
        .content {
          margin: 40px 0;
        }
        .student-name {
          font-size: 36px;
          font-weight: bold;
          color: #e74c3c;
          margin: 20px 0;
          padding: 10px;
          border-bottom: 2px solid #bdc3c7;
          text-transform: uppercase;
        }
        .description {
          font-size: 20px;
          line-height: 1.6;
          margin: 30px 0;
          color: #2c3e50;
        }
        .signatures {
          display: flex;
          justify-content: space-around;
          margin-top: 60px;
          border-top: 2px solid #bdc3c7;
          padding-top: 30px;
        }
        .signature {
          text-align: center;
        }
        .signature-line {
          width: 200px;
          border-top: 1px solid #2c3e50;
          margin: 20px 0 10px 0;
        }
        .date {
          margin-top: 30px;
          font-size: 18px;
          color: #7f8c8d;
        }
        .company-seal {
          position: absolute;
          top: 20px;
          right: 20px;
          width: 100px;
          height: 100px;
          border: 2px solid #2c3e50;
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 12px;
          font-weight: bold;
          color: #2c3e50;
        }
      </style>
    </head>
    <body>
      <div class="certificate">
        <div class="company-seal">
          SEAL<br>${certificateData.companyName}
        </div>
        
        <div class="header">
          <div class="title">Certificate of Completion</div>
          <div class="subtitle">This is to certify that</div>
        </div>
        
        <div class="content">
          <div class="student-name">${certificateData.studentName}</div>
          
          <div class="description">
            has successfully completed the <strong>${certificateData.internshipField}</strong> 
            internship program at <strong>${certificateData.companyName}</strong> 
            from <strong>${formatDate(certificateData.startDate)}</strong> to <strong>${formatDate(certificateData.endDate)}</strong>.
          </div>
          
          <div class="description">
            ${certificateData.companyDetails || 'During this period, the intern demonstrated exceptional skills, dedication, and professional growth.'}
          </div>
        </div>
        
        <div class="signatures">
          <div class="signature">
            <div class="signature-line"></div>
            <div><strong>${certificateData.supervisorName || 'Company Representative'}</strong></div>
            <div>${certificateData.supervisorTitle || 'Senior Supervisor'}</div>
            <div>${certificateData.companyName}</div>
          </div>
        </div>
        
        <div class="date">
          Date of Issue: ${formatDate(certificateData.completionDate)}
        </div>
      </div>
    </body>
    </html>
  `;
};

// Generate email HTML template
const generateEmailHTML = (certificateData, certificateHtml) => {
  return `
    <div style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
      <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 30px; text-align: center; color: white;">
        <h1 style="margin: 0; font-size: 28px;">🎉 Congratulations ${certificateData.studentName}!</h1>
        <p style="margin: 10px 0 0 0; font-size: 16px; opacity: 0.9;">Your Internship Completion Certificate is Ready</p>
      </div>
      
      <div style="padding: 30px;">
        <p>Dear <strong>${certificateData.studentName}</strong>,</p>
        
        <p>We are pleased to inform you that your internship completion certificate has been generated and is ready for download.</p>
        
        <div style="background: #f8f9fa; padding: 20px; border-radius: 8px; margin: 20px 0;">
          <h3 style="color: #2c3e50; margin-top: 0;">Internship Details:</h3>
          <table style="width: 100%;">
            <tr>
              <td style="padding: 8px 0; width: 40%;"><strong>Internship Field:</strong></td>
              <td style="padding: 8px 0;">${certificateData.internshipField}</td>
            </tr>
            <tr>
              <td style="padding: 8px 0;"><strong>Company:</strong></td>
              <td style="padding: 8px 0;">${certificateData.companyName}</td>
            </tr>
            <tr>
              <td style="padding: 8px 0;"><strong>Duration:</strong></td>
              <td style="padding: 8px 0;">${formatDate(certificateData.startDate)} to ${formatDate(certificateData.endDate)}</td>
            </tr>
            <tr>
              <td style="padding: 8px 0;"><strong>Completion Date:</strong></td>
              <td style="padding: 8px 0;">${formatDate(certificateData.completionDate)}</td>
            </tr>
          </table>
        </div>
        
        <p>Your certificate is attached to this email as an HTML file. You can:</p>
        <ul>
          <li>Download the HTML file and open it in any web browser</li>
          <li>Print it directly from the browser</li>
          <li>Save it as PDF using your browser's print to PDF feature</li>
        </ul>
        
        <div style="text-align: center; margin: 30px 0;">
          <a href="#" style="background: #4F46E5; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block;">
            Download Certificate
          </a>
          <p style="font-size: 12px; color: #666; margin-top: 8px;">
            (The certificate is also attached to this email)
          </p>
        </div>
        
        <p>If you have any questions or need further assistance, please don't hesitate to contact us.</p>
        
        <div style="margin-top: 40px; padding-top: 20px; border-top: 1px solid #e0e0e0;">
          <p>Best regards,<br>
          <strong>${certificateData.companyName} Team</strong><br>
          <span style="color: #666;">DevLupa Internship Program</span></p>
        </div>
      </div>
    </div>
  `;
};

// Send certificate email
const sendCertificateEmail = async (req, res) => {
  try {
    console.log('📨 Received certificate request:', {
      userEmail: req.body.userEmail,
      certificateData: req.body.certificateData
    });

    const { userEmail, certificateData } = req.body;

    if (!userEmail || !certificateData) {
      return res.status(400).json({ 
        success: false, 
        message: 'User email and certificate data are required' 
      });
    }

    // Validate required fields
    const requiredFields = ['studentName', 'companyName', 'internshipField', 'startDate', 'endDate', 'completionDate'];
    const missingFields = requiredFields.filter(field => !certificateData[field]);
    
    if (missingFields.length > 0) {
      return res.status(400).json({
        success: false,
        message: `Missing required fields: ${missingFields.join(', ')}`
      });
    }

    // Create certificate HTML content for email
    const certificateHtml = generateCertificateHTML(certificateData);

    // Send email with SendGrid
    const msg = {
      to: userEmail,
      from: {
        email: process.env.FROM_EMAIL || 'fmprabhath@gmail.com',
        name: process.env.FROM_NAME || 'DevLupa Certificates'
      },
      subject: `Internship Completion Certificate - ${certificateData.studentName}`,
      html: generateEmailHTML(certificateData, certificateHtml),
      attachments: [
        {
          content: Buffer.from(certificateHtml).toString('base64'),
          filename: `Internship_Certificate_${certificateData.studentName.replace(/\s+/g, '_')}.html`,
          type: 'text/html',
          disposition: 'attachment'
        }
      ]
    };

    await sgMail.send(msg);

    console.log(`✅ Certificate email sent to: ${userEmail}`);

    res.json({
      success: true,
      message: 'Certificate sent successfully'
    });

  } catch (error) {
    console.error('Error sending certificate email:', error);
    
    if (error.response) {
      console.error('SendGrid error details:', error.response.body);
    }
    
    res.status(500).json({
      success: false,
      message: 'Failed to send certificate email',
      error: process.env.NODE_ENV === 'production' ? 'Internal server error' : error.message
    });
  }
};

// Get certificate template (for preview)
const getCertificateTemplate = async (req, res) => {
  try {
    const { certificateData } = req.body;
    
    if (!certificateData) {
      return res.status(400).json({
        success: false,
        message: 'Certificate data is required'
      });
    }

    const certificateHtml = generateCertificateHTML(certificateData);
    
    res.json({
      success: true,
      certificateHtml
    });
    
  } catch (error) {
    console.error('Error generating certificate template:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to generate certificate template',
      error: error.message
    });
  }
};

module.exports = {
  sendCertificateEmail,
  getCertificateTemplate
};