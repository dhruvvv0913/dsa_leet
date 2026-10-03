// Preview mode only: an illustrative leaderboard, as the cohort might look a few weeks in.
// These are fictional sample students; the real leaderboard ranks real students from the database.

export const SAMPLE_TOTALS = { totalProblems: 96, classesHeld: 6 };

// [name, problems solved, classes attended]
export const SAMPLE_STUDENTS: [string, number, number][] = [
  ["Ananya Krishnan", 94, 6],
  ["Rohan Kulkarni", 96, 4],
  ["Diya Patel", 88, 6],
  ["Kabir Saxena", 81, 6],
  ["Meera Nambiar", 85, 5],
  ["Arjun Nair", 77, 6],
  ["Saanvi Joshi", 90, 3],
  ["Ishaan Mehta", 70, 6],
  ["Priya Bhatt", 72, 5],
  ["Vivaan Gupta", 66, 6],
  ["Nikhil Menon", 74, 4],
  ["Tanvi Desai", 58, 6],
  ["Aditya Verma", 61, 5],
  ["Sneha Kumari", 49, 6],
  ["Harsh Choudhary", 63, 2],
  ["Kavya Shetty", 44, 5],
  ["Yash Jain", 38, 4],
  ["Riya Sen", 30, 5],
  ["Aryan Tiwari", 22, 3],
  ["Lipsa Nayak", 15, 2],
];

/** The viewing student's own sample row, placed outside the top 10 to show "your rank". */
export const SAMPLE_YOU = { solved: 55, attended: 5 };
