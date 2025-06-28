// controllers/quizController.js
const Quiz = require("../models/Quiz");
const QuizResult = require("../models/QuizResult");

// Create a new quiz (Admin only)
exports.createQuiz = async (req, res) => {
  try {
    const { course, title, questions, timeLimit } = req.body;

    if (
      !course ||
      !title ||
      !questions ||
      !Array.isArray(questions) ||
      questions.length !== 2
    ) {
      return res.status(400).json({
        message: "Course, title, and exactly 10 questions are required",
      });
    }

    const quiz = await Quiz.create({ course, title, questions, timeLimit });
    return res.status(201).json(quiz);
  } catch (error) {
    console.error("Create quiz error:", error);
    return res
      .status(500)
      .json({ message: "Server error", error: error.message });
  }
};

// Get all quizzes by course ID (Student access)
exports.getQuizzesByCourse = async (req, res) => {
  try {
    const { courseId } = req.params;

    if (!courseId) {
      return res.status(400).json({ message: "Course ID is required" });
    }

    const quizzes = await Quiz.find({ course: courseId });
    return res.json(quizzes);
  } catch (error) {
    return res
      .status(500)
      .json({ message: "Server error", error: error.message });
  }
};

// Get quiz details by quiz ID
exports.getQuizById = async (req, res) => {
  try {
    const { quizId } = req.params;

    if (!quizId) {
      return res.status(400).json({ message: "Quiz ID is required" });
    }

    const quiz = await Quiz.findById(quizId);
    if (!quiz) {
      return res.status(404).json({ message: "Quiz not found" });
    }

    return res.json(quiz);
  } catch (error) {
    return res
      .status(500)
      .json({ message: "Server error", error: error.message });
  }
};

// Submit quiz answers (Student)
exports.submitQuiz = async (req, res) => {
  try {
    const { quizId } = req.params;
    const { answers } = req.body; // Expected: array of selected option indexes, e.g. [1,0,2,...]
    const studentId = req.user._id;

    if (!quizId) {
      return res.status(400).json({ message: "Quiz ID is required" });
    }

    if (!answers || !Array.isArray(answers)) {
      return res.status(400).json({ message: "Answers array is required" });
    }

    const quiz = await Quiz.findById(quizId);
    if (!quiz) {
      return res.status(404).json({ message: "Quiz not found" });
    }

    if (answers.length !== quiz.questions.length) {
      return res.status(400).json({
        message: "Number of answers does not match number of questions",
      });
    }

    // Calculate score
    let score = 0;
    quiz.questions.forEach((q, i) => {
      const selectedIndex = answers[i];
      if (
        typeof selectedIndex === "number" &&
        q.options[selectedIndex] &&
        q.options[selectedIndex].isCorrect === true
      ) {
        score += 1;
      }
    });

    // Save the result
    const existingResult = await QuizResult.findOne({
      quiz: quizId,
      student: studentId,
    });
    if (existingResult) {
      // Optional: prevent resubmission or update score (depends on your app logic)
      return res
        .status(400)
        .json({ message: "You have already submitted this quiz." });
    }

    const result = await QuizResult.create({
      student: studentId,
      quiz: quizId,
      score,
    });

    return res.json({ message: "Quiz submitted successfully", score });
  } catch (error) {
    return res
      .status(500)
      .json({ message: "Server error", error: error.message });
  }
};

exports.getAllQuizzes = async (req, res) => {
  try {
    const quizzes = await Quiz.find().populate('course', 'title');
    res.json(quizzes);
  } catch (error) {
    console.error('Error fetching quizzes:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

exports.deleteQuiz = async (req, res) => {
  try {
    const quiz = await Quiz.findByIdAndDelete(req.params.quizId);
    if (!quiz) {
      return res.status(404).json({ message: "Quiz not found" });
    }
    res.json({ message: "Quiz deleted successfully" });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Server error" });
  }
};



// Get all quiz results for a quiz (Admin only)
exports.getQuizResults = async (req, res) => {
  try {
    const { quizId } = req.params;

    if (!quizId) {
      return res.status(400).json({ message: "Quiz ID is required" });
    }

    const results = await QuizResult.find({ quiz: quizId }).populate(
      "student",
      "name email"
    );
    return res.json(results);
  } catch (error) {
    return res
      .status(500)
      .json({ message: "Server error", error: error.message });
  }
};
