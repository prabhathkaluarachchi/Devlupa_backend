require("dotenv").config();
const mongoose = require("mongoose");
const nodemailer = require("nodemailer");
const fetch = global.fetch || require("node-fetch");
const pdfParse = require("pdf-parse");
const PDFDocument = require("pdfkit");

// Import models
const CVFile = require("../models/CVFile");
const CVScreening = require("../models/CVScreening");

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

// ---------------------- Helper: Extract text from Buffer ---------------------- //
const extractTextFromBuffer = async (buffer, fileType) => {
  if (fileType === "application/pdf") {
    const data = await pdfParse(buffer);
    return data.text || "";
  }

  if (fileType === "text/plain") {
    return buffer.toString("utf-8");
  }

  if (
    fileType === "application/msword" ||
    fileType ===
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
  ) {
    const textract = require("textract");
    // For DOC/DOCX, we need to save to temp file first
    const fs = require("fs");
    const path = require("path");
    const tempDir = require("os").tmpdir();
    const tempFilePath = path.join(
      tempDir,
      `temp-cv-${Date.now()}${fileType.includes("openxml") ? ".docx" : ".doc"}`
    );

    return new Promise((resolve, reject) => {
      fs.writeFile(tempFilePath, buffer, (err) => {
        if (err) reject(err);

        textract.fromFileWithPath(tempFilePath, (err, text) => {
          // Clean up temp file
          fs.unlink(tempFilePath, () => {});
          if (err) reject(err);
          else resolve(text || "");
        });
      });
    });
  }

  throw new Error("Unsupported file type: " + fileType);
};

// ---------------------- Helper: Extract email from text ---------------------- //
const extractEmailFromText = (text) => {
  const emailRegex = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;
  const emails = text.match(emailRegex);
  return emails ? emails[0] : null;
};

// ---------------------- Analyze Multiple CVs (UPDATED FOR DATABASE) ---------------------- //
exports.analyzeCV = async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const files = req.files;
    const { requirement, threshold = 45 } = req.body;
    const userId = req.user.id;

    if (!files || files.length === 0 || !requirement) {
      return res
        .status(400)
        .json({ message: "CV files and requirement are required." });
    }

    // Generate screeningId manually since pre-save middleware doesn't work with transactions
    const screeningId = `SCR-${Date.now()}-${Math.random()
      .toString(36)
      .substr(2, 9)}`;

    // Create screening record with manually generated screeningId
    const screening = new CVScreening({
      screeningId: screeningId, // Add this manually
      jobRequirement: requirement,
      threshold: parseInt(threshold),
      createdBy: userId,
      totalAnalyzed: files.length,
      eligibleCount: 0,
      results: [],
    });

    const analysisResults = [];
    const savedCVFiles = [];

    // Process each file
    for (const file of files) {
      try {
        // Save CV file to database
        const cvFile = new CVFile({
          fileName: `${Date.now()}-${file.originalname}`,
          originalName: file.originalname,
          fileData: file.buffer,
          fileType: file.mimetype,
          fileSize: file.size,
          uploadedBy: userId,
        });

        const savedFile = await cvFile.save({ session });
        savedCVFiles.push(savedFile._id);

        // Extract text from buffer
        const cvText = await extractTextFromBuffer(file.buffer, file.mimetype);
        const extractedEmail = extractEmailFromText(cvText);

        // Analyze with Gemini AI
        const apiKey = process.env.GEMINI_API_KEY;
        const model = "gemini-2.5-flash-lite";
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

        const eligible = matchScore >= threshold;

        // Add to screening results
        screening.results.push({
          cvFile: savedFile._id,
          fileName: file.originalname,
          matchScore,
          matchingRequirements,
          missingRequirements,
          extractedEmail,
          eligible,
          emailSent: false,
        });

        analysisResults.push({
          fileName: file.originalname,
          matchScore,
          matchingRequirements,
          missingRequirements,
          extractedEmail,
          eligible,
          cvFileId: savedFile._id,
        });
      } catch (fileError) {
        console.error(`Error processing file ${file.originalname}:`, fileError);

        screening.results.push({
          fileName: file.originalname,
          error: "Failed to analyze this CV",
          matchScore: 0,
          matchingRequirements: [],
          missingRequirements: [],
          extractedEmail: null,
          eligible: false,
        });

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

    // Update screening counts
    screening.eligibleCount = analysisResults.filter(
      (r) => r.eligible && !r.error
    ).length;
    screening.cvFiles = savedCVFiles;

    // Save screening record
    await screening.save({ session });
    await session.commitTransaction();

    // Sort results for response
    const sortedResults = analysisResults.sort((a, b) => {
      if (a.eligible && !b.eligible) return -1;
      if (!a.eligible && b.eligible) return 1;
      return b.matchScore - a.matchScore;
    });

    res.json({
      screeningId: screening.screeningId,
      results: sortedResults,
      totalAnalyzed: analysisResults.length,
      eligibleCount: screening.eligibleCount,
      thresholdUsed: parseInt(threshold),
    });
  } catch (err) {
    await session.abortTransaction();
    console.error("CV Analysis Error:", err);
    res.status(500).json({ message: "Failed to analyze CVs" });
  } finally {
    session.endSession();
  }
};

// ---------------------- Get CV Screening History ---------------------- //
exports.getScreeningHistory = async (req, res) => {
  try {
    const screenHistory = await CVScreening.find({ createdBy: req.user.id })
      .sort({ createdAt: -1 })
      .select(
        "screeningId jobRequirement threshold totalAnalyzed eligibleCount invitationsSent createdAt"
      )
      .lean();

    res.json(screenHistory);
  } catch (err) {
    console.error("Get Screening History Error:", err);
    res.status(500).json({ message: "Failed to fetch screening history" });
  }
};

// ---------------------- Get Screening Details ---------------------- //
exports.getScreeningDetails = async (req, res) => {
  try {
    const { screeningId } = req.params;

    const screening = await CVScreening.findOne({
      screeningId,
      createdBy: req.user.id,
    })
      .populate("results.cvFile", "originalName fileType fileSize")
      .lean();

    if (!screening) {
      return res.status(404).json({ message: "Screening not found" });
    }

    res.json(screening);
  } catch (err) {
    console.error("Get Screening Details Error:", err);
    res.status(500).json({ message: "Failed to fetch screening details" });
  }
};

// ---------------------- Download CV File ---------------------- //
exports.downloadCV = async (req, res) => {
  try {
    const { fileId } = req.params;

    const cvFile = await CVFile.findById(fileId);

    if (!cvFile) {
      return res.status(404).json({ message: "CV file not found" });
    }

    // Check if user has permission to access this file
    const screening = await CVScreening.findOne({
      "results.cvFile": fileId,
      createdBy: req.user.id,
    });

    if (!screening && cvFile.uploadedBy.toString() !== req.user.id) {
      return res.status(403).json({ message: "Access denied" });
    }

    // Set appropriate headers
    res.setHeader("Content-Type", cvFile.fileType);
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="${cvFile.originalName}"`
    );
    res.setHeader("Content-Length", cvFile.fileData.length);

    // Send file buffer
    res.send(cvFile.fileData);
  } catch (err) {
    console.error("Download CV Error:", err);
    res.status(500).json({ message: "Failed to download CV" });
  }
};

// ---------------------- Send Registration Link (UPDATED) ---------------------- //
exports.sendRegistrationLink = async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const { email, screeningId, fileName } = req.body;
    const userId = req.user.id;

    if (!email) return res.status(400).json({ message: "Email is required" });

    // Update screening record if screeningId provided
    if (screeningId && fileName) {
      await CVScreening.updateOne(
        {
          screeningId,
          createdBy: userId,
          "results.fileName": fileName,
        },
        {
          $set: {
            "results.$.emailSent": true,
            "results.$.emailSentTo": email,
            "results.$.emailSentAt": new Date(),
          },
          $inc: { invitationsSent: 1 },
        },
        { session }
      );
    }

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

    await session.commitTransaction();

    res.json({
      message: `Registration link sent to ${email}`,
      screeningUpdated: !!screeningId,
    });
  } catch (err) {
    await session.abortTransaction();
    console.error("Send Email Error:", err);
    res.status(500).json({ message: "Failed to send email" });
  } finally {
    session.endSession();
  }
};

// ---------------------- Send Bulk Registration Links (UPDATED) ---------------------- //
exports.sendBulkRegistrationLinks = async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const { emails, screeningId } = req.body;
    const userId = req.user.id;

    if (!emails || !Array.isArray(emails) || emails.length === 0) {
      return res.status(400).json({ message: "Email list is required" });
    }

    const sentEmails = [];
    const failedEmails = [];

    for (const emailData of emails) {
      try {
        const { email, fileName } = emailData;

        // Skip empty or invalid emails
        if (!email || !email.trim() || !isValidEmail(email)) {
          failedEmails.push({
            email,
            fileName,
            reason: "Invalid email address",
          });
          continue;
        }

        // Update screening record if screeningId provided
        if (screeningId && fileName) {
          await CVScreening.updateOne(
            {
              screeningId,
              createdBy: userId,
              "results.fileName": fileName,
            },
            {
              $set: {
                "results.$.emailSent": true,
                "results.$.emailSentTo": email,
                "results.$.emailSentAt": new Date(),
              },
              $inc: { invitationsSent: 1 },
            },
            { session }
          );
        }

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

        sentEmails.push({ email, fileName });
      } catch (emailError) {
        console.error(
          `Failed to send email to ${emailData.email}:`,
          emailError
        );
        failedEmails.push({
          email: emailData.email,
          fileName: emailData.fileName,
          reason: "Email delivery failed",
        });
      }
    }

    await session.commitTransaction();

    res.json({
      message: `Sent ${sentEmails.length} registration links successfully`,
      sentEmails,
      failedEmails,
      totalSent: sentEmails.length,
      totalFailed: failedEmails.length,
    });
  } catch (err) {
    await session.abortTransaction();
    console.error("Bulk Email Send Error:", err);
    res.status(500).json({ message: "Failed to send bulk emails" });
  } finally {
    session.endSession();
  }
};

// ---------------------- Generate PDF Report ---------------------- //
exports.generateReport = async (req, res) => {
  try {
    const { results, threshold, requirement, emailInputs } = req.body;

    if (!results || !Array.isArray(results)) {
      return res.status(400).json({ message: "Results data is required" });
    }

    // Create a PDF document
    const doc = new PDFDocument({
      margins: {
        top: 50,
        bottom: 50,
        left: 50,
        right: 50,
      },
    });

    // Set response headers for PDF download
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="cv-screening-report-${Date.now()}.pdf"`
    );

    // Pipe PDF to response
    doc.pipe(res);

    // Track pages manually
    let currentPage = 1;

    // Function to add footer to current page
    const addFooter = () => {
      doc
        .fillColor("#9CA3AF")
        .fontSize(8)
        .font("Helvetica")
        .text(
          `Page ${currentPage} • Generated by DevLupa CV Screening System`,
          50,
          doc.page.height - 30,
          { align: "center" }
        );
    };

    // Function to check if we need new page (without adding footer)
    const checkNewPage = (requiredHeight = 0) => {
      if (yPosition + requiredHeight > 700) {
        // Reset to 700 since we're adding footer at the end
        doc.addPage();
        currentPage++;
        yPosition = 50;
        return true;
      }
      return false;
    };

    // Header Section
    doc
      .fillColor("#4F46E5")
      .fontSize(24)
      .font("Helvetica-Bold")
      .text("CV SCREENING REPORT", 50, 50, { align: "center" });

    doc
      .fillColor("#666666")
      .fontSize(10)
      .font("Helvetica")
      .text(`Generated on: ${new Date().toLocaleString()}`, 50, 85, {
        align: "center",
      });

    // Divider line
    doc
      .moveTo(50, 100)
      .lineTo(545, 100)
      .strokeColor("#E5E7EB")
      .lineWidth(1)
      .stroke();

    let yPosition = 120;

    // Job Details Section - COMPACT
    doc
      .fillColor("#111827")
      .fontSize(14)
      .font("Helvetica-Bold")
      .text("JOB DETAILS", 50, yPosition);

    yPosition += 20;

    doc
      .fillColor("#374151")
      .fontSize(9)
      .font("Helvetica")
      .text("Eligibility Threshold:", 50, yPosition);

    doc
      .fillColor("#059669")
      .fontSize(9)
      .font("Helvetica-Bold")
      .text(`${threshold}%`, 160, yPosition);

    yPosition += 15;

    doc
      .fillColor("#374151")
      .fontSize(9)
      .font("Helvetica")
      .text("Job Requirement:", 50, yPosition);

    // Handle long requirement text
    const requirementText =
      requirement.length > 120
        ? requirement.substring(0, 120) + "..."
        : requirement;

    doc
      .fillColor("#6B7280")
      .fontSize(8)
      .font("Helvetica")
      .text(requirementText, 160, yPosition, {
        width: 335,
        align: "left",
      });

    yPosition += 25;

    // Executive Summary Section - COMPACT
    doc
      .fillColor("#111827")
      .fontSize(14)
      .font("Helvetica-Bold")
      .text("EXECUTIVE SUMMARY", 50, yPosition);

    yPosition += 20;

    // Calculate counts
    const totalAnalyzed = results.length;
    const eligibleCount = results.filter((r) => r.eligible && !r.error).length;
    const invitationsSent = results.filter(
      (r) => r.eligible && !r.error && emailInputs && emailInputs[r.fileName]
    ).length;
    const noEmailCount = results.filter(
      (r) =>
        r.eligible && !r.error && (!emailInputs || !emailInputs[r.fileName])
    ).length;
    const notEligibleCount = results.filter(
      (r) => !r.eligible && !r.error
    ).length;
    const errorCount = results.filter((r) => r.error).length;

    // Summary in ultra-compact format
    const summaryItems = [
      `Total CVs Analyzed: ${totalAnalyzed}`,
      `Eligible Candidates: ${eligibleCount}`,
      `Invitations Sent: ${invitationsSent}`,
      `Eligible - No Email: ${noEmailCount}`,
      `Not Eligible: ${notEligibleCount}`,
      `Analysis Errors: ${errorCount}`,
    ];

    doc.fillColor("#374151").fontSize(9).font("Helvetica");

    summaryItems.forEach((item, index) => {
      doc.text(`• ${item}`, 55, yPosition + index * 12);
    });

    yPosition += summaryItems.length * 12 + 15;

    // Detailed Results Sections
    const sections = [
      {
        title: "INVITATIONS SENT",
        data: results.filter(
          (r) =>
            r.eligible && !r.error && emailInputs && emailInputs[r.fileName]
        ),
        color: "#F59E0B",
        bgColor: "#F59E0B20",
      },
      {
        title: "ELIGIBLE - NO EMAIL",
        data: results.filter(
          (r) =>
            r.eligible && !r.error && (!emailInputs || !emailInputs[r.fileName])
        ),
        color: "#F59E0B",
        bgColor: "#F59E0B20",
      },
      {
        title: "NOT ELIGIBLE",
        data: results.filter((r) => !r.eligible && !r.error),
        color: "#F59E0B",
        bgColor: "#F59E0B20",
      },
      {
        title: "ANALYSIS ERRORS",
        data: results.filter((r) => r.error),
        color: "#F59E0B",
        bgColor: "#F59E0B20",
      },
    ];

    let hasContentOnPage = yPosition > 50;

    sections.forEach((section, sectionIndex) => {
      if (section.data.length === 0) return;

      // Only add minimal space if we already have content on this page
      if (hasContentOnPage && sectionIndex > 0) {
        yPosition += 3;
      }

      // Check if we need new page for section header
      checkNewPage(25);

      // Section header
      doc
        .roundedRect(50, yPosition, 495, 18, 2)
        .fillColor(section.bgColor)
        .fill();

      doc
        .fillColor(section.color)
        .fontSize(10)
        .font("Helvetica-Bold")
        .text(`${section.title} (${section.data.length})`, 55, yPosition + 5);

      yPosition += 22;

      hasContentOnPage = true;

      // Section content
      section.data.forEach((candidate, index) => {
        let candidateHeight = 28;

        if (
          section.title === "INVITATIONS SENT" &&
          emailInputs &&
          emailInputs[candidate.fileName]
        ) {
          candidateHeight = 34;
        } else if (section.title === "ANALYSIS ERRORS") {
          candidateHeight = 38;
        }

        // Check if we need new page
        checkNewPage(candidateHeight);

        // Candidate item
        doc
          .fillColor("#111827")
          .fontSize(8)
          .font("Helvetica-Bold")
          .text(`${index + 1}. ${candidate.fileName}`, 55, yPosition);

        // Score
        doc
          .fillColor("#6B7280")
          .fontSize(7)
          .font("Helvetica")
          .text(`Score: ${candidate.matchScore}%`, 55, yPosition + 12);

        // Email for invitations sent
        if (
          section.title === "INVITATIONS SENT" &&
          emailInputs &&
          emailInputs[candidate.fileName]
        ) {
          doc
            .fillColor("#059669")
            .fontSize(7)
            .font("Helvetica")
            .text(
              `Email: ${emailInputs[candidate.fileName]}`,
              55,
              yPosition + 24
            );
        }
        // Error message for analysis errors
        else if (section.title === "ANALYSIS ERRORS") {
          doc
            .fillColor("#EF4444")
            .fontSize(7)
            .font("Helvetica")
            .text(`Error: ${candidate.error}`, 55, yPosition + 24, {
              width: 480,
            });
        }

        yPosition += candidateHeight;

        // Add extra space between candidates (except after the last one)
        if (index < section.data.length - 1) {
          yPosition += 8;

          // Subtle separator line between candidates
          doc
            .moveTo(55, yPosition - 4)
            .lineTo(545, yPosition - 4)
            .strokeColor("#F3F4F6")
            .lineWidth(0.3)
            .stroke();
        }
      });
    });

    // Add footer to ALL pages at the end
    const totalPages = doc.bufferedPageRange
      ? doc.bufferedPageRange().count
      : currentPage;

    // Simple approach: just add footer to current content position
    if (yPosition < doc.page.height - 40) {
      // Add footer at bottom if there's space
      addFooter();
    } else {
      // If content goes to bottom, add footer on new page
      doc.addPage();
      currentPage++;
      yPosition = 50;
      addFooter();
    }

    // Finalize PDF
    doc.end();
  } catch (err) {
    console.error("PDF Generation Error:", err);
    if (!res.headersSent) {
      res.status(500).json({ message: "Failed to generate PDF report" });
    }
  }
};

// Helper function to validate email
function isValidEmail(email) {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}
