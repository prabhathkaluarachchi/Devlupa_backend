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

// ---------------------- Analyze CV ---------------------- //
exports.analyzeCV = async (req, res) => {
  try {
    const file = req.file;
    const { requirement } = req.body;

    console.log("Received file:", file?.originalname);
    console.log("Job requirement:", requirement);

    if (!file || !requirement) {
      return res
        .status(400)
        .json({ message: "CV file and requirement are required." });
    }

    const cvText = await extractTextFromFile(file.path);

    const apiKey = process.env.GEMINI_API_KEY;
    const model = "gemini-2.0-flash";
    const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`;

    const prompt = `Strictly analyze the following CV against the job requirement. Provide a percentage match score (0-100) and nothing else. The score should be just the number.\n\nJob Requirement:\n${requirement}\n\nCV:\n${cvText}\n\nMatch Score:`;

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
      const errorData = await response.json();
      console.error("Gemini API Error:", errorData);
      throw new Error(`API call failed with status: ${response.status}`);
    }

    const data = await response.json();
    console.log("Gemini API response:", JSON.stringify(data, null, 2));

    const scoreText = data.candidates[0]?.content?.parts[0]?.text;
    const matchScore = parseInt(scoreText.trim(), 10) || 0;

    res.json({ matchScore });
  } catch (err) {
    console.error("CV Analysis Error:", err);
    res.status(500).json({ message: "Failed to analyze CV" });
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
