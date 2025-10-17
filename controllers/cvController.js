require("dotenv").config();
const mongoose = require("mongoose");
// const nodemailer = require("nodemailer");
const fetch = global.fetch || require("node-fetch");
const pdfParse = require("pdf-parse");
const PDFDocument = require("pdfkit");
const crypto = require("crypto");
const sgMail = require("@sendgrid/mail");
sgMail.setApiKey(process.env.SENDGRID_API_KEY);

// Import models
const CVFile = require("../models/CVFile");
const CVScreening = require("../models/CVScreening");

if (!process.env.GEMINI_API_KEY) {
  console.error("ERROR: GEMINI_API_KEY is not found in your .env file!");
}

// ---------------------- Nodemailer Setup ---------------------- //
// const transporter = nodemailer.createTransport({
//   service: "gmail",
//   auth: {
//     user: process.env.EMAIL_USER,
//     pass: process.env.EMAIL_PASS,
//   },
// });

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

// ---------------------- Helper: Validate email ---------------------- //
const isValidEmail = (email) => {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
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
        "screeningId jobRequirement threshold totalAnalyzed eligibleCount invitationsSent manualEmailsSent createdAt"
      )
      .lean();

    // Calculate total sent for each screening and remaining emails
    const screenHistoryWithTotals = screenHistory.map((screening) => {
      const totalSent =
        (screening.invitationsSent || 0) + (screening.manualEmailsSent || 0);
      const remaining = screening.eligibleCount - totalSent;

      return {
        ...screening,
        totalSent,
        remaining,
        hasRemaining: remaining > 0,
      };
    });

    res.json(screenHistoryWithTotals);
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

    // Calculate counts for frontend - FIXED LOGIC
    const eligibleResults = screening.results.filter(
      (r) => r.eligible && !r.error
    );

    const eligibleWithEmail = eligibleResults.filter(
      (r) => r.extractedEmail && r.extractedEmail.trim() !== "" && !r.emailSent
    ).length;

    const eligibleWithoutEmail = eligibleResults.filter(
      (r) =>
        (!r.extractedEmail || r.extractedEmail.trim() === "") && !r.emailSent
    ).length;

    const eligibleEmailSent = eligibleResults.filter((r) => r.emailSent).length;

    // Separate counts for extracted vs manual emails
    const extractedEmailsSent = eligibleResults.filter(
      (r) => r.emailSent && r.emailType === "extracted"
    ).length;

    const manualEmailsSent = eligibleResults.filter(
      (r) => r.emailSent && r.emailType === "manual"
    ).length;

    // Add calculated counts to response
    screening.calculatedCounts = {
      eligibleWithEmail,
      eligibleWithoutEmail,
      eligibleEmailSent,
      extractedEmailsSent,
      manualEmailsSent,
      totalInvitationsSent: extractedEmailsSent + manualEmailsSent,
      totalEligible: eligibleResults.length,
    };

    res.json(screening);
  } catch (err) {
    console.error("Get Screening Details Error:", err);
    res.status(500).json({ message: "Failed to fetch screening details" });
  }
};

// ---------------------- Get CVs Without Email ---------------------- //
exports.getCVsWithoutEmail = async (req, res) => {
  try {
    const { screeningId } = req.params;
    const userId = req.user.id;

    // Find the screening by ID
    const screening = await CVScreening.findOne({
      screeningId,
      createdBy: userId,
    });

    if (!screening) {
      return res.status(404).json({
        success: false,
        message: "Screening not found",
      });
    }

    // Filter CVs that don't have valid email addresses AND haven't had emails sent yet
    const cvsWithoutEmail = screening.results
      .filter((result) => {
        // Only show eligible CVs without emails that haven't been sent yet
        return (
          result.eligible &&
          !result.error &&
          (!result.extractedEmail ||
            result.extractedEmail.trim() === "" ||
            !isValidEmail(result.extractedEmail)) &&
          !result.emailSent
        );
      })
      .map((result) => ({
        fileName: result.fileName,
        screeningId: screening.screeningId,
        matchScore: result.matchScore,
        eligible: result.eligible,
        extractedEmail: result.extractedEmail || null,
        emailSent: result.emailSent || false,
        emailSentTo: result.emailSentTo || null,
        emailSentAt: result.emailSentAt || null,
      }));

    res.json({
      success: true,
      cvs: cvsWithoutEmail,
      total: cvsWithoutEmail.length,
      screeningInfo: {
        jobRequirement: screening.jobRequirement,
        threshold: screening.threshold,
        totalAnalyzed: screening.totalAnalyzed,
        eligibleCount: screening.eligibleCount,
        invitationsSent: screening.invitationsSent || 0,
        manualEmailsSent: screening.manualEmailsSent || 0,
        totalSent:
          (screening.invitationsSent || 0) + (screening.manualEmailsSent || 0),
      },
    });
  } catch (error) {
    console.error("Error fetching CVs without email:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch CVs without email",
      error: error.message,
    });
  }
};

// ---------------------- Get Eligible CVs With Email (Not Sent) ---------------------- //
exports.getEligibleCVsWithEmail = async (req, res) => {
  try {
    const { screeningId } = req.params;
    const userId = req.user.id;

    // Find the screening by ID
    const screening = await CVScreening.findOne({
      screeningId,
      createdBy: userId,
    });

    if (!screening) {
      return res.status(404).json({
        success: false,
        message: "Screening not found",
      });
    }

    // Filter CVs that are eligible, have valid extracted emails, but haven't had emails sent yet
    const cvsEligibleWithEmail = screening.results
      .filter((result) => {
        return (
          result.eligible &&
          !result.error &&
          result.extractedEmail &&
          result.extractedEmail.trim() !== "" &&
          isValidEmail(result.extractedEmail) &&
          !result.emailSent
        );
      })
      .map((result) => ({
        fileName: result.fileName,
        screeningId: screening.screeningId,
        matchScore: result.matchScore,
        eligible: result.eligible,
        extractedEmail: result.extractedEmail,
        emailSent: result.emailSent || false,
        emailSentTo: result.emailSentTo || null,
        emailSentAt: result.emailSentAt || null,
      }));

    res.json({
      success: true,
      cvs: cvsEligibleWithEmail,
      total: cvsEligibleWithEmail.length,
      screeningInfo: {
        jobRequirement: screening.jobRequirement,
        threshold: screening.threshold,
        totalAnalyzed: screening.totalAnalyzed,
        eligibleCount: screening.eligibleCount,
        invitationsSent: screening.invitationsSent || 0,
        manualEmailsSent: screening.manualEmailsSent || 0,
        totalSent:
          (screening.invitationsSent || 0) + (screening.manualEmailsSent || 0),
      },
    });
  } catch (error) {
    console.error("Error fetching eligible CVs with email:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch eligible CVs with email",
      error: error.message,
    });
  }
};

// ---------------------- SEND SINGLE REGISTRATION LINK ---------------------- //
exports.sendRegistrationLink = async (req, res) => {
  const { email, screeningId, fileName, isManual = false } = req.body;

  try {
    if (!email) {
      return res.status(400).json({ message: "Email is required" });
    }

    // SIMPLE REGISTRATION LINK - NO TOKEN
    const registrationLink = `https://devlupa.netlify.app/register`;

    console.log("✅ Sending registration email to:", email);

    // ---------------------- SEND VIA SENDGRID ---------------------- //
    const msg = {
      to: email.trim(),
      from: {
        email: "fmprabhath@gmail.com",
        name: "DevLupa Internship Program",
      },
      subject: "Registration for DevLupa Internship Program",
      text: `Congratulations! Your application has been selected for the DevLupa Internship Program. Please complete your registration: https://devlupa.netlify.app/register`,
      html: `
        <div style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto;">
          <div style="background: #f8f9fa; padding: 30px; text-align: center; border-bottom: 3px solid #007bff;">
            <h1 style="color: #2c3e50; margin: 0; font-size: 24px;">DevLupa Internship Program</h1>
            <p style="color: #6c757d; margin: 10px 0 0 0; font-size: 16px;">Registration Invitation</p>
          </div>
          
          <div style="padding: 30px;">
            <h2 style="color: #2c3e50; margin-top: 0;">Congratulations!</h2>
            
            <p>Dear Candidate,</p>
            
            <p>We are pleased to inform you that your application has been selected for the next stage of our internship program selection process.</p>
            
            <p>Based on your qualifications and experience, we believe you would be a great fit for our internship program.</p>
            
            <div style="text-align: center; margin: 30px 0;">
              <a href="${registrationLink}" 
                 style="background: #28a745; color: white; padding: 12px 30px; text-decoration: none; border-radius: 5px; font-weight: bold; display: inline-block; font-size: 16px;">
                Complete Your Registration
              </a>
            </div>
            
            <p><strong>Registration Link:</strong><br>
            <a href="${registrationLink}" style="color: #007bff; word-break: break-all;">${registrationLink}</a></p>
            
            <div style="background: #e9ecef; padding: 15px; border-radius: 5px; margin: 20px 0;">
              <p style="margin: 0; font-size: 14px;"><strong>Note:</strong> This invitation is valid for the current internship cycle. Please complete your registration at your earliest convenience.</p>
            </div>
            
            <p>If you have any questions, please don't hesitate to contact us.</p>
            
            <p>Best regards,<br>
            <strong>DevLupa Team</strong><br>
            Internship Program Coordinator</p>
          </div>
          
          <div style="background: #343a40; color: white; padding: 20px; text-align: center; font-size: 12px;">
            <p style="margin: 0;">© 2024 DevLupa Internship Program. All rights reserved.</p>
            <p style="margin: 5px 0 0 0;">
              <a href="https://devlupa.netlify.app" style="color: #17a2b8; text-decoration: none;">Visit Our Website</a>
            </p>
          </div>
        </div>
      `,
    };

    await sgMail.send(msg);

    console.log("✅ Email sent successfully to:", email);

    // Update screening record if screeningId provided - FIXED LOGIC
    if (screeningId && fileName) {
      try {
        // First, find the screening to check current counts
        const screening = await CVScreening.findOne({ screeningId });

        if (screening) {
          // Update the specific result
          const updateResult = await CVScreening.updateOne(
            {
              screeningId,
              "results.fileName": fileName,
            },
            {
              $set: {
                "results.$.emailSent": true,
                "results.$.emailSentTo": email,
                "results.$.emailSentAt": new Date(),
                "results.$.emailType": isManual ? "manual" : "extracted",
              },
            }
          );

          // Then update the counts - use $inc to properly increment
          if (updateResult.modifiedCount > 0) {
            if (isManual) {
              await CVScreening.updateOne(
                { screeningId },
                { $inc: { manualEmailsSent: 1 } }
              );
            } else {
              await CVScreening.updateOne(
                { screeningId },
                { $inc: { invitationsSent: 1 } }
              );
            }
            console.log("✅ Screening record updated for:", fileName);
          }
        }
      } catch (updateError) {
        console.error("❌ Failed to update screening:", updateError);
        throw updateError;
      }
    }

    res.status(200).json({
      message: "Registration email sent successfully.",
      screeningUpdated: !!screeningId,
      isManual: isManual,
    });
  } catch (error) {
    console.error(
      "❌ Error sending registration email:",
      error.response?.body || error
    );
    res.status(500).json({
      message: "Error sending registration link.",
      error: error.response?.body || error.message,
    });
  }
};

// ---------------------- SEND BULK REGISTRATION LINKS ---------------------- //
exports.sendBulkRegistrationLinks = async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const { emails, screeningId } = req.body;
    const userId = req.user.id;

    // console.log("Received bulk email request:", req.body);

    if (!emails || !Array.isArray(emails) || emails.length === 0) {
      return res
        .status(400)
        .json({ message: "Valid emails array is required." });
    }

    const sendResults = [];
    const sentEmails = [];
    const failedEmails = [];

    let manualEmailCount = 0;
    let extractedEmailCount = 0;

    for (const emailData of emails) {
      try {
        let email,
          fileName,
          isManual = false;

        if (typeof emailData === "string") {
          email = emailData;
          fileName = "";
        } else if (typeof emailData === "object" && emailData.email) {
          email = emailData.email;
          fileName = emailData.fileName || "";
          isManual = emailData.isManual || false;
        } else {
          throw new Error("Invalid email data format");
        }

        // Validate email format
        if (!email || !email.trim() || !isValidEmail(email)) {
          throw new Error("Invalid or empty email address");
        }

        // SIMPLE REGISTRATION LINK - NO TOKEN
        const registrationLink = `https://devlupa.netlify.app/register`;

        const msg = {
          to: email.trim(),
          from: {
            email: "fmprabhath@gmail.com",
            name: "DevLupa Support",
          },
          subject: "DevLupa Internship Registration Link",
          html: `
            <div style="font-family: Arial, sans-serif; line-height: 1.5;">
              <h2 style="color:#2c3e50;">Hello 👋,</h2>
              <p>You have been found eligible for the DevLupa internship program!</p>
              <p>Please click the link below to complete your registration:</p>
              <p>
                <a href="${registrationLink}" 
                   style="background-color:#007bff;color:#fff;padding:10px 20px;text-decoration:none;border-radius:6px;display:inline-block;">
                   Complete Registration
                </a>
              </p>
              <p><strong>Registration Link:</strong> ${registrationLink}</p>
              <br/>
              <p>Best regards,<br>DevLupa Team</p>
            </div>
          `,
        };

        await sgMail.send(msg);

        console.log("✅ Email sent via SendGrid:", email);
        sendResults.push({ email, fileName, status: "sent", isManual });
        sentEmails.push({ email, fileName, isManual });

        // Count email types
        if (isManual) {
          manualEmailCount++;
        } else {
          extractedEmailCount++;
        }

        // Update screening record if screeningId provided
        if (screeningId && fileName) {
          try {
            const updateFields = {
              $set: {
                "results.$.emailSent": true,
                "results.$.emailSentTo": email,
                "results.$.emailSentAt": new Date(),
                "results.$.emailType": isManual ? "manual" : "extracted",
              },
            };

            await CVScreening.updateOne(
              {
                screeningId,
                createdBy: userId,
                "results.fileName": fileName,
              },
              updateFields,
              { session }
            );
            // console.log(`✅ Updated screening record for ${fileName}`);
          } catch (updateError) {
            console.error(
              `❌ Failed to update screening for ${fileName}:`,
              updateError
            );
          }
        }
      } catch (sendError) {
        console.error("❌ Failed to send via SendGrid:", emailData, sendError);
        const email =
          typeof emailData === "string"
            ? emailData
            : emailData.email || JSON.stringify(emailData);
        const fileName =
          typeof emailData === "object" ? emailData.fileName || "" : "";
        const isManual =
          typeof emailData === "object" ? emailData.isManual || false : false;

        sendResults.push({
          email,
          fileName,
          status: "failed",
          error: sendError.message,
          isManual,
        });
        failedEmails.push({
          email,
          fileName,
          reason: sendError.message,
          isManual,
        });
      }
    }

    // Update the screening with total counts - FIXED: Use $inc to add to existing counts
    if (screeningId) {
      try {
        const updateCounts = {};

        if (extractedEmailCount > 0) {
          updateCounts.$inc = { invitationsSent: extractedEmailCount };
        }

        if (manualEmailCount > 0) {
          if (updateCounts.$inc) {
            updateCounts.$inc.manualEmailsSent = manualEmailCount;
          } else {
            updateCounts.$inc = { manualEmailsSent: manualEmailCount };
          }
        }

        if (updateCounts.$inc) {
          await CVScreening.updateOne(
            { screeningId, createdBy: userId },
            updateCounts,
            { session }
          );
          // console.log(
          //   `✅ Updated screening counts: ${extractedEmailCount} extracted, ${manualEmailCount} manual`
          // );
        }
      } catch (countError) {
        console.error("❌ Failed to update screening counts:", countError);
      }
    }

    await session.commitTransaction();

    const successfulSends = sendResults.filter(
      (result) => result.status === "sent"
    ).length;

    res.status(200).json({
      message: `Bulk registration process completed. ${successfulSends}/${emails.length} emails sent successfully.`,
      sentEmails: sentEmails,
      failedEmails: failedEmails,
      results: sendResults,
      totalSent: successfulSends,
      totalFailed: failedEmails.length,
      manualEmailCount: manualEmailCount,
      extractedEmailCount: extractedEmailCount,
    });
  } catch (error) {
    await session.abortTransaction();
    console.error("❌ Bulk registration error:", error);
    res.status(500).json({
      message: "Server error during bulk email sending",
      error: error.message,
    });
  } finally {
    session.endSession();
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
