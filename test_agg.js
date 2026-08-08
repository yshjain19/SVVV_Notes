const dns = require('dns');
try {
  dns.setServers(['1.1.1.1', '8.8.8.8']);
} catch (e) {}

require('dotenv').config();
const mongoose = require('mongoose');

// Register models
const User = require('./models/user');
const Subject = require('./models/subject');
const Note = require('./models/note');

async function test() {
  await mongoose.connect(process.env.MONGODB_URI);
  console.log('Connected to MongoDB');

  const notesCount = await Note.countDocuments();
  console.log('Total notes:', notesCount);

  const activeSubjectsData = await Note.aggregate([
    { $group: { _id: "$subject", count: { $sum: 1 } } },
    { $sort: { count: -1 } },
    { $limit: 12 }
  ]);

  console.log('Aggregation result:', activeSubjectsData);
  
  const activeSubjectIds = activeSubjectsData.map(s => s._id);
  console.log('Mapped IDs:', activeSubjectIds);

  const activeSubjects = await Subject.find({ _id: { $in: activeSubjectIds } });
  console.log('Subjects found:', activeSubjects.map(s => s.name));

  mongoose.disconnect();
}

test().catch(console.error);
