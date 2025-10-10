require("dotenv").config();
const fs = require("fs");
const path = require("path");
const nodemailer = require("nodemailer");
const fetch = global.fetch || require("node-fetch");
const pdfParse = require("pdf-parse");

// Ensure uploads folder exists
const uploadDir = path.join(__dirname, "../uploads");
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir);

if (!process.env.GEMINI_API_KEY) {
  console.error("ERROR: GEMINI_API_KEY is not found in your .env file!");
}

// ---------------------- Nodemailer Setup ---------------------- //
const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
});

// ---------------------- Helper: Extract text from CV ---------------------- //
const extractTextFromFile = async (filePath) => {
  const ext = path.extname(filePath).toLowerCase();

  if (ext === ".pdf") {
    const buffer = fs.readFileSync(filePath);
    const data = await pdfParse(buffer);
    return data.text || "";
  }

  if (ext === ".txt") {
    return fs.readFileSync(filePath, "utf-8");
  }

  if (ext === ".doc" || ext === ".docx") {
    const textract = require("textract");
    return new Promise((resolve, reject) => {
      textract.fromFileWithPath(filePath, (err, text) => {
        if (err) reject(err);
        else resolve(text || "");
      });
    });
  }

  throw new Error("Unsupported file type: " + ext);
};

// ---------------------- Helper: Extract email from text ---------------------- //
const extractEmailFromText = (text) => {
  const emailRegex = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;
  const emails = text.match(emailRegex);
  return emails ? emails[0] : null;
};

// ---------------------- Analyze Multiple CVs ---------------------- //
exports.analyzeCV = async (req, res) => {
  try {
    const files = req.files;
    const { requirement, threshold = 45 } = req.body; // Default threshold 45%

    console.log(
      "Received files:",
      files?.map((f) => f.originalname)
    );
    console.log("Job requirement:", requirement);
    console.log("Eligibility threshold:", threshold);

    if (!files || files.length === 0 || !requirement) {
      return res
        .status(400)
        .json({ message: "CV files and requirement are required." });
    }

    const analysisResults = [];

    for (const file of files) {
      try {
        const cvText = await extractTextFromFile(file.path);
        const extractedEmail = extractEmailFromText(cvText);

        const apiKey = process.env.GEMINI_API_KEY;
        const model = "gemini-2.0-flash";
        const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`;

        const prompt = `Analyze the following CV against the job requirement and provide:
1. A percentage match score (0-100)
2. List of matching requirements (skills/experiences that match)
3. List of missing requirements (skills/experiences that are missing)

Format your response exactly as:
SCORE: [number]%
MATCHING:
- [matching requirement 1]
- [matching requirement 2]
- ...
MISSING:
- [missing requirement 1]
- [missing requirement 2]
- ...

Job Requirement:
${requirement}

CV:
${cvText}

Analysis:`;

        const response = await fetch(apiUrl, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "X-goog-api-key": apiKey,
          },
          body: JSON.stringify({
            contents: [{ parts: [{ text: prompt }] }],
          }),
        });

        if (!response.ok) {
          throw new Error(`API call failed with status: ${response.status}`);
        }

        const data = await response.json();
        const analysisText = data.candidates[0]?.content?.parts[0]?.text || "";

        // Parse the response
        const scoreMatch = analysisText.match(/SCORE:\s*(\d+)%/);
        const matchScore = scoreMatch ? parseInt(scoreMatch[1], 10) : 0;

        const matchingSection = analysisText.match(
          /MATCHING:([\s\S]*?)MISSING:/
        );
        const missingSection = analysisText.match(/MISSING:([\s\S]*?)$/);

        const matchingRequirements = matchingSection
          ? matchingSection[1]
              .split("\n")
              .filter((line) => line.trim().startsWith("-"))
              .map((line) => line.trim().substring(1).trim())
              .filter((item) => item.length > 0)
          : [];

        const missingRequirements = missingSection
          ? missingSection[1]
              .split("\n")
              .filter((line) => line.trim().startsWith("-"))
              .map((line) => line.trim().substring(1).trim())
              .filter((item) => item.length > 0)
          : [];

        analysisResults.push({
          fileName: file.originalname,
          matchScore,
          matchingRequirements,
          missingRequirements,
          extractedEmail,
          eligible: matchScore >= threshold,
        });
      } catch (fileError) {
        console.error(`Error processing file ${file.originalname}:`, fileError);
        analysisResults.push({
          fileName: file.originalname,
          error: "Failed to analyze this CV",
          matchScore: 0,
          matchingRequirements: [],
          missingRequirements: [],
          extractedEmail: null,
          eligible: false,
        });
      }
    }

    // Sort results: eligible first (highest scores), then not eligible (highest to lowest)
    const sortedResults = analysisResults.sort((a, b) => {
      if (a.eligible && !b.eligible) return -1;
      if (!a.eligible && b.eligible) return 1;
      return b.matchScore - a.matchScore; // Higher scores first within each category
    });

    res.json({
      results: sortedResults,
      totalAnalyzed: analysisResults.length,
      eligibleCount: analysisResults.filter((r) => r.eligible).length,
      thresholdUsed: parseInt(threshold),
    });
  } catch (err) {
    console.error("CV Analysis Error:", err);
    res.status(500).json({ message: "Failed to analyze CVs" });
  }
};

// ---------------------- Send Registration Link ---------------------- //
exports.sendRegistrationLink = async (req, res) => {
  const { email } = req.body;

  if (!email) return res.status(400).json({ message: "Email is required" });

  try {
    const registrationLink = `http://localhost:5173/register?email=${encodeURIComponent(
      email
    )}`;

    await transporter.sendMail({
      from: `"DevLupa Support" <${process.env.EMAIL_USER}>`,
      to: email,
      subject: "DevLupa Internship Registration Link",
      html: `
    <div style="font-family: Arial, sans-serif; line-height: 1.5;">
      <h2 style="color: #2c3e50;">Hello 👋,</h2>
      <p>You have been found eligible for the internship!</p>
      <p>Click the link below to register:</p>
      <p>
        <a href="${registrationLink}" 
           style="background-color:#007bff;color:#fff;padding:10px 20px;text-decoration:none;border-radius:6px;display:inline-block;">
           Register Now
        </a>
      </p>
      <br/>
      <p>– DevLupa Team</p>
    </div>
  `,
    });

    res.json({ message: `Registration link sent to ${email}` });
  } catch (err) {
    console.error("Send Email Error:", err);
    res.status(500).json({ message: "Failed to send email" });
  }
};

// ---------------------- Send Bulk Registration Links ---------------------- //
exports.sendBulkRegistrationLinks = async (req, res) => {
  const { emails } = req.body;

  if (!emails || !Array.isArray(emails) || emails.length === 0) {
    return res.status(400).json({ message: "Email list is required" });
  }

  try {
    const sentEmails = [];
    const failedEmails = [];

    for (const email of emails) {
      try {
        const registrationLink = `http://localhost:5173/register?email=${encodeURIComponent(
          email
        )}`;

        await transporter.sendMail({
          from: `"DevLupa Support" <${process.env.EMAIL_USER}>`,
          to: email,
          subject: "DevLupa Internship Registration Link",
          html: `
            <div style="font-family: Arial, sans-serif; line-height: 1.5;">
              <h2 style="color: #2c3e50;">Hello 👋,</h2>
              <p>You have been found eligible for the internship!</p>
              <p>Click the link below to register:</p>
              <p>
                <a href="${registrationLink}" 
                   style="background-color:#007bff;color:#fff;padding:10px 20px;text-decoration:none;border-radius:6px;display:inline-block;">
                   Register Now
                </a>
              </p>
              <br/>
              <p>– DevLupa Team</p>
            </div>
          `,
        });

        sentEmails.push(email);
      } catch (emailError) {
        console.error(`Failed to send email to ${email}:`, emailError);
        failedEmails.push(email);
      }
    }

    res.json({
      message: `Sent ${sentEmails.length} registration links successfully`,
      sentEmails,
      failedEmails,
      totalSent: sentEmails.length,
      totalFailed: failedEmails.length,
    });
  } catch (err) {
    console.error("Bulk Email Send Error:", err);
    res.status(500).json({ message: "Failed to send bulk emails" });
  }
};
